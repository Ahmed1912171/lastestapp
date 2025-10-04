import axios from "axios";
import { useRouter } from "expo-router";
import { Search } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ✅ Patient type
type Patient = {
  GENDER: string;
  PMR_NO: string;
  PATIENT_LNAME: string;
  EMERGENCY_STATUS: number;
  PATIENT_ID: number | null;
  PATIENT_FNAME: string;
};


export default function SearchScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // 🔹 Fetch results from backend
  const fetchResults = useCallback(async (query: string, pageNumber: number = 1) => {
    if (!query) {
      setPatients([]);
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get<Patient[]>(
        "http://192.168.100.69:3000/search",
        { params: { query, page: pageNumber, limit: 50 } }
      );

      if (pageNumber === 1) setPatients(res.data);
      else setPatients(prev => [...prev, ...res.data]);
    } catch (err) {
      console.error("Axios Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔹 Debounced search
  const debouncedSearch = useCallback(() => {
    let timeoutId: number | undefined;
    return (text: string) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setPage(1);
        fetchResults(text, 1);
      }, 500) as unknown as number;
    };
  }, [fetchResults])();

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  // 🔹 Load more for pagination
  const loadMore = () => {
    if (!loading && patients.length) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchResults(searchQuery, nextPage);
    }
  };

  const renderPatient = ({ item }: { item: Patient }) => (
    <TouchableOpacity
  style={styles.card}
  onPress={() => {
    if (item.PATIENT_ID === null) return; // skip navigation if ID is null
    router.push({
      pathname: "/patients/[id]",
      params: { id: item.PATIENT_ID, ...item },
    });
  }}
>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image
            source={
              item.GENDER === "Female"
                ? require("../images/female.png")
                : require("../images/avatar.png")
            }
            style={styles.avatarImage}
          />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.patientName}>
              {item.PATIENT_FNAME} {item.PATIENT_LNAME || ""}
            </Text>
            <Text style={styles.patientMR}>MR#: {item.PMR_NO || "-"}</Text>
            <Text style={styles.patientMR}>ID: {item.PATIENT_ID}</Text>
          </View>
        </View>
        <View>
          <Text
            style={[
              styles.statusBadge,
              item.EMERGENCY_STATUS === 1 ? styles.critical : styles.stable,
            ]}
          >
            {item.EMERGENCY_STATUS === 1 ? "Critical" : "Stable"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search Patients</Text>
        <View style={styles.searchContainer}>
          <Search size={16} color="#454242ff" />
          <TextInput
            placeholder="Search by name, MR, ID"
            placeholderTextColor="#888"
            value={searchQuery}
            onChangeText={handleSearch}
            style={styles.searchInput}
          />
        </View>
      </View>

      {loading && <ActivityIndicator size="large" color="#0000ff" style={{ marginTop: 10 }} />}

      <FlatList
        data={patients}
        keyExtractor={(item) => item.PATIENT_ID?.toString() || Math.random().toString()}
        renderItem={renderPatient}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          !loading ? <Text style={styles.noResults}>No results found</Text> : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#ddd" },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  searchInput: { flex: 1, paddingVertical: 6, paddingHorizontal: 8 },

  card: {
    backgroundColor: "#fff",
    margin: 8,
    borderRadius: 10,
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  patientName: { fontWeight: "600" },
  patientMR: { color: "#666", fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 10,
    textAlign: "center",
  },
  stable: { backgroundColor: "#bbf7d0", color: "#00A652" },
  critical: { backgroundColor: "#fecaca", color: "#991b1b" },
  noResults: { textAlign: "center", marginTop: 20, fontSize: 16, color: "#999" },
});
