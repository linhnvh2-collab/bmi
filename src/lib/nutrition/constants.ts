import type {
  FoodCategory,
  NutrientKey,
  VerificationStatus,
} from '@/src/types/food';

/**
 * Danh sách nhóm thực phẩm Việt Nam dùng chung cho tìm kiếm, lọc và nhập dữ liệu.
 * Chủ sở hữu dự án có thể rà soát và điều chỉnh danh mục này khi cần.
 */
export const FOOD_CATEGORY_OPTIONS: Array<{
  value: FoodCategory;
  labelVi: string;
}> = [
  { value: 'rice_noodles', labelVi: 'Cơm, bún, phở & ngũ cốc' },
  { value: 'meat', labelVi: 'Thịt & gia cầm' },
  { value: 'fish_seafood', labelVi: 'Cá & hải sản' },
  { value: 'eggs_dairy', labelVi: 'Trứng & sữa' },
  { value: 'vegetables', labelVi: 'Rau củ & nấm' },
  { value: 'fruits', labelVi: 'Trái cây' },
  { value: 'legumes_nuts', labelVi: 'Đậu, hạt & chế phẩm' },
  { value: 'soups', labelVi: 'Canh & súp' },
  { value: 'snacks', labelVi: 'Ăn nhẹ & bánh truyền thống' },
  { value: 'drinks', labelVi: 'Đồ uống' },
  { value: 'condiments', labelVi: 'Gia vị & nước chấm' },
];

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> =
  FOOD_CATEGORY_OPTIONS.reduce(
    (acc, item) => {
      acc[item.value] = item.labelVi;
      return acc;
    },
    {} as Record<FoodCategory, string>
  );

/**
 * Danh sách sở thích ăn uống dùng chung cho Hồ sơ cá nhân (Giai đoạn 1 & sau).
 */
export const DIETARY_PREFERENCE_OPTIONS = [
  'Cơm gia đình truyền thống',
  'Ăn nhiều rau xanh',
  'Ít dầu mỡ',
  'Ít đường / giảm ngọt',
  'Ăn chay linh hoạt',
  'Ăn chay trường',
  'Ưu tiên món hấp / luộc',
  'Thích món nước (phở, bún)',
] as const;

/**
 * Danh sách chất gây dị ứng dùng chung duy nhất (tái sử dụng nguyên vẹn các giá trị từ Giai đoạn 1
 * và mở rộng tại một nơi để khớp chính xác với Hồ sơ cá nhân và Kho thực phẩm).
 */
export const ALLERGEN_OPTIONS = [
  'Hải sản (tôm, cua, sò)',
  'Cá',
  'Đậu phộng (lạc)',
  'Sữa & chế phẩm từ sữa',
  'Trứng',
  'Đậu nành',
  'Gluten (lúa mì)',
  'Mè (vừng)',
  'Các loại hạt cây',
  'Nhuyễn thể / Ốc',
] as const;

export const DIET_TAG_OPTIONS = [
  { value: 'vegetarian', labelVi: 'Ăn chay linh hoạt' },
  { value: 'vegan', labelVi: 'Ăn chay trường (thuần chay)' },
  { value: 'pescatarian', labelVi: 'Ăn cá & thực vật' },
  { value: 'gluten_free', labelVi: 'Không gluten' },
  { value: 'dairy_free', labelVi: 'Không sữa' },
  { value: 'low_sodium', labelVi: 'Ít natri' },
] as const;

export const DIET_TAG_LABELS: Record<string, string> =
  DIET_TAG_OPTIONS.reduce(
    (acc, item) => {
      acc[item.value] = item.labelVi;
      return acc;
    },
    {} as Record<string, string>
  );

export const VERIFICATION_STATUS_METADATA: Record<
  VerificationStatus,
  {
    labelVi: string;
    shortBadgeVi: string;
    explanationVi: string;
    tone: 'success' | 'warning' | 'neutral';
  }
> = {
  verified: {
    labelVi: 'Đã xác minh nguồn',
    shortBadgeVi: 'Đã xác minh',
    explanationVi:
      'Số liệu được nhập từ nguồn tài liệu dinh dưỡng đã công bố và có thông tin trích dẫn đầy đủ.',
    tone: 'success',
  },
  estimated: {
    labelVi: 'Ước tính',
    shortBadgeVi: 'Ước tính',
    explanationVi:
      'Số liệu chỉ mang tính ước tính từ công thức quy đổi hoặc tổng hợp tương đối, không phải giá trị phân tích phòng thí nghiệm.',
    tone: 'warning',
  },
  unverified: {
    labelVi: 'Chưa xác minh',
    shortBadgeVi: 'Chưa xác minh',
    explanationVi:
      'Dữ liệu chưa được đối chiếu nguồn chính thức và đang chờ kiểm duyệt; chỉ dùng để tham khảo sơ bộ.',
    tone: 'neutral',
  },
};

/**
 * Giới hạn tính hợp lý (plausibility limits) có thể cấu hình cho giá trị dinh dưỡng trên 100g
 * và đơn vị khẩu phần. Giúp chặn sai sót nhập liệu (như số âm hoặc vượt ngưỡng vật lý).
 */
export const NUTRIENT_PLAUSIBILITY_LIMITS = {
  energyKcalMax: 900,
  proteinGMax: 100,
  fatGMax: 100,
  carbGMax: 100,
  fiberGMax: 100,
  sugarGMax: 100,
  sodiumMgMax: 40000,
  servingGramsMax: 5000,
  portionGramsMax: 5000,
  sourceYearMin: 1900,
  sourceYearMax: 2100,
  maxAliases: 20,
  maxServingUnits: 30,
  maxAllergens: 20,
  maxDietTags: 15,
} as const;

export const NUTRIENT_FIELD_META: Array<{
  key: NutrientKey;
  labelVi: string;
  unit: string;
  maxLimit: number;
}> = [
  {
    key: 'energyKcal',
    labelVi: 'Năng lượng',
    unit: 'kcal',
    maxLimit: NUTRIENT_PLAUSIBILITY_LIMITS.energyKcalMax,
  },
  {
    key: 'proteinG',
    labelVi: 'Chất đạm (Protein)',
    unit: 'g',
    maxLimit: NUTRIENT_PLAUSIBILITY_LIMITS.proteinGMax,
  },
  {
    key: 'fatG',
    labelVi: 'Chất béo (Lipid)',
    unit: 'g',
    maxLimit: NUTRIENT_PLAUSIBILITY_LIMITS.fatGMax,
  },
  {
    key: 'carbG',
    labelVi: 'Tinh bột / Đường bột (Carb)',
    unit: 'g',
    maxLimit: NUTRIENT_PLAUSIBILITY_LIMITS.carbGMax,
  },
  {
    key: 'fiberG',
    labelVi: 'Chất xơ',
    unit: 'g',
    maxLimit: NUTRIENT_PLAUSIBILITY_LIMITS.fiberGMax,
  },
  {
    key: 'sugarG',
    labelVi: 'Đường tổng số',
    unit: 'g',
    maxLimit: NUTRIENT_PLAUSIBILITY_LIMITS.sugarGMax,
  },
  {
    key: 'sodiumMg',
    labelVi: 'Natri (Sodium)',
    unit: 'mg',
    maxLimit: NUTRIENT_PLAUSIBILITY_LIMITS.sodiumMgMax,
  },
];

export const ALLERGEN_DISCLAIMER_VI =
  'Thông tin dị ứng có thể chưa đầy đủ; hãy kiểm tra nhãn sản phẩm hoặc hỏi chuyên gia.';

export const MAX_COMPARE_FOODS = 3;
export const FIRESTORE_BATCH_LIMIT = 500;
