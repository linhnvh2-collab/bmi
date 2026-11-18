import type { GoalType } from '@/src/types/stage3';
import type { SexOption } from '@/src/types/health';

/**
 * Các hằng số giới hạn an toàn cho mục tiêu năng lượng và tốc độ thay đổi cân nặng.
 * Tất cả giá trị mặc định mang tính thận trọng để học tập và có thể cấu hình lại.
 */

// DEFAULT TO BE REVIEWED BY A NUTRITION PROFESSIONAL; source not verified
export const MAX_DAILY_DEFICIT_KCAL = 500;

// DEFAULT TO BE REVIEWED BY A NUTRITION PROFESSIONAL; source not verified
export const MAX_DAILY_SURPLUS_KCAL = 400;

// DEFAULT TO BE REVIEWED BY A NUTRITION PROFESSIONAL; source not verified
export const MIN_DAILY_KCAL_BY_SEX: Record<SexOption, number> = {
  female: 1200,
  male: 1500,
  other: 1350,
};

// DEFAULT TO BE REVIEWED BY A NUTRITION PROFESSIONAL; source not verified
export const MAX_WEEKLY_WEIGHT_CHANGE_KG = {
  loss: 0.5,
  gain: 0.5,
} as const;

// DEFAULT TO BE REVIEWED BY A NUTRITION PROFESSIONAL; source not verified
export const MIN_GOAL_DURATION_WEEKS = 4;

// DEFAULT TO BE REVIEWED BY A NUTRITION PROFESSIONAL; source not verified
export const KCAL_PER_KG_APPROX = 7700;

export const MAX_DAILY_TARGET_KCAL = 6000;

export interface ScreeningQuestion {
  id:
    | 'pregnancy_or_breastfeeding'
    | 'chronic_condition'
    | 'disordered_eating_history'
    | 'diet_affecting_medication';
  labelVi: string;
}

/**
 * Câu hỏi sàng lọc an toàn (chỉ lưu trong state giao diện, KHÔNG lưu vào Firestore).
 */
export const GOAL_SAFETY_SCREENING_QUESTIONS: ScreeningQuestion[] = [
  {
    id: 'pregnancy_or_breastfeeding',
    labelVi: 'Tôi đang mang thai hoặc đang cho con bú.',
  },
  {
    id: 'chronic_condition',
    labelVi:
      'Tôi đang có bệnh lý mạn tính cần theo dõi y tế (ví dụ: tiểu đường, bệnh thận, tim mạch).',
  },
  {
    id: 'disordered_eating_history',
    labelVi:
      'Tôi có tiền sử hoặc đang lo ngại về rối loạn ăn uống (eating disorder).',
  },
  {
    id: 'diet_affecting_medication',
    labelVi:
      'Tôi đang sử dụng thuốc kê đơn có ảnh hưởng đến chế độ ăn uống hoặc cân nặng.',
  },
];

export const GOAL_TYPE_OPTIONS: Array<{
  value: GoalType;
  labelVi: string;
  descriptionVi: string;
  usesCalorieTarget: boolean;
}> = [
  {
    value: 'healthy_habits',
    labelVi: 'Thói quen ăn uống lành mạnh (không đặt mục tiêu cân nặng)',
    descriptionVi:
      'Tập trung vào đa dạng món ăn Việt, cân bằng nhóm chất và theo dõi thói quen mà không đặt mức calo hay cân nặng.',
    usesCalorieTarget: false,
  },
  {
    value: 'maintain',
    labelVi: 'Duy trì cân nặng hiện tại',
    descriptionVi:
      'Giữ mức năng lượng tham khảo gần với tổng tiêu hao hàng ngày (TDEE) ước tính.',
    usesCalorieTarget: true,
  },
  {
    value: 'lose_gradual',
    labelVi: 'Giảm cân từ từ, an toàn',
    descriptionVi:
      'Mức giảm chậm có giới hạn an toàn (tối đa theo cấu hình chuyên môn, không hạ dưới ngưỡng tối thiểu).',
    usesCalorieTarget: true,
  },
  {
    value: 'gain_gradual',
    labelVi: 'Tăng cân từ từ',
    descriptionVi:
      'Bổ sung năng lượng nhẹ nhàng theo giới hạn an toàn hàng tuần.',
    usesCalorieTarget: true,
  },
];

export const GOAL_TYPE_LABELS: Record<GoalType, string> = GOAL_TYPE_OPTIONS.reduce(
  (acc, item) => {
    acc[item.value] = item.labelVi;
    return acc;
  },
  {} as Record<GoalType, string>
);
