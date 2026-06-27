export type RuleType = 'barbell_main' | 'machine_cable' | 'bodyweight' | 'isolation';
export type ProgressionStatus = 'in_progress' | 'ready_to_increase' | 'hold';
export type ProgressionTrigger = 'single' | 'two_sessions' | 'rpe';

export type ExerciseGoalSpec = {
  targetReps: number;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  increment: number;
};

export type SetResult = {
  reps: number;
  weightKg?: number;
  rpe?: number;
};

export type SessionResult = {
  date: string;  // YYYY-MM-DD
  sets: SetResult[];
};

export type NextTarget = {
  value: number;
  unit: 'kg' | 'reps';
  label: string;
};

export type PartSummary = {
  part: string;
  sessionCount: number;
  setCount: number;
};

export type GoalLine = {
  exerciseName: string;
  from: string;
  to: string;
  isHold: boolean;
};

export type ExerciseGoalForBuild = {
  exerciseName: string;
  ruleType: RuleType;
  currentValue: number | null;
  nextTargetLabel: string;
  muscleGroup: string;
};

// Equipment type 값: 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight'
// Muscle group 값: 'Chest' | 'Back' | 'Shoulder' | 'Legs' | 'Arms' | 'Core' | 'Cardio'
const COMPOUND_MUSCLES = new Set(['chest', 'back', 'legs', 'shoulder', 'shoulders']);

export function classifyRuleType(equipmentType: string, muscleGroup: string): RuleType {
  const eq = equipmentType.toLowerCase();
  const mg = muscleGroup.toLowerCase();
  if (eq === 'bodyweight') return 'bodyweight';
  if (eq === 'machine' || eq === 'cable') return 'machine_cable';
  if (eq === 'barbell' && COMPOUND_MUSCLES.has(mg)) return 'barbell_main';
  return 'isolation';
}

export function nextTarget(
  ruleType: RuleType,
  currentValue: number,
  spec: Pick<ExerciseGoalSpec, 'targetReps' | 'increment'>
): NextTarget {
  switch (ruleType) {
    case 'barbell_main':
    case 'machine_cable': {
      const raw = Math.round((currentValue + spec.increment) * 100) / 100;
      const label = Number.isInteger(raw) ? `${raw}kg` : `${raw}kg`;
      return { value: raw, unit: 'kg', label };
    }
    case 'bodyweight': {
      const raw = currentValue + spec.targetReps;
      return { value: raw, unit: 'reps', label: `${raw}회` };
    }
    case 'isolation':
      return { value: currentValue, unit: 'reps', label: '유지' };
  }
}

function sessionMeetsGoal(
  session: SessionResult,
  ruleType: RuleType,
  spec: ExerciseGoalSpec
): boolean {
  if (ruleType === 'isolation') return false;

  if (ruleType === 'bodyweight') {
    const total = session.sets.reduce((s, set) => s + set.reps, 0);
    return total >= spec.targetReps;
  }
  if (ruleType === 'barbell_main') {
    return session.sets.filter(s => s.reps >= spec.targetReps).length >= spec.targetSets;
  }
  // machine_cable: rep_range_max 달성
  return session.sets.filter(s => s.reps >= spec.repRangeMax).length >= spec.targetSets;
}

export function evaluateProgression(
  history: SessionResult[],
  spec: ExerciseGoalSpec,
  trigger: ProgressionTrigger,
  ruleType: RuleType
): ProgressionStatus {
  if (ruleType === 'isolation') return 'hold';
  if (history.length === 0) return 'in_progress';

  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));

  switch (trigger) {
    case 'single':
      return sessionMeetsGoal(sorted[0], ruleType, spec) ? 'ready_to_increase' : 'in_progress';

    case 'two_sessions':
      return sorted.length >= 2
        && sessionMeetsGoal(sorted[0], ruleType, spec)
        && sessionMeetsGoal(sorted[1], ruleType, spec)
        ? 'ready_to_increase' : 'in_progress';

    case 'rpe': {
      if (!sessionMeetsGoal(sorted[0], ruleType, spec)) return 'in_progress';
      const lastSet = sorted[0].sets[sorted[0].sets.length - 1];
      if (lastSet?.rpe === undefined) return 'ready_to_increase'; // RPE 없으면 single 폴백
      return lastSet.rpe <= 8 ? 'ready_to_increase' : 'in_progress';
    }
  }
}

export type SessionData = {
  date: string;  // YYYY-MM-DD
  sets: { muscleGroup: string }[];
};

export function weeklyPattern(sessions: SessionData[], weekStart: string): PartSummary[] {
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 6);
  const endStr = endDate.toISOString().split('T')[0];

  const map = new Map<string, { sessionDates: Set<string>; setCount: number }>();

  for (const session of sessions) {
    if (session.date < weekStart || session.date > endStr) continue;
    for (const set of session.sets) {
      const part = set.muscleGroup;
      if (!map.has(part)) map.set(part, { sessionDates: new Set(), setCount: 0 });
      const entry = map.get(part)!;
      entry.sessionDates.add(session.date);
      entry.setCount++;
    }
  }

  return [...map.entries()]
    .map(([part, { sessionDates, setCount }]) => ({ part, sessionCount: sessionDates.size, setCount }))
    .sort((a, b) => b.setCount - a.setCount);
}

export function buildNextWeekGoals(bodyPart: string, exerciseGoals: ExerciseGoalForBuild[]): GoalLine[] {
  return exerciseGoals
    .filter(g => g.muscleGroup.toLowerCase() === bodyPart.toLowerCase())
    .map(g => ({
      exerciseName: g.exerciseName,
      from: g.currentValue !== null
        ? (g.ruleType === 'bodyweight' ? `${g.currentValue}회` : `${g.currentValue}kg`)
        : '-',
      to: g.nextTargetLabel,
      isHold: g.ruleType === 'isolation',
    }));
}
