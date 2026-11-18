import { describe, expect, it } from 'vitest';
import { VIETNAMESE_FOOD_CATALOG } from '../lib/nutrition/vietnameseCatalog.ts';
import {
  buildCompactCatalogForPrompt,
  customFoodInputSchema,
  deriveFoodPracticalMeta,
  filterSafeCatalog,
  scaleNutrientsDeterministic,
  sumNutrientsDeterministic,
} from './nutritionEngine.ts';

describe('server nutritionEngine', () => {
  it('scales nutrients deterministically and preserves nulls on partial data', () => {
    const scaled = scaleNutrientsDeterministic(
      {
        energyKcal: 130,
        proteinG: 2.7,
        fatG: 0.3,
        carbG: 28.2,
        fiberG: null,
        sugarG: null,
        sodiumMg: 1,
      },
      150
    );
    expect(scaled.energyKcal).toBe(195);
    expect(scaled.proteinG).toBe(4.1);
    expect(scaled.fiberG).toBeNull();
    expect(scaled.sugarG).toBeNull();

    const summed = sumNutrientsDeterministic([
      scaled,
      {
        energyKcal: 200,
        proteinG: 20,
        fatG: 5,
        carbG: 0,
        fiberG: 2,
        sugarG: 0,
        sodiumMg: 80,
      },
    ]);
    expect(summed.totals.energyKcal).toBe(395);
    expect(summed.totals.fiberG).toBe(2);
    expect(summed.isPartial).toBe(true);
  });

  it('filters allergens, disliked ingredients, condiments, and non-vegetarian items safely', () => {
    const safeVeg = filterSafeCatalog(
      VIETNAMESE_FOOD_CATALOG,
      ['Đậu nành'],
      ['khoai lang'],
      'vegetarian'
    );
    expect(safeVeg.length).toBeGreaterThan(0);
    for (const food of safeVeg) {
      expect(food.category).not.toBe('condiments');
      expect(food.category).not.toBe('meat');
      expect(food.category).not.toBe('fish_seafood');
      expect(food.allergens.join(' ').toLowerCase()).not.toContain('đậu nành');
      expect(food.nameNormalized).not.toContain('khoai lang');
    }
  });

  it('derives practical prep time & budget tier metadata and compact prompt payloads', () => {
    const salmon = VIETNAMESE_FOOD_CATALOG.find((f) => f.id === 'ca-hoi-ap-chao');
    expect(salmon).toBeDefined();
    expect(deriveFoodPracticalMeta(salmon!).budgetTier).toBe('flexible');

    const banana = VIETNAMESE_FOOD_CATALOG.find((f) => f.id === 'chuoi-tieu');
    expect(banana).toBeDefined();
    expect(deriveFoodPracticalMeta(banana!).budgetTier).toBe('economy');
    expect(deriveFoodPracticalMeta(banana!).prepTimeMinutes).toBeLessThanOrEqual(10);

    const compact = buildCompactCatalogForPrompt(VIETNAMESE_FOOD_CATALOG.slice(0, 3));
    expect(compact).toHaveLength(3);
    expect(compact[0]).toHaveProperty('prepMin');
    expect(compact[0]).toHaveProperty('budget');
  });

  it('validates customFoodInputSchema strictly', () => {
    const invalid = customFoodInputSchema.safeParse({
      id: '',
      nameVi: 'Món lỗi',
      category: 'meat',
    });
    expect(invalid.success).toBe(false);
  });
});
