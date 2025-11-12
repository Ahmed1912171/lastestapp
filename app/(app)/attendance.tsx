// app/(tabs)/attendance.tsx
import axios from "axios";
import * as Location from "expo-location";
import {
  Activity,
  Calendar,
  Clock,
  LogOut,
  MapPin,
  UserCheck,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SimpleAvatar from "../../components/SimpleAvatar";
import { useSession } from "../../ctx";

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
  leftEarlyDays?: number;
  fullDays?: number;
};

export default function AttendanceScreen() {
  const { session } = useSession();
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalDays: 0,
    lateDays: 0,
    onTimeDays: 0,
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

  // ✅ API Configuration
  const LOCAL_IP = "192.168.100.93";
  const API_BASE =
    Platform.OS === "android"
      ? "http://10.0.2.2:3000"
      : `http://${LOCAL_IP}:3000`;

  const pinNumber = session?.user?.pinNumber;
  const userName = session?.user?.GR_EMPLOYER_LOGIN?.split("-")[0] || "User";
  const branch = session?.user?.branch || "korangi";

  // ✅ Store which branches user is near
  const [nearbyBranches, setNearbyBranches] = useState<string[]>([]);

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
      setStats(res.data || { totalDays: 0, lateDays: 0, onTimeDays: 0 });
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
      console.log("📤 Sending check-in request...");
      const res = await axios.post(`${API_BASE}/attendance/mark`, {
        pinNumber,
        branch,
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
      console.log("📤 Sending check-out request...");
      const res = await axios.post(`${API_BASE}/attendance/timeout`, {
        pinNumber,
        branch,
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
      {/* Header */}
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

      {/* Attendance Logs - Pull to Refresh Wrapper */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
        showsVerticalScrollIndicator={true}
        bounces={true}
        alwaysBounceVertical={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#00A652", "#3b82f6"]}
            tintColor="#00A652"
            title="Pull to refresh"
            titleColor="#666"
          />
        }
      >
        {/* 📍 Location Status */}
        <View
          style={{
            paddingHorizontal: 16,
            marginBottom: 8,
            backgroundColor: isWithinGeofence ? "#dcfce7" : "#fee2e2",
            padding: 12,
            borderRadius: 8,
            borderWidth: 2,
            borderColor: isWithinGeofence ? "#10b981" : "#ef4444",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <MapPin size={18} color={isWithinGeofence ? "#10b981" : "#ef4444"} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "700",
                marginLeft: 6,
                color: isWithinGeofence ? "#065f46" : "#991b1b",
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

          {/* Current Time Display */}
          <View style={styles.timeDisplay}>
            <Clock size={16} color="#666" />
            <Text style={styles.timeText}> Current Time: {currentTime}</Text>
          </View>
        </View>

        {/* Stats Dashboard */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Activity size={20} color="#10b981" />
              <Text style={styles.statLabel}>Total Days</Text>
              <Text style={styles.statValue}>{stats.totalDays}</Text>
            </View>
            <View style={styles.statCard}>
              <Clock size={20} color="#10b981" />
              <Text style={styles.statLabel}>On Time</Text>
              <Text style={styles.statValue}>{stats.onTimeDays}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Calendar size={20} color="#ef4444" />
              <Text style={styles.statLabel}>Late Days</Text>
              <Text style={styles.statValue}>{stats.lateDays}</Text>
            </View>
            <View style={styles.statCard}>
              <LogOut size={20} color="#f59e0b" />
              <Text style={styles.statLabel}>Left Early</Text>
              <Text style={styles.statValue}>{stats.leftEarlyDays || 0}</Text>
            </View>
          </View>
        </View>

        {/* Attendance History List */}
        <View style={{ paddingHorizontal: 16 }}>
        {attendanceLogs.length === 0 ? (
          <Text style={{ textAlign: "center", color: "#666", marginTop: 40 }}>
            No attendance records found. Pull to refresh.
          </Text>
        ) : (
          attendanceLogs.map((log) => {
            // ✅ Status: 0 = initial, 1 = Check In, 2 = Check Out
            const statusText =
              log.Status === 2
                ? "Checked Out"
                : log.Status === 1
                  ? "Checked In"
                  : "Pending";
            const statusColor =
              log.Status === 2
                ? "#10b981"
                : log.Status === 1
                  ? "#3b82f6"
                  : "#999";

            // ✅ Check if late or left early based on actual AttendanceTime
            // For Check In (Status=1): use AttendanceTime to check if late
            // For Check Out (Status=2): use AttendanceTime to check if left early
            const wasLate = log.Status === 1 ? isTimeLate(log.AttendanceTime) : false;
            const didLeaveEarly = log.Status === 2 ? isLeftEarly(log.AttendanceTime) : false;

            return (
              <View key={`${log.AttendanceID}-${log.AttendanceDate}-${log.timeIn}`} style={styles.logCard}>
                {/* Date and Status */}
                <View
                  style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "600" }}>
                    {formatDate(log.AttendanceDate)}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    {wasLate && (
                      <View style={styles.badgeLate}>
                        <Text style={styles.badgeText}>Late</Text>
                      </View>
                    )}
                    {didLeaveEarly && (
                      <View style={styles.badgeEarly}>
                        <Text style={styles.badgeText}>Left Early</Text>
                      </View>
                    )}
                    <Text
                      style={{
                        color: statusColor,
                        fontWeight: "600",
                        fontSize: 13,
                      }}
                    >
                      {statusText}
                    </Text>
                  </View>
                </View>

                {/* Time In and Time Out */}
                {/* Show actual time based on Status */}
                <View style={{ marginTop: 6 }}>
                  {log.Status === 1 && (
                    <View>
                      <Text style={{ color: "#555", fontSize: 13 }}>
                        Time In: {log.AttendanceTime}
                      </Text>
                      {wasLate && (
                        <Text style={{ fontSize: 10, color: "#dc2626", marginTop: 2 }}>
                          ⚠️ After 9:15 AM
                        </Text>
                      )}
                    </View>
                  )}
                  {log.Status === 2 && (
                    <View>
                      <Text style={{ color: "#555", fontSize: 13 }}>
                        Time Out: {log.AttendanceTime}
                      </Text>
                      {didLeaveEarly && (
                        <Text style={{ fontSize: 10, color: "#f59e0b", marginTop: 2 }}>
                          ⚠️ Before 4:55 PM
                        </Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Machine Name */}
                <Text style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                  Source: {log.MachineName}
                </Text>
              </View>
            );
          })
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  container: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  title: { fontSize: 20, fontWeight: "600" },
  subtitle: { color: "#666", fontSize: 14 },
  pinText: { color: "#999", fontSize: 12, marginTop: 2 },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  checkInButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
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
    backgroundColor: "#10b981",
  },

  checkOutButton: {
    flex: 1,
    backgroundColor: "#f59e0b",
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
    backgroundColor: "#10b981",
  },

  buttonDisabled: {
    backgroundColor: "#9ca3af",
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

  timeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },

  timeText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },

  statsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  statCard: {
    backgroundColor: "#fff",
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statLabel: { color: "#666", marginTop: 4, fontSize: 11 },
  statValue: { fontSize: 16, fontWeight: "600", marginTop: 2 },

  logCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 16,
    textAlign: "center",
  },

  badgeLate: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#dc2626",
  },
  badgeEarly: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#f59e0b",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#000",
  },
});
