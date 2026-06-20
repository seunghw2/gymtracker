import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

type Props = {
  visible: boolean;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  onConfirm: (start: string, end: string) => void;
  onClose: () => void;
};

const toStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일`;

export default function RangePickerSheet({ visible, start, end, onConfirm, onClose }: Props) {
  const [edit, setEdit] = useState<'start' | 'end'>('start');
  const [s, setS] = useState(() => new Date(start));
  const [e, setE] = useState(() => new Date(end));

  useEffect(() => {
    if (visible) { setS(new Date(start)); setE(new Date(end)); setEdit('start'); }
  }, [visible, start, end]);

  const confirm = () => {
    // 시작이 끝보다 늦으면 자동으로 뒤바꿔 항상 올바른 범위로
    let a = s, b = e;
    if (a > b) { const t = a; a = b; b = t; }
    onConfirm(toStr(a), toStr(b));
  };
  const active = edit === 'start' ? s : e;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <View style={st.header}>
            <Pressable onPress={onClose} hitSlop={8}><Text style={st.cancel}>취소</Text></Pressable>
            <Text style={st.title}>기간 지정</Text>
            <Pressable onPress={confirm} hitSlop={8}><Text style={st.confirm}>확인</Text></Pressable>
          </View>
          <View style={st.tabs}>
            <Pressable style={[st.tab, edit === 'start' && st.tabOn]} onPress={() => setEdit('start')}>
              <Text style={st.tabCap}>시작</Text>
              <Text style={[st.tabDate, edit === 'start' && st.tabDateOn]}>{fmt(s)}</Text>
            </Pressable>
            <Text style={st.tilde}>~</Text>
            <Pressable style={[st.tab, edit === 'end' && st.tabOn]} onPress={() => setEdit('end')}>
              <Text style={st.tabCap}>끝</Text>
              <Text style={[st.tabDate, edit === 'end' && st.tabDateOn]}>{fmt(e)}</Text>
            </Pressable>
          </View>
          <DateTimePicker
            key={edit}
            value={active}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            themeVariant="dark"
            onChange={(_, d) => { if (d) { if (edit === 'start') setS(d); else setE(d); } }}
            style={st.picker}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#2C2C2E',
  },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cancel: { color: '#8E8E93', fontSize: 16 },
  confirm: { color: '#FF3B30', fontSize: 16, fontWeight: '700' },
  tabs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 14 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#2C2C2E' },
  tabOn: { borderColor: '#FF3B30', backgroundColor: 'rgba(255,59,48,0.10)' },
  tabCap: { color: '#8E8E93', fontSize: 11, fontWeight: '600' },
  tabDate: { color: '#EDEDF0', fontSize: 15, fontWeight: '700', marginTop: 2 },
  tabDateOn: { color: '#FF3B30' },
  tilde: { color: '#8E8E93', fontSize: 16 },
  picker: { alignSelf: 'center' },
});
