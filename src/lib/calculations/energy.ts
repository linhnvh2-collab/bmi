import type { ActivityLevel } from '@/src/types/health';
import { ACTIVITY_FACTORS } from './constants';

export interface BMRInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
}

/**
 * Tính tỷ lệ trao đổi chất cơ bản (BMR) theo công thức Mifflin-St Jeor (kcal/ngày).
 * Nam: 10w + 6.25h - 5a + 5
 * Nữ:  10w + 6.25h - 5a - 161
 * (Chỉ dùng dưới dạng hàm thuần kiểm thử ở Giai đoạn 1; chưa hiển thị trên UI.)
 */
export function calculateBMR({ weightKg, heightCm, age, sex }: BMRInput): number {
  if (
    !Number.isFinite(weightKg) ||
    !Number.isFinite(heightCm) ||
    !Number.isFinite(age) ||
    weightKg <= 0 ||
    heightCm <= 0 ||
    age <= 0
  ) {
    throw new Error('Thông số BMR (cân nặng, chiều cao, tuổi) phải là số dương hợp lệ.');
  }

  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const rawBmr = sex === 'male' ? base + 5 : base - 161;
  return Math.round(rawBmr * 10) / 10;
}

/**
 * Tính tổng năng lượng tiêu hao hàng ngày (TDEE) dựa trên BMR và hệ số vận động (kcal/ngày).
 */
export function calculateTDEE(
  bmr: number,
  activityLevelOrFactor: ActivityLevel | number
): number {
  if (!Number.isFinite(bmr) || bmr <= 0) {
    throw new Error('Chỉ số BMR phải là số dương hợp lệ.');
  }

  const factor =
    typeof activityLevelOrFactor === 'number'
      ? activityLevelOrFactor
      : ACTIVITY_FACTORS[activityLevelOrFactor];

  if (!Number.isFinite(factor) || factor <= 0) {
    throw new Error('Hệ số vận động không hợp lệ.');
  }

  return Math.round(bmr * factor * 10) / 10;
}
