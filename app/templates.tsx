import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ACCENT, SEM } from '../constants/colors';
import {
  getTemplates, deleteTemplate, getSuggestedTemplates, createTemplate,
  type SuggestedTemplate,
} from '../db/api/templates';
import type { TemplateSummary } from '../db/api/types';
import { startSessionFromTemplate } from '../lib/startTemplate';

const MG_KOR: Record<string, string> = {
  Chest: '가슴', Back: '등', Shoulder: '어깨', Legs: '하체',
  Arms: '팔', Core: '코어', Cardio: '유산소',
};

export default function TemplatesScreen() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [suggested, setSuggested] = useState<SuggestedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const [tpls, sugg] = await Promise.all([
      getTemplates().catch(() => [] as TemplateSummary[]),
      getSuggestedTemplates(),
    ]);
    setTemplates(tpls);
    setSuggested(sugg);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startTemplate = async (id: number, name: string) => {
    if (starting) return;
    setStarting(true);
    try {
      await startSessionFromTemplate(id, name);
      router.replace('/workout');
    } catch {
      Alert.alert('시작 실패', '템플릿을 불러오지 못했어요. 다시 시도해 주세요.');
      setStarting(false);
    }
  };

  // 추천 템플릿 → 저장 후 시작
  const startSuggested = async (sugg: SuggestedTemplate) => {
    if (starting) return;
    setStarting(true);
    try {
      const id = await createTemplate(
        sugg.name,
        sugg.exercises.map(e => ({ exerciseId: e.exerciseId, sets: e.sets, reps: e.reps, weightKg: e.weightKg })),
      );
      await startSessionFromTemplate(id, sugg.name);
      router.replace('/workout');
    } catch {
      Alert.alert('시작 실패', '추천 템플릿을 시작하지 못했어요.');
      setStarting(false);
    }
  };

  const confirmDelete = (tpl: TemplateSummary) => {
    Haptics.selectionAsync();
    Alert.alert('템플릿 삭제', `'${tpl.name}'을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => {
        await deleteTemplate(tpl.id).catch(() => {});
        load();
      }},
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <Header onBack={() => router.back()} />
        <View style={s.center}><ActivityIndicator color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <Header onBack={() => router.back()} />

      {starting && (
        <View style={s.startingOverlay}><ActivityIndicator color={ACCENT} size="large" /></View>
      )}

      <ScrollView contentContainerStyle={s.body}>
        {/* 새 템플릿 만들기 */}
        <Pressable style={s.newBtn} onPress={() => router.navigate('/template-edit')}>
          <Text style={s.newBtnIcon}>＋</Text>
          <Text style={s.newBtnText}>새 템플릿 만들기</Text>
        </Pressable>

        {/* 추천 템플릿 */}
        {suggested.length > 0 && (
          <>
            <Text style={s.sectionTitle}>추천 루틴</Text>
            {suggested.map((sg, i) => (
              <View key={i} style={s.suggCard}>
                <View style={s.suggHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.suggName}>{sg.name}</Text>
                    <Text style={s.suggReason}>{sg.reason}</Text>
                  </View>
                  <View style={s.suggBadge}><Text style={s.suggBadgeT}>추천</Text></View>
                </View>
                <Text style={s.suggExercises} numberOfLines={2}>
                  {sg.exercises.map(e => e.name).join(', ')}
                </Text>
                <Pressable style={s.suggStartBtn} onPress={() => startSuggested(sg)}>
                  <Text style={s.suggStartT}>이 루틴으로 시작</Text>
                </Pressable>
              </View>
            ))}
          </>
        )}

        {/* 내 템플릿 */}
        <Text style={s.sectionTitle}>내 템플릿</Text>
        {templates.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyT}>저장된 템플릿이 없어요.{'\n'}운동 후 '템플릿으로 저장'하거나 위에서 새로 만들어 보세요.</Text>
          </View>
        ) : (
          templates.map(tpl => (
            <View key={tpl.id} style={s.tplCard}>
              <Pressable style={{ flex: 1 }} onPress={() => startTemplate(tpl.id, tpl.name)}>
                <Text style={s.tplName}>{tpl.name}</Text>
                <Text style={s.tplMeta} numberOfLines={2}>
                  {tpl.exercise_names.join(', ') || '비어있음'}
                </Text>
                <Text style={s.tplCount}>{tpl.exercise_count}종목</Text>
              </Pressable>
              <View style={s.tplActions}>
                <Pressable style={s.tplStartBtn} onPress={() => startTemplate(tpl.id, tpl.name)}>
                  <Text style={s.tplStartT}>시작</Text>
                </Pressable>
                <View style={s.tplIconRow}>
                  <Pressable hitSlop={8} onPress={() => router.navigate({ pathname: '/template-edit', params: { id: String(tpl.id) } })}>
                    <Text style={s.tplEditIcon}>✏️</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => confirmDelete(tpl)}>
                    <Text style={s.tplDelIcon}>🗑</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} hitSlop={10}><Text style={s.back}>‹</Text></Pressable>
      <Text style={s.headerTitle}>템플릿으로 시작</Text>
      <View style={{ width: 24 }} />
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  startingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', zIndex: 10 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: SEM.line },
  back: { color: ACCENT, fontSize: 30, width: 24, marginTop: -4 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },

  body: { padding: 16, paddingBottom: 40 },

  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: ACCENT,
    backgroundColor: 'rgba(255,59,48,0.08)', marginBottom: 24 },
  newBtnIcon: { color: ACCENT, fontSize: 22, fontWeight: '800' },
  newBtnText: { color: ACCENT, fontSize: 15.5, fontWeight: '800' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: SEM.muted, letterSpacing: 0.4,
    textTransform: 'uppercase', marginBottom: 12, marginTop: 6 },

  suggCard: { backgroundColor: '#0c0f0c', borderWidth: 1, borderColor: 'rgba(43,217,106,0.25)',
    borderRadius: 14, padding: 16, marginBottom: 11 },
  suggHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  suggName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  suggReason: { fontSize: 12.5, color: SEM.good, marginTop: 3 },
  suggBadge: { backgroundColor: 'rgba(43,217,106,0.15)', borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  suggBadgeT: { fontSize: 11, fontWeight: '800', color: SEM.good },
  suggExercises: { fontSize: 13, color: '#9a9aa1', lineHeight: 19, marginBottom: 12 },
  suggStartBtn: { height: 42, borderRadius: 11, backgroundColor: SEM.good,
    alignItems: 'center', justifyContent: 'center' },
  suggStartT: { color: '#04210f', fontSize: 14, fontWeight: '800' },

  tplCard: { flexDirection: 'row', backgroundColor: SEM.surface1, borderWidth: 1, borderColor: SEM.line,
    borderRadius: 14, padding: 16, marginBottom: 10, gap: 12 },
  tplName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  tplMeta: { fontSize: 13, color: '#9a9aa1', lineHeight: 19, marginTop: 5 },
  tplCount: { fontSize: 12, color: '#5e5e66', marginTop: 5, fontWeight: '600' },
  tplActions: { alignItems: 'flex-end', justifyContent: 'space-between' },
  tplStartBtn: { backgroundColor: 'rgba(255,59,48,0.14)', borderWidth: 1, borderColor: 'rgba(255,59,48,0.4)',
    borderRadius: 9, paddingHorizontal: 14, paddingVertical: 8 },
  tplStartT: { color: ACCENT, fontSize: 13, fontWeight: '800' },
  tplIconRow: { flexDirection: 'row', gap: 14, marginTop: 12 },
  tplEditIcon: { fontSize: 16 },
  tplDelIcon: { fontSize: 16 },

  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyT: { color: SEM.muted, fontSize: 14, textAlign: 'center', lineHeight: 21 },
});
