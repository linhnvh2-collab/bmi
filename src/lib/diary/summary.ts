import { scaleNutrients } from '@/src/lib/nutrition';
import type { NutrientKey, NutrientsPer100g } from '@/src/types/food';
import type { DiaryEntry } from '@/src/types/stage3';

export interface NutrientPartialSum {
  knownTotal: number | null;
  missingCount: number;
  isPartial: boolean;
}

export interface DiaryNutritionSummary {
  entryCount: number;
  hasEstimatedOrUnverified: boolean;
  estimatedOrUnverifiedCount: number;
  byNutrient: Record<NutrientKey, NutrientPartialSum>;
}

const ALL_NUTRIENT_KEYS: NutrientKey[] = [
  'energyKcal',
  'proteinG',
  'fatG',
  'carbG',
  'fiberG',
  'sugarG',
  'sodiumMg',
];

/**
 * Cộng tổng dinh dưỡng trong ngày từ danh sách `DiaryEntry`.
 * - Giá trị `null` KHÔNG bao giờ được tính là 0.
 * - Nếu bất kỳ món nào thiếu dữ liệu cho một chất, `isPartial = true` và `missingCount` phản ánh số món thiếu.
 * - Nếu tất cả các món đều thiếu chất đó (hoặc nhật ký trống), `knownTotal = null`.
 * - Nếu có bất kỳ món `custom` hoặc không phải `verified`, `hasEstimatedOrUnverified = true`.
 */
export function sumDiaryNutrients(entries: DiaryEntry[]): DiaryNutritionSummary {
  const sums: Record<NutrientKey, number> = {
    energyKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
  };

  const knownCounts: Record<NutrientKey, number> = {
    energyKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
  };

  const missingCounts: Record<NutrientKey, number> = {
    energyKcal: 0,
    proteinG: 0,
    fatG: 0,
    carbG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
  };

  let estimatedOrUnverifiedCount = 0;

  for (const entry of entries) {
    if (
      entry.source === 'custom' ||
      entry.verificationStatusSnapshot !== 'verified'
    ) {
      estimatedOrUnverifiedCount += 1;
    }

    const scaled: NutrientsPer100g = scaleNutrients(
      entry.nutrientsPer100gSnapshot,
      entry.grams
    );

    for (const key of ALL_NUTRIENT_KEYS) {
      const value = scaled[key];
      if (value === null) {
        missingCounts[key] += 1;
      } else {
        sums[key] += value;
        knownCounts[key] += 1;
      }
    }
  }

  const byNutrient = {} as Record<NutrientKey, NutrientPartialSum>;
  for (const key of ALL_NUTRIENT_KEYS) {
    const knownCount = knownCounts[key];
    const missingCount = missingCounts[key];
    const rounded =
      key === 'energyKcal'
        ? Math.round(sums[key])
        : Math.round(sums[key] * 10) / 10;

    byNutrient[key] = {
      knownTotal: knownCount > 0 ? rounded : null,
      missingCount,
      isPartial: missingCount > 0,
    };
  }

  return {
    entryCount: entries.length,
    hasEstimatedOrUnverified: estimatedOrUnverifiedCount > 0,
    estimatedOrUnverifiedCount,
    byNutrient,
  };
}
