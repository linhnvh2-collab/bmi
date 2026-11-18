import type { BMICategoryKey, BMIClassification } from '@/src/types/health';
import {
  ADULT_MIN_AGE,
  ASIA_PACIFIC_BMI_THRESHOLDS,
  BMI_CATEGORY_METADATA,
} from './constants';

/**
 * Tính chỉ số khối cơ thể (BMI) theo hệ mét (kg, cm), làm tròn 1 chữ số thập phân.
 */
export function calculateBMI(weightKg: number, heightCm: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm)) {
    throw new Error('Cân nặng và chiều cao phải là số hợp lệ.');
  }
  if (weightKg <= 0 || heightCm <= 0) {
    throw new Error('Cân nặng và chiều cao phải lớn hơn 0.');
  }

  const heightM = heightCm / 100;
  const rawBmi = weightKg / (heightM * heightM);
  return Math.round(rawBmi * 10) / 10;
}

/**
 * Phân loại BMI theo ngưỡng Châu Á - Thái Bình Dương cho người trưởng thành (>= 18 tuổi).
 * Nếu tuổi < 18: trả về chế độ giới hạn, KHÔNG gắn nhãn phân loại người trưởng thành.
 */
export function classifyBMI(bmi: number, age?: number): BMIClassification {
  if (!Number.isFinite(bmi) || bmi <= 0) {
    throw new Error('Chỉ số BMI phải là số dương hợp lệ.');
  }

  if (age !== undefined && age < ADULT_MIN_AGE) {
    const meta = BMI_CATEGORY_METADATA.under_18_limited;
    return {
      isLimitedMode: true,
      categoryKey: 'under_18_limited',
      labelVi: meta.labelVi,
      shortDescVi: meta.shortDescVi,
      tone: meta.tone,
    };
  }

  let categoryKey: BMICategoryKey;
  if (bmi < ASIA_PACIFIC_BMI_THRESHOLDS.UNDERWEIGHT_MAX) {
    categoryKey = 'underweight';
  } else if (bmi <= ASIA_PACIFIC_BMI_THRESHOLDS.NORMAL_MAX) {
    categoryKey = 'normal';
  } else if (bmi <= ASIA_PACIFIC_BMI_THRESHOLDS.OVERWEIGHT_MAX) {
    categoryKey = 'overweight';
  } else {
    categoryKey = 'obese';
  }

  const meta = BMI_CATEGORY_METADATA[categoryKey];
  return {
    isLimitedMode: false,
    categoryKey,
    labelVi: meta.labelVi,
    shortDescVi: meta.shortDescVi,
    tone: meta.tone,
  };
}
