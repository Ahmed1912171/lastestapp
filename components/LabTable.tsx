import axios from "axios";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  View,
} from "react-native";

let WebView: any;
if (Platform.OS !== "web") {
  WebView = require("react-native-webview").WebView;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

interface LabTableProps {
  patientId: string | number;
}

const LabTable: React.FC<LabTableProps> = ({ patientId }) => {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await axios.get(
          `http://192.168.100.147:3000/patients/${patientId}/lab`
        );

        if (!data || data.length === 0) {
          setHtmlContent(`
            <div style="padding:20px; text-align:center; font-size:16px;">
              No lab reports available.
            </div>
          `);
          return;
        }

        const cultureCols = [
          "TypeofSpecimen",
          "growth_type",
          "Puss_cell",
          "Gram_stain",
          "Wet_Mount",
          "Culture",
        ];

        const hasCulture = data.some((item: any) =>
          cultureCols.some(
            (c) =>
              item &&
              item[c] !== undefined &&
              item[c] !== null &&
              item[c] !== ""
          )
        );

        const dateSet = new Set<string>(
          data
            .map(
              (i: any) =>
                (i.Result_date_time || i.Culture_Result_date_time)?.split(
                  "T"
                )[0]
            )
            .filter((v: string | undefined): v is string => Boolean(v))
        );
        const uniqueDates: string[] = Array.from(dateSet).sort();

        // Pivot rows
        const pivoted: any[] = [];
        const mapPivot = new Map<string, any>();

        data.forEach((item: any) => {
          const key = `${item.TestID}-${item.ComponentID}`;
          const date = item.Result_date_time?.split("T")[0] || "-";

          if (!mapPivot.has(key)) {
            mapPivot.set(key, {
              TestID: item.TestID || "-",
              TestTitle: item.TestTitle || "-", // ✅ added
              Unit: item.Unit || "-", // ✅ added
              Heading: item.Heading || "-",
              ComponentID: item.ComponentID || "-",
              NormalRange: item.NormalRange || "-",
              Result: item.Result || "-",
              Barcodes: new Set<string>(
                item.Barcode_no ? [String(item.Barcode_no)] : []
              ),
              TypeofSpecimen: undefined,
              growth_type: undefined,
              Puss_cell: undefined,
              Gram_stain: undefined,
              Wet_Mount: undefined,
              Culture: undefined,
            });
          } else {
            const entry = mapPivot.get(key);
            if (item.Barcode_no) entry.Barcodes.add(String(item.Barcode_no));
          }

          mapPivot.get(key)[date] = item.Result || "-";
        });

        // Attach culture values
        data.forEach((item: any) => {
          const hasCultureData = cultureCols.some(
            (c) =>
              item &&
              item[c] !== undefined &&
              item[c] !== null &&
              item[c] !== ""
          );
          if (!hasCultureData) return;

          const barcode = item.Barcode_no ? String(item.Barcode_no) : null;
          let attached = false;

          if (barcode) {
            for (const [, entry] of mapPivot) {
              if (entry.Barcodes && entry.Barcodes.has(barcode)) {
                entry.TypeofSpecimen =
                  entry.TypeofSpecimen || item.TypeofSpecimen || "-";
                entry.growth_type =
                  entry.growth_type || item.growth_type || "-";
                entry.Puss_cell = entry.Puss_cell || item.Puss_cell || "-";
                entry.Gram_stain = entry.Gram_stain || item.Gram_stain || "-";
                entry.Wet_Mount = entry.Wet_Mount || item.Wet_Mount || "-";
                entry.Culture = entry.Culture || item.Culture || "-";

                const cdate =
                  item.Culture_Result_date_time?.split("T")[0] || "-";
                entry[cdate] =
                  entry[cdate] || item.Culture || item.Result || "-";
                attached = true;
              }
            }
          }

          if (!attached && item.Culture_TestID) {
            for (const [, entry] of mapPivot) {
              if (entry.TestID === item.Culture_TestID) {
                entry.TypeofSpecimen =
                  entry.TypeofSpecimen || item.TypeofSpecimen || "-";
                entry.growth_type =
                  entry.growth_type || item.growth_type || "-";
                entry.Puss_cell = entry.Puss_cell || item.Puss_cell || "-";
                entry.Gram_stain = entry.Gram_stain || item.Gram_stain || "-";
                entry.Wet_Mount = entry.Wet_Mount || item.Wet_Mount || "-";
                entry.Culture = entry.Culture || item.Culture || "-";

                const cdate =
                  item.Culture_Result_date_time?.split("T")[0] || "-";
                entry[cdate] =
                  entry[cdate] || item.Culture || item.Result || "-";
                attached = true;
              }
            }
          }
        });

        mapPivot.forEach((row) => pivoted.push(row));

        // Headers
        const baseHeaders = [
          "Test ID",
          "Test Name",
          "Unit",
          "Component ID",
          "Result",
          "Normal Range",
        ];

        const cultureHeaders = [
          "Specimen",
          "Growth",
          "Pus cell",
          "Gram stain",
          "Wet mount",
          "Culture",
        ];

        const headers = hasCulture
          ? [...baseHeaders, ...cultureHeaders, ...uniqueDates]
          : [...baseHeaders, ...uniqueDates];

        // Rows
        const rows = pivoted.map((row) => {
          const baseRow = [
            row.TestID,
            row.TestTitle,
            row.ComponentID,
            row.Unit,
            row.Result,
            row.NormalRange,
          ];

          if (hasCulture) {
            const cultureValues = [
              row.TypeofSpecimen || "-",
              row.growth_type || "-",
              row.Puss_cell || "-",
              row.Gram_stain || "-",
              row.Wet_Mount || "-",
              row.Culture || "-",
            ];
            return [
              ...baseRow,
              ...cultureValues,
              ...uniqueDates.map((d) => row[d] || "-"),
            ];
          } else {
            return [...baseRow, ...uniqueDates.map((d) => row[d] || "-")];
          }
        });

        // Merge cells for TestID
        const mergeCells: any[] = [];
        let startRow = 0;
        for (let i = 1; i < rows.length; i++) {
          if (rows[i][0] !== rows[i - 1][0]) {
            if (i - startRow > 1) {
              mergeCells.push({
                row: startRow,
                col: 0,
                rowspan: i - startRow,
                colspan: 1,
              });
            }
            startRow = i;
          }
        }
        if (rows.length - startRow > 1) {
          mergeCells.push({
            row: startRow,
            col: 0,
            rowspan: rows.length - startRow,
            colspan: 1,
          });
        }

        const safeRows = JSON.stringify(rows).replace(/</g, "\\u003c");
        const safeHeaders = JSON.stringify(headers).replace(/</g, "\\u003c");
        const safeMerge = JSON.stringify(mergeCells).replace(/</g, "\\u003c");

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, minimum-scale=0.5, maximum-scale=5.0">
              <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.css">
              <script src="https://cdn.jsdelivr.net/npm/handsontable/dist/handsontable.full.min.js"></script>
              <style>
                html, body { margin:0; padding:0; overflow:hidden; height:100%; background:#fff; font-family:Arial, sans-serif; }
                #hot { width:100%; height:100vh; }
                .handsontable th, .handsontable td { font-size:13px; white-space:nowrap; text-align:center; color:black !important; }
                .handsontable th { background-color:#00A652 !important; color:black !important; font-weight:bold !important; }
                .handsontable td:nth-child(1) { font-weight:bold !important; vertical-align:middle !important; }
                .ht_merge { vertical-align:middle !important; }
              </style>
            </head>
            <body>
              <div id="hot"></div>
              <script>
                const data = ${safeRows};
                const headers = ${safeHeaders};
                const mergeCells = ${safeMerge};
                const container = document.getElementById('hot');
                new Handsontable(container, {
                  data,
                  colHeaders: headers,
                  rowHeaders: false,
                  stretchH: 'all',
                  width: '100%',
                  height: window.innerHeight - 10,
                  fixedColumnsStart: 1,
                  preventOverflow: 'horizontal',
                  readOnly: true,
                  disableVisualSelection: true,
                  manualColumnResize: true,
                  manualRowResize: true,
                  mergeCells: mergeCells,
                  licenseKey: 'non-commercial-and-evaluation'
                });
              </script>
            </body>
          </html>
        `;

        setHtmlContent(html);
      } catch (err) {
        console.error("Error fetching lab data", err);
        setHtmlContent(`
          <div style="padding:20px; text-align:center; font-size:16px; color:red;">
            Error loading lab reports.
          </div>
        `);
      }
    };

    fetchData();
  }, [patientId]);

  if (!htmlContent) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#00A652" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView style={{ flex: 1 }}>
        <View style={{ height: SCREEN_HEIGHT * 0.8 }}>
          {Platform.OS === "web" ? (
            <iframe
              srcDoc={htmlContent}
              style={{ flex: 1, width: "100%", height: "100%", border: "none" }}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <WebView
              originWhitelist={["*"]}
              source={{ html: htmlContent }}
              style={{ flex: 1 }}
              javaScriptEnabled
              domStorageEnabled
              nestedScrollEnabled
              scrollEnabled
              startInLoadingState
              scalesPageToFit={true}
              automaticallyAdjustContentInsets={false}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LabTable;
