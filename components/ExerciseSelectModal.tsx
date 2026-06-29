import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
  getExercises,
  addCustomExercise,
  getTrainedExercises,
  getSetting,
  setSetting,
  Exercise,
  TrainedExercise,
  TrackingType,
} from '../db/queries';
import {
  MUSCLE_GROUPS,
  EQUIPMENT_TYPES,
  MACHINE_BRANDS,
  MuscleGroup,
  EquipmentType,
} from '../constants/exercises';
import { styles } from '../app/workout.styles';

// 운동 추가 모달에서 선택 가능한 종목(목록·최근 종목 공통)
export type SelectableExercise = {
  id: number;
  name: string;
  brand: string | null;
  note?: string | null;
  tracking_type?: TrackingType;
};

type SelectStep = 'muscle' | 'equipment' | 'brand' | 'custom-brand' | 'list' | 'custom';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** "추가(N)" 탭 시 선택한 종목 목록을 부모에 전달(active/detail 분기는 부모가 처리). */
  onConfirm: (selected: SelectableExercise[]) => void;
};

/**
 * 운동 추가(부위→장비→브랜드→종목 선택, 즐겨찾기·검색·직접등록) 모달.
 * 단계·검색·선택 상태는 전부 내부에서 관리하고, 부모와는 visible/onClose/onConfirm만 주고받는다.
 * (workout.tsx에서 분리 — styles는 같은 시트를 공유.)
 */
export default function ExerciseSelectModal({ visible, onClose, onConfirm }: Props) {
  const [selectStep, setSelectStep] = useState<SelectStep>('muscle');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [exerciseList, setExerciseList] = useState<Exercise[]>([]);
  const [customName, setCustomName] = useState('');
  const [customTracking, setCustomTracking] = useState<'REPS' | 'TIME'>('REPS');
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [extraBrands, setExtraBrands] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [recents, setRecents] = useState<TrainedExercise[]>([]);
  const [modalSearch, setModalSearch] = useState('');
  const [searchAll, setSearchAll] = useState<Exercise[]>([]);
  const [favIds, setFavIds] = useState<number[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Record<number, SelectableExercise>>({});

  const loadExercises = useCallback(async () => {
    const list = await getExercises(
      selectedMuscle ?? undefined,
      selectedEquipment ?? undefined,
      selectedBrand ?? undefined,
    );
    setExerciseList(list);
  }, [selectedMuscle, selectedEquipment, selectedBrand]);

  useEffect(() => {
    if (selectStep === 'list') loadExercises();
  }, [selectStep, loadExercises]);

  // 모달 열릴 때 단계 초기화 + 최근 종목·전체 목록·즐겨찾기 로드
  useEffect(() => {
    if (visible) {
      setSelectStep('muscle');
      setSelectedMuscle(null);
      setSelectedEquipment(null);
      setSelectedBrand(null);
      setSearchText('');
      setModalSearch('');
      setSelectedToAdd({});
      getTrainedExercises().then(setRecents).catch(() => {});
      getExercises().then(setSearchAll).catch(() => {});
      getSetting('fav_exercises', '').then(v => {
        setFavIds(v ? v.split(',').map(Number).filter(Boolean) : []);
      }).catch(() => {});
    }
  }, [visible]);

  const toggleFav = (id: number) => {
    setFavIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setSetting('fav_exercises', next.join(',')).catch(() => {});
      return next;
    });
    Haptics.selectionAsync();
  };

  // 다중 선택: 종목을 탭하면 선택 토글(체크 표시), 하단 '추가(N)' 버튼으로 일괄 추가
  const toggleSelect = (ex: SelectableExercise) => {
    setSelectedToAdd(prev => {
      const next = { ...prev };
      if (next[ex.id]) delete next[ex.id];
      else next[ex.id] = ex;
      return next;
    });
    Haptics.selectionAsync();
  };

  const saveCustomExercise = async () => {
    if (!customName.trim() || !selectedMuscle || !selectedEquipment) return;
    await addCustomExercise(customName.trim(), selectedMuscle, selectedEquipment, selectedBrand ?? undefined, customTracking);
    setCustomName('');
    setCustomTracking('REPS');
    setSelectStep('list');
    loadExercises();
  };

  const handleConfirm = () => {
    const list = Object.values(selectedToAdd);
    if (list.length === 0) return;
    onConfirm(list);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.modalSafe}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => {
            if (selectStep === 'muscle') { onClose(); }
            else if (selectStep === 'equipment') setSelectStep('muscle');
            else if (selectStep === 'brand') setSelectStep('equipment');
            else if (selectStep === 'custom-brand') setSelectStep('brand');
            else if (selectStep === 'list') setSelectStep(selectedEquipment === 'Machine' ? 'brand' : 'equipment');
            else if (selectStep === 'custom') setSelectStep('list');
          }}>
            <Text style={styles.modalBack}>← 뒤로</Text>
          </Pressable>
          <Text style={styles.modalTitle}>
            {selectStep === 'muscle' && '운동 추가'}
            {selectStep === 'equipment' && '장비 선택'}
            {selectStep === 'brand' && '브랜드 선택'}
            {selectStep === 'custom-brand' && '브랜드 직접 입력'}
            {selectStep === 'list' && '운동 선택'}
            {selectStep === 'custom' && '직접 등록'}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        {selectStep === 'muscle' && (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <TextInput
                style={styles.searchInput}
                placeholder="종목 검색"
                placeholderTextColor="#48484A"
                value={modalSearch}
                onChangeText={setModalSearch}
                clearButtonMode="while-editing"
              />
            </View>
            {modalSearch.trim() ? (
              <FlatList
                data={searchAll.filter(e => e.name.toLowerCase().includes(modalSearch.trim().toLowerCase()))}
                keyExtractor={item => String(item.id)}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[styles.modalContent, Object.keys(selectedToAdd).length > 0 && { paddingBottom: 110 }]}
                renderItem={({ item }) => {
                  const on = !!selectedToAdd[item.id];
                  return (
                    <View style={[styles.exItem, on && styles.exItemOn]}>
                      <Pressable style={styles.exItemMain} onPress={() => toggleSelect(item)}>
                        <Text style={styles.exName} numberOfLines={1}>{on ? '✓ ' : ''}{item.name}</Text>
                        {item.brand && <Text style={styles.exBrand} numberOfLines={1}>{item.brand}</Text>}
                      </Pressable>
                      <Pressable onPress={() => toggleFav(item.id)} hitSlop={8}>
                        <Text style={styles.favStar}>{favIds.includes(item.id) ? '⭐' : '☆'}</Text>
                      </Pressable>
                    </View>
                  );
                }}
              />
            ) : (
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                {searchAll.filter(e => favIds.includes(e.id)).length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.quickAddTitle}>⭐ 즐겨찾기</Text>
                    <View style={styles.chipWrap}>
                      {searchAll.filter(e => favIds.includes(e.id)).map(f => {
                        const on = !!selectedToAdd[f.id];
                        return (
                          <Pressable key={f.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleSelect(f)}>
                            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{on ? '✓ ' : ''}{f.name}</Text>
                            {f.brand && <Text style={styles.chipBrand} numberOfLines={1}>{f.brand}</Text>}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
                {recents.length > 0 && (
                  <View style={{ marginBottom: 20 }}>
                    <Text style={styles.quickAddTitle}>최근 종목 · 빠른 추가</Text>
                    <View style={styles.chipWrap}>
                      {recents.slice(0, 6).map(r => {
                        const on = !!selectedToAdd[r.id];
                        return (
                          <Pressable key={r.id} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleSelect(r)}>
                            <Text style={[styles.chipText, on && styles.chipTextOn]} numberOfLines={1}>{on ? '✓ ' : ''}{r.name}</Text>
                            {r.brand && <Text style={styles.chipBrand} numberOfLines={1}>{r.brand}</Text>}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
                <Text style={styles.quickAddTitle}>부위로 찾기</Text>
                <View style={styles.muscleGrid}>
                  {MUSCLE_GROUPS.map(mg => (
                    <Pressable key={mg} style={styles.muscleBtn} onPress={() => { setSelectedMuscle(mg); setSelectStep('equipment'); }}>
                      <Text style={styles.muscleBtnText}>{mg}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {selectStep === 'equipment' && (
          <View style={styles.modalContent}>
            {EQUIPMENT_TYPES.map(eq => (
              <Pressable key={eq} style={styles.choiceBtn} onPress={() => {
                setSelectedEquipment(eq);
                setSelectStep(eq === 'Machine' ? 'brand' : 'list');
              }}>
                <Text style={styles.choiceText}>{eq}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {selectStep === 'brand' && (
          <ScrollView contentContainerStyle={styles.modalContent}>
            {[...MACHINE_BRANDS, ...extraBrands].map(b => (
              <Pressable
                key={b}
                style={styles.choiceBtn}
                onPress={() => { setSelectedBrand(b); setSelectStep('list'); }}
              >
                <Text style={styles.choiceText}>{b}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.choiceBtn, styles.choiceBtnOutline]}
              onPress={() => { setCustomBrandInput(''); setSelectStep('custom-brand'); }}
            >
              <Text style={[styles.choiceText, { color: '#FF3B30' }]}>+ 직접 등록</Text>
            </Pressable>
          </ScrollView>
        )}

        {selectStep === 'custom-brand' && (
          <View style={styles.modalContent}>
            <Text style={styles.customFormLabel}>브랜드 이름</Text>
            <TextInput
              style={styles.input}
              placeholder="예: Technogym, Matrix..."
              placeholderTextColor="#48484A"
              value={customBrandInput}
              onChangeText={setCustomBrandInput}
              autoFocus
            />
            <Pressable
              style={[styles.saveBtn, { marginTop: 16 }, !customBrandInput.trim() && { opacity: 0.4 }]}
              onPress={() => {
                const brand = customBrandInput.trim();
                if (!brand) return;
                setExtraBrands(prev => [...prev, brand]);
                setCustomBrandInput('');
                setSelectStep('brand');
                Alert.alert('브랜드 추가', `${brand} 브랜드가 추가되었습니다.`);
              }}
              disabled={!customBrandInput.trim()}
            >
              <Text style={styles.saveBtnText}>저장</Text>
            </Pressable>
          </View>
        )}

        {selectStep === 'list' && (
          <FlatList
            data={exerciseList.filter(e =>
              e.name.toLowerCase().includes(searchText.trim().toLowerCase())
            )}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={[styles.modalContent, Object.keys(selectedToAdd).length > 0 && { paddingBottom: 110 }]}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <TextInput
                style={styles.searchInput}
                placeholder="종목 검색"
                placeholderTextColor="#48484A"
                value={searchText}
                onChangeText={setSearchText}
                clearButtonMode="while-editing"
              />
            }
            renderItem={({ item }) => {
              const on = !!selectedToAdd[item.id];
              return (
                <Pressable style={[styles.exItem, on && styles.exItemOn]} onPress={() => toggleSelect(item)}>
                  <View>
                    <Text style={styles.exName}>{item.name}</Text>
                    {item.brand && <Text style={styles.exBrand}>{item.brand}</Text>}
                  </View>
                  <Text style={[styles.exArrow, on && styles.exCheck]}>{on ? '✓' : '＋'}</Text>
                </Pressable>
              );
            }}
            ListFooterComponent={
              <Pressable style={styles.customBtn} onPress={() => { setCustomName(''); setSelectStep('custom'); }}>
                <Text style={styles.customBtnText}>+ 직접 등록</Text>
              </Pressable>
            }
          />
        )}

        {selectStep === 'custom' && (
          <View style={styles.modalContent}>
            <Text style={styles.customFormLabel}>운동 이름</Text>
            <TextInput
              style={styles.input}
              placeholder="예: 케이블 크런치"
              placeholderTextColor="#48484A"
              value={customName}
              onChangeText={setCustomName}
              autoFocus
            />
            <Text style={styles.customFormSub}>
              부위: {selectedMuscle}  |  장비: {selectedEquipment}{selectedBrand ? `  |  브랜드: ${selectedBrand}` : ''}
            </Text>
            <Text style={styles.customFormLabel}>측정 방식</Text>
            <View style={styles.trackingRow}>
              {(['REPS', 'TIME'] as const).map(t => (
                <Pressable
                  key={t}
                  style={[styles.trackingBtn, customTracking === t && styles.trackingBtnOn]}
                  onPress={() => setCustomTracking(t)}
                >
                  <Text style={[styles.trackingText, customTracking === t && styles.trackingTextOn]}>
                    {t === 'REPS' ? '횟수·무게' : '시간(초)'}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.saveBtn, !customName.trim() && { opacity: 0.4 }]}
              onPress={saveCustomExercise}
              disabled={!customName.trim()}
            >
              <Text style={styles.saveBtnText}>저장하고 추가</Text>
            </Pressable>
          </View>
        )}

        {/* 다중 선택 일괄 추가 바 */}
        {Object.keys(selectedToAdd).length > 0 && (
          <View style={styles.addBar}>
            <Pressable style={styles.addBarBtn} onPress={handleConfirm}>
              <Text style={styles.addBarBtnText}>추가 ({Object.keys(selectedToAdd).length}개)</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
