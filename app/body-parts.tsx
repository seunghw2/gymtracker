import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useRouter } from 'expo-router';
import { SEM } from '../constants/colors';
import { getBodyTags, setBodyTags } from '../db/queries';

/** 부위 관리 — 편집 모드(삭제·드래그 정렬) + 추가 + 탭하여 이름 수정. 순서는 부위 선택 팝업에 반영. */
export default function BodyPartsScreen() {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>([]);
  const [edit, setEdit] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [renameIdx, setRenameIdx] = useState<number | null>(null);
  const [renameVal, setRenameVal] = useState('');

  useEffect(() => { getBodyTags().then(setTags).catch(() => {}); }, []);

  const persist = (next: string[]) => { setTags(next); setBodyTags(next).catch(() => {}); };

  const add = () => {
    const t = newTag.trim();
    if (!t || tags.includes(t)) { setNewTag(''); return; }
    persist([...tags, t]);
    setNewTag('');
  };
  const remove = (i: number) => {
    Alert.alert('삭제', `"${tags[i]}" 부위를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => persist(tags.filter((_, j) => j !== i)) },
    ]);
  };
  const commitRename = () => {
    if (renameIdx == null) return;
    const t = renameVal.trim();
    if (t && !tags.some((x, j) => x === t && j !== renameIdx)) {
      persist(tags.map((x, j) => (j === renameIdx ? t : x)));
    }
    setRenameIdx(null);
  };

  const renderItem = ({ item, getIndex, drag, isActive }: RenderItemParams<string>) => {
    const i = getIndex() ?? 0;
    return (
      <View style={[s.row, isActive && s.rowActive]}>
        {edit && (
          <Pressable onPress={() => remove(i)} hitSlop={6}><View style={s.minus}><Text style={s.minusT}>−</Text></View></Pressable>
        )}
        {renameIdx === i ? (
          <TextInput
            style={s.renameInput}
            value={renameVal}
            onChangeText={setRenameVal}
            onEndEditing={commitRename}
            onSubmitEditing={commitRename}
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <Pressable style={{ flex: 1 }} onPress={() => { if (!edit) { setRenameIdx(i); setRenameVal(item); } }}>
            <Text style={s.name}>{item}</Text>
          </Pressable>
        )}
        {edit && <Pressable onPressIn={drag} hitSlop={8}><Text style={s.drag}>≡</Text></Pressable>}
      </View>
    );
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.nav}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ flex: 1 }}><Text style={s.navBack}>‹ 설정</Text></Pressable>
        <Text style={s.navTitle}>부위 관리</Text>
        <Pressable onPress={() => { setRenameIdx(null); setEdit(e => !e); }} hitSlop={10} style={{ flex: 1 }}>
          <Text style={s.edit}>{edit ? '완료' : '편집'}</Text>
        </Pressable>
      </View>

      <DraggableFlatList
        data={tags}
        keyExtractor={(t, i) => t + i}
        onDragEnd={({ data }) => persist(data)}
        activationDistance={12}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View style={s.addRow}>
            <TextInput style={s.addInput} placeholder="부위 이름 (예: 가슴)" placeholderTextColor={SEM.ink4}
              value={newTag} onChangeText={setNewTag} onSubmitEditing={add} returnKeyType="done" />
            <Pressable style={s.addBtn} onPress={add}><Text style={s.addBtnT}>추가</Text></Pressable>
          </View>
        )}
        renderItem={renderItem}
      />
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

  addRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addInput: { flex: 1, backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 11, color: SEM.ink1, fontSize: 14 },
  addBtn: { backgroundColor: SEM.brand, borderRadius: 11, paddingHorizontal: 18, justifyContent: 'center' },
  addBtnT: { color: SEM.onBrand, fontSize: 14, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: SEM.surface2, borderWidth: 1, borderColor: SEM.line, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 13, marginBottom: 8 },
  rowActive: { borderColor: SEM.brand },
  minus: { width: 20, height: 20, borderRadius: 10, backgroundColor: SEM.brand, alignItems: 'center', justifyContent: 'center' },
  minusT: { color: '#fff', fontSize: 15, fontWeight: '900', lineHeight: 16 },
  name: { color: SEM.ink1, fontSize: 15, fontWeight: '600' },
  renameInput: { flex: 1, color: SEM.ink1, fontSize: 15, fontWeight: '600', borderBottomWidth: 1, borderBottomColor: SEM.brand, padding: 0, paddingBottom: 2 },
  drag: { color: SEM.ink3, fontSize: 18, fontWeight: '700' },
});
