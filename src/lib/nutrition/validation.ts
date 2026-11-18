import { z } from 'zod';
import {
  FOOD_CATEGORY_OPTIONS,
  NUTRIENT_PLAUSIBILITY_LIMITS,
} from './constants';
import type { FoodCategory, FoodInput } from '@/src/types/food';

const categoryValues = FOOD_CATEGORY_OPTIONS.map((c) => c.value) as [
  FoodCategory,
  ...FoodCategory[],
];

function nullableBoundedNumber(labelVi: string, maxLimit: number) {
  return z
    .number({
      error: `${labelVi} phải là số hợp lệ hoặc để trống (Chưa có dữ liệu).`,
    })
    .finite(`${labelVi} phải là số hữu hạn.`)
    .min(0, `${labelVi} không được nhỏ hơn 0.`)
    .max(maxLimit, `${labelVi} vượt quá ngưỡng hợp lý (${maxLimit}).`)
    .nullable();
}

export const nutrientsPer100gSchema = z.object({
  energyKcal: nullableBoundedNumber(
    'Năng lượng (kcal)',
    NUTRIENT_PLAUSIBILITY_LIMITS.energyKcalMax
  ),
  proteinG: nullableBoundedNumber(
    'Chất đạm (g)',
    NUTRIENT_PLAUSIBILITY_LIMITS.proteinGMax
  ),
  fatG: nullableBoundedNumber(
    'Chất béo (g)',
    NUTRIENT_PLAUSIBILITY_LIMITS.fatGMax
  ),
  carbG: nullableBoundedNumber(
    'Tinh bột / Carb (g)',
    NUTRIENT_PLAUSIBILITY_LIMITS.carbGMax
  ),
  fiberG: nullableBoundedNumber(
    'Chất xơ (g)',
    NUTRIENT_PLAUSIBILITY_LIMITS.fiberGMax
  ),
  sugarG: nullableBoundedNumber(
    'Đường (g)',
    NUTRIENT_PLAUSIBILITY_LIMITS.sugarGMax
  ),
  sodiumMg: nullableBoundedNumber(
    'Natri (mg)',
    NUTRIENT_PLAUSIBILITY_LIMITS.sodiumMgMax
  ),
});

export const servingUnitSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Tên đơn vị khẩu phần không được để trống.')
    .max(60, 'Tên đơn vị khẩu phần tối đa 60 ký tự.'),
  grams: z
    .number({ error: 'Khối lượng khẩu phần phải là số.' })
    .finite('Khối lượng khẩu phần phải hợp lệ.')
    .gt(0, 'Khối lượng khẩu phần phải lớn hơn 0 g.')
    .max(
      NUTRIENT_PLAUSIBILITY_LIMITS.servingGramsMax,
      `Khối lượng khẩu phần tối đa ${NUTRIENT_PLAUSIBILITY_LIMITS.servingGramsMax} g.`
    ),
});

export const foodSourceSchema = z.object({
  name: z
    .string()
    .trim()
    .max(200, 'Tên nguồn tối đa 200 ký tự.'),
  year: z
    .number({ error: 'Năm xuất bản phải là số nguyên.' })
    .int('Năm xuất bản phải là số nguyên.')
    .min(
      NUTRIENT_PLAUSIBILITY_LIMITS.sourceYearMin,
      `Năm nguồn phải từ ${NUTRIENT_PLAUSIBILITY_LIMITS.sourceYearMin}.`
    )
    .max(
      NUTRIENT_PLAUSIBILITY_LIMITS.sourceYearMax,
      `Năm nguồn không vượt quá ${NUTRIENT_PLAUSIBILITY_LIMITS.sourceYearMax}.`
    )
    .nullable(),
  reference: z
    .string()
    .trim()
    .max(300, 'Thông tin trích dẫn tối đa 300 ký tự.'),
});

export const foodInputSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, 'Mã định danh (slug ID) không được để trống.')
      .max(128, 'Mã định danh tối đa 128 ký tự.')
      .regex(
        /^[a-zA-Z0-9_-]+$/,
        'Mã định danh chỉ được gồm chữ không dấu, số, dấu gạch ngang (-) hoặc gạch dưới (_).'
      ),
    nameVi: z
      .string()
      .trim()
      .min(1, 'Tên tiếng Việt không được để trống.')
      .max(150, 'Tên tiếng Việt tối đa 150 ký tự.'),
    nameEn: z
      .string()
      .trim()
      .max(150, 'Tên tiếng Anh tối đa 150 ký tự.')
      .default(''),
    aliases: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Tên gọi khác không được để trống.')
          .max(100, 'Mỗi tên gọi khác tối đa 100 ký tự.')
      )
      .max(
        NUTRIENT_PLAUSIBILITY_LIMITS.maxAliases,
        `Tối đa ${NUTRIENT_PLAUSIBILITY_LIMITS.maxAliases} tên gọi khác.`
      )
      .default([]),
    category: z.enum(categoryValues, {
      error: 'Nhóm thực phẩm không hợp lệ.',
    }),
    nutrientsPer100g: nutrientsPer100gSchema,
    servingUnits: z
      .array(servingUnitSchema)
      .max(
        NUTRIENT_PLAUSIBILITY_LIMITS.maxServingUnits,
        `Tối đa ${NUTRIENT_PLAUSIBILITY_LIMITS.maxServingUnits} đơn vị khẩu phần.`
      )
      .default([]),
    allergens: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Tên chất dị ứng không được để trống.')
          .max(60, 'Tên chất dị ứng tối đa 60 ký tự.')
      )
      .max(
        NUTRIENT_PLAUSIBILITY_LIMITS.maxAllergens,
        `Tối đa ${NUTRIENT_PLAUSIBILITY_LIMITS.maxAllergens} chất dị ứng.`
      )
      .default([]),
    allergensReviewed: z.boolean(),
    dietTags: z
      .array(
        z
          .string()
          .trim()
          .min(1, 'Nhãn chế độ ăn không được để trống.')
          .max(60, 'Nhãn chế độ ăn tối đa 60 ký tự.')
      )
      .max(
        NUTRIENT_PLAUSIBILITY_LIMITS.maxDietTags,
        `Tối đa ${NUTRIENT_PLAUSIBILITY_LIMITS.maxDietTags} nhãn chế độ ăn.`
      )
      .default([]),
    source: foodSourceSchema.nullable().default(null),
    verificationStatus: z.enum(['verified', 'estimated', 'unverified'], {
      error: 'Trạng thái xác minh không hợp lệ.',
    }),
    imagePath: z
      .string()
      .trim()
      .nullable()
      .default(null)
      .refine(
        (val) => {
          if (val === null || val === '') return true;
          if (val.includes('..')) return false;
          return /^\/images\/foods\/[a-zA-Z0-9_\-./]+$/.test(val);
        },
        {
          message:
            'Đường dẫn ảnh phải là ảnh tĩnh nội bộ bắt đầu bằng /images/foods/ (không dùng URL ngoài).',
        }
      )
      .transform((val) => (val === '' ? null : val)),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.verificationStatus === 'verified') {
      if (!data.source || !data.source.name.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['source', 'name'],
          message:
            'Dữ liệu ở trạng thái "Đã xác minh" bắt buộc phải có tên nguồn tham khảo.',
        });
      }
      if (!data.source || data.source.year === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['source', 'year'],
          message:
            'Dữ liệu ở trạng thái "Đã xác minh" bắt buộc phải có năm xuất bản của nguồn.',
        });
      }
      if (!data.source || !data.source.reference.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['source', 'reference'],
          message:
            'Dữ liệu ở trạng thái "Đã xác minh" bắt buộc phải có trích dẫn/tài liệu tham chiếu.',
        });
      }
    }
  });

export type ValidatedFoodInput = z.infer<typeof foodInputSchema>;

export function validateFood(input: unknown): {
  success: true;
  data: FoodInput;
} | {
  success: false;
  errors: string[];
} {
  const parsed = foodInputSchema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return {
    success: false,
    errors: parsed.error.issues.map((issue) => {
      const pathStr = issue.path.length > 0 ? `[${issue.path.join('.')}] ` : '';
      return `${pathStr}${issue.message}`;
    }),
  };
}
