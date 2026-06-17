import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  SafeAreaView,
  Switch,
} from 'react-native';
import {
  getBodyTags,
  setBodyTags,
  getCustomExercises,
  deleteCustomExercise,
  getExercises,
  getSetting,
  setSetting,
  setExerciseRest,
  setExerciseTrackingType,
  deleteAiProfile,
  Exercise,
} from '../../db/queries';
import { useSettingsStore, useWorkoutStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { exportWorkoutsCsv } from '../../lib/export';
import { getReminderSettings, setReminderSettings, ReminderSettings } from '../../lib/reminders';

const stepStyles = StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#FF3B30', fontSize: 20, fontWeight: '800' },
  stepVal: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', minWidth: 52, textAlign: 'center', fontVariant: ['tabular-nums'] },
  toneRow: { flexDirection: 'row', gap: 8 },
  toneChip: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: '#2A2A2E' },
  toneChipOn: { backgroundColor: '#241011', borderColor: '#FF3B30' },
  toneLabel: { color: '#8E8E93', fontSize: 14, fontWeight: '800' },
  toneLabelOn: { color: '#fff' },
  toneDesc: { color: '#5E5E66', fontSize: 10.5, marginTop: 3 },
  toneDescOn: { color: '#FF7A70' },
});

export default function SettingsScreen() {
  const {
    goalWeightKg, goalBodyFatPct, restDurationSec, unitKg, soundOnSilent,
    setGoalWeight, setGoalBodyFat, setRestDuration, setUnitKg, setSoundOnSilent,
  } = useSettingsStore();
  const { user, logout, deleteAccount } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // 회원탈퇴 — 이중 확인 후 모든 데이터 영구 삭제
  const handleDeleteAccount = () => {
    Alert.alert('회원탈퇴', '계정과 모든 운동 기록이 영구 삭제됩니다.\n이 작업은 되돌릴 수 없어요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '계속', style: 'destructive', onPress: () => {
          Alert.alert('정말 탈퇴할까요?', '삭제된 데이터는 복구할 수 없습니다.', [
            { text: '취소', style: 'cancel' },
            {
              text: '영구 삭제', style: 'destructive', onPress: async () => {
                try {
                  await deleteAccount();
                } catch {
                  Alert.alert('탈퇴 실패', '잠시 후 다시 시도해 주세요.');
                }
              },
            },
          ]);
        },
      },
    ]);
  };

  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [restByEx, setRestByEx] = useState<Record<number, string>>({});
  const [goalWeightInput, setGoalWeightInput] = useState(String(goalWeightKg));
  const [goalFatInput, setGoalFatInput] = useState(String(goalBodyFatPct));
  const [restInput, setRestInput] = useState(String(restDurationSec));
  const [reminder, setReminder] = useState<ReminderSettings>({ enabled: false, days: 2, hour: 19 });

  useEffect(() => { getReminderSettings().then(setReminder).catch(() => {}); }, []);
  const updateReminder = (next: ReminderSettings) => {
    setReminder(next);
    setReminderSettings(next).catch(() => {});
  };
  const [coachTone, setCoachTone] = useState('plain');
  useEffect(() => { getSetting('ai_coach_tone', 'plain').then(setCoachTone).catch(() => {}); }, []);
  const changeTone = (t: string) => { setCoachTone(t); setSetting('ai_coach_tone', t).catch(() => {}); };
  const [showSessionNote, setShowSessionNote] = useState(true);
  const [weightPrompt, setWeightPrompt] = useState(true);
  const [autoTagPrompt, setAutoTagPrompt] = useState(true);
  const [bodyTags, setBodyTagsState] = useState<string[]>([]);
  const [newBodyTag, setNewBodyTag] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen(o => (o === id ? null : id));
  const Cat = (id: string, icon: string, title: string) => {
    const on = open === id;
    return (
      <Pressable style={[styles.catRow, on && styles.catRowOpen]} onPress={() => toggle(id)}>
        <View style={styles.catLeft}>
          <Text style={styles.catIcon}>{icon}</Text>
          <Text style={styles.catTitle}>{title}</Text>
        </View>
        <Text style={[styles.catChevron, on && styles.catChevronOpen]}>{on ? '⌄' : '›'}</Text>
      </Pressable>
    );
  };

  const load = useCallback(async () => {
    const [exList, allEx] = await Promise.all([getCustomExercises(), getExercises()]);
    setCustomExercises(exList);
    setAllExercises(allEx);

    const gw = await getSetting('goal_weight_kg', String(goalWeightKg));
    const gf = await getSetting('goal_body_fat_pct', String(goalBodyFatPct));
    const rd = await getSetting('rest_duration_sec', String(restDurationSec));
    const uk = await getSetting('unit_kg', '1');
    const sos = await getSetting('sound_silent_override', '1');
    const ssn = await getSetting('show_session_note', '1');
    const wpe = await getSetting('weight_prompt_enabled', '1');
    const atp = await getSetting('auto_tag_prompt', '1');
    setShowSessionNote(ssn !== '0');
    setWeightPrompt(wpe !== '0');
    setAutoTagPrompt(atp !== '0');
    setBodyTagsState(await getBodyTags());

    const restMap: Record<number, string> = {};
    for (const ex of allEx) {
      const v = await getSetting(`rest_ex_${ex.id}`, '');
      if (v) restMap[ex.id] = v;
    }
    setRestByEx(restMap);

    setGoalWeight(parseFloat(gw));
    setGoalBodyFat(parseFloat(gf));
    setRestDuration(parseInt(rd));
    setUnitKg(uk === '1');
    setSoundOnSilent(sos === '1');

    setGoalWeightInput(gw);
    setGoalFatInput(gf);
    setRestInput(rd);
  }, []);

  const toggleTracking = async (ex: Exercise) => {
    const next = ex.tracking_type === 'TIME' ? 'REPS' : 'TIME';
    setAllExercises(prev => prev.map(e => e.id === ex.id ? { ...e, tracking_type: next } : e));
    await setExerciseTrackingType(ex.id, next).catch(() => {});
  };

  const saveExerciseRest = async (exId: number) => {
    const raw = restByEx[exId];
    const n = parseInt(raw ?? '', 10);
    if (Number.isFinite(n) && n > 0) {
      await setExerciseRest(exId, n);
    }
  };

  useEffect(() => { load(); }, [load]);

  const saveGoals = async () => {
    const gw = parseFloat(goalWeightInput);
    const gf = parseFloat(goalFatInput);
    const rd = parseInt(restInput);
    if (isNaN(gw) || isNaN(gf) || isNaN(rd)) {
      Alert.alert('오류', '올바른 숫자를 입력하세요.');
      return;
    }
    await Promise.all([
      setSetting('goal_weight_kg', String(gw)),
      setSetting('goal_body_fat_pct', String(gf)),
      setSetting('rest_duration_sec', String(rd)),
    ]);
    setGoalWeight(gw);
    setGoalBodyFat(gf);
    setRestDuration(rd);
    Alert.alert('저장됨');
  };

  const handleDeleteExercise = (ex: Exercise) => {
    Alert.alert('삭제', `"${ex.name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteCustomExercise(ex.id); load(); } },
    ]);
  };

  const toggleUnit = async (val: boolean) => {
    setUnitKg(val);
    await setSetting('unit_kg', val ? '1' : '0');
  };

  const toggleSoundOnSilent = async (val: boolean) => {
    setSoundOnSilent(val);
    await setSetting('sound_silent_override', val ? '1' : '0');
  };

  const toggleShowSessionNote = async (val: boolean) => {
    setShowSessionNote(val);
    await setSetting('show_session_note', val ? '1' : '0');
  };

  const toggleWeightPrompt = async (val: boolean) => {
    setWeightPrompt(val);
    await setSetting('weight_prompt_enabled', val ? '1' : '0');
  };

  const toggleAutoTagPrompt = async (val: boolean) => {
    setAutoTagPrompt(val);
    await setSetting('auto_tag_prompt', val ? '1' : '0');
  };

  const handleAddBodyTag = async () => {
    const t = newBodyTag.trim();
    if (!t || bodyTags.includes(t)) { setNewBodyTag(''); return; }
    const next = [...bodyTags, t];
    setBodyTagsState(next);
    setNewBodyTag('');
    await setBodyTags(next);
  };

  const handleDeleteBodyTag = async (t: string) => {
    const next = bodyTags.filter(x => x !== t);
    setBodyTagsState(next);
    await setBodyTags(next);
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportWorkoutsCsv();
    } catch {
      Alert.alert('내보내기 실패', '잠시 후 다시 시도해주세요.');
    } finally {
      setExporting(false);
    }
  };

  // 개발자 도구 — 온보딩(AI 인테이크 프로필) 초기화 후 다시 테스트
  const handleResetOnboarding = () => {
    Alert.alert('온보딩 초기화', 'AI 인테이크 프로필을 삭제할까요?\nAI 탭에 다시 들어가면 온보딩이 처음부터 시작됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화', style: 'destructive', onPress: async () => {
          try {
            await deleteAiProfile();
            Alert.alert('완료', '온보딩이 초기화됐어요. AI 탭에서 다시 시작하세요.');
          } catch {
            Alert.alert('초기화 실패', '잠시 후 다시 시도해 주세요.');
          }
        },
      },
    ]);
  };

  const bannerActive = useWorkoutStore(s => s.activeSessionId != null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={[styles.content, bannerActive && styles.bannerPad]}>
        <Text style={styles.header}>설정</Text>

        {/* 계정 */}
        {user && (
          <>
            {Cat('account', '👤', '계정')}
            {open === 'account' && (
            <View style={styles.card}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.label}>{user.name}</Text>
                  <Text style={[styles.listItemSub, { marginTop: 4 }]}>
                    {user.email ?? '카카오 로그인'}  ·  {user.provider}
                  </Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Pressable onPress={handleLogout} style={styles.row}>
                <Text style={[styles.label, { color: '#FF453A' }]}>로그아웃</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable onPress={handleDeleteAccount} style={styles.row}>
                <Text style={[styles.label, { color: '#8E8E93' }]}>회원탈퇴</Text>
              </Pressable>
            </View>
            )}
          </>
        )}

        {/* 목표 설정 */}
        {Cat('goals', '🎯', '목표 설정')}
        {open === 'goals' && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>목표 체중 (kg)</Text>
            <TextInput
              style={styles.input}
              value={goalWeightInput}
              onChangeText={setGoalWeightInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>목표 체지방률 (%)</Text>
            <TextInput
              style={styles.input}
              value={goalFatInput}
              onChangeText={setGoalFatInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>기본 휴식 시간 (초)</Text>
            <TextInput
              style={styles.input}
              value={restInput}
              onChangeText={setRestInput}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
          <Pressable style={styles.saveBtn} onPress={saveGoals}>
            <Text style={styles.saveBtnText}>저장</Text>
          </Pressable>
        </View>
        )}

        {/* 단위 설정 */}
        {Cat('unit', '⚖️', '단위')}
        {open === 'unit' && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>kg 단위 사용</Text>
            <Switch
              value={unitKg}
              onValueChange={toggleUnit}
              trackColor={{ false: '#3A3A3C', true: '#FF3B30' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        )}

        {/* 표시·동작 */}
        {Cat('display', '🎚', '표시·동작')}
        {open === 'display' && (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.label}>세션 메모 칸 표시</Text>
              <Text style={[styles.listItemSub, { marginTop: 4 }]}>
                운동 화면에 세션 메모 입력칸을 표시
              </Text>
            </View>
            <Switch
              value={showSessionNote}
              onValueChange={toggleShowSessionNote}
              trackColor={{ false: '#3A3A3C', true: '#FF3B30' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.label}>체중 자동 팝업</Text>
              <Text style={[styles.listItemSub, { marginTop: 4 }]}>
                홈 진입 시 당일 체중 미입력이면 자동으로 팝업
              </Text>
            </View>
            <Switch
              value={weightPrompt}
              onValueChange={toggleWeightPrompt}
              trackColor={{ false: '#3A3A3C', true: '#FF3B30' }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.label}>시작 시 부위 선택 자동 표시</Text>
              <Text style={[styles.listItemSub, { marginTop: 4 }]}>
                운동 시작하면 부위 선택 팝업을 바로 표시
              </Text>
            </View>
            <Switch
              value={autoTagPrompt}
              onValueChange={toggleAutoTagPrompt}
              trackColor={{ false: '#3A3A3C', true: '#FF3B30' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        )}

        {/* 알림 */}
        {Cat('rest', '🔔', '휴식 알림')}
        {open === 'rest' && (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.label}>무음 모드에서도 소리</Text>
              <Text style={[styles.listItemSub, { marginTop: 4 }]}>
                휴대폰이 무음이어도 휴식 완료음 재생 (앱 사용 중)
              </Text>
            </View>
            <Switch
              value={soundOnSilent}
              onValueChange={toggleSoundOnSilent}
              trackColor={{ false: '#3A3A3C', true: '#FF3B30' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        )}

        {/* 운동 리마인더 */}
        {Cat('reminder', '📅', '운동 리마인더')}
        {open === 'reminder' && (
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.label}>며칠 쉬면 알림</Text>
              <Text style={[styles.listItemSub, { marginTop: 4 }]}>
                마지막 운동 후 설정한 날만큼 쉬면 알려줘요 (앱이 닫혀 있어도)
              </Text>
            </View>
            <Switch
              value={reminder.enabled}
              onValueChange={v => updateReminder({ ...reminder, enabled: v })}
              trackColor={{ false: '#3A3A3C', true: '#FF3B30' }}
              thumbColor="#FFFFFF"
            />
          </View>
          {reminder.enabled && (
            <>
              <View style={[styles.row, { marginTop: 14 }]}>
                <Text style={styles.label}>쉬는 일수</Text>
                <View style={stepStyles.stepper}>
                  <Pressable style={stepStyles.stepBtn} onPress={() => updateReminder({ ...reminder, days: Math.max(1, reminder.days - 1) })}><Text style={stepStyles.stepText}>−</Text></Pressable>
                  <Text style={stepStyles.stepVal}>{reminder.days}일</Text>
                  <Pressable style={stepStyles.stepBtn} onPress={() => updateReminder({ ...reminder, days: Math.min(14, reminder.days + 1) })}><Text style={stepStyles.stepText}>+</Text></Pressable>
                </View>
              </View>
              <View style={[styles.row, { marginTop: 12 }]}>
                <Text style={styles.label}>알림 시각</Text>
                <View style={stepStyles.stepper}>
                  <Pressable style={stepStyles.stepBtn} onPress={() => updateReminder({ ...reminder, hour: (reminder.hour + 23) % 24 })}><Text style={stepStyles.stepText}>−</Text></Pressable>
                  <Text style={stepStyles.stepVal}>{String(reminder.hour).padStart(2, '0')}:00</Text>
                  <Pressable style={stepStyles.stepBtn} onPress={() => updateReminder({ ...reminder, hour: (reminder.hour + 1) % 24 })}><Text style={stepStyles.stepText}>+</Text></Pressable>
                </View>
              </View>
            </>
          )}
        </View>
        )}

        {/* AI 코치 톤 */}
        {Cat('coachTone', '💬', 'AI 코치 톤')}
        {open === 'coachTone' && (
        <View style={styles.card}>
          <Text style={[styles.listItemSub, { marginBottom: 12 }]}>리포트·코치·채팅의 말투를 정해요.</Text>
          <View style={stepStyles.toneRow}>
            {([['plain', '담백', '담담하게'], ['cheer', '응원', '밝게 격려'], ['blunt', '직설', '단도직입']] as const).map(([k, label, desc]) => (
              <Pressable key={k} style={[stepStyles.toneChip, coachTone === k && stepStyles.toneChipOn]} onPress={() => changeTone(k)}>
                <Text style={[stepStyles.toneLabel, coachTone === k && stepStyles.toneLabelOn]}>{label}</Text>
                <Text style={[stepStyles.toneDesc, coachTone === k && stepStyles.toneDescOn]}>{desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        )}

        {/* 종목별 휴식시간 */}
        {Cat('exRest', '⏱', '종목별 휴식시간')}
        {open === 'exRest' && (
        <View style={styles.card}>
          <Text style={[styles.listItemSub, { marginBottom: 4 }]}>
            비워두면 기본 {restDurationSec}초 적용
          </Text>
          {allExercises.map(ex => (
            <View key={ex.id} style={styles.listItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listItemName}>{ex.name}</Text>
                {ex.brand && <Text style={styles.listItemSub}>{ex.brand}</Text>}
              </View>
              <Pressable onPress={() => toggleTracking(ex)} style={[styles.trackChip, ex.tracking_type === 'TIME' && styles.trackChipOn]} hitSlop={6}>
                <Text style={[styles.trackChipText, ex.tracking_type === 'TIME' && styles.trackChipTextOn]}>
                  {ex.tracking_type === 'TIME' ? '⏱ 시간' : '횟수'}
                </Text>
              </Pressable>
              <TextInput
                style={styles.restInput}
                value={restByEx[ex.id] ?? ''}
                onChangeText={t => setRestByEx(prev => ({ ...prev, [ex.id]: t.replace(/[^0-9]/g, '') }))}
                onEndEditing={() => saveExerciseRest(ex.id)}
                keyboardType="number-pad"
                placeholder={String(restDurationSec)}
                placeholderTextColor="#48484A"
                selectTextOnFocus
              />
            </View>
          ))}
          {allExercises.length === 0 && (
            <Text style={styles.emptyText}>종목이 없습니다</Text>
          )}
        </View>
        )}

        {/* 부위 관리 */}
        {Cat('bodyTags', '🏷', '부위 관리')}
        {open === 'bodyTags' && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              style={[styles.fullInput, { flex: 1 }]}
              placeholder="부위 이름 (예: 가슴)"
              placeholderTextColor="#48484A"
              value={newBodyTag}
              onChangeText={setNewBodyTag}
              onSubmitEditing={handleAddBodyTag}
              returnKeyType="done"
            />
            <Pressable style={[styles.addBtn, { marginTop: 0, paddingHorizontal: 18, justifyContent: 'center' }]} onPress={handleAddBodyTag}>
              <Text style={styles.addBtnText}>추가</Text>
            </Pressable>
          </View>
          {bodyTags.map(t => (
            <View key={t} style={styles.listItem}>
              <Text style={styles.listItemName}>{t}</Text>
              <Pressable onPress={() => handleDeleteBodyTag(t)}>
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </View>
          ))}
          {bodyTags.length === 0 && (
            <Text style={styles.emptyText}>등록된 부위가 없습니다</Text>
          )}
        </View>
        )}

        {/* 데이터 */}
        {Cat('data', '💾', '데이터')}
        {open === 'data' && (
        <View style={styles.card}>
          <Pressable style={styles.addBtn} onPress={handleExport} disabled={exporting}>
            <Text style={styles.addBtnText}>{exporting ? '내보내는 중…' : '운동 기록 CSV 내보내기'}</Text>
          </Pressable>
        </View>
        )}

        {/* 커스텀 운동 관리 */}
        {Cat('custom', '🏋️', '커스텀 운동')}
        {open === 'custom' && (
        <View style={styles.card}>
          {customExercises.map(ex => (
            <View key={ex.id} style={styles.listItem}>
              <View>
                <Text style={styles.listItemName}>{ex.name}</Text>
                <Text style={styles.listItemSub}>{ex.muscle_group} / {ex.equipment_type}</Text>
              </View>
              <Pressable onPress={() => handleDeleteExercise(ex)}>
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </View>
          ))}
          {customExercises.length === 0 && (
            <Text style={styles.emptyText}>등록된 커스텀 운동이 없습니다</Text>
          )}
        </View>
        )}

        {/* 개발자 도구 */}
        {Cat('dev', '🛠', '개발자 도구')}
        {open === 'dev' && (
        <View style={styles.card}>
          <Text style={[styles.listItemSub, { marginBottom: 4 }]}>
            테스트용 도구입니다. 신중히 사용하세요.
          </Text>
          <Pressable style={[styles.addBtn, styles.devBtn]} onPress={handleResetOnboarding}>
            <Text style={[styles.addBtnText, styles.devBtnText]}>온보딩 초기화 (AI 프로필 삭제)</Text>
          </Pressable>
        </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingBottom: 40 },
  bannerPad: { paddingBottom: 100 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 20 },

  sectionTitle: { color: '#8E8E93', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },

  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginTop: 10,
  },
  catRowOpen: { backgroundColor: '#242426', borderColor: '#FF3B30', borderWidth: 1, marginBottom: 2 },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  catIcon: { fontSize: 18, width: 24, textAlign: 'center' },
  catTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  catChevron: { color: '#8E8E93', fontSize: 22, fontWeight: '700' },
  catChevronOpen: { color: '#FF3B30' },

  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  divider: { height: 1, backgroundColor: '#2C2C2E', marginVertical: 8 },
  label: { color: '#FFFFFF', fontSize: 16 },
  input: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 70,
    fontVariant: ['tabular-nums'],
  },
  trackChip: { backgroundColor: '#2C2C2E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  trackChipOn: { backgroundColor: '#0A3D62' },
  trackChipText: { color: '#8E8E93', fontSize: 12, fontWeight: '600' },
  trackChipTextOn: { color: '#5AB0FF' },
  restInput: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    minWidth: 64,
    backgroundColor: '#2C2C2E',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontVariant: ['tabular-nums'],
  },

  saveBtn: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnText: { color: '#000000', fontSize: 16, fontWeight: '700' },

  fullInput: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 15,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  addBtnText: { color: '#FF3B30', fontSize: 15, fontWeight: '600' },
  devBtn: { borderColor: '#FF453A' },
  devBtnText: { color: '#FF453A' },

  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
    marginTop: 4,
  },
  listItemName: { color: '#FFFFFF', fontSize: 15 },
  listItemSub: { color: '#8E8E93', fontSize: 12, marginTop: 2 },
  deleteText: { color: '#FF453A', fontSize: 14 },
  emptyText: { color: '#48484A', fontSize: 14, textAlign: 'center', paddingVertical: 12 },
});
