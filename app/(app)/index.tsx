// app/(tabs)/dashboard.tsx
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import {
    Activity,
    Bed,
    BedSingle,
    Bell,
    Hospital,
    TestTubes,
    TrendingUp,
    Users,
    Warehouse,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import AIChatModal from "../../components/AIChatModal";
import Notifications from "../../components/Notifications";
import SimpleAvatar from "../../components/SimpleAvatar";
import SimpleChart from "../../components/SimpleChart";
import { useSession } from "../../ctx";
import { useTheme } from "../../ctx/theme";

type WardData = {
  ward_id: number;
  ward_name: string;
  status: number;
};

type BranchWards = Record<
  string,
  {
    chartData: { name: string; patients: number }[];
    stats: {
      occupied: number;
      total: number;
      currentPatients: number;
      totalTreated: number;
    };
  }
>;

type BranchData = Record<string, BranchWards>;

export default function Dashboard() {
  const { session } = useSession();
  const { isDarkMode } = useTheme();
  const [branchOpen, setBranchOpen] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedWard, setSelectedWard] = useState<string>("");
  const [branches, setBranches] = useState<string[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [branchData, setBranchData] = useState<BranchData>({});
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);

  // ✅ Total Tests state
  const [testCount, setTestCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  const LOCAL_IP = "192.168.100.103";

  // ---------- Dynamic Date ----------
  useEffect(() => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    setToday(date.toLocaleDateString("en-US", options));
  }, []);

  // ---------- Fetch Total Tests ----------
  const fetchTestCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const urls = [
        "http://10.0.2.2:3000/tr_newris_request/count",
        "http://localhost:3000/tr_newris_request/count",
        `http://${LOCAL_IP}:3000/tr_newris_request/count`,
      ];

      let count: number | null = null;

      for (const url of urls) {
        try {
          const res = await axios.get(url, { timeout: 4000 });
          if (res.status === 200) {
            const data = res.data;

            // Direct number
            if (typeof data === "number") {
              count = data;
              break;
            }

            // Existing 'count' field
            if (typeof data.count === "number") {
              count = data.count;
              break;
            }

            // ✅ New: check 'total_count'
            if (typeof data.total_count === "number") {
              count = data.total_count;
              break;
            }
          }
        } catch {}
      }

      setTestCount(count ?? 0);
    } catch {
      setTestCount(0);
    } finally {
      setLoadingCount(false);
    }
  }, [LOCAL_IP]);

  // ---------- Fetch Branches ----------
  const fetchBranches = useCallback(async () => {
    try {
      const branchList = [
        "Korangi",
        "Azambasti",
        "Sobhraj",
        "Sukkur",
        "Larkana",
        "Jamshoro",
        "Sba",
        "Ho",
      ];
      setBranches(branchList);
      setSelectedBranch(branchList[0]);
    } catch (err) {
      console.error("Error fetching branches", err);
    }
  }, []);

  // ---------- Fetch Wards ----------
  const fetchWards = useCallback(
    async (branch: string) => {
      try {
        const res = await axios.get(
          `http://${LOCAL_IP}:3000/ward_beds?branch=${branch}`
        );
        const data: WardData[] = res.data;

        const newBranchWards: BranchWards = {};

        const generateChartData = () => [
          { name: "Mon", patients: Math.floor(Math.random() * 50) },
          { name: "Tue", patients: Math.floor(Math.random() * 50) },
          { name: "Wed", patients: Math.floor(Math.random() * 50) },
          { name: "Thu", patients: Math.floor(Math.random() * 50) },
          { name: "Fri", patients: Math.floor(Math.random() * 50) },
          { name: "Sat", patients: Math.floor(Math.random() * 50) },
          { name: "Sun", patients: Math.floor(Math.random() * 50) },
        ];

        data.forEach((ward) => {
          if (!newBranchWards[ward.ward_name]) {
            newBranchWards[ward.ward_name] = {
              chartData: generateChartData(),
              stats: {
                total: 0,
                occupied: 0,
                currentPatients: 0,
                totalTreated: 0,
              },
            };
          }

          newBranchWards[ward.ward_name].stats.total += 1;
          if (ward.status === 1) {
            newBranchWards[ward.ward_name].stats.occupied += 1;
            newBranchWards[ward.ward_name].stats.currentPatients += 1;
          }
        });

        Object.keys(newBranchWards).forEach((w) => {
          newBranchWards[w].stats.totalTreated =
            newBranchWards[w].stats.currentPatients;
        });

        setBranchData((prev) => ({ ...prev, [branch]: newBranchWards }));

        const wardNames = Object.keys(newBranchWards);
        setWards(wardNames);
        setSelectedWard(wardNames[0] || "");
      } catch (err) {
        console.error("Error fetching wards", err);
      }
    },
    [LOCAL_IP]
  );

  // ---------- Refresh ----------
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchBranches(), fetchTestCount()]).finally(() =>
      setRefreshing(false)
    );
  }, [fetchBranches, fetchTestCount]);

  // ---------- Update Wards when Branch changes ----------
  useEffect(() => {
    if (selectedBranch) {
      setSelectedWard("");
      fetchWards(selectedBranch);
    }
  }, [selectedBranch, fetchWards]);

  // ---------- Initial load ----------
  useEffect(() => {
    fetchBranches();
    fetchTestCount();
  }, [fetchBranches, fetchTestCount]);

  const wardData = branchData[selectedBranch]?.[selectedWard] || {
    chartData: [],
    stats: { occupied: 0, total: 0, currentPatients: 0, totalTreated: 0 },
  };

  const setBranchValue = (val: any) => {
    const v = typeof val === "function" ? val(selectedBranch) : val;
    setSelectedBranch(v);
  };
  const setWardValue = (val: any) => {
    const v = typeof val === "function" ? val(selectedWard) : val;
    setSelectedWard(v);
  };

  const userAny = session?.user as any;
  const hasNameFields =
    !!userAny && ("ADMIN_FIRST_NAME" in userAny || "ADMIN_LAST_NAME" in userAny);
  const adminFirstName = hasNameFields
    ? (userAny?.ADMIN_FIRST_NAME as string | null | undefined)
    : undefined;
  const adminLastName = hasNameFields
    ? (userAny?.ADMIN_LAST_NAME as string | null | undefined)
    : undefined;
  const grEmployer = session?.user?.GR_EMPLOYER_LOGIN?.split("-")[0] || "User";
  const greetingName = hasNameFields
    ? `${adminFirstName ?? "null"} ${adminLastName ?? "null"}`.trim()
    : grEmployer;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hello, {greetingName}!</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => setShowNotifications(true)}
              activeOpacity={0.7}
            >
              <View style={styles.bellContainer}>
                <Bell size={24} color="#333" />
                {notificationCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {notificationCount > 99 ? "99+" : notificationCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <SimpleAvatar fallback="AH" size={48} />
          </View>
        </View>

        <TouchableOpacity style={styles.fab} onPress={() => setShowAI(true)}>
          <Ionicons name="chatbubble-ellipses-outline" size={28} color="#fff" />
        </TouchableOpacity>
        <AIChatModal visible={showAI} onClose={() => setShowAI(false)} />
        <Notifications
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          onCountChange={setNotificationCount}
        />

        <View style={styles.filters}>
          <View style={[styles.dropdownContainer, { zIndex: 6000 }]}>
            <Text style={styles.dropdownLabel}>Branch</Text>
            <DropDownPicker
              open={branchOpen}
              setOpen={setBranchOpen}
              value={selectedBranch}
              setValue={setBranchValue}
              items={branches.map((b) => ({ label: b, value: b }))}
              listMode="SCROLLVIEW"
              dropDownDirection="AUTO"
              zIndex={6000}
              zIndexInverse={1000}
              theme={isDarkMode ? "DARK" : "LIGHT"}
            />
          </View>

          <View style={[styles.dropdownContainer, { zIndex: 5000 }]}>
            <Text style={styles.dropdownLabel}>Ward</Text>
            <DropDownPicker
              open={wardOpen}
              setOpen={setWardOpen}
              value={selectedWard}
              setValue={setWardValue}
              items={wards.map((w) => ({ label: w, value: w }))}
              listMode="SCROLLVIEW"
              dropDownDirection="AUTO"
              zIndex={5000}
              zIndexInverse={2000}
              theme={isDarkMode ? "DARK" : "LIGHT"}
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TrendingUp size={16} />
            <Text style={styles.cardTitle}> Patients Visited (This Week)</Text>
          </View>

          {wardData.chartData.length > 0 ? (
            <SimpleChart data={wardData.chartData} />
          ) : (
            <View
              style={{
                height: 200,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color="#00A652" />
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          {/* Branch */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View
                style={[styles.iconWrapper, { backgroundColor: "#d5e49eff" }]}
              >
                <Hospital size={20} />
              </View>
              <View>
                <Text style={styles.statLabel}>Branch</Text>
                <Text style={styles.statValue}>{selectedBranch}</Text>
              </View>
            </View>
          </View>

          {/* Ward */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View
                style={[styles.iconWrapper, { backgroundColor: "#96eba2ff" }]}
              >
                <Warehouse size={20} />
              </View>
              <View style={{ flex: 1, flexShrink: 1 }}>
                <Text style={styles.statLabel}>Ward</Text>
                <Text style={[styles.statValue, { flexWrap: "wrap" }]}>
                  {selectedWard}
                </Text>
              </View>
            </View>
          </View>

          {/* Occupied */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View
                style={[styles.iconWrapper, { backgroundColor: "#93c0baff" }]}
              >
                <Bed size={20} />
              </View>
              <View>
                <Text style={styles.statLabel}>Occupied</Text>
                <Text style={styles.statValue}>
                  {wardData.stats.occupied} / {wardData.stats.total}
                </Text>
              </View>
            </View>
          </View>

          {/* Available */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View
                style={[styles.iconWrapper, { backgroundColor: "#92a8ccff" }]}
              >
                <BedSingle size={20} color="#000000ff" />
              </View>
              <View>
                <Text style={styles.statLabel}>Available</Text>
                <Text style={styles.statValue}>
                  {wardData.stats.total - wardData.stats.occupied} beds
                </Text>
              </View>
            </View>
          </View>

          {/* Current Patients */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View
                style={[styles.iconWrapper, { backgroundColor: "#c284baff" }]}
              >
                <Users size={20} color="#000000ff" />
              </View>
              <View>
                <Text style={styles.statLabel}>Current Patients</Text>
                <Text style={styles.statValue}>
                  {wardData.stats.currentPatients}
                </Text>
              </View>
            </View>
          </View>

          {/* Total Treated */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View
                style={[styles.iconWrapper, { backgroundColor: "#6b9e7fff" }]}
              >
                <Activity size={20} color="#000000ff" />
              </View>
              <View>
                <Text style={styles.statLabel}>Total Treated</Text>
                <Text style={styles.statValue}>
                  {wardData.stats.totalTreated}
                </Text>
              </View>
            </View>
          </View>

          {/* Total Tests */}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View
                style={[styles.iconWrapper, { backgroundColor: "#c2bb7dff" }]}
              >
                <TestTubes size={20} color="#000000ff" />
              </View>
              <View>
                <Text style={styles.statLabel}>Total Tests</Text>
                {loadingCount ? (
                  <ActivityIndicator color="#000000ff" size="small" />
                ) : (
                  <Text style={styles.statValue}>
                    {testCount !== null ? testCount : "N/A"}
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (isDarkMode: boolean) => {
  const background = isDarkMode ? "#000000" : "#f3f4f6";
  const surface = isDarkMode ? "#080808" : "#fff";
  const card = isDarkMode ? "#0d0d0d" : "#fff";
  const border = isDarkMode ? "#1a1a1a" : "#e5e7eb";
  const textPrimary = isDarkMode ? "#f8fafc" : "#111827";
  const textMuted = isDarkMode ? "#94a3b8" : "#666";

  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: background },
    container: { flex: 1, padding: 16, backgroundColor: background },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    headerRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    notificationButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: isDarkMode ? "rgba(255,255,255,0.06)" : "transparent",
    },
    bellContainer: {
      position: "relative",
    },
    badge: {
      position: "absolute",
      top: -2,
      right: -2,
      backgroundColor: "#ef4444",
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
      borderWidth: 1.5,
      borderColor: background,
    },
    badgeText: {
      color: "#fff",
      fontSize: 9,
      fontWeight: "700",
    },
    hello: { fontSize: 24, fontWeight: "700", color: textPrimary },
    date: { color: textMuted },

    filters: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
      position: "relative",
      zIndex: 9999,
    },

    dropdownContainer: {
      flex: 1,
      marginRight: 8,
      position: "relative",
      zIndex: 9999,
    },

    dropdownLabel: { marginBottom: 4, fontWeight: "600", color: textPrimary },

    card: {
      backgroundColor: card,
      borderRadius: 10,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: border,
    },

    cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
    cardTitle: { marginLeft: 4, fontSize: 16, fontWeight: "600", color: textPrimary },

    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      marginVertical: 16,
    },

    statCard: {
      width: "48%",
      backgroundColor: surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: border,
    },

    fab: {
      position: "absolute",
      bottom: 30,
      right: 5,
      backgroundColor: "#00A652",
      width: 50,
      height: 50,
      borderRadius: 30,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 5,
    },

    statRow: { flexDirection: "row", alignItems: "center" },
    iconWrapper: {
      padding: 8,
      backgroundColor: isDarkMode ? "#1f3d3d" : "#f0fdf4",
      borderRadius: 8,
      marginRight: 8,
    },
    statLabel: { fontSize: 12, color: textMuted },
    statValue: { fontSize: 14, fontWeight: "600", color: textPrimary },
  });
};
