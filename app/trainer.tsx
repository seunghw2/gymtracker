import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getSetting, setSetting } from '../db/queries';
import { SEM, ACCENT, ACCENT_INK } from '../constants/colors';

type Trainer = { id: string; emoji: string; name: string; tag: string; speech: string; sample: string; color: string };

const TRAINERS: Trainer[] = [
  { id: 'terry', emoji: '🧑‍🏫', name: '테리', tag: '공손하고 지적인', speech: '존댓말 · 차분·논리적',
    sample: '이번 주 2회 하셨네요. 남은 4일에 3번 채우면 목표에 도달합니다.', color: '#3B82F6' },
  { id: 'baptiste', emoji: '🥊', name: '바티스트', tag: '거칠고 몰아붙이는', speech: '반말 · 단호한 명령형',
    sample: '2회? 부족해. 남은 4일에 3번 더 넣어. 핑계 없이.', color: '#EF4444' },
  { id: 'crystal', emoji: '🌸', name: '크리스탈', tag: '섬세하고 스윗한', speech: '존댓말 · 따뜻한 격려',
    sample: '벌써 2번이나 나오셨네요, 멋져요! 💪 이 페이스면 충분해요.', color: '#EC4899' },
];

export default function TrainerScreen() {
  const router = useRouter();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const [selected, setSelected] = useState<string>('terry');

  useEffect(() => { getSetting('ai_coach_tone', 'terry').then(v => setSelected(['terry', 'baptiste', 'crystal'].includes(v) ? v : 'terry')); }, []);

  const choose = (id: string) => { setSelected(id); setSetting('ai_coach_tone', id).catch(() => {}); };
  const done = () => { if (isOnboarding) router.replace('/ai'); else router.back(); };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        {!isOnboarding && <Pressable onPress={() => router.back()} hitSlop={8}><Text style={s.back}>‹</Text></Pressable>}
        <Text style={s.hTitle}>트레이너를 골라주세요</Text>
      </View>
      <Text style={s.sub}>고른 트레이너의 말투로 모든 분석·코칭이 전달돼요. 언제든 설정에서 바꿀 수 있어요.</Text>

      <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {TRAINERS.map((t, i) => <Card key={t.id} t={t} on={selected === t.id} onPress={() => choose(t.id)} delay={i * 90} />)}
      </ScrollView>

      <Pressable style={s.cta} onPress={done}>
        <Text style={s.ctaT}>{isOnboarding ? '이 트레이너로 시작하기' : '확인'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Card({ t, on, onPress, delay }: { t: Trainer; on: boolean; onPress: () => void; delay: number }) {
  const op = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(op, { toValue: 1, duration: 320, delay, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 320, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={{ opacity: op, transform: [{ translateY: ty }] }}>
      <Pressable style={[s.card, on && { borderColor: t.color, backgroundColor: 'rgba(255,255,255,0.02)' }]} onPress={onPress}>
        <View style={[s.avatar, { backgroundColor: t.color + '22', borderColor: t.color }]}>
          <Text style={s.avatarE}>{t.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={s.name}>{t.name}</Text>
            <Text style={[s.tag, { color: t.color }]}>{t.tag}</Text>
            {on && <Text style={[s.check, { color: t.color }]}>✓</Text>}
          </View>
          <Text style={s.speech}>{t.speech}</Text>
          <Text style={s.sample}>“{t.sample}”</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 6 },
  back: { color: ACCENT, fontSize: 30, width: 24, marginTop: -4 },
  hTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  sub: { color: SEM.ink3, fontSize: 13, lineHeight: 19, paddingHorizontal: 16, marginTop: 8 },
  list: { padding: 16, gap: 12 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: SEM.surface2, borderWidth: 1.5, borderColor: SEM.line, borderRadius: 18, padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  avatarE: { fontSize: 28 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: '#fff', fontSize: 17, fontWeight: '800' },
  tag: { fontSize: 11.5, fontWeight: '700' },
  check: { marginLeft: 'auto', fontSize: 16, fontWeight: '900' },
  speech: { color: SEM.ink3, fontSize: 12, fontWeight: '600', marginTop: 3 },
  sample: { color: SEM.ink2, fontSize: 13, lineHeight: 18, marginTop: 7 },
  cta: { backgroundColor: ACCENT, margin: 16, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaT: { color: ACCENT_INK, fontSize: 16, fontWeight: '800' },
});
