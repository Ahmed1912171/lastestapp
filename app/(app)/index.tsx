// app/(tabs)/dashboard.tsx
import axios from "axios";
import { Activity, Bed, TestTubes, TrendingUp, Users } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import SimpleAvatar from "../../components/SimpleAvatar";
import SimpleChart from "../../components/SimpleChart";

// ----- Types -----
type WardStats = {
  occupied: number;
  total: number;
  currentPatients: number;
  totalTreated: number;
};

type WardData = {
  chartData: { name: string; patients: number }[];
  stats: WardStats;
};

type BranchWards = {
  PICU: WardData;
  NICU: WardData;
  GP: WardData;
};

type BranchData = Record<string, BranchWards>;

// ---------- Branch Data ----------
const branchData: BranchData = {
  Korangi: {
    PICU: { chartData: [], stats: { occupied: 0, total: 0, currentPatients: 0, totalTreated: 0 } },
    NICU: { chartData: [], stats: { occupied: 0, total: 0, currentPatients: 0, totalTreated: 0 } },
    GP:   { chartData: [], stats: { occupied: 0, total: 0, currentPatients: 0, totalTreated: 0 } },
  },
  Azambasti: {
    PICU: { chartData: [], stats: { occupied: 25, total: 35, currentPatients: 22, totalTreated: 140 } },
    NICU: { chartData: [], stats: { occupied: 18, total: 28, currentPatients: 15, totalTreated: 95 } },
    GP:   { chartData: [], stats: { occupied: 40, total: 60, currentPatients: 35, totalTreated: 250 } },
  },
  Sobhraj: {
    PICU: { chartData: [], stats: { occupied: 10, total: 20, currentPatients: 9, totalTreated: 80 } },
    NICU: { chartData: [], stats: { occupied: 12, total: 22, currentPatients: 10, totalTreated: 70 } },
    GP:   { chartData: [], stats: { occupied: 30, total: 50, currentPatients: 28, totalTreated: 200 } },
  },
  Sukkur: {
    PICU: { chartData: [], stats: { occupied: 5, total: 15, currentPatients: 4, totalTreated: 40 } },
    NICU: { chartData: [], stats: { occupied: 7, total: 17, currentPatients: 6, totalTreated: 45 } },
    GP:   { chartData: [], stats: { occupied: 20, total: 40, currentPatients: 18, totalTreated: 150 } },
  },
  Larkana: {
    PICU: { chartData: [], stats: { occupied: 8, total: 18, currentPatients: 7, totalTreated: 50 } },
    NICU: { chartData: [], stats: { occupied: 6, total: 16, currentPatients: 5, totalTreated: 45 } },
    GP:   { chartData: [], stats: { occupied: 25, total: 45, currentPatients: 22, totalTreated: 170 } },
  },
  Hyderabad: {
    PICU: { chartData: [], stats: { occupied: 12, total: 22, currentPatients: 11, totalTreated: 75 } },
    NICU: { chartData: [], stats: { occupied: 9, total: 19, currentPatients: 8, totalTreated: 60 } },
    GP:   { chartData: [], stats: { occupied: 35, total: 55, currentPatients: 32, totalTreated: 220 } },
  },
  Nawabshah: {
    PICU: { chartData: [], stats: { occupied: 14, total: 24, currentPatients: 12, totalTreated: 85 } },
    NICU: { chartData: [], stats: { occupied: 11, total: 21, currentPatients: 9, totalTreated: 70 } },
    GP:   { chartData: [], stats: { occupied: 28, total: 48, currentPatients: 25, totalTreated: 190 } },
  },
};

// ---------- Generate random weekly chart data ----------
Object.keys(branchData).forEach(branch => {
  (Object.keys(branchData[branch]) as (keyof BranchWards)[]).forEach(ward => {
    branchData[branch][ward].chartData = [
      { name: "Mon", patients: Math.floor(Math.random() * 50) },
      { name: "Tue", patients: Math.floor(Math.random() * 50) },
      { name: "Wed", patients: Math.floor(Math.random() * 50) },
      { name: "Thu", patients: Math.floor(Math.random() * 50) },
      { name: "Fri", patients: Math.floor(Math.random() * 50) },
      { name: "Sat", patients: Math.floor(Math.random() * 50) },
      { name: "Sun", patients: Math.floor(Math.random() * 50) },
    ];
  });
});

export default function Dashboard() {
  const [branchOpen, setBranchOpen] = useState(false);
  const [wardOpen, setWardOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<keyof BranchData>("Korangi");
  const [selectedWard, setSelectedWard] = useState<keyof BranchWards>("PICU");
  const [wards, setWards] = useState<{ label: string; value: keyof BranchWards }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState("");

  // ---------- Dynamic Date ----------
  useEffect(() => {
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric", year: "numeric" };
    setToday(date.toLocaleDateString("en-US", options));
  }, []);

  // ---------- Fetch Korangi Data ----------
  const fetchKorangiData = useCallback(async () => {
    try {
      const res = await axios.get("http://192.168.100.102:3000/ward_beds");
      const data: { ward: string; status: number }[] = res.data;

      const newKorangi: BranchWards = {
        PICU: { chartData: branchData.Korangi.PICU.chartData, stats: { occupied: 0, total: 0, currentPatients: 0, totalTreated: branchData.Korangi.PICU.stats.totalTreated } },
        NICU: { chartData: branchData.Korangi.NICU.chartData, stats: { occupied: 0, total: 0, currentPatients: 0, totalTreated: branchData.Korangi.NICU.stats.totalTreated } },
        GP:   { chartData: branchData.Korangi.GP.chartData, stats: { occupied: 0, total: 0, currentPatients: 0, totalTreated: branchData.Korangi.GP.stats.totalTreated } },
      };

      data.forEach(bed => {
        if (bed.ward === "PICU") {
          newKorangi.PICU.stats.total++;
          newKorangi.PICU.stats.occupied += bed.status;
        } else if (bed.ward === "NICU") {
          newKorangi.NICU.stats.total++;
          newKorangi.NICU.stats.occupied += bed.status;
        } else if (bed.ward === "GP") {
          newKorangi.GP.stats.total++;
          newKorangi.GP.stats.occupied += bed.status;
        }
      });

      // Set currentPatients = occupied and update totalTreated
      (["PICU", "NICU", "GP"] as (keyof BranchWards)[]).forEach(w => {
        newKorangi[w].stats.currentPatients = newKorangi[w].stats.occupied;
        newKorangi[w].stats.totalTreated += newKorangi[w].stats.currentPatients;
      });

      branchData.Korangi = newKorangi;
    } catch (err) {
      console.error("Error fetching ward beds", err);
    }
  }, []);

  // ---------- Refresh ----------
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchKorangiData().finally(() => setRefreshing(false));
  }, [fetchKorangiData]);

  // ---------- Update Wards Dropdown ----------
  useEffect(() => {
    const wardNames = (Object.keys(branchData[selectedBranch]) as (keyof BranchWards)[]).map(w => ({ label: w, value: w }));
    setWards(wardNames);
    if (!wardNames.find(w => w.value === selectedWard)) {
      setSelectedWard(wardNames[0].value);
    }
  }, [selectedBranch, selectedWard]);

  useEffect(() => {
    fetchKorangiData();
  }, [fetchKorangiData]);

  const wardData = branchData[selectedBranch][selectedWard];

  // ---------- DropDown helpers ----------
  const setBranchValue = (val: any) => {
    const v = typeof val === "function" ? val(selectedBranch) : val;
    setSelectedBranch(v);
  };
  const setWardValue = (val: any) => {
    const v = typeof val === "function" ? val(selectedWard) : val;
    setSelectedWard(v);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hello, Dr. Ahmed Hasan</Text>
            <Text style={styles.date}>{today}</Text>
          </View>
          <SimpleAvatar fallback="AH" size={48} />
        </View>

        {/* Dropdowns */}
        <View style={styles.filters}>
          <View style={[styles.dropdownContainer, { zIndex: 6000 }]}>
            <Text style={styles.dropdownLabel}>Branch</Text>
            <DropDownPicker
              open={branchOpen}
              setOpen={setBranchOpen}
              value={selectedBranch}
              setValue={setBranchValue}
              items={Object.keys(branchData).map(b => ({ label: b, value: b }))}
              listMode="SCROLLVIEW"
              dropDownDirection="AUTO"
              zIndex={6000}
              zIndexInverse={1000}
            />
          </View>

          <View style={[styles.dropdownContainer, { zIndex: 5000 }]}>
            <Text style={styles.dropdownLabel}>Ward</Text>
            <DropDownPicker
              open={wardOpen}
              setOpen={setWardOpen}
              value={selectedWard}
              setValue={setWardValue}
              items={wards as any} // TS safe cast
              listMode="SCROLLVIEW"
              dropDownDirection="AUTO"
              zIndex={5000}
              zIndexInverse={2000}
            />
          </View>
        </View>

        {/* Chart */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <TrendingUp size={16} />
            <Text style={styles.cardTitle}> Patients Visited (This Week)</Text>
          </View>
          <SimpleChart data={wardData.chartData} />
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View style={styles.iconWrapper}><Activity size={20} /></View>
              <View>
                <Text style={styles.statLabel}>Branch</Text>
                <Text style={styles.statValue}>{selectedBranch}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View style={styles.iconWrapper}><Users size={20} /></View>
              <View>
                <Text style={styles.statLabel}>Ward</Text>
                <Text style={styles.statValue}>{selectedWard}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View style={styles.iconWrapper}><Bed size={20} /></View>
              <View>
                <Text style={styles.statLabel}>Occupied</Text>
                <Text style={styles.statValue}>{wardData.stats.occupied} / {wardData.stats.total}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View style={[styles.iconWrapper, { backgroundColor: '#d1fae5' }]}><Bed size={20} color="#10b981" /></View>
              <View>
                <Text style={styles.statLabel}>Available</Text>
                <Text style={styles.statValue}>{wardData.stats.total - wardData.stats.occupied} beds</Text>
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View style={[styles.iconWrapper, { backgroundColor: '#fde68a' }]}><Activity size={20} color="#f59e0b" /></View>
              <View>
                <Text style={styles.statLabel}>Current Patients</Text>
                <Text style={styles.statValue}>{wardData.stats.currentPatients}</Text>
              </View>
            </View>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View style={[styles.iconWrapper, { backgroundColor: '#fca5a5' }]}><Activity size={20} color="#b91c1c" /></View>
              <View>
                <Text style={styles.statLabel}>Total Treated</Text>
                <Text style={styles.statValue}>{wardData.stats.totalTreated}</Text>
              </View>
            </View>
          </View>
           <View style={styles.statCard}>
            <View style={styles.statRow}>
              <View style={[styles.iconWrapper, { backgroundColor: '#cecbdbff' }]}><TestTubes size={20} color="#1b6115ff" /></View>
              <View>
                <Text style={styles.statLabel}>Total Tests</Text>
                <Text style={styles.statValue}>120330</Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f3f4f6' },
  container: { flex: 1, padding: 16 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  hello: { fontSize: 24, fontWeight: '700' },
  date: { color: '#666' },

  filters: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  dropdownContainer: { flex: 1, marginRight: 8 },
  dropdownLabel: { marginBottom: 4, fontWeight: '600' },

  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 16, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle: { marginLeft: 4, fontSize: 16, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginVertical: 16 },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrapper: { padding: 8, backgroundColor: '#f0fdf4', borderRadius: 8, marginRight: 8 },

  statLabel: { fontSize: 12, color: '#666' },
  statValue: { fontSize: 14, fontWeight: '600' },
});
