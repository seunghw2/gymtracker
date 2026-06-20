import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { SEM, ACCENT } from '../../constants/colors';
import { SortKey, SORT_OPTIONS } from '../../lib/exerciseSort';

type Props = {
  visible: boolean;
  current: SortKey;
  onSelect: (k: SortKey) => void;
  onClose: () => void;
};

/** 정렬 선택 바텀시트(담은순/최근/무게/이름/부위). */
export default function SortSheet({ visible, current, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.grip} />
        <Text style={s.title}>정렬</Text>
        {SORT_OPTIONS.map(([k, label]) => {
          const on = k === current;
          return (
            <Pressable key={k} style={s.row} onPress={() => { onSelect(k); onClose(); }}>
              <Text style={[s.label, on && s.labelOn]}>{label}</Text>
              {on && <Text style={s.ck}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { position: 'absolute', left: 8, right: 8, bottom: 10, backgroundColor: SEM.surface3, borderRadius: 18, overflow: 'hidden', paddingBottom: 8 },
  grip: { width: 34, height: 4, backgroundColor: '#444', borderRadius: 2, alignSelf: 'center', marginTop: 9, marginBottom: 2 },
  title: { color: SEM.ink3, fontSize: 13, fontWeight: '700', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: SEM.line2 },
  label: { color: SEM.ink2, fontSize: 15, fontWeight: '600' },
  labelOn: { color: '#fff', fontWeight: '800' },
  ck: { marginLeft: 'auto', color: ACCENT, fontSize: 16, fontWeight: '800' },
});
