export type SexOption = 'male' | 'female' | 'other';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type BMICategoryKey =
  | 'underweight'
  | 'normal'
  | 'overweight'
  | 'obese'
  | 'under_18_limited';

export interface BMIClassification {
  isLimitedMode: boolean;
  categoryKey: BMICategoryKey;
  labelVi: string;
  shortDescVi: string;
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  birthYear: number;
  sex: SexOption;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  dietaryPreferences: string[];
  allergens: string[];
  consentAccepted: boolean;
  consentVersion: string;
  consentAcceptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfileInput {
  displayName: string;
  birthYear: number;
  sex: SexOption;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  dietaryPreferences: string[];
  allergens: string[];
  consentAccepted: boolean;
}

export interface HealthRecord {
  id: string;
  userId: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  isUnder18: boolean;
  categoryKey: BMICategoryKey;
  note: string;
  createdAt: Date;
}

export interface HealthRecordCreateInput {
  age: number;
  heightCm: number;
  weightKg: number;
  bmi: number;
  isUnder18: boolean;
  categoryKey: BMICategoryKey;
  note: string;
}
