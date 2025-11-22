import { Calendar, ClipboardCheck, FileText } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AttendanceScreen from "../../components/attendance";
import LeavesScreen from "../../components/leaves";
import LeavesApproval from "../../components/LeavesApproval";
import SimpleAvatar from "../../components/SimpleAvatar";
import { useSession } from "../../ctx";
import { useTheme } from "../../ctx/theme";

export default function HRISScreen() {
  const { session } = useSession();
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const [activeView, setActiveView] = useState<'menu' | 'attendance' | 'leaves' | 'approval'>('menu');

  const userName = session?.user?.GR_EMPLOYER_LOGIN?.split("-")[0] || "User";
  const pinNumber = session?.user?.pinNumber || (
    session?.user?.GR_EMPLOYER_LOGIN?.includes("-")
      ? session.user.GR_EMPLOYER_LOGIN.split("-")[1]
      : session?.user?.ADMIN_ID
  ) || "----";
  const managerStatus = (session?.user as any)?.manager_status;
  const isManager = managerStatus === 1 || managerStatus === 2;

  if (activeView === 'attendance') {
    return <AttendanceScreen onBack={() => setActiveView('menu')} />;
  }

  if (activeView === 'leaves') {
    return <LeavesScreen onBack={() => setActiveView('menu')} />;
  }

  if (activeView === 'approval') {
    return <LeavesApproval onBack={() => setActiveView('menu')} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>HRIS</Text>
          <Text style={styles.pinText}>PIN: {pinNumber}</Text>
        </View>
        <SimpleAvatar
          fallback={userName.substring(0, 2).toUpperCase()}
          size={48}
        />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Buttons Grid */}
        <View style={styles.buttonsGrid}>
          {/* Attendance Button - Full Width */}
          <TouchableOpacity
            style={styles.buttonCard}
            onPress={() => setActiveView('attendance')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrapper, { backgroundColor: "#d1fae5" }]}>
              <Calendar size={32} color="#00A652" />
            </View>
            <Text style={styles.buttonTitle}>Attendance</Text>
            <Text style={styles.buttonSubtitle}>
              Mark your check-in and check-out
            </Text>
          </TouchableOpacity>

          {/* Leaves Buttons Row - Side by Side */}
          <View style={styles.leavesRow}>
            {/* Leave Requests Button */}
            <TouchableOpacity
              style={[styles.buttonCard, styles.halfWidthCard]}
              onPress={() => setActiveView('leaves')}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrapper, { backgroundColor: "#dbeafe" }]}>
                <FileText size={32} color="#3b82f6" />
              </View>
              <Text style={styles.buttonTitle}>Leave Requests</Text>
              <Text style={styles.buttonSubtitle}>
                Request and manage your leaves
              </Text>
            </TouchableOpacity>

          {/* Leaves Approval Button */}
          <TouchableOpacity
            style={[
              styles.buttonCard,
              styles.halfWidthCard,
              !isManager && { opacity: 0.5 },
            ]}
            onPress={() => {
              if (!isManager) {
                Alert.alert("Restricted Access", "Only managers can review leave approvals.");
                return;
              }
              setActiveView('approval');
            }}
            activeOpacity={0.7}
          >
              <View style={[styles.iconWrapper, { backgroundColor: "#fee2e2" }]}>
                <ClipboardCheck size={32} color="#ef4444" />
              </View>
              <Text style={styles.buttonTitle}>Leaves Approval</Text>
              <Text style={styles.buttonSubtitle}>
              Review and approve pending requests
              {!isManager ? " (Restricted)" : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (isDarkMode: boolean) => {
  const background = isDarkMode ? "#000000" : "#f3f4f6";
  const card = isDarkMode ? "#0d0d0d" : "#fff";
  const border = isDarkMode ? "#1a1a1a" : "#e5e7eb";
  const textPrimary = isDarkMode ? "#f8fafc" : "#1a1a1a";
  const textMuted = isDarkMode ? "#94a3b8" : "#666";
  const pinColor = isDarkMode ? "#cbd5f5" : "#999";

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: background,
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      padding: 16,
      paddingTop: 20,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      backgroundColor: card,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    title: {
      fontSize: 20,
      fontWeight: "600",
      color: textPrimary,
    },
    subtitle: {
      color: textMuted,
      fontSize: 14,
      marginTop: 2,
    },
    pinText: {
      color: pinColor,
      fontSize: 12,
      marginTop: 4,
    },
    buttonsGrid: {
      gap: 16,
      padding: 16,
    },
    leavesRow: {
      flexDirection: "row",
      gap: 16,
    },
    buttonCard: {
      backgroundColor: card,
      borderRadius: 12,
      padding: 20,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: isDarkMode ? 0.4 : 0.1,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
      borderWidth: 1,
      borderColor: border,
    },
    halfWidthCard: {
      flex: 1,
    },
    iconWrapper: {
      width: 64,
      height: 64,
      borderRadius: 32,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    buttonTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: textPrimary,
      marginBottom: 6,
      textAlign: "center",
      width: "100%",
    },
    buttonSubtitle: {
      fontSize: 14,
      color: textMuted,
      textAlign: "center",
    },
  });
};
