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
  getGyms,
  addGym,
  deleteGym,
  getBodyTags,
  setBodyTags,
  getCustomExercises,
  deleteCustomExercise,
  getExercises,
  getSetting,
  setSetting,
  setExerciseRest,
  setExerciseTrackingType,
  Gym,
  Exercise,
} from '../../db/queries';
import { useSettingsStore } from '../../store/useStore';
import { useAuthStore } from '../../store/useAuthStore';
import { exportWorkoutsCsv } from '../../lib/export';

export default function SettingsScreen() {
  const {
    goalWeightKg, goalBodyFatPct, restDurationSec, unitKg, soundOnSilent,
    setGoalWeight, setGoalBodyFat, setRestDuration, setUnitKg, setSoundOnSilent,
  } = useSettingsStore();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      { text: '로그아웃', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const [gyms, setGyms] = useState<Gym[]>([]);
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [restByEx, setRestByEx] = useState<Record<number, string>>({});
  const [gymName, setGymName] = useState('');
  const [gymLocation, setGymLocation] = useState('');
  const [goalWeightInput, setGoalWeightInput] = useState(String(goalWeightKg));
  const [goalFatInput, setGoalFatInput] = useState(String(goalBodyFatPct));
  const [restInput, setRestInput] = useState(String(restDurationSec));
  const [showSessionNote, setShowSessionNote] = useState(true);
  const [weightPrompt, setWeightPrompt] = useState(true);
  const [autoTagPrompt, setAutoTagPrompt] = useState(true);
  const [bodyTags, setBodyTagsState] = useState<string[]>([]);
  const [newBodyTag, setNewBodyTag] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen(o => (o === id ? null : id));

  const load = useCallback(async () => {
    const [gymList, exList, allEx] = await Promise.all([getGyms(), getCustomExercises(), getExercises()]);
    setGyms(gymList);
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

  const handleAddGym = async () => {
    if (!gymName.trim()) return;
    await addGym(gymName.trim(), gymLocation.trim() || undefined);
    setGymName('');
    setGymLocation('');
    load();
  };

  const handleDeleteGym = (gym: Gym) => {
    Alert.alert('삭제', `"${gym.name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteGym(gym.id); load(); } },
    ]);
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>설정</Text>

        {/* 계정 */}
        {user && (
          <>
            <Pressable style={styles.catRow} onPress={() => toggle('account')}>
              <Text style={styles.catTitle}>계정</Text>
              <Text style={styles.catChevron}>{open === 'account' ? '⌄' : '›'}</Text>
            </Pressable>
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
            </View>
            )}
          </>
        )}

        {/* 목표 설정 */}
        <Pressable style={styles.catRow} onPress={() => toggle('goals')}>
          <Text style={styles.catTitle}>목표 설정</Text>
          <Text style={styles.catChevron}>{open === 'goals' ? '⌄' : '›'}</Text>
        </Pressable>
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
        <Pressable style={styles.catRow} onPress={() => toggle('unit')}>
          <Text style={styles.catTitle}>단위</Text>
          <Text style={styles.catChevron}>{open === 'unit' ? '⌄' : '›'}</Text>
        </Pressable>
        {open === 'unit' && (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>kg 단위 사용</Text>
            <Switch
              value={unitKg}
              onValueChange={toggleUnit}
              trackColor={{ false: '#3A3A3C', true: '#30D158' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        )}

        {/* 표시·동작 */}
        <Pressable style={styles.catRow} onPress={() => toggle('display')}>
          <Text style={styles.catTitle}>표시·동작</Text>
          <Text style={styles.catChevron}>{open === 'display' ? '⌄' : '›'}</Text>
        </Pressable>
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
              trackColor={{ false: '#3A3A3C', true: '#30D158' }}
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
              trackColor={{ false: '#3A3A3C', true: '#30D158' }}
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
              trackColor={{ false: '#3A3A3C', true: '#30D158' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        )}

        {/* 알림 */}
        <Pressable style={styles.catRow} onPress={() => toggle('rest')}>
          <Text style={styles.catTitle}>휴식 알림</Text>
          <Text style={styles.catChevron}>{open === 'rest' ? '⌄' : '›'}</Text>
        </Pressable>
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
              trackColor={{ false: '#3A3A3C', true: '#30D158' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        )}

        {/* 종목별 휴식시간 */}
        <Pressable style={styles.catRow} onPress={() => toggle('exRest')}>
          <Text style={styles.catTitle}>종목별 휴식시간</Text>
          <Text style={styles.catChevron}>{open === 'exRest' ? '⌄' : '›'}</Text>
        </Pressable>
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

        {/* 헬스장 관리 */}
        <Pressable style={styles.catRow} onPress={() => toggle('gym')}>
          <Text style={styles.catTitle}>헬스장 관리</Text>
          <Text style={styles.catChevron}>{open === 'gym' ? '⌄' : '›'}</Text>
        </Pressable>
        {open === 'gym' && (
        <View style={styles.card}>
          <TextInput
            style={styles.fullInput}
            placeholder="헬스장 이름"
            placeholderTextColor="#48484A"
            value={gymName}
            onChangeText={setGymName}
          />
          <TextInput
            style={[styles.fullInput, { marginTop: 8 }]}
            placeholder="위치 (선택)"
            placeholderTextColor="#48484A"
            value={gymLocation}
            onChangeText={setGymLocation}
          />
          <Pressable style={styles.addBtn} onPress={handleAddGym}>
            <Text style={styles.addBtnText}>+ 추가</Text>
          </Pressable>
          {gyms.map(gym => (
            <View key={gym.id} style={styles.listItem}>
              <View>
                <Text style={styles.listItemName}>{gym.name}</Text>
                {gym.location && <Text style={styles.listItemSub}>{gym.location}</Text>}
              </View>
              <Pressable onPress={() => handleDeleteGym(gym)}>
                <Text style={styles.deleteText}>삭제</Text>
              </Pressable>
            </View>
          ))}
          {gyms.length === 0 && (
            <Text style={styles.emptyText}>등록된 헬스장이 없습니다</Text>
          )}
        </View>
        )}

        {/* 부위 관리 */}
        <Pressable style={styles.catRow} onPress={() => toggle('bodyTags')}>
          <Text style={styles.catTitle}>부위 관리</Text>
          <Text style={styles.catChevron}>{open === 'bodyTags' ? '⌄' : '›'}</Text>
        </Pressable>
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
        <Pressable style={styles.catRow} onPress={() => toggle('data')}>
          <Text style={styles.catTitle}>데이터</Text>
          <Text style={styles.catChevron}>{open === 'data' ? '⌄' : '›'}</Text>
        </Pressable>
        {open === 'data' && (
        <View style={styles.card}>
          <Pressable style={styles.addBtn} onPress={handleExport} disabled={exporting}>
            <Text style={styles.addBtnText}>{exporting ? '내보내는 중…' : '운동 기록 CSV 내보내기'}</Text>
          </Pressable>
        </View>
        )}

        {/* 커스텀 운동 관리 */}
        <Pressable style={styles.catRow} onPress={() => toggle('custom')}>
          <Text style={styles.catTitle}>커스텀 운동</Text>
          <Text style={styles.catChevron}>{open === 'custom' ? '⌄' : '›'}</Text>
        </Pressable>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingBottom: 40 },
  header: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginBottom: 20 },

  sectionTitle: { color: '#8E8E93', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16, textTransform: 'uppercase' },

  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 8,
  },
  catTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  catChevron: { color: '#8E8E93', fontSize: 20, fontWeight: '700' },

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
    color: '#30D158',
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
    color: '#30D158',
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
    backgroundColor: '#30D158',
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
    borderColor: '#30D158',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  addBtnText: { color: '#30D158', fontSize: 15, fontWeight: '600' },

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
