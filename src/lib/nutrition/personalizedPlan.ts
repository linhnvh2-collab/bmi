import {
  BMI_INPUT_LIMITS,
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  classifyBMI,
} from '@/src/lib/calculations';
import { buildCalorieTarget } from '@/src/lib/safety';
import type { FoodItem } from '@/src/types/food';
import type {
  ActivityLevel,
  BMIClassification,
  BudgetLevel,
  DietMode,
  NutritionGoalMode,
  PrepTimePreference,
  SexOption,
} from '@/src/types/health';
import type { GoalType } from '@/src/types/stage3';
import { getFoodPracticalMeta } from './foodMeta';
import { normalizeVietnamese } from './normalize';
import { findMatchingAllergens } from './nutrients';
import { VIETNAMESE_FOOD_CATALOG } from './vietnameseCatalog';

export type BodyStateMode =
  | 'insufficient_data'
  | 'under_18_limited'
  | 'low_bmi'
  | 'balanced_bmi'
  | 'elevated_bmi';

export interface MacroTargets {
  proteinG: number;
  proteinKcal: number;
  proteinPct: number;
  carbG: number;
  carbKcal: number;
  carbPct: number;
  fatG: number;
  fatKcal: number;
  fatPct: number;
  fiberG: number;
  waterMl: number;
}

export interface NutritionComparisonRow {
  metricVi: string;
  currentValueVi: string;
  referenceNeedVi: string;
  userGoalVi: string;
  improvementFocusVi: string;
}

export interface MetricLimitationNote {
  titleVi: string;
  meaningVi: string;
  limitationVi: string;
}

export interface FoodRecommendationItem {
  food: FoodItem;
  reasonVi: string;
  prepTimeMinutes: number;
  budgetLabelVi: string;
}

export interface FoodLimitGuidanceItem {
  titleVi: string;
  reasonVi: string;
  examplesVi: string;
}

export interface PersonalizedNutritionPlan {
  hasSufficientBodyMetrics: boolean;
  missingFields: string[];
  missingBmrReasonVi: string | null;
  missingTdeeReasonVi: string | null;
  isUnder18: boolean;
  age: number | null;
  bmi: number | null;
  bmiClassification: BMIClassification | null;
  bodyStateMode: BodyStateMode;
  bodyStateTitleVi: string;
  bodyStateAdviceVi: string;
  bmr: number | null;
  tdee: number | null;
  targetKcal: number | null;
  safetyAdjustmentMessageVi: string | null;
  macros: MacroTargets | null;
  waterLitresEstimated: number | null;
  fiberTargetG: number | null;
  effectiveGoal: NutritionGoalMode;
  effectiveDietMode: DietMode;
  mealsPerDay: 3 | 4 | 5;
  comparisonRows: NutritionComparisonRow[];
  metricExplanations: MetricLimitationNote[];
  recommendedFoods: FoodRecommendationItem[];
  foodsToLimit: FoodLimitGuidanceItem[];
  isEstimated: true;
}

export const NUTRITION_GOAL_OPTIONS: Array<{
  value: NutritionGoalMode;
  labelVi: string;
  descriptionVi: string;
}> = [
  {
    value: 'nutrition_balance',
    labelVi: 'Cải thiện chất lượng & cân bằng dinh dưỡng',
    descriptionVi:
      'Tối ưu đủ đạm, chất xơ, rau xanh và bữa ăn truyền thống hài hòa.',
  },
  {
    value: 'maintain',
    labelVi: 'Duy trì cân nặng hiện tại',
    descriptionVi:
      'Giữ năng lượng xấp xỉ TDEE ước tính để ổn định thể trạng.',
  },
  {
    value: 'lose_gradual',
    labelVi: 'Giảm cân an toàn, từ từ',
    descriptionVi:
      'Thâm hụt nhẹ trong giới hạn an toàn (tối đa 0.5 kg/tuần).',
  },
  {
    value: 'gain_gradual',
    labelVi: 'Tăng cân lành mạnh',
    descriptionVi:
      'Tăng nhẹ năng lượng từ thực phẩm giàu dinh dưỡng, tránh đồ ngọt rỗng.',
  },
  {
    value: 'build_muscle',
    labelVi: 'Hỗ trợ phát triển cơ bắp / thể lực',
    descriptionVi:
      'Ưu tiên tỷ lệ chất đạm hợp lý kết hợp tinh bột phức và tập luyện.',
  },
  {
    value: 'healthy_habits',
    labelVi: 'Xây dựng thói quen ăn uống lành mạnh',
    descriptionVi:
      'Tập trung chất lượng thực phẩm Việt mà không đặt con số calo.',
  },
];

export const DIET_MODE_OPTIONS: Array<{
  value: DietMode;
  labelVi: string;
  descriptionVi: string;
}> = [
  {
    value: 'balanced',
    labelVi: 'Cân bằng truyền thống Việt Nam',
    descriptionVi:
      'Cơm gia đình, món mặn vừa vị, canh rau và trái cây tráng miệng.',
  },
  {
    value: 'plant_heavy',
    labelVi: 'Ưu tiên rau xanh & đạm thực vật',
    descriptionVi: 'Tăng cường rau củ, đậu phụ, hạt, cá và giảm thịt đỏ.',
  },
  {
    value: 'high_protein',
    labelVi: 'Giàu đạm (Hỗ trợ giữ/tăng cơ)',
    descriptionVi: 'Tăng phần ức gà, cá, trứng, tôm, đậu hũ trong các bữa chính.',
  },
  {
    value: 'vegetarian',
    labelVi: 'Ăn chay lành mạnh',
    descriptionVi:
      'Không thịt cá; kết hợp đậu phụ, các loại đậu, hạt, nấm và rau củ.',
  },
  {
    value: 'budget_friendly',
    labelVi: 'Tiết kiệm & dễ nấu hằng ngày',
    descriptionVi:
      'Ưu tiên nguyên liệu phổ biến, giá hợp lý ở chợ Việt (trứng, đậu, rau mùa, cá đồng).',
  },
  {
    value: 'custom',
    labelVi: 'Tùy chỉnh theo hồ sơ cá nhân',
    descriptionVi:
      'Kết hợp chặt chẽ sở thích và danh sách món cần tránh của riêng bạn.',
  },
];

const METRIC_EXPLANATIONS: MetricLimitationNote[] = [
  {
    titleVi: 'Chỉ số khối cơ thể (BMI)',
    meaningVi:
      'Tỷ lệ giữa cân nặng (kg) và bình phương chiều cao (m²), giúp tham khảo nhanh tương quan vóc dáng theo ngưỡng Châu Á - Thái Bình Dương.',
    limitationVi:
      'BMI KHÔNG phân biệt được khối lượng cơ bắp, xương và mỡ cơ thể, cũng không phản ánh vị trí phân bố mỡ. Không bao giờ dùng BMI làm căn cứ duy nhất đánh giá sức khỏe.',
  },
  {
    titleVi: 'Tỷ lệ trao đổi chất cơ bản (BMR)',
    meaningVi:
      'Ước tính năng lượng tối thiểu cơ thể tiêu hao khi nghỉ ngơi hoàn toàn (công thức Mifflin-St Jeor).',
    limitationVi:
      'Bắt buộc cần thông số sinh học (Nam/Nữ), tuổi, chiều cao và cân nặng; sai số tự nhiên ±10% tùy thành phần cơ – mỡ và chuyển hóa từng cá nhân.',
  },
  {
    titleVi: 'Tổng năng lượng tiêu hao (TDEE)',
    meaningVi:
      'Ước tính năng lượng tiêu hao cả ngày dựa trên BMR nhân với hệ số mức độ vận động sinh hoạt.',
    limitationVi:
      'Là giá trị tham khảo khởi điểm; thực tế thay đổi theo số bước chân, cường độ tập luyện và giấc ngủ từng tuần.',
  },
  {
    titleVi: 'Đa lượng (Đạm – Tinh bột – Béo), Chất xơ & Nước',
    meaningVi:
      'Tỷ lệ phân bổ nguồn năng lượng kết hợp lượng chất xơ (~25–30g/ngày) và nước (~35 ml/kg cân nặng).',
    limitationVi:
      'Nhu cầu thực tế khác nhau ở người chơi thể thao nặng, phụ nữ mang thai/cho con bú hoặc người có bệnh lý thận/chuyển hóa.',
  },
];

function mapNutritionGoalToSafetyGoalType(goal: NutritionGoalMode): GoalType {
  switch (goal) {
    case 'lose_gradual':
      return 'lose_gradual';
    case 'gain_gradual':
      return 'gain_gradual';
    case 'healthy_habits':
      return 'healthy_habits';
    case 'maintain':
    case 'build_muscle':
    case 'nutrition_balance':
    default:
      return 'maintain';
  }
}

function selectRecommendedFoods(options: {
  catalog: FoodItem[];
  allergens: string[];
  dislikedFoods: string[];
  dietMode: DietMode;
  nutritionGoal: NutritionGoalMode;
  budgetLevel: BudgetLevel;
  prepTimePreference: PrepTimePreference;
  bodyStateMode: BodyStateMode;
}): FoodRecommendationItem[] {
  const {
    catalog,
    allergens,
    dislikedFoods,
    dietMode,
    nutritionGoal,
    budgetLevel,
    prepTimePreference,
    bodyStateMode,
  } = options;

  const normDisliked = dislikedFoods.map(normalizeVietnamese).filter(Boolean);

  const safeFoods = catalog.filter((food) => {
    if (!food.isActive || food.category === 'condiments') return false;
    if (
      allergens.length > 0 &&
      findMatchingAllergens(food.allergens, allergens).length > 0
    ) {
      return false;
    }
    if (normDisliked.length > 0) {
      const hay = normalizeVietnamese(
        [food.nameVi, ...food.aliases, ...(food.ingredients ?? [])].join(' ')
      );
      if (normDisliked.some((d) => hay.includes(d))) return false;
    }
    if (dietMode === 'vegetarian') {
      if (food.dietTags.includes('vegetarian') || food.dietTags.includes('vegan')) {
        return true;
      }
      if (food.category === 'meat' || food.category === 'fish_seafood') {
        return false;
      }
    }
    return true;
  });

  const scored = safeFoods.map((food) => {
    const practical = getFoodPracticalMeta(food);
    let score = 0;
    const reasons: string[] = [];

    const protein = food.nutrientsPer100g.proteinG ?? 0;
    const fiber = food.nutrientsPer100g.fiberG ?? 0;
    const kcal = food.nutrientsPer100g.energyKcal;
    const sugar = food.nutrientsPer100g.sugarG ?? 0;

    if (
      (nutritionGoal === 'build_muscle' || dietMode === 'high_protein') &&
      protein >= 14
    ) {
      score += 30;
      reasons.push(`giàu đạm (${protein}g/100g) hỗ trợ phục hồi cơ`);
    }

    if (
      (nutritionGoal === 'lose_gradual' || bodyStateMode === 'elevated_bmi') &&
      fiber >= 2.2
    ) {
      score += 25;
      reasons.push(`giàu chất xơ (${fiber}g/100g) giúp no lâu`);
    }

    if (
      (nutritionGoal === 'gain_gradual' || bodyStateMode === 'low_bmi') &&
      kcal !== null &&
      kcal >= 150 &&
      sugar < 10
    ) {
      score += 24;
      reasons.push('mật độ năng lượng tốt từ thực phẩm nguyên chất');
    }

    if (
      (dietMode === 'plant_heavy' || nutritionGoal === 'nutrition_balance') &&
      (food.category === 'vegetables' ||
        food.category === 'legumes_nuts' ||
        food.category === 'fruits')
    ) {
      score += 20;
      reasons.push('bổ sung vitamin, khoáng chất và chất xơ thực vật');
    }

    if (budgetLevel === 'economy' && practical.budgetTier === 'economy') {
      score += 18;
      reasons.push('chi phí hợp lý, dễ mua');
    }
    if (prepTimePreference === 'quick' && practical.prepTimeMinutes <= 15) {
      score += 16;
      reasons.push(`nấu nhanh (~${practical.prepTimeMinutes} phút)`);
    }
    if (food.verificationStatus === 'verified') {
      score += 8;
    }
    if (sugar >= 12) {
      score -= 20;
    }

    return {
      food,
      practical,
      score,
      reasonVi:
        reasons.length > 0
          ? reasons.slice(0, 2).join('; ')
          : 'Món ăn Việt phổ biến, dễ kết hợp cân bằng bữa ăn hằng ngày.',
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick diverse categories
  const picked: FoodRecommendationItem[] = [];
  const catCounts = new Map<string, number>();
  for (const item of scored) {
    if (picked.length >= 6) break;
    const c = catCounts.get(item.food.category) ?? 0;
    if (c >= 2) continue;
    catCounts.set(item.food.category, c + 1);
    picked.push({
      food: item.food,
      reasonVi: item.reasonVi,
      prepTimeMinutes: item.practical.prepTimeMinutes,
      budgetLabelVi: item.practical.budgetLabelVi,
    });
  }

  return picked;
}

function buildFoodsToLimitGuidance(options: {
  nutritionGoal: NutritionGoalMode;
  hasMedicalScreeningRisk: boolean;
  allergens: string[];
}): FoodLimitGuidanceItem[] {
  const list: FoodLimitGuidanceItem[] = [
    {
      titleVi: 'Đồ uống & món tráng miệng nhiều đường bổ sung',
      reasonVi:
        'Đường bổ sung làm tăng nhanh năng lượng nạp vào nhưng ít chất xơ và vi chất, dễ gây dao động cảm giác đói.',
      examplesVi: 'Trà sữa nhiều topping ngọt, nước ngọt có gas, chè đặc ngọt',
    },
    {
      titleVi: 'Món quá mặn hoặc nước chấm đậm muối',
      reasonVi:
        'Lượng natri cao kéo dài có thể tăng gánh nặng giữ nước và tim mạch; nên giảm chấm thêm nước mắm nguyên chất.',
      examplesVi: 'Món kho mặn gắt, dưa muối mặn, mì ăn liền kèm hết gói muối',
    },
    {
      titleVi: 'Thực phẩm chiên ngập dầu nhiều lần',
      reasonVi:
        'Chứa nhiều chất béo bão hòa và năng lượng ẩn khó ước lượng, nên thay bằng luộc, hấp, áp chảo ít dầu.',
      examplesVi: 'Đồ chiên rán giòn ngập dầu, thức ăn nhanh nhiều mỡ',
    },
  ];

  if (options.allergens.length > 0) {
    list.unshift({
      titleVi: `Thành phần dị ứng theo hồ sơ (${options.allergens.join(', ')})`,
      reasonVi:
        'Hệ thống luôn tự động loại trừ các thực phẩm chứa tác nhân dị ứng bạn đã khai báo để bảo vệ an toàn.',
      examplesVi: 'Kiểm tra kỹ gia vị nước chấm, mắm và nguyên liệu ẩn trước khi ăn',
    });
  }

  if (options.hasMedicalScreeningRisk) {
    list.push({
      titleVi: 'Các chế độ kiêng khem cực đoan hoặc cắt bỏ hoàn toàn nhóm chất',
      reasonVi:
        'Khi đang mang thai, cho con bú hoặc có yếu tố sức khỏe đặc biệt, tuyệt đối không tự ý cắt giảm năng lượng đột ngột mà chưa hỏi bác sĩ.',
      examplesVi: 'Nhịn ăn kéo dài, thực đơn siêu ít calo hoặc bỏ hẳn tinh bột',
    });
  }

  if (options.nutritionGoal === 'gain_gradual') {
    list.push({
      titleVi: 'Thức ăn nhanh rỗng dinh dưỡng để tăng cân cấp tốc',
      reasonVi:
        'Tăng cân lành mạnh ưu tiên thực phẩm giàu đạm và chất béo tốt thay vì đồ ngọt hay chất béo chuyển hóa.',
      examplesVi: 'Bánh kẹo công nghiệp, đồ uống ngọt đóng chai',
    });
  }

  return list;
}

export function buildPersonalizedNutritionPlan(input: {
  age: number | null | undefined;
  sex: SexOption | null | undefined;
  heightCm: number | null | undefined;
  weightKg: number | null | undefined;
  activityLevel: ActivityLevel | null | undefined;
  nutritionGoal?: NutritionGoalMode;
  dietMode?: DietMode;
  budgetLevel?: BudgetLevel;
  prepTimePreference?: PrepTimePreference;
  mealsPerDay?: 3 | 4 | 5;
  allergens?: string[];
  dislikedFoods?: string[];
  hasMedicalScreeningRisk?: boolean;
  catalog?: FoodItem[];
}): PersonalizedNutritionPlan {
  const {
    age,
    sex,
    heightCm,
    weightKg,
    activityLevel,
    nutritionGoal = 'nutrition_balance',
    dietMode = 'balanced',
    budgetLevel = 'standard',
    prepTimePreference = 'moderate',
    mealsPerDay = 4,
    allergens = [],
    dislikedFoods = [],
    hasMedicalScreeningRisk = false,
    catalog = VIETNAMESE_FOOD_CATALOG,
  } = input;

  const missingFields: string[] = [];
  const validAge =
    typeof age === 'number' &&
    Number.isFinite(age) &&
    age >= BMI_INPUT_LIMITS.LIMITED_AGE_MIN &&
    age <= BMI_INPUT_LIMITS.AGE_MAX;
  const validHeight =
    typeof heightCm === 'number' &&
    Number.isFinite(heightCm) &&
    heightCm >= BMI_INPUT_LIMITS.HEIGHT_CM_MIN &&
    heightCm <= BMI_INPUT_LIMITS.HEIGHT_CM_MAX;
  const validWeight =
    typeof weightKg === 'number' &&
    Number.isFinite(weightKg) &&
    weightKg >= BMI_INPUT_LIMITS.WEIGHT_KG_MIN &&
    weightKg <= BMI_INPUT_LIMITS.WEIGHT_KG_MAX;

  if (!validAge) missingFields.push('Độ tuổi / Ngày sinh hợp lệ (5–120 tuổi)');
  if (!validHeight) {
    missingFields.push(
      `Chiều cao (${BMI_INPUT_LIMITS.HEIGHT_CM_MIN}–${BMI_INPUT_LIMITS.HEIGHT_CM_MAX} cm)`
    );
  }
  if (!validWeight) {
    missingFields.push(
      `Cân nặng (${BMI_INPUT_LIMITS.WEIGHT_KG_MIN}–${BMI_INPUT_LIMITS.WEIGHT_KG_MAX} kg)`
    );
  }

  const effectiveGoal: NutritionGoalMode = hasMedicalScreeningRisk
    ? 'healthy_habits'
    : nutritionGoal;

  // Guard: If core anthropometric data is missing, NEVER fabricate BMI/BMR/TDEE/Macros
  if (!validAge || !validHeight || !validWeight) {
    return {
      hasSufficientBodyMetrics: false,
      missingFields,
      missingBmrReasonVi:
        'Chưa đủ chiều cao, cân nặng, độ tuổi hoặc thông số sinh học để tính BMR.',
      missingTdeeReasonVi:
        'Cần đủ thông tin BMR và mức độ vận động để ước tính TDEE.',
      isUnder18: false,
      age: validAge ? (age as number) : null,
      bmi: null,
      bmiClassification: null,
      bodyStateMode: 'insufficient_data',
      bodyStateTitleVi: 'Chưa đủ dữ liệu để phân tích thể trạng',
      bodyStateAdviceVi:
        'Hệ thống không tự suy đoán hay tạo kết quả khi thiếu thông số đầu vào. Vui lòng bổ sung đầy đủ các trường còn thiếu bên trên.',
      bmr: null,
      tdee: null,
      targetKcal: null,
      safetyAdjustmentMessageVi: null,
      macros: null,
      waterLitresEstimated: null,
      fiberTargetG: null,
      effectiveGoal,
      effectiveDietMode: dietMode,
      mealsPerDay,
      comparisonRows: [],
      metricExplanations: METRIC_EXPLANATIONS,
      recommendedFoods: [],
      foodsToLimit: buildFoodsToLimitGuidance({
        nutritionGoal: effectiveGoal,
        hasMedicalScreeningRisk,
        allergens,
      }),
      isEstimated: true,
    };
  }

  const safeAge = age as number;
  const safeHeight = heightCm as number;
  const safeWeight = weightKg as number;

  const bmi = calculateBMI(safeWeight, safeHeight);
  const bmiClassification = classifyBMI(bmi, safeAge);
  const waterLitresEstimated =
    Math.round(Math.min(3.5, Math.max(1.5, (safeWeight * 35) / 1000)) * 10) / 10;

  if (bmiClassification.isLimitedMode) {
    const recommendedFoods = selectRecommendedFoods({
      catalog,
      allergens,
      dislikedFoods,
      dietMode,
      nutritionGoal: 'healthy_habits',
      budgetLevel,
      prepTimePreference,
      bodyStateMode: 'under_18_limited',
    });

    return {
      hasSufficientBodyMetrics: true,
      missingFields: [],
      missingBmrReasonVi:
        'Chế độ giới hạn dưới 18 tuổi không áp dụng công thức BMR người lớn.',
      missingTdeeReasonVi:
        'Chế độ giới hạn dưới 18 tuổi không tính TDEE hoặc mục tiêu thâm hụt calo.',
      isUnder18: true,
      age: safeAge,
      bmi,
      bmiClassification,
      bodyStateMode: 'under_18_limited',
      bodyStateTitleVi: 'Chế độ giới hạn cho người dưới 18 tuổi',
      bodyStateAdviceVi:
        'Ở độ tuổi dưới 18, cơ thể đang trong giai đoạn tăng trưởng tự nhiên. Ứng dụng không tính mục tiêu calo hay thiết lập chế độ giảm cân; khuyến nghị duy trì đủ bữa chính đa dạng rau xanh, đạm, sữa và vận động đều đặn.',
      bmr: null,
      tdee: null,
      targetKcal: null,
      safetyAdjustmentMessageVi: null,
      macros: null,
      waterLitresEstimated,
      fiberTargetG: 22,
      effectiveGoal: 'healthy_habits',
      effectiveDietMode: dietMode,
      mealsPerDay,
      comparisonRows: [
        {
          metricVi: 'Chỉ số BMI hiện tại',
          currentValueVi: `${bmi.toFixed(1)} kg/m²`,
          referenceNeedVi: 'Đánh giá theo biểu đồ tăng trưởng WHO theo tuổi',
          userGoalVi: 'Phát triển tự nhiên, khỏe mạnh',
          improvementFocusVi: 'Theo dõi định kỳ với phụ huynh hoặc bác sĩ nhi khoa',
        },
        {
          metricVi: 'Nước uống tham khảo',
          currentValueVi: 'Chưa đo trực tiếp',
          referenceNeedVi: `~${waterLitresEstimated} lít/ngày`,
          userGoalVi: 'Uống đủ nước lọc suốt ngày',
          improvementFocusVi: 'Hạn chế nước ngọt đóng chai & trà sữa nhiều đường',
        },
      ],
      metricExplanations: METRIC_EXPLANATIONS,
      recommendedFoods,
      foodsToLimit: buildFoodsToLimitGuidance({
        nutritionGoal: 'healthy_habits',
        hasMedicalScreeningRisk: true,
        allergens,
      }),
      isEstimated: true,
    };
  }

  // IMPORTANT: Never auto-default sex ('other' or null) to 'male'!
  const hasBiologicalSex = sex === 'male' || sex === 'female';
  const missingBmrReasonVi = hasBiologicalSex
    ? null
    : 'Chưa cung cấp thông số sinh học (Nam hoặc Nữ). Hệ thống KHÔNG tự mặc định giới tính nên chưa tính BMR/TDEE.';

  const bmr = hasBiologicalSex
    ? Math.round(
        calculateBMR({
          weightKg: safeWeight,
          heightCm: safeHeight,
          age: safeAge,
          sex,
        })
      )
    : null;

  const missingTdeeReasonVi =
    bmr === null
      ? missingBmrReasonVi
      : !activityLevel
        ? 'Chưa chọn mức độ vận động hằng ngày nên chưa thể ước tính TDEE.'
        : null;

  const tdee =
    bmr !== null && activityLevel ? Math.round(calculateTDEE(bmr, activityLevel)) : null;

  let bodyStateMode: BodyStateMode = 'balanced_bmi';
  let bodyStateTitleVi = 'Thể trạng đang ở ngưỡng tham khảo cân đối';
  let bodyStateAdviceVi =
    'Nền tảng dinh dưỡng nên tập trung giữ ổn định năng lượng gần TDEE, đa dạng thực phẩm Việt Nam, đủ chất xơ (25–30g/ngày) và hạn chế thực phẩm quá mặn hoặc nhiều đường bổ sung.';

  if (bmi < 18.5) {
    bodyStateMode = 'low_bmi';
    bodyStateTitleVi = 'Chỉ số BMI dưới ngưỡng tham khảo (< 18.5 kg/m²)';
    bodyStateAdviceVi =
      'Nên ưu tiên bổ sung năng lượng nhẹ nhàng từ các món giàu dưỡng chất, đủ đạm (thịt nạc, cá, trứng, sữa đậu nành, các loại hạt) và chia nhỏ bữa ăn trong ngày. Tránh bỏ bữa hoặc ăn quá nhiều đồ ngọt rỗng.';
  } else if (bmi >= 23) {
    bodyStateMode = 'elevated_bmi';
    bodyStateTitleVi = 'Chỉ số BMI cao hơn ngưỡng tham khảo châu Á (≥ 23.0 kg/m²)';
    bodyStateAdviceVi =
      'Nên ưu tiên thực phẩm giàu chất xơ (rau xanh, canh ít béo, khoai lang, gạo lứt), giữ đủ đạm nạc (ức gà, cá hấp, đậu phụ) để bảo toàn cơ, đồng thời giảm đồ uống có đường và món chiên rán nhiều dầu.';
  }

  let finalTargetKcal: number | null = null;
  let safetyAdjustmentMessageVi: string | null = null;

  if (tdee !== null && hasBiologicalSex) {
    const safetyGoalType = mapNutritionGoalToSafetyGoalType(effectiveGoal);
    const requestedPace =
      safetyGoalType === 'lose_gradual' || safetyGoalType === 'gain_gradual'
        ? 0.25
        : 0;

    const targetRes = buildCalorieTarget({
      tdee,
      sex,
      goalType: safetyGoalType,
      requestedWeeklyChangeKg: requestedPace,
    });

    finalTargetKcal = targetRes.targetKcal;
    safetyAdjustmentMessageVi = targetRes.messageVi;

    if (
      effectiveGoal === 'build_muscle' &&
      finalTargetKcal !== null &&
      !hasMedicalScreeningRisk
    ) {
      finalTargetKcal = Math.min(6000, finalTargetKcal + 150);
    }
  }

  let macros: MacroTargets | null = null;
  const fiberTargetG =
    finalTargetKcal !== null ? (finalTargetKcal >= 2200 ? 30 : 25) : 25;

  if (finalTargetKcal !== null) {
    let proteinPct = 20;
    let fatPct = 25;
    let carbPct = 55;

    if (effectiveGoal === 'build_muscle' || dietMode === 'high_protein') {
      proteinPct = 25;
      fatPct = 25;
      carbPct = 50;
    } else if (effectiveGoal === 'lose_gradual') {
      proteinPct = 25;
      fatPct = 25;
      carbPct = 50;
    } else if (dietMode === 'plant_heavy' || dietMode === 'vegetarian') {
      proteinPct = 18;
      fatPct = 25;
      carbPct = 57;
    }

    const proteinKcal = Math.round((finalTargetKcal * proteinPct) / 100);
    const fatKcal = Math.round((finalTargetKcal * fatPct) / 100);
    const carbKcal = Math.max(0, finalTargetKcal - proteinKcal - fatKcal);

    macros = {
      proteinG: Math.round(proteinKcal / 4),
      proteinKcal,
      proteinPct,
      carbG: Math.round(carbKcal / 4),
      carbKcal,
      carbPct,
      fatG: Math.round(fatKcal / 9),
      fatKcal,
      fatPct,
      fiberG: fiberTargetG,
      waterMl: Math.round(waterLitresEstimated * 1000),
    };
  }

  const goalLabelVi =
    NUTRITION_GOAL_OPTIONS.find((g) => g.value === effectiveGoal)?.labelVi ??
    'Cân bằng dinh dưỡng';

  const comparisonRows: NutritionComparisonRow[] = [
    {
      metricVi: 'Chỉ số BMI (Châu Á)',
      currentValueVi: `${bmi.toFixed(1)} kg/m² (${bmiClassification.labelVi})`,
      referenceNeedVi: '18.5 – 22.9 kg/m² (tham khảo)',
      userGoalVi: goalLabelVi,
      improvementFocusVi:
        bodyStateMode === 'elevated_bmi'
          ? 'Tăng rau xanh & đạm nạc, kiểm soát dầu mỡ ẩn và khẩu phần tinh bột tinh chế'
          : bodyStateMode === 'low_bmi'
            ? `Chia đều ${mealsPerDay} bữa/ngày, bổ sung đạm và hạt dinh dưỡng lành mạnh`
            : 'Duy trì đa dạng món Việt và vận động đều đặn',
    },
    {
      metricVi: 'Nhu cầu năng lượng (BMR / TDEE)',
      currentValueVi:
        bmr !== null && tdee !== null
          ? `BMR ${bmr} · TDEE ${tdee} kcal`
          : 'Chưa đủ thông số sinh học để tính',
      referenceNeedVi:
        tdee !== null ? `~${tdee.toLocaleString('vi-VN')} kcal/ngày` : 'Cần chọn Nam/Nữ & vận động',
      userGoalVi:
        finalTargetKcal !== null
          ? `~${finalTargetKcal.toLocaleString('vi-VN')} kcal/ngày (Ước tính)`
          : 'Ưu tiên chất lượng bữa ăn (không đặt calo)',
      improvementFocusVi:
        finalTargetKcal !== null
          ? `Phân bổ hợp lý qua ${mealsPerDay} bữa mỗi ngày để tránh quá đói hoặc quá no`
          : 'Chọn đủ thông số sinh học nếu muốn tính BMR/TDEE tham khảo',
    },
    {
      metricVi: 'Chất đạm · Tinh bột · Chất béo',
      currentValueVi: 'Theo dõi qua Nhật ký ăn uống',
      referenceNeedVi: macros
        ? `Đạm ${macros.proteinG}g · Carb ${macros.carbG}g · Béo ${macros.fatG}g`
        : 'Đủ 3 nhóm chất chính ở mỗi bữa',
      userGoalVi:
        DIET_MODE_OPTIONS.find((d) => d.value === dietMode)?.labelVi ?? dietMode,
      improvementFocusVi:
        effectiveGoal === 'build_muscle' || dietMode === 'high_protein'
          ? 'Đảm bảo có nguồn đạm rõ ràng (cá, ức gà, trứng, đậu phụ) trong cả 3 bữa chính'
          : 'Ưu tiên tinh bột phức (cơm gạo lứt, khoai lang) và chất béo từ cá/hạt',
    },
    {
      metricVi: 'Chất xơ & Nước uống',
      currentValueVi: 'Thường dễ thiếu rau hoặc uống ít nước',
      referenceNeedVi: `${fiberTargetG}g chất xơ · ~${waterLitresEstimated} lít nước/ngày`,
      userGoalVi: 'Cải thiện tiêu hóa & độ no tự nhiên',
      improvementFocusVi:
        'Bổ sung ít nhất 2 phần rau luộc/canh rau và 1 phần trái cây tươi mỗi ngày',
    },
  ];

  const recommendedFoods = selectRecommendedFoods({
    catalog,
    allergens,
    dislikedFoods,
    dietMode,
    nutritionGoal: effectiveGoal,
    budgetLevel,
    prepTimePreference,
    bodyStateMode,
  });

  const foodsToLimit = buildFoodsToLimitGuidance({
    nutritionGoal: effectiveGoal,
    hasMedicalScreeningRisk,
    allergens,
  });

  return {
    hasSufficientBodyMetrics: true,
    missingFields: [],
    missingBmrReasonVi,
    missingTdeeReasonVi,
    isUnder18: false,
    age: safeAge,
    bmi,
    bmiClassification,
    bodyStateMode,
    bodyStateTitleVi,
    bodyStateAdviceVi,
    bmr,
    tdee,
    targetKcal: finalTargetKcal,
    safetyAdjustmentMessageVi,
    macros,
    waterLitresEstimated,
    fiberTargetG,
    effectiveGoal,
    effectiveDietMode: dietMode,
    mealsPerDay,
    comparisonRows,
    metricExplanations: METRIC_EXPLANATIONS,
    recommendedFoods,
    foodsToLimit,
    isEstimated: true,
  };
}
