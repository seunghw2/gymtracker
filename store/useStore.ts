import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SetType = 'NORMAL' | 'WARMUP' | 'DROP' | 'FAILURE';

/** 세트 타입 순환 순서 (세트 번호 탭 시). */
export const SET_TYPE_CYCLE: SetType[] = ['NORMAL', 'WARMUP', 'DROP', 'FAILURE'];

export function nextSetType(t: SetType | undefined): SetType {
  const idx = SET_TYPE_CYCLE.indexOf(t ?? 'NORMAL');
  return SET_TYPE_CYCLE[(idx + 1) % SET_TYPE_CYCLE.length];
}

export type SetEntry = {
  setOrder: number;
  weight_kg: number;
  reps: number;
  done: boolean;
  estimated_1rm?: number;
  setId?: number;
  setType?: SetType;
  /** 이 세트가 종목 역대 최고 1RM을 갱신했는지 */
  isPR?: boolean;
  /** 시간 기반 세트의 지속 시간(초). undefined=횟수 기반 */
  durationSec?: number;
};

export type ExerciseEntry = {
  exerciseId: number;
  exerciseName: string;
  brand: string | null;
  sets: SetEntry[];
  /** 지난 세션의 원본 세트값 (입력 힌트용, 수정되지 않음) */
  lastSets?: { weight_kg: number; reps: number }[];
  /** 종목 영구 메모 (모든 세션 공통) */
  note?: string | null;
  /** 이번 세션의 그 종목 메모 */
  sessionNote?: string;
  /** 종목 추가 시점의 역대 최고 1RM (PR 판정 기준, 세션 내 갱신됨) */
  prevBest1rm?: number;
  /** 슈퍼세트 그룹 번호 (같은 번호 = 한 슈퍼세트). null=일반 */
  supersetGroup?: number | null;
  /** 시간 기반 종목(횟수 대신 시간 입력) */
  timeBased?: boolean;
  /** 맨몸 종목(중량 기본값 0으로 표시) */
  bodyweight?: boolean;
};

type WorkoutState = {
  activeSessionId: number | null;
  sessionDate: string | null;
  sessionStartTime: number | null;
  sessionTitle: string | null;
  sessionGymId: number | null;
  sessionTags: string[];
  exercises: ExerciseEntry[];
  restTimerActive: boolean;
  restTimerEnd: number | null;
  restTotalSec: number;
  restNextLabel: string | null;

  startSession: (sessionId: number, date: string, title?: string | null, gymId?: number | null) => void;
  setSessionTitle: (title: string) => void;
  setSessionGym: (gymId: number | null) => void;
  setSessionTags: (tags: string[]) => void;
  finishSession: () => void;
  addExercise: (entry: ExerciseEntry) => void;
  addExercises: (entries: ExerciseEntry[]) => void;
  updateSet: (exIdx: number, setIdx: number, data: Partial<SetEntry>) => void;
  cycleSetType: (exIdx: number, setIdx: number) => void;
  setExerciseNote: (exIdx: number, note: string) => void;
  setExerciseSessionNote: (exIdx: number, note: string) => void;
  setExercisePrevBest: (exIdx: number, best: number) => void;
  addSetToExercise: (exIdx: number) => void;
  prependWarmupSets: (exIdx: number, warmups: { weight_kg: number; reps: number }[]) => void;
  markSetDone: (exIdx: number, setIdx: number, estimated_1rm: number, setId: number, isPR?: boolean) => void;
  unmarkSetDone: (exIdx: number, setIdx: number) => void;
  reorderExercise: (from: number, to: number) => void;
  toggleTimeBased: (exIdx: number) => void;
  removeSet: (exIdx: number, setIdx: number) => void;
  removeExercise: (exIdx: number) => void;
  startRestTimer: (durationSec: number, info?: { nextLabel?: string }) => void;
  adjustRestTimer: (deltaSec: number) => void;
  setRestTimer: (durationSec: number) => void;
  stopRestTimer: () => void;
};

type SettingsState = {
  restDurationSec: number;
  goalWeightKg: number;
  goalBodyFatPct: number;
  unitKg: boolean;
  soundOnSilent: boolean;

  setRestDuration: (sec: number) => void;
  setGoalWeight: (kg: number) => void;
  setGoalBodyFat: (pct: number) => void;
  setUnitKg: (isKg: boolean) => void;
  setSoundOnSilent: (on: boolean) => void;
};

export const useWorkoutStore = create<WorkoutState>()(persist((set) => ({
  activeSessionId: null,
  sessionDate: null,
  sessionStartTime: null,
  sessionTitle: null,
  sessionGymId: null,
  sessionTags: [],
  exercises: [],
  restTimerActive: false,
  restTimerEnd: null,
  restTotalSec: 0,
  restNextLabel: null,

  startSession: (sessionId, date, title, gymId) =>
    set({ activeSessionId: sessionId, sessionDate: date, sessionStartTime: Date.now(), sessionTitle: title ?? null, sessionGymId: gymId ?? null, sessionTags: [], exercises: [] }),

  setSessionTitle: (title) => set({ sessionTitle: title }),
  setSessionGym: (gymId) => set({ sessionGymId: gymId }),
  setSessionTags: (tags) => set({ sessionTags: tags }),

  finishSession: () =>
    set({ activeSessionId: null, sessionDate: null, sessionStartTime: null, sessionTitle: null, sessionGymId: null, sessionTags: [], exercises: [], restTimerActive: false, restTimerEnd: null, restNextLabel: null }),

  addExercise: (entry) =>
    set((state) => ({ exercises: [...state.exercises, entry] })),

  addExercises: (entries) =>
    set((state) => ({ exercises: [...state.exercises, ...entries] })),

  updateSet: (exIdx, setIdx, data) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) => j === setIdx ? { ...s, ...data } : s);
        return { ...ex, sets };
      });
      return { exercises };
    }),

  prependWarmupSets: (exIdx, warmups) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const warmupSets: SetEntry[] = warmups.map(w => ({
          setOrder: 0, weight_kg: w.weight_kg, reps: w.reps, done: false, setType: 'WARMUP' as SetType,
        }));
        const merged = [...warmupSets, ...ex.sets].map((s, j) => ({ ...s, setOrder: j + 1 }));
        return { ...ex, sets: merged };
      });
      return { exercises };
    }),

  cycleSetType: (exIdx, setIdx) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) =>
          j === setIdx ? { ...s, setType: nextSetType(s.setType) } : s
        );
        return { ...ex, sets };
      });
      return { exercises };
    }),

  setExerciseNote: (exIdx, note) =>
    set((state) => ({
      exercises: state.exercises.map((ex, i) => i === exIdx ? { ...ex, note } : ex),
    })),

  setExerciseSessionNote: (exIdx, note) =>
    set((state) => ({
      exercises: state.exercises.map((ex, i) => i === exIdx ? { ...ex, sessionNote: note } : ex),
    })),

  setExercisePrevBest: (exIdx, best) =>
    set((state) => ({
      exercises: state.exercises.map((ex, i) => i === exIdx ? { ...ex, prevBest1rm: best } : ex),
    })),

  reorderExercise: (from, to) =>
    set((state) => {
      if (from === to || from < 0 || to < 0 || from >= state.exercises.length || to >= state.exercises.length) return state;
      const exercises = [...state.exercises];
      const [moved] = exercises.splice(from, 1);
      exercises.splice(to, 0, moved);
      return { exercises };
    }),

  addSetToExercise: (exIdx) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const newSet: SetEntry = {
          setOrder: ex.sets.length + 1,
          weight_kg: last?.weight_kg ?? 0,
          reps: last?.reps ?? 10,
          done: false,
          setType: 'NORMAL',
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      });
      return { exercises };
    }),

  markSetDone: (exIdx, setIdx, estimated_1rm, setId, isPR) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) => j === setIdx ? { ...s, done: true, estimated_1rm, setId, isPR: !!isPR } : s);
        // PR이면 종목 기준 최고치도 갱신
        const prevBest1rm = isPR ? estimated_1rm : ex.prevBest1rm;
        return { ...ex, sets, prevBest1rm };
      });
      return { exercises };
    }),

  unmarkSetDone: (exIdx, setIdx) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) => j === setIdx ? { ...s, done: false, setId: undefined, isPR: false } : s);
        return { ...ex, sets };
      });
      return { exercises };
    }),

  toggleTimeBased: (exIdx) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const timeBased = !ex.timeBased;
        // 시간 기반으로 켜면 각 세트에 기본 시간(초) 부여
        const sets = ex.sets.map(s => timeBased
          ? { ...s, durationSec: s.durationSec ?? 30 }
          : s);
        return { ...ex, timeBased, sets };
      });
      return { exercises };
    }),

  removeExercise: (exIdx) =>
    set((state) => ({ exercises: state.exercises.filter((_, i) => i !== exIdx) })),

  removeSet: (exIdx, setIdx) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets
          .filter((_, j) => j !== setIdx)
          .map((s, j) => ({ ...s, setOrder: j + 1 }));
        return { ...ex, sets };
      });
      return { exercises };
    }),

  startRestTimer: (durationSec, info) =>
    set({
      restTimerActive: true,
      restTimerEnd: Date.now() + durationSec * 1000,
      restTotalSec: durationSec,
      restNextLabel: info?.nextLabel ?? null,
    }),

  adjustRestTimer: (deltaSec) =>
    set((state) => {
      if (!state.restTimerActive || !state.restTimerEnd) return state;
      const newEnd = Math.max(Date.now() + 1000, state.restTimerEnd + deltaSec * 1000);
      const newTotal = Math.max(1, state.restTotalSec + deltaSec);
      return { restTimerEnd: newEnd, restTotalSec: newTotal };
    }),

  setRestTimer: (durationSec) =>
    set({
      restTimerActive: true,
      restTimerEnd: Date.now() + durationSec * 1000,
      restTotalSec: durationSec,
    }),

  stopRestTimer: () => set({ restTimerActive: false, restTimerEnd: null, restNextLabel: null }),
}), {
  name: 'workout-session',
  storage: createJSONStorage(() => AsyncStorage),
  // 진행 중 세션만 복구(휴식 타이머 상태는 제외 — 재시작 시 과거 시각 발화 방지)
  partialize: (s) => ({
    activeSessionId: s.activeSessionId,
    sessionDate: s.sessionDate,
    sessionStartTime: s.sessionStartTime,
    sessionTitle: s.sessionTitle,
    sessionGymId: s.sessionGymId,
    sessionTags: s.sessionTags,
    exercises: s.exercises,
  }),
}));

export const useSettingsStore = create<SettingsState>((set) => ({
  restDurationSec: 90,
  goalWeightKg: 70,
  goalBodyFatPct: 15,
  unitKg: true,
  soundOnSilent: true,

  setRestDuration: (sec) => set({ restDurationSec: sec }),
  setGoalWeight: (kg) => set({ goalWeightKg: kg }),
  setGoalBodyFat: (pct) => set({ goalBodyFatPct: pct }),
  setUnitKg: (isKg) => set({ unitKg: isKg }),
  setSoundOnSilent: (on) => set({ soundOnSilent: on }),
}));
