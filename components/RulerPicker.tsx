import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

type Props = {
  initial: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;        // 눈금 간격(0.1)
  unitLabel?: string;
};

const ITEM_W = 7;       // 눈금 하나 폭(px)

export default function RulerPicker({ initial, onChange, min = 30, max = 200, step = 0.1, unitLabel = 'kg' }: Props) {
  const [width, setWidth] = useState(0);
  const count = Math.round((max - min) / step) + 1;
  const lastIdx = useRef(-1);

  const initialIndex = Math.max(0, Math.min(count - 1, Math.round((initial - min) / step)));
  const data = React.useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.max(0, Math.min(count - 1, Math.round(x / ITEM_W)));
    if (idx === lastIdx.current) return;
    lastIdx.current = idx;
    const v = Math.round((min + idx * step) * 10) / 10;
    onChange(v);
  };

  const renderItem = ({ item }: { item: number }) => {
    const isMajor = item % Math.round(1 / step) === 0;      // 1kg마다
    const isMid = item % Math.round(0.5 / step) === 0;       // 0.5kg
    return (
      <View style={styles.tickCol}>
        <View style={[styles.tick, isMajor ? styles.tickMajor : isMid ? styles.tickMid : styles.tickMinor]} />
        {isMajor ? <Text style={styles.tickLabel}>{Math.round(min + item * step)}</Text> : null}
      </View>
    );
  };

  return (
    <View style={styles.wrap} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <FlatList
          horizontal
          data={data}
          keyExtractor={i => String(i)}
          renderItem={renderItem}
          getItemLayout={(_, i) => ({ length: ITEM_W, offset: ITEM_W * i, index: i })}
          initialScrollIndex={initialIndex}
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_W}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ paddingHorizontal: width / 2 - ITEM_W / 2 }}
        />
      )}
      {/* 가운데 고정 표시자 */}
      <View pointerEvents="none" style={styles.indicator}>
        <View style={styles.triangle} />
        <View style={styles.indicatorLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 76, justifyContent: 'center', alignSelf: 'stretch', marginVertical: 12 },
  tickCol: { width: ITEM_W, alignItems: 'center' },
  tick: { width: 1.5, backgroundColor: '#48484A', borderRadius: 1 },
  tickMinor: { height: 18 },
  tickMid: { height: 28, backgroundColor: '#6E6E73' },
  tickMajor: { height: 38, backgroundColor: '#8E8E93' },
  tickLabel: { color: '#8E8E93', fontSize: 12, marginTop: 4, position: 'absolute', top: 40, width: 40, textAlign: 'center' },
  indicator: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
  triangle: {
    width: 0, height: 0, backgroundColor: 'transparent', borderStyle: 'solid',
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 11,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#5E5CE6',
  },
  indicatorLine: { width: 2, height: 40, backgroundColor: '#5E5CE6', borderRadius: 1 },
});
