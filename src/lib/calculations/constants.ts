import type { ActivityLevel, BMICategoryKey } from '@/src/types/health';

/**
 * Ngưỡng phân loại BMI dành cho người trưởng thành (>= 18 tuổi) theo khu vực Châu Á - Thái Bình Dương:
 * - Dưới 18.5: Thiếu cân
 * - Từ 18.5 đến 22.9: Bình thường
 * - Từ 23.0 đến 24.9: Thừa cân
 * - Từ 25.0 trở lên: Béo phì
 *
 * LƯU Ý XÁC MINH: Chủ sở hữu dự án cần kiểm tra và đối chiếu lại các ngưỡng này
 * với hướng dẫn chuyên môn hiện hành của WHO và Bộ Y tế Việt Nam trước khi triển khai rộng rãi.
 */
export const ASIA_PACIFIC_BMI_THRESHOLDS = {
  UNDERWEIGHT_MAX: 18.5,
  NORMAL_MAX: 22.9,
  OVERWEIGHT_MAX: 24.9,
  OBESE_MIN: 25.0,
} as const;

export const ADULT_MIN_AGE = 18;
export const MAX_AGE = 120;
export const MIN_LIMITED_AGE = 5;

export const BMI_INPUT_LIMITS = {
  HEIGHT_CM_MIN: 120,
  HEIGHT_CM_MAX: 230,
  WEIGHT_KG_MIN: 20,
  WEIGHT_KG_MAX: 300,
  ADULT_AGE_MIN: ADULT_MIN_AGE,
  LIMITED_AGE_MIN: MIN_LIMITED_AGE,
  AGE_MAX: MAX_AGE,
} as const;

export const PROFILE_INPUT_LIMITS = {
  DISPLAY_NAME_MAX: 100,
  BIRTH_YEAR_MIN: 1900,
  BIRTH_YEAR_MAX: 2021,
  HEIGHT_CM_MIN: 100,
  HEIGHT_CM_MAX: 250,
  WEIGHT_KG_MIN: 15,
  WEIGHT_KG_MAX: 300,
  MAX_DIETARY_PREFERENCES: 15,
  MAX_ALLERGENS: 20,
  MAX_NOTE_LENGTH: 300,
} as const;

export const BMI_CATEGORY_METADATA: Record<
  BMICategoryKey,
  {
    labelVi: string;
    shortDescVi: string;
    rangeLabelVi: string;
    tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  }
> = {
  underweight: {
    labelVi: 'Thiếu cân',
    shortDescVi:
      'Chỉ số BMI nằm dưới mức 18.5. Bạn nên tìm hiểu chế độ ăn đủ năng lượng và cân bằng nhóm chất, hoặc tham khảo chuyên gia dinh dưỡng nếu cần.',
    rangeLabelVi: '< 18.5',
    tone: 'info',
  },
  normal: {
    labelVi: 'Bình thường',
    shortDescVi:
      'Chỉ số BMI nằm trong khoảng tham chiếu 18.5 – 22.9 cho người trưởng thành khu vực Châu Á - Thái Bình Dương. Hãy duy trì lối sống cân bằng và đa dạng thực phẩm Việt.',
    rangeLabelVi: '18.5 – 22.9',
    tone: 'success',
  },
  overweight: {
    labelVi: 'Thừa cân',
    shortDescVi:
      'Chỉ số BMI nằm trong khoảng 23.0 – 24.9. Đây là ngưỡng cảnh báo sớm theo phân loại Châu Á - Thái Bình Dương; nên chú ý khẩu phần và vận động đều đặn.',
    rangeLabelVi: '23.0 – 24.9',
    tone: 'warning',
  },
  obese: {
    labelVi: 'Béo phì',
    shortDescVi:
      'Chỉ số BMI từ 25.0 trở lên theo ngưỡng Châu Á - Thái Bình Dương. Bạn nên trao đổi với bác sĩ hoặc chuyên gia dinh dưỡng để được đánh giá toàn diện hơn.',
    rangeLabelVi: '≥ 25.0',
    tone: 'danger',
  },
  under_18_limited: {
    labelVi: 'Chế độ giới hạn (dưới 18 tuổi)',
    shortDescVi:
      'Trẻ em và thanh thiếu niên dưới 18 tuổi được đánh giá bằng biểu đồ BMI theo tuổi (tham chiếu tăng trưởng của WHO) chứ không dùng ngưỡng người lớn. Vui lòng tham khảo ý kiến bác sĩ hoặc chuyên gia dinh dưỡng.',
    rangeLabelVi: 'Theo tuổi (WHO)',
    tone: 'neutral',
  },
};

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LEVEL_OPTIONS: Array<{
  value: ActivityLevel;
  labelVi: string;
  descriptionVi: string;
}> = [
  {
    value: 'sedentary',
    labelVi: 'Ít vận động',
    descriptionVi: 'Làm việc văn phòng, ít đi lại hoặc không tập thể dục',
  },
  {
    value: 'light',
    labelVi: 'Vận động nhẹ',
    descriptionVi: 'Tập thể dục nhẹ hoặc đi bộ 1–3 ngày/tuần',
  },
  {
    value: 'moderate',
    labelVi: 'Vận động vừa',
    descriptionVi: 'Tập thể thao vừa phải 3–5 ngày/tuần',
  },
  {
    value: 'active',
    labelVi: 'Vận động nhiều',
    descriptionVi: 'Tập luyện cường độ khá cao 6–7 ngày/tuần',
  },
  {
    value: 'very_active',
    labelVi: 'Vận động rất nhiều',
    descriptionVi: 'Lao động thể lực nặng hoặc tập luyện 2 buổi/ngày',
  },
];

export const CONSENT_VERSION = 'decree-13-2023-nd-cp-draft-v1';
