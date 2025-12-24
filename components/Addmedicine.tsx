// AddMedicine.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Keyboard,
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
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ CORRECT

interface MedicineEntry {
  dosageCount: string | null;
  wardDosage: string | null;
  dayCount: string | null;
  subCategory: string | null;
  medicineName: string | null;
  dosageType: string | null;
  diagnosis: string;
  remarks: string;
  openDosageCount: boolean;
  openMedicine: boolean;
  openDosage: boolean;
  openDay: boolean;
  openWardDosage: boolean;
  errors?: {
    dosageCount?: boolean;
    wardDosage?: boolean;
    medicineName?: boolean;
    dayCount?: boolean;
  };
}

type OpenField =
  | "openDosageCount"
  | "openMedicine"
  | "openDosage"
  | "openDay"
  | "openWardDosage";

type ValueField =
  | "dosageCount"
  | "wardDosage"
  | "medicineName"
  | "dosageType"
  | "dayCount"
  | "remarks";

interface AddMedicineProps {
  closeModal: () => void;
  patientId: string | number;
}

const API_BASE_URL = "http://192.168.101.39:3000";

const FIELD_LABELS = {
  dosageCount: "Dosage Count*",
  wardDosage: "Dosage*",
  medicineName: "Medicine Name*",
  dayCount: "Day Count*",
  remarks: "Remarks*",
};

const DOSAGE_COUNTS = [
  { label: "Stat", value: "Stat" },
  { label: "4", value: "4" },
  { label: "6", value: "6" },
  { label: "8", value: "8" },
  { label: "12", value: "12" },
  { label: "OD", value: "OD" },
  { label: "HS", value: "HS" },
];

const DAY_COUNTS = Array.from({ length: 7 }, (_, i) => ({
  label: `${i + 1}`,
  value: `${i + 1}`,
}));

const AddMedicine: React.FC<AddMedicineProps> = ({ closeModal, patientId }) => {
  const [entries, setEntries] = useState<MedicineEntry[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState<string>("");
  const [medicineList, setMedicineList] = useState<
    { label: string; value: string }[]
  >([]);
  const [loadingMedicines, setLoadingMedicines] = useState<boolean>(false);
  const [fetchedDiagnosis, setFetchedDiagnosis] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(
        now.toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchDiagnosis = async () => {
      try {
        const res = await fetch(
          `${API_BASE_URL}/tr_pharmacy_store_request?patientId=${patientId}`
        );
        const data = await res.json();
        let latestDiagnosis = "";
        if (Array.isArray(data) && data.length > 0) {
          latestDiagnosis = data[data.length - 1].diagnosis || "";
        }
        setFetchedDiagnosis(latestDiagnosis);
        setEntries([createEmptyEntry(latestDiagnosis)]);
      } catch (err) {
        console.error("Error fetching diagnosis:", err);
        setEntries([createEmptyEntry("")]);
      }
    };
    fetchDiagnosis();
  }, [patientId]);

  const createEmptyEntry = (diagnosis: string): MedicineEntry => ({
    dosageCount: null,
    wardDosage: null,
    dayCount: null,
    subCategory: null,
    medicineName: null,
    dosageType: null,
    diagnosis,
    remarks: "",
    openDosageCount: false,
    openMedicine: false,
    openDosage: false,
    openDay: false,
    openWardDosage: false,
    errors: {},
  });

  const fetchMedicines = useCallback(async (search = "") => {
    try {
      setLoadingMedicines(true);
      const res = await fetch(
        `${API_BASE_URL}/medicines?search=${encodeURIComponent(search)}`
      );
      const data = await res.json();
      const items = data.results.map((m: any) => ({
        label: m.SUB_ITEM_CAT,
        value: m.SUB_ITEM_CAT_ID.toString(),
      }));
      setMedicineList(items);
    } catch (err) {
      console.error("Error fetching medicines:", err);
    } finally {
      setLoadingMedicines(false);
    }
  }, []);

  useEffect(() => {
    fetchMedicines();
  }, [fetchMedicines]);

  const toggleDropdown = (index: number, field: OpenField, open?: boolean) => {
    setEntries((prev) =>
      prev.map((entry, i) => {
        // Close all dropdowns in all entries first
        const closedAll = {
          ...entry,
          openDosageCount: false,
          openMedicine: false,
          openDosage: false,
          openDay: false,
          openWardDosage: false,
        };
        // Then open the specific dropdown in the target entry
        if (i === index) {
          closedAll[field] = typeof open === "boolean" ? open : !entry[field];
        }
        return closedAll;
      })
    );
  };

  const onSelect = (index: number, field: ValueField, value: string) => {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== index) return entry;
        
        const updatedEntry = {
          ...entry,
          [field]: value,
          openDosageCount: false,
          openMedicine: false,
          openDosage: false,
          openDay: false,
          openWardDosage: false,
          errors: { ...entry.errors, [field]: false },
        };
        
        // If dosage count is "Stat", set day count to "0"
        if (field === "dosageCount" && value === "Stat") {
          updatedEntry.dayCount = "0";
        }
        
        return updatedEntry;
      })
    );
  };

  const updateText = (index: number, val: string) => {
    setEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, remarks: val } : entry))
    );
  };

  const addEntry = () =>
    setEntries((prev) => [...prev, createEmptyEntry(fetchedDiagnosis)]);
  const removeEntry = (index: number) =>
    setEntries((prev) => prev.filter((_, i) => i !== index));

  const makeSetValueHandler =
    (idx: number, valueKey: ValueField) =>
    (incoming: string | ((prev: string | null) => string | null)) => {
      const current = entries[idx][valueKey];
      const next =
        typeof incoming === "function" ? incoming(current) : incoming;
      if (next !== null) onSelect(idx, valueKey, next);
    };

  const makeSetOpenHandler =
    (idx: number, openKey: OpenField) =>
    (incoming: boolean | ((prev: boolean) => boolean)) => {
      const current = entries[idx][openKey];
      const next =
        typeof incoming === "function" ? incoming(current) : incoming;
      toggleDropdown(idx, openKey, next);
    };

  const handleSave = async () => {
    let hasError = false;
    const updatedEntries = entries.map((entry) => {
      const errors: MedicineEntry["errors"] = {};
      if (!entry.dosageCount?.trim())
        ((errors.dosageCount = true), (hasError = true));
      if (!entry.wardDosage?.trim())
        ((errors.wardDosage = true), (hasError = true));
      if (!entry.medicineName?.trim())
        ((errors.medicineName = true), (hasError = true));
      // Only require day count if dosage is not "Stat"
      if (entry.dosageCount !== "Stat" && !entry.dayCount?.trim())
        ((errors.dayCount = true), (hasError = true));
      return { ...entry, errors };
    });
    setEntries(updatedEntries);
    if (hasError)
      return Alert.alert("Error", "Please fill all required fields.");

    try {
      const payload = {
        branch: "korangi",
        medicines: entries.map((entry) => ({
          SUB_ITEM_CAT_ID: entry.medicineName,
          Dosage: entry.dosageCount,
          ward_dosage: entry.wardDosage,
          day_count: entry.dosageCount === "Stat" ? "0" : (entry.dayCount || ""),
          dosagetype: entry.dosageType || "Normal",
          remarks: entry.remarks,
          diagnosis: entry.diagnosis || "",
          Dosage_Time: "",
        })),
      };
      const res = await fetch(
        `${API_BASE_URL}/patients/${patientId}/medicines`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", "Medicines saved successfully!");
        closeModal();
      } else {
        Alert.alert(
          "Error",
          "Failed to save medicines: " + (data.error || "Unknown error")
        );
      }
    } catch (err) {
      console.error("Error saving medicines:", err);
      Alert.alert("Error", "Failed to save medicines. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Add Medicine</Text>

            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Current Date & Time</Text>
              <TextInput
                style={styles.dateInput}
                value={currentDateTime}
                editable={false}
              />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 120 }}
              showsVerticalScrollIndicator={false}
            >
              {entries.map((entry, idx) => (
                <View
                  key={idx}
                  style={styles.entryContainer}
                >
                  <Text style={styles.entryTitle}># {idx + 1}</Text>

                  <Text style={styles.fieldLabel}>Diagnosis</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: "#f0f0f0" }]}
                    value={entry.diagnosis}
                    editable={false}
                  />
                  <Text style={styles.fieldLabel}>
                    {FIELD_LABELS.medicineName}
                  </Text>
                  <View style={{ zIndex: 5000 + idx * 1000 + 1, elevation: 5 }}>
                    <DropDownPicker
                      open={entry.openMedicine}
                      value={entry.medicineName || ""}
                      items={medicineList}
                      loading={loadingMedicines}
                      searchable
                      searchPlaceholder="Search medicine..."
                      onChangeSearchText={(t) => fetchMedicines(t)}
                      setOpen={makeSetOpenHandler(idx, "openMedicine")}
                      setValue={makeSetValueHandler(idx, "medicineName")}
                      placeholder="Select Medicine"
                      listMode="SCROLLVIEW"
                      dropDownDirection="BOTTOM"
                      maxHeight={200}
                      containerProps={{
                        style: {
                          height: entry.openMedicine ? 250 : null,
                          zIndex: 5000 + idx * 1000 + 1,
                        },
                      }}
                      style={[
                        styles.dropdown,
                        entry.errors?.medicineName && styles.errorBorder,
                      ]}
                      dropDownContainerStyle={{
                        zIndex: 5000 + idx * 1000 + 1,
                        elevation: 25,
                        maxHeight: 200,
                      }}
                      zIndex={5000 + idx * 1000 + 1}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>
                    {FIELD_LABELS.dosageCount}
                  </Text>
                  <View style={{ zIndex: 5000 + idx * 1000 + 10, elevation: 5 }}>
                    <DropDownPicker
                      open={entry.openDosageCount}
                      value={entry.dosageCount || ""}
                      items={DOSAGE_COUNTS}
                      setOpen={makeSetOpenHandler(idx, "openDosageCount")}
                      setValue={makeSetValueHandler(idx, "dosageCount")}
                      placeholder="Dosage Count"
                      listMode="SCROLLVIEW"
                      dropDownDirection="BOTTOM"
                      maxHeight={150}
                      containerProps={{
                        style: {
                          height: entry.openDosageCount ? 200 : null,
                          zIndex: 5000 + idx * 1000 + 10,
                        },
                      }}
                      style={[
                        styles.dropdown,
                        entry.errors?.dosageCount && styles.errorBorder,
                      ]}
                      dropDownContainerStyle={{
                        zIndex: 5000 + idx * 1000 + 10,
                        elevation: 25,
                        maxHeight: 150,
                      }}
                      zIndex={5000 + idx * 1000 + 10}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>
                    {FIELD_LABELS.wardDosage}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      entry.errors?.wardDosage && styles.errorBorder,
                    ]}
                    placeholder="Ward Dosage"
                    value={entry.wardDosage || ""}
                    onChangeText={(val) => onSelect(idx, "wardDosage", val)}
                  />

                  <Text style={styles.fieldLabel}>{FIELD_LABELS.dayCount}</Text>
                  <View style={{ zIndex: 5000 + idx * 1000 + 20, elevation: 5 }}>
                    <DropDownPicker
                      open={entry.openDay}
                      value={entry.dayCount === "0" ? "" : (entry.dayCount || "")}
                      items={DAY_COUNTS}
                      setOpen={makeSetOpenHandler(idx, "openDay")}
                      setValue={makeSetValueHandler(idx, "dayCount")}
                      placeholder="Day Count"
                      disabled={entry.dosageCount === "Stat"}
                      listMode="SCROLLVIEW"
                      dropDownDirection="BOTTOM"
                      maxHeight={150}
                      containerProps={{
                        style: {
                          height: entry.openDay ? 200 : null,
                          zIndex: 5000 + idx * 1000 + 20,
                          opacity: entry.dosageCount === "Stat" ? 0.5 : 1,
                        },
                      }}
                      style={[
                        styles.dropdown,
                        entry.errors?.dayCount && styles.errorBorder,
                        entry.dosageCount === "Stat" && { opacity: 0.5 },
                      ]}
                      dropDownContainerStyle={{
                        zIndex: 5000 + idx * 1000 + 20,
                        elevation: 25,
                        maxHeight: 150,
                      }}
                      zIndex={5000 + idx * 1000 + 20}
                    />
                  </View>

                  <Text style={styles.fieldLabel}>{FIELD_LABELS.remarks}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Remarks"
                    value={entry.remarks}
                    onChangeText={(v) => updateText(idx, v)}
                  />

                  {entries.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeEntry(idx)}
                    >
                      <Text style={styles.removeBtnText}>Remove Entry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              <TouchableOpacity style={styles.addBtn} onPress={addEntry}>
                <Text style={styles.addBtnText}>+ Add Another Medicine</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, padding: 20 },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  dateContainer: { marginBottom: 15 },
  dateLabel: { fontWeight: "600", marginBottom: 5 },
  dateInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    color: "#555",
    backgroundColor: "#f9f9f9",
  },
  entryContainer: {
    marginBottom: 25,
    padding: 10,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    backgroundColor: "#fafafa",
  },
  entryTitle: { fontWeight: "bold", marginBottom: 10 },
  fieldLabel: { fontWeight: "600", marginBottom: 5 },
  dropdown: { borderColor: "#ccc", marginVertical: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    marginVertical: 5,
  },
  errorBorder: { borderColor: "red" },
  removeBtn: {
    backgroundColor: "#E53935",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 8,
    elevation: 3,
  },
  removeBtnText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  addBtn: {
    backgroundColor: "#00A652",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
    elevation: 5,
  },
  addBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  saveBtn: {
    backgroundColor: "#57ad63ff",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 15,
    elevation: 5,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
});

export default AddMedicine;
