import type { FoodItem, NutrientNeedGroupId } from '@/src/types/food';
import { findMatchingAllergens } from './nutrients';

export interface NutrientNeedGroupMeta {
  id: NutrientNeedGroupId;
  labelVi: string;
  shortTagVi: string;
  descriptionVi: string;
  benefitsVi: string;
  cautionsVi: string;
  thresholdRuleVi: string;
  representativeFoodId: string;
  tone: 'success' | 'info' | 'warning' | 'neutral';
  matches: (food: FoodItem) => boolean;
}

export const NUTRIENT_NEED_GROUPS: NutrientNeedGroupMeta[] = [
  {
    id: 'rich_protein',
    labelVi: 'Thực phẩm giàu đạm (Protein)',
    shortTagVi: 'Đạm ≥ 14g / 100g',
    descriptionVi:
      'Bao gồm thịt nạc, cá, hải sản, trứng, đậu phụ nén và các loại hạt giàu protein.',
    benefitsVi:
      'Hỗ trợ duy trì khối cơ, tạo cảm giác no lâu và phục hồi mô cơ thể hằng ngày.',
    cautionsVi:
      'Nên đa dạng cả đạm động vật ít mỡ (ức gà, cá) và đạm thực vật (đậu phụ, đậu hạt).',
    thresholdRuleVi: 'Hàm lượng Protein ≥ 14 g trên 100 g',
    representativeFoodId: 'uc-ga-luoc',
    tone: 'success',
    matches: (food) =>
      food.nutrientsPer100g.proteinG !== null &&
      food.nutrientsPer100g.proteinG >= 14,
  },
  {
    id: 'rich_carb',
    labelVi: 'Thực phẩm giàu tinh bột & năng lượng chính',
    shortTagVi: 'Carb ≥ 20g / 100g',
    descriptionVi:
      'Nhóm gạo, cơm, bánh mì, khoai, ngô, đậu hạt và các món mì cung cấp nguồn nhiên liệu chính.',
    benefitsVi:
      'Cung cấp glucose cho hoạt động trí não, học tập và vận động thể chất.',
    cautionsVi:
      'Ưu tiên tinh bột giàu chất xơ như gạo lứt, khoai lang, ngô, bánh mì nguyên cám; cân đối khẩu phần theo mức vận động.',
    thresholdRuleVi: 'Hàm lượng Carb (Tinh bột) ≥ 20 g trên 100 g',
    representativeFoodId: 'com-gao-lut',
    tone: 'info',
    matches: (food) =>
      food.nutrientsPer100g.carbG !== null &&
      food.nutrientsPer100g.carbG >= 20,
  },
  {
    id: 'healthy_fat',
    labelVi: 'Thực phẩm giàu chất béo tốt',
    shortTagVi: 'Cá béo, quả bơ & hạt ≥ 8g béo / 100g',
    descriptionVi:
      'Cá hồi, quả bơ, hạt điều, hạnh nhân, hạt chia và đậu phộng rang tự nhiên.',
    benefitsVi:
      'Cung cấp acid béo không bão hòa và hỗ trợ hấp thu các vitamin tan trong dầu (A, D, E, K).',
    cautionsVi:
      'Hạt dinh dưỡng và bơ có mật độ năng lượng cao, nên dùng khẩu phần nhỏ gọn (20–30g hạt hoặc 1/2 quả bơ).',
    thresholdRuleVi:
      'Chất béo ≥ 8 g/100g thuộc nhóm cá béo, đậu hạt hoặc quả bơ',
    representativeFoodId: 'ca-hoi-ap-chao',
    tone: 'success',
    matches: (food) => {
      const fat = food.nutrientsPer100g.fatG;
      if (fat === null || fat < 8) return false;
      return (
        food.category === 'fish_seafood' ||
        food.category === 'legumes_nuts' ||
        food.id === 'bo-qua'
      );
    },
  },
  {
    id: 'high_fiber',
    labelVi: 'Thực phẩm giàu chất xơ',
    shortTagVi: 'Chất xơ ≥ 2.2g / 100g',
    descriptionVi:
      'Rau lá xanh, đậu bắp, ổi, bơ, khoai lang, gạo lứt và các loại đậu nguyên hạt.',
    benefitsVi:
      'Hỗ trợ hệ tiêu hóa khỏe mạnh, ổn định tốc độ hấp thu đường và tăng cảm giác no.',
    cautionsVi:
      'Khi tăng lượng chất xơ trong khẩu phần, nhớ uống đủ nước lọc hằng ngày.',
    thresholdRuleVi: 'Hàm lượng Chất xơ ≥ 2.2 g trên 100 g',
    representativeFoodId: 'khoai-lang-luoc',
    tone: 'success',
    matches: (food) =>
      food.nutrientsPer100g.fiberG !== null &&
      food.nutrientsPer100g.fiberG >= 2.2,
  },
  {
    id: 'vitamins_minerals',
    labelVi: 'Thực phẩm giàu vitamin & khoáng chất',
    shortTagVi: 'Rau củ tươi & trái cây nguyên múi',
    descriptionVi:
      'Đa dạng rau xanh, củ quả tươi và trái cây Việt Nam nhiều màu sắc tự nhiên.',
    benefitsVi:
      'Bổ sung vitamin C, kali, folate, beta-caroten và các chất chống oxy hóa thiết yếu.',
    cautionsVi:
      'Ưu tiên chế biến luộc, hấp hoặc ăn tươi; hạn chế chiên xào ngập dầu hoặc chấm quá mặn.',
    thresholdRuleVi: 'Nhóm Rau củ & nấm hoặc Trái cây tươi',
    representativeFoodId: 'xoai-chin',
    tone: 'success',
    matches: (food) =>
      food.category === 'vegetables' || food.category === 'fruits',
  },
  {
    id: 'low_energy',
    labelVi: 'Thực phẩm ít năng lượng',
    shortTagVi: '≤ 85 kcal / 100g',
    descriptionVi:
      'Canh rau gia đình, rau củ luộc, trái cây thanh mát, sữa chua không đường và đồ uống không đường.',
    benefitsVi:
      'Giúp làm đầy thể tích bữa ăn, tạo cảm giác nhẹ nhàng mà không làm tăng vọt tổng calo.',
    cautionsVi:
      'Không nên chỉ ăn thực phẩm quá ít năng lượng; luôn kết hợp đủ đạm và tinh bột tốt.',
    thresholdRuleVi: 'Năng lượng ≤ 85 kcal trên 100 g',
    representativeFoodId: 'canh-chua-ca-loc',
    tone: 'info',
    matches: (food) =>
      food.nutrientsPer100g.energyKcal !== null &&
      food.nutrientsPer100g.energyKcal <= 85,
  },
  {
    id: 'high_energy',
    labelVi: 'Thực phẩm năng lượng cao',
    shortTagVi: '≥ 220 kcal / 100g',
    descriptionVi:
      'Các loại hạt béo, phô mai, bánh mì thịt, sườn rim và món đậm đặc năng lượng.',
    benefitsVi:
      'Hữu ích cho người cần bổ sung năng lượng gọn nhẹ, người gầy muốn tăng cân lành mạnh hoặc vận động nhiều.',
    cautionsVi:
      'Cần chú ý định lượng khẩu phần nếu mục tiêu hiện tại là kiểm soát hoặc giảm năng lượng.',
    thresholdRuleVi: 'Năng lượng ≥ 220 kcal trên 100 g',
    representativeFoodId: 'banh-mi-thit',
    tone: 'warning',
    matches: (food) =>
      food.nutrientsPer100g.energyKcal !== null &&
      food.nutrientsPer100g.energyKcal >= 220,
  },
  {
    id: 'high_sugar',
    labelVi: 'Thực phẩm có hàm lượng đường cao (cần lưu ý)',
    shortTagVi: 'Đường ≥ 10g / 100g',
    descriptionVi:
      'Đồ uống có đường, chè ngọt, bánh flan, sữa chua có đường và một số trái cây vị ngọt đậm.',
    benefitsVi:
      'Cung cấp vị ngon hoặc năng lượng nhanh khi cần vận động cường độ cao.',
    cautionsVi:
      'Nên phân biệt đường tự nhiên trong trái cây nguyên quả và đường bổ sung trong trà sữa, nước ngọt để điều chỉnh tần suất.',
    thresholdRuleVi: 'Hàm lượng Đường tổng số ≥ 10 g trên 100 g',
    representativeFoodId: 'bun-cha-ha-noi',
    tone: 'warning',
    matches: (food) =>
      food.nutrientsPer100g.sugarG !== null &&
      food.nutrientsPer100g.sugarG >= 10,
  },
  {
    id: 'high_sodium',
    labelVi: 'Thực phẩm nhiều natri / muối (cần lưu ý)',
    shortTagVi: 'Natri ≥ 380mg / 100g',
    descriptionVi:
      'Món kho mặn, nước mắm chấm, chả lụa, bánh mì thịt nguội và một số món nước dùng đậm vị.',
    benefitsVi:
      'Tạo hương vị đậm đà đặc trưng của ẩm thực truyền thống Việt Nam.',
    cautionsVi:
      'Khi dùng các món này, hãy giảm chấm thêm nước mắm, hạn chế húp hết nước dùng và ăn tăng rau xanh.',
    thresholdRuleVi: 'Hàm lượng Natri ≥ 380 mg trên 100 g',
    representativeFoodId: 'pho-bo-tai',
    tone: 'warning',
    matches: (food) =>
      food.nutrientsPer100g.sodiumMg !== null &&
      food.nutrientsPer100g.sodiumMg >= 380,
  },
];

export const NUTRIENT_NEED_GROUP_MAP = new Map<
  NutrientNeedGroupId,
  NutrientNeedGroupMeta
>(NUTRIENT_NEED_GROUPS.map((g) => [g.id, g]));

export function getFoodNutrientGroups(food: FoodItem): NutrientNeedGroupId[] {
  return NUTRIENT_NEED_GROUPS.filter((g) => g.matches(food)).map((g) => g.id);
}

export function filterFoodsByNutrientGroup(
  foods: FoodItem[],
  groupId: NutrientNeedGroupId | 'all'
): FoodItem[] {
  if (groupId === 'all') return foods;
  const meta = NUTRIENT_NEED_GROUP_MAP.get(groupId);
  if (!meta) return foods;
  return foods.filter((food) => meta.matches(food));
}

/**
 * Tìm các món ăn thay thế có giá trị dinh dưỡng tương đương trong cùng nhóm hoặc gần mức calo/đạm.
 * Loại trừ hoàn toàn các chất gây dị ứng mà người dùng đã khai báo.
 */
export function findSimilarFoods(
  targetFood: FoodItem,
  catalog: FoodItem[],
  excludedAllergens: string[] = [],
  limit = 4
): FoodItem[] {
  const targetKcal = targetFood.nutrientsPer100g.energyKcal ?? 120;
  const targetProtein = targetFood.nutrientsPer100g.proteinG ?? 5;

  const candidates = catalog.filter((item) => {
    if (!item.isActive || item.id === targetFood.id) return false;
    if (
      excludedAllergens.length > 0 &&
      findMatchingAllergens(item.allergens, excludedAllergens).length > 0
    ) {
      return false;
    }
    return true;
  });

  const scored = candidates.map((item) => {
    const sameCategoryBonus = item.category === targetFood.category ? 0 : 60;
    const kcalDiff =
      item.nutrientsPer100g.energyKcal !== null
        ? Math.abs(item.nutrientsPer100g.energyKcal - targetKcal)
        : 120;
    const proteinDiff =
      item.nutrientsPer100g.proteinG !== null
        ? Math.abs(item.nutrientsPer100g.proteinG - targetProtein) * 5
        : 40;
    return {
      item,
      score: sameCategoryBonus + kcalDiff + proteinDiff,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.item);
}
