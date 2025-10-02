// app/(tabs)/attendance.tsx
import { Activity, Calendar, Clock, UserCheck } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SimpleAvatar from "../../components/SimpleAvatar";

// Example user, in real app this comes from authentication
const loggedInUser = {
  id: 1,
  name: "Dr. Ahmed",
  role: "Doctor", // Doctor, Nurse, Staff
};

// Mock attendance logs
type AttendanceLog = {
  date: string;
  timeIn: string;
  timeOut?: string;
  status: "On Time" | "Late";
};

const initialLogs: AttendanceLog[] = [
  { date: "2025-09-21", timeIn: "08:05 AM", timeOut: "04:15 PM", status: "Late" },
  { date: "2025-09-22", timeIn: "08:00 AM", timeOut: "04:00 PM", status: "On Time" },
  { date: "2025-09-23", timeIn: "08:12 AM", timeOut: "04:20 PM", status: "Late" },
  { date: "2025-09-24", timeIn: "08:00 AM", timeOut: "04:00 PM", status: "On Time" },
];

export default function AttendanceScreen() {
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>(initialLogs);
  const [isPresent, setIsPresent] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Update current time
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

  const markAttendance = () => {
    if (isPresent) return;

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const status = parseInt(currentTime.split(":")[0]) > 8 ? "Late" : "On Time";

    const newLog: AttendanceLog = {
      date: dateStr,
      timeIn: currentTime,
      status,
    };

    setAttendanceLogs([newLog, ...attendanceLogs]);
    setIsPresent(true);
  };

  // Dashboard stats
  const totalDays = attendanceLogs.length;
  const lateDays = attendanceLogs.filter(log => log.status === "Late").length;
  const onTimeDays = totalDays - lateDays;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Attendance</Text>
          <Text style={styles.subtitle}>Hello, {loggedInUser.name}</Text>
        </View>
        <SimpleAvatar fallback={loggedInUser.name.split(" ").map(n => n[0]).join("")} size={48} />
      </View>

      {/* Mark Attendance Button */}
      <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
        <TouchableOpacity
          style={[styles.attendanceButton, isPresent && { backgroundColor: "#10b981" }]}
          onPress={markAttendance}
          disabled={isPresent}
        >
          <UserCheck size={20} color="#fff" />
          <Text style={styles.attendanceButtonText}>
            {isPresent ? "Marked Present" : "Mark Attendance"}
          </Text>
        </TouchableOpacity>
        <Text style={{ marginTop: 8, color: "#666" }}>Current Time: {currentTime}</Text>
      </View>

      {/* Stats Dashboard */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Activity size={24} color="#10b981" />
          <Text style={styles.statLabel}>Total Days</Text>
          <Text style={styles.statValue}>{totalDays}</Text>
        </View>
        <View style={styles.statCard}>
          <Clock size={24} color="#f59e0b" />
          <Text style={styles.statLabel}>On Time</Text>
          <Text style={styles.statValue}>{onTimeDays}</Text>
        </View>
        <View style={styles.statCard}>
          <Calendar size={24} color="#ef4444" />
          <Text style={styles.statLabel}>Late Days</Text>
          <Text style={styles.statValue}>{lateDays}</Text>
        </View>
      </View>

      {/* Attendance Logs */}
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {attendanceLogs.map((log, index) => (
          <View key={index} style={styles.logCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "600" }}>{log.date}</Text>
              <Text style={{ color: log.status === "Late" ? "#ef4444" : "#10b981" }}>{log.status}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
              <Text>Time In: {log.timeIn}</Text>
              <Text>Time Out: {log.timeOut || "-"}</Text>
            </View>
          </View>
        ))}
        {attendanceLogs.length === 0 && (
          <Text style={{ textAlign: "center", color: "#666", marginTop: 40 }}>
            No attendance records found.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  subtitle: { color: "#666" },

  attendanceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  attendanceButtonText: { color: "#fff", fontWeight: "600" },

  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: "#fff",
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statLabel: { color: "#666", marginTop: 4 },
  statValue: { fontSize: 18, fontWeight: "600", marginTop: 2 },

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
});
