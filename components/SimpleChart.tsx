// components/SimpleChart.tsx
import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useTheme } from "../ctx/theme";

export type ChartDataItem = {
  name: string;
  patients: number;
};

type SimpleChartProps = {
  data?: ChartDataItem[];
};

export default function SimpleChart({ data = [] }: SimpleChartProps) {
  const { isDarkMode } = useTheme();
  const labels = data.map((item) => item.name);
  const values = data.map((item) => item.patients);

  // full screen width minus padding of parent card (16px * 2 = 32)
  const screenWidth = Dimensions.get("window").width - 32;
  const cardColor = isDarkMode ? "#000000" : "#fff";
  const lineColor = isDarkMode ? "#60a5fa" : "#4F46E5";
  const textColor = isDarkMode ? "#f8fafc" : "#111827";
  const dotStroke = isDarkMode ? "#2563eb" : "#4540afff";

  return (
    <View style={styles.container}>
      <LineChart
        data={{
          labels,
          datasets: [
            {
              data: values,
              color: () => lineColor,
              strokeWidth: 3,
            },
          ],
        }}
        width={screenWidth} // ✅ ensures it fits inside card
        height={220}
        chartConfig={{
          backgroundColor: cardColor,
          backgroundGradientFrom: cardColor,
          backgroundGradientTo: cardColor,
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(96, 165, 250, ${opacity})`,
          labelColor: (opacity = 1) => `rgba( ${isDarkMode ? "248,248,252" : "17,24,39"}, ${opacity})`,
          propsForDots: {
            r: "5",
            strokeWidth: "2",
            stroke: dotStroke,
          },
        }}
        bezier
        style={styles.chart}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center", // ✅ keeps chart centered
  },
  chart: {
    borderRadius: 12,
    marginLeft: 0, // ✅ prevents overflow
  },
});
