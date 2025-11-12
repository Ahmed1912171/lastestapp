// addpatients.tsx

import DateTimePicker from "@react-native-community/datetimepicker";
import axios from "axios";
import React, { JSX, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context"; // ✅ CORRECT

type Payload = {
  TITLE?: string | null;
  PATIENT_FNAME?: string | null;
  PATIENT_LNAME?: string | null;
  GENDER?: string | null;
  AGE?: string | null;
  DOB?: string | null;
  PHONE_NO?: string | null;
  MOBILE_NO?: string | null;
  CNIC?: string | null;
  STREET?: string | null;
  CITY?: string | null;
  DISTRICT?: string | null;
  PROVINCE?: string | null;
  COUNTRY?: string | null;
  MARITAL_STATUS?: string | null;
  RELIGION?: string | null;
  BLOODG?: string | null;
  FATHER_HUSBAND?: string | null;
  PMR_NO?: string | null;
  FAMILY_NO?: string | null;
  WORK_STATUS?: string | null;
  EMPLOYER?: string | null;
  WORK_PHONE?: string | null;
  diagnosis?: string | null;
  weight?: string | null;
  TEMP_STATUS?: string | null;
  KIN_NAME?: string | null;
  KIN_REL?: string | null;
  KIN_TEL?: string | null;
  EMERGENCY_TYPE?: string | null;
  CONDITION_TYPE?: string | null;
  EMERGENCY_STATUS?: string | null;
  REGISTER_BY?: string;
  DATE_REG?: string;
};

export default function AddPatientsScreen(): JSX.Element {
  // --- change local IP if necessary ---
  const LOCAL_IP = "192.168.100.93";
  const API_BASE =
    Platform.OS === "android"
      ? "http://10.0.2.2:3000"
      : `http://${LOCAL_IP}:3000`;
  const ENDPOINT = "prg_patient_reg";
  // form state grouped
  const [form, setForm] = useState<Payload>({
    TITLE: "",
    PATIENT_FNAME: "",
    PATIENT_LNAME: "",
    GENDER: "",
    AGE: "",
    DOB: "",
    PHONE_NO: "",
    MOBILE_NO: "",
    CNIC: "",
    STREET: "",
    CITY: "",
    DISTRICT: "",
    PROVINCE: "",
    COUNTRY: "",
    MARITAL_STATUS: "",
    RELIGION: "",
    BLOODG: "",
    FATHER_HUSBAND: "",
    PMR_NO: "",
    FAMILY_NO: "",
    WORK_STATUS: "",
    EMPLOYER: "",
    WORK_PHONE: "",
    diagnosis: "",
    weight: "",
    TEMP_STATUS: "",
    KIN_NAME: "",
    KIN_REL: "",
    KIN_TEL: "",
    EMERGENCY_TYPE: "",
    CONDITION_TYPE: "",
    EMERGENCY_STATUS: "",
    REGISTER_BY: "app",
    DATE_REG: new Date().toISOString(),
  });

  const setField = <K extends keyof Payload>(key: K, value: Payload[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const [loading, setLoading] = useState(false);

  // dropdowns: we use listMode="SCROLLVIEW" so dropdowns don't render a FlatList inline
  const [genderOpen, setGenderOpen] = useState(false);
  const [maritalOpen, setMaritalOpen] = useState(false);
  const [bloodOpen, setBloodOpen] = useState(false);
  const [religionOpen, setReligionOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyValue, setEmergencyValue] = useState(null);
  const [emergencyItems, setEmergencyItems] = useState([
    { label: "Normal (0)", value: "0" },
    { label: "Emergency (1)", value: "1" },
  ]);

  const genderItems = [
    { label: "Male", value: "Male" },
    { label: "Female", value: "Female" },
  ];

  const maritalItems = [
    { label: "Single", value: "Single" },
    { label: "Married", value: "Married" },
    { label: "Widowed", value: "Widowed" },
    { label: "Divorced", value: "Divorced" },
  ];

  const bloodItems = [
    { label: "A+", value: "A+" },
    { label: "A-", value: "A-" },
    { label: "B+", value: "B+" },
    { label: "B-", value: "B-" },
    { label: "AB+", value: "AB+" },
    { label: "AB-", value: "AB-" },
    { label: "O+", value: "O+" },
    { label: "O-", value: "O-" },
  ];

  const religionItems = [
    { label: "Islam", value: "Islam" },
    { label: "Christianity", value: "Christianity" },
    { label: "Hindu", value: "Hindu" },
    { label: "Other", value: "Other" },
  ];

  // When one dropdown opens, close the others (prevents multiple SCROLLVIEWs)
  useEffect(() => {
    if (genderOpen) {
      setMaritalOpen(false);
      setBloodOpen(false);
      setReligionOpen(false);
    }
  }, [genderOpen]);

  useEffect(() => {
    if (maritalOpen) {
      setGenderOpen(false);
      setBloodOpen(false);
      setReligionOpen(false);
    }
  }, [maritalOpen]);

  useEffect(() => {
    if (bloodOpen) {
      setGenderOpen(false);
      setMaritalOpen(false);
      setReligionOpen(false);
    }
  }, [bloodOpen]);

  useEffect(() => {
    if (religionOpen) {
      setGenderOpen(false);
      setMaritalOpen(false);
      setBloodOpen(false);
    }
  }, [religionOpen]);

  // keep DATE_REG fresh
  useEffect(() => {
    setField("DATE_REG", new Date().toISOString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- validation ---
  const validate = (): boolean => {
    if (!form?.PATIENT_FNAME || !String(form.PATIENT_FNAME).trim()) {
      Alert.alert("Validation", "First name is required");
      return false;
    }
    if (!form?.GENDER || !String(form.GENDER).trim()) {
      Alert.alert("Validation", "Gender is required");
      return false;
    }
    if (!form?.PHONE_NO && !form?.MOBILE_NO) {
      Alert.alert(
        "Validation",
        "At least one contact number (phone/mobile) is required"
      );
      return false;
    }
    return true;
  };

  // reset form to initial empty values
  const resetForm = () => {
    setForm({
      TITLE: "",
      PATIENT_FNAME: "",
      PATIENT_LNAME: "",
      GENDER: "",
      AGE: "",
      DOB: "",
      PHONE_NO: "",
      MOBILE_NO: "",
      CNIC: "",
      STREET: "",
      CITY: "",
      DISTRICT: "",
      PROVINCE: "",
      COUNTRY: "",
      MARITAL_STATUS: "",
      RELIGION: "",
      BLOODG: "",
      FATHER_HUSBAND: "",
      PMR_NO: "",
      FAMILY_NO: "",
      WORK_STATUS: "",
      EMPLOYER: "",
      WORK_PHONE: "",
      diagnosis: "",
      weight: "",
      TEMP_STATUS: "",
      KIN_NAME: "",
      KIN_REL: "",
      KIN_TEL: "",
      EMERGENCY_TYPE: "",
      CONDITION_TYPE: "",
      EMERGENCY_STATUS: "",
      REGISTER_BY: "app",
      DATE_REG: new Date().toISOString(),
    });
  };
  const [showDatePicker, setShowDatePicker] = useState(true);

  // --- submit ---
  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);

    // build payload — convert empty string to null for DB clarity
    const payload: Payload = Object.fromEntries(
      Object.entries({
        ...form,
        // ensure meta fields are present
        REGISTER_BY: form.REGISTER_BY ?? "app",
        DATE_REG: form.DATE_REG ?? new Date().toISOString(),
      }).map(([k, v]) => [k, v === "" ? null : v])
    ) as Payload;

    try {
      const url = `${API_BASE}/${ENDPOINT}`;
      const res = await axios.post(url, payload, { timeout: 10000 });
      if (res.status >= 200 && res.status < 300) {
        Alert.alert("Success", "Patient registered successfully");
        resetForm();
      } else {
        console.warn("Unexpected response", res.status, res.data);
        Alert.alert("Error", "Server returned unexpected response");
      }
    } catch (err: any) {
      console.error("Error creating patient:", err);
      const msg =
        err?.response?.data?.message ?? err?.message ?? "Network Error";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // --- UI ---
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={120}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* Basic Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Patients Addmission</Text>

          <TextInput
            style={styles.input}
            placeholder="First name *"
            placeholderTextColor="#555"
            value={String(form.PATIENT_FNAME ?? "")}
            onChangeText={(v) => setField("PATIENT_FNAME", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Last name"
            placeholderTextColor="#555"
            value={String(form.PATIENT_LNAME ?? "")}
            onChangeText={(v) => setField("PATIENT_LNAME", v)}
          />

          <View style={{ zIndex: 3000 }}>
            <DropDownPicker
              open={genderOpen}
              value={form.GENDER ?? ""}
              items={genderItems}
              setOpen={setGenderOpen}
              setValue={(updater) => {
                // updater can be value or function
                if (typeof updater === "function") {
                  setField("GENDER", updater(form.GENDER));
                } else {
                  setField("GENDER", updater);
                }
              }}
              listMode="SCROLLVIEW"
              placeholder="Select Gender *"
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              zIndex={3000}
            />
          </View>

          {/* DOB Selector */}
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <View pointerEvents="none">
              <TextInput
                style={styles.input}
                placeholder="DOB (YYYY-MM-DD)"
                placeholderTextColor="#555"
                value={String(form.DOB ?? "")}
                editable={false}
              />
            </View>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={form.DOB ? new Date(form.DOB) : new Date()}
              mode="date"
              display="default"
              maximumDate={new Date()} // prevents future dates
              accentColor="#00A652"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);

                if (selectedDate) {
                  const dobFormatted = selectedDate.toISOString().split("T")[0];
                  setField("DOB", dobFormatted);

                  const today = new Date();

                  // Calculate total months difference
                  let totalMonths =
                    (today.getFullYear() - selectedDate.getFullYear()) * 12 +
                    (today.getMonth() - selectedDate.getMonth());

                  // Adjust if the current day hasn't reached birthday day of month yet
                  if (today.getDate() < selectedDate.getDate()) {
                    totalMonths--;
                  }

                  if (totalMonths >= 24) {
                    // Show age in years (2+ years)
                    const years = Math.floor(totalMonths / 12);
                    setField("AGE", `${years}`);
                  } else {
                    // Show age in months (< 2 years)
                    // handle singular
                    const label = totalMonths === 1 ? "Month" : "Months";
                    setField("AGE", `${totalMonths} ${label}`);
                  }
                }
              }}
            />
          )}

          {/* AUTO Age (Read-only) */}
          <TextInput
            style={styles.input}
            placeholder="Age"
            placeholderTextColor="#555"
            value={String(form.AGE ?? "")}
            editable={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Phone"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
            value={String(form.PHONE_NO ?? "")}
            onChangeText={(v) => setField("PHONE_NO", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Mobile"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
            value={String(form.MOBILE_NO ?? "")}
            onChangeText={(v) => setField("MOBILE_NO", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="CNIC"
            placeholderTextColor="#555"
            value={String(form.CNIC ?? "")}
            onChangeText={(v) => setField("CNIC", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Street / Address"
            placeholderTextColor="#555"
            value={String(form.STREET ?? "")}
            onChangeText={(v) => setField("STREET", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="City"
            placeholderTextColor="#555"
            value={String(form.CITY ?? "")}
            onChangeText={(v) => setField("CITY", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="District"
            placeholderTextColor="#555"
            value={String(form.DISTRICT ?? "")}
            onChangeText={(v) => setField("DISTRICT", v)}
          />

          <View style={{ zIndex: 3000, position: "relative" }}>
            <DropDownPicker
              open={bloodOpen}
              value={form.BLOODG ?? ""}
              items={bloodItems}
              setOpen={setBloodOpen}
              setValue={(callback) =>
                setField(
                  "BLOODG",
                  typeof callback === "function"
                    ? callback(form.BLOODG)
                    : callback
                )
              }
              listMode="SCROLLVIEW"
              placeholder="Blood Group"
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              zIndex={3000}
              zIndexInverse={1000}
            />
          </View>

          <View style={{ zIndex: 2000 }}>
            <DropDownPicker
              open={religionOpen}
              value={form.RELIGION ?? ""}
              items={religionItems}
              setOpen={setReligionOpen}
              setValue={(updater) => {
                if (typeof updater === "function")
                  setField("RELIGION", updater(form.RELIGION));
                else setField("RELIGION", updater);
              }}
              listMode="SCROLLVIEW"
              placeholder="Religion"
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              zIndex={900}
            />
          </View>
        </View>

        {/* Optional / Personal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal & Work Info</Text>

          <View style={{ zIndex: 2000 }}>
            <DropDownPicker
              open={maritalOpen}
              value={form.MARITAL_STATUS ?? ""}
              items={maritalItems}
              setOpen={setMaritalOpen}
              setValue={(updater) => {
                if (typeof updater === "function")
                  setField("MARITAL_STATUS", updater(form.MARITAL_STATUS));
                else setField("MARITAL_STATUS", updater);
              }}
              listMode="SCROLLVIEW"
              placeholder="Marital Status"
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              zIndex={2000}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Father / Husband Name"
            placeholderTextColor="#555"
            value={String(form.FATHER_HUSBAND ?? "")}
            onChangeText={(v) => setField("FATHER_HUSBAND", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Family No"
            placeholderTextColor="#555"
            value={String(form.FAMILY_NO ?? "")}
            onChangeText={(v) => setField("FAMILY_NO", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Work Status"
            placeholderTextColor="#555"
            value={String(form.WORK_STATUS ?? "")}
            onChangeText={(v) => setField("WORK_STATUS", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Employer"
            placeholderTextColor="#555"
            value={String(form.EMPLOYER ?? "")}
            onChangeText={(v) => setField("EMPLOYER", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Work Phone"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
            value={String(form.WORK_PHONE ?? "")}
            onChangeText={(v) => setField("WORK_PHONE", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Diagnosis"
            placeholderTextColor="#555"
            value={String(form.diagnosis ?? "")}
            onChangeText={(v) => setField("diagnosis", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Weight (kg)"
            placeholderTextColor="#555"
            keyboardType="decimal-pad"
            value={String(form.weight ?? "")}
            onChangeText={(v) => setField("weight", v)}
          />
        </View>

        {/* Emergency */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Emergency Contact</Text>

          <TextInput
            style={styles.input}
            placeholder="Emergency Contact Name"
            placeholderTextColor="#555"
            value={String(form.KIN_NAME ?? "")}
            onChangeText={(v) => setField("KIN_NAME", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Relation"
            placeholderTextColor="#555"
            value={String(form.KIN_REL ?? "")}
            onChangeText={(v) => setField("KIN_REL", v)}
          />

          <TextInput
            style={styles.input}
            placeholder="Emergency Phone"
            placeholderTextColor="#555"
            keyboardType="phone-pad"
            value={String(form.KIN_TEL ?? "")}
            onChangeText={(v) => setField("KIN_TEL", v)}
          />

          <DropDownPicker
            placeholder="Emergency Type"
            open={emergencyOpen}
            value={emergencyValue}
            items={emergencyItems}
            setOpen={setEmergencyOpen}
            setValue={setEmergencyValue}
            setItems={setEmergencyItems}
            listMode="SCROLLVIEW"
            onChangeValue={(val) => setField("EMERGENCY_TYPE", val)}
            style={styles.input}
            // prevent overlap issues
            zIndex={4000}
            zIndexInverse={1000}
          />

          <TextInput
            style={styles.input}
            placeholder="Condition Type"
            placeholderTextColor="#555"
            value={String(form.CONDITION_TYPE ?? "")}
            onChangeText={(v) => setField("CONDITION_TYPE", v)}
          />
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Register Patient</Text>
          )}
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

/* Styles */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9f9f9" },
  scrollContainer: { padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    overflow: "visible",
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 8,
    color: "#000000ff",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#fafafa",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  dropdown: {
    borderColor: "#e6e6e6",
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  dropdownContainer: { borderColor: "#e6e6e6" },
  submitButton: {
    backgroundColor: "#00A652",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
  },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
