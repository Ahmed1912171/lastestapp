import axios from "axios";
import {
    ArrowLeft,
    Calendar,
    CalendarX,
    CheckCircle,
    Clock,
    LogOut,
    User,
    UserCheck,
    UserX
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
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../ctx";
import { useTheme } from "../ctx/theme";
import SimpleAvatar from "./SimpleAvatar";

type Employee = {
  ADMIN_ID?: number;
  ADMIN_FIRST_NAME?: string;
  ADMIN_LAST_NAME?: string;
  GR_EMPLOYER_LOGIN?: string;
  EIS_EMPLOYEE_CODE?: string;
  EIS_EMPLOYEE_NAME?: string;
  manager_id?: number;
  empid?: number;
  pinNumber?: number;
};

type AttendanceLog = {
  AttendanceID: number;
  PinNumber: number;
  AttendanceDate: string;
  AttendanceTime: string;
  timeIn: string | null;
  timeOut: string | null;
  Status: number;
  MachineName: string;
  AttendanceDateTime: string;
};

type TeamAttendance = {
  employee: Employee;
  attendance: {
    AttendanceID?: number;
    AttendanceDate: string;
    AttendanceTime?: string;
    timeIn?: string | null;
    timeOut?: string | null;
    Status?: number;
    MachineName?: string;
  } | null;
  isPresent: boolean;
  isLate: boolean;
  leftEarly: boolean;
};

type TeamsAttendenceProps = {
  onBack?: () => void;
};

export default function TeamsAttendence({ onBack }: TeamsAttendenceProps) {
  const { session } = useSession();
  const { isDarkMode } = useTheme();
  const palette = useMemo(() => buildAttendancePalette(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const managerStatus = (session?.user as any)?.manager_status;
  const isManager = managerStatus === 1 || managerStatus === 2;
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [teamAttendance, setTeamAttendance] = useState<TeamAttendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [selectedEmployeeHistory, setSelectedEmployeeHistory] = useState<AttendanceLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  });

  const LOCAL_IP = "192.168.100.162";
  const API_BASE =
    Platform.OS === "android" ? "http://10.0.2.2:3000" : `http://${LOCAL_IP}:3000`;

  const branch = session?.user?.branch || "korangi";

  // Extract PIN number from GR_EMPLOYER_LOGIN
  const extractPinNumber = (grLogin: string): number | null => {
    if (!grLogin) return null;
    const parts = grLogin.split("-");
    if (parts.length > 1) {
      const pinStr = parts[parts.length - 1].replace(/\D/g, "");
      const pin = parseInt(pinStr, 10);
      return isNaN(pin) ? null : pin;
    }
    return null;
  };

  // Get manager's PIN number from session
  const managerPin = session?.user?.pinNumber || null;

  // Fetch employees for the logged-in manager
  const fetchEmployees = useCallback(async () => {
    if (!isManager) {
      return;
    }
    if (!managerPin) {
      console.error("Manager PIN not found in session");
      Alert.alert("Error", "Manager information not found. Please login again.");
      return;
    }

    try {
      // Note: branch parameter is not needed - endpoint shows all employees regardless of branch
      const res = await axios.get(
        `${API_BASE}/employees/team?managerPin=${managerPin}`
      );
      const employeesData = res.data || [];
      setEmployees(employeesData);
    } catch (err) {
      console.error("Error fetching employees:", err);
      Alert.alert("Error", "Failed to load team employees. Please try again.");
    }
  }, [API_BASE, managerPin, isManager]);

  // Fetch attendance for all employees for selected date
  const fetchTeamAttendance = useCallback(async () => {
    if (employees.length === 0) return;
    
    try {
      setLoading(true);
      const attendancePromises = employees.map(async (employee) => {
        if (!employee.pinNumber) {
          return {
            employee,
            attendance: null,
            isPresent: false,
            isLate: false,
            leftEarly: false,
          };
        }

        try {
          const res = await axios.get(
            `${API_BASE}/attendance/${employee.pinNumber}?branch=${encodeURIComponent(branch)}&limit=100`
          );
          const attendanceRecords = res.data || [];
          
          // Find attendance for selected date
          const todayAttendance = attendanceRecords.find(
            (record: any) => record.AttendanceDate === selectedDate
          );

          if (!todayAttendance) {
            return {
              employee,
              attendance: null,
              isPresent: false,
              isLate: false,
              leftEarly: false,
            };
          }

          // Check if late (after 9:15 AM)
          const isLate = checkIfLate(todayAttendance.timeIn || todayAttendance.AttendanceTime);
          // Check if left early (before 4:55 PM)
          const leftEarly = checkIfLeftEarly(todayAttendance.timeOut);

          return {
            employee,
            attendance: todayAttendance,
            isPresent: true,
            isLate,
            leftEarly,
          };
        } catch (err) {
          console.error(`Error fetching attendance for PIN ${employee.pinNumber}:`, err);
          return {
            employee,
            attendance: null,
            isPresent: false,
            isLate: false,
            leftEarly: false,
          };
        }
      });

      const results = await Promise.all(attendancePromises);
      setTeamAttendance(results);
    } catch (err) {
      console.error("Error fetching team attendance:", err);
      Alert.alert("Error", "Failed to load team attendance. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [employees, selectedDate, API_BASE, branch]);

  useEffect(() => {
    if (isManager) {
      fetchEmployees();
    }
  }, [fetchEmployees, isManager]);
  useEffect(() => {
    if (!isManager) {
      const timeoutId = setTimeout(() => {
        Alert.alert(
          "Restricted Access",
          "Only managers can view team attendance.",
          [
            {
              text: onBack ? "Go Back" : "OK",
              onPress: () => {
                onBack?.();
              },
            },
          ],
          { cancelable: false }
        );
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [isManager, onBack]);

  if (!isManager) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={styles.restrictedContainer}>
          <Text style={styles.restrictedTitle}>Restricted Access</Text>
          <Text style={styles.restrictedSubtitle}>
            Only managers can view and manage team attendance.
          </Text>
          <TouchableOpacity
            style={styles.restrictedButton}
            onPress={() => onBack?.()}
            activeOpacity={0.7}
          >
            <Text style={styles.restrictedButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    if (employees.length > 0) {
      fetchTeamAttendance();
    }
  }, [employees, selectedDate, fetchTeamAttendance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEmployees();
    await fetchTeamAttendance();
    setRefreshing(false);
  }, [fetchEmployees, fetchTeamAttendance]);

  // Helper functions
  const checkIfLate = (timeStr: string | null | undefined): boolean => {
    if (!timeStr) return false;
    try {
      const time = parseAttendanceTime(timeStr);
      if (time === null) return false;
      const cutoffMinutes = 9 * 60 + 15; // 9:15 AM = 555 minutes
      return time > cutoffMinutes;
    } catch {
      return false;
    }
  };

  const checkIfLeftEarly = (timeStr: string | null | undefined): boolean => {
    if (!timeStr) return false;
    try {
      const time = parseAttendanceTime(timeStr);
      if (time === null) return false;
      const endTimeMinutes = 16 * 60 + 55; // 4:55 PM = 1015 minutes
      return time < endTimeMinutes;
    } catch {
      return false;
    }
  };

  const parseAttendanceTime = (timeStr: string): number | null => {
    if (!timeStr) return null;
    try {
      // Format: "10:30 AM" or "05:45 PM" or "HH:MM"
      const parts = timeStr.split(" ");
      let timePart = parts[0];
      const period = parts[1];
      
      const [hoursStr, minutesStr] = timePart.split(":");
      let hours = parseInt(hoursStr);
      const minutes = parseInt(minutesStr);
      
      if (period) {
        // 12-hour format
        if (period === "PM" && hours !== 12) {
          hours += 12;
        } else if (period === "AM" && hours === 12) {
          hours = 0;
        }
      }
      
      return hours * 60 + minutes;
    } catch {
      return null;
    }
  };

  const formatTime = (timeStr: string | null | undefined): string => {
    if (!timeStr) return "—";
    return timeStr;
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getEmployeeName = (employee: Employee): string => {
    // Use EIS_EMPLOYEE_NAME from eis_personal_information table
    if (employee.EIS_EMPLOYEE_NAME) {
      return employee.EIS_EMPLOYEE_NAME.trim();
    }
    // Fallback to ADMIN names if available
    if (employee.ADMIN_FIRST_NAME || employee.ADMIN_LAST_NAME) {
      return `${employee.ADMIN_FIRST_NAME || ""} ${employee.ADMIN_LAST_NAME || ""}`.trim();
    }
    // Last resort: use GR_EMPLOYER_LOGIN or PIN
    return employee.GR_EMPLOYER_LOGIN?.split("-")[0] || `PIN ${employee.pinNumber}`;
  };

  const getEmployeeKey = (employee: Employee, fallback: number) =>
    employee.empid ?? employee.ADMIN_ID ?? employee.pinNumber ?? fallback;

  const groupedHistory = useMemo(() => {
    if (!selectedEmployeeHistory.length) return [];
    const groupedByDate = new Map<
      string,
      { checkIn: AttendanceLog | null; checkOut: AttendanceLog | null }
    >();

    selectedEmployeeHistory.forEach((log) => {
      const dateStr = new Date(log.AttendanceDate).toISOString().split("T")[0];
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

    return Array.from(groupedByDate.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedEmployeeHistory]);

  const historyStats = useMemo(() => {
    if (!groupedHistory.length) {
      return { total: 0, onTime: 0, late: 0, early: 0, violations: 0 };
    }

    return groupedHistory.reduce(
      (acc, day) => {
        acc.total += 1;
        let dayIsViolation = false;
        if (day.checkIn) {
          if (checkIfLate(day.checkIn.AttendanceTime)) {
            acc.late += 1;
            dayIsViolation = true;
          } else {
            acc.onTime += 1;
          }
        }
        if (day.checkOut && checkIfLeftEarly(day.checkOut.AttendanceTime)) {
          acc.early += 1;
          dayIsViolation = true;
        }
        if (dayIsViolation) {
          acc.violations += 1;
        }
        return acc;
      },
      { total: 0, onTime: 0, late: 0, early: 0, violations: 0 }
    );
  }, [groupedHistory]);

  const historyStatCards = useMemo(
    () => [
      {
        label: "Total",
        value: historyStats.total,
        icon: Calendar,
        bg: "#d5e49eff",
        iconColor: "#000",
      },
      {
        label: "On Time",
        value: historyStats.onTime,
        icon: Clock,
        bg: "#96eba2ff",
        iconColor: "#000",
      },
      {
        label: "Late",
        value: historyStats.late,
        icon: CalendarX,
        bg: "#fecaca",
        iconColor: "#000",
      },
      {
        label: "Left Early",
        value: historyStats.early,
        icon: LogOut,
        bg: "#fef3c7",
        iconColor: "#000",
      },
      {
        label: "Violations",
        value: historyStats.violations,
        icon: UserX,
        bg: "#fee2e2",
        iconColor: "#b91c1c",
      },
    ],
    [historyStats]
  );

  // Filter employees based on avatar selection
  const filteredAttendance = useMemo(() => {
    if (selectedEmployee === null) return teamAttendance;
    return teamAttendance.filter(
      (item, idx) => getEmployeeKey(item.employee, idx) === selectedEmployee
    );
  }, [teamAttendance, selectedEmployee]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = teamAttendance.length;
    const present = teamAttendance.filter((item) => item.isPresent).length;
    const absent = total - present;
    const late = teamAttendance.filter((item) => item.isLate).length;
    const earlyLeave = teamAttendance.filter((item) => item.leftEarly).length;
    
    return { total, present, absent, late, earlyLeave };
  }, [teamAttendance]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {onBack ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color={palette.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Team's Attendance</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Team's Attendance</Text>
        </View>
      )}

      {/* Avatar Slider */}
      <View style={styles.avatarSliderContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.avatarSliderContent}
        >
          <TouchableOpacity
            style={[
              styles.avatarItem,
              selectedEmployee === null && styles.avatarItemSelected,
            ]}
            onPress={() => {
              setSelectedEmployee(null);
              setSelectedEmployeeHistory([]);
            }}
          >
              <View style={[
                styles.avatarWrapper,
                selectedEmployee === null && styles.avatarWrapperSelected,
              ]}>
                <View style={[
                  styles.avatarCircle,
                  { 
                    backgroundColor: selectedEmployee === null ? palette.accent : palette.surface,
                    borderWidth: selectedEmployee === null ? 3 : 2,
                    borderColor: selectedEmployee === null ? palette.accent : palette.border,
                  }
                ]}>
                  <User size={20} color={selectedEmployee === null ? "#fff" : palette.textMuted} />
                </View>
              </View>
            <Text
              style={[
                styles.avatarName,
                selectedEmployee === null && styles.avatarNameSelected,
              ]}
              numberOfLines={1}
            >
              All
            </Text>
          </TouchableOpacity>
          
          {employees.map((employee, index) => {
            const uniqueId = getEmployeeKey(employee, index);
            const attendance = teamAttendance.find(
              (item) => item.employee.empid === employee.empid
            );
            const isSelected = selectedEmployee === uniqueId;
            const isPresent = attendance?.isPresent || false;
            
            return (
              <TouchableOpacity
                key={uniqueId}
                style={[
                  styles.avatarItem,
                  isSelected && styles.avatarItemSelected,
                ]}
                onPress={async () => {
                  setSelectedEmployee(uniqueId);
                  
                  // Fetch attendance history for selected employee
                  if (employee.pinNumber) {
                    setLoadingHistory(true);
                    try {
                      const res = await axios.get(
                        `${API_BASE}/attendance/${employee.pinNumber}?branch=${encodeURIComponent(branch)}&limit=100`
                      );
                      setSelectedEmployeeHistory(res.data || []);
                    } catch (err) {
                      console.error("Error fetching attendance history:", err);
                      setSelectedEmployeeHistory([]);
                    } finally {
                      setLoadingHistory(false);
                    }
                  } else {
                    setSelectedEmployeeHistory([]);
                  }
                }}
              >
                <View style={[
                  styles.avatarWrapper,
                  isSelected && styles.avatarWrapperSelected,
                  isPresent && !isSelected && styles.avatarWrapperPresent,
                ]}>
                  <SimpleAvatar
                    size={40}
                    fallback={getEmployeeName(employee).substring(0, 2).toUpperCase()}
                  />
                  {isPresent && (
                    <View style={[styles.presentBadge, { backgroundColor: palette.success }]}>
                      <CheckCircle size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.avatarName,
                    isSelected && styles.avatarNameSelected,
                  ]}
                  numberOfLines={2}
                >
                  {getEmployeeName(employee)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[palette.accent, palette.accentSecondary]}
            tintColor={palette.accent}
          />
        }
      >
        {loading && teamAttendance.length === 0 ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={palette.accent} />
            <Text style={styles.loaderText}>Loading team attendance...</Text>
          </View>
        ) : filteredAttendance.length === 0 ? (
          <View style={styles.emptyState}>
            <UserX size={40} color={palette.textSubtle} />
            <Text style={styles.emptyTitle}>No attendance data</Text>
            <Text style={styles.emptySubtitle}>
              No attendance records found for the selected date.
            </Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {filteredAttendance.map((item, index) => (
              <View key={`${item.employee.ADMIN_ID}-${index}`} style={styles.attendanceCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.employeeInfo}>
                    <View style={[styles.avatar, { backgroundColor: item.isPresent ? palette.successBg : palette.dangerBg }]}>
                      {item.isPresent ? (
                        <UserCheck size={20} color={item.isPresent ? palette.success : palette.danger} />
                      ) : (
                        <UserX size={20} color={palette.danger} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.employeeName}>{getEmployeeName(item.employee)}</Text>
                      <View style={styles.pinRow}>
                        <Text style={styles.pinText}>PIN: {item.employee.pinNumber}</Text>
                        {item.isLate && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>Late</Text>
                          </View>
                        )}
                        {item.leftEarly && (
                          <View style={[styles.badge, { backgroundColor: palette.warnBg }]}>
                            <Text style={[styles.badgeText, { color: palette.warn }]}>Early Leave</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusChip,
                      item.isPresent ? styles.presentChip : styles.absentChip,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        item.isPresent ? styles.presentChipText : styles.absentChipText,
                      ]}
                    >
                      {item.isPresent ? "Present" : "Absent"}
                    </Text>
                  </View>
                </View>

                {item.isPresent && item.attendance && (
                  <View style={styles.timeRow}>
                    <View style={styles.timeItem}>
                      <Clock size={16} color={palette.accent} />
                      <View style={{ marginLeft: 8 }}>
                        <Text style={styles.timeLabel}>Check In</Text>
                        <Text style={[styles.timeValue, item.isLate && { color: palette.warn }]}>
                          {formatTime(item.attendance.timeIn || item.attendance.AttendanceTime)}
                        </Text>
                      </View>
                    </View>
                    {item.attendance.timeOut && (
                      <View style={styles.timeItem}>
                        <Clock size={16} color={palette.accentSecondary} />
                        <View style={{ marginLeft: 8 }}>
                          <Text style={styles.timeLabel}>Check Out</Text>
                          <Text style={[styles.timeValue, item.leftEarly && { color: palette.warn }]}>
                            {formatTime(item.attendance.timeOut)}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
            
            {/* Attendance History for Selected Employee */}
            {selectedEmployee !== null && (
              <>
                {loadingHistory ? (
                  <View style={styles.historyLoader}>
                    <ActivityIndicator size="small" color={palette.accent} />
                    <Text style={styles.historyLoaderText}>Loading history...</Text>
                  </View>
                ) : groupedHistory.length > 0 ? (
                  <>
                    <View style={styles.statsContainer}>
                      <View style={styles.statsRow}>
                        {historyStatCards.map((stat) => {
                          const IconComponent = stat.icon;
                          return (
                            <TouchableOpacity key={stat.label} style={styles.statCard} activeOpacity={0.7}>
                              <View style={[styles.iconWrapper, { backgroundColor: stat.bg }]}>
                                <IconComponent size={14} color={stat.iconColor} />
                              </View>
                              <Text style={styles.statLabel}>{stat.label}</Text>
                              <Text style={styles.statValue}>{stat.value}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View style={styles.historyContainer}>
                      <Text style={styles.historyTitle}>Attendance History</Text>
                      {groupedHistory.map((day) => {
                        const wasLate = day.checkIn ? checkIfLate(day.checkIn.AttendanceTime) : false;
                        const didLeaveEarly = day.checkOut ? checkIfLeftEarly(day.checkOut.AttendanceTime) : false;

                        return (
                          <View key={day.date} style={styles.historyCard}>
                            <View style={styles.historyCardHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.historyDate}>{formatDate(day.date)}</Text>
                                <Text style={styles.historyDayOfWeek}>
                                  {new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}
                                </Text>
                              </View>

                        <View style={styles.historyBadgeContainer}>
                          <View
                            style={[
                              styles.historyStatusChip,
                              wasLate || didLeaveEarly
                                ? styles.historyStatusChipViolation
                                : styles.historyStatusChipVerified,
                            ]}
                          >
                            <Text style={styles.historyStatusChipText}>
                              {wasLate || didLeaveEarly ? "Violation" : "Verified"}
                            </Text>
                          </View>
                                {wasLate && (
                                  <View style={styles.historyBadgeLate}>
                                    <Text style={styles.historyBadgeText}>Late</Text>
                                  </View>
                                )}
                                {didLeaveEarly && (
                                  <View style={styles.historyBadgeEarly}>
                                    <Text style={styles.historyBadgeText}>Early</Text>
                                  </View>
                                )}
                              </View>
                            </View>

                            <View style={styles.historyTimeRow}>
                              {day.checkIn && (
                                <View style={styles.historyTimeItem}>
                                  <View style={[styles.historyIconWrapper, { backgroundColor: "#00A65220" }]}>
                                    <UserCheck size={14} color={palette.accent} />
                                  </View>
                                  <View>
                                    <Text style={styles.historyTimeLabel}>IN</Text>
                                    <Text style={styles.historyTime}>{day.checkIn.AttendanceTime}</Text>
                                  </View>
                                </View>
                              )}

                              {day.checkOut && (
                                <View style={styles.historyTimeItem}>
                                  <View style={[styles.historyIconWrapper, { backgroundColor: "#28a74520" }]}>
                                    <LogOut size={14} color="#28a745" />
                                  </View>
                                  <View>
                                    <Text style={styles.historyTimeLabel}>OUT</Text>
                                    <Text style={styles.historyTime}>{day.checkOut.AttendanceTime}</Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <View style={styles.historyContainer}>
                    <Text style={styles.historyTitle}>Attendance History</Text>
                    <Text style={styles.historyEmptyText}>No attendance history found.</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: AttendancePalette) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: palette.background,
    },
    restrictedContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      backgroundColor: palette.background,
    },
    restrictedTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: palette.textPrimary,
      marginBottom: 8,
      textAlign: "center",
    },
    restrictedSubtitle: {
      fontSize: 14,
      color: palette.textMuted,
      textAlign: "center",
      marginBottom: 24,
      lineHeight: 20,
    },
    restrictedButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: palette.accent,
    },
    restrictedButtonText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 14,
    },
    scrollArea: {
      flex: 1,
      backgroundColor: palette.background,
    },
    scrollContent: {
      paddingBottom: 32,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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
    avatarSliderContainer: {
      marginTop: 12,
      marginBottom: 8,
    },
    avatarSliderContent: {
      paddingHorizontal: 16,
      gap: 12,
    },
    avatarItem: {
      alignItems: "center",
      marginRight: 12,
      minWidth: 60,
      maxWidth: 80,
    },
    avatarItemSelected: {
      opacity: 1,
    },
    avatarWrapper: {
      position: "relative",
      marginBottom: 6,
    },
    avatarWrapperSelected: {},
    avatarWrapperPresent: {
      opacity: 1,
    },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: "center",
      alignItems: "center",
      overflow: "hidden",
    },
    presentBadge: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 18,
      height: 18,
      borderRadius: 9,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 2,
      borderColor: palette.card,
    },
    avatarName: {
      fontSize: 10,
      fontWeight: "500",
      color: palette.textMuted,
      textAlign: "center",
      maxWidth: 80,
      marginTop: 2,
    },
    avatarNameSelected: {
      color: palette.accent,
      fontWeight: "700",
    },
    loader: {
      marginTop: 40,
      alignItems: "center",
    },
    loaderText: {
      color: palette.textMuted,
      marginTop: 12,
    },
    emptyState: {
      marginTop: 60,
      alignItems: "center",
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: palette.textPrimary,
      marginTop: 16,
    },
    emptySubtitle: {
      color: palette.textMuted,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 20,
    },
    listContainer: {
      paddingHorizontal: 16,
      marginTop: 6,
    },
    attendanceCard: {
      backgroundColor: palette.card,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 6,
      borderLeftWidth: 3,
      borderLeftColor: palette.accent,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    employeeInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    employeeName: {
      fontSize: 16,
      fontWeight: "700",
      color: palette.textPrimary,
    },
    pinRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    pinText: {
      fontSize: 12,
      color: palette.textMuted,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: "600",
    },
    presentChip: {
      backgroundColor: palette.successBg,
      borderColor: palette.successBg,
    },
    absentChip: {
      backgroundColor: palette.dangerBg,
      borderColor: palette.dangerBg,
    },
    presentChipText: {
      color: palette.success,
    },
    absentChipText: {
      color: palette.danger,
    },
    badge: {
      backgroundColor: palette.warnBg,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 999,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: "600",
      color: palette.warn,
    },
    statusIndicator: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    timeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    timeItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 8,
      backgroundColor: palette.surface,
      borderRadius: 8,
    },
    timeLabel: {
      fontSize: 10,
      textTransform: "uppercase",
      color: palette.textSubtle,
      letterSpacing: 0.5,
    },
    timeValue: {
      fontSize: 13,
      fontWeight: "600",
      color: palette.textPrimary,
      marginTop: 2,
    },
    statsContainer: {
      paddingHorizontal: 16,
      marginBottom: 12,
      marginTop: 16,
    },
    statsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 4,
      flexWrap: "nowrap",
    },
    statCard: {
      backgroundColor: palette.card,
      width: "18%",
      minWidth: 64,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 4,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
      borderWidth: 2,
      borderColor: "transparent",
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
    statValue: { 
      fontSize: 13, 
      fontWeight: "700", 
      marginTop: 1, 
      color: palette.textPrimary 
    },
    historyContainer: {
      paddingHorizontal: 16,
    },
    historyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: palette.textPrimary,
      marginBottom: 12,
    },
    historyCard: {
      backgroundColor: palette.card,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      borderLeftWidth: 3,
      borderLeftColor: palette.accent,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    historyCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    historyDate: {
      fontSize: 14,
      fontWeight: "600",
      color: palette.textPrimary,
    },
    historyDayOfWeek: {
      fontSize: 12,
      color: palette.textMuted,
      marginTop: 2,
    },
    historyBadgeContainer: {
      flexDirection: "row",
      gap: 6,
    },
    historyStatusChip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    historyStatusChipText: {
      fontSize: 10,
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: 0.3,
      color: "#fff",
    },
    historyStatusChipViolation: {
      backgroundColor: "#ef4444",
    },
    historyStatusChipVerified: {
      backgroundColor: "#10b981",
    },
    historyBadgeLate: {
      backgroundColor: palette.warnBg,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    historyBadgeEarly: {
      backgroundColor: palette.surface,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    historyBadgeText: {
      fontSize: 10,
      fontWeight: "600",
      color: palette.warn,
    },
    historyTimeRow: {
      flexDirection: "row",
      gap: 12,
    },
    historyTimeItem: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    historyIconWrapper: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    historyTimeLabel: {
      fontSize: 10,
      textTransform: "uppercase",
      color: palette.textSubtle,
      letterSpacing: 0.5,
    },
    historyTime: {
      fontSize: 13,
      fontWeight: "600",
      color: palette.textPrimary,
      marginTop: 2,
    },
    historyLoader: {
      padding: 20,
      alignItems: "center",
    },
    historyLoaderText: {
      color: palette.textMuted,
      marginTop: 8,
      fontSize: 12,
    },
    historyEmptyText: {
      fontSize: 13,
      color: palette.textMuted,
      marginTop: 8,
      textAlign: "center",
    },
  });

type AttendancePalette = ReturnType<typeof buildAttendancePalette>;

const buildAttendancePalette = (isDarkMode: boolean) => ({
  background: isDarkMode ? "#000000" : "#f3f4f6",
  card: isDarkMode ? "#0d0d0d" : "#fff",
  surface: isDarkMode ? "#080808" : "#f9fafb",
  border: isDarkMode ? "#1a1a1a" : "#e5e7eb",
  textPrimary: isDarkMode ? "#f8fafc" : "#1f2937",
  textMuted: isDarkMode ? "#a1a1aa" : "#6b7280",
  textSubtle: isDarkMode ? "#94a3b8" : "#9ca3af",
  accent: "#9333ea",
  accentSecondary: "#3b82f6",
  success: "#10b981",
  successBg: isDarkMode ? "rgba(16, 185, 129, 0.15)" : "#d1fae5",
  danger: "#ef4444",
  dangerBg: isDarkMode ? "rgba(239, 68, 68, 0.15)" : "#fee2e2",
  warn: "#f59e0b",
  warnBg: isDarkMode ? "rgba(245, 158, 11, 0.15)" : "#fef3c7",
  iconBackground: isDarkMode ? "rgba(34,197,94,0.12)" : "#f0fdf4",
  statActiveBg: isDarkMode ? "rgba(34,197,94,0.15)" : "#f0fdf4",
});

