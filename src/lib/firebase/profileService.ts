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
import type { FoodDiaryDay, ShoppingListDoc, UserGoal } from '@/src/types/stage3';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';
import { getCurrentGoal } from './goalsService';
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
      sex: (data.sex as UserProfile['sex']) ?? 'other',
      heightCm: Number(data.heightCm ?? 170),
      weightKg: Number(data.weightKg ?? 65),
      activityLevel: (data.activityLevel as UserProfile['activityLevel']) ?? 'moderate',
      dietaryPreferences: Array.isArray(data.dietaryPreferences)
        ? data.dietaryPreferences.map(String)
        : [],
      allergens: Array.isArray(data.allergens) ? data.allergens.map(String) : [],
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

  const baseFields = {
    displayName: input.displayName.trim().slice(0, PROFILE_INPUT_LIMITS.DISPLAY_NAME_MAX),
    email: email.trim().slice(0, 254),
    birthYear: Math.round(input.birthYear),
    sex: input.sex,
    heightCm: Number(input.heightCm),
    weightKg: Number(input.weightKg),
    activityLevel: input.activityLevel,
    dietaryPreferences: sanitizedDietary,
    allergens: sanitizedAllergens,
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

  return {
    exportedAt: new Date().toISOString(),
    profile,
    healthRecords,
    favorites,
    currentGoal,
    foodDiaries,
    shoppingList,
  };
}

export async function deleteUserDataAndAccount(user: User): Promise<void> {
  const uid = user.uid;
  const recordsPath = `users/${uid}/health_records`;
  try {
    const q = query(collection(db, 'users', uid, 'health_records'), where('userId', '==', uid));
    const snap = await getDocs(q);
    await Promise.all(
      snap.docs.map((recordDoc) =>
        deleteDoc(doc(db, 'users', uid, 'health_records', recordDoc.id))
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, recordsPath);
  }

  const favPath = `users/${uid}/favorites`;
  try {
    const favQ = query(collection(db, 'users', uid, 'favorites'), where('userId', '==', uid));
    const favSnap = await getDocs(favQ);
    await Promise.all(
      favSnap.docs.map((favDoc) =>
        deleteDoc(doc(db, 'users', uid, 'favorites', favDoc.id))
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, favPath);
  }

  const diariesPath = `users/${uid}/food_diaries`;
  try {
    const diariesQ = query(
      collection(db, 'users', uid, 'food_diaries'),
      where('userId', '==', uid)
    );
    const diariesSnap = await getDocs(diariesQ);
    await Promise.all(
      diariesSnap.docs.map((diaryDoc) =>
        deleteDoc(doc(db, 'users', uid, 'food_diaries', diaryDoc.id))
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, diariesPath);
  }

  const goalsPath = `users/${uid}/goals`;
  try {
    const goalsQ = query(collection(db, 'users', uid, 'goals'), where('userId', '==', uid));
    const goalsSnap = await getDocs(goalsQ);
    await Promise.all(
      goalsSnap.docs.map((goalDoc) =>
        deleteDoc(doc(db, 'users', uid, 'goals', goalDoc.id))
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, goalsPath);
  }

  const shoppingPath = `users/${uid}/shopping_list`;
  try {
    const shoppingQ = query(
      collection(db, 'users', uid, 'shopping_list'),
      where('userId', '==', uid)
    );
    const shoppingSnap = await getDocs(shoppingQ);
    await Promise.all(
      shoppingSnap.docs.map((listDoc) =>
        deleteDoc(doc(db, 'users', uid, 'shopping_list', listDoc.id))
      )
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, shoppingPath);
  }

  const profilePath = `users/${uid}`;
  try {
    await deleteDoc(doc(db, 'users', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, profilePath);
  }

  await deleteUser(user);
}
