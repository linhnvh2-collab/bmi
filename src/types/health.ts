export type SexOption = 'male' | 'female' | 'other';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type BudgetLevel = 'economy' | 'standard' | 'flexible';

export type PrepTimePreference = 'quick' | 'moderate' | 'elaborate';

export type NutritionGoalMode =
  | 'maintain'
  | 'lose_gradual'
  | 'gain_gradual'
  | 'build_muscle'
  | 'nutrition_balance'
  | 'healthy_habits';

export type DietMode =
  | 'balanced'
  | 'plant_heavy'
  | 'high_protein'
  | 'vegetarian'
  | 'budget_friendly'
  | 'custom';

export type BMICategoryKey =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese'
  | 'under_18_limited';

export interface BMIClassification {
  isLimitedMode: boolean;
  categoryKey: BMICategoryKey;
  labelVi: string;
  shortDescVi: string;
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  birthYear: number;
  birthDate?: string | null;
  sex: SexOption;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  dietaryPreferences: string[];
  allergens: string[];
  dislikedFoods?: string[];
  budgetLevel?: BudgetLevel;
  dailyBudgetVnd?: number | null;
  prepTimePreference?: PrepTimePreference;
  mealsPerDay?: 3 | 4 | 5;
  nutritionGoal?: NutritionGoalMode;
  dietMode?: DietMode;
  consentAccepted: boolean;
  consentVersion: string;
  consentAcceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileInput {
  displayName: string;
  birthYear: number;
  birthDate?: string | null;
  sex: SexOption;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  dietaryPreferences: string[];
  allergens: string[];
  dislikedFoods?: string[];
  budgetLevel?: BudgetLevel;
  dailyBudgetVnd?: number | null;
  prepTimePreference?: PrepTimePreference;
  mealsPerDay?: 3 | 4 | 5;
  nutritionGoal?: NutritionGoalMode;
  dietMode?: DietMode;
  consentAccepted: boolean;
}

export interface HealthRecord {
  id: string;
  userId: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  isUnder18: boolean;
  categoryKey: BMICategoryKey;
  note: string;
  createdAt: Date;
}

export interface HealthRecordCreateInput {
  age: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  isUnder18: boolean;
  categoryKey: BMICategoryKey;
  note: string;
}
