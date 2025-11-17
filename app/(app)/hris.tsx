import { Calendar, FileText } from "lucide-react-native";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AttendanceScreen from "../../components/attendance";
import LeavesScreen from "../../components/leaves";
import SimpleAvatar from "../../components/SimpleAvatar";
import { useSession } from "../../ctx";

export default function HRISScreen() {
  const { session } = useSession();
  const [activeView, setActiveView] = useState<'menu' | 'attendance' | 'leaves'>('menu');

  const userName = session?.user?.GR_EMPLOYER_LOGIN?.split("-")[0] || "User";

  if (activeView === 'attendance') {
    return <AttendanceScreen onBack={() => setActiveView('menu')} />;
  }

  if (activeView === 'leaves') {
    return <LeavesScreen onBack={() => setActiveView('menu')} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>HRIS</Text>
          <Text style={styles.subtitle}>Hello, {userName}</Text>
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
          {/* Attendance Button */}
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

          {/* Leaves Button */}
          <TouchableOpacity
            style={styles.buttonCard}
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  subtitle: {
    color: "#666",
    fontSize: 14,
    marginTop: 2,
  },
  buttonsGrid: {
    gap: 16,
  },
  buttonCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
    color: "#1a1a1a",
    marginBottom: 6,
  },
  buttonSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
