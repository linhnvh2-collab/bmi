import { z } from 'zod';
import { BMI_INPUT_LIMITS, PROFILE_INPUT_LIMITS } from '@/src/lib/calculations/constants';
import { DIARY_LIMITS, SHOPPING_LIST_LIMITS } from '@/src/lib/diary/constants';
import { NUTRIENT_PLAUSIBILITY_LIMITS } from '@/src/lib/nutrition/constants';
import { MAX_WEEKLY_WEIGHT_CHANGE_KG } from '@/src/lib/safety/constants';

function parseNumericInput(val: unknown): unknown {
  if (val === '' || val === null || val === undefined) {
    return undefined;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim().replace(',', '.');
    if (trimmed === '') {
      return undefined;
    }
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? val : parsed;
  }
  return val;
}

function createNumericField(
  requiredMsg: string,
  invalidMsg: string,
  build: (schema: z.ZodNumber) => z.ZodNumber
) {
  const base = z
    .number({
      error: (issue) => (issue.input === undefined ? requiredMsg : invalidMsg),
    })
    .finite(invalidMsg);
  return z.preprocess(parseNumericInput, build(base));
}

export const bmiFormSchema = z.object({
  heightCm: createNumericField(
    'Vui lòng nhập chiều cao (cm).',
    'Chiều cao phải là một số hợp lệ.',
    (s) =>
      s
        .min(
          BMI_INPUT_LIMITS.HEIGHT_CM_MIN,
          `Chiều cao phải từ ${BMI_INPUT_LIMITS.HEIGHT_CM_MIN} cm trở lên.`
        )
        .max(
          BMI_INPUT_LIMITS.HEIGHT_CM_MAX,
          `Chiều cao không được vượt quá ${BMI_INPUT_LIMITS.HEIGHT_CM_MAX} cm.`
        )
  ),
  weightKg: createNumericField(
    'Vui lòng nhập cân nặng (kg).',
    'Cân nặng phải là một số hợp lệ.',
    (s) =>
      s
        .min(
          BMI_INPUT_LIMITS.WEIGHT_KG_MIN,
          `Cân nặng phải từ ${BMI_INPUT_LIMITS.WEIGHT_KG_MIN} kg trở lên.`
        )
        .max(
          BMI_INPUT_LIMITS.WEIGHT_KG_MAX,
          `Cân nặng không được vượt quá ${BMI_INPUT_LIMITS.WEIGHT_KG_MAX} kg.`
        )
  ),
  age: createNumericField(
    'Vui lòng nhập độ tuổi.',
    'Tuổi phải là một số nguyên hợp lệ.',
    (s) =>
      s
        .int('Tuổi phải là số nguyên.')
        .min(
          BMI_INPUT_LIMITS.LIMITED_AGE_MIN,
          `Độ tuổi hỗ trợ tối thiểu là ${BMI_INPUT_LIMITS.LIMITED_AGE_MIN} tuổi.`
        )
        .max(
          BMI_INPUT_LIMITS.AGE_MAX,
          `Độ tuổi không được vượt quá ${BMI_INPUT_LIMITS.AGE_MAX} tuổi.`
        )
  ),
  note: z
    .string()
    .max(
      PROFILE_INPUT_LIMITS.MAX_NOTE_LENGTH,
      `Ghi chú tối đa ${PROFILE_INPUT_LIMITS.MAX_NOTE_LENGTH} ký tự.`
    )
    .default(''),
});

export type BMIFormValues = z.infer<typeof bmiFormSchema>;

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên hiển thị.')
    .max(
      PROFILE_INPUT_LIMITS.DISPLAY_NAME_MAX,
      `Tên hiển thị tối đa ${PROFILE_INPUT_LIMITS.DISPLAY_NAME_MAX} ký tự.`
    ),
  birthYear: createNumericField(
    'Vui lòng nhập năm sinh.',
    'Năm sinh phải là một số nguyên hợp lệ.',
    (s) =>
      s
        .int('Năm sinh phải là số nguyên.')
        .min(
          PROFILE_INPUT_LIMITS.BIRTH_YEAR_MIN,
          `Năm sinh phải từ ${PROFILE_INPUT_LIMITS.BIRTH_YEAR_MIN} trở lên.`
        )
        .max(
          PROFILE_INPUT_LIMITS.BIRTH_YEAR_MAX,
          `Năm sinh không được lớn hơn ${PROFILE_INPUT_LIMITS.BIRTH_YEAR_MAX}.`
        )
  ),
  sex: z.enum(['male', 'female', 'other'], {
    error: 'Vui lòng chọn giới tính.',
  }),
  heightCm: createNumericField(
    'Vui lòng nhập chiều cao (cm).',
    'Chiều cao phải là một số hợp lệ.',
    (s) =>
      s
        .min(
          PROFILE_INPUT_LIMITS.HEIGHT_CM_MIN,
          `Chiều cao phải từ ${PROFILE_INPUT_LIMITS.HEIGHT_CM_MIN} cm trở lên.`
        )
        .max(
          PROFILE_INPUT_LIMITS.HEIGHT_CM_MAX,
          `Chiều cao tối đa ${PROFILE_INPUT_LIMITS.HEIGHT_CM_MAX} cm.`
        )
  ),
  weightKg: createNumericField(
    'Vui lòng nhập cân nặng (kg).',
    'Cân nặng phải là một số hợp lệ.',
    (s) =>
      s
        .min(
          PROFILE_INPUT_LIMITS.WEIGHT_KG_MIN,
          `Cân nặng phải từ ${PROFILE_INPUT_LIMITS.WEIGHT_KG_MIN} kg trở lên.`
        )
        .max(
          PROFILE_INPUT_LIMITS.WEIGHT_KG_MAX,
          `Cân nặng tối đa ${PROFILE_INPUT_LIMITS.WEIGHT_KG_MAX} kg.`
        )
  ),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active'], {
    error: 'Vui lòng chọn mức độ vận động.',
  }),
  dietaryPreferences: z
    .array(z.string().trim().min(1).max(60))
    .max(
      PROFILE_INPUT_LIMITS.MAX_DIETARY_PREFERENCES,
      `Chọn tối đa ${PROFILE_INPUT_LIMITS.MAX_DIETARY_PREFERENCES} sở thích ăn uống.`
    ),
  allergens: z
    .array(z.string().trim().min(1).max(60))
    .max(
      PROFILE_INPUT_LIMITS.MAX_ALLERGENS,
      `Tối đa ${PROFILE_INPUT_LIMITS.MAX_ALLERGENS} mục dị ứng.`
    ),
  consentAccepted: z.boolean().refine((val) => val === true, {
    message:
      'Bạn cần đồng ý với điều khoản bảo vệ dữ liệu cá nhân (tham chiếu Nghị định 13/2023/NĐ-CP) trước khi lưu dữ liệu sức khỏe.',
  }),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

export const loginFormSchema = z.object({
  email: z.string().trim().email('Vui lòng nhập địa chỉ email hợp lệ.'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.'),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

export const registerFormSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, 'Vui lòng nhập tên hiển thị.')
      .max(100, 'Tên hiển thị tối đa 100 ký tự.'),
    email: z.string().trim().email('Vui lòng nhập địa chỉ email hợp lệ.'),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự.'),
    confirmPassword: z.string().min(6, 'Vui lòng xác nhận mật khẩu.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp.',
    path: ['confirmPassword'],
  });

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

function createOptionalNullableNumericField(
  invalidMsg: string,
  build: (schema: z.ZodNumber) => z.ZodNumber
) {
  const base = z.number({ error: invalidMsg }).finite(invalidMsg);
  return z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return null;
    if (typeof val === 'string') {
      const trimmed = val.trim().replace(',', '.');
      if (trimmed === '' || trimmed.toLowerCase() === 'null') return null;
      const parsed = Number(trimmed);
      return Number.isNaN(parsed) ? val : parsed;
    }
    return val;
  }, build(base).nullable());
}

export const energyFormSchema = z.object({
  heightCm: createNumericField(
    'Vui lòng nhập chiều cao (cm).',
    'Chiều cao phải là số hợp lệ.',
    (s) =>
      s
        .min(
          BMI_INPUT_LIMITS.HEIGHT_CM_MIN,
          `Chiều cao phải từ ${BMI_INPUT_LIMITS.HEIGHT_CM_MIN} cm trở lên.`
        )
        .max(
          BMI_INPUT_LIMITS.HEIGHT_CM_MAX,
          `Chiều cao tối đa ${BMI_INPUT_LIMITS.HEIGHT_CM_MAX} cm.`
        )
  ),
  weightKg: createNumericField(
    'Vui lòng nhập cân nặng (kg).',
    'Cân nặng phải là số hợp lệ.',
    (s) =>
      s
        .min(
          BMI_INPUT_LIMITS.WEIGHT_KG_MIN,
          `Cân nặng phải từ ${BMI_INPUT_LIMITS.WEIGHT_KG_MIN} kg trở lên.`
        )
        .max(
          BMI_INPUT_LIMITS.WEIGHT_KG_MAX,
          `Cân nặng tối đa ${BMI_INPUT_LIMITS.WEIGHT_KG_MAX} kg.`
        )
  ),
  age: createNumericField(
    'Vui lòng nhập độ tuổi.',
    'Tuổi phải là số nguyên hợp lệ.',
    (s) =>
      s
        .int('Tuổi phải là số nguyên.')
        .min(
          BMI_INPUT_LIMITS.ADULT_AGE_MIN,
          `Công cụ tính BMR/TDEE chỉ dành cho người trưởng thành từ ${BMI_INPUT_LIMITS.ADULT_AGE_MIN} tuổi trở lên.`
        )
        .max(
          BMI_INPUT_LIMITS.AGE_MAX,
          `Độ tuổi không vượt quá ${BMI_INPUT_LIMITS.AGE_MAX}.`
        )
  ),
  sex: z.enum(['male', 'female'], {
    error: 'Công thức Mifflin-St Jeor cần chọn Nam hoặc Nữ để ước tính BMR.',
  }),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active'], {
    error: 'Vui lòng chọn mức độ vận động.',
  }),
});

export type EnergyFormValues = z.infer<typeof energyFormSchema>;

export const goalFormSchema = z.object({
  goalType: z.enum(['maintain', 'lose_gradual', 'gain_gradual', 'healthy_habits'], {
    error: 'Vui lòng chọn loại mục tiêu.',
  }),
  startWeightKg: createNumericField(
    'Vui lòng nhập cân nặng hiện tại (kg).',
    'Cân nặng phải là số hợp lệ.',
    (s) =>
      s
        .min(
          BMI_INPUT_LIMITS.WEIGHT_KG_MIN,
          `Cân nặng từ ${BMI_INPUT_LIMITS.WEIGHT_KG_MIN} kg trở lên.`
        )
        .max(
          BMI_INPUT_LIMITS.WEIGHT_KG_MAX,
          `Cân nặng tối đa ${BMI_INPUT_LIMITS.WEIGHT_KG_MAX} kg.`
        )
  ),
  targetWeightKg: createOptionalNullableNumericField(
    'Cân nặng mục tiêu phải là số hợp lệ.',
    (s) =>
      s
        .min(
          BMI_INPUT_LIMITS.WEIGHT_KG_MIN,
          `Cân nặng mục tiêu từ ${BMI_INPUT_LIMITS.WEIGHT_KG_MIN} kg trở lên.`
        )
        .max(
          BMI_INPUT_LIMITS.WEIGHT_KG_MAX,
          `Cân nặng mục tiêu tối đa ${BMI_INPUT_LIMITS.WEIGHT_KG_MAX} kg.`
        )
  ),
  weeklyChangeKg: createNumericField(
    'Vui lòng chọn tốc độ thay đổi mỗi tuần.',
    'Tốc độ thay đổi phải là số hợp lệ.',
    (s) =>
      s
        .min(0, 'Tốc độ không được âm.')
        .max(
          Math.max(
            MAX_WEEKLY_WEIGHT_CHANGE_KG.loss,
            MAX_WEEKLY_WEIGHT_CHANGE_KG.gain,
            2
          ),
          'Tốc độ nhập quá lớn.'
        )
  ),
  educationalConfirmed: z.boolean().refine((val) => val === true, {
    message:
      'Vui lòng xác nhận bạn hiểu đây là thông tin tham khảo mang tính giáo dục.',
  }),
});

export type GoalFormValues = z.infer<typeof goalFormSchema>;

export const customDiaryEntrySchema = z.object({
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack'], {
    error: 'Vui lòng chọn bữa ăn.',
  }),
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên món ăn.')
    .max(
      DIARY_LIMITS.MAX_NAME_LENGTH,
      `Tên món ăn tối đa ${DIARY_LIMITS.MAX_NAME_LENGTH} ký tự.`
    ),
  grams: createNumericField(
    'Vui lòng nhập khối lượng (gram).',
    'Khối lượng phải là số dương hợp lệ.',
    (s) =>
      s
        .gt(0, 'Khối lượng phải lớn hơn 0 g.')
        .max(
          DIARY_LIMITS.MAX_GRAMS,
          `Khối lượng tối đa ${DIARY_LIMITS.MAX_GRAMS} g.`
        )
  ),
  energyKcal: createOptionalNullableNumericField(
    'Năng lượng phải là số hợp lệ.',
    (s) =>
      s
        .min(0, 'Năng lượng không được âm.')
        .max(
          NUTRIENT_PLAUSIBILITY_LIMITS.energyKcalMax,
          `Năng lượng trên 100g không vượt quá ${NUTRIENT_PLAUSIBILITY_LIMITS.energyKcalMax} kcal.`
        )
  ),
  proteinG: createOptionalNullableNumericField(
    'Chất đạm phải là số hợp lệ.',
    (s) =>
      s
        .min(0, 'Chất đạm không được âm.')
        .max(
          NUTRIENT_PLAUSIBILITY_LIMITS.proteinGMax,
          `Chất đạm trên 100g không vượt quá ${NUTRIENT_PLAUSIBILITY_LIMITS.proteinGMax} g.`
        )
  ),
  fatG: createOptionalNullableNumericField(
    'Chất béo phải là số hợp lệ.',
    (s) =>
      s
        .min(0, 'Chất béo không được âm.')
        .max(
          NUTRIENT_PLAUSIBILITY_LIMITS.fatGMax,
          `Chất béo trên 100g không vượt quá ${NUTRIENT_PLAUSIBILITY_LIMITS.fatGMax} g.`
        )
  ),
  carbG: createOptionalNullableNumericField(
    'Tinh bột phải là số hợp lệ.',
    (s) =>
      s
        .min(0, 'Tinh bột không được âm.')
        .max(
          NUTRIENT_PLAUSIBILITY_LIMITS.carbGMax,
          `Tinh bột trên 100g không vượt quá ${NUTRIENT_PLAUSIBILITY_LIMITS.carbGMax} g.`
        )
  ),
});

export type CustomDiaryEntryValues = z.infer<typeof customDiaryEntrySchema>;

export const shoppingItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập tên thực phẩm cần mua.')
    .max(
      SHOPPING_LIST_LIMITS.MAX_NAME_LENGTH,
      `Tên mục tối đa ${SHOPPING_LIST_LIMITS.MAX_NAME_LENGTH} ký tự.`
    ),
  category: z.enum([
    'rice_noodles',
    'meat',
    'fish_seafood',
    'eggs_dairy',
    'vegetables',
    'fruits',
    'legumes_nuts',
    'soups',
    'snacks',
    'drinks',
    'condiments',
    'other',
  ]),
  quantityLabel: z
    .string()
    .trim()
    .max(
      SHOPPING_LIST_LIMITS.MAX_QUANTITY_LENGTH,
      `Số lượng tối đa ${SHOPPING_LIST_LIMITS.MAX_QUANTITY_LENGTH} ký tự.`
    )
    .default(''),
});

export type ShoppingItemValues = z.infer<typeof shoppingItemSchema>;
