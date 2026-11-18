import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_FACTORS,
  calculateBMI,
  calculateBMR,
  calculateTDEE,
  classifyBMI,
} from './index';

describe('calculateBMI', () => {
  it('computes 22.5 for 170 cm and 65 kg', () => {
    expect(calculateBMI(65, 170)).toBe(22.5);
  });

  it('throws on zero or negative dimensions', () => {
    expect(() => calculateBMI(0, 170)).toThrow();
    expect(() => calculateBMI(65, -170)).toThrow();
    expect(() => calculateBMI(Number.NaN, 170)).toThrow();
  });
});

describe('classifyBMI (Asia-Pacific adult cutoffs & under-18 safety)', () => {
  it('classifies 22.5 for an adult as Bình thường', () => {
    const result = classifyBMI(22.5, 30);
    expect(result.isLimitedMode).toBe(false);
    expect(result.categoryKey).toBe('normal');
    expect(result.labelVi).toBe('Bình thường');
  });

  it('classifies boundary values accurately', () => {
    expect(classifyBMI(18.4, 25).categoryKey).toBe('underweight');
    expect(classifyBMI(18.5, 25).categoryKey).toBe('normal');
    expect(classifyBMI(22.9, 25).categoryKey).toBe('normal');
    expect(classifyBMI(23.0, 25).categoryKey).toBe('overweight');
    expect(classifyBMI(24.9, 25).categoryKey).toBe('overweight');
    expect(classifyBMI(25.0, 25).categoryKey).toBe('obese');
  });

  it('enforces limited mode for users under 18 without adult category', () => {
    const result = classifyBMI(22.5, 16);
    expect(result.isLimitedMode).toBe(true);
    expect(result.categoryKey).toBe('under_18_limited');
    expect(result.labelVi).not.toContain('Bình thường');
    expect(result.shortDescVi).toContain('WHO');
  });
});

describe('calculateBMR & calculateTDEE (Mifflin-St Jeor)', () => {
  it('computes male BMR = 1567.5 kcal for 30y, 170cm, 65kg', () => {
    const bmr = calculateBMR({
      age: 30,
      heightCm: 170,
      weightKg: 65,
      sex: 'male',
    });
    expect(bmr).toBe(1567.5);
  });

  it('computes female BMR = 1401.5 kcal for 30y, 170cm, 65kg', () => {
    const bmr = calculateBMR({
      age: 30,
      heightCm: 170,
      weightKg: 65,
      sex: 'female',
    });
    expect(bmr).toBe(1401.5);
  });

  it('computes male TDEE at moderate factor 1.55 ≈ 2429.6 kcal', () => {
    const bmr = calculateBMR({
      age: 30,
      heightCm: 170,
      weightKg: 65,
      sex: 'male',
    });
    expect(ACTIVITY_FACTORS.moderate).toBe(1.55);
    expect(calculateTDEE(bmr, 'moderate')).toBe(2429.6);
    expect(calculateTDEE(bmr, 1.55)).toBe(2429.6);
  });

  it('supports all defined activity factors', () => {
    expect(ACTIVITY_FACTORS.sedentary).toBe(1.2);
    expect(ACTIVITY_FACTORS.light).toBe(1.375);
    expect(ACTIVITY_FACTORS.moderate).toBe(1.55);
    expect(ACTIVITY_FACTORS.active).toBe(1.725);
    expect(ACTIVITY_FACTORS.very_active).toBe(1.9);
  });
});
