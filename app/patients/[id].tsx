import axios from "axios";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../ctx/theme";

// ✅ Import the new component
import LabTable from "../../components/LabTable";

// ✅ Images
const avatarImg = require("../images/avatar.png");
const femaleImg = require("../images/female.png");

// ✅ Types
type PatientDetail = {
  PATIENT_ID: number | null;
  PATIENT_FNAME: string;
  PATIENT_LNAME?: string;
  GENDER: string;
  DISTRICT: string;
  DOB: string;
  MOBILE_NO: string;
  AGE: number;
  PMR_NO: number;
};

type Note = { Loc_ID: number; date: string; LocalExamination: string };

type Radiology = {
  id: number;
  pmr_no: string;
  status: number;
  xray_status: string | null;
  ct_status: string | null;
  request_time: string;
  priority: string;
  modality: string;
  mod_type: string;
  mod_region: string;
  short_history: string;
};

export default function PatientDetailScreen() {
  const { id } = useLocalSearchParams();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"notes" | "lab" | "radiology">(
    "notes"
  );
  const [notes, setNotes] = useState<Note[]>([]);
  const [radiologyReports, setRadiologyReports] = useState<Radiology[]>([]);
  const LOCAL_IP = "192.168.100.103";
  const { isDarkMode } = useTheme();
  const palette = useMemo(() => buildDetailPalette(isDarkMode), [isDarkMode]);
  const styles = useMemo(() => createStyles(palette), [palette]);

  // 🔹 Fetch patient data
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const patientRes = await axios.get(
          `http://${LOCAL_IP}:3000/patients/${id}`
        );
        setPatient(patientRes.data);

        const notesRes = await axios.get(
          `http://${LOCAL_IP}:3000/patients/${id}/notes`
        );
        setNotes(notesRes.data);

        const radRes = await axios.get(
          `http://${LOCAL_IP}:3000/patients/${id}/radiology`
        );
        setRadiologyReports(radRes.data);
      } catch (err) {
        console.error("Error fetching patient details:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatientData();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator
          size="large"
          color={palette.accent}
          style={styles.loader}
        />
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.emptyMessage}>Patient not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: "Patients History" }} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={patient.GENDER === "Female" ? femaleImg : avatarImg}
            style={styles.avatar}
          />
          <Text style={styles.name}>
            {patient.PATIENT_FNAME} {patient.PATIENT_LNAME || ""}
          </Text>
          <Text style={styles.mr}>Patient ID {patient.PATIENT_ID}</Text>
        </View>

        {/* Patient Info Table */}
        <View style={styles.reportTable}>
          <View style={styles.reportRow}>
            <Text style={styles.reportLabel}>Patient ID</Text>
            <Text style={styles.reportValue}>{patient.PATIENT_ID}</Text>
          </View>
          <View style={styles.reportRow}>
            <Text style={styles.reportLabel}>Age</Text>
            <Text style={styles.reportValue}>{patient.AGE}</Text>
          </View>
          <View style={styles.reportRow}>
            <Text style={styles.reportLabel}>Gender</Text>
            <Text style={styles.reportValue}>{patient.GENDER}</Text>
          </View>
          <View style={styles.reportRow}>
            <Text style={styles.reportLabel}>Date of Birth</Text>
            <Text style={styles.reportValue}>{patient.DOB?.split("T")[0]}</Text>
          </View>
          <View style={styles.reportRow}>
            <Text style={styles.reportLabel}>Mobile</Text>
            <Text style={styles.reportValue}>{patient.MOBILE_NO}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {["notes", "lab", "radiology"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tabButton,
                activeTab === tab && styles.tabActive,
              ]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab === "notes"
                  ? "Notes"
                  : tab === "lab"
                    ? "Lab Reports"
                    : "Radiology"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {/* Notes */}
          {activeTab === "notes" &&
            (notes.length > 0 ? (
              notes.map((note) => (
                <View key={note.Loc_ID} style={styles.card}>
                  <Text style={styles.bodyText}>{note.LocalExamination}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.bodyTextMuted}>No notes available.</Text>
            ))}

          {/* ✅ Lab Reports — replaced with component */}
          {activeTab === "lab" && patient?.PATIENT_ID && (
            <LabTable patientId={String(patient.PATIENT_ID)} />
          )}

          {/* Radiology */}
          {activeTab === "radiology" &&
            (radiologyReports.length > 0 ? (
              radiologyReports.map((rad) => (
                <View key={rad.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    PMR No: {rad.pmr_no}
                  </Text>
                  <Text style={styles.bodyText}>Status: {rad.status}</Text>
                  <Text style={styles.bodyText}>X-Ray: {rad.xray_status}</Text>
                  <Text style={styles.bodyText}>CT: {rad.ct_status}</Text>
                  <Text style={styles.bodyText}>Priority: {rad.priority}</Text>
                  <Text style={styles.bodyText}>Modality: {rad.modality}</Text>
                  <Text style={styles.bodyText}>Region: {rad.mod_region}</Text>
                  <Text style={styles.bodyText}>
                    Request Time: {rad.request_time}
                  </Text>
                  <Text style={styles.bodyText}>
                    History: {rad.short_history}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.bodyTextMuted}>
                No radiology reports available.
              </Text>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (palette: DetailPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    loader: { marginTop: 50 },
    emptyMessage: {
      textAlign: "center",
      marginTop: 50,
      color: palette.textMuted,
    },
    header: { alignItems: "center", marginBottom: 20 },
    avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
    name: { fontSize: 22, fontWeight: "700", color: palette.textPrimary },
    mr: { fontSize: 14, color: palette.textMuted },

    tabRow: { flexDirection: "row", marginBottom: 16 },
    tabButton: {
      flex: 1,
      padding: 10,
      borderWidth: 1,
      borderColor: palette.accent,
      borderRadius: 10,
      marginHorizontal: 4,
      alignItems: "center",
      backgroundColor: palette.background,
    },
    tabActive: { backgroundColor: palette.accent },
    tabText: { color: palette.accent, fontWeight: "600" },
    tabTextActive: { color: "#fff", fontWeight: "700" },

    tabContent: { marginBottom: 16 },
    card: {
      backgroundColor: palette.card,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    cardTitle: {
      fontWeight: "600",
      color: palette.textPrimary,
      marginBottom: 4,
    },
    bodyText: { color: palette.textPrimary, marginBottom: 2 },
    bodyTextMuted: { color: palette.textMuted, marginBottom: 8 },

    // Patient Info Table
    reportTable: {
      backgroundColor: palette.card,
      borderRadius: 10,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: palette.border,
      overflow: "hidden",
    },
    reportRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: palette.border,
    },
    reportLabel: {
      fontWeight: "600",
      fontSize: 14,
      color: palette.textPrimary,
      flex: 1,
    },
    reportValue: {
      fontSize: 14,
      color: palette.textPrimary,
      flex: 1,
      textAlign: "right",
    },
  });

type DetailPalette = ReturnType<typeof buildDetailPalette>;

const buildDetailPalette = (isDarkMode: boolean) => ({
  background: isDarkMode ? "#000000" : "#f3f4f6",
  card: isDarkMode ? "#0d0d0d" : "#fff",
  border: isDarkMode ? "#1a1a1a" : "#e5e7eb",
  textPrimary: isDarkMode ? "#f8fafc" : "#111827",
  textMuted: isDarkMode ? "#a1a1aa" : "#666",
  accent: "#00A652",
});
