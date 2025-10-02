// components/SimpleChart.tsx
import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LineChart } from "react-native-chart-kit";

export type ChartDataItem = {
  name: string;
  patients: number;
};

type SimpleChartProps = {
  data?: ChartDataItem[];
};

export default function SimpleChart({ data = [] }: SimpleChartProps) {
  const labels = data.map(item => item.name);
  const values = data.map(item => item.patients);

  // full screen width minus padding of parent card (16px * 2 = 32)
  const screenWidth = Dimensions.get("window").width - 32;

  return (
    <View style={styles.container}>
      <LineChart
        data={{
          labels,
          datasets: [
            {
              data: values,
              color: () => "#4F46E5",
              strokeWidth: 3,
            },
          ],
        }}
        width={screenWidth} // ✅ ensures it fits inside card
        height={220}
        chartConfig={{
          backgroundColor: "#fff",
          backgroundGradientFrom: "#fff",
          backgroundGradientTo: "#fff",
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0,0,0, ${opacity})`,
          propsForDots: {
            r: "5",
            strokeWidth: "2",
            stroke: "#4540afff",
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
