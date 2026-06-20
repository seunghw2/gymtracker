import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';

type Props = {
  visible: boolean;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  onConfirm: (start: string, end: string) => void;
  onClose: () => void;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const toStr = (y: number, m: number, d: number) => `${y}-${pad2(m)}-${pad2(d)}`;
const today = () => { const d = new Date(); return toStr(d.getFullYear(), d.getMonth() + 1, d.getDate()); };
const fmt = (s: string) => { const [, m, d] = s.split('-'); return `${Number(m)}월 ${Number(d)}일`; };
const DOW = ['월', '화', '수', '목', '금', '토', '일'];

export default function RangePickerSheet({ visible, start, end, onConfirm, onClose }: Props) {
  const [s, setS] = useState<string | null>(start);
  const [e, setE] = useState<string | null>(end);
  const [vy, setVy] = useState(() => Number(end.slice(0, 4)));
  const [vm, setVm] = useState(() => Number(end.slice(5, 7)));

  useEffect(() => {
    if (visible) {
      setS(start); setE(end);
      setVy(Number(end.slice(0, 4))); setVm(Number(end.slice(5, 7)));
    }
  }, [visible, start, end]);

  const td = today();
  const prevMonth = () => (vm === 1 ? (setVy(vy - 1), setVm(12)) : setVm(vm - 1));
  const nextMonth = () => (vm === 12 ? (setVy(vy + 1), setVm(1)) : setVm(vm + 1));

  const pick = (dateStr: string) => {
    if (dateStr > td) return;                       // 미래 날짜 선택 불가
    if (!s || (s && e)) { setS(dateStr); setE(null); return; }  // 새 범위 시작
    if (dateStr < s) { setS(dateStr); return; }     // 시작보다 이르면 시작 갱신
    setE(dateStr);                                  // 끝 확정(같은 날=하루 범위)
  };

  const confirm = () => { if (s) onConfirm(s, e ?? s); };

  const daysInMonth = new Date(vy, vm, 0).getDate();
  const firstDow = (new Date(vy, vm - 1, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(firstDow).fill(null)];
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const lo = s, hi = e ?? s;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.header}>
            <Pressable onPress={onClose} hitSlop={8}><Text style={st.cancel}>취소</Text></Pressable>
            <Text style={st.title}>기간 지정</Text>
            <Pressable onPress={confirm} hitSlop={8}><Text style={[st.confirm, !s && st.confirmOff]}>확인</Text></Pressable>
          </View>

          <Text style={st.rangeLabel}>
            {s ? <Text style={st.rangeOn}>{fmt(s)}</Text> : '시작일 선택'}
            <Text style={st.rangeSep}>  ~  </Text>
            {e ? <Text style={st.rangeOn}>{fmt(e)}</Text> : (s ? <Text style={st.rangeHint}>끝일 선택</Text> : '')}
          </Text>

          <View style={st.nav}>
            <Pressable onPress={prevMonth} style={st.navBtn} hitSlop={8}><Text style={st.navArrow}>‹</Text></Pressable>
            <Text style={st.monthLabel}>{vy}년 {vm}월</Text>
            <Pressable onPress={nextMonth} style={st.navBtn} hitSlop={8}><Text style={st.navArrow}>›</Text></Pressable>
          </View>

          <View style={st.dowRow}>
            {DOW.map((w, i) => <Text key={w} style={[st.dow, i >= 5 && st.dowEnd]}>{w}</Text>)}
          </View>

          <View style={st.grid}>
            {cells.map((d, idx) => {
              if (!d) return <View key={idx} style={st.cell} />;
              const ds = toStr(vy, vm, d);
              const isStart = ds === lo, isEnd = ds === hi;
              const inRange = !!(lo && hi && ds >= lo && ds <= hi);
              const future = ds > td;
              return (
                <Pressable key={idx} style={st.cell} onPress={() => pick(ds)} disabled={future}>
                  <View style={[st.band, inRange && lo !== hi && st.bandMid,
                    inRange && lo !== hi && isStart && st.bandStart, inRange && lo !== hi && isEnd && st.bandEnd]} />
                  <View style={[st.day, (isStart || isEnd) && st.dayEnd]}>
                    <Text style={[st.dayT, future && st.dayFuture, (isStart || isEnd) && st.dayEndT, inRange && !isStart && !isEnd && st.dayInT]}>{d}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ACCENT = '#FF3B30';
const TINT = 'rgba(255,59,48,0.16)';
const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28, paddingHorizontal: 12 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 8, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2C2C2E',
  },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cancel: { color: '#8E8E93', fontSize: 16 },
  confirm: { color: ACCENT, fontSize: 16, fontWeight: '700' },
  confirmOff: { color: '#48484A' },
  rangeLabel: { color: '#8E8E93', fontSize: 15, textAlign: 'center', paddingTop: 14, paddingBottom: 4 },
  rangeOn: { color: '#FFFFFF', fontWeight: '700' },
  rangeHint: { color: ACCENT, fontWeight: '700' },
  rangeSep: { color: '#48484A' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingTop: 10, paddingBottom: 6 },
  navBtn: { width: 40, height: 36, alignItems: 'center', justifyContent: 'center' },
  navArrow: { color: '#FFFFFF', fontSize: 26, fontWeight: '600' },
  monthLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  dowRow: { flexDirection: 'row', paddingBottom: 4 },
  dow: { width: `${100 / 7}%`, textAlign: 'center', color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  dowEnd: { color: '#6a6a6e' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', left: 0, right: 0, height: 38, top: '50%', transform: [{ translateY: -19 }] },
  bandMid: { backgroundColor: TINT },
  bandStart: { left: '50%' },  // 시작 셀은 오른쪽 절반만 칠해 원과 자연스럽게 이어짐
  bandEnd: { right: '50%' },   // 끝 셀은 왼쪽 절반만
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayEnd: { backgroundColor: ACCENT },
  dayT: { color: '#EDEDF0', fontSize: 15, fontWeight: '600' },
  dayInT: { color: '#FFFFFF' },
  dayEndT: { color: '#FFFFFF', fontWeight: '800' },
  dayFuture: { color: '#48484A' },
});
