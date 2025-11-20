import axios from "axios";
import {
    ArrowLeft,
    Calendar as CalendarIcon,
    CheckCircle,
    ClipboardList,
    Clock,
    FileText,
    User,
    XCircle,
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

type PendingLeave = {
  id: number;
  pinNumber: number;
  leaveTypeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string;
  status: string;
  requestDate: string;
  employeeName?: string;
  requesterManagerStatus?: number;
};

type LeavesApprovalProps = {
  onBack?: () => void;
};

export default function LeavesApproval({ onBack }: LeavesApprovalProps) {
  const { session } = useSession();
  const [requests, setRequests] = useState<PendingLeave[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const LOCAL_IP = "192.168.101.25";
  const API_BASE =
    Platform.OS === "android" ? "http://10.0.2.2:3000" : `http://${LOCAL_IP}:3000`;

  const branch = session?.user?.branch || "korangi";
  const approverName =
    (session?.user as any)?.ADMIN_FIRST_NAME ||
    session?.user?.GR_EMPLOYER_LOGIN?.split("-")[0] ||
    "Manager";
  const approverManagerStatus = (session?.user as any)?.manager_status || 0;

  const fetchPendingLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE}/leaves/pending/all?branch=${encodeURIComponent(branch)}&approverManagerStatus=${approverManagerStatus}`
      );
      setRequests(res.data || []);
    } catch (err) {
      console.error("Error fetching pending leaves:", err);
      Alert.alert("Error", "Failed to load pending leaves. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [API_BASE, branch, approverManagerStatus]);

  useEffect(() => {
    fetchPendingLeaves();
  }, [fetchPendingLeaves]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPendingLeaves();
    setRefreshing(false);
  }, [fetchPendingLeaves]);

  const stats = useMemo(() => {
    const total = requests.length;
    const uniqueEmployees = new Set(requests.map((r) => r.pinNumber)).size;
    return { total, uniqueEmployees };
  }, [requests]);

  const removeRequestById = (id: number) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleApprove = async (request: PendingLeave) => {
    // ✅ Authorization checks based on approver's manager_status
    if (approverManagerStatus === 1) {
      // Manager (status = 1) cannot approve other managers
      if (request.requesterManagerStatus === 1) {
        Alert.alert(
          "Cannot Approve",
          "Managers cannot approve other manager's leave requests. Only non-managers can be approved by managers."
        );
        return;
      }
    } else if (approverManagerStatus === 2) {
      // Senior Manager (status = 2) can only approve managers with status = 1
      if (request.requesterManagerStatus !== 1) {
        Alert.alert(
          "Cannot Approve",
          "Senior managers can only approve leave requests from managers (manager_status = 1)."
        );
        return;
      }
    }

    try {
      setActionId(request.id);
      await axios.put(`${API_BASE}/leaves/${request.id}/approve`, {
        approvedBy: approverName,
        branch,
        approverManagerStatus,
      });
      removeRequestById(request.id);
      Alert.alert("Approved", "Leave request approved successfully.");
    } catch (err: any) {
      console.error("Error approving leave:", err);
      const errorMessage = err?.response?.data?.error || "Failed to approve leave request.";
      Alert.alert("Error", errorMessage);
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (request: PendingLeave) => {
    try {
      setActionId(request.id);
      await axios.put(`${API_BASE}/leaves/${request.id}/reject`, {
        rejectionReason: "Rejected by approver",
        rejectedBy: approverName,
        branch,
      });
      removeRequestById(request.id);
      Alert.alert("Rejected", "Leave request rejected.");
    } catch (err) {
      console.error("Error rejecting leave:", err);
      Alert.alert("Error", "Failed to reject leave request.");
    } finally {
      setActionId(null);
    }
  };

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {onBack ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaves Approval</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Leaves Approval</Text>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#00A652", "#3b82f6"]}
            tintColor="#00A652"
          />
        }
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>{stats.total}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Employees</Text>
            <Text style={styles.statValue}>{stats.uniqueEmployees}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#00A652" />
            <Text style={{ color: "#666", marginTop: 12 }}>Loading pending leaves...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyState}>
            <ClipboardList size={40} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No pending approvals</Text>
            <Text style={styles.emptySubtitle}>
              You're all caught up! New leave requests will appear here.
            </Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            {requests.map((request) => (
              <View key={request.id} style={styles.leaveCard}>
                <View style={styles.leaveCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaveTypeText}>{request.leaveType || "Leave Type"}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <User size={14} color="#6b7280" />
                      <Text style={styles.employeeText}>
                        {request.employeeName || `PIN ${request.pinNumber}`}
                      </Text>
                      {request.requesterManagerStatus === 1 && (
                        <View style={styles.managerBadge}>
                          <Text style={styles.managerBadgeText}>Manager</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{request.status}</Text>
                  </View>
                </View>

                <View style={styles.dateRow}>
                  <View style={styles.dateItem}>
                    <CalendarIcon size={16} color="#00A652" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.dateLabel}>Start</Text>
                      <Text style={styles.dateValue}>{formatDate(request.startDate)}</Text>
                    </View>
                  </View>
                  <View style={styles.dateItem}>
                    <CalendarIcon size={16} color="#3b82f6" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.dateLabel}>End</Text>
                      <Text style={styles.dateValue}>{formatDate(request.endDate)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaItem}>
                    <Clock size={16} color="#f59e0b" />
                    <Text style={styles.metaValue}>{request.daysRequested} days</Text>
                  </View>
                  <View style={styles.metaItem}>
                    <FileText size={16} color="#6b7280" />
                    <Text style={styles.metaValue}>
                      Requested {formatDate(request.requestDate)}
                    </Text>
                  </View>
                </View>

                {request.reason ? (
                  <View style={styles.reasonBox}>
                    <Text style={styles.reasonLabel}>Reason</Text>
                    <Text style={styles.reasonText}>{request.reason}</Text>
                  </View>
                ) : null}

                {/* ✅ Show buttons based on approver's manager_status */}
                {approverManagerStatus === 1 && request.requesterManagerStatus === 1 ? (
                  // Manager (status = 1) cannot approve other managers
                  <View style={styles.restrictedMessage}>
                    <Text style={styles.restrictedText}>
                      ⚠️ Managers cannot approve this request
                    </Text>
                  </View>
                ) : approverManagerStatus === 2 && request.requesterManagerStatus !== 1 ? (
                  // Senior Manager (status = 2) can only approve managers with status = 1
                  <View style={styles.restrictedMessage}>
                    <Text style={styles.restrictedText}>
                      ⚠️ Senior managers can only approve requests from managers
                    </Text>
                  </View>
                ) : (
                  // Show approve/reject buttons for valid combinations
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => handleReject(request)}
                      disabled={actionId === request.id}
                    >
                      {actionId === request.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <XCircle size={18} color="#fff" />
                          <Text style={styles.actionText}>Reject</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => handleApprove(request)}
                      disabled={actionId === request.id}
                    >
                      {actionId === request.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <CheckCircle size={18} color="#fff" />
                          <Text style={styles.actionText}>Approve</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f4f6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#6b7280",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
    color: "#111",
  },
  loader: {
    marginTop: 40,
    alignItems: "center",
  },
  emptyState: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginTop: 16,
  },
  emptySubtitle: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  leaveCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#00A652",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  leaveCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  leaveTypeText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1f2937",
  },
  employeeText: {
    marginTop: 2,
    fontSize: 12,
    color: "#4b5563",
  },
  statusBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    color: "#b45309",
    fontWeight: "600",
    fontSize: 11,
  },
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  dateItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 9,
    backgroundColor: "#f9fafb",
    borderRadius: 10,
  },
  dateLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    color: "#9ca3af",
    letterSpacing: 0.5,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#111827",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaValue: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "600",
  },
  reasonBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: "#1f2937",
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rejectButton: {
    backgroundColor: "#ef4444",
  },
  approveButton: {
    backgroundColor: "#10b981",
  },
  actionText: {
    color: "#fff",
    fontWeight: "600",
  },
  managerBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  managerBadgeText: {
    color: "#b45309",
    fontWeight: "600",
    fontSize: 10,
  },
  restrictedMessage: {
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  restrictedText: {
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});