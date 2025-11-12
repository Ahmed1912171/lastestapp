import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type ResultsProps = {
  tests: string[]; // list of test names
  onSave?: (values: Record<string, string>) => void; // callback on save
};

const Results: React.FC<ResultsProps> = ({ tests, onSave }) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const handleChange = (testName: string, value: string) => {
    setValues((prev) => ({ ...prev, [testName]: value }));
  };

  const handleSave = () => {
    if (onSave) onSave(values);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Test Results</Text>

      {tests.map((test) => (
        <View key={test} style={styles.inputGroup}>
          <Text style={styles.label}>{test}</Text>
          <TextInput
            placeholder="Enter value"
            style={styles.input}
            value={values[test] || ""}
            onChangeText={(value) => handleChange(test, value)}
          />
        </View>
      ))}

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Results</Text>
      </TouchableOpacity>
    </View>
  );
};

export default Results;

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    color: "#444",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#C1C7D0",
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: "#fff",
  },
  saveButton: {
    marginTop: 18,
    backgroundColor: "#238028ff",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 16,
    color: "#fff",
    fontWeight: "600",
  },
});
