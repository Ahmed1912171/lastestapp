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
  useWindowDimensions,
} from "react-native";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";


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

type PivotedData = {
  TestID: string;
  Heading: string;
  ComponentID: string;
  NormalRange: string;
  [date: string]: string;
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
  const { height } = useWindowDimensions();

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"notes" | "lab" | "radiology">("notes");

  const [notes, setNotes] = useState<Note[]>([]);
  const [labReports, setLabReports] = useState<Lab[]>([]);
  const [radiologyReports, setRadiologyReports] = useState<Radiology[]>([]);
  const [scale, setScale] = useState(1);

  // 🔹 Fetch patient data
  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const patientRes = await axios.get(`http://192.168.100.69:3000/patients/${id}`);
        setPatient(patientRes.data);

        const notesRes = await axios.get(`http://192.168.100.69:3000/patients/${id}/notes`);
        setNotes(notesRes.data);

        const labRes = await axios.get(`http://192.168.100.69:3000/patients/${id}/lab`);
        setLabReports(labRes.data);

        const radRes = await axios.get(`http://192.168.100.69:3000/patients/${id}/radiology`);
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

  // 🔹 Pivot lab data for table
  const uniqueDates = Array.from(
    new Set(
      labReports.map((item) =>
        item.Result_date_time ? item.Result_date_time.split("T")[0] : ""
      )
    )
  ).filter(Boolean);

  const pivoted: PivotedData[] = [];
  const map = new Map<string, PivotedData>();

  labReports.forEach((item) => {
    const key = `${item.TestID}-${item.ComponentID}`;
    const date = item.Result_date_time ? item.Result_date_time.split("T")[0] : "-";

    if (!map.has(key)) {
      map.set(key, {
        TestID: item.TestID,
        Heading: item.Heading,
        ComponentID: item.ComponentID,
        NormalRange: item.NormalRange,
      });
    }
    const row = map.get(key)!;
    row[date] = item.Result || "-";
  });

  map.forEach((row) => pivoted.push(row));

  const grouped: { [testID: string]: PivotedData[] } = {};
  pivoted.forEach((row) => {
    if (!grouped[row.TestID]) grouped[row.TestID] = [];
    grouped[row.TestID].push(row);
  });

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

          {/* Lab Reports */}
          {activeTab === "lab" &&
            (labReports.length > 0 ? (
              <GestureHandlerRootView>
                <PinchGestureHandler
                  onGestureEvent={(e) => {
                    let newScale = e.nativeEvent.scale;
                    if (newScale < 0.8) newScale = 0.8;
                    if (newScale > 2) newScale = 2;
                    setScale(newScale);
                  }}
                >
                  <ScrollView horizontal>
                    <View style={{ minWidth: 800, marginBottom: 20 }}>
                      <ScrollView style={{ maxHeight: height - 200 }}>
                        <View style={{ transform: [{ scale }] }}>
                          {/* Table Header */}
                          <View style={[styles.row, styles.headerRow]}>
                            <Text style={[styles.cell, styles.headerCell, { width: 80 }]}>
                              Test ID
                            </Text>
                            <Text style={[styles.cell, styles.headerCell, { width: 110 }]}>
                              Heading
                            </Text>
                            <Text style={[styles.cell, styles.headerCell, { width: 110 }]}>
                              Component
                            </Text>
                            <Text style={[styles.cell, styles.headerCell, { width: 150 }]}>
                              Normal Range
                            </Text>
                            {uniqueDates.map((date) => (
                              <Text
                                key={date}
                                style={[styles.cell, styles.headerCell, { width: 120 }]}
                              >
                                {date}
                              </Text>
                            ))}
                          </View>

                          {/* Table Rows */}
                          {Object.entries(grouped).map(([testID, rows]) =>
                            rows.map((row, idx) => (
                              <View key={`${testID}-${idx}`} style={styles.row}>
                                {idx === 0 ? (
                                  <View
                                    style={[
                                      styles.cellBox,
                                      { width: 80, backgroundColor: "#f9f9f9" },
                                    ]}
                                  >
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        fontWeight: "600",
                                        textAlign: "center",
                                      }}
                                    >
                                      {testID}
                                    </Text>
                                  </View>
                                ) : (
                                  <View
                                    style={[styles.cellBox, { width: 80, backgroundColor: "#fff" }]}
                                  />
                                )}
                                <Text style={[styles.cell, { width: 110 }]}>{row.Heading}</Text>
                                <Text style={[styles.cell, { width: 110 }]}>{row.ComponentID}</Text>
                                <Text style={[styles.cell, { width: 150 }]}>{row.NormalRange}</Text>
                                {uniqueDates.map((date) => (
                                  <Text
                                    key={`${testID}-${idx}-${date}`}
                                    style={[styles.cell, { width: 120 }]}
                                  >
                                    {row[date] || "-"}
                                  </Text>
                                ))}
                              </View>
                            ))
                          )}
                        </View>
                      </ScrollView>
                    </View>
                  </ScrollView>
                </PinchGestureHandler>
              </GestureHandlerRootView>
            ) : (
              <Text>No lab reports available.</Text>
            ))}

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

  // Lab Table
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ddd" },
  headerRow: { backgroundColor: "#00A652", borderBottomWidth: 1 },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: "center",
    color: "#000",
    borderRightWidth: 1,
    borderColor: "#ddd",
  },
  cellBox: { justifyContent: "center", alignItems: "center", borderRightWidth: 1, borderColor: "#ddd" },
  headerCell: { fontWeight: "bold", fontSize: 12, color: "#fff" },
});
