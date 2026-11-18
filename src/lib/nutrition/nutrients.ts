import type {
  FoodItem,
  FoodSearchFilters,
  NutrientsPer100g,
  ServingUnit,
} from '@/src/types/food';
import { filterFoodsByNutrientGroup } from './classification';
import { normalizeVietnamese } from './normalize';

/**
 * Quy đổi dinh dưỡng từ 100g sang khẩu phần `grams` (g).
 * Quy tắc làm tròn:
 * - Giá trị `null` ("Chưa có dữ liệu") được giữ nguyên `null`, KHÔNG bao giờ quy về 0.
 * - `energyKcal` làm tròn đến số nguyên gần nhất.
 * - Các chất dinh dưỡng khác (g, mg) làm tròn đến 1 chữ số thập phân.
 */
export function scaleNutrients(
  nutrientsPer100g: NutrientsPer100g,
  grams: number
): NutrientsPer100g {
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error('Khối lượng khẩu phần phải là số dương lớn hơn 0.');
  }

  const ratio = grams / 100;

  const scaleOneDecimal = (val: number | null): number | null =>
    val === null ? null : Math.round(val * ratio * 10) / 10;

  const scaleInteger = (val: number | null): number | null =>
    val === null ? null : Math.round(val * ratio);

  return {
    energyKcal: scaleInteger(nutrientsPer100g.energyKcal),
    proteinG: scaleOneDecimal(nutrientsPer100g.proteinG),
    fatG: scaleOneDecimal(nutrientsPer100g.fatG),
    carbG: scaleOneDecimal(nutrientsPer100g.carbG),
    fiberG: scaleOneDecimal(nutrientsPer100g.fiberG),
    sugarG: scaleOneDecimal(nutrientsPer100g.sugarG),
    sodiumMg: scaleOneDecimal(nutrientsPer100g.sodiumMg),
  };
}

/**
 * Tính tổng gram từ đơn vị khẩu phần (ví dụ "1 bát" = 250g) và số lượng.
 */
export function gramsFromServing(serving: ServingUnit, quantity: number): number {
  if (!Number.isFinite(serving.grams) || serving.grams <= 0) {
    throw new Error('Khối lượng của đơn vị khẩu phần phải lớn hơn 0.');
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error('Số lượng khẩu phần phải lớn hơn 0.');
  }

  return Math.round(serving.grams * quantity * 10) / 10;
}

function allergenMatches(foodAllergen: string, excludedAllergen: string): boolean {
  const a = normalizeVietnamese(foodAllergen);
  const b = normalizeVietnamese(excludedAllergen);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Tìm danh sách chất gây dị ứng trùng khớp giữa thực phẩm và danh sách dị ứng của người dùng.
 */
export function findMatchingAllergens(
  foodAllergens: string[],
  userAllergens: string[]
): string[] {
  if (foodAllergens.length === 0 || userAllergens.length === 0) {
    return [];
  }
  return foodAllergens.filter((foodAllergen) =>
    userAllergens.some((userAllergen) =>
      allergenMatches(foodAllergen, userAllergen)
    )
  );
}

/**
 * Lọc danh sách thực phẩm theo các chất dị ứng cần loại trừ.
 * Thực phẩm có `allergensReviewed === false` được gắn cờ cảnh báo trong `unreviewedIds`,
 * không âm thầm xem như an toàn tuyệt đối.
 */
export function filterByAllergens(
  foods: FoodItem[],
  excludedAllergens: string[]
): {
  foods: FoodItem[];
  unreviewedIds: Set<string>;
} {
  const unreviewedIds = new Set<string>();
  const filtered = foods.filter((food) => {
    if (!food.allergensReviewed) {
      unreviewedIds.add(food.id);
    }
    if (excludedAllergens.length === 0) {
      return true;
    }
    const matches = findMatchingAllergens(food.allergens, excludedAllergens);
    return matches.length === 0;
  });

  return { foods: filtered, unreviewedIds };
}

/**
 * Tìm kiếm và lọc danh sách thực phẩm thuần túy phía client.
 * Mặc định chỉ trả về các món đang hoạt động (`isActive === true`) và đã xác minh (`verificationStatus === 'verified'`).
 */
export function searchFoods(
  foods: FoodItem[],
  queryText: string,
  filters: FoodSearchFilters = {}
): FoodItem[] {
  const normalizedQuery = normalizeVietnamese(queryText);
  const includeInactive = filters.includeInactive ?? false;
  const includeUnverified = filters.includeUnverified ?? false;

  const afterAllergens =
    filters.excludedAllergens && filters.excludedAllergens.length > 0
      ? filterByAllergens(foods, filters.excludedAllergens).foods
      : foods;

  const afterGroup =
    filters.nutrientGroup && filters.nutrientGroup !== 'all'
      ? filterFoodsByNutrientGroup(afterAllergens, filters.nutrientGroup)
      : afterAllergens;

  return afterGroup.filter((food) => {
    if (!includeInactive && !food.isActive) {
      return false;
    }

    if (
      filters.verificationStatus &&
      filters.verificationStatus !== 'all'
    ) {
      if (food.verificationStatus !== filters.verificationStatus) {
        return false;
      }
    } else if (!includeUnverified && food.verificationStatus !== 'verified') {
      return false;
    }

    if (
      filters.category &&
      filters.category !== 'all' &&
      food.category !== filters.category
    ) {
      return false;
    }

    if (
      filters.dietTag &&
      filters.dietTag !== 'all' &&
      !food.dietTags.includes(filters.dietTag)
    ) {
      return false;
    }

    if (filters.energyRange && filters.energyRange !== 'all') {
      const kcal = food.nutrientsPer100g.energyKcal;
      if (kcal === null) return false;
      if (filters.energyRange === 'low' && kcal >= 100) return false;
      if (filters.energyRange === 'medium' && (kcal < 100 || kcal > 220)) return false;
      if (filters.energyRange === 'high' && kcal <= 220) return false;
    }

    if (filters.proteinRange && filters.proteinRange !== 'all') {
      const protein = food.nutrientsPer100g.proteinG;
      if (protein === null) return false;
      if (filters.proteinRange === 'high' && protein < 14) return false;
      if (filters.proteinRange === 'moderate' && (protein < 5 || protein >= 14)) {
        return false;
      }
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      food.nameNormalized || normalizeVietnamese(food.nameVi),
      normalizeVietnamese(food.nameVi),
      food.nameEn ? normalizeVietnamese(food.nameEn) : '',
      ...food.aliases.map((alias) => normalizeVietnamese(alias)),
    ];

    return haystack.some((candidate) => candidate.includes(normalizedQuery));
  });
}
