import { describe, expect, it } from 'vitest';
import {
  buildCalorieTarget,
  evaluateGoalDurationWeeks,
  MAX_DAILY_DEFICIT_KCAL,
  MAX_WEEKLY_WEIGHT_CHANGE_KG,
  MIN_DAILY_KCAL_BY_SEX,
} from './index';

describe('buildCalorieTarget safety clamping', () => {
  it('returns null targetKcal for healthy_habits goal', () => {
    const res = buildCalorieTarget({
      tdee: 2000,
      sex: 'female',
      goalType: 'healthy_habits',
      requestedWeeklyChangeKg: 0.5,
    });
    expect(res.targetKcal).toBeNull();
    expect(res.wasAdjusted).toBe(false);
    expect(res.reasonCode).toBe('healthy_habits');
  });

  it('maintains TDEE when above minimum floor', () => {
    const res = buildCalorieTarget({
      tdee: 2150,
      sex: 'male',
      goalType: 'maintain',
    });
    expect(res.targetKcal).toBe(2150);
    expect(res.wasAdjusted).toBe(false);
  });

  it('never drops below MIN_DAILY_KCAL_BY_SEX even with aggressive deficit request', () => {
    const res = buildCalorieTarget({
      tdee: 1350,
      sex: 'female',
      goalType: 'lose_gradual',
      requestedWeeklyChangeKg: 0.5,
    });
    expect(res.targetKcal).toBeGreaterThanOrEqual(MIN_DAILY_KCAL_BY_SEX.female);
    expect(res.targetKcal).toBe(MIN_DAILY_KCAL_BY_SEX.female);
    expect(res.wasAdjusted).toBe(true);
    expect(res.reasonCode).toBe('clamped_min_kcal');
    expect(res.messageVi).toBeTruthy();
  });

  it('clamps unsafe weekly weight loss request above MAX_WEEKLY_WEIGHT_CHANGE_KG.loss and MAX_DAILY_DEFICIT_KCAL', () => {
    const res = buildCalorieTarget({
      tdee: 2600,
      sex: 'male',
      goalType: 'lose_gradual',
      requestedWeeklyChangeKg: 1.5,
    });
    expect(res.wasAdjusted).toBe(true);
    expect(res.effectiveWeeklyChangeKg).toBeLessThanOrEqual(
      MAX_WEEKLY_WEIGHT_CHANGE_KG.loss
    );
    expect(2600 - (res.targetKcal ?? 0)).toBeLessThanOrEqual(
      MAX_DAILY_DEFICIT_KCAL
    );
    expect(res.targetKcal).toBeGreaterThanOrEqual(MIN_DAILY_KCAL_BY_SEX.male);
  });

  it('caps gradual weight gain pace to configured maximum', () => {
    const res = buildCalorieTarget({
      tdee: 2000,
      sex: 'male',
      goalType: 'gain_gradual',
      requestedWeeklyChangeKg: 1.2,
    });
    expect(res.wasAdjusted).toBe(true);
    expect(res.effectiveWeeklyChangeKg).toBeLessThanOrEqual(
      MAX_WEEKLY_WEIGHT_CHANGE_KG.gain
    );
    expect(res.targetKcal).toBeGreaterThan(2000);
  });

  it('flags goal duration shorter than MIN_GOAL_DURATION_WEEKS', () => {
    const check = evaluateGoalDurationWeeks(60, 59, 0.5);
    expect(check.estimatedWeeks).toBe(2);
    expect(check.belowRecommendedMinimum).toBe(true);
  });
});
