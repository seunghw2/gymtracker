import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SEM } from '../constants/colors';
import { getReminderSettings, setReminderSettings, ReminderSettings } from '../lib/reminders';

/** 운동 리마인더 전용 페이지 — 며칠 쉬면 알림 + 일수·시각. */
export default function WorkoutReminderScreen() {
  const router = useRouter();
  const [reminder, setReminder] = useState<ReminderSettings>({ enabled: false, days: 2, hour: 19 });

  useEffect(() => { getReminderSettings().then(setReminder).catch(() => {}); }, []);
  const update = (next: ReminderSettings) => { setReminder(next); setReminderSettings(next).catch(() => {}); };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10}><Text style={s.navBack}>‹ 설정</Text></Pressable>
        <Text style={s.navTitle}>운동 리마인더</Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.group}>
          <View style={s.trow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={s.rowK}>며칠 쉬면 알림</Text>
              <Text style={s.sub}>마지막 운동 후 설정한 날만큼 쉬면 알려줘요 (앱이 닫혀 있어도)</Text>
            </View>
            <Switch value={reminder.enabled} onValueChange={v => update({ ...reminder, enabled: v })} trackColor={{ false: '#3A3A3C', true: SEM.brand }} thumbColor="#FFFFFF" />
          </View>
        </View>

        {reminder.enabled && (
          <View style={[s.group, { marginTop: 10 }]}>
            <View style={s.trow}>
              <Text style={s.rowK}>쉬는 일수</Text>
              <Stepper value={`${reminder.days}일`} onMinus={() => update({ ...reminder, days: Math.max(1, reminder.days - 1) })} onPlus={() => update({ ...reminder, days: Math.min(14, reminder.days + 1) })} />
            </View>
            <View style={[s.trow, s.rowDivider]}>
              <Text style={s.rowK}>알림 시각</Text>
              <Stepper value={`${String(reminder.hour).padStart(2, '0')}:00`} onMinus={() => update({ ...reminder, hour: (reminder.hour + 23) % 24 })} onPlus={() => update({ ...reminder, hour: (reminder.hour + 1) % 24 })} />
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={s.stepper}>
      <Pressable style={s.stepBtn} onPress={onMinus}><Text style={s.stepT}>−</Text></Pressable>
      <Text style={s.stepVal}>{value}</Text>
      <Pressable style={s.stepBtn} onPress={onPlus}><Text style={s.stepT}>+</Text></Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SEM.bg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
  navBack: { color: SEM.brand, fontSize: 16, fontWeight: '600' },
  navTitle: { color: SEM.ink1, fontSize: 17, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  group: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 14, overflow: 'hidden' },
  trow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: SEM.line },
  rowK: { color: SEM.ink1, fontSize: 15, fontWeight: '600' },
  sub: { color: SEM.ink3, fontSize: 11.5, marginTop: 3, lineHeight: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: SEM.surface3, alignItems: 'center', justifyContent: 'center' },
  stepT: { color: SEM.brand, fontSize: 19, fontWeight: '800' },
  stepVal: { color: SEM.ink1, fontSize: 15, fontWeight: '800', minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
