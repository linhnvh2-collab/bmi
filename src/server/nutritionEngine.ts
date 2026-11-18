import { z } from 'zod';
import type {
  FoodCategory,
  FoodItem,
  NutrientKey,
  NutrientsPer100g,
} from '../types/food.ts';
import type { BudgetLevel } from '../types/health.ts';
import type { MealPlanSlotType } from '../types/mealPlan.ts';
import type { MealType } from '../types/stage3.ts';
import { normalizeVietnamese } from '../lib/nutrition/normalize.ts';
import { VIETNAMESE_CATALOG_MAP } from '../lib/nutrition/vietnameseCatalog.ts';

const NUTRIENT_KEYS: NutrientKey[] = [
  'energyKcal',
  'proteinG',
  'fatG',
  'carbG',
  'fiberG',
  'sugarG',
  'sodiumMg',
];

export const customFoodInputSchema = z.object({
  id: z.string().min(1).max(128),
  nameVi: z.string().min(1).max(150),
  category: z.string(),
  nutrientsPer100g: z.object({
    energyKcal: z.number().nullable(),
    proteinG: z.number().nullable(),
    fatG: z.number().nullable(),
    carbG: z.number().nullable(),
    fiberG: z.number().nullable(),
    sugarG: z.number().nullable(),
    sodiumMg: z.number().nullable(),
  }),
  servingUnits: z.array(z.object({ label: z.string(), grams: z.number() })),
  allergens: z.array(z.string()),
  allergensReviewed: z.boolean().optional(),
  dietTags: z.array(z.string()).optional(),
  verificationStatus: z.enum(['verified', 'estimated', 'unverified']),
  imagePath: z.string().nullable(),
  ingredients: z.array(z.string()).optional(),
  preparationNote: z.string().optional(),
  isActive: z.boolean().optional(),
});

export function scaleNutrientsDeterministic(
  nutrientsPer100g: NutrientsPer100g,
  grams: number
): NutrientsPer100g {
  const safeGrams = Math.max(10, Math.min(2000, grams));
  const ratio = safeGrams / 100;
  const scale1 = (val: number | null): number | null =>
    val === null ? null : Math.round(val * ratio * 10) / 10;
  const scaleInt = (val: number | null): number | null =>
    val === null ? null : Math.round(val * ratio);

  return {
    energyKcal: scaleInt(nutrientsPer100g.energyKcal),
    proteinG: scale1(nutrientsPer100g.proteinG),
    fatG: scale1(nutrientsPer100g.fatG),
    carbG: scale1(nutrientsPer100g.carbG),
    fiberG: scale1(nutrientsPer100g.fiberG),
    sugarG: scale1(nutrientsPer100g.sugarG),
    sodiumMg: scale1(nutrientsPer100g.sodiumMg),
  };
}

export function sumNutrientsDeterministic(
  list: NutrientsPer100g[]
): { totals: NutrientsPer100g; isPartial: boolean } {
  const result: NutrientsPer100g = {
    energyKcal: null,
    proteinG: null,
    fatG: null,
    carbG: null,
    fiberG: null,
    sugarG: null,
    sodiumMg: null,
  };
  let isPartial = false;

  for (const key of NUTRIENT_KEYS) {
    let sum = 0;
    let known = 0;
    for (const item of list) {
      const val = item[key];
      if (val === null || val === undefined) {
        isPartial = true;
      } else {
        sum += val;
        known += 1;
      }
    }
    if (known > 0) {
      result[key] =
        key === 'energyKcal' ? Math.round(sum) : Math.round(sum * 10) / 10;
    }
  }
  return { totals: result, isPartial };
}

export function deriveFoodPracticalMeta(food: FoodItem): {
  prepTimeMinutes: number;
  budgetTier: BudgetLevel;
} {
  const hay = normalizeVietnamese(
    `${food.id} ${food.nameVi} ${food.preparationNote ?? ''}`
  );
  let prepTimeMinutes = 20;
  if (food.category === 'fruits' || food.category === 'drinks') {
    prepTimeMinutes = 5;
  } else if (food.category === 'snacks') {
    prepTimeMinutes = hay.includes('che') ? 20 : 8;
  } else if (food.category === 'eggs_dairy') {
    prepTimeMinutes = hay.includes('sua') ? 3 : 10;
  } else if (food.category === 'vegetables') {
    prepTimeMinutes = hay.includes('xao') ? 15 : 10;
  } else if (food.category === 'soups') {
    prepTimeMinutes = hay.includes('chua') ? 25 : 20;
  } else if (food.category === 'rice_noodles') {
    prepTimeMinutes =
      hay.includes('pho') || hay.includes('bun bo') || hay.includes('bun cha')
        ? 35
        : hay.includes('com') || hay.includes('xoi')
          ? 25
          : 15;
  } else if (food.category === 'meat' || food.category === 'fish_seafood') {
    prepTimeMinutes =
      hay.includes('kho') || hay.includes('rim') || hay.includes('nuong')
        ? 30
        : 18;
  } else if (food.category === 'legumes_nuts') {
    prepTimeMinutes = hay.includes('hat') ? 3 : 15;
  }

  const premium = ['ca hoi', 'bo my', 'bo tai', 'hanh nhan', 'hat dieu', 'hat chia', 'yen mach', 'pho bo', 'tom su'];
  const economy = ['com trang', 'trung', 'dau phu', 'dau hu', 'khoai lang', 'rau muong', 'bap cai', 'bi do', 'bi xanh', 'chuoi', 'oi', 'lac', 'dau phong', 'ca ro phi', 'canh rau', 'chao', 'ngo'];

  let budgetTier: BudgetLevel = 'standard';
  if (premium.some((k) => hay.includes(k))) {
    budgetTier = 'flexible';
  } else if (
    economy.some((k) => hay.includes(k)) ||
    food.category === 'vegetables' ||
    food.category === 'fruits' ||
    food.category === 'legumes_nuts'
  ) {
    budgetTier = 'economy';
  }

  return { prepTimeMinutes, budgetTier };
}

function allergenMatches(a: string, b: string): boolean {
  const na = normalizeVietnamese(a);
  const nb = normalizeVietnamese(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function buildMergedCatalog(
  customFoods?: Array<z.infer<typeof customFoodInputSchema>>
): Map<string, FoodItem> {
  const map = new Map<string, FoodItem>(VIETNAMESE_CATALOG_MAP);
  if (customFoods && customFoods.length > 0) {
    for (const cf of customFoods) {
      if (cf.isActive === false) continue;
      map.set(cf.id, {
        id: cf.id,
        nameVi: cf.nameVi,
        nameEn: '',
        aliases: [],
        nameNormalized: normalizeVietnamese(cf.nameVi),
        category: cf.category as FoodCategory,
        nutrientsPer100g: cf.nutrientsPer100g,
        servingUnits: cf.servingUnits,
        allergens: cf.allergens,
        allergensReviewed: cf.allergensReviewed ?? false,
        dietTags: cf.dietTags ?? [],
        source: null,
        verificationStatus: cf.verificationStatus,
        imagePath: cf.imagePath,
        ingredients: cf.ingredients ?? [],
        preparationNote: cf.preparationNote ?? '',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        updatedBy: 'catalog',
      });
    }
  }
  return map;
}

export function filterSafeCatalog(
  catalog: FoodItem[],
  excludedAllergens: string[],
  dislikedFoods: string[],
  dietMode: string
): FoodItem[] {
  const normDisliked = dislikedFoods.map(normalizeVietnamese).filter(Boolean);

  return catalog.filter((food) => {
    if (!food.isActive || food.category === 'condiments') return false;

    if (
      excludedAllergens.length > 0 &&
      food.allergens.some((fa) =>
        excludedAllergens.some((ua) => allergenMatches(fa, ua))
      )
    ) {
      return false;
    }

    if (normDisliked.length > 0) {
      const hay = normalizeVietnamese(
        [
          food.nameVi,
          ...food.aliases,
          ...(food.ingredients ?? []),
        ].join(' ')
      );
      if (normDisliked.some((d) => hay.includes(d))) {
        return false;
      }
    }

    if (dietMode === 'vegetarian') {
      if (food.dietTags.includes('vegetarian') || food.dietTags.includes('vegan')) {
        return true;
      }
      if (food.category === 'meat' || food.category === 'fish_seafood') {
        return false;
      }
      const normName = normalizeVietnamese(food.nameVi);
      if (
        normName.includes('thit') ||
        normName.includes('bo ') ||
        normName.includes('ga ') ||
        normName.includes('ca ') ||
        normName.includes('tom ')
      ) {
        return false;
      }
    }

    return true;
  });
}

export const SLOT_META: Array<{
  slotType: MealPlanSlotType;
  diaryMealType: MealType;
  labelVi: string;
  fallbackCategories: FoodCategory[];
}> = [
  {
    slotType: 'breakfast',
    diaryMealType: 'breakfast',
    labelVi: 'Bữa sáng',
    fallbackCategories: ['rice_noodles', 'eggs_dairy', 'fruits'],
  },
  {
    slotType: 'morning_snack',
    diaryMealType: 'snack',
    labelVi: 'Bữa phụ sáng',
    fallbackCategories: ['fruits', 'eggs_dairy', 'legumes_nuts', 'drinks'],
  },
  {
    slotType: 'lunch',
    diaryMealType: 'lunch',
    labelVi: 'Bữa trưa',
    fallbackCategories: ['rice_noodles', 'meat', 'fish_seafood', 'vegetables', 'soups'],
  },
  {
    slotType: 'afternoon_snack',
    diaryMealType: 'snack',
    labelVi: 'Bữa phụ chiều',
    fallbackCategories: ['fruits', 'snacks', 'drinks', 'legumes_nuts'],
  },
  {
    slotType: 'dinner',
    diaryMealType: 'dinner',
    labelVi: 'Bữa tối',
    fallbackCategories: ['rice_noodles', 'fish_seafood', 'legumes_nuts', 'vegetables', 'soups'],
  },
];

export function buildCompactCatalogForPrompt(foods: FoodItem[]) {
  return foods.map((f) => {
    const meta = deriveFoodPracticalMeta(f);
    return {
      id: f.id,
      name: f.nameVi,
      cat: f.category,
      kcal100: f.nutrientsPer100g.energyKcal,
      p100: f.nutrientsPer100g.proteinG,
      c100: f.nutrientsPer100g.carbG,
      f100: f.nutrientsPer100g.fatG,
      fib100: f.nutrientsPer100g.fiberG,
      defG: f.servingUnits[0]?.grams ?? 100,
      defLbl: f.servingUnits[0]?.label ?? '100g',
      prepMin: meta.prepTimeMinutes,
      budget: meta.budgetTier,
      ing: (f.ingredients ?? []).slice(0, 5),
    };
  });
}
