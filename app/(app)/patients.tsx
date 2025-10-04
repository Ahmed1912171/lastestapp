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
import { GestureHandlerRootView, PinchGestureHandler } from "react-native-gesture-handler";
import Modal from "react-native-modal";

const avatarImg = require("../images/avatar.png");
const femaleImg = require("../images/female.png");

type Patient = {
  ADM_REQ_ID?: number;
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

type LabResult = {
  id: number;
  TestID: string;
  Heading: string;
  ComponentID: string;
  Result: string;
  NormalRange: string;
  Result_date_time: string;
  Barcode_no: string;
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

type PivotedData = {
  TestID: string;
  Heading: string;
  ComponentID: string;
  NormalRange: string;
  [date: string]: string; // results keyed by date
};

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
  const [labReports, setLabReports] = useState<LabResult[]>([]);
  const [radiologyReports, setRadiologyReports] = useState<Radiology[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [scale, setScale] = useState(1);

  const { height } = useWindowDimensions();
  const LOCAL_IP = "192.168.100.69";
  const API_BASE = Platform.OS === "android" ? "http://10.0.2.2:3000" : `http://${LOCAL_IP}:3000`;

  // Filters
  const [branch, setBranch] = useState("Korangi");
  const [ward, setWard] = useState("PICU");
  const [branchOpen, setBranchOpen] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  const [branchItemsState, setBranchItemsState] = useState([{ label: "Korangi", value: "Korangi" }]);
  const [wardItemsState, setWardItemsState] = useState([
    { label: "PICU", value: "PICU" },
    { label: "NICU", value: "NICU" },
    { label: "GP", value: "GP" },
  ]);

  const fetchPatients = useCallback(
    async (pageNum: number = 1, query: string = "") => {
      try {
        if (pageNum === 1) setLoading(true);
        const res = await axios.get(`${API_BASE}/patients_all`, { params: { page: pageNum, limit: 20, search: query } });
        const data: Patient[] = res.data || [];
        if (pageNum === 1) setPatients(data);
        else setPatients((prev) => {
          const map = new Map<string | number, Patient>();
          for (const p of prev) map.set(p.ADM_REQ_ID ?? p.PATIENT_ID, p);
          for (const p of data) map.set(p.ADM_REQ_ID ?? p.PATIENT_ID, p);
          return Array.from(map.values());
        });
      } catch (err) {
        console.error("Error fetching patients:", err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => { fetchPatients(1, searchQuery); }, [fetchPatients, searchQuery]);
  const onRefresh = () => { setRefreshing(true); setPage(1); fetchPatients(1, searchQuery); };
  const loadMore = () => { if (!loading) { const nextPage = page + 1; setPage(nextPage); fetchPatients(nextPage, searchQuery); } };
  const filteredPatients = patients.filter((p) => { const wardName = p.WARD_ID ? wardMap[p.WARD_ID] : null; return branch === "Korangi" && (!ward || wardName === ward); });

  const openModal = async (patient: Patient, type: "notes" | "lab" | "radiology") => {
    setSelectedPatient(patient); setModalType(type); setActiveTab(type); setModalLoading(true);
    try {
      if (type === "notes") setNotes((await axios.get(`${API_BASE}/patients/${patient.PATIENT_ID}/notes`)).data);
      if (type === "lab") setLabReports((await axios.get(`${API_BASE}/patients/${patient.PATIENT_ID}/lab`)).data);
      if (type === "radiology") setRadiologyReports((await axios.get(`${API_BASE}/patients/${patient.PATIENT_ID}/radiology`)).data);
    } catch (err) { console.error(err); } finally { setModalLoading(false); setScale(1); }
  };
  const closeModal = () => { setSelectedPatient(null); setModalType(null); setNotes([]); setLabReports([]); setRadiologyReports([]); };

  const renderPatient = ({ item }: { item: Patient }) => (
    <View style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Image source={item.GENDER === "Female" ? femaleImg : avatarImg} style={{ width: 40, height: 40, borderRadius: 20 }} />
        <View style={{ marginLeft: 8 }}>
          <Text style={{ fontWeight: "600" }}>{item.PATIENT_FNAME} {item.PATIENT_LNAME || ""}</Text>
          <Text style={{ fontSize: 12, color: "#666" }}>MR: {item.PMR_NO}</Text>
          <Text style={{ fontSize: 12, color: "#666" }}>ID: {item.PATIENT_ID}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => openModal(item, "notes")} style={styles.button}><Eye size={16} color="#fff" /><Text style={styles.buttonText}>Notes</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => openModal(item, "lab")} style={styles.button}><FileText size={16} color="#fff" /><Text style={styles.buttonText}>Lab Reports</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => openModal(item, "radiology")} style={styles.button}><FileText size={16} color="#fff" /><Text style={styles.buttonText}>Radiology</Text></TouchableOpacity>
      </View>
    </View>
  );

  const renderLabTab = () => {
    if (!labReports.length) return <Text>No lab reports available.</Text>;
    const uniqueDates = Array.from(new Set(labReports.map((item) => item.Result_date_time?.split("T")[0]).filter(Boolean)));
    const pivoted: PivotedData[] = [];
    const mapPivot = new Map<string, PivotedData>();
    labReports.forEach((item) => {
      const key = `${item.TestID}-${item.ComponentID}`;
      const date = item.Result_date_time?.split("T")[0] || "-";
      if (!mapPivot.has(key)) mapPivot.set(key, { TestID: item.TestID, Heading: item.Heading, ComponentID: item.ComponentID, NormalRange: item.NormalRange });
      mapPivot.get(key)![date] = item.Result || "-";
    });
    mapPivot.forEach((row) => pivoted.push(row));
    const grouped: { [testID: string]: PivotedData[] } = {};
    pivoted.forEach((row) => { if (!grouped[row.TestID]) grouped[row.TestID] = []; grouped[row.TestID].push(row); });

    return (
      <GestureHandlerRootView>
        <PinchGestureHandler onGestureEvent={(e) => { let s = e.nativeEvent.scale; if (s < 0.8) s = 0.8; if (s > 2) s = 2; setScale(s); }}>
          <ScrollView horizontal style={{ marginBottom: 20 }}>
            <View style={{ minWidth: 800 }}>
              <ScrollView style={{ maxHeight: height - 200 }}>
                <View style={{ transform: [{ scale }] }}>
                  <View style={[styles.row, styles.headerRow]}>
                    <Text style={[styles.cell, styles.headerCell, { width: 80 }]}>Test ID</Text>
                    <Text style={[styles.cell, styles.headerCell, { width: 110 }]}>Heading</Text>
                    <Text style={[styles.cell, styles.headerCell, { width: 110 }]}>Component</Text>
                    <Text style={[styles.cell, styles.headerCell, { width: 150 }]}>Normal Range</Text>
                    {uniqueDates.map((date) => <Text key={date} style={[styles.cell, styles.headerCell, { width: 120 }]}>{date}</Text>)}
                  </View>
                  {Object.entries(grouped).map(([testID, rows]) => rows.map((row, idx) => (
                    <View key={`${testID}-${idx}`} style={styles.row}>
                      {idx === 0 ? <View style={[styles.cellBox, { width: 80, backgroundColor: "#f9f9f9" }]}><Text style={{ fontSize: 12, fontWeight: "600", textAlign: "center" }}>{testID}</Text></View> : <View style={[styles.cellBox, { width: 80 }]} />}
                      <Text style={[styles.cell, { width: 110 }]}>{row.Heading}</Text>
                      <Text style={[styles.cell, { width: 110 }]}>{row.ComponentID}</Text>
                      <Text style={[styles.cell, { width: 150 }]}>{row.NormalRange}</Text>
                      {uniqueDates.map((date) => <Text key={`${testID}-${idx}-${date}`} style={[styles.cell, { width: 120 }]}>{row[date] || "-"}</Text>)}
                    </View>
                  )))}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </PinchGestureHandler>
      </GestureHandlerRootView>
    );
  };

  const renderModalContent = () => {
    if (!selectedPatient || !modalType) return null;
    if (modalLoading) return <ActivityIndicator size="large" color="#00A652" style={{ marginTop: 20 }} />;
    return (
      <ScrollView style={{ maxHeight: "90%" }}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <Image source={selectedPatient.GENDER === "Female" ? femaleImg : avatarImg} style={{ width: 80, height: 80, borderRadius: 40 }} />
          <Text style={{ fontWeight: "700", fontSize: 18, marginTop: 6 }}>{selectedPatient.PATIENT_FNAME} {selectedPatient.PATIENT_LNAME || ""}</Text>
          <Text style={{ color: "#666" }}>MR: {selectedPatient.PMR_NO}</Text>
          <Text style={{ color: "#666" }}>ID: {selectedPatient.PATIENT_ID}</Text>
        </View>
        <View style={styles.tabRow}>
          {["notes", "lab", "radiology"].map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tabButton, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab as any)}>
              <Text style={[styles.tabText, activeTab === tab && { color: "#fff", fontWeight: "700" }]}>{tab === "notes" ? "Notes" : tab === "lab" ? "Lab Reports" : "Radiology"}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ marginTop: 12 }}>
          {activeTab === "notes" && (notes.length ? notes.map((note) => <View key={note.Loc_ID} style={styles.card}><Text style={{ fontWeight: "600" }}>Date: {note.loc_ex_date?.split("T")[0]}</Text><Text>{note.LocalExamination}</Text></View>) : <Text>No notes available.</Text>)}
          {activeTab === "lab" && renderLabTab()}
          {activeTab === "radiology" && (radiologyReports.length ? radiologyReports.map((rad) => <View key={rad.id} style={styles.card}><Text>PMR No: {rad.pmr_no}</Text><Text>Status: {rad.status}</Text><Text>X-Ray: {rad.xray_status}</Text><Text>CT: {rad.ct_status}</Text><Text>Priority: {rad.priority}</Text><Text>Modality: {rad.modality}</Text><Text>Region: {rad.mod_region}</Text><Text>Request Time: {rad.request_time}</Text><Text>History: {rad.short_history}</Text></View>) : <Text>No radiology reports available.</Text>)}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", marginHorizontal: 12, marginTop: 8, zIndex: 1000 }}>
        <View style={{ flex: 1, marginRight: 6 }}>
          <DropDownPicker open={branchOpen} value={branch} items={branchItemsState} setOpen={setBranchOpen} setValue={setBranch} setItems={setBranchItemsState} placeholder="Select Branch" style={{ borderColor: "#ccc" }} dropDownContainerStyle={{ borderColor: "#ccc" }} />
        </View>
        <View style={{ flex: 1 }}>
          <DropDownPicker open={wardOpen} value={ward} items={wardItemsState} setOpen={setWardOpen} setValue={setWard} setItems={setWardItemsState} placeholder="Select Ward" style={{ borderColor: "#ccc" }} dropDownContainerStyle={{ borderColor: "#ccc" }} />
        </View>
      </View>

      <TextInput style={styles.searchInput} placeholder="Search patient..." value={searchQuery} onChangeText={setSearchQuery} />
      {loading && page === 1 ? <ActivityIndicator size="large" color="#00A652" style={{ marginTop: 50 }} /> : <FlatList data={filteredPatients} keyExtractor={(item) => String(item.ADM_REQ_ID ?? item.PATIENT_ID)} renderItem={renderPatient} onEndReached={loadMore} onEndReachedThreshold={0.5} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} />}

      <Modal isVisible={!!selectedPatient} onBackdropPress={closeModal} onBackButtonPress={closeModal} style={{ justifyContent: "center", margin: 16 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16, maxHeight: "90%" }}>{renderModalContent()}</View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  searchInput: { backgroundColor: "#fff", margin: 12, borderRadius: 8, paddingHorizontal: 12, height: 40, borderWidth: 1, borderColor: "#ccc" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginHorizontal: 12, marginVertical: 6 },
  button: { flexDirection: "row", backgroundColor: "#00A652", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, alignItems: "center", marginHorizontal: 4 },
  buttonText: { color: "#fff", fontWeight: "600", marginLeft: 4 },
  tabRow: { flexDirection: "row", marginBottom: 8 },
  tabButton: { flex: 1, padding: 8, borderWidth: 1, borderColor: "#00A652", borderRadius: 8, marginHorizontal: 4, alignItems: "center" },
  tabActive: { backgroundColor: "#00A652" },
  tabText: { color: "#00A652", fontWeight: "600" },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ddd" },
  headerRow: { backgroundColor: "#00A652", borderBottomWidth: 1 },
  cell: { paddingVertical: 6, paddingHorizontal: 6, fontSize: 12, textAlign: "center", color: "#000", borderRightWidth: 1, borderColor: "#ddd" },
  cellBox: { justifyContent: "center", alignItems: "center", borderRightWidth: 1, borderColor: "#ddd" },
  headerCell: { fontWeight: "bold", fontSize: 12, color: "#fff" },
});
