import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SEM, COLORS, ACCENT } from '../../constants/colors';
import { CardData, formatTopSet, mainValue, formatDelta, formatDay } from '../../lib/exerciseCard';

export type ExerciseCardProps = {
  data: CardData;
  name: string;
  partLabel: string;     // 부위(한글)
  equipLabel: string;    // 장비 또는 브랜드 (없으면 '')
  dotColor: string;
  onPress: () => void;
  editing?: boolean;
  onRemove?: () => void;
  showHandle?: boolean;  // ≡ 드래그 핸들(담은순 + 편집모드)
  drag?: () => void;
  isActive?: boolean;
};

/** 종목 카드(2열 셀) — 작업세트 기반. 1RM 미사용. */
export default function ExerciseCard({
  data, name, partLabel, equipLabel, dotColor, onPress, editing, onRemove, showHandle, drag, isActive,
}: ExerciseCardProps) {
  const main = mainValue(data.recentTopSet);
  const delta = formatDelta(data.deltaKg);
  const sub = [partLabel, equipLabel].filter(Boolean).join(' · ');

  return (
    <Pressable style={[s.card, isActive && s.active]} onPress={editing ? undefined : onPress}>
      {editing && onRemove && (
        <Pressable style={s.del} onPress={onRemove} hitSlop={6}><Text style={s.delT}>✕</Text></Pressable>
      )}
      <View style={s.top}>
        <View style={[s.dot, { backgroundColor: dotColor }]} />
        <View style={s.nameWrap}>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          {!!sub && <Text style={s.sub} numberOfLines={1}>{sub}</Text>}
        </View>
        {showHandle && (
          <Pressable onPressIn={drag} hitSlop={8}><Text style={s.handle}>≡</Text></Pressable>
        )}
      </View>

      <View style={s.mainRow}>
        <Text style={s.main}>{main.value}<Text style={s.unit}>{main.unit}</Text></Text>
        {data.isPR
          ? <Text style={s.pr}>PR 🔥</Text>
          : delta ? <Text style={s.delta}>{delta}</Text> : null}
      </View>

      <View style={s.div} />
      <View style={s.lrow}><Text style={s.ll}>최근</Text><Text style={s.lv}>{formatTopSet(data.recentTopSet)}</Text></View>
      <View style={s.lrow}><Text style={s.ll}>최고</Text><Text style={s.lv}>{formatTopSet(data.bestSet)}</Text></View>

      <Text style={s.day}>{formatDay(data.lastPerformedAt)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { flex: 1, backgroundColor: '#141414', borderRadius: 15, padding: 14, position: 'relative' },
  active: { backgroundColor: '#1d1d1f' },
  del: { position: 'absolute', top: -7, left: -7, width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  delT: { color: '#fff', fontSize: 13, fontWeight: '800' },

  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5, flexShrink: 0 },
  nameWrap: { flex: 1, minWidth: 0 },
  name: { color: '#fff', fontSize: 15.5, fontWeight: '700', letterSpacing: -0.3, lineHeight: 19 },
  sub: { color: SEM.ink4, fontSize: 11, marginTop: 3 },
  handle: { color: '#4a4a4e', fontSize: 15, marginLeft: 'auto' },

  mainRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10, marginBottom: 9 },
  main: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  unit: { color: SEM.ink3, fontSize: 13, fontWeight: '700' },
  delta: { color: COLORS.green, fontSize: 13, fontWeight: '800' },
  pr: { color: COLORS.green, fontSize: 13, fontWeight: '800' },

  div: { borderTopWidth: 1, borderTopColor: '#222', marginBottom: 7 },
  lrow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  ll: { color: SEM.ink3, fontSize: 13 },
  lv: { color: '#fff', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },

  day: { color: SEM.ink4, fontSize: 11, marginTop: 8 },
});
