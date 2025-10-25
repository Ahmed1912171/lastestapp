import React, { useState } from "react";
import { Alert, Button, ScrollView, Text, TextInput, View } from "react-native";

type Props = {
  patient: {
    id: number;
    name: string;
    gender?: string;
  };
  branch: string;
};

export default function NewTestRegistration({ patient, branch }: Props) {
  const [form, setForm] = useState({
    branch,
    Patient_ID: String(patient.id),
    LabNo: "",
    PatientName: patient.name,
    Gender: patient.gender || "",
    Age: "",
    TestID: "",
    Remarks: "",
    ReferedID: "",
    TestSourceID: "",
    WardID: "",
    User_ID: "admin",
    NetAmount: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  const handleSubmit = async () => {
    if (!form.Patient_ID || !form.LabNo || !form.PatientName || !form.TestID) {
      Alert.alert("Missing data", "Please fill in all required fields.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/register-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert(
          "✅ Success",
          `Test registered successfully (Order ID: ${data.orderId})`
        );
        // Reset form
        setForm({
          branch: "korangi",
          Patient_ID: "",
          LabNo: "",
          PatientName: "",
          Gender: "",
          Age: "",
          TestID: "",
          Remarks: "",
          ReferedID: "",
          TestSourceID: "",
          WardID: "",
          User_ID: "admin",
          NetAmount: "",
        });
      } else {
        Alert.alert("❌ Error", data.error || "Failed to register test.");
      }
    } catch (err: any) {
      console.error("Error:", err);
      Alert.alert("Network Error", "Unable to reach the server.");
    }
  };

  return (
    <ScrollView style={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "bold", marginBottom: 12 }}>
        🧪 New Test Registration
      </Text>

      <Text>Patient ID*</Text>
      <TextInput
        style={styles.input}
        value={form.Patient_ID}
        onChangeText={(text) => handleChange("Patient_ID", text)}
      />

      <Text>Lab No*</Text>
      <TextInput
        style={styles.input}
        value={form.LabNo}
        onChangeText={(text) => handleChange("LabNo", text)}
      />

      <Text>Patient Name*</Text>
      <TextInput
        style={styles.input}
        value={form.PatientName}
        onChangeText={(text) => handleChange("PatientName", text)}
      />

      <Text>Gender</Text>
      <TextInput
        style={styles.input}
        value={form.Gender}
        onChangeText={(text) => handleChange("Gender", text)}
      />

      <Text>Age</Text>
      <TextInput
        style={styles.input}
        value={form.Age}
        keyboardType="numeric"
        onChangeText={(text) => handleChange("Age", text)}
      />

      <Text>Test ID*</Text>
      <TextInput
        style={styles.input}
        value={form.TestID}
        onChangeText={(text) => handleChange("TestID", text)}
      />

      <Text>Remarks</Text>
      <TextInput
        style={styles.input}
        value={form.Remarks}
        onChangeText={(text) => handleChange("Remarks", text)}
      />

      <Text>Net Amount</Text>
      <TextInput
        style={styles.input}
        value={form.NetAmount}
        keyboardType="numeric"
        onChangeText={(text) => handleChange("NetAmount", text)}
      />

      <View style={{ marginTop: 20 }}>
        <Button title="Register Test" onPress={handleSubmit} />
      </View>
    </ScrollView>
  );
}

const styles = {
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
};
