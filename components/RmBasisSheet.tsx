import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, ScrollView,
  NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';

export type RmMode = 'actual' | 'estimated';

type Props = {
  visible: boolean;
  exerciseName?: string;
  initialReps?: number;       // 기본 10
  initialMode?: RmMode;        // 기본 'actual'(실제)
  onConfirm: (reps: number, mode: RmMode) => void;
  onClose: () => void;
};

const MIN = 1;
const MAX = 30;
const ITEM_W = 64;
const RANGE = Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i);

export default function RmBasisSheet({ visible, exerciseName, initialReps = 10, initialMode = 'actual', onConfirm, onClose }: Props) {
  const [mode, setMode] = useState<RmMode>(initialMode);
  const [reps, setReps] = useState(initialReps);
  const [pickerW, setPickerW] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const clampReps = (v: number) => Math.min(MAX, Math.max(MIN, v));
  const idxOf = (v: number) => clampReps(v) - MIN;

  // 열릴 때 현재 값으로 초기화 + 해당 위치로 스크롤
  useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setReps(clampReps(initialReps));
      // 레이아웃 후 스크롤
      setTimeout(() => scrollRef.current?.scrollTo({ x: idxOf(initialReps) * ITEM_W, animated: false }), 0);
    }
  }, [visible, initialReps, initialMode]);

  const pad = pickerW > 0 ? Math.max(0, (pickerW - ITEM_W) / 2) : 0;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / ITEM_W);
    const v = clampReps(MIN + idx);
    if (v !== reps) setReps(v);
  };

  const close = () => { onConfirm(reps, mode); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grip} />
          {exerciseName ? <Text style={styles.exName} numberOfLines={1}>{exerciseName}</Text> : null}
          <Text style={styles.title}>기준 RM</Text>

          {/* 실제/추정 토글 (계산식 연결은 추후 — TODO) */}
          <View style={styles.segment}>
            {([['actual', '실제 RM', '측정한 값'], ['estimated', '추정 RM', '세트로 계산']] as const).map(([key, label, sub]) => {
              const on = mode === key;
              return (
                <Pressable key={key} style={[styles.segCell, on && styles.segCellOn]} onPress={() => setMode(key)}>
                  {/* TODO: '추정' 선택 시 Epley 환산 계산식 연결 */}
                  <Text style={[styles.segLabel, on && styles.segLabelOn]}>{label}</Text>
                  <Text style={[styles.segSub, on && styles.segSubOn]}>{sub}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* 가로 스냅 숫자 선택기 */}
          <View style={styles.picker} onLayout={e => setPickerW(e.nativeEvent.layout.width)}>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={ITEM_W}
              decelerationRate="fast"
              scrollEventThrottle={16}
              onScroll={onScroll}
              contentContainerStyle={{ paddingHorizontal: pad }}
            >
              {RANGE.map(n => {
                const dist = Math.abs(n - reps);
                const isSel = dist === 0;
                return (
                  <View key={n} style={styles.item}>
                    <Text
                      style={[
                        styles.itemText,
                        isSel ? styles.itemSel : dist === 1 ? styles.itemNear : styles.itemFar,
                        { opacity: isSel ? 1 : dist === 1 ? 0.7 : 0.35 },
                      ]}
                    >
                      {n}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <Text style={styles.caption}>
            선택됨 · <Text style={styles.captionHi}>{mode === 'actual' ? '실제' : '추정'} {reps}RM</Text> 기준
          </Text>

          <Pressable style={styles.closeBtn} onPress={close}>
            <Text style={styles.closeText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34 },
  grip: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#48484A', alignSelf: 'center', marginBottom: 16 },
  exName: { color: '#8E8E93', fontSize: 13, marginBottom: 4 },
  title: { color: '#8E8E93', fontSize: 15, fontWeight: '600', marginBottom: 12 },

  segment: { flexDirection: 'row', backgroundColor: '#000000', borderRadius: 12, padding: 4, gap: 4 },
  segCell: { flex: 1, paddingVertical: 12, borderRadius: 9, alignItems: 'center' },
  segCellOn: { backgroundColor: '#3A3A3C' },
  segLabel: { color: '#8E8E93', fontSize: 17, fontWeight: '700' },
  segLabelOn: { color: '#FFFFFF' },
  segSub: { color: '#6E6E73', fontSize: 12, marginTop: 2 },
  segSubOn: { color: '#AEAEB2' },

  picker: { marginTop: 22, height: 64, justifyContent: 'center' },
  item: { width: ITEM_W, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontVariant: ['tabular-nums'], fontWeight: '700' },
  itemSel: { color: '#30D158', fontSize: 38 },
  itemNear: { color: '#8E8E93', fontSize: 24 },
  itemFar: { color: '#48484A', fontSize: 20 },

  caption: { color: '#8E8E93', fontSize: 14, textAlign: 'center', marginTop: 14, marginBottom: 18 },
  captionHi: { color: '#30D158', fontWeight: '700' },

  closeBtn: { backgroundColor: '#2C2C2E', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  closeText: { color: '#FFFFFF', fontSize: 17, fontWeight: '600' },
});
