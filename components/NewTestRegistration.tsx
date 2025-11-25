import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../ctx/theme";

type Props = {
  patient: {
    id: number;
    name: string;
    gender?: string;
  };
  branch: string;
};

type TestResult = {
  id: string | number;
  TestID: string | number;
  TestTitle: string;
  Specimun?: string | number;
};

type PreviewRow = {
  TestID: string | number;
  TestTitle?: string;
  Pkod_detail?: string;
  Barcode_no?: string;
  Specimun?: string | number;
};

type ThemePalette = ReturnType<typeof useTheme>["palette"];

export default function NewTestRegistration({ patient, branch }: Props) {
  const { isDarkMode, palette } = useTheme();
  const styles = useMemo(() => createStyles(palette, isDarkMode), [palette, isDarkMode]);
  const [form] = useState({
    branch,
    Patient_ID: String(patient.id),
    PatientName: patient.name,
    Gender: patient.gender || "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedTests, setSelectedTests] = useState<PreviewRow[]>([]);
  const [latestOrder, setLatestOrder] = useState<any>(null);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [prefixCounter, setPrefixCounter] = useState<number>(0);

  const scrollRef = useRef<ScrollView | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const API_BASE = "http://192.168.100.162:3000";
  const DEBOUNCE = 250;

  async function fetchJsonSafe(url: string, opts?: RequestInit) {
    const res = await fetch(url, opts);
    const text = await res.text();
    return JSON.parse(text);
  }

  // ✅ Fetch latest order
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await fetchJsonSafe(
          `${API_BASE}/latest-order?branch=${branch}`
        );
        const latest = data.latestOrder ?? data;
        if (mounted && latest) {
          setLatestOrder(latest);
          setPrefixCounter(Number(latest.Barcode_no.slice(0, -2)));
        }
      } catch {}
    }
    load();
    const intv = setInterval(load, 8000);
    return () => {
      mounted = false;
      clearInterval(intv);
    };
  }, [branch]);

  // 🔍 Live Test Search (FIXED CLEANUP)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const data = await fetchJsonSafe(
        `${API_BASE}/test-list?branch=${branch}&search=${searchQuery}`
      );

      setTestResults(Array.isArray(data) ? data : []);
      setShowDropdown(Array.isArray(data) && data.length > 0);
    }, DEBOUNCE);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, branch]);

  // ✅ Add Test
  function handleSelectTest(item: TestResult) {
    const id = String(item.TestID);
    if (selectedTests.some((t) => t.TestID === id)) return;

    setPrefixCounter((prev) => {
      const newPrefix = prev + 1;
      const spec = String(item.Specimun ?? "01").padStart(2, "0");

      setSelectedTests((p) => [
        ...p,
        {
          TestID: id,
          TestTitle: item.TestTitle,
          Specimun: spec,
          Barcode_no: String(newPrefix).padStart(8, "0") + spec,
          Pkod_detail: `PK${String(newPrefix).padStart(5, "0")}`,
        },
      ]);

      return newPrefix;
    });

    setSearchQuery("");
    setShowDropdown(false);
  }

  // ❌ Remove Test
  function handleRemoveTest(id: string | number) {
    setSelectedTests((p) => p.filter((t) => t.TestID !== id));
  }

  // ✅ Register Tests
  const handleSubmit = async () => {
    if (!selectedTests.length)
      return Alert.alert("Missing", "Select at least one test.");

    if (!latestOrder || !latestOrder.Order_Id)
      return Alert.alert("Error", "Latest order not loaded yet.");

    setLoadingRegister(true);

    const newOrderId = Number(latestOrder.Order_Id) + 1;

    try {
      const res = await fetchJsonSafe(`${API_BASE}/book-tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch,
          Order_Id: newOrderId,
          Patient_ID: form.Patient_ID,
          tests: selectedTests,
        }),
      });

      if (res.success) {
        Alert.alert("✅ Success", `Order #${newOrderId} registered`);
        setSelectedTests([]);
        setLatestOrder((p: any) => ({ ...p, Order_Id: newOrderId }));
      } else {
        Alert.alert("Error", res.error);
      }
    } catch {
      Alert.alert("Network Error", "Unable to reach server.");
    }

    setLoadingRegister(false);
  };

  const renderDeleteAction = (onPress: () => void) => (
    <View style={styles.deleteSwipeBox}>
      <TouchableOpacity onPress={onPress}>
        <Text style={styles.deleteSwipeText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <TouchableWithoutFeedback onPress={() => setShowDropdown(false)}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
            <Text style={styles.title}>New Test Registration</Text>

            <TextInput
              style={styles.input}
              placeholder="Search test..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            {showDropdown && (
              <View style={styles.dropdown}>
                {testResults.map((item) => (
                  <TouchableOpacity
                    key={String(item.TestID)}
                    style={styles.dropdownItem}
                    onPress={() => handleSelectTest(item)}
                  >
                    <Text>
                      {item.TestID} - {item.TestTitle}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* ✅ Simplified 3-Column Table */}
            <View style={styles.tableBox}>
              <Text style={styles.tableTitle}>Selected Tests</Text>

              <View style={styles.tableHeader}>
                <Text style={[styles.cellHeader, { width: 50 }]}>S.No</Text>
                <Text style={[styles.cellHeader, { flex: 1 }]}>TestID</Text>
                <Text style={[styles.cellHeader, { flex: 2 }]}>Test Title</Text>
                <Text style={[styles.cellHeader, { width: 40 }]}></Text>
              </View>

              {selectedTests.map((r, index) => (
                <Swipeable
                  key={String(r.TestID)}
                  renderRightActions={() =>
                    renderDeleteAction(() => handleRemoveTest(r.TestID))
                  }
                >
                  <View style={styles.tableRow}>
                    <Text style={[styles.cellText, { width: 50 }]}>
                      {index + 1}
                    </Text>
                    <Text style={[styles.cellText, { flex: 1 }]}>
                      {r.TestID}
                    </Text>
                    <Text style={[styles.cellText, { flex: 2 }]}>
                      {r.TestTitle}
                    </Text>
                    <TouchableOpacity
                      style={styles.deleteCell}
                      onPress={() => handleRemoveTest(r.TestID)}
                    >
                      <Text style={styles.deleteX}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </Swipeable>
              ))}
            </View>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSubmit}
              disabled={loadingRegister}
            >
              <Text style={styles.saveBtnText}>
                {loadingRegister ? "Saving..." : "Register Tests"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const createStyles = (palette: ThemePalette, isDarkMode: boolean) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: palette.background ?? "#fff" },
    container: { padding: 20, paddingBottom: 80 },
    title: {
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 12,
      color: palette.text ?? "#111",
    },
    input: {
      borderWidth: 1,
      borderColor: palette.border ?? "#ccc",
      borderRadius: 6,
      padding: 10,
      backgroundColor: palette.surface ?? "#fafafa",
      color: palette.text ?? "#111",
    },
    dropdown: {
      borderWidth: 1,
      borderColor: palette.border ?? "#ddd",
      backgroundColor: palette.card ?? "#fff",
    },
    dropdownItem: { padding: 10 },

    tableBox: {
      marginTop: 14,
      borderWidth: 1.5,
      borderColor: palette.primary ?? "#00A652",
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: palette.card ?? "#fff",
    },
    tableTitle: {
      backgroundColor: palette.primary ?? "#00A652",
      color: "#fff",
      fontWeight: "700",
      paddingVertical: 10,
      textAlign: "center",
      fontSize: 15,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: isDarkMode ? "rgba(16,185,129,0.15)" : "#caffda",
      borderBottomWidth: 1,
      borderColor: palette.primary ?? "#00A652",
    },
    cellHeader: {
      textAlign: "center",
      fontWeight: "700",
      fontSize: 13,
      paddingVertical: 6,
      color: palette.primary ?? "#006600",
    },
    tableRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      paddingHorizontal: 4,
      backgroundColor: isDarkMode ? "#0d0d0d" : "#f9fff9",
    },
    cellText: {
      textAlign: "center",
      fontSize: 14,
      color: palette.text ?? "#000",
      paddingVertical: 4,
    },
    deleteCell: { width: 40, alignItems: "center" },
    deleteX: { color: "#ef4444", fontWeight: "700", fontSize: 18 },
    deleteSwipeBox: {
      backgroundColor: "#ef4444",
      justifyContent: "center",
      alignItems: "center",
      width: 80,
    },
    deleteSwipeText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    saveBtn: {
      marginTop: 20,
      backgroundColor: palette.primary ?? "#00A652",
      padding: 14,
      borderRadius: 8,
      alignItems: "center",
    },
    saveBtnText: { color: "#fff", fontWeight: "700" },
  });
