// app/(tabs)/attendance.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Device from "expo-device";
import * as Location from "expo-location";
import {
    ArrowLeft,
    Calendar,
    CalendarX,
    Clock,
    LogOut,
    MapPin,
    UserCheck
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../ctx";
import { useTheme } from "../ctx/theme";
import SimpleAvatar from "./SimpleAvatar";

// ✅ Attendance log type matching database structure
type AttendanceLog = {
  AttendanceID: number;
  PinNumber: number; // Stored as integer
  AttendanceDate: string; // YYYY-MM-DD
  AttendanceTime: string; // HH:MM AM/PM format
  timeIn: string | null; // HH:MM format
  timeOut: string | null; // HH:MM format
  Status: number; // 0 = initial, 1 = Check In, 2 = Check Out
  MachineName: string;
  AttendanceDateTime: string;
};

// ✅ Helper to parse "HH:MM AM/PM" format to 24-hour minutes
const parseAttendanceTime = (timeStr: string | null): number | null => {
  if (!timeStr) return null;
  try {
    // Format: "10:30 AM" or "05:45 PM"
    const [time, period] = timeStr.split(" ");
    const [hoursStr, minutesStr] = time.split(":");
    let hours = parseInt(hoursStr);
    const minutes = parseInt(minutesStr);
    
    // Convert to 24-hour format
    if (period === "PM" && hours !== 12) {
      hours += 12;
    } else if (period === "AM" && hours === 12) {
      hours = 0;
    }
    
    return hours * 60 + minutes;
  } catch {
    return null;
  }
};

// ✅ Helper to check if time was late (after 9:15 AM)
const isTimeLate = (timeStr: string | null): boolean => {
  const totalMinutes = parseAttendanceTime(timeStr);
  if (totalMinutes === null) return false;
  
  const cutoffMinutes = 9 * 60 + 15; // 9:15 AM = 555 minutes
  return totalMinutes > cutoffMinutes;
};

// ✅ Helper to check if left early (before 4:55 PM)
const isLeftEarly = (timeStr: string | null): boolean => {
  const totalMinutes = parseAttendanceTime(timeStr);
  if (totalMinutes === null) return false;
  
  const endTimeMinutes = 16 * 60 + 55; // 4:55 PM = 1015 minutes
  return totalMinutes < endTimeMinutes;
};

// 🗺️ Hospital/Branch Locations (GPS Coordinates)
// Add your actual hospital coordinates here
const BRANCH_LOCATIONS: Record<
  string,
  { latitude: number; longitude: number; name: string; radius: number }
> = {
  korangi: {
    latitude: 24.8301145,  // Replace with actual Korangi hospital coordinates
    longitude: 67.1631652,
    name: "Korangi Branch",
    radius: 100, // 100 meters radius
  },
  azambasti: {
    latitude: 24.8500635,  // Replace with actual coordinates
    longitude: 67.0780841,
    name: "Azambasti Branch",
    radius: 100,
  },
  ho: {
    latitude: 24.8782879,  // ✅ SICHN Head Office, Karachi (Jamshed Quarters, Amil Colony)
    longitude: 67.0433474,
    name: "SICHN Head Office",
    radius: 300, // ✅ 300 meters radius (larger for campus)
  },
  sba: {
    latitude: 26.2555275,
    longitude: 68.3906386,
    name: "SBA Branch",
    radius: 100,
  },
  sobhraj: {
    latitude: 24.8600,
    longitude: 67.0000,
    name: "Sobhraj Branch",
    radius: 100,
  },
  jamshoro: {
    latitude: 25.4284690,
    longitude: 68.2742770,
    name: "Jamshoro Branch",
    radius: 100,
  },
  larkana: {
    latitude: 27.5633394,
    longitude: 68.2046409,
    name: "Larkana Branch",
    radius: 100,
  },
  chs: {
    latitude: 27.7038176,
    longitude: 68.8321677,
    name: "CHS Branch",
    radius: 100,
  },
};

// ✅ Calculate distance between two GPS coordinates (Haversine formula)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

type Stats = {
  totalDays: number;
  lateDays: number;
  onTimeDays: number;
  leftEarlyDays: number;
  fullDays: number;
};

type AttendanceScreenProps = {
  onBack?: () => void;
};

export default function AttendanceScreen({ onBack }: AttendanceScreenProps) {
  const { session } = useSession();
  const { isDarkMode } = useTheme();
  const palette = useMemo(
    () => buildAttendancePalette(isDarkMode),
    [isDarkMode]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalDays: 0,
    lateDays: 0,
    onTimeDays: 0,
    leftEarlyDays: 0,
    fullDays: 0,
  });
  const [isPresent, setIsPresent] = useState(false);
  const [hasTimeOut, setHasTimeOut] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>("Checking...");
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean>(false);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<'total' | 'ontime' | 'late' | 'early'>('total');

  // ✅ API Configuration
  const LOCAL_IP = "192.168.101.39";
  const API_BASE =
    Platform.OS === "android"
      ? "http://10.0.2.2:3000"
      : `http://${LOCAL_IP}:3000`;

  const pinNumber = session?.user?.pinNumber;
  const userName = session?.user?.GR_EMPLOYER_LOGIN?.split("-")[0] || "User";
  const branch = session?.user?.branch || "korangi";

  // ✅ Store which branches user is near
  const [nearbyBranches, setNearbyBranches] = useState<string[]>([]);

  // ✅ Get or generate unique device ID (IMEI alternative)
  const getDeviceId = async (): Promise<string> => {
    try {
      // Check if we already have a stored device ID
      let deviceId = await AsyncStorage.getItem('DEVICE_UNIQUE_ID');
      
      if (!deviceId) {
        // Generate a new unique ID and store it
        deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem('DEVICE_UNIQUE_ID', deviceId);
      }
      
      return deviceId;
    } catch {
      return 'unknown-device';
    }
  };

  // 🗺️ Request location permissions and check ALL branch locations
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationStatus("Location permission denied");
          setIsWithinGeofence(false);
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const { latitude, longitude } = location.coords;
        setCurrentLocation({ latitude, longitude });

        // ✅ Check distance from ALL branches
        const branchDistances: { branch: string; name: string; distance: number; withinRange: boolean }[] = [];
        let isAtAnyBranch = false;
        const nearbyBranchNames: string[] = [];

        Object.entries(BRANCH_LOCATIONS).forEach(([branchKey, branchData]) => {
          const distance = calculateDistance(
            latitude,
            longitude,
            branchData.latitude,
            branchData.longitude
          );

          const withinRange = distance <= branchData.radius;
          
          branchDistances.push({
            branch: branchKey,
            name: branchData.name,
            distance: Math.round(distance),
            withinRange,
          });

          if (withinRange) {
            isAtAnyBranch = true;
            nearbyBranchNames.push(branchData.name);
          }
        });

        // Sort by distance (closest first)
        branchDistances.sort((a, b) => a.distance - b.distance);

        setIsWithinGeofence(isAtAnyBranch);
        setNearbyBranches(nearbyBranchNames);

        console.log("📍 Location Check - All Branches:", branchDistances);

        // Always show closest branch with distance in meters
        const closest = branchDistances[0];
        const meters = Math.round(closest.distance);
        setLocationStatus(`${closest.name} - ${meters}m`);
      } catch (error) {
        console.error("Location error:", error);
        setLocationStatus("Location unavailable");
        setIsWithinGeofence(false);
      }
    })();
  }, []);

  // ✅ Update current time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const hours = now.getHours() % 12 || 12;
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const ampm = now.getHours() >= 12 ? "PM" : "AM";
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Fetch attendance history
  const fetchAttendance = useCallback(async () => {
    if (!pinNumber) return;

    try {
      const res = await axios.get(
        `${API_BASE}/attendance/${pinNumber}?branch=${branch}`
      );
      const logs: AttendanceLog[] = res.data || [];
      
      console.log("📥 Backend returned logs:", logs);
      console.log("📊 Total records:", logs.length);
      
      setAttendanceLogs(logs);

      // ✅ Check for BOTH Check In (Status=1) and Check Out (Status=2) records today
      const today = new Date().toISOString().split("T")[0];
      console.log("📅 Today's date:", today);
      
      // ✅ Find today's check-in record (Status = 1)
      const todayCheckIn = logs.find((log) => 
        log.AttendanceDate === today && log.Status === 1
      );
      
      // ✅ Find today's check-out record (Status = 2)
      const todayCheckOut = logs.find((log) => 
        log.AttendanceDate === today && log.Status === 2
      );

      console.log("📋 Today's Check In Record:", todayCheckIn);
      console.log("📋 Today's Check Out Record:", todayCheckOut);

      // ✅ Update states
      const hasCheckedIn = !!todayCheckIn;
      const hasCheckedOut = !!todayCheckOut;
      
      setIsPresent(hasCheckedIn);
      setHasTimeOut(hasCheckedOut);
      
      console.log("🔄 Setting states:", {
        hasCheckedIn,
        hasCheckedOut,
        checkInID: todayCheckIn?.AttendanceID,
        checkOutID: todayCheckOut?.AttendanceID
      });
    } catch (err) {
      console.error("Error fetching attendance:", err);
    }
  }, [pinNumber, branch, API_BASE]);

  // ✅ Fetch statistics
  const fetchStats = useCallback(async () => {
    if (!pinNumber) return;

    try {
      const res = await axios.get(
        `${API_BASE}/attendance/${pinNumber}/stats?branch=${branch}`
      );
      console.log("📊 Stats received from backend:", res.data);
      setStats(res.data || { 
        totalDays: 0, 
        lateDays: 0, 
        onTimeDays: 0,
        leftEarlyDays: 0,
        fullDays: 0
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  }, [pinNumber, branch, API_BASE]);

  // ✅ Initial load
  useEffect(() => {
    if (pinNumber) {
      const loadInitialData = async () => {
        await Promise.all([fetchAttendance(), fetchStats()]);
      };
      
      loadInitialData();
    }
  }, [pinNumber, fetchAttendance, fetchStats]);

  // ✅ Mark Time In
  const markAttendance = async () => {
    console.log("🔄 Check In attempt:", {
      isPresent,
      pinNumber,
      isWithinGeofence,
      canCheckIn: !isPresent && !!pinNumber && isWithinGeofence
    });

    if (isPresent) {
      Alert.alert("⚠️ Already Checked In", "You have already checked in today.");
      return;
    }

    if (!pinNumber) {
      Alert.alert("⚠️ Error", "PinNumber not found. Please log in again.");
      return;
    }

    // 🗺️ Check geofence
    if (!isWithinGeofence) {
      Alert.alert(
        "📍 Location Required",
        `You must be at any SICHN branch location to mark attendance.\n\n${locationStatus}`,
        [
          { text: "OK", style: "cancel" },
        ]
      );
      return;
    }

    setLoading(true);
    try {
      // ✅ Get device information
      const deviceName = `${Device.manufacturer || ''} ${Device.modelName || 'Unknown Device'}`.trim();
      const deviceId = await getDeviceId();
      
      console.log("📤 Sending check-in request...");
      console.log("📱 Device Info:", { deviceName, deviceId });
      
      const res = await axios.post(`${API_BASE}/attendance/mark`, {
        pinNumber,
        branch,
        deviceName,
        imei: deviceId, // Unique device identifier
      });

      console.log("📥 Check-in response:", res.data);

      if (res.data.success) {
        console.log("🔄 Waiting 500ms for database commit...");
        // Small delay to ensure database commit
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("🔄 Refreshing attendance data...");
        // Refresh data first to get updated record
        await fetchAttendance();
        await fetchStats();
        
        console.log("✅ States after refresh - isPresent:", isPresent, "hasTimeOut:", hasTimeOut);
        
        // ✅ Show status in alert
        const statusEmoji = res.data.isLate ? "⚠️" : "✅";
        const statusText = res.data.statusText || (res.data.isLate ? "Late" : "On Time");
        
        Alert.alert(
          `${statusEmoji} Check In - ${statusText}`,
          `Time In: ${res.data.timeIn}\n${res.data.message}`
        );
      }
    } catch (err: any) {
      console.error("❌ Error marking attendance:", err);
      console.error("Error details:", err.response?.data);
      Alert.alert("❌ Check In Error", err.response?.data?.error || "Failed to mark attendance");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Mark Time Out
  const markTimeOut = async () => {
    console.log("🔄 Check Out attempt:", {
      isPresent,
      hasTimeOut,
      pinNumber,
      isWithinGeofence,
      canCheckOut: isPresent && !hasTimeOut && !!pinNumber && isWithinGeofence
    });

    if (!isPresent) {
      Alert.alert("⚠️ Cannot Check Out", "Please Check In first!");
      return;
    }

    if (hasTimeOut) {
      Alert.alert("⚠️ Already Checked Out", "You have already checked out today.");
      return;
    }

    if (!pinNumber) {
      Alert.alert("⚠️ Error", "PinNumber not found. Please log in again.");
      return;
    }

    // 🗺️ Check geofence
    if (!isWithinGeofence) {
      Alert.alert(
        "📍 Location Required",
        `You must be at any SICHN branch location to mark attendance.\n\n${locationStatus}`,
        [
          { text: "OK", style: "cancel" },
        ]
      );
      return;
    }

    // ✅ Confirmation dialog
    Alert.alert(
      "Confirm Check Out",
      "Are you sure you want to check out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Check Out",
          style: "default",
          onPress: async () => {
            await performCheckOut();
          },
        },
      ]
    );
  };

  // ✅ Perform the actual check out
  const performCheckOut = async () => {
    setLoading(true);
    try {
      // ✅ Get device information
      const deviceName = `${Device.manufacturer || ''} ${Device.modelName || 'Unknown Device'}`.trim();
      const deviceId = await getDeviceId();
      
      console.log("📤 Sending check-out request...");
      console.log("📱 Device Info:", { deviceName, deviceId });
      
      const res = await axios.post(`${API_BASE}/attendance/timeout`, {
        pinNumber,
        branch,
        deviceName,
        imei: deviceId, // Unique device identifier
      });

      console.log("📥 Check-out response:", res.data);

      if (res.data.success) {
        console.log("🔄 Waiting 500ms for database update...");
        // Small delay to ensure database commit
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log("🔄 Refreshing attendance data...");
        // Refresh data
        await fetchAttendance();
        await fetchStats();
        
        // ✅ Show status in alert
        const statusEmoji = res.data.leftEarly ? "⚠️" : "✅";
        const statusText = res.data.statusText || (res.data.leftEarly ? "Left Early" : "Full Day");
        
        Alert.alert(
          `${statusEmoji} Check Out - ${statusText}`,
          `Time Out: ${res.data.timeOut}\n${res.data.message}`
        );
      } else {
        Alert.alert("⚠️ Check Out Failed", res.data.message || "Unknown error");
      }
    } catch (err: any) {
      console.error("❌ Error marking time out:", err);
      console.error("Error details:", err.response?.data);
      Alert.alert(
        "❌ Check Out Error", 
        err.response?.data?.error || err.message || "Failed to mark time out"
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Pull to refresh
  const onRefresh = async () => {
    console.log("🔄 Pull-to-refresh triggered");
    setRefreshing(true);
    
    try {
      console.log("📥 Fetching fresh data...");
      await Promise.all([fetchAttendance(), fetchStats()]);
      
      console.log("✅ Refresh complete");
    } catch (err) {
      console.error("❌ Refresh failed:", err);
      Alert.alert("Refresh Error", "Failed to refresh data. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  // ✅ Format time for display (HH:MM → HH:MM AM/PM)
  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "-";
    try {
      // timeStr is already in "HH:MM" format from database (e.g., "17:09")
      const [hours, minutes] = timeStr.split(":");
      const h = parseInt(hours);
      const ampm = h >= 12 ? "PM" : "AM";
      const displayHour = h % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeStr;
    }
  };

  // ✅ Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // ✅ Show message if no pinNumber
  if (!pinNumber) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            ⚠️ PinNumber not found. Please log in again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header with conditional back button - matches LeavesScreen */}
      {onBack ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color={palette.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Attendance</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Attendance</Text>
            <Text style={styles.subtitle}>Hello, {userName}</Text>
            <Text style={styles.pinText}>PIN: {pinNumber}</Text>
          </View>

          <SimpleAvatar
            fallback={userName.substring(0, 2).toUpperCase()}
            size={48}
          />
        </View>
      )}

      {/* Attendance Logs - Pull to Refresh Wrapper */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[palette.accent, palette.accentSecondary]}
            tintColor={palette.accent}
            title="Pull to refresh"
            titleColor={palette.textMuted}
          />
        }
      >
        {/* 📍 Location Status */}
        <View
          style={{
            paddingHorizontal: 16,
            marginBottom: 8,
            padding: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={18} color={palette.textMuted} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                marginLeft: 6,
                color: palette.textPrimary,
              }}
            >
              {locationStatus}
            </Text>
          </View>
        </View>

        {/* Mark Attendance Buttons */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          {/* Two-Column Layout for Check In / Check Out */}
          <View style={styles.buttonRow}>
            {/* Check In Button */}
            <TouchableOpacity
              style={[
                styles.checkInButton,
                isPresent && styles.checkInButtonActive,
                (!isWithinGeofence && !isPresent) && styles.buttonDisabled,
              ]}
              onPress={() => {
                console.log("👆 Check In button pressed!");
                markAttendance();
              }}
              disabled={isPresent || loading || !isWithinGeofence}
              activeOpacity={0.7}
            >
              {loading && !isPresent ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <UserCheck size={24} color="#fff" />
                  <Text style={styles.buttonLabel}>Check In</Text>
                  {isPresent && (
                    <Text style={styles.buttonTime}>✓ Done</Text>
                  )}
                </>
              )}
            </TouchableOpacity>

            {/* Check Out Button */}
            <TouchableOpacity
              style={[
                styles.checkOutButton,
                hasTimeOut && styles.checkOutButtonActive,
                (!isPresent || !isWithinGeofence) && styles.buttonDisabled,
              ]}
              onPress={() => {
                console.log("👆 Check Out button pressed!");
                markTimeOut();
              }}
              disabled={!isPresent || hasTimeOut || loading || !isWithinGeofence}
              activeOpacity={0.7}
            >
              {loading && isPresent && !hasTimeOut ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <LogOut size={24} color="#fff" />
                  <Text style={styles.buttonLabel}>Check Out</Text>
                  {hasTimeOut ? (
                    <Text style={styles.buttonTime}>✓ Done</Text>
                  ) : !isPresent ? (
                    <Text style={styles.buttonTime}>Check In First</Text>
                  ) : (
                    <Text style={styles.buttonTime}>Ready</Text>
                  )}
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Dashboard - Filters */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <TouchableOpacity 
              style={[styles.statCard, selectedFilter === 'total' && styles.statCardActive]}
              onPress={() => setSelectedFilter('total')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#d5e49eff" }]}>
                <Calendar size={16} color="#000" />
              </View>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{stats.totalDays}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.statCard, selectedFilter === 'ontime' && styles.statCardActive]}
              onPress={() => setSelectedFilter('ontime')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#96eba2ff" }]}>
                <Clock size={16} color="#000" />
              </View>
              <Text style={styles.statLabel}>On Time</Text>
              <Text style={styles.statValue}>{stats.onTimeDays}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.statCard, selectedFilter === 'late' && styles.statCardActive]}
              onPress={() => setSelectedFilter('late')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#fecaca" }]}>
                <CalendarX size={16} color="#000" />
              </View>
              <Text style={styles.statLabel}>Late</Text>
              <Text style={styles.statValue}>{stats.lateDays}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.statCard, selectedFilter === 'early' && styles.statCardActive]}
              onPress={() => setSelectedFilter('early')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#fef3c7" }]}>
                <LogOut size={16} color="#000" />
              </View>
              <Text style={styles.statLabel}>Left Early</Text>
              <Text style={styles.statValue}>{stats.leftEarlyDays}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Attendance History List */}
        <View style={{ paddingHorizontal: 16 }}>
        {(() => {
          // ✅ Group logs by date
          const groupedByDate = new Map<string, { checkIn: AttendanceLog | null; checkOut: AttendanceLog | null }>();
          
          attendanceLogs.forEach((log) => {
            const dateStr = new Date(log.AttendanceDate).toISOString().split('T')[0];
            
            if (!groupedByDate.has(dateStr)) {
              groupedByDate.set(dateStr, { checkIn: null, checkOut: null });
            }
            
            const dayData = groupedByDate.get(dateStr)!;
            if (log.Status === 1) {
              dayData.checkIn = log;
            } else if (log.Status === 2) {
              dayData.checkOut = log;
            }
          });

          // ✅ Convert to array and sort by date descending
          const groupedArray = Array.from(groupedByDate.entries())
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          // ✅ Filter based on selected filter
          const filteredDays = groupedArray.filter((day) => {
            if (selectedFilter === 'total') return true;
            
            if (selectedFilter === 'ontime') {
              return day.checkIn && !isTimeLate(day.checkIn.AttendanceTime);
            }
            
            if (selectedFilter === 'late') {
              return day.checkIn && isTimeLate(day.checkIn.AttendanceTime);
            }
            
            if (selectedFilter === 'early') {
              return day.checkOut && isLeftEarly(day.checkOut.AttendanceTime);
            }
            
            return true;
          });

          if (filteredDays.length === 0) {
            return (
              <Text
                style={{ textAlign: "center", color: palette.textMuted, marginTop: 40 }}
              >
                No {selectedFilter === 'total' ? '' : selectedFilter === 'ontime' ? 'on-time' : selectedFilter === 'late' ? 'late' : 'left early'} records found.
              </Text>
            );
          }

          return filteredDays.map((day) => {
            const wasLate = day.checkIn ? isTimeLate(day.checkIn.AttendanceTime) : false;
            const didLeaveEarly = day.checkOut ? isLeftEarly(day.checkOut.AttendanceTime) : false;
            const hasCheckOut = !!day.checkOut;

            return (
              <View
                key={day.date}
                style={[
                  styles.logCard,
                  { borderLeftWidth: 3, borderLeftColor: palette.accent },
                ]}
              >
                {/* Header: Date & Badges */}
                <View style={styles.logCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.compactDate}>
                      {formatDate(day.date)}
                    </Text>
                    <Text style={styles.compactDayOfWeek}>
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </Text>
                  </View>
                  
                  {/* Status Badges */}
                  <View style={styles.compactBadgeContainer}>
                    {wasLate && (
                      <View style={styles.badgeLate}>
                        <Text style={styles.badgeText}>Late</Text>
                      </View>
                    )}
                    {didLeaveEarly && (
                      <View style={styles.badgeEarly}>
                        <Text style={styles.badgeText}>Early</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Time Row */}
                <View style={styles.timeRowCombined}>
                  {/* Check In */}
                  {day.checkIn && (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.compactIconWrapper, { backgroundColor: '#00A65220' }]}>
                        <UserCheck size={14} color={palette.accent} />
                      </View>
                      <View>
                        <Text style={styles.timeLabel}>IN</Text>
                        <Text style={styles.compactTime}>{day.checkIn.AttendanceTime}</Text>
                      </View>
                    </View>
                  )}

                  {/* Check Out */}
                  {day.checkOut && (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.compactIconWrapper, { backgroundColor: '#28a74520' }]}>
                        <LogOut size={14} color="#28a745" />
                      </View>
                      <View>
                        <Text style={styles.timeLabel}>OUT</Text>
                        <Text style={styles.compactTime}>{day.checkOut.AttendanceTime}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          });
        })()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type AttendancePalette = ReturnType<typeof buildAttendancePalette>;

const buildAttendancePalette = (isDarkMode: boolean) => ({
  background: isDarkMode ? "#000000" : "#f3f4f6",
  card: isDarkMode ? "#0d0d0d" : "#fff",
  surface: isDarkMode ? "#080808" : "#fff",
  border: isDarkMode ? "#1a1a1a" : "#e5e7eb",
  textPrimary: isDarkMode ? "#f8fafc" : "#1a1a1a",
  textMuted: isDarkMode ? "#a1a1aa" : "#666",
  pin: isDarkMode ? "#cbd5f5" : "#999",
  accent: "#00A652",
  accentSecondary: "#3b82f6",
  iconBackground: isDarkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4",
  disabled: isDarkMode ? "#475569" : "#9ca3af",
  statActiveBg: isDarkMode ? "rgba(34,197,94,0.15)" : "#f0fdf4",
  error: "#f87171",
  badgeLateBg: "#fecaca",
  badgeEarlyBg: "#fef3c7",
  badgeText: "#1a1a1a",
});

const createStyles = (palette: AttendancePalette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: palette.background,
    },
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollArea: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      backgroundColor: palette.card,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: palette.textPrimary,
    },
    title: { fontSize: 20, fontWeight: "600", color: palette.textPrimary },
    subtitle: { color: palette.textMuted, fontSize: 14 },
    pinText: { color: palette.pin, fontSize: 12, marginTop: 2 },

    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },

    checkInButton: {
      flex: 1,
      backgroundColor: palette.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 100,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },

    checkInButtonActive: {
      backgroundColor: palette.disabled,
    },

    checkOutButton: {
      flex: 1,
      backgroundColor: palette.accent,
      borderRadius: 12,
      padding: 16,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 100,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },

    checkOutButtonActive: {
      backgroundColor: palette.disabled,
    },

    buttonDisabled: {
      backgroundColor: palette.disabled,
      opacity: 0.6,
    },

    buttonLabel: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 16,
      marginTop: 8,
    },

    buttonTime: {
      color: "#fff",
      fontSize: 12,
      marginTop: 4,
      opacity: 0.9,
    },

    statsContainer: {
      paddingHorizontal: 16,
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 4,
    },
    statCard: {
      backgroundColor: palette.card,
      flex: 1,
      marginHorizontal: 2,
      borderRadius: 8,
      padding: 6,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
      borderWidth: 2,
      borderColor: "transparent",
    },
    statCardActive: {
      borderColor: palette.accent,
      backgroundColor: palette.statActiveBg,
    },
    iconWrapper: {
      padding: 5,
      backgroundColor: palette.iconBackground,
      borderRadius: 6,
      marginBottom: 3,
    },
    statLabel: {
      color: palette.textMuted,
      marginTop: 2,
      fontSize: 9,
      textAlign: "center",
    },
    statValue: { fontSize: 13, fontWeight: "700", marginTop: 1, color: palette.textPrimary },

    logCard: {
      backgroundColor: palette.card,
      borderRadius: 8,
      padding: 10,
      marginBottom: 8,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },

    singleLineRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    compactIconWrapper: {
      width: 28,
      height: 28,
      borderRadius: 6,
      justifyContent: "center",
      alignItems: "center",
    },

    compactDate: {
      fontSize: 13,
      fontWeight: "700",
      color: palette.textPrimary,
    },

    compactDayOfWeek: {
      fontSize: 10,
      color: palette.textMuted,
      fontWeight: "500",
    },

    compactTime: {
      fontSize: 12,
      fontWeight: "700",
      color: palette.textPrimary,
    },

    compactBadgeContainer: {
      flexDirection: "row",
      gap: 4,
      alignItems: "center",
    },

    logCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },

    timeRowCombined: {
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },

    timeLabel: {
      fontSize: 9,
      color: palette.textMuted,
      fontWeight: "700",
      letterSpacing: 0.5,
    },

    errorContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    errorText: {
      color: palette.error,
      fontSize: 16,
      textAlign: "center",
    },

    badgeLate: {
      backgroundColor: palette.badgeLateBg,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeEarly: {
      backgroundColor: palette.badgeEarlyBg,
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
    },
    badgeText: {
      fontSize: 8,
      fontWeight: "700",
      color: palette.badgeText,
    },
  });

