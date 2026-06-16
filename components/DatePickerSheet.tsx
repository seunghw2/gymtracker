import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { weekdayKo } from '../lib/date';

type Props = {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onConfirm: (date: string) => void;
  onClose: () => void;
};

export default function DatePickerSheet({ visible, value, onConfirm, onClose }: Props) {
  const [temp, setTemp] = useState(() => new Date(value));

  useEffect(() => {
    if (visible) setTemp(new Date(value));
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.cancel}>취소</Text>
            </Pressable>
            <Text style={styles.title}>날짜 선택</Text>
            <Pressable onPress={() => onConfirm(temp.toISOString().slice(0, 10))} hitSlop={8}>
              <Text style={styles.confirm}>확인</Text>
            </Pressable>
          </View>
          <Text style={styles.selectedLabel}>
            {`${temp.getMonth() + 1}월 ${temp.getDate()}일 (${weekdayKo(temp)})`}
          </Text>
          <DateTimePicker
            value={temp}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            themeVariant="dark"
            onChange={(_, date) => { if (date) setTemp(date); }}
            style={styles.picker}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#1C1C1E', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  selectedLabel: { color: '#FF3B30', fontSize: 15, fontWeight: '600', textAlign: 'center', paddingTop: 12 },
  cancel: { color: '#8E8E93', fontSize: 16 },
  confirm: { color: '#FF3B30', fontSize: 16, fontWeight: '700' },
  picker: { alignSelf: 'center' },
});
