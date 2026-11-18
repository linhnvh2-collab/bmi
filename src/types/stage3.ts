import type { FoodCategory, NutrientsPer100g, VerificationStatus } from './food';

export type GoalType =
  | 'maintain'
  | 'lose_gradual'
  | 'gain_gradual'
  | 'healthy_habits';

export type CalorieTargetAdjustmentReason =
  | 'none'
  | 'maintain'
  | 'healthy_habits'
  | 'clamped_weekly_loss_max'
  | 'clamped_weekly_gain_max'
  | 'clamped_deficit_max'
  | 'clamped_surplus_max'
  | 'clamped_min_kcal';

export interface UserGoal {
  userId: string;
  goalType: GoalType;
  startDate: string; // YYYY-MM-DD
  startWeightKg: number;
  targetWeightKg: number | null;
  weeklyChangeKg: number;
  targetKcal: number | null;
  educationalConfirmed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserGoalInput {
  goalType: GoalType;
  startDate: string;
  startWeightKg: number;
  targetWeightKg: number | null;
  weeklyChangeKg: number;
  targetKcal: number | null;
  educationalConfirmed: boolean;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type DiaryEntrySource = 'database' | 'custom';

export interface DiaryEntry {
  id: string;
  mealType: MealType;
  source: DiaryEntrySource;
  foodId: string | null;
  name: string;
  grams: number;
  nutrientsPer100gSnapshot: NutrientsPer100g;
  verificationStatusSnapshot: VerificationStatus;
  loggedAt: string; // ISO 8601 timestamp
}

export interface FoodDiaryDay {
  userId: string;
  date: string; // YYYY-MM-DD
  entries: DiaryEntry[];
  updatedAt: Date;
}

export interface ShoppingListItem {
  id: string;
  name: string;
  category: FoodCategory | 'other';
  quantityLabel: string;
  foodId: string | null;
  checked: boolean;
  addedAt: string; // ISO 8601 timestamp
}

export interface ShoppingListDoc {
  userId: string;
  items: ShoppingListItem[];
  updatedAt: Date;
}
