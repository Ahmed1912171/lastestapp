import axios from "axios";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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

type Lab = {
  id: number;
  LabNo: string;
  TestID: string;
  Order_Id: number;
  Barcode_no: string;
  Patient_ID: number;
  Result_date_time: string;
  Read: number;
  ComponentID: string;
  Unit: string;
  Result: string;
  NormalRange: string;
  TranOrder: number;
  Heading: string;
  Remarks: string | null;
  IncludeInWorkSheet: number;
  IncludeInResult: number;
  ResultHeading: string;
  PIV: string;
  CutOffValue: string;
  Reader: string;
  Ready: number;
  IsTechnologist: number;
  IsPathologist: number;
};

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
  const [labReports, setLabReports] = useState<Lab[]>([]);
  const [radiologyReports, setRadiologyReports] = useState<Radiology[]>([]);

  // 🔹 Fetch data
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const patientRes = await axios.get(`http://192.168.100.102:3000/patients/${id}`);
        setPatient(patientRes.data);

        const notesRes = await axios.get(`http://192.168.100.102:3000/patients/${id}/notes`);
        setNotes(notesRes.data);

        const labRes = await axios.get(`http://192.168.100.102:3000/patients/${id}/lab`);
        setLabReports(labRes.data);

        const radRes = await axios.get(`http://192.168.100.102:3000/patients/${id}/radiology`);
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
      {/* ✅ Custom Header Title */}
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

        {/* ✅ Patient Info as Report Table */}
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

          {activeTab === "lab" &&
            (labReports.length > 0 ? (
              // Group by Barcode_no
              Object.values(
                labReports.reduce((acc: any, lab) => {
                  if (!acc[lab.Barcode_no]) {
                    acc[lab.Barcode_no] = { ...lab, tests: [] };
                  }
                  acc[lab.Barcode_no].tests.push(lab);
                  return acc;
                }, {})
              ).map((group: any, idx) => (
                <View key={idx} style={styles.labReportCard}>
                  {/* Report Header */}
                  <Text style={styles.reportTitle}>{group.Heading || "Report"}</Text>
                  <Text style={styles.reportSub}>Barcode: {group.Barcode_no}</Text>
                  <Text style={styles.reportSub}>Lab No: {group.LabNo}</Text>
                  <Text style={styles.reportSub}>Order ID: {group.Order_Id}</Text>
                  <Text style={styles.reportSub}>PMR No: {group.PMR_NO}</Text>
                  <Text style={styles.reportSub}>
                    Result Date: {group.Result_date_time?.split("T")[0]}
                  </Text>

                  <View style={styles.divider} />

                  {/* ✅ Green Table Header */}
                  <View style={styles.tableRowHeader}>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Test</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Result</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Unit</Text>
                    <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Normal Range</Text>
                  </View>

                  {/* Table Rows */}
                  {group.tests.map((test: Lab, i: number) => (
                    <View key={i} style={styles.tableRowData}>
                      <Text style={[styles.tableCell, { flex: 2 }]}>{test.ComponentID}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{test.Result}</Text>
                      <Text style={[styles.tableCell, { flex: 1 }]}>{test.Unit}</Text>
                      <Text style={[styles.tableCell, { flex: 2, color: "#555" }]}>
                        {test.NormalRange}
                      </Text>
                    </View>
                  ))}
                </View>
              ))
            ) : (
              <Text>No lab reports available.</Text>
            ))}

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

  // ✅ Patient Info Table
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
  reportLabel: {
    fontWeight: "600",
    fontSize: 14,
    color: "#000000ff",
    flex: 1,
  },
  reportValue: {
    fontSize: 14,
    color: "#333",
    flex: 1,
    textAlign: "right",
  },

  // ✅ Lab Report Styling
  labReportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
    color: "#222",
  },
  reportSub: {
    fontSize: 13,
    color: "#555",
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 10,
  },

  tableRowHeader: {
    flexDirection: "row",
    backgroundColor: "#00A652",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginBottom: 6,
  },
  tableHeaderCell: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    textAlign: "left",
  },

  tableRowData: {
    flexDirection: "row",
    marginBottom: 4,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  tableCell: {
    fontSize: 13,
    color: "#333",
  },
});
