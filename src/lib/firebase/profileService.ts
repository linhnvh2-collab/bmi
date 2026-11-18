import { deleteUser, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { CONSENT_VERSION, PROFILE_INPUT_LIMITS } from '@/src/lib/calculations/constants';
import type { HealthRecord, UserProfile, UserProfileInput } from '@/src/types/health';
import type { SavedMealPlan } from '@/src/types/mealPlan';
import type { FoodDiaryDay, ShoppingListDoc, UserGoal } from '@/src/types/stage3';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { getCurrentGoal } from './goalsService';
import { listUserMealPlans } from './mealPlansService';
import { getShoppingList } from './shoppingListService';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    return {
      uid: String(data.uid ?? uid),
      displayName: String(data.displayName ?? ''),
      email: String(data.email ?? ''),
      birthYear: Number(data.birthYear ?? 1995),
      birthDate: typeof data.birthDate === 'string' ? data.birthDate : null,
      sex: (data.sex as UserProfile['sex']) ?? 'other',
      heightCm: Number(data.heightCm ?? 170),
      weightKg: Number(data.weightKg ?? 65),
      activityLevel: (data.activityLevel as UserProfile['activityLevel']) ?? 'moderate',
      dietaryPreferences: Array.isArray(data.dietaryPreferences)
        ? data.dietaryPreferences.map(String)
        : [],
      allergens: Array.isArray(data.allergens) ? data.allergens.map(String) : [],
      dislikedFoods: Array.isArray(data.dislikedFoods)
        ? data.dislikedFoods.map(String)
        : [],
      budgetLevel: (data.budgetLevel as UserProfile['budgetLevel']) ?? 'standard',
      dailyBudgetVnd:
        typeof data.dailyBudgetVnd === 'number' ? data.dailyBudgetVnd : null,
      prepTimePreference:
        (data.prepTimePreference as UserProfile['prepTimePreference']) ??
        'moderate',
      mealsPerDay:
        data.mealsPerDay === 3 || data.mealsPerDay === 4 || data.mealsPerDay === 5
          ? data.mealsPerDay
          : 4,
      nutritionGoal:
        (data.nutritionGoal as UserProfile['nutritionGoal']) ??
        'nutrition_balance',
      dietMode: (data.dietMode as UserProfile['dietMode']) ?? 'balanced',
      consentAccepted: Boolean(data.consentAccepted),
      consentVersion: String(data.consentVersion ?? CONSENT_VERSION),
      consentAcceptedAt: toDate(data.consentAcceptedAt),
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(
  uid: string,
  email: string,
  input: UserProfileInput,
  hasExistingProfile: boolean
): Promise<void> {
  const path = `users/${uid}`;
  if (!input.consentAccepted) {
    throw new Error('Cần xác nhận đồng ý lưu trữ dữ liệu trước khi lưu hồ sơ.');
  }

  const sanitizedDietary = input.dietaryPreferences
    .map((item) => item.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, PROFILE_INPUT_LIMITS.MAX_DIETARY_PREFERENCES);

  const sanitizedAllergens = input.allergens
    .map((item) => item.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, PROFILE_INPUT_LIMITS.MAX_ALLERGENS);

  const sanitizedDislikes = (input.dislikedFoods ?? [])
    .map((item) => item.trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 20);

  const baseFields: Record<string, unknown> = {
    displayName: input.displayName.trim().slice(0, PROFILE_INPUT_LIMITS.DISPLAY_NAME_MAX),
    email: email.trim().slice(0, 254),
    birthYear: Math.round(input.birthYear),
    birthDate: input.birthDate ? input.birthDate.trim().slice(0, 10) : null,
    sex: input.sex,
    heightCm: Number(input.heightCm),
    weightKg: Number(input.weightKg),
    activityLevel: input.activityLevel,
    dietaryPreferences: sanitizedDietary,
    allergens: sanitizedAllergens,
    dislikedFoods: sanitizedDislikes,
    budgetLevel: input.budgetLevel ?? 'standard',
    dailyBudgetVnd:
      typeof input.dailyBudgetVnd === 'number' && Number.isFinite(input.dailyBudgetVnd)
        ? Math.round(input.dailyBudgetVnd)
        : null,
    prepTimePreference: input.prepTimePreference ?? 'moderate',
    mealsPerDay: input.mealsPerDay ?? 4,
    nutritionGoal: input.nutritionGoal ?? 'nutrition_balance',
    dietMode: input.dietMode ?? 'balanced',
    consentAccepted: true,
    consentVersion: CONSENT_VERSION,
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = doc(db, 'users', uid);
    if (hasExistingProfile) {
      await updateDoc(docRef, baseFields);
    } else {
      await setDoc(docRef, {
        uid,
        ...baseFields,
        consentAcceptedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      hasExistingProfile ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function exportUserData(uid: string): Promise<{
  exportedAt: string;
  profile: UserProfile | null;
  healthRecords: HealthRecord[];
  favorites: Array<{ foodId: string; createdAt: Date }>;
  currentGoal: UserGoal | null;
  foodDiaries: FoodDiaryDay[];
  shoppingList: ShoppingListDoc | null;
  mealPlans: SavedMealPlan[];
}> {
  const profile = await getUserProfile(uid);
  const recordsPath = `users/${uid}/health_records`;
  let healthRecords: HealthRecord[] = [];
  try {
    const q = query(collection(db, 'users', uid, 'health_records'), where('userId', '==', uid));
    const snap = await getDocs(q);
    healthRecords = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: String(data.userId),
          age: Number(data.age),
          heightCm: Number(data.heightCm),
          weightKg: Number(data.weightKg),
          bmi: Number(data.bmi),
          isUnder18: Boolean(data.isUnder18),
          categoryKey: data.categoryKey as HealthRecord['categoryKey'],
          note: String(data.note ?? ''),
          createdAt: toDate(data.createdAt),
        };
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, recordsPath);
  }

  const favPath = `users/${uid}/favorites`;
  let favorites: Array<{ foodId: string; createdAt: Date }> = [];
  try {
    const favQ = query(collection(db, 'users', uid, 'favorites'), where('userId', '==', uid));
    const favSnap = await getDocs(favQ);
    favorites = favSnap.docs.map((d) => {
      const data = d.data();
      return {
        foodId: String(data.foodId ?? d.id),
        createdAt: toDate(data.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, favPath);
  }

  const currentGoal = await getCurrentGoal(uid);

  const diariesPath = `users/${uid}/food_diaries`;
  let foodDiaries: FoodDiaryDay[] = [];
  try {
    const diariesQ = query(
      collection(db, 'users', uid, 'food_diaries'),
      where('userId', '==', uid)
    );
    const diariesSnap = await getDocs(diariesQ);
    foodDiaries = diariesSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          userId: String(data.userId ?? uid),
          date: String(data.date ?? d.id),
          entries: Array.isArray(data.entries)
            ? (data.entries as FoodDiaryDay['entries'])
            : [],
          updatedAt: toDate(data.updatedAt),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, diariesPath);
  }

  const shoppingList = await getShoppingList(uid);
  const mealPlans = await listUserMealPlans(uid);

  return {
    exportedAt: new Date().toISOString(),
    profile,
    healthRecords,
    favorites,
    currentGoal,
    foodDiaries,
    shoppingList,
    mealPlans,
  };
}

export async function deleteUserDataAndAccount(user: User): Promise<void> {
  const uid = user.uid;
  const subcollections = [
    'health_records',
    'favorites',
    'food_diaries',
    'goals',
    'shopping_list',
    'meal_plans',
    'food_scans',
  ] as const;

  for (const sub of subcollections) {
    const path = `users/${uid}/${sub}`;
    try {
      const q = query(collection(db, 'users', uid, sub), where('userId', '==', uid));
      const snap = await getDocs(q);
      await Promise.all(
        snap.docs.map((d) => deleteDoc(doc(db, 'users', uid, sub, d.id)))
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  const profilePath = `users/${uid}`;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, profilePath);
  }

  await deleteUser(user);
}
