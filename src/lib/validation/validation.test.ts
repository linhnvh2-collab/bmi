import { describe, expect, it } from 'vitest';
import { bmiFormSchema, profileFormSchema } from './schemas';

describe('bmiFormSchema validation', () => {
  it('accepts valid adult input', () => {
    const parsed = bmiFormSchema.safeParse({
      heightCm: '170',
      weightKg: '65',
      age: '30',
      note: 'Đo buổi sáng',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty, negative, out-of-range, and non-numeric inputs with Vietnamese messages', () => {
    const emptyResult = bmiFormSchema.safeParse({
      heightCm: '',
      weightKg: '',
      age: '',
    });
    expect(emptyResult.success).toBe(false);
    if (!emptyResult.success) {
      const msgs = emptyResult.error.issues.map((i) => i.message);
      expect(msgs.some((m) => m.includes('chiều cao'))).toBe(true);
      expect(msgs.some((m) => m.includes('cân nặng'))).toBe(true);
      expect(msgs.some((m) => m.includes('tuổi'))).toBe(true);
    }

    const negativeResult = bmiFormSchema.safeParse({
      heightCm: -170,
      weightKg: -65,
      age: -5,
    });
    expect(negativeResult.success).toBe(false);

    const outOfRangeResult = bmiFormSchema.safeParse({
      heightCm: 250,
      weightKg: 350,
      age: 130,
    });
    expect(outOfRangeResult.success).toBe(false);

    const nonNumericResult = bmiFormSchema.safeParse({
      heightCm: 'abc',
      weightKg: 'xyz',
      age: 'ba mươi',
    });
    expect(nonNumericResult.success).toBe(false);
  });
});

describe('profileFormSchema validation', () => {
  it('requires consentAccepted to be true', () => {
    const result = profileFormSchema.safeParse({
      displayName: 'Nguyễn Minh',
      birthYear: 1995,
      sex: 'male',
      heightCm: 170,
      weightKg: 65,
      activityLevel: 'moderate',
      dietaryPreferences: ['Cơm gia đình'],
      allergens: [],
      consentAccepted: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('13/2023/NĐ-CP'))
      ).toBe(true);
    }
  });
});
