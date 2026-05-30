import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { toDisplay, unitLabel } from '../lib/units';

type DataPoint = {
  date: string;
  estimated_1rm: number;
};

type Props = {
  data: DataPoint[];
  title?: string;
  unitKg?: boolean;
};

const WIDTH = Dimensions.get('window').width - 40;

export default function OneRMChart({ data, title, unitKg = true }: Props) {
  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>아직 기록이 없습니다</Text>
      </View>
    );
  }

  const recent = data.slice(-8);
  const labels = recent.map(d => d.date.slice(5));
  const values = recent.map(d => Math.round(toDisplay(d.estimated_1rm, unitKg)));

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <BarChart
        data={{
          labels,
          datasets: [{ data: values }],
        }}
        width={WIDTH}
        height={200}
        yAxisLabel=""
        yAxisSuffix={unitLabel(unitKg)}
        fromZero
        chartConfig={{
          backgroundColor: '#1C1C1E',
          backgroundGradientFrom: '#1C1C1E',
          backgroundGradientTo: '#1C1C1E',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(48, 209, 88, ${opacity})`,
          labelColor: () => '#8E8E93',
          style: { borderRadius: 12 },
          propsForDots: { r: '4', strokeWidth: '2', stroke: '#30D158' },
          barPercentage: 0.7,
        }}
        style={styles.chart}
        showValuesOnTopOfBars
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  chart: {
    borderRadius: 12,
  },
  empty: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
  },
  emptyText: {
    color: '#48484A',
    fontSize: 14,
  },
});
