import type { FoodItem, NutrientKey } from '@/src/types/food';
import type { BudgetLevel, NutritionGoalMode } from '@/src/types/health';
import { findMatchingAllergens, scaleNutrients } from './nutrients';
import { normalizeVietnamese } from './normalize';

export interface FoodPracticalMeta {
  prepTimeMinutes: number;
  budgetTier: BudgetLevel;
  budgetLabelVi: string;
  availabilityVi: string;
}

const PREMIUM_KEYWORDS = [
  'ca hoi',
  'bo my',
  'bo tai',
  'hanh nhan',
  'hat dieu',
  'hat chia',
  'yen mach',
  'pho bo',
  'tom su',
];

const ECONOMY_KEYWORDS = [
  'com trang',
  'trung',
  'dau phu',
  'dau hu',
  'khoai lang',
  'rau muong',
  'bap cai',
  'bi do',
  'bi xanh',
  'chuoi',
  'oi',
  'lac',
  'dau phong',
  'ca ro phi',
  'canh rau',
  'chao',
  'ngo',
];

export function getFoodPracticalMeta(food: FoodItem): FoodPracticalMeta {
  const hay = normalizeVietnamese(
    `${food.id} ${food.nameVi} ${food.preparationNote ?? ''}`
  );

  // Estimate prep time based on category & cooking cues
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

  let budgetTier: BudgetLevel = 'standard';
  if (PREMIUM_KEYWORDS.some((kw) => hay.includes(kw))) {
    budgetTier = 'flexible';
  } else if (ECONOMY_KEYWORDS.some((kw) => hay.includes(kw))) {
    budgetTier = 'economy';
  } else if (
    food.category === 'vegetables' ||
    food.category === 'fruits' ||
    food.category === 'legumes_nuts'
  ) {
    budgetTier = 'economy';
  }

  const budgetLabelVi =
    budgetTier === 'economy'
      ? 'Tiết kiệm (~15–30k/khẩu phần)'
      : budgetTier === 'standard'
        ? 'Trung bình (~30–55k/khẩu phần)'
        : 'Linh hoạt (~55–95k/khẩu phần)';

  const availabilityVi =
    budgetTier === 'flexible'
      ? 'Phổ biến tại siêu thị / cửa hàng thực phẩm'
      : 'Rất sẵn có tại chợ truyền thống & siêu thị';

  return {
    prepTimeMinutes,
    budgetTier,
    budgetLabelVi,
    availabilityVi,
  };
}

export interface SmartSubstitutionCandidate {
  food: FoodItem;
  practical: FoodPracticalMeta;
  portionGrams: number;
  equivalenceLabelVi: string;
  equivalenceTone: 'success' | 'info' | 'warning';
  reasonVi: string;
  deltasPer100g: Record<'energyKcal' | 'proteinG' | 'carbG' | 'fatG' | 'fiberG', number | null>;
}

function diffOrNull(a: number | null, b: number | null, roundInt = false): number | null {
  if (a === null || b === null) return null;
  const diff = a - b;
  return roundInt ? Math.round(diff) : Math.round(diff * 10) / 10;
}

/**
 * Đánh giá và đề xuất thực phẩm thay thế thông minh theo:
 * - Dinh dưỡng trên 100g (calo, đạm, carb, béo, chất xơ) — KHÔNG suy diễn tương đương chỉ dựa trên tên nhóm
 * - Dị ứng & thực phẩm không thích
 * - Mục tiêu dinh dưỡng, ngân sách, thời gian chế biến
 */
export function evaluateSmartSubstitutions(
  targetFood: FoodItem,
  catalog: FoodItem[],
  options: {
    excludedAllergens?: string[];
    dislikedFoods?: string[];
    nutritionGoal?: NutritionGoalMode;
    budgetLevel?: BudgetLevel;
    preferQuickPrep?: boolean;
    preferEconomy?: boolean;
    limit?: number;
  } = {}
): SmartSubstitutionCandidate[] {
  const {
    excludedAllergens = [],
    dislikedFoods = [],
    nutritionGoal = 'nutrition_balance',
    budgetLevel = 'standard',
    preferQuickPrep = false,
    preferEconomy = false,
    limit = 6,
  } = options;

  const normDisliked = dislikedFoods.map(normalizeVietnamese).filter(Boolean);
  const targetKcal = targetFood.nutrientsPer100g.energyKcal;
  const targetProtein = targetFood.nutrientsPer100g.proteinG;
  const targetCarb = targetFood.nutrientsPer100g.carbG;

  const candidates = catalog.filter((item) => {
    if (!item.isActive || item.id === targetFood.id || item.category === 'condiments') {
      return false;
    }
    if (
      excludedAllergens.length > 0 &&
      findMatchingAllergens(item.allergens, excludedAllergens).length > 0
    ) {
      return false;
    }
    if (normDisliked.length > 0) {
      const hay = normalizeVietnamese(
        [item.nameVi, ...item.aliases, ...(item.ingredients ?? [])].join(' ')
      );
      if (normDisliked.some((d) => hay.includes(d))) return false;
    }
    return true;
  });

  const scored = candidates.map((food) => {
    const practical = getFoodPracticalMeta(food);
    const sameCategory = food.category === targetFood.category;
    const altKcal = food.nutrientsPer100g.energyKcal;
    const altProtein = food.nutrientsPer100g.proteinG;
    const altCarb = food.nutrientsPer100g.carbG;
    const altFat = food.nutrientsPer100g.fatG;

    // Cross-category realistic culinary pairs (e.g. thịt lợn <-> thịt gà/cá, cơm <-> khoai lang)
    const proteinSwapPair =
      (['meat', 'fish_seafood', 'eggs_dairy', 'legumes_nuts'].includes(
        targetFood.category
      ) &&
        ['meat', 'fish_seafood', 'eggs_dairy', 'legumes_nuts'].includes(
          food.category
        )) ||
      false;
    const carbSwapPair =
      targetFood.category === 'rice_noodles' &&
      (food.category === 'rice_noodles' ||
        food.id.includes('khoai') ||
        food.id.includes('ngo'));

    let categoryPenalty = sameCategory ? 0 : proteinSwapPair || carbSwapPair ? 18 : 75;

    const kcalDiff =
      targetKcal !== null && altKcal !== null ? Math.abs(altKcal - targetKcal) : 100;
    const proteinDiff =
      targetProtein !== null && altProtein !== null
        ? Math.abs(altProtein - targetProtein) * 5
        : 35;
    const carbDiff =
      targetCarb !== null && altCarb !== null
        ? Math.abs(altCarb - targetCarb) * 1.5
        : 20;

    // Goal-aware adjustments
    let goalBonus = 0;
    if (
      (nutritionGoal === 'lose_gradual' || nutritionGoal === 'build_muscle') &&
      altProtein !== null &&
      altProtein >= 14
    ) {
      goalBonus -= 15;
    }
    if (
      nutritionGoal === 'lose_gradual' &&
      targetKcal !== null &&
      altKcal !== null &&
      altKcal <= targetKcal
    ) {
      goalBonus -= 10;
    }
    if (
      (preferEconomy || budgetLevel === 'economy') &&
      practical.budgetTier === 'economy'
    ) {
      goalBonus -= 22;
    }
    if (preferQuickPrep && practical.prepTimeMinutes <= 15) {
      goalBonus -= 22;
    }

    const totalScore = categoryPenalty + kcalDiff * 0.6 + proteinDiff + carbDiff + goalBonus;

    // Honest equivalence evaluation based on real nutrient numbers (never assuming category name == nutrition equivalence)
    let equivalenceLabelVi = 'Cần cân chỉnh khẩu phần khi thay thế';
    let equivalenceTone: 'success' | 'info' | 'warning' = 'warning';

    const kcalClose =
      targetKcal !== null &&
      altKcal !== null &&
      Math.abs(altKcal - targetKcal) <= Math.max(30, targetKcal * 0.25);
    const proteinClose =
      targetProtein !== null &&
      altProtein !== null &&
      Math.abs(altProtein - targetProtein) <= 5;
    const carbClose =
      targetCarb !== null &&
      altCarb !== null &&
      Math.abs(altCarb - targetCarb) <= 8;

    if (kcalClose && (proteinClose || carbClose)) {
      equivalenceLabelVi = 'Tương đồng tốt về năng lượng & nhóm chất chính';
      equivalenceTone = 'success';
    } else if (
      targetKcal !== null &&
      altKcal !== null &&
      altKcal < targetKcal - 20 &&
      (altProtein ?? 0) >= (targetProtein ?? 0) - 3
    ) {
      equivalenceLabelVi = 'Nhẹ năng lượng hơn · giữ đạm khá tốt';
      equivalenceTone = 'info';
    } else if (food.nutrientsPer100g.energyKcal === null) {
      equivalenceLabelVi = 'Chưa đủ số liệu kcal để kết luận tương đương';
      equivalenceTone = 'warning';
    }

    const reasonParts: string[] = [];
    if (altKcal !== null && targetKcal !== null) {
      const diff = altKcal - targetKcal;
      reasonParts.push(
        diff === 0
          ? 'Năng lượng/100g tương đương'
          : diff < 0
            ? `Ít hơn ${Math.abs(diff)} kcal/100g`
            : `Nhiều hơn ${diff} kcal/100g`
      );
    }
    if (altProtein !== null && targetProtein !== null && altProtein >= 10) {
      reasonParts.push(`đạm ${altProtein}g/100g`);
    }
    if ((food.nutrientsPer100g.fiberG ?? 0) >= 2.2) {
      reasonParts.push(`chất xơ ${food.nutrientsPer100g.fiberG}g/100g`);
    }
    if (practical.budgetTier === 'economy') {
      reasonParts.push('nguyên liệu tiết kiệm, dễ mua');
    }
    if (practical.prepTimeMinutes <= 15) {
      reasonParts.push(`nấu nhanh ~${practical.prepTimeMinutes} phút`);
    }
    if (altFat !== null && (targetFood.nutrientsPer100g.fatG ?? 0) > altFat + 3) {
      reasonParts.push('ít béo hơn');
    }

    const portionGrams = food.servingUnits[0]?.grams ?? 100;

    return {
      score: totalScore,
      candidate: {
        food,
        practical,
        portionGrams,
        equivalenceLabelVi,
        equivalenceTone,
        reasonVi:
          reasonParts.length > 0
            ? reasonParts.join(' · ')
            : 'Có thể luân phiên để đa dạng thực đơn, chú ý điều chỉnh lượng ăn phù hợp.',
        deltasPer100g: {
          energyKcal: diffOrNull(food.nutrientsPer100g.energyKcal, targetKcal, true),
          proteinG: diffOrNull(food.nutrientsPer100g.proteinG, targetProtein),
          carbG: diffOrNull(food.nutrientsPer100g.carbG, targetCarb),
          fatG: diffOrNull(food.nutrientsPer100g.fatG, targetFood.nutrientsPer100g.fatG),
          fiberG: diffOrNull(
            food.nutrientsPer100g.fiberG,
            targetFood.nutrientsPer100g.fiberG
          ),
        },
      } satisfies SmartSubstitutionCandidate,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.candidate);
}

export function getPortionNutrientComparison(
  original: FoodItem,
  originalGrams: number,
  substitute: FoodItem,
  substituteGrams: number
): Array<{
  key: NutrientKey;
  labelVi: string;
  unit: string;
  originalVal: number | null;
  substituteVal: number | null;
}> {
  const origScaled = scaleNutrients(original.nutrientsPer100g, originalGrams);
  const subScaled = scaleNutrients(substitute.nutrientsPer100g, substituteGrams);

  return [
    {
      key: 'energyKcal',
      labelVi: 'Năng lượng',
      unit: 'kcal',
      originalVal: origScaled.energyKcal,
      substituteVal: subScaled.energyKcal,
    },
    {
      key: 'proteinG',
      labelVi: 'Chất đạm',
      unit: 'g',
      originalVal: origScaled.proteinG,
      substituteVal: subScaled.proteinG,
    },
    {
      key: 'carbG',
      labelVi: 'Tinh bột',
      unit: 'g',
      originalVal: origScaled.carbG,
      substituteVal: subScaled.carbG,
    },
    {
      key: 'fatG',
      labelVi: 'Chất béo',
      unit: 'g',
      originalVal: origScaled.fatG,
      substituteVal: subScaled.fatG,
    },
    {
      key: 'fiberG',
      labelVi: 'Chất xơ',
      unit: 'g',
      originalVal: origScaled.fiberG,
      substituteVal: subScaled.fiberG,
    },
    {
      key: 'sodiumMg',
      labelVi: 'Natri',
      unit: 'mg',
      originalVal: origScaled.sodiumMg,
      substituteVal: subScaled.sodiumMg,
    },
  ];
}
