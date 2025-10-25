import axios from "axios";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AddMedicine from "./Addmedicine";

let WebView: any;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface PharmacyTableProps {
  patientId: string | number;
}

const PharmacyTable: React.FC<PharmacyTableProps> = ({ patientId }) => {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data } = await axios.get(
        `http://192.168.100.176:3000/tr_pharmacy_store_request?patientId=${patientId}`
      );

      const activeMeds = (data || []).filter(
        (d: any) => Number(d.stop_medicine) === 0
      );
      const stoppedMeds = (data || []).filter(
        (d: any) => Number(d.stop_medicine) === 1
      );

      const headers = [
        "S.No",
        "Date",
        "Medicines",
        "Dosage",
        "Day Count",
        "Diagnosis",
        "Remarks",
        "Ward Dosage",
        "Active",
      ];

      const makeRows = (list: any[], isActive: boolean) => {
        if (list.length === 0)
          return [["-", "-", "-", "-", "-", "-", "-", "-", false]];

        return list.map((item: any, idx: number) => [
          idx + 1,
          new Date(item.DATE).toLocaleDateString(),
          item.medicine_name || "-",
          item.Dosage || "-",
          `${item.day_count || 0}`,
          item.diagnosis || "-",
          item.Remarks || "-",
          item.ward_dosage || "-",
          isActive,
        ]);
      };

      const safeHeaders = JSON.stringify(headers).replace(/</g, "\\u003c");
      const safeActive = JSON.stringify(makeRows(activeMeds, true)).replace(
        /</g,
        "\\u003c"
      );
      const safeStopped = JSON.stringify(makeRows(stoppedMeds, false)).replace(
        /</g,
        "\\u003c"
      );

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable@14.3.0/dist/handsontable.min.css">
          <script src="https://cdn.jsdelivr.net/npm/handsontable@14.3.0/dist/handsontable.min.js"></script>
          <style>
            html, body { margin:0; padding:0; background:#fff; font-family:Arial,sans-serif; overflow-x:hidden; width:100%; height:100%; }
            .section-title { font-size:18px; font-weight:bold; margin:10px 0 8px 0; text-align:center; }
            #active, #stopped { width:100%; min-height:250px; margin-bottom:20px; }
            .handsontable th { background-color:#00A652 !important; color:#fff !important; font-weight:bold !important; text-align:center; white-space:nowrap; }
            .handsontable td { text-align:center; font-size:13px; color:#222 !important; white-space:normal !important; word-wrap:break-word; padding:4px 6px !important; }
            .table-wrapper { width:100%; overflow-x:auto; padding:5px; box-sizing:border-box; }
            .handsontable { width:100% !important; }
            @media (max-width: 768px) { .handsontable th, .handsontable td { font-size:11px !important; padding:2px 4px !important; } .section-title { font-size:16px; } }
          </style>
        </head>
        <body>
          <div class="section-title">Active Medications</div>
          <div class="table-wrapper"><div id="active"></div></div>
          <div class="section-title" style="color:red;">Stopped Medications</div>
          <div class="table-wrapper"><div id="stopped"></div></div>

          <script>
            const headers = ${safeHeaders};
            const activeData = ${safeActive};
            const stoppedData = ${safeStopped};
            const licenseKey = "non-commercial-and-evaluation";

            function renderTable(containerId, data) {
              const container = document.getElementById(containerId);
              if (!container) return;

              const hot = new Handsontable(container, {
                data,
                colHeaders: headers,
                rowHeaders: false,
                stretchH: 'all',
                height: 'auto',
                licenseKey,
                wordWrap: true,
                disableVisualSelection: true,
                manualColumnResize: true,
                autoColumnSize: true,
                columns: [
                  { readOnly: true },
                  { readOnly: true },
                  { readOnly: true },
                  { readOnly: true },
                  { readOnly: true },
                  { readOnly: true },
                  { readOnly: true },
                  { readOnly: true },
                  { type: 'checkbox', readOnly: false },
                ],
                afterChange: function(changes, source) {
                  if(!changes || source === 'loadData') return;
                  const [row, prop, oldValue, newValue] = changes[0];
                  if(prop === 7 && oldValue !== newValue){
                    if(window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function'){
                      window.ReactNativeWebView.postMessage("Hi I am alert");
                    } else {
                      alert("Hi I am alert");
                    }
                  } else {
                    hot.setDataAtCell(row, prop, oldValue);
                  }
                }
              });
            }

            renderTable('active', activeData);
            renderTable('stopped', stoppedData);
          </script>
        </body>
        </html>
      `;

      setHtmlContent(html);
    } catch (err) {
      console.error("Error fetching pharmacy data", err);
      setHtmlContent(`
        <div style="padding:20px; text-align:center; font-size:16px; color:red;">
          Error loading pharmacy records.
        </div>
      `);
    }
  }, [patientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  if (!htmlContent) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#00A652" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#00A652"]}
              tintColor="#00A652"
              progressBackgroundColor="#fff"
            />
          }
        >
          <View style={{ height: SCREEN_HEIGHT * 0.75 }}>
            {Platform.OS === "web" ? (
              <iframe
                srcDoc={htmlContent}
                style={{ width: "100%", height: "100%", border: "none" }}
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <WebView
                originWhitelist={["*"]}
                source={{ html: htmlContent }}
                javaScriptEnabled
                domStorageEnabled
                onMessage={(event: {
                  nativeEvent: { data: string | undefined };
                }) => Alert.alert("Alert", event.nativeEvent.data)}
                startInLoadingState
                renderLoading={() => (
                  <ActivityIndicator
                    size="large"
                    color="#00A652"
                    style={{ marginTop: 20 }}
                  />
                )}
              />
            )}
          </View>
        </ScrollView>

        {/* Fixed Add Medicine button */}
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
            style={styles.addButton}
          >
            <Text style={styles.addButtonText}>+ Add Medicine</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeButton}
            >
              <Text style={{ fontSize: 20, color: "#999" }}>✕</Text>
            </TouchableOpacity>
            <AddMedicine
              patientId={patientId}
              closeModal={() => setModalVisible(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  addButton: {
    backgroundColor: "#00A652",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fixedButtonContainer: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: "center",
    zIndex: 100,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    height: "80%",
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 15,
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 999,
    padding: 6,
  },
});

export default PharmacyTable;
