import axios from "axios";
import { Eye, FileText } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import Modal from "react-native-modal";

const avatarImg = require("../images/avatar.png");
const femaleImg = require("../images/female.png");

type Patient = {
  ADM_REQ_ID?: number; // <-- admission-level unique id from backend
  PATIENT_ID: number;
  PMR_NO: number | string;
  PATIENT_FNAME: string;
  PATIENT_LNAME?: string;
  GENDER: string;
  WARD_ID?: number;
};

type Note = {
  Loc_ID: number;
  LocalExamination: string;
  loc_ex_date: string;
};

type Lab = {
  id: number;
  LabNo: string;
  TestID: string;
  Order_Id: number;
  Barcode_no: string;
  ComponentID: string;
  Result: string;
  Unit: string;
  NormalRange: string;
  Heading: string;
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

// Ward mapping (keeps mapping consistent with backend)
const wardMap: Record<number, string> = {
  921: "PICU",
  1116: "NICU",
  1119: "GP",
};

export default function PatientsScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [modalType, setModalType] = useState<"notes" | "lab" | "radiology" | null>(null);
  const [activeTab, setActiveTab] = useState<"notes" | "lab" | "radiology">("notes");

  const [notes, setNotes] = useState<Note[]>([]);
  const [labReports, setLabReports] = useState<Lab[]>([]);
  const [radiologyReports, setRadiologyReports] = useState<Radiology[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const { width } = useWindowDimensions();

  const LOCAL_IP = "192.168.100.69";
  const API_BASE =
    Platform.OS === "android" ? "http://10.0.2.2:3000" : `http://${LOCAL_IP}:3000`;

  // ---------------------------
  // Filters (UI only) - defaults: Korangi + PICU
  // ---------------------------
  const [branch, setBranch] = useState("Korangi");
  const [ward, setWard] = useState("PICU");

  const [branchOpen, setBranchOpen] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);

  // keep items in state so DropDownPicker typings are happy
  const [branchItemsState, setBranchItemsState] = useState([{ label: "Korangi", value: "Korangi" }]);
  const [wardItemsState, setWardItemsState] = useState([
    { label: "PICU", value: "PICU" },
    { label: "NICU", value: "NICU" },
    { label: "GP", value: "GP" },
  ]);

  // ---------------------------
  // Fetch patients with pagination & dedupe appended pages
  // ---------------------------
  const fetchPatients = useCallback(
    async (pageNum: number = 1, query: string = "") => {
      try {
        if (pageNum === 1) setLoading(true);
        const res = await axios.get(`${API_BASE}/patients_all`, {
          params: { page: pageNum, limit: 20, search: query },
        });
        const data: Patient[] = res.data || [];

        if (pageNum === 1) {
          setPatients(data);
        } else {
          // Append but deduplicate by ADM_REQ_ID (preferred) or PATIENT_ID
          setPatients((prev) => {
            const map = new Map<string | number, Patient>();
            // insert existing first
            for (const p of prev) {
              const key = p.ADM_REQ_ID ?? p.PATIENT_ID;
              map.set(key, p);
            }
            // then insert incoming (will replace duplicates with new one)
            for (const p of data) {
              const key = p.ADM_REQ_ID ?? p.PATIENT_ID;
              map.set(key, p);
            }
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.error("Error fetching patients:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchPatients(1, searchQuery);
  }, [fetchPatients, searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    fetchPatients(1, searchQuery);
  };

  const loadMore = () => {
    if (!loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPatients(nextPage, searchQuery);
    }
  };

  // ---------------------------
  // Apply filter (client-side) — DO NOT change modal/UI behavior
  // ---------------------------
  const filteredPatients = patients.filter((p) => {
    const wardName = p.WARD_ID ? wardMap[p.WARD_ID] : null;
    // branch is hardcoded Korangi for now; ward filters by mapped name
    return branch === "Korangi" && (!ward || wardName === ward);
  });

  // ---------------------------
  // Open modal
  // ---------------------------
  const openModal = async (patient: Patient, type: "notes" | "lab" | "radiology") => {
    setSelectedPatient(patient);
    setModalType(type);
    setActiveTab(type);
    setModalLoading(true);

    try {
      if (type === "notes") {
        const res = await axios.get(`${API_BASE}/patients/${patient.PATIENT_ID}/notes`);
        setNotes(res.data);
      } else if (type === "lab") {
        const res = await axios.get(`${API_BASE}/patients/${patient.PATIENT_ID}/lab`);
        setLabReports(res.data);
      } else if (type === "radiology") {
        const res = await axios.get(`${API_BASE}/patients/${patient.PATIENT_ID}/radiology`);
        setRadiologyReports(res.data);
      }
    } catch (err) {
      console.error("Error fetching modal data:", err);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedPatient(null);
    setModalType(null);
    setNotes([]);
    setLabReports([]);
    setRadiologyReports([]);
  };

  // ---------------------------
  // Render patient (unchanged UI)
  // ---------------------------
  const renderPatient = ({ item }: { item: Patient }) => (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Image
          source={item.GENDER === "Female" ? femaleImg : avatarImg}
          style={{ width: 40, height: 40, borderRadius: 20 }}
        />
        <View style={{ marginLeft: 8 }}>
          <Text style={{ fontWeight: "600" }}>{item.PATIENT_FNAME} {item.PATIENT_LNAME || ""}</Text>
          <Text style={{ fontSize: 12, color: "#666" }}>MR: {item.PMR_NO}</Text>
          <Text style={{ fontSize: 12, color: "#666" }}>ID: {item.PATIENT_ID}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => openModal(item, "notes")} style={styles.button}>
          <Eye size={16} color="#fff" />
          <Text style={styles.buttonText}>Notes</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => openModal(item, "lab")} style={styles.button}>
          <FileText size={16} color="#fff" />
          <Text style={styles.buttonText}>Lab Reports</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => openModal(item, "radiology")} style={styles.button}>
          <FileText size={16} color="#fff" />
          <Text style={styles.buttonText}>Radiology</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ---------------------------
  // Modal content — EXACTLY as in your original UI (no changes)
  // ---------------------------
  const renderModalContent = () => {
    if (!selectedPatient || !modalType) return null;
    if (modalLoading) return <ActivityIndicator size="large" color="#00A652" style={{ marginTop: 20 }} />;

    return (
      <ScrollView style={{ maxHeight: "90%" }}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <Image
            source={selectedPatient.GENDER === "Female" ? femaleImg : avatarImg}
            style={{ width: 80, height: 80, borderRadius: 40 }}
          />
          <Text style={{ fontWeight: "700", fontSize: 18, marginTop: 6 }}>
            {selectedPatient.PATIENT_FNAME} {selectedPatient.PATIENT_LNAME || ""}
          </Text>
          <Text style={{ color: "#666" }}>MR: {selectedPatient.PMR_NO}</Text>
          <Text style={{ color: "#666" }}>ID: {selectedPatient.PATIENT_ID}</Text>
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
                style={[styles.tabText, activeTab === tab && { color: "#fff", fontWeight: "700" }]}
              >
                {tab === "notes" ? "Notes" : tab === "lab" ? "Lab Reports" : "Radiology"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={{ marginTop: 12 }}>
          {activeTab === "notes" && (notes.length ? (
            notes.map((note) => (
              <View key={note.Loc_ID} style={styles.card}>
                <Text style={{ fontWeight: "600" }}>Date: {note.loc_ex_date?.split("T")[0]}</Text>
                <Text>{note.LocalExamination}</Text>
              </View>
            ))
          ) : (
            <Text>No notes available.</Text>
          ))}

          {activeTab === "lab" && (labReports.length ? (
            Object.values(labReports.reduce((acc: any, lab) => {
              if (!acc[lab.Barcode_no]) acc[lab.Barcode_no] = { ...lab, tests: [] };
              acc[lab.Barcode_no].tests.push(lab);
              return acc;
            }, {})).map((group: any, idx) => (
              <View key={idx} style={styles.labReportCard}>
                <Text style={styles.reportTitle}>{group.Heading || "Report"}</Text>
                <Text style={styles.reportSub}>Barcode: {group.Barcode_no}</Text>
                <View style={styles.divider} />
                <View style={styles.tableRowHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Test</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Result</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Unit</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Normal Range</Text>
                </View>
                {group.tests.map((test: Lab, i: number) => (
                  <View key={i} style={styles.tableRowData}>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{test.ComponentID}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{test.Result}</Text>
                    <Text style={[styles.tableCell, { flex: 1 }]}>{test.Unit}</Text>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{test.NormalRange}</Text>
                  </View>
                ))}
              </View>
            ))
          ) : <Text>No lab reports available.</Text>)}

          {activeTab === "radiology" && (radiologyReports.length ? (
            radiologyReports.map((rad) => (
              <View key={rad.id} style={styles.card}>
                <Text>PMR No: {rad.pmr_no}</Text>
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
          ) : <Text>No radiology reports available.</Text>)}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Dropdown Filters (added on top, UI otherwise unchanged) */}
      <View style={{ flexDirection: "row", marginHorizontal: 12, marginTop: 8, zIndex: 1000 }}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <DropDownPicker
            open={branchOpen}
            value={branch}
            items={branchItemsState}
            setOpen={setBranchOpen}
            setValue={setBranch}
            setItems={setBranchItemsState}
            placeholder="Select Branch"
            style={{ borderColor: "#ccc" }}
            dropDownContainerStyle={{ borderColor: "#ccc" }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DropDownPicker
            open={wardOpen}
            value={ward}
            items={wardItemsState}
            setOpen={setWardOpen}
            setValue={setWard}
            setItems={setWardItemsState}
            placeholder="Select Ward"
            style={{ borderColor: "#ccc" }}
            dropDownContainerStyle={{ borderColor: "#ccc" }}
          />
        </View>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search patient..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      {loading && page === 1 ? (
        <ActivityIndicator size="large" color="#00A652" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredPatients}
          keyExtractor={(item) => String(item.ADM_REQ_ID ?? item.PATIENT_ID)}
          renderItem={renderPatient}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      {/* Modal */}
      <Modal
        isVisible={!!selectedPatient}
        onBackdropPress={closeModal}
        onBackButtonPress={closeModal}
        style={{ justifyContent: "center", margin: 16 }}
      >
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, maxHeight: "90%" }}>
          {renderModalContent()}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  searchInput: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  button: {
    flexDirection: "row",
    backgroundColor: "#00A652",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: "center",
    marginHorizontal: 4,
  },
  buttonText: { color: "#fff", fontWeight: "600", marginLeft: 4 },
  tabRow: { flexDirection: "row", marginBottom: 8 },
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

  labReportCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  reportTitle: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  reportSub: { fontSize: 13, color: "#555", marginBottom: 4 },
  divider: { height: 1, backgroundColor: "#ddd", marginVertical: 8 },
  tableRowHeader: { flexDirection: "row", backgroundColor: "#00A652", padding: 6, borderRadius: 4 },
  tableHeaderCell: { fontSize: 13, fontWeight: "700", color: "#fff", textAlign: "left" },
  tableRowData: { flexDirection: "row", marginBottom: 4, paddingVertical: 4, borderBottomWidth: 1, borderColor: "#eee" },
  tableCell: { fontSize: 13, color: "#333" },
});
