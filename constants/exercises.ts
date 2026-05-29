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

export const MACHINE_BRANDS = ['Hammer Strength', 'Panatta', 'Nautilus', 'Life Fitness', 'Focus', 'Cybex', '기타'] as const;
export type MachineBrand = typeof MACHINE_BRANDS[number];
