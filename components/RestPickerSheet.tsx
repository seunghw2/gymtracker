import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import {
  getExerciseRest,
  setExerciseRest,
  getExerciseWarmupRest,
  setExerciseWarmupRest,
} from '../db/queries';
import RulerPicker from './RulerPicker';
import { styles } from '../app/workout.styles';

function fmtRest(sec: number): string {
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

type Props = {
  visible: boolean;
  exerciseId: number | null;
  exerciseName: string;
  /** 본세트 기본 휴식(초) — 설정값 없을 때 폴백 */
  defaultMain: number;
  onClose: () => void;
};

/**
 * 종목별 휴식 시간(본세트/워밍업) 설정 다이얼 시트.
 * 열릴 때 저장값을 로드하고, 닫을 때 한 번 저장한다(workout.tsx에서 분리).
 */
export default function RestPickerSheet({ visible, exerciseId, exerciseName, defaultMain, onClose }: Props) {
  const [main, setMain] = useState(defaultMain);
  const [warm, setWarm] = useState(30);
  const [tab, setTab] = useState<'main' | 'warm'>('main');

  useEffect(() => {
    if (visible && exerciseId != null) {
      setTab('main');
      getExerciseRest(exerciseId, defaultMain).then(setMain).catch(() => setMain(defaultMain));
      getExerciseWarmupRest(exerciseId, 30).then(setWarm).catch(() => setWarm(30));
    }
  }, [visible, exerciseId]);

  // 휴식 시간 저장 후 닫기 (네트워크 저장은 닫을 때 한 번)
  const close = async () => {
    if (exerciseId != null) {
      await Promise.all([
        setExerciseRest(exerciseId, main).catch(() => {}),
        setExerciseWarmupRest(exerciseId, warm).catch(() => {}),
      ]);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable style={styles.menuOverlay} onPress={close}>
        <Pressable style={styles.menuSheet} onPress={() => {}}>
          <Text style={styles.menuHeader} numberOfLines={1}>
            휴식 시간 · {exerciseName}
          </Text>

          <View style={styles.restSeg}>
            {(['main', 'warm'] as const).map(t => (
              <Pressable key={t} style={[styles.restSegBtn, tab === t && styles.restSegBtnOn]} onPress={() => setTab(t)}>
                <Text style={[styles.restSegText, tab === t && styles.restSegTextOn]}>{t === 'main' ? '본세트' : '워밍업'}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.restReadout}>{fmtRest(tab === 'main' ? main : warm)}</Text>

          <RulerPicker
            initial={tab === 'main' ? main : warm}
            onChange={v => (tab === 'main' ? setMain(v) : setWarm(v))}
            min={0}
            max={600}
            step={5}
            majorEvery={30}
            midEvery={15}
            format={fmtRest}
          />

          <View style={styles.restAdjRow}>
            {[-30, -10, 10, 30].map(d => (
              <Pressable
                key={d}
                style={styles.restAdjBtn}
                onPress={() => {
                  const cur = tab === 'main' ? main : warm;
                  const next = Math.max(0, Math.min(600, cur + d));
                  (tab === 'main' ? setMain : setWarm)(next);
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.restAdjText}>{d > 0 ? `+${d}` : `${d}`}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.menuCancel} onPress={close}>
            <Text style={styles.menuCancelText}>완료</Text>
          </Pressable>
        </Pressable>
      </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
