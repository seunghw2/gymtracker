import { useEffect, useRef, useState } from 'react';
import { Keyboard, Dimensions, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useWorkoutStore, SetEntry } from '../store/useStore';
import { useUiStore } from '../store/useUiStore';
import { updateWorkoutSet } from '../db/queries';
import { toDisplay, fromInput } from '../lib/units';
import { epley } from '../lib/format';

type EditKind = 'weight' | 'reps' | 'duration';

type Opts = {
  unitKg: boolean;
  weightStep: number;
  rowRefs: React.MutableRefObject<Map<string, View>>;
  listRef: React.MutableRefObject<any>;
  scrollY: React.MutableRefObject<number>;
};

/**
 * 앱 자체 숫자패드로 세트의 무게/횟수/시간을 편집하는 상태·핸들러 묶음.
 * 세트 셀과 NumPad UI는 부모가 그대로 렌더하고, 편집 상태·키 입력·저장 로직만 이 훅이 가진다.
 * (workout.tsx에서 분리 — rowRefs/listRef/scrollY는 부모 렌더와 공유하므로 주입받는다.)
 */
export function useSetEditor({ unitKg, weightStep, rowRefs, listRef, scrollY }: Opts) {
  const exercises = useWorkoutStore(s => s.exercises);
  const updateSet = useWorkoutStore(s => s.updateSet);
  const setNumPadOpen = useUiStore(s => s.setNumPadOpen);
  const [edit, setEdit] = useState<{ exIdx: number; setIdx: number; kind: EditKind } | null>(null);
  const [editValue, setEditValue] = useState('');
  const replaceOnNextRef = useRef(true); // 숫자패드 첫 입력 시 기존 값 교체

  // 숫자패드 열림 상태를 전역에 알려 전역 휴식 타이머가 위로 비켜서게 함
  useEffect(() => {
    setNumPadOpen(edit != null);
    return () => setNumPadOpen(false);
  }, [edit, setNumPadOpen]);

  const fieldValueStr = (s: SetEntry, kind: EditKind) => {
    if (kind === 'weight') return String(toDisplay(s.weight_kg, unitKg));
    if (kind === 'duration') return String(s.durationSec ?? 0);
    return String(s.reps);
  };

  const beginEdit = (exIdx: number, setIdx: number, kind: EditKind) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    Keyboard.dismiss(); // 메모 등 시스템 키보드 닫고 앱 내 숫자패드 표시
    setEdit({ exIdx, setIdx, kind });
    setEditValue(fieldValueStr(s, kind));
    replaceOnNextRef.current = true; // 첫 키 입력 시 기존 값 비우고 새로 입력
    Haptics.selectionAsync();
    // 편집하는 세트 행이 숫자패드 위에 보이도록 스크롤(행 기준 정밀)
    setTimeout(() => {
      const node = rowRefs.current.get(`${exIdx}-${setIdx}`);
      node?.measure((_x, _y, _w, h, _px, py) => {
        const winH = Dimensions.get('window').height;
        const padTop = winH - 320; // 숫자패드 상단 추정선
        const overflow = (py + h + 12) - padTop;
        if (overflow > 0) listRef.current?.scrollToOffset({ offset: scrollY.current + overflow, animated: true });
      });
    }, 80);
  };

  const commitEdit = (exIdx: number, setIdx: number, kind: EditKind, valStr: string) => {
    const s = exercises[exIdx]?.sets[setIdx];
    if (!s) return;
    if (kind === 'weight') {
      const kg = fromInput(parseFloat(valStr) || 0, unitKg);
      updateSet(exIdx, setIdx, { weight_kg: kg, estimated_1rm: epley(kg, s.reps) });
      if (s.done && s.setId) updateWorkoutSet(s.setId, kg, s.reps, s.setType ?? 'NORMAL').catch(() => {});
    } else if (kind === 'reps') {
      const reps = parseInt(valStr) || 0;
      updateSet(exIdx, setIdx, { reps, estimated_1rm: epley(s.weight_kg, reps) });
      if (s.done && s.setId) updateWorkoutSet(s.setId, s.weight_kg, reps, s.setType ?? 'NORMAL').catch(() => {});
    } else {
      updateSet(exIdx, setIdx, { durationSec: parseInt(valStr) || 0 });
    }
  };

  const handleNumKey = (d: string) => {
    if (!edit) return;
    const allowDecimal = edit.kind === 'weight';
    let next = editValue;
    if (replaceOnNextRef.current) { next = ''; replaceOnNextRef.current = false; }
    if (d === '.') {
      if (!allowDecimal || next.includes('.')) return;
      next = next === '' ? '0.' : next + '.';
    } else {
      next = (next === '0' ? '' : next) + d;
    }
    if (next.replace('.', '').length > 5) return;
    setEditValue(next);
    commitEdit(edit.exIdx, edit.setIdx, edit.kind, next);
  };

  const handleNumBackspace = () => {
    if (!edit) return;
    replaceOnNextRef.current = false;
    const next = editValue.slice(0, -1);
    setEditValue(next);
    commitEdit(edit.exIdx, edit.setIdx, edit.kind, next);
  };

  const handleNumStep = (delta: 1 | -1) => {
    if (!edit) return;
    replaceOnNextRef.current = false;
    const s = exercises[edit.exIdx]?.sets[edit.setIdx];
    if (!s) return;
    let nv: string;
    if (edit.kind === 'weight') {
      const cur = parseFloat(editValue);
      const base = Number.isFinite(cur) ? cur : toDisplay(s.weight_kg, unitKg);
      nv = String(Math.max(0, Math.round((base + delta * weightStep) * 100) / 100));
    } else {
      const cur = parseInt(editValue);
      const base = Number.isFinite(cur) ? cur : (edit.kind === 'duration' ? (s.durationSec ?? 0) : s.reps);
      nv = String(Math.max(0, base + delta));
    }
    setEditValue(nv);
    commitEdit(edit.exIdx, edit.setIdx, edit.kind, nv);
  };

  const handleNumNext = () => {
    if (!edit) return;
    const ex = exercises[edit.exIdx];
    const repsKind: 'reps' | 'duration' = ex?.timeBased ? 'duration' : 'reps';
    if (edit.kind === 'weight') {
      beginEdit(edit.exIdx, edit.setIdx, repsKind);
    } else {
      // 다음 세트의 무게로
      if (ex && edit.setIdx + 1 < ex.sets.length) beginEdit(edit.exIdx, edit.setIdx + 1, 'weight');
      else setEdit(null);
    }
  };

  const closeEdit = () => setEdit(null);

  return { edit, editValue, beginEdit, handleNumKey, handleNumBackspace, handleNumStep, handleNumNext, closeEdit };
}
