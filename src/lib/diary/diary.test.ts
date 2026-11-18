import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '@/src/types/stage3';
import { sumDiaryNutrients } from './summary';

function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 'entry-1',
    mealType: 'lunch',
    source: 'database',
    foodId: 'com-trang',
    name: 'Cơm trắng',
    grams: 100,
    nutrientsPer100gSnapshot: {
      energyKcal: 130,
      proteinG: 2.7,
      fatG: 0.3,
      carbG: 28.2,
      fiberG: 0.4,
      sugarG: 0.1,
      sodiumMg: 1,
    },
    verificationStatusSnapshot: 'verified',
    loggedAt: '2026-11-16T12:00:00.000Z',
    ...overrides,
  };
}

describe('sumDiaryNutrients', () => {
  it('returns null totals and zero missing counts for an empty diary', () => {
    const summary = sumDiaryNutrients([]);
    expect(summary.entryCount).toBe(0);
    expect(summary.hasEstimatedOrUnverified).toBe(false);
    expect(summary.byNutrient.energyKcal).toEqual({
      knownTotal: null,
      missingCount: 0,
      isPartial: false,
    });
  });

  it('scales nutrients accurately and never treats null as 0', () => {
    const entries: DiaryEntry[] = [
      makeEntry({
        id: '1',
        grams: 200, // 2x of 100g
        nutrientsPer100gSnapshot: {
          energyKcal: 130,
          proteinG: 2.5,
          fatG: 0.5,
          carbG: 28,
          fiberG: null,
          sugarG: null,
          sodiumMg: 10,
        },
      }),
      makeEntry({
        id: '2',
        grams: 100,
        nutrientsPer100gSnapshot: {
          energyKcal: 200,
          proteinG: 15,
          fatG: 5,
          carbG: 10,
          fiberG: 2,
          sugarG: null,
          sodiumMg: null,
        },
      }),
    ];

    const summary = sumDiaryNutrients(entries);
    expect(summary.hasEstimatedOrUnverified).toBe(false);
    expect(summary.byNutrient.energyKcal).toEqual({
      knownTotal: 460,
      missingCount: 0,
      isPartial: false,
    });
    expect(summary.byNutrient.fiberG).toEqual({
      knownTotal: 2,
      missingCount: 1,
      isPartial: true,
    });
    expect(summary.byNutrient.sugarG).toEqual({
      knownTotal: null,
      missingCount: 2,
      isPartial: true,
    });
  });

  it('flags custom and estimated entries as hasEstimatedOrUnverified', () => {
    const entries: DiaryEntry[] = [
      makeEntry({ id: '1', verificationStatusSnapshot: 'verified' }),
      makeEntry({
        id: '2',
        source: 'custom',
        foodId: null,
        verificationStatusSnapshot: 'unverified',
      }),
    ];
    const summary = sumDiaryNutrients(entries);
    expect(summary.hasEstimatedOrUnverified).toBe(true);
    expect(summary.estimatedOrUnverifiedCount).toBe(1);
  });
});
