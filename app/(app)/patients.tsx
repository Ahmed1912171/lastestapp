import AIChatModal from "@/components/AIChatModal";
import LabTable from "@/components/LabTable";
import NewTestRegistration from "@/components/NewTestRegistration";
import PharmacyTable from "@/components/PharmacyTable";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { Bot, ClipboardList, FileText, Send } from "lucide-react-native";
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

import Results from "@/components/Results";
import {
    Pill,
    PlusCircle,
    ScanText,
    TestTubeDiagonal,
} from "lucide-react-native";

const TAB_ICONS: Record<
  TabType,
  React.ComponentType<{ size: number; color: string }>
> = {
  notes: FileText,
  lab: TestTubeDiagonal,
  radiology: ScanText,
  pharmacy: Pill,
  newtest: PlusCircle,
  results: ClipboardList,
};

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
  // any other columns that come from backend are OK
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

const TABS = [
  "notes",
  "lab",
  "radiology",
  "pharmacy",
  "newtest",
  "results",
] as const;

type TabType = (typeof TABS)[number];

export default function PatientsScreen() {
  // ---------- data + UI state ----------
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false); // initial page loader
  const [loadingMore, setLoadingMore] = useState(false); // footer loader
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState(""); // for debounce
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [labReports, setLabReports] = useState<LabResult[]>([]);
  const [radiologyReports, setRadiologyReports] = useState<Radiology[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [scale, setScale] = useState(1);
  const [messageText, setMessageText] = useState("");
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiPatientId, setAiPatientId] = useState<number | null>(null);

  // ---------- network / config ----------
  const LOCAL_IP = "192.168.100.93";
  const API_BASE =
    Platform.OS === "android"
      ? "http://10.0.2.2:3000"
      : `http://${LOCAL_IP}:3000`;

  // ---------- branch/ward pickers ----------
  // NOTE: backend expects branch keys lowercase (korangi, azambasti, etc.).
  const [branch, setBranch] = useState("korangi");
  const [ward, setWard] = useState("");
  const [branchOpen, setBranchOpen] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  const [branchItemsState, setBranchItemsState] = useState<
    { label: string; value: string }[]
  >([{ label: "Korangi", value: "korangi" }]);
  const [wardItemsState, setWardItemsState] = useState<
    { label: string; value: string }[]
  >([{ label: "PICU", value: "PICU" }]);

  const branchWardCacheRef = useRef<Record<string, string[]>>({}); // cache fetched branch->wards

  const webviewRef = useRef<WebView>(null);
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
    Dimensions.get("window");
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingWeb, setLoadingWeb] = useState(false);

  // ---------- Debounce search (300ms) ----------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ---------- Fetch branch & wards on mount ----------
  useEffect(() => {
    const fetchBranchWardData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/all_branch_wards`);
        const data = res.data || {};

        // Normalize branch keys to lower-case values for value, label friendly
        const branches = Object.keys(data).map((b) => ({
          label: b.charAt(0).toUpperCase() + b.slice(1),
          value: b.toLowerCase(),
        }));

        setBranchItemsState(branches);

        // cache full structure
        branchWardCacheRef.current = Object.keys(data).reduce(
          (acc, key) => ({ ...acc, [key.toLowerCase()]: data[key] }),
          {}
        );

        // set defaults: first branch, first ward of that branch
        const defaultBranch = branches[0]?.value || "korangi";
        setBranch(defaultBranch);

        const wardsForDefault = (branchWardCacheRef.current[defaultBranch] ||
          []) as string[];
        const wardList = wardsForDefault.map((w) => ({ label: w, value: w }));
        setWardItemsState(wardList);
        setWard(wardList[0]?.value || "");
      } catch (err) {
        console.error("Error fetching branch/ward data:", err);
      }
    };

    fetchBranchWardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_BASE]);

  // ---------- Helper: update wards when branch changes ----------
  const handleBranchChange = async (newBranch: string) => {
    // newBranch expected lowercase key (e.g., 'azambasti')
    setBranch(newBranch);
    const cached = branchWardCacheRef.current[newBranch];
    if (cached) {
      const items = cached.map((w) => ({ label: w, value: w }));
      setWardItemsState(items);
      setWard(items[0]?.value || "");
      return;
    }

    try {
      // fallback: re-fetch all branch-wards and update cache
      const res = await axios.get(`${API_BASE}/all_branch_wards`);
      const data = res.data || {};
      branchWardCacheRef.current = Object.keys(data).reduce(
        (acc, key) => ({ ...acc, [key.toLowerCase()]: data[key] }),
        {}
      );
      const wardsForBranch = branchWardCacheRef.current[newBranch] || [];
      const items = wardsForBranch.map((w: string) => ({ label: w, value: w }));
      setWardItemsState(items);
      setWard(items[0]?.value || "");
    } catch (e) {
      console.error("Error updating ward list:", e);
      setWardItemsState([]);
      setWard("");
    }
  };

  // ---------- Pagination + fetch logic ----------
  const fetchPatients = useCallback(
    async (p: number = 1, reset = false) => {
      // requires branch & ward
      if (!branch || !ward) {
        setPatients([]);
        setHasMore(false);
        return;
      }

      try {
        if (p === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        const res = await axios.get(`${API_BASE}/patients_by_branch_ward`, {
          params: {
            branch: branch.toLowerCase(),
            ward,
            page: p,
            limit: 50,
            search: debouncedQuery || undefined, // include search only when present
          },
        });

        const data: Patient[] = res.data.patients || [];
        const respPage = res.data.page || p;
        const respHasMore = !!res.data.hasMore;

        if (reset || respPage === 1) {
          setPatients(data);
        } else {
          // append while deduplicating
          setPatients((prev) => {
            const map = new Map<string | number, Patient>();
            for (const item of prev)
              map.set(item.ADM_REQ_ID ?? item.PATIENT_ID, item);
            for (const item of data)
              map.set(item.ADM_REQ_ID ?? item.PATIENT_ID, item);
            return Array.from(map.values());
          });
        }

        setPage(respPage);
        setHasMore(respHasMore);
      } catch (err) {
        console.error("Error fetching patients:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [API_BASE, branch, ward, debouncedQuery]
  );

  // initial or when branch/ward/search changes -> reset and fetch page 1
  useEffect(() => {
    if (branch && ward) {
      setPage(1);
      setHasMore(true);
      fetchPatients(1, true);
    }
  }, [branch, ward, debouncedQuery, fetchPatients]);

  const loadMore = () => {
    if (loading || loadingMore || !hasMore) return;
    const next = page + 1;
    fetchPatients(next, false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchPatients(1, true);
  };

  // ---------- modal & tab helpers (unchanged) ----------
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
        <View style={styles.tabContainer}>
          {TABS.map((tab) => {
            const Icon = TAB_ICONS[tab]; // pick icon from mapping
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => handleTabChange(tab)}
                style={[
                  styles.cardButton,
                  activeTab === tab && { opacity: 0.8 },
                ]}
              >
                <Icon size={16} color="#fff" />
                <Text style={styles.buttonText}>
                  {tab === "notes"
                    ? "Notes"
                    : tab === "lab"
                      ? "Lab"
                      : tab === "radiology"
                        ? "Radiology"
                        : tab === "pharmacy"
                          ? "Pharmacy"
                          : tab === "newtest"
                            ? "New Test"
                            : tab === "results"
                              ? "Results"
                              : ""}
                </Text>
              </TouchableOpacity>
            );
          })}
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

          {activeTab === "newtest" && selectedPatient && (
            <NewTestRegistration
              patient={{
                id: selectedPatient.PATIENT_ID,
                name: `${selectedPatient.PATIENT_FNAME} ${selectedPatient.PATIENT_LNAME || ""}`,
                gender: selectedPatient.GENDER,
              }}
              branch={branch}
            />
          )}

          {activeTab === "results" && selectedPatient && (
            <Results
              tests={["Hemoglobin", "WBC", "Platelets"]}
              onSave={(values) => {
                console.log("Saved Values:", values);
                // TODO: call API here later
              }}
            />
          )}
        </View>
      </View>
    );
  };

  // ---------- Render ----------
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
            // call custom handler to update wards
            setValue={(fn) => {
              const value = typeof fn === "function" ? fn(branch) : fn;
              // ensure lowered value
              handleBranchChange(String(value).toLowerCase());
            }}
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

      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search patient..."
          value={searchQuery}
          onChangeText={(text) => setSearchQuery(text)}
        />

        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={{
              position: "absolute",
              right: 10,
              padding: 4,
            }}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {loading && page === 1 ? (
        <ActivityIndicator
          size="large"
          color="#00A652"
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={patients}
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
                {TABS.map((tab) => {
                  const Icon = TAB_ICONS[tab]; // pick icon from mapping
                  return (
                    <TouchableOpacity
                      key={tab}
                      onPress={() => openModal(item, tab)}
                      style={styles.cardButton}
                    >
                      <Icon size={16} color="#fff" />
                      <Text style={styles.buttonText}>
                        {tab === "notes"
                          ? "Notes"
                          : tab === "lab"
                            ? "Lab"
                            : tab === "radiology"
                              ? "Radiology"
                              : tab === "pharmacy"
                                ? "Pharmacy"
                                : tab === "newtest"
                                  ? "New Test"
                                  : tab === "results"
                                    ? "Results"
                                    : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListFooterComponent={() =>
            loadingMore ? (
              <View style={{ padding: 12 }}>
                <ActivityIndicator size="small" color="#00A652" />
              </View>
            ) : null
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
    flexWrap: "wrap", // allows wrapping on smaller screens
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginVertical: 8,
  },

  // cardButton: {
  //   flex: 1,
  //   flexDirection: "row",
  //   alignItems: "center",
  //   justifyContent: "center",
  //   backgroundColor: "#00A652",
  //   borderRadius: 8,
  //   paddingVertical: 8,
  //   marginHorizontal: 2,
  // },

  cardButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#00A652",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: 2,
    marginVertical: 2,
    minWidth: 90,
    flexShrink: 0, // ❌ prevents shrinking that causes wrapping
    flexWrap: "nowrap", // ❌ disables wrapping inside button
  },

  buttonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginLeft: 6,
    flexShrink: 1,
    flexWrap: "nowrap", // ❌ disables text wrapping
    includeFontPadding: false, // tighter vertical spacing (Android fix)
  },

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
