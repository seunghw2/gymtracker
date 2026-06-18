import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, SafeAreaView, Switch } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { SEM } from '../../constants/colors';
import { SettingIcon, IconName } from '../../components/SettingIcon';
import { getSetting, setSetting, deleteAiProfile } from '../../db/queries';
import { useSettingsStore, useWorkoutStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { exportWorkoutsCsv } from '../../lib/export';

const TRACK = { false: '#3A3A3C', true: SEM.brand };
const TONES: [string, string][] = [['plain', '담백'], ['cheer', '응원'], ['blunt', '직설']];

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { soundOnSilent, setSoundOnSilent } = useSettingsStore();
  const bannerActive = useWorkoutStore(s => s.activeSessionId != null);

  const [showSessionNote, setShowSessionNote] = useState(true);
  const [weightPrompt, setWeightPrompt] = useState(true);
  const [autoTagPrompt, setAutoTagPrompt] = useState(true);
  const [coachTone, setCoachTone] = useState('plain');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      setShowSessionNote((await getSetting('show_session_note', '1')) !== '0');
      setWeightPrompt((await getSetting('weight_prompt_enabled', '1')) !== '0');
      setAutoTagPrompt((await getSetting('auto_tag_prompt', '1')) !== '0');
      setSoundOnSilent((await getSetting('sound_silent_override', '1')) === '1');
      setCoachTone(await getSetting('ai_coach_tone', 'plain'));
    })().catch(() => {});
  }, []);

  const flag = (key: string, set: (v: boolean) => void) => (v: boolean) => { set(v); setSetting(key, v ? '1' : '0').catch(() => {}); };
  const toggleSound = (v: boolean) => { setSoundOnSilent(v); setSetting('sound_silent_override', v ? '1' : '0').catch(() => {}); };
  const changeTone = (t: string) => { setCoachTone(t); setSetting('ai_coach_tone', t).catch(() => {}); };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try { await exportWorkoutsCsv(); } catch { Alert.alert('내보내기 실패', '잠시 후 다시 시도해주세요.'); } finally { setExporting(false); }
  };
  const handleResetOnboarding = () => {
    Alert.alert('온보딩 초기화', 'AI 인테이크 프로필을 삭제할까요?\nAI 탭에 다시 들어가면 온보딩이 처음부터 시작됩니다.', [
      { text: '취소', style: 'cancel' },
      { text: '초기화', style: 'destructive', onPress: async () => {
        try { await deleteAiProfile(); Alert.alert('완료', '온보딩이 초기화됐어요.'); }
        catch { Alert.alert('초기화 실패', '잠시 후 다시 시도해 주세요.'); }
      } },
    ]);
  };

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.content, bannerActive && styles.bannerPad]}>
        <Text style={styles.header}>설정</Text>

        {/* 계정 → 전용 페이지 */}
        {user && (
          <View style={styles.group}>
            <Row first icon="person" label={user.name} sub={`${user.email ?? '카카오 로그인'} · ${user.provider}`} onPress={() => router.push('/account')} />
          </View>
        )}

        {/* 트레이닝 — 무거운 목록은 페이지 이동 */}
        <Section title="트레이닝">
          <Row first icon="target" label="목표 설정" onPress={() => router.push('/goals')} />
          <Row icon="timer" label="종목별 휴식시간" onPress={() => router.push('/exercise-rest')} />
          <Row icon="tag" label="부위 관리" onPress={() => router.push('/body-parts')} />
          <Row icon="dumbbell" label="커스텀 운동" onPress={() => router.push('/custom-exercises')} />
        </Section>

        {/* 알림 */}
        <Section title="알림">
          <Row first icon="bell" label="휴식 알림" sub="무음에서도 휴식 완료음 (앱 사용 중)"
            right={<Switch value={soundOnSilent} onValueChange={toggleSound} trackColor={TRACK} thumbColor="#FFFFFF" />} />
          <Row icon="calendar" label="운동 리마인더" onPress={() => router.push('/workout-reminder')} />
        </Section>

        {/* 표시·동작 — 짧은 토글은 인라인 */}
        <Section title="표시 · 동작">
          <Row first label="세션 메모 칸 표시"
            right={<Switch value={showSessionNote} onValueChange={flag('show_session_note', setShowSessionNote)} trackColor={TRACK} thumbColor="#FFFFFF" />} />
          <Row label="체중 자동 팝업"
            right={<Switch value={weightPrompt} onValueChange={flag('weight_prompt_enabled', setWeightPrompt)} trackColor={TRACK} thumbColor="#FFFFFF" />} />
          <Row label="시작 시 부위 선택"
            right={<Switch value={autoTagPrompt} onValueChange={flag('auto_tag_prompt', setAutoTagPrompt)} trackColor={TRACK} thumbColor="#FFFFFF" />} />
        </Section>

        {/* AI 코치 톤 — 인라인 세그먼트 */}
        <Section title="AI 코치 톤">
          <View style={styles.segWrap}>
            <View style={styles.seg}>
              {TONES.map(([k, label]) => (
                <Pressable key={k} style={[styles.segItem, coachTone === k && styles.segOn]} onPress={() => changeTone(k)}>
                  <Text style={[styles.segT, coachTone === k && styles.segTOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Section>

        {/* 정보 */}
        <Section title="정보">
          <Row first icon="info" label="버전" value={version} />
          <Row icon="download" label="운동 기록 내보내기" value={exporting ? '내보내는 중…' : undefined} onPress={handleExport} />
          <Row icon="shield" label="개인정보처리방침" onPress={() => Alert.alert('개인정보처리방침', '준비 중이에요.')} />
          <Row icon="tool" label="개발자 도구 (온보딩 초기화)" onPress={handleResetOnboarding} />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <>
      {!!title && <Text style={styles.sectionHd}>{title}</Text>}
      <View style={styles.group}>{children}</View>
    </>
  );
}

function Row({ icon, label, value, onPress, right, first, sub }: {
  icon?: IconName; label: string; value?: string; onPress?: () => void; right?: React.ReactNode; first?: boolean; sub?: string;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.settingRow, !first && styles.settingRowDivider]}>
      {icon !== undefined && <View style={styles.iconChip}><SettingIcon name={icon} /></View>}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        {!!sub && <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {right ?? (
        <View style={styles.rowRight}>
          {value !== undefined && <Text style={styles.rowValue}>{value}</Text>}
          {!!onPress && <Text style={styles.rowChev}>›</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SEM.bg },
  content: { padding: 16, paddingBottom: 40 },
  bannerPad: { paddingBottom: 100 },
  header: { color: SEM.ink1, fontSize: 28, fontWeight: '800', marginBottom: 16 },

  sectionHd: { color: SEM.ink3, fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginLeft: 4 },
  group: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, paddingVertical: 11, minHeight: 48 },
  settingRowDivider: { borderTopWidth: 1, borderTopColor: SEM.line },
  iconChip: { width: 30, height: 30, borderRadius: 8, backgroundColor: SEM.surface3, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: SEM.ink1, fontSize: 15, fontWeight: '600' },
  rowSub: { color: SEM.ink3, fontSize: 11.5, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { color: SEM.ink3, fontSize: 13 },
  rowChev: { color: SEM.ink3, fontSize: 17, fontWeight: '600' },

  segWrap: { padding: 11 },
  seg: { flexDirection: 'row', gap: 6 },
  segItem: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: SEM.line, borderRadius: 9, paddingVertical: 8, backgroundColor: SEM.surface3 },
  segOn: { borderColor: SEM.brand },
  segT: { color: SEM.ink2, fontSize: 12.5, fontWeight: '700' },
  segTOn: { color: SEM.brand },
});
