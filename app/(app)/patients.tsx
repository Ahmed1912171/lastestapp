import AIChatModal from "@/components/AIChatModal";
import LabTable from "@/components/LabTable";
import PharmacyTable from "@/components/PharmacyTable";
import axios from "axios";
import { Bot, FileText, Send } from "lucide-react-native";
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import Modal from "react-native-modal";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

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
  created_at: ReactNode;
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
  [date: string]: string;
};

const wardMap: Record<number, string> = {
  921: "PICU",
  1116: "NICU",
  1119: "GP",
};

const TABS = ["notes", "lab", "radiology", "pharmacy"] as const;
type TabType = (typeof TABS)[number];

export default function PatientsScreen() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [labReports, setLabReports] = useState<LabResult[]>([]);
  const [radiologyReports, setRadiologyReports] = useState<Radiology[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [messageText, setMessageText] = useState("");
  // AI Chat Modal State
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiPatientId, setAiPatientId] = useState<number | null>(null);

  const LOCAL_IP = "192.168.100.116";
  const API_BASE =
    Platform.OS === "android"
      ? "http://10.0.2.2:3000"
      : `http://${LOCAL_IP}:3000`;

  const [branch, setBranch] = useState("Korangi");
  const [ward, setWard] = useState("PICU");
  const [branchOpen, setBranchOpen] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  const [branchItemsState, setBranchItemsState] = useState([
    { label: "Korangi", value: "Korangi" },
  ]);
  const [wardItemsState, setWardItemsState] = useState([
    { label: "PICU", value: "PICU" },
    { label: "NICU", value: "NICU" },
    { label: "GP", value: "GP" },
  ]);

  const webviewRef = useRef<WebView>(null);
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
    Dimensions.get("window");
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingWeb, setLoadingWeb] = useState(false);

  const fetchPatients = useCallback(
    async (pageNum: number = 1, query: string = "") => {
      try {
        if (pageNum === 1) setLoading(true);
        const res = await axios.get(`${API_BASE}/patients_all`, {
          params: { page: pageNum, limit: 20, search: query },
        });
        const data: Patient[] = res.data || [];
        if (pageNum === 1) setPatients(data);
        else
          setPatients((prev) => {
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
    [API_BASE]
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

  const filteredPatients = patients.filter((p) => {
    const wardName = p.WARD_ID ? wardMap[p.WARD_ID] : null;
    return !ward || wardName === ward;
  });

  const openModal = async (patient: Patient, type: TabType) => {
    setSelectedPatient(patient);
    setActiveTab(type);
    setModalLoading(true);
    try {
      if (type === "notes")
        setNotes(
          (await axios.get(`${API_BASE}/patients/${patient.PATIENT_ID}/notes`))
            .data
        );
      if (type === "lab")
        setLabReports(
          (await axios.get(`${API_BASE}/patients/${patient.PATIENT_ID}/lab`))
            .data
        );
      if (type === "radiology")
        setRadiologyReports(
          (
            await axios.get(
              `${API_BASE}/patients/${patient.PATIENT_ID}/radiology`
            )
          ).data
        );
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
      setScale(1);
      setModalVisible(true);
    }
  };

  const closeModal = () => {
    setSelectedPatient(null);
    setNotes([]);
    setLabReports([]);
    setRadiologyReports([]);
    setMessageText("");
    setModalVisible(false);
    setScale(1);
  };

  const handleSend = async () => {
    if (!messageText.trim() || !selectedPatient) return;
    try {
      const res = await axios.post(
        `${API_BASE}/patients/${selectedPatient.PATIENT_ID}/notes`,
        {
          LocalExamination: messageText.trim(),
        }
      );
      const newNote: Note = {
        Loc_ID: res.data.insertId || Date.now(),
        LocalExamination: messageText.trim(),
        loc_ex_date: new Date().toISOString(),
        created_at: undefined,
      };
      setNotes((prev) => [newNote, ...prev]);
      setMessageText("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleTabChange = async (tab: TabType) => {
    if (!selectedPatient) return;
    setActiveTab(tab);
    setModalLoading(true);
    try {
      if (tab === "notes")
        setNotes(
          (
            await axios.get(
              `${API_BASE}/patients/${selectedPatient.PATIENT_ID}/notes`
            )
          ).data
        );
      if (tab === "lab")
        setLabReports(
          (
            await axios.get(
              `${API_BASE}/patients/${selectedPatient.PATIENT_ID}/lab`
            )
          ).data
        );
      if (tab === "radiology")
        setRadiologyReports(
          (
            await axios.get(
              `${API_BASE}/patients/${selectedPatient.PATIENT_ID}/radiology`
            )
          ).data
        );
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
      setScale(1);
    }
  };

  const renderModalContent = () => {
    if (!selectedPatient) return null;
    if (modalLoading)
      return (
        <ActivityIndicator
          size="large"
          color="#00A652"
          style={{ marginTop: 20 }}
        />
      );

    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
      Dimensions.get("window");

    const injectedJS = `
      (function() {
        var meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        meta.setAttribute('content', 'width=${SCREEN_WIDTH * 0.9}, height=${SCREEN_HEIGHT * 0.7}, initial-scale=2.0, maximum-scale=5.0, user-scalable=yes');
        document.getElementsByTagName('head')[0].appendChild(meta);
      })();
      true;
    `;

    return (
      <View>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <Image
            source={selectedPatient.GENDER === "Female" ? femaleImg : avatarImg}
            style={{ width: 80, height: 80, borderRadius: 40 }}
          />
          <Text style={{ fontWeight: "700", fontSize: 18, marginTop: 6 }}>
            {selectedPatient.PATIENT_FNAME}{" "}
            {selectedPatient.PATIENT_LNAME || ""}
          </Text>
          <Text style={{ color: "#666" }}>MR: {selectedPatient.PMR_NO}</Text>
          <Text style={{ color: "#666" }}>
            ID: {selectedPatient.PATIENT_ID}
          </Text>
        </View>

        {/* Tabs Inside Modal */}
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabButton, activeTab === tab && styles.tabActive]}
              onPress={() => handleTabChange(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && { color: "#fff", fontWeight: "700" },
                ]}
              >
                {tab === "notes"
                  ? "Notes"
                  : tab === "lab"
                    ? "Lab"
                    : tab === "radiology"
                      ? "Radiology"
                      : "Pharmacy"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        <View style={{ marginTop: 12 }}>
          {activeTab === "notes" &&
            (notes.length ? (
              <ScrollView style={{ paddingHorizontal: 10, marginTop: 10 }}>
                {notes
                  .slice()
                  .reverse()
                  .map((note, index) => {
                    const isEven = index % 2 === 0;
                    const createdAtStr = note.created_at
                      ? String(note.created_at)
                      : "";
                    return (
                      <View
                        key={note.Loc_ID}
                        style={{
                          marginVertical: 6,
                          alignSelf: isEven ? "flex-start" : "flex-end",
                          maxWidth: "75%",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: isEven ? "#e5e5ea" : "#00A652",
                            paddingVertical: 10,
                            paddingHorizontal: 14,
                            borderRadius: 20,
                            borderTopLeftRadius: isEven ? 0 : 20,
                            borderTopRightRadius: isEven ? 20 : 0,
                          }}
                        >
                          <Text
                            style={{
                              color: isEven ? "#000" : "#fff",
                              fontSize: 14,
                              lineHeight: 20,
                            }}
                          >
                            {note.LocalExamination}
                          </Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 10,
                            color: "#999",
                            marginTop: 2,
                            textAlign: isEven ? "left" : "right",
                          }}
                        >
                          {createdAtStr
                            ? new Date(createdAtStr).toLocaleString()
                            : ""}
                        </Text>
                      </View>
                    );
                  })}
              </ScrollView>
            ) : (
              <Text style={{ textAlign: "center", marginTop: 20 }}>
                No notes available.
              </Text>
            ))}

          {activeTab === "lab" && selectedPatient && (
            <LabTable patientId={String(selectedPatient.PATIENT_ID)} />
          )}

          {activeTab === "radiology" && selectedPatient && (
            <View style={{ height: SCREEN_HEIGHT * 0.7 }}>
              <WebView
                ref={webviewRef}
                source={{
                  uri: `http://103.140.31.132:8080/chk/oviyam?patientID=${selectedPatient.PMR_NO}`,
                }}
                style={{ flex: 1, borderRadius: 12 }}
                javaScriptEnabled
                domStorageEnabled
                injectedJavaScript={injectedJS}
                startInLoadingState
                onLoadStart={() => setLoadingWeb(true)}
                onLoadEnd={() => setLoadingWeb(false)}
              />
            </View>
          )}

          {activeTab === "pharmacy" && selectedPatient && (
            <PharmacyTable patientId={String(selectedPatient.PATIENT_ID)} />
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Branch / Ward Pickers */}
      <View
        style={{
          flexDirection: "row",
          marginHorizontal: 12,
          marginTop: 8,
          zIndex: 1000,
        }}
      >
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
            zIndex={5000}
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
            zIndex={4000}
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
        <ActivityIndicator
          size="large"
          color="#00A652"
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={filteredPatients}
          keyExtractor={(item) => String(item.ADM_REQ_ID ?? item.PATIENT_ID)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              {/* 🔹 AI Icon - Top Right */}
              <TouchableOpacity
                style={styles.aiIcon}
                onPress={() => {
                  setAiPatientId(item.PATIENT_ID); // store patient ID
                  setAiModalVisible(true); // open AI modal
                }}
              >
                <Bot size={20} color="#00A652" />
              </TouchableOpacity>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Image
                  source={item.GENDER === "Female" ? femaleImg : avatarImg}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
                <View style={{ marginLeft: 8 }}>
                  <Text style={{ fontWeight: "600" }}>
                    {item.PATIENT_FNAME} {item.PATIENT_LNAME || ""}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#666" }}>
                    MR: {item.PMR_NO}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#666" }}>
                    ID: {item.PATIENT_ID}
                  </Text>
                </View>
              </View>

              {/* Existing Tabs */}
              <View style={styles.tabContainer}>
                {TABS.map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => openModal(item, tab)}
                    style={styles.cardButton}
                  >
                    <FileText size={16} color="#fff" />
                    <Text style={styles.buttonText}>
                      {tab === "notes"
                        ? "Notes"
                        : tab === "lab"
                          ? "Lab"
                          : tab === "radiology"
                            ? "Radiology"
                            : "Pharmacy"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Modal
          isVisible={!!selectedPatient}
          onBackdropPress={closeModal}
          onBackButtonPress={closeModal}
          avoidKeyboard
          style={{ justifyContent: "center", margin: 16 }}
        >
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 16,
              maxHeight: "85%",
            }}
          >
            {/* ❌ Cross Button */}
            <TouchableOpacity
              onPress={closeModal}
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 999,
                padding: 6,
              }}
            >
              <Text style={{ fontSize: 20, color: "#999" }}>✕</Text>
              {/* You can replace ✕ with an icon, e.g., from lucide-react-native */}
              {/* <X size={22} color="#999" /> */}
            </TouchableOpacity>

            <ScrollView style={{ marginTop: 10 }}>
              {renderModalContent()}
            </ScrollView>

            {activeTab === "notes" && (
              <View style={styles.messageBox}>
                <TextInput
                  style={styles.messageInput}
                  placeholder="Write note..."
                  value={messageText}
                  onChangeText={setMessageText}
                />
                <TouchableOpacity
                  onPress={handleSend}
                  style={styles.sendButton}
                >
                  <Send size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
      <AIChatModal
        visible={aiModalVisible}
        onClose={() => setAiModalVisible(false)}
        patientId={aiPatientId}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  searchInput: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderColor: "#ccc",
    borderWidth: 1,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cardButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00A652",
    borderRadius: 8,
    paddingVertical: 8,
    marginHorizontal: 2,
  },
  buttonText: { color: "#fff", fontSize: 12, marginLeft: 4 },
  tabRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#e5e5ea",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#00A652",
  },
  tabText: {
    fontSize: 13,
    color: "#333",
  },
  messageBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f5f5f5",
  },
  sendButton: {
    backgroundColor: "#00A652",
    padding: 10,
    borderRadius: 8,
    marginLeft: 6,
  },
  aiIcon: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 4,
    elevation: 2,
  },
});
