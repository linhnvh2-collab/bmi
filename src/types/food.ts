export type FoodCategory =
  | 'rice_noodles'
  | 'meat'
  | 'fish_seafood'
  | 'eggs_dairy'
  | 'vegetables'
  | 'fruits'
  | 'legumes_nuts'
  | 'soups'
  | 'snacks'
  | 'drinks'
  | 'condiments';

export type VerificationStatus = 'verified' | 'estimated' | 'unverified';

export type NutrientNeedGroupId =
  | 'rich_protein'
  | 'rich_carb'
  | 'healthy_fat'
  | 'high_fiber'
  | 'vitamins_minerals'
  | 'low_energy'
  | 'high_energy'
  | 'high_sugar'
  | 'high_sodium';

export interface NutrientsPer100g {
  energyKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
}

export type NutrientKey = keyof NutrientsPer100g;

export interface ServingUnit {
  label: string;
  grams: number;
}

export interface FoodSource {
  name: string;
  year: number | null;
  reference: string;
}

export interface FoodItem {
  id: string;
  nameVi: string;
  nameEn: string;
  aliases: string[];
  nameNormalized: string;
  category: FoodCategory;
  nutrientsPer100g: NutrientsPer100g;
  servingUnits: ServingUnit[];
  allergens: string[];
  allergensReviewed: boolean;
  dietTags: string[];
  source: FoodSource | null;
  verificationStatus: VerificationStatus;
  imagePath: string | null;
  ingredients?: string[];
  preparationNote?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

export interface FoodInput {
  id: string;
  nameVi: string;
  nameEn: string;
  aliases: string[];
  category: FoodCategory;
  nutrientsPer100g: NutrientsPer100g;
  servingUnits: ServingUnit[];
  allergens: string[];
  allergensReviewed: boolean;
  dietTags: string[];
  source: FoodSource | null;
  verificationStatus: VerificationStatus;
  imagePath: string | null;
  ingredients?: string[];
  preparationNote?: string;
  isActive: boolean;
}

export interface FoodSearchFilters {
  category?: FoodCategory | 'all';
  excludedAllergens?: string[];
  dietTag?: string | 'all';
  verificationStatus?: VerificationStatus | 'all';
  includeUnverified?: boolean;
  includeInactive?: boolean;
  energyRange?: 'all' | 'low' | 'medium' | 'high';
  proteinRange?: 'all' | 'high' | 'moderate';
  nutrientGroup?: NutrientNeedGroupId | 'all';
}

export interface FavoriteFood {
  userId: string;
  foodId: string;
  createdAt: Date;
}
