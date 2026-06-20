import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SEM, ACCENT } from '../../constants/colors';
import { SortKey, SORT_OPTIONS } from '../../lib/exerciseSort';
import BottomSheet from '../ui/BottomSheet';

type Props = {
  visible: boolean;
  current: SortKey;
  onSelect: (k: SortKey) => void;
  onClose: () => void;
};

/** 정렬 선택 바텀시트(담은순/최근/무게/이름/부위). */
export default function SortSheet({ visible, current, onSelect, onClose }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="정렬">
      {SORT_OPTIONS.map(([k, label]) => {
        const on = k === current;
        return (
          <Pressable key={k} style={s.row} onPress={() => { onSelect(k); onClose(); }}>
            <Text style={[s.label, on && s.labelOn]}>{label}</Text>
            {on && <Text style={s.ck}>✓</Text>}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: SEM.line2 },
  label: { color: SEM.ink2, fontSize: 15, fontWeight: '600' },
  labelOn: { color: '#fff', fontWeight: '800' },
  ck: { marginLeft: 'auto', color: ACCENT, fontSize: 16, fontWeight: '800' },
});
