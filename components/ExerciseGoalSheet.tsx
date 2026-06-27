import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { ACCENT, SEM } from '../constants/colors';
import type { ExerciseGoalDto, ExerciseRole } from '../db/api/overload';
import { useOverloadStore } from '../store/useOverloadStore';
import { getSessionHistory } from '../db/api/sessions';
import type { SessionSummary } from '../db/api/types';
import SessionPreviewSheet from './SessionPreviewSheet';

const ROLE_LABEL: Record<ExerciseRole, string> = {
  core: '핵심', support: '보조', log_only: '기록만',
};
const ROLE_DESC: Record<ExerciseRole, string> = {
  core: '직접 타깃 — 다음 목표를 적극 추적',
  support: '부위 볼륨·밸런스에 기여',
  log_only: '기록만 남김 (목표 추적 안 함)',
};

const RULE_LABEL: Record<string, string> = {
  barbell_main: '바벨 메인', machine_cable: '머신 / 케이블',
  bodyweight: '맨몸', isolation: '고립',
};

const MG_KOR: Record<string, string> = {
  Chest: '가슴', Back: '등', Shoulder: '어깨', Legs: '하체',
  Arms: '팔', Core: '코어', Cardio: '유산소',
};

/** 종목 진행도 상세 바텀시트 — 역할·오늘 목표·증량 조건·비교 신뢰도·역할 수정. */
export default function ExerciseGoalSheet({ goal, onClose }: {
  goal: ExerciseGoalDto | null;
  onClose: () => void;
}) {
  const updateGoal = useOverloadStore(s => s.updateGoal);
  const [roleEditing, setRoleEditing] = useState(false);
  const [previewSession, setPreviewSession] = useState<SessionSummary | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // 지난 기록 탭 → 그 날짜의 세션 찾아 미리보기
  const openLastSession = async () => {
    if (!goal?.lastRecordDate || loadingSession) return;
    setLoadingSession(true);
    try {
      const list = await getSessionHistory(90);
      const found = list.find(s => s.date === goal.lastRecordDate);
      if (found) setPreviewSession(found);
    } catch { /* ignore */ }
    setLoadingSession(false);
  };

  if (!goal) return null;

  const compLabel = goal.comparability === 'high' ? '비교 가능'
    : goal.comparability === 'medium' ? '참고 비교' : '비교 보류';
  const compColor = goal.comparability === 'high' ? SEM.good
    : goal.comparability === 'medium' ? SEM.warn : SEM.muted;

  const setRole = async (role: ExerciseRole) => {
    setRoleEditing(false);
    await updateGoal(goal.id, { role });
  };

  const needBase = goal.stage === 'NEED_BASELINE';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 헤더 */}
            <Text style={s.name}>{goal.exerciseName ?? '종목'}</Text>
            <View style={s.roleRow}>
              <View style={[s.roleBadge, roleColor(goal.role)]}>
                <Text style={[s.roleBadgeT, { color: roleTextColor(goal.role) }]}>{ROLE_LABEL[goal.role]}</Text>
              </View>
              <Text style={s.metaText}>
                {goal.muscleGroup ? MG_KOR[goal.muscleGroup] ?? goal.muscleGroup : ''} · {RULE_LABEL[goal.ruleType] ?? goal.ruleType}
              </Text>
            </View>

            {/* 현재 단계 */}
            <Section label="현재 단계">
              <Text style={s.bigRecord}>{goal.stageLabel}</Text>
            </Section>

            {/* 현재 상태 / 지난 기록 — 탭하면 그 운동 세션으로 */}
            {!needBase && goal.lastRecord && (
              <Section label="지난 비교 가능 기록">
                <Pressable
                  onPress={openLastSession}
                  disabled={!goal.lastRecordDate || loadingSession}
                  style={({ pressed }) => [pressed && { opacity: 0.6 }]}
                >
                  <View style={s.lastRow}>
                    <Text style={s.bigRecord}>{goal.lastRecord}</Text>
                    {goal.lastRecordDate && <Text style={s.lastChevron}>›</Text>}
                  </View>
                  {goal.lastRecordDate && (
                    <Text style={s.lastHint}>{loadingSession ? '여는 중…' : '탭하면 그날 운동 기록으로'}</Text>
                  )}
                </Pressable>
                <View style={[s.compChip, { borderColor: compColor }]}>
                  <Text style={[s.compChipT, { color: compColor }]}>{compLabel}</Text>
                </View>
              </Section>
            )}

            {/* 오늘 목표 */}
            <Section label="오늘 목표">
              <Text style={s.bigRecord}>{goal.todayTarget}</Text>
              {goal.caution && <Text style={s.cautionText}>⚠ {goal.caution}</Text>}
            </Section>

            {/* 다음 단계 조건 */}
            <Section label="다음 단계">
              <Text style={s.bodyText}>{goal.nextCondition}</Text>
            </Section>

            {/* 단기/장기 목표 */}
            {(goal.shortTermTarget || goal.longTermTarget) && (
              <Section label="목표">
                {goal.shortTermTarget && <Text style={s.bodyText}>단기: {goal.shortTermTarget}</Text>}
                {goal.longTermTarget && <Text style={[s.bodyText, { marginTop: 4 }]}>장기: {goal.longTermTarget}</Text>}
              </Section>
            )}

            {/* 역할 수정 */}
            <Section label="역할">
              {!roleEditing ? (
                <Pressable style={s.roleEditBtn} onPress={() => setRoleEditing(true)}>
                  <Text style={s.roleEditDesc}>{ROLE_DESC[goal.role]}</Text>
                  <Text style={s.roleEditLink}>변경</Text>
                </Pressable>
              ) : (
                <View style={s.roleOptions}>
                  {(['core', 'support', 'log_only'] as ExerciseRole[]).map(r => (
                    <Pressable key={r} style={[s.roleOpt, goal.role === r && s.roleOptOn]} onPress={() => setRole(r)}>
                      <Text style={[s.roleOptT, goal.role === r && s.roleOptTOn]}>{ROLE_LABEL[r]}</Text>
                      <Text style={s.roleOptD}>{ROLE_DESC[r]}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Section>
          </ScrollView>

          <Pressable style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnT}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>

      {/* 지난 기록 세션 미리보기 */}
      <SessionPreviewSheet session={previewSession} onClose={() => setPreviewSession(null)} />
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function roleColor(role: ExerciseRole) {
  if (role === 'core') return { backgroundColor: 'rgba(255,59,48,0.14)', borderColor: 'rgba(255,59,48,0.4)' };
  if (role === 'support') return { backgroundColor: '#1f1f23', borderColor: '#2c2c2e' };
  return { backgroundColor: '#141416', borderColor: '#1c1c1e' };
}
function roleTextColor(role: ExerciseRole) {
  if (role === 'core') return ACCENT;
  if (role === 'support') return '#c8c8ce';
  return '#6a6a6e';
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#111113', borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 20, paddingBottom: 28, maxHeight: '85%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3a3a3c', alignSelf: 'center', marginBottom: 16 },

  name: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 4 },
  roleBadge: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3 },
  roleBadgeT: { fontSize: 11.5, fontWeight: '800' },
  metaText: { fontSize: 13, color: SEM.muted },

  section: { marginTop: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: SEM.muted, letterSpacing: 0.5,
    textTransform: 'uppercase', marginBottom: 8 },
  bodyText: { fontSize: 14, color: '#d8d8de', lineHeight: 20 },
  bodyTextDim: { fontSize: 12.5, color: SEM.muted, marginTop: 4 },
  bigRecord: { fontSize: 19, fontWeight: '800', color: '#fff', marginTop: 2 },
  noBaseline: { fontSize: 14, color: SEM.muted, fontStyle: 'italic', lineHeight: 20 },
  cautionText: { fontSize: 12.5, color: SEM.warn, marginTop: 6, lineHeight: 18 },
  lastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastChevron: { fontSize: 22, color: ACCENT, fontWeight: '700' },
  lastHint: { fontSize: 11.5, color: ACCENT, marginTop: 2 },

  compChip: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  compChipT: { fontSize: 12, fontWeight: '800' },

  roleEditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleEditDesc: { flex: 1, fontSize: 13.5, color: '#d8d8de' },
  roleEditLink: { fontSize: 13.5, fontWeight: '800', color: ACCENT, marginLeft: 12 },
  roleOptions: { gap: 8 },
  roleOpt: { borderWidth: 1, borderColor: SEM.line, borderRadius: 12, padding: 12, backgroundColor: '#0d0d0f' },
  roleOptOn: { borderColor: ACCENT, backgroundColor: 'rgba(255,59,48,0.08)' },
  roleOptT: { fontSize: 14, fontWeight: '800', color: '#fff' },
  roleOptTOn: { color: ACCENT },
  roleOptD: { fontSize: 12, color: SEM.muted, marginTop: 2 },

  closeBtn: { marginTop: 18, height: 50, borderRadius: 14, backgroundColor: '#1c1c22',
    alignItems: 'center', justifyContent: 'center' },
  closeBtnT: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
