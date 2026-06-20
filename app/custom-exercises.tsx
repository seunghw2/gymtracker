import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SEM } from '../constants/colors';
import { getCustomExercises, deleteCustomExercise, updateExercise, Exercise } from '../db/queries';

/** 커스텀 운동 — 편집 모드 삭제 + 탭하여 이름 수정. (백엔드 정렬 필드 없음 → 정렬은 미지원) */
export default function CustomExercisesScreen() {
  const router = useRouter();
  const [list, setList] = useState<Exercise[]>([]);
  const [edit, setEdit] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');

  const load = useCallback(async () => { setList(await getCustomExercises().catch(() => [])); }, []);
  useEffect(() => { load(); }, [load]);

  const remove = (ex: Exercise) => {
    Alert.alert('삭제', `"${ex.name}"을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: async () => { await deleteCustomExercise(ex.id).catch(() => {}); load(); } },
    ]);
  };
  const commitRename = async (ex: Exercise) => {
    const t = renameVal.trim();
    setRenameId(null);
    if (t && t !== ex.name) {
      setList(prev => prev.map(e => (e.id === ex.id ? { ...e, name: t } : e)));
      await updateExercise(ex.id, { name: t }).catch(() => { load(); });
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ flex: 1 }}><Text style={s.navBack}>‹ 설정</Text></Pressable>
        <Text style={s.navTitle}>커스텀 운동</Text>
        <Pressable onPress={() => { setRenameId(null); setEdit(e => !e); }} hitSlop={10} style={{ flex: 1 }}>
          <Text style={s.edit}>{list.length > 0 ? (edit ? '완료' : '편집') : ''}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.group}>
          {list.length === 0 && <Text style={s.empty}>등록된 커스텀 운동이 없어요</Text>}
          {list.map((ex, i) => (
            <View key={ex.id} style={[s.row, i > 0 && s.rowDivider]}>
              {edit && (
                <Pressable onPress={() => remove(ex)} hitSlop={6}><View style={s.minus}><Text style={s.minusT}>−</Text></View></Pressable>
              )}
              {renameId === ex.id ? (
                <TextInput style={s.renameInput} value={renameVal} onChangeText={setRenameVal}
                  onEndEditing={() => commitRename(ex)} onSubmitEditing={() => commitRename(ex)} autoFocus returnKeyType="done" />
              ) : (
                <Pressable style={{ flex: 1 }} onPress={() => { if (!edit) { setRenameId(ex.id); setRenameVal(ex.name); } }}>
                  <Text style={s.name}>{ex.name}</Text>
                  <Text style={s.sub}>{ex.muscle_group} / {ex.equipment_type}</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SEM.bg },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  navBack: { color: SEM.brand, fontSize: 16, fontWeight: '600' },
  navTitle: { color: SEM.ink1, fontSize: 17, fontWeight: '800' },
  edit: { color: SEM.brand, fontSize: 15, fontWeight: '800', textAlign: 'right' },
  content: { padding: 16, paddingBottom: 40 },
  group: { backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 14, overflow: 'hidden' },
  empty: { color: SEM.ink4, fontSize: 13, textAlign: 'center', paddingVertical: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: SEM.line },
  minus: { width: 20, height: 20, borderRadius: 10, backgroundColor: SEM.brand, alignItems: 'center', justifyContent: 'center' },
  minusT: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 16 },
  name: { color: SEM.ink1, fontSize: 15, fontWeight: '600' },
  sub: { color: SEM.ink3, fontSize: 11.5, marginTop: 2 },
  renameInput: { flex: 1, color: SEM.ink1, fontSize: 15, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: SEM.brand, padding: 0, paddingBottom: 2 },
});
