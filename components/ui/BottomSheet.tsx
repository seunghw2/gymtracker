import React from 'react';
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { SEM, RADIUS, SPACE } from '../../constants/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

/**
 * 공용 바텀시트 — 스크림(탭하면 닫힘) + 하단 도킹 시트(그립·제목·내용).
 * 화면마다 반복되던 Modal+scrim+sheet 보일러플레이트를 하나로. 내용 행은 children으로.
 */
export default function BottomSheet({ visible, onClose, title, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.grip} />
        {!!title && <Text style={s.title}>{title}</Text>}
        {children}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute', left: SPACE.sm, right: SPACE.sm, bottom: SPACE.md,
    backgroundColor: SEM.surface3, borderRadius: RADIUS.xl, overflow: 'hidden', paddingBottom: SPACE.sm,
  },
  grip: { width: 34, height: 4, backgroundColor: SEM.line2, borderRadius: RADIUS.sm, alignSelf: 'center', marginTop: 9, marginBottom: 2 },
  title: { color: SEM.ink3, fontSize: 13, fontWeight: '700', paddingHorizontal: SPACE.lg, paddingTop: 6, paddingBottom: 2 },
});
