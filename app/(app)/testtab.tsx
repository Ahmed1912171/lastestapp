import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
} from "react-native-gesture-handler";

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

type PivotedData = {
  TestID: string;
  Heading: string;
  ComponentID: string;
  NormalRange: string;
  [date: string]: string; // results keyed by date
};

export default function PatientTable() {
  const [data, setData] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(1);
  const { height } = useWindowDimensions();

  useEffect(() => {
    fetch("http://192.168.100.69:3000/patients/25709609/lab")
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator size="large" color="#000" />
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  const uniqueDates = Array.from(
    new Set(
      data.map((item) =>
        item.Result_date_time ? item.Result_date_time.split("T")[0] : ""
      )
    )
  ).filter(Boolean);

  const pivoted: PivotedData[] = [];
  const map = new Map<string, PivotedData>();

  data.forEach((item) => {
    const key = `${item.TestID}-${item.ComponentID}`;
    const date = item.Result_date_time
      ? item.Result_date_time.split("T")[0]
      : "-";

    if (!map.has(key)) {
      map.set(key, {
        TestID: item.TestID,
        Heading: item.Heading,
        ComponentID: item.ComponentID,
        NormalRange: item.NormalRange,
      });
    }
    const row = map.get(key)!;
    row[date] = item.Result || "-";
  });

  map.forEach((row) => pivoted.push(row));

  const grouped: { [testID: string]: PivotedData[] } = {};
  pivoted.forEach((row) => {
    if (!grouped[row.TestID]) grouped[row.TestID] = [];
    grouped[row.TestID].push(row);
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <PinchGestureHandler
          onGestureEvent={(e) => {
            let newScale = e.nativeEvent.scale;
            if (newScale < 0.8) newScale = 0.8;
            if (newScale > 2) newScale = 2;
            setScale(newScale);
          }}
        >
          <ScrollView horizontal>
            <View style={[styles.tableBox, { height: height - 20 }]}>
              <ScrollView>
                <View style={{ transform: [{ scale }] }}>
                  {/* Table Header */}
                  <View style={[styles.row, styles.headerRow]}>
                    <Text
                      style={[styles.cell, styles.headerCell, { width: 80 }]}
                    >
                      Test ID
                    </Text>
                    <Text
                      style={[styles.cell, styles.headerCell, { width: 110 }]}
                    >
                      Heading
                    </Text>
                    <Text
                      style={[styles.cell, styles.headerCell, { width: 110 }]}
                    >
                      Component
                    </Text>
                    <Text
                      style={[styles.cell, styles.headerCell, { width: 150 }]}
                    >
                      Normal Range
                    </Text>
                    {uniqueDates.map((date) => (
                      <Text
                        key={date}
                        style={[styles.cell, styles.headerCell, { width: 120 }]}
                      >
                        {date}
                      </Text>
                    ))}
                  </View>

                  {/* Table Data */}
                  {Object.entries(grouped).map(([testID, rows]) =>
                    rows.map((row, idx) => (
                      <View key={`${testID}-${idx}`} style={styles.row}>
                        {idx === 0 ? (
                          <View
                            style={[
                              styles.cellBox,
                              { width: 80, backgroundColor: "#f9f9f9" },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "600",
                                color: "#000",
                                textAlign: "center",
                                textAlignVertical: "center",
                              }}
                            >
                              {testID}
                            </Text>
                          </View>
                        ) : (
                          <View
                            style={[styles.cellBox, { width: 80, backgroundColor: "#fff" }]}
                          />
                        )}

                        <Text style={[styles.cell, { width: 110 }]}>
                          {row.Heading}
                        </Text>
                        <Text style={[styles.cell, { width: 110 }]}>
                          {row.ComponentID}
                        </Text>
                        <Text style={[styles.cell, { width: 150 }]}>
                          {row.NormalRange}
                        </Text>
                        {uniqueDates.map((date) => (
                          <Text
                            key={`${testID}-${idx}-${date}`}
                            style={[styles.cell, { width: 120 }]}
                          >
                            {row[date] || "-"}
                          </Text>
                        ))}
                      </View>
                    ))
                  )}
                </View>
              </ScrollView>
            </View>
          </ScrollView>
        </PinchGestureHandler>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f9f9f9" },
  tableBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    backgroundColor: "#fff",
    margin: 8,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  headerRow: {
    backgroundColor: "#00A652",
    borderBottomWidth: 1,
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: "center",
    color: "#000",
    borderRightWidth: 1,
    borderColor: "#ddd",
  },
  cellBox: {
    justifyContent: "center",
    alignItems: "center",
    borderRightWidth: 1,
    borderColor: "#ddd",
  },
  headerCell: {
    fontWeight: "bold",
    fontSize: 12,
    color: "#000",
  },
});
