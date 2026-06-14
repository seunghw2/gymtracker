export type SeedExercise = {
  name: string;
  muscle_group: string;
  equipment_type: string;
  brand: string | null;
  is_system: 1;
  is_custom: 0;
};

export const SEED_EXERCISES: SeedExercise[] = [
  { name: 'Bench Press', muscle_group: 'Chest', equipment_type: 'Barbell', brand: null, is_system: 1, is_custom: 0 },
  { name: 'Incline Bench Press', muscle_group: 'Chest', equipment_type: 'Barbell', brand: null, is_system: 1, is_custom: 0 },
  { name: 'Chest Press', muscle_group: 'Chest', equipment_type: 'Machine', brand: 'Hammer Strength', is_system: 1, is_custom: 0 },
  { name: 'Chest Press', muscle_group: 'Chest', equipment_type: 'Machine', brand: 'Panatta', is_system: 1, is_custom: 0 },
  { name: 'Chest Press', muscle_group: 'Chest', equipment_type: 'Machine', brand: 'Nautilus', is_system: 1, is_custom: 0 },
  { name: 'Squat', muscle_group: 'Legs', equipment_type: 'Barbell', brand: null, is_system: 1, is_custom: 0 },
  { name: 'Deadlift', muscle_group: 'Back', equipment_type: 'Barbell', brand: null, is_system: 1, is_custom: 0 },
  { name: 'Pull Up', muscle_group: 'Back', equipment_type: 'Bodyweight', brand: null, is_system: 1, is_custom: 0 },
  { name: 'Shoulder Press', muscle_group: 'Shoulder', equipment_type: 'Dumbbell', brand: null, is_system: 1, is_custom: 0 },
  { name: 'Plank', muscle_group: 'Core', equipment_type: 'Bodyweight', brand: null, is_system: 1, is_custom: 0 },
];

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulder', 'Arms', 'Core'] as const;
export type MuscleGroup = typeof MUSCLE_GROUPS[number];

export const EQUIPMENT_TYPES = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight'] as const;
export type EquipmentType = typeof EQUIPMENT_TYPES[number];

export const MACHINE_BRANDS = ['Hammer Strength', 'Panatta', 'Nautilus', 'Life Fitness', 'Focus', 'Cybex', 'Newtech', '기타'] as const;
export type MachineBrand = typeof MACHINE_BRANDS[number];

/** 부위(영문 키) → 한글 라벨. */
export const MUSCLE_KO: Record<string, string> = {
  Chest: '가슴', Back: '등', Shoulder: '어깨', Legs: '하체', Arms: '팔', Core: '코어', Cardio: '유산소',
};

/** 장비(영문 키) → 한글 라벨. */
export const EQUIP_KO: Record<string, string> = {
  Barbell: '바벨', Dumbbell: '덤벨', Machine: '머신', Cable: '케이블', Bodyweight: '맨몸',
};

/** 부위별 식별 색(점·차트 공통). */
export const MUSCLE_COLOR: Record<string, string> = {
  Chest: '#E0655F', Back: '#5B9BE0', Shoulder: '#E0A33A', Legs: '#9B7BE0', Arms: '#E07FB0', Core: '#3FB6A8', Cardio: '#64D2FF',
};

/** 부위 표시 순서(필터·섹션 공통). */
export const PART_ORDER = ['Chest', 'Back', 'Shoulder', 'Legs', 'Core', 'Arms'] as const;
