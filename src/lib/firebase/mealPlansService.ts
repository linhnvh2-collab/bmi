import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { SavedMealPlan } from '@/src/types/mealPlan';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

function mapMealPlanDoc(
  uid: string,
  planId: string,
  data: Record<string, unknown>
): SavedMealPlan {
  return {
    id: String(data.id ?? planId),
    userId: String(data.userId ?? uid),
    title: String(data.title ?? 'Thực đơn gợi ý'),
    durationDays: (data.durationDays === 3 || data.durationDays === 7
      ? data.durationDays
      : 1) as 1 | 3 | 7,
    dietMode: (data.dietMode as SavedMealPlan['dietMode']) ?? 'balanced',
    nutritionGoal:
      (data.nutritionGoal as SavedMealPlan['nutritionGoal']) ??
      'nutrition_balance',
    targetKcalPerDay:
      typeof data.targetKcalPerDay === 'number' ? data.targetKcalPerDay : null,
    days: Array.isArray(data.days)
      ? (data.days as SavedMealPlan['days'])
      : [],
    aiSummary: String(data.aiSummary ?? ''),
    isEstimated: true,
    isFavorite: Boolean(data.isFavorite),
    availableIngredients: Array.isArray(data.availableIngredients)
      ? data.availableIngredients.map(String)
      : [],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function listUserMealPlans(uid: string): Promise<SavedMealPlan[]> {
  const path = `users/${uid}/meal_plans`;
  try {
    const q = query(
      collection(db, 'users', uid, 'meal_plans'),
      where('userId', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapMealPlanDoc(uid, d.id, d.data()))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeMealPlans(
  uid: string,
  onData: (plans: SavedMealPlan[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/meal_plans`;
  const q = query(
    collection(db, 'users', uid, 'meal_plans'),
    where('userId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const plans = snap.docs
        .map((d) => mapMealPlanDoc(uid, d.id, d.data()))
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      onData(plans);
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Error surfaced through UI callback
      }
    }
  );
}

export async function saveUserMealPlan(
  uid: string,
  plan: Omit<SavedMealPlan, 'userId' | 'createdAt' | 'updatedAt'>,
  isExisting: boolean
): Promise<void> {
  const path = `users/${uid}/meal_plans/${plan.id}`;
  const docRef = doc(db, 'users', uid, 'meal_plans', plan.id);

  const payload = {
    id: plan.id,
    userId: uid,
    title: plan.title.trim().slice(0, 140),
    durationDays: plan.durationDays,
    dietMode: plan.dietMode,
    nutritionGoal: plan.nutritionGoal,
    targetKcalPerDay: plan.targetKcalPerDay,
    days: plan.days,
    aiSummary: plan.aiSummary.slice(0, 1200),
    isEstimated: true,
    isFavorite: Boolean(plan.isFavorite),
    availableIngredients: (plan.availableIngredients ?? []).slice(0, 20),
    updatedAt: serverTimestamp(),
  };

  try {
    if (isExisting) {
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isExisting ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteUserMealPlan(
  uid: string,
  planId: string
): Promise<void> {
  const path = `users/${uid}/meal_plans/${planId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'meal_plans', planId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
