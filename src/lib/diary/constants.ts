import type { MealType } from '@/src/types/stage3';

export const MEAL_TYPE_OPTIONS: Array<{
  value: MealType;
  labelVi: string;
}> = [
  { value: 'breakfast', labelVi: 'Bữa sáng' },
  { value: 'lunch', labelVi: 'Bữa trưa' },
  { value: 'dinner', labelVi: 'Bữa tối' },
  { value: 'snack', labelVi: 'Bữa phụ' },
];

export const MEAL_TYPE_LABELS: Record<MealType, string> =
  MEAL_TYPE_OPTIONS.reduce(
    (acc, item) => {
      acc[item.value] = item.labelVi;
      return acc;
    },
    {} as Record<MealType, string>
  );

export const DIARY_LIMITS = {
  MAX_ENTRIES_PER_DAY: 60,
  MAX_NAME_LENGTH: 150,
  MAX_GRAMS: 5000,
} as const;

export const SHOPPING_LIST_LIMITS = {
  MAX_ITEMS: 100,
  MAX_NAME_LENGTH: 150,
  MAX_QUANTITY_LENGTH: 60,
} as const;
