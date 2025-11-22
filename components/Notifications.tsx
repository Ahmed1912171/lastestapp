import axios from "axios";
import { Bell } from "lucide-react-native";
import React from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSession } from "../ctx";
import { useTheme } from "../ctx/theme";

type Notification = {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  leaveId?: number;
};

type PendingLeave = {
  id: number;
  pinNumber: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  employeeName?: string;
  employeeCode?: string;
  ADMIN_FIRST_NAME?: string;
  ADMIN_LAST_NAME?: string;
  requestDate: string;
};

type NotificationsProps = {
  visible: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
};

export default function Notifications({ visible, onClose, onCountChange }: NotificationsProps) {
  const { session } = useSession();
  const { isDarkMode, palette } = useTheme();
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(false);
  const styles = React.useMemo(() => createStyles(palette, isDarkMode), [palette, isDarkMode]);

  const LOCAL_IP = "192.168.100.103";
  const API_BASE =
    Platform.OS === "android" ? "http://10.0.2.2:3000" : `http://${LOCAL_IP}:3000`;

  const branch = session?.user?.branch || "korangi";
  const approverManagerStatus = (session?.user as any)?.manager_status || 0;
  
  // Extract pinNumber with proper validation
  let pinNumber: string | undefined = undefined;
  if (session?.user?.pinNumber) {
    pinNumber = String(session.user.pinNumber);
    console.log("📌 Using pinNumber from session:", pinNumber);
  } else if (session?.user?.GR_EMPLOYER_LOGIN?.includes("-")) {
    const parts = session.user.GR_EMPLOYER_LOGIN.split("-");
    if (parts.length > 1 && parts[1]) {
      pinNumber = parts[1];
      console.log("📌 Extracted pinNumber from GR_EMPLOYER_LOGIN:", pinNumber);
    }
  } else if (session?.user?.ADMIN_ID) {
    pinNumber = String(session.user.ADMIN_ID);
    console.log("📌 Using ADMIN_ID as pinNumber:", pinNumber);
  }
  
  // Validate pinNumber is a valid number
  if (pinNumber && (isNaN(Number(pinNumber)) || Number(pinNumber) <= 0)) {
    console.log("❌ Invalid pinNumber after validation:", pinNumber, "Number value:", Number(pinNumber));
    pinNumber = undefined;
  }
  
  console.log("📌 Final pinNumber for attendance check:", pinNumber, "Session user:", {
    pinNumber: session?.user?.pinNumber,
    GR_EMPLOYER_LOGIN: session?.user?.GR_EMPLOYER_LOGIN,
    ADMIN_ID: session?.user?.ADMIN_ID,
  });

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Fetch attendance status
  const fetchAttendanceStatus = React.useCallback(async () => {
    if (!pinNumber || pinNumber === "undefined" || pinNumber === "null") {
      console.log("⚠️ No pinNumber available for attendance check");
      return null;
    }

    // Validate pinNumber is a valid number before making the request
    const pinNumberNum = Number(pinNumber);
    if (isNaN(pinNumberNum) || pinNumberNum <= 0) {
      console.log("⚠️ Invalid pinNumber:", pinNumber);
      return null;
    }

    try {
      const res = await axios.get(
        `${API_BASE}/attendance/check-today?branch=${encodeURIComponent(branch)}&pinNumber=${encodeURIComponent(pinNumber)}`
      );
      console.log("✅ Attendance status check:", res.data);
      return res.data;
    } catch (err: any) {
      // Silently handle 400 errors (invalid pinNumber) - don't log as error
      if (err?.response?.status === 400) {
        console.log("⚠️ Attendance check returned 400 (invalid pinNumber)");
        return null;
      }
      // Only log unexpected errors
      console.error("Error checking attendance status:", err);
      return null;
    }
  }, [API_BASE, branch, pinNumber]);

  // Fetch leave requests and convert to notifications
  const fetchLeaveRequests = React.useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch both leave requests and attendance status in parallel
      const [leavesRes, attendanceStatus] = await Promise.all([
        axios.get(
          `${API_BASE}/leaves/pending/all?branch=${encodeURIComponent(branch)}&approverManagerStatus=${approverManagerStatus}`
        ),
        fetchAttendanceStatus(),
      ]);

      const pendingLeaves: PendingLeave[] = leavesRes.data || [];
      const notifications: Notification[] = [];

      // Add attendance notification if needed
      console.log("🔍 Attendance status response:", attendanceStatus);
      console.log("🔍 Attendance status details:", {
        status: attendanceStatus,
        isNull: attendanceStatus === null,
        isUndefined: attendanceStatus === undefined,
        needsNotification: attendanceStatus?.needsNotification,
        needsNotificationType: typeof attendanceStatus?.needsNotification,
        hasAttendance: attendanceStatus?.hasAttendance,
        hasCheckIn: attendanceStatus?.hasCheckIn,
        hasCheckOut: attendanceStatus?.hasCheckOut,
        isAfterCutoff: attendanceStatus?.isAfterCutoff,
        currentTime: attendanceStatus?.currentTime,
      });
      
      // Check if needsNotification is true (handle both boolean true and truthy values)
      const shouldShowNotification = attendanceStatus && attendanceStatus.needsNotification === true;
      
      console.log("🔍 Should show notification?", {
        shouldShowNotification,
        condition: attendanceStatus && attendanceStatus.needsNotification === true,
        needsNotificationValue: attendanceStatus?.needsNotification,
        needsNotificationStrict: attendanceStatus?.needsNotification === true,
      });
      
      if (shouldShowNotification) {
        console.log("✅ Adding attendance reminder notification");
        notifications.push({
          id: "attendance-reminder",
          title: "Attendance Reminder",
          message: "You haven't marked your attendance today. Please check in now.",
          time: "Just now",
          read: false,
        });
      } else {
        console.log("ℹ️ No attendance notification needed:", {
          hasAttendance: attendanceStatus?.hasAttendance,
          hasCheckIn: attendanceStatus?.hasCheckIn,
          hasCheckOut: attendanceStatus?.hasCheckOut,
          isAfterCutoff: attendanceStatus?.isAfterCutoff,
          needsNotification: attendanceStatus?.needsNotification,
          reason: attendanceStatus === null 
            ? "No attendance status received (API returned null)"
            : attendanceStatus?.needsNotification === false 
            ? (attendanceStatus?.hasCheckIn ? "Check-in already marked" : "Not after 9:15 AM yet")
            : `needsNotification is ${attendanceStatus?.needsNotification} (type: ${typeof attendanceStatus?.needsNotification})`
        });
      }

      // Add checkout reminder if needed
      const shouldShowCheckoutReminder =
        attendanceStatus && attendanceStatus.needsCheckoutReminder === true;

      if (shouldShowCheckoutReminder) {
        console.log("✅ Adding checkout reminder notification");
        notifications.push({
          id: "checkout-reminder",
          title: "Checkout Reminder",
          message: "It's after 5:00 PM and you haven't checked out yet. Please mark your Time Out.",
          time: "Just now",
          read: false,
        });
      } else {
        console.log("ℹ️ No checkout notification needed:", {
          hasCheckIn: attendanceStatus?.hasCheckIn,
          hasCheckOut: attendanceStatus?.hasCheckOut,
          isAfterCheckoutCutoff: attendanceStatus?.isAfterCheckoutCutoff,
          needsCheckoutReminder: attendanceStatus?.needsCheckoutReminder,
        });
      }

      // Convert leave requests to notifications
      const leaveNotifications: Notification[] = pendingLeaves.map((leave) => {
        const requestDate = new Date(leave.requestDate);
        const now = new Date();
        const diffMs = now.getTime() - requestDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        let timeAgo = "";
        if (diffDays > 0) {
          timeAgo = `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
        } else if (diffHours > 0) {
          timeAgo = `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        } else {
          const diffMins = Math.floor(diffMs / (1000 * 60));
          timeAgo = diffMins > 0 ? `${diffMins} minute${diffMins > 1 ? "s" : ""} ago` : "Just now";
        }

        // Get employee name - prefer concatenated name, then individual names, then code, then PIN
        let employeeName = leave.employeeName?.trim();
        if (!employeeName || employeeName === "") {
          const firstName = leave.ADMIN_FIRST_NAME || "";
          const lastName = leave.ADMIN_LAST_NAME || "";
          employeeName = `${firstName} ${lastName}`.trim();
        }
        if (!employeeName || employeeName === "") {
          employeeName = leave.employeeCode || `PIN ${leave.pinNumber}`;
        }

        const dateRange = `${formatDate(leave.startDate)} - ${formatDate(leave.endDate)}`;

        return {
          id: `leave-${leave.id}`,
          title: "New Leave Request",
          message: `${employeeName} requested ${leave.leaveType} for ${leave.daysRequested} day${leave.daysRequested > 1 ? "s" : ""} (${dateRange})`,
          time: timeAgo,
          read: false,
          leaveId: leave.id,
        };
      });

      // Combine attendance and leave notifications
      const allNotifications = [...notifications, ...leaveNotifications];
      setNotifications(allNotifications);
      // Notify parent component of the count
      if (onCountChange) {
        onCountChange(allNotifications.length);
      }
    } catch (err) {
      console.error("Error fetching leave requests:", err);
      setNotifications([]);
      if (onCountChange) {
        onCountChange(0);
      }
    } finally {
      setLoading(false);
    }
  }, [API_BASE, branch, approverManagerStatus, onCountChange, fetchAttendanceStatus]);

  // Fetch count on mount
  React.useEffect(() => {
    fetchLeaveRequests();
  }, [fetchLeaveRequests]);

  // Refresh when modal opens
  React.useEffect(() => {
    if (visible) {
      fetchLeaveRequests();
    }
  }, [visible, fetchLeaveRequests]);


  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modal}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Bell size={20} color={palette.textPrimary} />
                  <Text style={styles.headerText}>Notifications</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Text style={styles.closeText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Content */}
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={palette.primary ?? "#00A652"} />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              ) : notifications.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Bell size={32} color={palette.textMuted} />
                  <Text style={styles.emptyTitle}>No notifications</Text>
                  <Text style={styles.emptySubtitle}>
                    You're all caught up!
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={notifications}
                  keyExtractor={(item) => item.id}
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.notificationItem,
                        !item.read && styles.unreadItem,
                      ]}
                      onPress={() => markAsRead(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.notificationContent}>
                        <Text style={styles.notificationTitle}>{item.title}</Text>
                        <Text style={styles.notificationMessage}>
                          {item.message}
                        </Text>
                        <Text style={styles.notificationTime}>{item.time}</Text>
                      </View>
                      {!item.read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (palette: ThemePalette, isDarkMode: boolean) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: isDarkMode ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.3)",
    },
    modalContainer: {
      paddingTop: 60,
      paddingHorizontal: 16,
      alignItems: "flex-end",
    },
    modal: {
      backgroundColor: palette.card ?? "#fff",
      borderRadius: 12,
      width: 320,
      maxHeight: 400,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
      borderWidth: 1,
      borderColor: palette.border ?? "#e5e7eb",
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: palette.border ?? "#e5e7eb",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    headerText: {
      fontSize: 20,
      fontWeight: "700",
      color: palette.text ?? "#1a1a1a",
    },
    closeButton: {
      padding: 4,
    },
    closeText: {
      fontSize: 24,
      color: palette.mutedText ?? "#666",
    },
    loadingContainer: {
      justifyContent: "center",
      alignItems: "center",
      padding: 30,
    },
    loadingText: {
      marginTop: 8,
      color: palette.mutedText ?? "#666",
      fontSize: 12,
    },
    emptyContainer: {
      justifyContent: "center",
      alignItems: "center",
      padding: 30,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: palette.text ?? "#1f2937",
      marginTop: 12,
    },
    emptySubtitle: {
      color: palette.mutedText ?? "#6b7280",
      textAlign: "center",
      marginTop: 4,
      fontSize: 12,
    },
    list: {
      maxHeight: 300,
    },
    listContent: {
      padding: 8,
    },
    notificationItem: {
      backgroundColor: palette.surface ?? (isDarkMode ? "#080808" : "#f9fafb"),
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      flexDirection: "row",
      alignItems: "flex-start",
      borderLeftWidth: 3,
      borderLeftColor: palette.border ?? "#e5e7eb",
    },
    unreadItem: {
      backgroundColor: palette.card ?? "#fff",
      borderLeftColor: palette.primary ?? "#00A652",
    },
    notificationContent: {
      flex: 1,
    },
    notificationTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: palette.text ?? "#1f2937",
      marginBottom: 4,
    },
    notificationMessage: {
      fontSize: 12,
      color: palette.mutedText ?? "#4b5563",
      marginBottom: 6,
      lineHeight: 16,
    },
    notificationTime: {
      fontSize: 11,
      color: palette.textSubtle ?? "#9ca3af",
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: palette.primary ?? "#00A652",
      marginLeft: 8,
      marginTop: 4,
    },
  });

