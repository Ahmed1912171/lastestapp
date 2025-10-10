import axios from "axios";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
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
  const [activeTab, setActiveTab] = useState<"notes" | "lab" | "radiology">("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [radiologyReports, setRadiologyReports] = useState<Radiology[]>([]);
  const LOCAL_IP = "192.168.100.147";

  // 🔹 Fetch patient data
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const patientRes = await axios.get(`http://${LOCAL_IP}:3000/patients/${id}`);
        setPatient(patientRes.data);

        const notesRes = await axios.get(`http://${LOCAL_IP}:3000/patients/${id}/notes`);
        setNotes(notesRes.data);

        const radRes = await axios.get(`http://${LOCAL_IP}:3000/patients/${id}/radiology`);
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
        <ActivityIndicator size="large" color="#00A652" style={{ marginTop: 50 }} />
      </SafeAreaView>
    );
  }

  if (!patient) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: "center", marginTop: 50 }}>Patient not found.</Text>
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
              style={[styles.tabButton, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && { color: "#fff", fontWeight: "700" },
                ]}
              >
                {tab === "notes" ? "Notes" : tab === "lab" ? "Lab Reports" : "Radiology"}
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
                  <Text>{note.LocalExamination}</Text>
                </View>
              ))
            ) : (
              <Text>No notes available.</Text>
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
                  <Text style={{ fontWeight: "600" }}>PMR No: {rad.pmr_no}</Text>
                  <Text>Status: {rad.status}</Text>
                  <Text>X-Ray: {rad.xray_status}</Text>
                  <Text>CT: {rad.ct_status}</Text>
                  <Text>Priority: {rad.priority}</Text>
                  <Text>Modality: {rad.modality}</Text>
                  <Text>Region: {rad.mod_region}</Text>
                  <Text>Request Time: {rad.request_time}</Text>
                  <Text>History: {rad.short_history}</Text>
                </View>
              ))
            ) : (
              <Text>No radiology reports available.</Text>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 12 },
  name: { fontSize: 22, fontWeight: "700" },
  mr: { fontSize: 14, color: "#666" },

  tabRow: { flexDirection: "row", marginBottom: 16 },
  tabButton: {
    flex: 1,
    padding: 8,
    borderWidth: 1,
    borderColor: "#00A652",
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#00A652" },
  tabText: { color: "#00A652", fontWeight: "600" },

  tabContent: { marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  // Patient Info Table
  reportTable: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  reportLabel: { fontWeight: "600", fontSize: 14, color: "#000", flex: 1 },
  reportValue: { fontSize: 14, color: "#333", flex: 1, textAlign: "right" },
});
