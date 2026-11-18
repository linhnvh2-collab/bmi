import { describe, expect, it } from 'vitest';
import type { FoodItem } from '@/src/types/food';
import {
  filterByAllergens,
  gramsFromServing,
  normalizeVietnamese,
  scaleNutrients,
  searchFoods,
  validateFood,
  validateImportPayload,
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
