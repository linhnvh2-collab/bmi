import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { DIARY_LIMITS } from '@/src/lib/diary';
import type { NutrientsPer100g } from '@/src/types/food';
import type { DiaryEntry, FoodDiaryDay } from '@/src/types/stage3';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return new Date();
}

function parseNullableNum(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function mapEntry(raw: Record<string, unknown>): DiaryEntry {
  const n =
    typeof raw.nutrientsPer100gSnapshot === 'object' &&
    raw.nutrientsPer100gSnapshot !== null
      ? (raw.nutrientsPer100gSnapshot as Record<string, unknown>)
      : {};

  const snapshot: NutrientsPer100g = {
    energyKcal: parseNullableNum(n.energyKcal),
    proteinG: parseNullableNum(n.proteinG),
    fatG: parseNullableNum(n.fatG),
    carbG: parseNullableNum(n.carbG),
    fiberG: parseNullableNum(n.fiberG),
    sugarG: parseNullableNum(n.sugarG),
    sodiumMg: parseNullableNum(n.sodiumMg),
  };

  return {
    id: String(raw.id ?? ''),
    mealType: (raw.mealType as DiaryEntry['mealType']) ?? 'lunch',
    source: raw.source === 'custom' ? 'custom' : 'database',
    foodId: raw.foodId ? String(raw.foodId) : null,
    name: String(raw.name ?? ''),
    grams: Number(raw.grams ?? 100),
    nutrientsPer100gSnapshot: snapshot,
    verificationStatusSnapshot:
      (raw.verificationStatusSnapshot as DiaryEntry['verificationStatusSnapshot']) ??
      'unverified',
    loggedAt: String(raw.loggedAt ?? new Date().toISOString()),
  };
}

function mapDiaryDoc(
  uid: string,
  dateKey: string,
  data: Record<string, unknown>
): FoodDiaryDay {
  const entries = Array.isArray(data.entries)
    ? data.entries
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object')
        )
        .map(mapEntry)
    : [];

  return {
    userId: String(data.userId ?? uid),
    date: String(data.date ?? dateKey),
    entries,
    updatedAt: toDate(data.updatedAt),
  };
}

export async function getFoodDiaryDay(
  uid: string,
  dateKey: string
): Promise<FoodDiaryDay | null> {
  const path = `users/${uid}/food_diaries/${dateKey}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'food_diaries', dateKey));
    if (!snap.exists()) {
      return null;
    }
    return mapDiaryDoc(uid, dateKey, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeFoodDiaryDay(
  uid: string,
  dateKey: string,
  onData: (diary: FoodDiaryDay | null) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/food_diaries/${dateKey}`;
  const docRef = doc(db, 'users', uid, 'food_diaries', dateKey);
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapDiaryDoc(uid, dateKey, snap.data()));
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Đã chuyển lỗi về callback cho UI xử lý
      }
    }
  );
}

export async function saveFoodDiaryDay(
  uid: string,
  dateKey: string,
  entries: DiaryEntry[],
  hasExistingDoc: boolean
): Promise<void> {
  if (entries.length > DIARY_LIMITS.MAX_ENTRIES_PER_DAY) {
    throw new Error(
      `Mỗi ngày chỉ lưu tối đa ${DIARY_LIMITS.MAX_ENTRIES_PER_DAY} mục nhật ký.`
    );
  }

  const path = `users/${uid}/food_diaries/${dateKey}`;
  const sanitizedEntries = entries.map((entry) => ({
    id: entry.id.slice(0, 128),
    mealType: entry.mealType,
    source: entry.source,
    foodId: entry.source === 'database' ? entry.foodId : null,
    name: entry.name.trim().slice(0, DIARY_LIMITS.MAX_NAME_LENGTH),
    grams: Math.round(entry.grams * 10) / 10,
    nutrientsPer100gSnapshot: entry.nutrientsPer100gSnapshot,
    verificationStatusSnapshot: entry.verificationStatusSnapshot,
    loggedAt: entry.loggedAt,
  }));

  try {
    const docRef = doc(db, 'users', uid, 'food_diaries', dateKey);
    if (hasExistingDoc) {
      await updateDoc(docRef, {
        entries: sanitizedEntries,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        userId: uid,
        date: dateKey,
        entries: sanitizedEntries,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      hasExistingDoc ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteFoodDiaryDay(
  uid: string,
  dateKey: string
): Promise<void> {
  const path = `users/${uid}/food_diaries/${dateKey}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'food_diaries', dateKey));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
