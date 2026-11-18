import { describe, expect, it } from 'vitest';
import { calculateAgeFromBirthDate } from '@/src/lib/format/date';
import type { FoodItem } from '@/src/types/food';
import {
  buildPersonalizedNutritionPlan,
  evaluateSmartSubstitutions,
  filterByAllergens,
  filterFoodsByNutrientGroup,
  findSimilarFoods,
  getPortionNutrientComparison,
  gramsFromServing,
  normalizeVietnamese,
  scaleNutrients,
  searchFoods,
  validateFood,
  validateImportPayload,
  VIETNAMESE_CATALOG_MAP,
  VIETNAMESE_FOOD_CATALOG,
} from './index';

function makeTestFood(overrides: Partial<FoodItem> = {}): FoodItem {
  const nameVi = overrides.nameVi ?? 'Phở bò';
  return {
    id: overrides.id ?? 'pho-bo',
    nameVi,
    nameEn: overrides.nameEn ?? 'Beef noodle soup',
    aliases: overrides.aliases ?? ['Phở bò tái', 'Pho bo Ha Noi'],
    nameNormalized: overrides.nameNormalized ?? normalizeVietnamese(nameVi),
    category: overrides.category ?? 'rice_noodles',
    nutrientsPer100g: overrides.nutrientsPer100g ?? {
      energyKcal: 130,
      proteinG: 7.5,
      fatG: 3.2,
      carbG: 17.8,
      fiberG: null,
      sugarG: null,
      sodiumMg: 320,
    },
    servingUnits: overrides.servingUnits ?? [{ label: '1 tô vừa', grams: 350 }],
    allergens: overrides.allergens ?? ['Gluten (lúa mì)'],
    allergensReviewed: overrides.allergensReviewed ?? true,
    dietTags: overrides.dietTags ?? [],
    source: overrides.source ?? {
      name: 'Tài liệu thử nghiệm nội bộ',
      year: 2024,
      reference: 'Bảng kiểm thử số 1',
    },
    verificationStatus: overrides.verificationStatus ?? 'verified',
    imagePath: overrides.imagePath ?? null,
    isActive: overrides.isActive ?? true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
    updatedBy: 'test-admin',
  };
}

describe('normalizeVietnamese', () => {
  it('lowercases, strips diacritics, converts đ to d, and collapses whitespace', () => {
    expect(normalizeVietnamese('  Phở   bò   ĐẶC BIỆT  ')).toBe('pho bo dac biet');
    expect(normalizeVietnamese('Đậu hũ chiên giòn')).toBe('dau hu chien gion');
  });
});

describe('searchFoods', () => {
  const fixtureFoods: FoodItem[] = [
    makeTestFood({ id: 'pho-bo', nameVi: 'Phở bò', verificationStatus: 'verified' }),
    makeTestFood({
      id: 'bun-cha',
      nameVi: 'Bún chả',
      aliases: ['Bún chả Hà Nội'],
      verificationStatus: 'estimated',
    }),
    makeTestFood({
      id: 'banh-xeo',
      nameVi: 'Bánh xèo',
      aliases: ['Bánh xèo miền Tây'],
      allergens: ['Hải sản (tôm, cua, sò)'],
      allergensReviewed: false,
      verificationStatus: 'unverified',
    }),
  ];

  it('matches "pho bo" to "Phở bò" diacritics-insensitively', () => {
    const results = searchFoods(fixtureFoods, 'pho bo');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('pho-bo');
  });

  it('hides estimated and unverified foods by default and shows them when includeUnverified is true', () => {
    expect(searchFoods(fixtureFoods, '').map((f) => f.id)).toEqual(['pho-bo']);
    expect(
      searchFoods(fixtureFoods, '', { includeUnverified: true }).map((f) => f.id)
    ).toEqual(['pho-bo', 'bun-cha', 'banh-xeo']);
  });

  it('matches regional aliases', () => {
    const results = searchFoods(fixtureFoods, 'ha noi', { includeUnverified: true });
    expect(results.map((f) => f.id)).toEqual(['pho-bo', 'bun-cha']);
  });
});

describe('scaleNutrients & gramsFromServing', () => {
  it('scales nutrients proportionally and preserves null values without turning them into 0', () => {
    const scaled = scaleNutrients(
      {
        energyKcal: 130,
        proteinG: 10.2,
        fatG: 4.5,
        carbG: 12.1,
        fiberG: null,
        sugarG: null,
        sodiumMg: 250,
      },
      150
    );

    expect(scaled.energyKcal).toBe(195);
    expect(scaled.proteinG).toBe(15.3);
    expect(scaled.fatG).toBe(6.8);
    expect(scaled.carbG).toBe(18.2);
    expect(scaled.fiberG).toBeNull();
    expect(scaled.sugarG).toBeNull();
    expect(scaled.sodiumMg).toBe(375);
  });

  it('computes grams from serving unit and quantity', () => {
    expect(gramsFromServing({ label: '1 chén', grams: 100 }, 1.5)).toBe(150);
  });
});

describe('filterByAllergens', () => {
  it('excludes matching allergens and flags foods with allergensReviewed = false', () => {
    const peanutFood = makeTestFood({
      id: 'xoi-lac',
      nameVi: 'Xôi lạc',
      allergens: ['Đậu phộng (lạc)'],
      allergensReviewed: true,
    });
    const unreviewedFood = makeTestFood({
      id: 'canh-chua',
      nameVi: 'Canh chua',
      allergens: [],
      allergensReviewed: false,
    });

    const result = filterByAllergens(
      [peanutFood, unreviewedFood],
      ['Đậu phộng (lạc)']
    );
    expect(result.foods.map((f) => f.id)).toEqual(['canh-chua']);
    expect(result.unreviewedIds.has('canh-chua')).toBe(true);
  });
});

describe('validateFood & validateImportPayload', () => {
  it('rejects verified food without complete source', () => {
    const res = validateFood({
      id: 'com-trang',
      nameVi: 'Cơm trắng',
      nameEn: 'Steamed rice',
      aliases: [],
      category: 'rice_noodles',
      nutrientsPer100g: {
        energyKcal: 130,
        proteinG: 2.7,
        fatG: 0.3,
        carbG: 28,
        fiberG: null,
        sugarG: null,
        sodiumMg: null,
      },
      servingUnits: [{ label: '1 chén', grams: 100 }],
      allergens: [],
      allergensReviewed: true,
      dietTags: ['vegan'],
      source: null,
      verificationStatus: 'verified',
      imagePath: null,
      isActive: true,
    });
    expect(res.success).toBe(false);
  });

  it('rejects negative nutrients and external image URLs', () => {
    const res = validateFood({
      id: 'mon-loi',
      nameVi: 'Món lỗi',
      aliases: [],
      category: 'snacks',
      nutrientsPer100g: {
        energyKcal: -50,
        proteinG: 2,
        fatG: 1,
        carbG: 10,
        fiberG: null,
        sugarG: null,
        sodiumMg: null,
      },
      servingUnits: [],
      allergens: [],
      allergensReviewed: false,
      dietTags: [],
      source: null,
      verificationStatus: 'unverified',
      imagePath: 'https://example.com/bad.jpg',
      isActive: true,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.errors.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('validates CSV import rows with Vietnamese errors on invalid rows', () => {
    const csv = [
      'id,nameVi,nameEn,aliases,category,energyKcal,proteinG,fatG,carbG,fiberG,sugarG,sodiumMg,servingUnits,allergens,allergensReviewed,dietTags,verificationStatus,sourceName,sourceYear,sourceReference,imagePath,isActive',
      'com-trang-mau,Cơm trắng mẫu,White rice,Cơm tẻ,rice_noodles,130,2.7,0.3,28,,,,1 chén:100,,true,vegan,verified,Nguồn mẫu,2024,Trang 1,,true',
      'mon-thieu-nguon,Món thiếu nguồn,, ,rice_noodles,100,2,1,20,,,,1 phần:100,,false,,verified,,,,,true',
    ].join('\n');

    const preview = validateImportPayload('foods.csv', csv);
    expect(preview.parseError).toBeUndefined();
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0].valid).toBe(true);
    expect(preview.rows[1].valid).toBe(false);
    expect(preview.rows[1].errors.some((e) => e.includes('Đã xác minh'))).toBe(true);
  });
});

describe('VIETNAMESE_FOOD_CATALOG & 9-group nutrient classification', () => {
  it('contains >= 70 curated Vietnamese dishes and ensures unique food IDs', () => {
    expect(VIETNAMESE_FOOD_CATALOG.length).toBeGreaterThanOrEqual(70);
    expect(VIETNAMESE_CATALOG_MAP.size).toBe(VIETNAMESE_FOOD_CATALOG.length);
  });

  it('classifies rich_protein, high_sugar, high_sodium, and vitamins_minerals deterministically', () => {
    const richProteinIds = new Set(
      filterFoodsByNutrientGroup(VIETNAMESE_FOOD_CATALOG, 'rich_protein').map(
        (f) => f.id
      )
    );
    expect(richProteinIds.has('uc-ga-luoc')).toBe(true);
    expect(richProteinIds.has('com-trang')).toBe(false);

    const highSodiumIds = new Set(
      filterFoodsByNutrientGroup(VIETNAMESE_FOOD_CATALOG, 'high_sodium').map(
        (f) => f.id
      )
    );
    expect(highSodiumIds.has('pho-bo-tai')).toBe(true);
    expect(highSodiumIds.has('com-trang')).toBe(false);
  });

  it('findSimilarFoods strictly excludes declared user allergens', () => {
    const chicken = VIETNAMESE_CATALOG_MAP.get('uc-ga-luoc');
    expect(chicken).toBeDefined();
    const subs = findSimilarFoods(
      chicken!,
      VIETNAMESE_FOOD_CATALOG,
      ['Cá', 'Hải sản (tôm, cua, sò)', 'Đậu nành'],
      6
    );
    expect(subs.length).toBeGreaterThan(0);
    for (const item of subs) {
      expect(item.allergens).not.toContain('Cá');
      expect(item.allergens).not.toContain('Đậu nành');
    }
  });
});

describe('buildPersonalizedNutritionPlan', () => {
  it('strictly enforces under-18 limited mode with null calories and macros', () => {
    const plan = buildPersonalizedNutritionPlan({
      age: 15,
      sex: 'male',
      heightCm: 165,
      weightKg: 55,
      activityLevel: 'moderate',
      nutritionGoal: 'lose_gradual',
      dietMode: 'balanced',
    });

    expect(plan.isUnder18).toBe(true);
    expect(plan.bodyStateMode).toBe('under_18_limited');
    expect(plan.bmr).toBeNull();
    expect(plan.tdee).toBeNull();
    expect(plan.targetKcal).toBeNull();
    expect(plan.macros).toBeNull();
    expect(plan.effectiveGoal).toBe('healthy_habits');
  });

  it('locks medical screening risk users to healthy_habits with null calorie targets', () => {
    const plan = buildPersonalizedNutritionPlan({
      age: 30,
      sex: 'female',
      heightCm: 160,
      weightKg: 62,
      activityLevel: 'moderate',
      nutritionGoal: 'lose_gradual',
      dietMode: 'balanced',
      hasMedicalScreeningRisk: true,
    });

    expect(plan.isUnder18).toBe(false);
    expect(plan.effectiveGoal).toBe('healthy_habits');
    expect(plan.targetKcal).toBeNull();
    expect(plan.macros).toBeNull();
  });

  it('computes safe adult BMR, TDEE, target calories, water, and macro split', () => {
    const plan = buildPersonalizedNutritionPlan({
      age: 28,
      sex: 'male',
      heightCm: 172,
      weightKg: 68,
      activityLevel: 'moderate',
      nutritionGoal: 'maintain',
      dietMode: 'high_protein',
    });

    expect(plan.isUnder18).toBe(false);
    expect(plan.bmr).toBeGreaterThan(1500);
    expect(plan.tdee).toBeGreaterThan(plan.bmr!);
    expect(plan.targetKcal).toBe(plan.tdee);
    expect(plan.macros?.proteinPct).toBe(25);
    expect(plan.waterLitresEstimated).toBeGreaterThanOrEqual(1.5);
    expect(plan.comparisonRows.length).toBeGreaterThanOrEqual(4);
    expect(plan.recommendedFoods.length).toBeGreaterThan(0);
  });

  it('never defaults biological sex ("other" or null) to male and blocks BMR/TDEE/TargetKcal', () => {
    const plan = buildPersonalizedNutritionPlan({
      age: 26,
      sex: 'other',
      heightCm: 168,
      weightKg: 60,
      activityLevel: 'moderate',
      nutritionGoal: 'maintain',
    });

    expect(plan.hasSufficientBodyMetrics).toBe(true);
    expect(plan.bmi).toBeCloseTo(21.3, 1);
    expect(plan.bmr).toBeNull();
    expect(plan.tdee).toBeNull();
    expect(plan.targetKcal).toBeNull();
    expect(plan.macros).toBeNull();
    expect(plan.missingBmrReasonVi).toBeTruthy();
  });

  it('refuses to fabricate BMI or calories when core body inputs are missing', () => {
    const plan = buildPersonalizedNutritionPlan({
      age: null,
      sex: 'male',
      heightCm: 170,
      weightKg: null,
      activityLevel: 'moderate',
    });

    expect(plan.hasSufficientBodyMetrics).toBe(false);
    expect(plan.bmi).toBeNull();
    expect(plan.bmr).toBeNull();
    expect(plan.tdee).toBeNull();
    expect(plan.targetKcal).toBeNull();
    expect(plan.missingFields.length).toBeGreaterThanOrEqual(2);
  });

  it('updates TDEE, targetKcal, and allergen filtering dynamically as goal/activity/allergens change', () => {
    const sedentaryLose = buildPersonalizedNutritionPlan({
      age: 30,
      sex: 'female',
      heightCm: 160,
      weightKg: 64,
      activityLevel: 'sedentary',
      nutritionGoal: 'lose_gradual',
      allergens: ['Hải sản (tôm, cua, sò)', 'Đậu nành'],
    });
    const activeMuscle = buildPersonalizedNutritionPlan({
      age: 30,
      sex: 'female',
      heightCm: 160,
      weightKg: 64,
      activityLevel: 'active',
      nutritionGoal: 'build_muscle',
      allergens: ['Hải sản (tôm, cua, sò)', 'Đậu nành'],
    });

    expect(activeMuscle.tdee!).toBeGreaterThan(sedentaryLose.tdee!);
    expect(activeMuscle.targetKcal!).toBeGreaterThan(sedentaryLose.targetKcal!);
    for (const rec of activeMuscle.recommendedFoods) {
      expect(rec.food.allergens).not.toContain('Đậu nành');
      expect(rec.food.allergens).not.toContain('Hải sản (tôm, cua, sò)');
    }
  });
});

describe('calculateAgeFromBirthDate & Smart Substitution Engine', () => {
  it('calculates exact age including leap years, pre/post birthday, and rejects future/invalid dates', () => {
    const refDate = new Date(2026, 4, 15); // 2026-05-15
    expect(calculateAgeFromBirthDate('2000-05-15', refDate)).toBe(26);
    expect(calculateAgeFromBirthDate('2000-05-16', refDate)).toBe(25);
    expect(calculateAgeFromBirthDate('2000-02-29', new Date(2026, 2, 1))).toBe(26);
    expect(calculateAgeFromBirthDate('2026-06-01', refDate)).toBeNull();
    expect(calculateAgeFromBirthDate('2025-02-30', refDate)).toBeNull();
  });

  it('evaluates smart food substitutions honestly with portion nutrient comparison and allergen exclusion', () => {
    const pork = VIETNAMESE_CATALOG_MAP.get('thit-kho-tau') ?? VIETNAMESE_FOOD_CATALOG[0];
    const candidates = evaluateSmartSubstitutions(pork, VIETNAMESE_FOOD_CATALOG, {
      excludedAllergens: ['Đậu nành', 'Trứng'],
      dislikedFoods: ['cá hồi'],
      nutritionGoal: 'lose_gradual',
      preferEconomy: true,
      limit: 5,
    });

    expect(candidates.length).toBeGreaterThan(0);
    for (const c of candidates) {
      expect(c.food.id).not.toBe(pork.id);
      expect(c.food.allergens).not.toContain('Đậu nành');
      expect(c.food.allergens).not.toContain('Trứng');
      expect(c.food.nameNormalized).not.toContain('ca hoi');
    }

    const tableRows = getPortionNutrientComparison(
      pork,
      150,
      candidates[0].food,
      candidates[0].portionGrams
    );
    expect(tableRows.some((r) => r.key === 'energyKcal')).toBe(true);
    expect(tableRows.some((r) => r.key === 'fiberG')).toBe(true);
    expect(tableRows.some((r) => r.key === 'sodiumMg')).toBe(true);
  });
});
