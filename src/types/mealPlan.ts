import type { FoodCategory, NutrientsPer100g, VerificationStatus } from './food';
import type { BudgetLevel, DietMode, NutritionGoalMode } from './health';
import type { MealType } from './stage3';

export type MealPlanSlotType =
  | 'breakfast'
  | 'morning_snack'
  | 'lunch'
  | 'afternoon_snack'
  | 'dinner';

export interface MealPlanDish {
  slotDishId: string;
  foodId: string;
  nameVi: string;
  category: FoodCategory;
  imagePath: string | null;
  grams: number;
  servingLabel: string;
  nutrientsScaled: NutrientsPer100g;
  nutrientsPer100g: NutrientsPer100g;
  verificationStatus: VerificationStatus;
  allergens: string[];
  ingredients: string[];
  prepNote: string;
  prepTimeMinutes?: number;
  budgetTier?: BudgetLevel;
  aiReason: string;
}

export interface MealPlanSlot {
  slotType: MealPlanSlotType;
  diaryMealType: MealType;
  labelVi: string;
  dishes: MealPlanDish[];
  totals: NutrientsPer100g;
  isPartial: boolean;
}

export interface MealPlanDay {
  dayIndex: number;
  dayLabelVi: string;
  meals: MealPlanSlot[];
  dailyTotals: NutrientsPer100g;
  hasEstimatedOrUnverified: boolean;
  isPartial: boolean;
}

export interface SavedMealPlan {
  id: string;
  userId: string;
  title: string;
  durationDays: 1 | 3 | 7;
  dietMode: DietMode;
  nutritionGoal: NutritionGoalMode;
  targetKcalPerDay: number | null;
  days: MealPlanDay[];
  aiSummary: string;
  isEstimated: boolean;
  isFavorite?: boolean;
  availableIngredients?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SwapDishSuggestion {
  foodId: string;
  nameVi: string;
  category: FoodCategory;
  imagePath: string | null;
  grams: number;
  servingLabel: string;
  nutrientsScaled: NutrientsPer100g;
  nutrientsPer100g: NutrientsPer100g;
  verificationStatus: VerificationStatus;
  allergens: string[];
  ingredients: string[];
  prepNote: string;
  prepTimeMinutes?: number;
  budgetTier?: BudgetLevel;
  aiExplanation: {
    whyChosen: string;
    keyNutrients: string;
    goalFit: string;
    caution: string;
  };
}

export interface ScannedFoodMatch {
  detectedNameVi: string;
  confidenceLabel: 'cao' | 'trung_binh' | 'thap';
  estimatedGrams: number;
  possibleIngredients: string[];
  cookingMethodVi?: string;
  portionUncertaintyNote: string;
  matchedFoodId: string | null;
  matchedFoodNameVi: string | null;
  matchedCategory: FoodCategory | null;
  nutrientsPer100g: NutrientsPer100g | null;
  verificationStatus: VerificationStatus;
}

export interface ScannedFoodAnalysisResponse {
  isFoodImage?: boolean;
  detectedCount?: number;
  summaryVi: string;
  overallCautionVi: string;
  items: ScannedFoodMatch[];
}

export interface FoodScanHistoryRecord {
  id: string;
  userId: string;
  storagePath: string | null;
  summaryVi: string;
  isFoodImage: boolean;
  detectedCount: number;
  items: Array<{
    detectedNameVi: string;
    matchedFoodId: string | null;
    grams: number;
    confidenceLabel: 'cao' | 'trung_binh' | 'thap';
    cookingMethodVi?: string;
  }>;
  confirmedToDiary: boolean;
  createdAt: Date;
}
