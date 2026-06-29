import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GoalSettingDto, ExerciseGoalDto,
  GoalSettingRequest, ExerciseGoalBulkRequest, ExerciseGoalUpdateRequest,
  getGoalSetting, upsertGoalSetting, getExerciseGoals,
  bulkCreateExerciseGoals, updateExerciseGoal, resetOnboarding,
} from '../db/api/overload';

type OverloadState = {
  goalSetting: GoalSettingDto | null;
  exerciseGoals: ExerciseGoalDto[];

  loadGoalSetting: () => Promise<void>;
  loadExerciseGoals: () => Promise<void>;
  saveGoalSetting: (req: GoalSettingRequest) => Promise<GoalSettingDto | null>;
  bulkCreateGoals: (req: ExerciseGoalBulkRequest) => Promise<ExerciseGoalDto[]>;
  updateGoal: (id: number, req: ExerciseGoalUpdateRequest) => Promise<void>;
  resetOnboarding: () => Promise<void>;
};

export const useOverloadStore = create<OverloadState>()(
  persist(
    (set) => ({
      goalSetting: null,
      exerciseGoals: [],

      loadGoalSetting: async () => {
        const gs = await getGoalSetting();
        set({ goalSetting: gs });
      },

      loadExerciseGoals: async () => {
        try {
          const goals = await getExerciseGoals();
          set({ exerciseGoals: goals });
        } catch {
          // 네트워크 오류 시 캐시 유지
        }
      },

      saveGoalSetting: async (req) => {
        try {
          const gs = await upsertGoalSetting(req);
          set({ goalSetting: gs });
          return gs;
        } catch {
          return null;
        }
      },

      bulkCreateGoals: async (req) => {
        try {
          const goals = await bulkCreateExerciseGoals(req);
          set({ exerciseGoals: goals });
          return goals;
        } catch {
          return [];
        }
      },

      resetOnboarding: async () => {
        await resetOnboarding();
        // 게이트가 다시 닫히도록 로컬 onboarded 플래그도 즉시 내림
        set(s => ({
          goalSetting: s.goalSetting ? { ...s.goalSetting, onboarded: false } : null,
        }));
      },

      updateGoal: async (id, req) => {
        try {
          const updated = await updateExerciseGoal(id, req);
          set(s => ({
            exerciseGoals: s.exerciseGoals.map(g => (g.id === id ? updated : g)),
          }));
        } catch {
          // 네트워크 오류 무시, 로컬 캐시 유지
        }
      },
    }),
    {
      name: 'overload-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ goalSetting: s.goalSetting, exerciseGoals: s.exerciseGoals }),
    }
  )
);
