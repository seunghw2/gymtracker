import { create } from 'zustand';

export type SetEntry = {
  setOrder: number;
  weight_kg: number;
  reps: number;
  done: boolean;
  estimated_1rm?: number;
};

export type ExerciseEntry = {
  exerciseId: number;
  exerciseName: string;
  brand: string | null;
  sets: SetEntry[];
};

type WorkoutState = {
  activeSessionId: number | null;
  sessionDate: string | null;
  sessionStartTime: number | null;
  exercises: ExerciseEntry[];
  restTimerActive: boolean;
  restTimerEnd: number | null;
  restTotalSec: number;
  restNextLabel: string | null;

  startSession: (sessionId: number, date: string) => void;
  finishSession: () => void;
  addExercise: (entry: ExerciseEntry) => void;
  updateSet: (exIdx: number, setIdx: number, data: Partial<SetEntry>) => void;
  addSetToExercise: (exIdx: number) => void;
  markSetDone: (exIdx: number, setIdx: number, estimated_1rm: number) => void;
  removeSet: (exIdx: number, setIdx: number) => void;
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

  setRestDuration: (sec: number) => void;
  setGoalWeight: (kg: number) => void;
  setGoalBodyFat: (pct: number) => void;
  setUnitKg: (isKg: boolean) => void;
};

export const useWorkoutStore = create<WorkoutState>((set) => ({
  activeSessionId: null,
  sessionDate: null,
  sessionStartTime: null,
  exercises: [],
  restTimerActive: false,
  restTimerEnd: null,
  restTotalSec: 0,
  restNextLabel: null,

  startSession: (sessionId, date) =>
    set({ activeSessionId: sessionId, sessionDate: date, sessionStartTime: Date.now(), exercises: [] }),

  finishSession: () =>
    set({ activeSessionId: null, sessionDate: null, sessionStartTime: null, exercises: [], restTimerActive: false, restTimerEnd: null, restNextLabel: null }),

  addExercise: (entry) =>
    set((state) => ({ exercises: [...state.exercises, entry] })),

  updateSet: (exIdx, setIdx, data) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) => j === setIdx ? { ...s, ...data } : s);
        return { ...ex, sets };
      });
      return { exercises };
    }),

  addSetToExercise: (exIdx) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const newSet: SetEntry = {
          setOrder: ex.sets.length + 1,
          weight_kg: last?.weight_kg ?? 60,
          reps: last?.reps ?? 10,
          done: false,
        };
        return { ...ex, sets: [...ex.sets, newSet] };
      });
      return { exercises };
    }),

  markSetDone: (exIdx, setIdx, estimated_1rm) =>
    set((state) => {
      const exercises = state.exercises.map((ex, i) => {
        if (i !== exIdx) return ex;
        const sets = ex.sets.map((s, j) => j === setIdx ? { ...s, done: true, estimated_1rm } : s);
        return { ...ex, sets };
      });
      return { exercises };
    }),

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
}));

export const useSettingsStore = create<SettingsState>((set) => ({
  restDurationSec: 90,
  goalWeightKg: 70,
  goalBodyFatPct: 15,
  unitKg: true,

  setRestDuration: (sec) => set({ restDurationSec: sec }),
  setGoalWeight: (kg) => set({ goalWeightKg: kg }),
  setGoalBodyFat: (pct) => set({ goalBodyFatPct: pct }),
  setUnitKg: (isKg) => set({ unitKg: isKg }),
}));
