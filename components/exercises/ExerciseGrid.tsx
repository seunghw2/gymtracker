import React from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, RefreshControl } from 'react-native';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { SEM, ACCENT, ACCENT_TINT } from '../../constants/colors';
import ExerciseCard from './ExerciseCard';
import type { CardData } from '../../lib/exerciseCard';

export type GridItem = {
  exerciseId: number;
  name: string;
  partLabel: string;
  equipLabel: string;
  dotColor: string;
  data: CardData;
};

type Props = {
  items: GridItem[];
  editing: boolean;
  draggable: boolean;          // 담은순 + 편집모드일 때만 드래그
  emptyLabel: string;          // 빈 상태 문구(그룹별로 다름)
  canAdd?: boolean;            // 시스템(자동) 그룹은 추가 불가
  onPressItem: (id: number) => void;
  onRemoveItem: (id: number) => void;
  onReorder: (from: number, to: number) => void;
  onAdd: () => void;
  refreshing: boolean;
  onRefresh: () => void;
};

export default function ExerciseGrid({
  items, editing, draggable, emptyLabel, canAdd = true, onPressItem, onRemoveItem, onReorder, onAdd, refreshing, onRefresh,
}: Props) {
  const addCard = (
    <Pressable style={s.addCard} onPress={onAdd}>
      <View style={s.addPlus}><Text style={s.addPlusT}>＋</Text></View>
      <Text style={s.addT}>종목 추가</Text>
    </Pressable>
  );
  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />;

  if (items.length === 0) {
    return (
      <FlatList
        data={[]}
        renderItem={null}
        style={s.flex1}
        refreshControl={refresh}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyIcon}>🗂️</Text>
            <Text style={s.emptyT}>{emptyLabel}</Text>
            {canAdd && <Pressable style={s.emptyAdd} onPress={onAdd}><Text style={s.emptyAddT}>＋ 종목 추가하기</Text></Pressable>}
          </View>
        }
      />
    );
  }

  // 편집 모드: 1열 드래그 리스트(담은순일 때만 드래그 활성, 아니면 ✕만)
  if (editing) {
    const renderItem = ({ item, drag, isActive }: RenderItemParams<GridItem>) => (
      <View style={s.rowCell}>
        <ExerciseCard
          data={item.data} name={item.name} partLabel={item.partLabel} equipLabel={item.equipLabel}
          dotColor={item.dotColor} onPress={() => onPressItem(item.exerciseId)}
          editing onRemove={() => onRemoveItem(item.exerciseId)}
          showHandle={draggable} drag={drag} isActive={isActive}
        />
      </View>
    );
    return (
      <DraggableFlatList
        data={items}
        keyExtractor={(it) => String(it.exerciseId)}
        onDragEnd={({ from, to }) => onReorder(from, to)}
        activationDistance={draggable ? 12 : 10000}
        containerStyle={s.flex1}
        style={s.flex1}
        contentContainerStyle={s.body}
        refreshControl={refresh}
        renderItem={renderItem}
        ListFooterComponent={canAdd ? addCard : null}
      />
    );
  }

  // 보기 모드: 2열 그리드
  return (
    <FlatList
      data={items}
      keyExtractor={(it) => String(it.exerciseId)}
      numColumns={2}
      columnWrapperStyle={s.colWrap}
      style={s.flex1}
      contentContainerStyle={s.body}
      refreshControl={refresh}
      renderItem={({ item }) => (
        <ExerciseCard
          data={item.data} name={item.name} partLabel={item.partLabel} equipLabel={item.equipLabel}
          dotColor={item.dotColor} onPress={() => onPressItem(item.exerciseId)}
        />
      )}
      ListFooterComponent={canAdd ? <View style={s.footer}>{addCard}</View> : null}
    />
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1 },
  body: { padding: 16, paddingBottom: 28, gap: 10 },
  colWrap: { gap: 10 },
  rowCell: { marginBottom: 10 },
  footer: { marginTop: 0 },

  addCard: { flex: 1, minHeight: 96, borderWidth: 1.5, borderColor: '#333', borderStyle: 'dashed', borderRadius: 15, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 18 },
  addPlus: { width: 34, height: 34, borderRadius: 17, backgroundColor: ACCENT_TINT, alignItems: 'center', justifyContent: 'center' },
  addPlusT: { color: ACCENT, fontSize: 20, fontWeight: '700' },
  addT: { color: ACCENT, fontSize: 14, fontWeight: '800' },

  empty: { alignItems: 'center', paddingVertical: 70, gap: 12 },
  emptyIcon: { fontSize: 40 },
  emptyT: { color: SEM.ink3, fontSize: 14 },
  emptyAdd: { marginTop: 4, paddingHorizontal: 16, paddingVertical: 10 },
  emptyAddT: { color: ACCENT, fontSize: 15, fontWeight: '800' },
});
