// app/(app)/leaves.tsx
import axios from "axios";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  XCircle
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../ctx";
import SimpleAvatar from "./SimpleAvatar";

// ✅ Conditional import for native platforms only
let CalendarPicker: any = null;
if (Platform.OS !== 'web') {
  try {
    CalendarPicker = require('react-native-calendar-picker').default;
  } catch (error) {
    console.error("❌ Failed to import CalendarPicker:", error);
  }
}

// ✅ Leave type from database
type LeaveType = {
  id: number;
  name: string;
  applicableTo: string;
  monthlyQuota: number;
};

// ✅ Leave balance type
type LeaveBalance = {
  leaveTypeId: number;
  leaveTypeName: string;
  totalAccrued: number;
  monthlyQuota: number;
  applicableTo: string;
};

// ✅ Leave request type
type LeaveRequest = {
  id: number;
  pinNumber: number;
  leaveTypeId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysRequested: number;
  reason: string;
  status: string; // "Pending" | "Approved" | "Rejected" (capitalized in DB)
  requestDate: string;
  approvedBy?: string;
  currentStage?: string;
  daysDeduction?: number;
};

type LeaveStats = {
  totalRequests: number;
  approved: number;
  pending: number;
  rejected: number;
};

type LeavesScreenProps = {
  onBack?: () => void;
};

export default function LeavesScreen({ onBack }: LeavesScreenProps) {
  const { session } = useSession();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [stats, setStats] = useState<LeaveStats>({
    totalRequests: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // ✅ Form state
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // ✅ Calendar picker state
  const [showCalendar, setShowCalendar] = useState(false);



  // ✅ API Configuration
  const LOCAL_IP = "192.168.100.132";
  const API_BASE =
    Platform.OS === "android"
      ? "http://10.0.2.2:3000"
      : `http://${LOCAL_IP}:3000`;

  const pinNumber = session?.user?.pinNumber;
  const userName = session?.user?.GR_EMPLOYER_LOGIN?.split("-")[0] || "User";
  const branch = session?.user?.branch || "korangi";

  // ✅ Fetch leave types from database
  const fetchLeaveTypes = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/leave-types?branch=${branch}`);
      const types: LeaveType[] = res.data || [];
      setLeaveTypes(types);
      
      // Set first leave type as default
      if (types.length > 0 && !selectedLeaveTypeId) {
        setSelectedLeaveTypeId(types[0].id);
      }
    } catch (err) {
      console.error("Error fetching leave types:", err);
    }
  }, [branch, API_BASE, selectedLeaveTypeId]);

  // ✅ Fetch leave balances
  const fetchLeaveBalances = useCallback(async () => {
    if (!pinNumber) return;

    try {
      const res = await axios.get(
        `${API_BASE}/leave-balance/${pinNumber}?branch=${branch}`
      );
      setLeaveBalances(res.data || []);
    } catch (err) {
      console.error("Error fetching leave balances:", err);
    }
  }, [pinNumber, branch, API_BASE]);

  // ✅ Fetch leave requests
  const fetchLeaves = useCallback(async () => {
    if (!pinNumber) return;

    try {
      const res = await axios.get(
        `${API_BASE}/leaves/${pinNumber}?branch=${branch}`
      );
      const leaveData: LeaveRequest[] = res.data || [];
      setLeaves(leaveData);

      // Calculate stats (status is capitalized in DB: "Pending", "Approved", "Rejected")
      const statsData = {
        totalRequests: leaveData.length,
        approved: leaveData.filter((l) => l.status?.toLowerCase() === "approved").length,
        pending: leaveData.filter((l) => l.status?.toLowerCase() === "pending").length,
        rejected: leaveData.filter((l) => l.status?.toLowerCase() === "rejected").length,
      };
      setStats(statsData);
    } catch (err) {
      console.error("Error fetching leaves:", err);
    }
  }, [pinNumber, branch, API_BASE]);

  // ✅ Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      await fetchLeaveTypes();
      if (pinNumber) {
        await Promise.all([fetchLeaves(), fetchLeaveBalances()]);
      }
    };
    
    loadInitialData();
  }, [pinNumber, fetchLeaves, fetchLeaveTypes, fetchLeaveBalances]);

  // ✅ Submit leave request
  const submitLeaveRequest = async () => {
    if (!pinNumber) {
      Alert.alert("⚠️ Error", "PinNumber not found. Please log in again.");
      return;
    }

    if (!selectedLeaveTypeId || !startDate || !endDate || !reason.trim()) {
      Alert.alert("⚠️ Missing Information", "Please select leave type, dates, and enter a reason.");
      return;
    }

    // ✅ Validate date format on web (YYYY-MM-DD)
    if (Platform.OS === 'web') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        Alert.alert("⚠️ Invalid Date Format", "Please use YYYY-MM-DD format (e.g., 2025-11-20)");
        return;
      }
    }

    // ✅ Validate end date >= start date
    if (new Date(endDate) < new Date(startDate)) {
      Alert.alert("⚠️ Invalid Date Range", "End date must be on or after start date.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/leaves/request`, {
        pinNumber,
        branch,
        leaveTypeId: selectedLeaveTypeId,
        startDate,
        endDate,
        reason: reason.trim(),
      });

      if (res.data.success) {
        Alert.alert("✅ Success", `Leave request submitted successfully!\nDays: ${res.data.daysRequested}`);
        
        // Reset form
        if (leaveTypes.length > 0) {
          setSelectedLeaveTypeId(leaveTypes[0].id);
        }
        setStartDate("");
        setEndDate("");
        setReason("");
        setModalVisible(false);
        
        // Refresh data
        await Promise.all([fetchLeaves(), fetchLeaveBalances()]);
      }
    } catch (err: any) {
      console.error("Error submitting leave:", err);
      Alert.alert("❌ Error", err.response?.data?.error || "Failed to submit leave request");
    } finally {
      setSubmitting(false);
    }
  };

  // ✅ Pull to refresh
  const onRefresh = async () => {
    console.log("🔄 Pull-to-refresh triggered");
    setRefreshing(true);
    
    try {
      console.log("📥 Fetching fresh leave data...");
      await Promise.all([fetchLeaves(), fetchLeaveBalances(), fetchLeaveTypes()]);
      console.log("✅ Refresh complete");
    } catch (err) {
      console.error("❌ Refresh failed:", err);
      Alert.alert("Refresh Error", "Failed to refresh data. Please try again.");
    } finally {
      setRefreshing(false);
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

  // ✅ Handle date range selection from calendar picker
  const handleDateRangeSelect = (date: any, type: string) => {
    if (!date) return;
    
    const selectedDate = new Date(date);
    const dateString = selectedDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    if (type === 'START_DATE') {
      setStartDate(dateString);
      console.log("✅ Start date selected:", dateString);
    } else if (type === 'END_DATE') {
      setEndDate(dateString);
      console.log("✅ End date selected:", dateString);
      // Auto-close after selecting end date
      setTimeout(() => {
        setShowCalendar(false);
      }, 300);
    }
  };

  // ✅ Open calendar for date range selection
  const openCalendar = () => {
    setShowCalendar(true);
  };

  // ✅ Calculate days between dates (fallback if daysRequested not available)
  const calculateDays = (start: string, end: string, daysRequested?: number) => {
    if (daysRequested) return daysRequested;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
    return diffDays;
  };

  // ✅ Get status color (handle capitalized status from DB)
  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "approved":
        return "#10b981";
      case "rejected":
        return "#ef4444";
      case "pending":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  // ✅ Get status icon (handle capitalized status from DB)
  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase();
    switch (statusLower) {
      case "approved":
        return <CheckCircle size={20} color="#10b981" />;
      case "rejected":
        return <XCircle size={20} color="#ef4444" />;
      case "pending":
        return <Clock size={20} color="#f59e0b" />;
      default:
        return null;
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

  // ✅ Filter leaves based on selected filter (handle capitalized status)
  const filteredLeaves = selectedFilter === 'all' 
    ? leaves 
    : leaves.filter(l => l.status?.toLowerCase() === selectedFilter);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      {/* Header with conditional back button - matches AttendanceComponent */}
      {onBack ? (
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <ArrowLeft size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leave Requests</Text>
          <View style={{ width: 40 }} />
        </View>
      ) : (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Leave Requests</Text>
            <Text style={styles.subtitle}>Hello, {userName}</Text>
            <Text style={styles.pinText}>PIN: {pinNumber}</Text>
          </View>

          <SimpleAvatar
            fallback={userName.substring(0, 2).toUpperCase()}
            size={48}
          />
        </View>
      )}

      {/* Scrollable Content */}
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
        {/* Request Leave Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 16, marginBottom: 16 }}>
          <TouchableOpacity
            style={styles.requestButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.7}
          >
            <Plus size={24} color="#fff" />
            <Text style={styles.requestButtonText}>Request Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Dashboard */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <TouchableOpacity 
              style={[styles.statCard, selectedFilter === 'all' && styles.statCardActive]}
              onPress={() => setSelectedFilter('all')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#dbeafe" }]}>
                <FileText size={16} color="#000" />
              </View>
              <Text style={styles.statLabel}>Total</Text>
              <Text style={styles.statValue}>{stats.totalRequests}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.statCard, selectedFilter === 'approved' && styles.statCardActive]}
              onPress={() => setSelectedFilter('approved')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#d1fae5" }]}>
                <CheckCircle size={16} color="#000" />
              </View>
              <Text style={styles.statLabel}>Approved</Text>
              <Text style={styles.statValue}>{stats.approved}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.statCard, selectedFilter === 'pending' && styles.statCardActive]}
              onPress={() => setSelectedFilter('pending')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#fef3c7" }]}>
                <Clock size={16} color="#000" />
              </View>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statValue}>{stats.pending}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.statCard, selectedFilter === 'rejected' && styles.statCardActive]}
              onPress={() => setSelectedFilter('rejected')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#fecaca" }]}>
                <XCircle size={16} color="#000" />
              </View>
              <Text style={styles.statLabel}>Rejected</Text>
              <Text style={styles.statValue}>{stats.rejected}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Leave Balances Section */}
        {leaveBalances.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Your Leave Balance</Text>
            <View style={styles.balanceContainer}>
              {leaveBalances.map((balance) => (
                <View key={balance.leaveTypeId} style={styles.balanceCard}>
                  <Text style={styles.balanceType}>{balance.leaveTypeName}</Text>
                  <Text style={styles.balanceAmount}>{balance.totalAccrued.toFixed(2)}</Text>
                  <Text style={styles.balanceQuota}>
                    Quota: {balance.monthlyQuota}/month
                  </Text>
                  <Text style={styles.balancePeriod}>{balance.applicableTo}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Leave History List */}
        <View style={{ paddingHorizontal: 16 }}>
          {filteredLeaves.length === 0 ? (
            <Text style={{ textAlign: "center", color: "#666", marginTop: 40 }}>
              No {selectedFilter === 'all' ? '' : selectedFilter + ' '}leave requests found.
            </Text>
          ) : (
            filteredLeaves.map((leave) => {
              const days = calculateDays(leave.startDate, leave.endDate, leave.daysRequested);
              const statusLower = leave.status?.toLowerCase();
              
              return (
                <View 
                  key={leave.id} 
                  style={[
                    styles.leaveCard,
                    { 
                      borderLeftWidth: 3, 
                      borderLeftColor: getStatusColor(leave.status)
                    }
                  ]}
                >
                  {/* Header: Date & Status Badge */}
                  <View style={styles.leaveCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.compactLeaveType}>{leave.leaveType}</Text>
                      <Text style={styles.compactDayOfWeek}>
                        {formatDate(leave.startDate)}
                      </Text>
                    </View>
                    
                    {/* Status Badge */}
                    <View style={styles.compactBadgeContainer}>
                      <View style={[
                        styles.statusBadgeCompact,
                        { backgroundColor: statusLower === 'approved' ? '#d1fae5' : 
                                          statusLower === 'rejected' ? '#fee2e2' : '#fef3c7' }
                      ]}>
                        <Text style={styles.badgeText}>
                          {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Date Range Row - Start & End Date */}
                  <View style={styles.timeRowCombined}>
                    {/* Start Date */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.compactIconWrapper, { backgroundColor: '#00A65220' }]}>
                        <CalendarIcon size={14} color="#00A652" />
                      </View>
                      <View>
                        <Text style={styles.timeLabel}>FROM</Text>
                        <Text style={styles.compactTime}>
                          {new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>

                    {/* End Date */}
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View style={[styles.compactIconWrapper, { backgroundColor: '#3b82f620' }]}>
                        <CalendarIcon size={14} color="#3b82f6" />
                      </View>
                      <View>
                        <Text style={styles.timeLabel}>TO</Text>
                        <Text style={styles.compactTime}>
                          {new Date(leave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Days & Approver Row */}
                  {(days > 0 || leave.approvedBy) && (
                    <View style={[styles.timeRowCombined, { marginTop: 6 }]}>
                      {/* Total Days */}
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={[styles.compactIconWrapper, { backgroundColor: '#fef3c720' }]}>
                          <Clock size={14} color="#f59e0b" />
                        </View>
                        <View>
                          <Text style={styles.timeLabel}>DAYS</Text>
                          <Text style={styles.compactTime}>{days}</Text>
                        </View>
                      </View>

                      {/* Approved By */}
                      {leave.approvedBy && (
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.compactIconWrapper, { backgroundColor: '#d1fae520' }]}>
                            <CheckCircle size={14} color="#10b981" />
                          </View>
                          <View>
                            <Text style={styles.timeLabel}>BY</Text>
                            <Text style={styles.compactTime}>{leave.approvedBy}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Reason - Compact */}
                  {leave.reason && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.reasonCompact} numberOfLines={2}>
                        <Text style={styles.reasonLabel}>Reason: </Text>
                        {leave.reason}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Request Leave Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback 
            onPress={() => {
              Keyboard.dismiss();
              setModalVisible(false);
            }}
          >
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.modalContent}>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled={true}
                  >
                    <Text style={styles.modalTitle}>Request Leave</Text>

                    {/* Leave Type Picker */}
                    <Text style={styles.inputLabel}>Leave Type</Text>
                    {leaveTypes.length === 0 ? (
                      <ActivityIndicator size="small" color="#00A652" />
                    ) : (
                      <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.leaveTypeScroll}
                        keyboardShouldPersistTaps="handled"
                      >
                        {leaveTypes.map((type) => (
                          <TouchableOpacity
                            key={type.id}
                            style={[
                              styles.leaveTypeChip,
                              selectedLeaveTypeId === type.id && styles.leaveTypeChipActive,
                            ]}
                            onPress={() => setSelectedLeaveTypeId(type.id)}
                          >
                            <Text
                              style={[
                                styles.leaveTypeChipText,
                                selectedLeaveTypeId === type.id && styles.leaveTypeChipTextActive,
                              ]}
                            >
                              {type.name}
                            </Text>
                            <Text style={styles.leaveTypeQuota}>
                              {type.monthlyQuota}/mo
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}

                    {/* Date Range Selector */}
                    <Text style={styles.inputLabel}>Leave Dates</Text>
                    {Platform.OS === 'web' ? (
                      <View>
                        <TextInput
                          style={[styles.input, { marginBottom: 8 }]}
                          placeholder="Start: YYYY-MM-DD (e.g., 2025-11-20)"
                          value={startDate}
                          onChangeText={setStartDate}
                          placeholderTextColor="#999"
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="End: YYYY-MM-DD (e.g., 2025-11-22)"
                          value={endDate}
                          onChangeText={setEndDate}
                          placeholderTextColor="#999"
                        />
                      </View>
                    ) : (
                      <View>
                        <TouchableOpacity
                          style={styles.dateRangeButton}
                          onPress={openCalendar}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <CalendarIcon size={18} color="#00A652" />
                              <Text style={startDate ? styles.datePickerText : styles.datePickerPlaceholder}>
                                {startDate ? formatDate(startDate) : 'Select dates'}
                              </Text>
                            </View>
                            {endDate && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 26 }}>
                                <Text style={styles.dateRangeArrow}>→</Text>
                                <Text style={styles.datePickerText}>
                                  {formatDate(endDate)}
                                </Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.daysCountBadge}>
                            <Text style={styles.daysCountText}>
                              {startDate && endDate ? calculateDays(startDate, endDate) : '-'} days
                            </Text>
                          </View>
                        </TouchableOpacity>
                        
                        {/* Clear Dates Button */}
                        {(startDate || endDate) && (
                          <TouchableOpacity
                            style={styles.clearDatesButton}
                            onPress={() => {
                              setStartDate("");
                              setEndDate("");
                            }}
                            activeOpacity={0.7}
                          >
                            <XCircle size={16} color="#ef4444" />
                            <Text style={styles.clearDatesText}>Clear Dates</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    {/* Reason */}
                    <Text style={styles.inputLabel}>Reason</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Enter reason for leave..."
                      value={reason}
                      onChangeText={setReason}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      placeholderTextColor="#999"
                      returnKeyType="done"
                      blurOnSubmit={true}
                    />

                    {/* Buttons */}
                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => {
                          Keyboard.dismiss();
                          setModalVisible(false);
                          setShowCalendar(false); // Also close calendar
                        }}
                        disabled={submitting}
                      >
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                        onPress={() => {
                          Keyboard.dismiss();
                          submitLeaveRequest();
                        }}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.submitButtonText}>Submit</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                  
                  {/* Calendar Range Picker Rendered INSIDE Request Leave Modal */}
                  {showCalendar && Platform.OS !== 'web' && CalendarPicker && (
                    <View style={styles.datePickerFullOverlay}>
                      <TouchableWithoutFeedback onPress={() => setShowCalendar(false)}>
                        <View style={styles.datePickerBackdrop} />
                      </TouchableWithoutFeedback>
                      
                      <View style={styles.datePickerInlineContainer}>
                      <View style={styles.datePickerInlineHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.datePickerTitle}>
                            Select Leave Period
                          </Text>
                          <Text style={styles.datePickerSubtitle}>
                            {!startDate ? 'Tap start date' : !endDate ? 'Tap end date' : `${calculateDays(startDate, endDate)} days selected`}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          {(startDate || endDate) && (
                            <TouchableOpacity 
                              onPress={() => {
                                setStartDate("");
                                setEndDate("");
                              }}
                              style={styles.clearButtonInCalendar}
                            >
                              <XCircle size={18} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity 
                            onPress={() => setShowCalendar(false)}
                            style={styles.doneButtonContainer}
                          >
                            <Text style={styles.iosPickerDoneButton}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={styles.datePickerWrapper}>
                        <CalendarPicker
                          startFromMonday={false}
                          allowRangeSelection={true}
                          selectedStartDate={startDate ? new Date(startDate) : null}
                          selectedEndDate={endDate ? new Date(endDate) : null}
                          onDateChange={handleDateRangeSelect}
                          minDate={new Date()}
                          todayBackgroundColor="#e6f7ed"
                          selectedDayColor="#00A652"
                          selectedDayTextColor="#FFFFFF"
                          selectedRangeStartStyle={{
                            backgroundColor: '#00A652',
                          }}
                          selectedRangeEndStyle={{
                            backgroundColor: '#00A652',
                          }}
                          selectedRangeStyle={{
                            backgroundColor: '#d1fae5',
                          }}
                          textStyle={{
                            fontFamily: 'System',
                            color: '#1a1a1a',
                            fontSize: 14,
                          }}
                          monthTitleStyle={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: '#1a1a1a',
                          }}
                          yearTitleStyle={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: '#1a1a1a',
                          }}
                          previousTitleStyle={{
                            fontSize: 18,
                            color: '#00A652',
                            fontWeight: '700',
                          }}
                          nextTitleStyle={{
                            fontSize: 18,
                            color: '#00A652',
                            fontWeight: '700',
                          }}
                          dayLabelsWrapper={{
                            borderTopWidth: 0,
                            borderBottomWidth: 0,
                          }}
                          width={310}
                          height={320}
                        />
                      </View>
                      </View>
                    </View>
                  )}
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

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
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1a1a1a",
  },
  title: { fontSize: 20, fontWeight: "600" },
  subtitle: { color: "#666", fontSize: 14 },
  pinText: { color: "#999", fontSize: 12, marginTop: 2 },

  requestButton: {
    backgroundColor: "#00A652",
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  requestButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },

  statsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  statCard: {
    backgroundColor: "#fff",
    flex: 1,
    borderRadius: 8,
    padding: 8,
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
    borderColor: "#00A652",
    backgroundColor: "#f0fdf4",
  },
  iconWrapper: {
    padding: 6,
    borderRadius: 6,
    marginBottom: 4,
  },
  statLabel: { color: "#666", fontSize: 10, textAlign: "center" },
  statValue: { fontSize: 16, fontWeight: "700", marginTop: 2 },

  leaveCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  leaveCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  compactLeaveType: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  compactDayOfWeek: {
    fontSize: 10,
    color: "#999",
    fontWeight: "500",
  },
  compactTime: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  timeLabel: {
    fontSize: 9,
    color: "#999",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  compactBadgeContainer: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  statusBadgeCompact: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#1a1a1a",
  },
  timeRowCombined: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  compactIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  reasonLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "700",
  },
  reasonCompact: {
    fontSize: 11,
    color: "#666",
    lineHeight: 16,
  },

  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    color: "#dc3545",
    fontSize: 16,
    textAlign: "center",
  },

  // Leave Balance styles
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 12,
  },
  balanceContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: "45%",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: "#00A652",
  },
  balanceType: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: "700",
    color: "#00A652",
    marginBottom: 4,
  },
  balanceQuota: {
    fontSize: 11,
    color: "#999",
  },
  balancePeriod: {
    fontSize: 10,
    color: "#999",
    marginTop: 2,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    maxHeight: "90%",
    minHeight: "50%",
    position: 'relative', // ✅ Allow absolute positioning of date picker inside
    overflow: 'visible', // ✅ Allow date picker to overflow
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
    color: "#333",
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    minHeight: 100,
  },
  leaveTypeScroll: {
    marginBottom: 8,
  },
  leaveTypeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
  },
  leaveTypeChipActive: {
    backgroundColor: "#d1fae5",
    borderColor: "#00A652",
  },
  leaveTypeChipText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
  leaveTypeChipTextActive: {
    color: "#00A652",
  },
  leaveTypeQuota: {
    fontSize: 10,
    color: "#999",
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#00A652",
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },

  // Calendar Picker Styles
  dateRangeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 14,
    backgroundColor: "#fff",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  datePickerText: {
    fontSize: 15,
    color: "#1a1a1a",
    fontWeight: "600",
  },
  datePickerPlaceholder: {
    fontSize: 15,
    color: "#9ca3af",
  },
  dateRangeArrow: {
    fontSize: 14,
    color: "#00A652",
    fontWeight: "700",
  },
  daysCountBadge: {
    backgroundColor: "#e6f7ed",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  daysCountText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#00A652",
  },
  clearDatesButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  clearDatesText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#ef4444",
  },

  // Date Picker Full Overlay (flexbox centering)
  datePickerFullOverlay: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  
  // Date Picker Backdrop (semi-transparent overlay)
  datePickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  
  // Date Picker Inline Container (centered card)
  datePickerInlineContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 5 },
    elevation: 25,
    overflow: 'hidden',
    width: 340,
  },
  datePickerInlineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
  },
  datePickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  datePickerSubtitle: {
    fontSize: 12,
    color: "#666",
  },
  clearButtonInCalendar: {
    padding: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  doneButtonContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#00A652",
    borderRadius: 8,
  },
  iosPickerDoneButton: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  datePickerWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 5,
    paddingVertical: 10,
  },
});

