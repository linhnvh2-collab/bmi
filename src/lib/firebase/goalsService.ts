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
import type { UserGoal, UserGoalInput } from '@/src/types/stage3';
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

function mapGoalDoc(uid: string, data: Record<string, unknown>): UserGoal {
  return {
    userId: String(data.userId ?? uid),
    goalType: data.goalType as UserGoal['goalType'],
    startDate: String(data.startDate ?? ''),
    startWeightKg: Number(data.startWeightKg ?? 0),
    targetWeightKg:
      data.targetWeightKg === null || data.targetWeightKg === undefined
        ? null
        : Number(data.targetWeightKg),
    weeklyChangeKg: Number(data.weeklyChangeKg ?? 0),
    targetKcal:
      data.targetKcal === null || data.targetKcal === undefined
        ? null
        : Number(data.targetKcal),
    educationalConfirmed: Boolean(data.educationalConfirmed),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function getCurrentGoal(uid: string): Promise<UserGoal | null> {
  const path = `users/${uid}/goals/current`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'goals', 'current'));
    if (!snap.exists()) {
      return null;
    }
    return mapGoalDoc(uid, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeCurrentGoal(
  uid: string,
  onData: (goal: UserGoal | null) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/goals/current`;
  const docRef = doc(db, 'users', uid, 'goals', 'current');
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapGoalDoc(uid, snap.data()));
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

export async function saveCurrentGoal(
  uid: string,
  input: UserGoalInput,
  hasExisting: boolean
): Promise<void> {
  const path = `users/${uid}/goals/current`;
  if (!input.educationalConfirmed) {
    throw new Error('Cần xác nhận hiểu rõ tính chất giáo dục của mục tiêu.');
  }

  const baseFields = {
    goalType: input.goalType,
    startDate: input.startDate,
    startWeightKg: Math.round(input.startWeightKg * 10) / 10,
    targetWeightKg:
      input.targetWeightKg === null
        ? null
        : Math.round(input.targetWeightKg * 10) / 10,
    weeklyChangeKg: Math.round(input.weeklyChangeKg * 100) / 100,
    targetKcal:
      input.goalType === 'healthy_habits' || input.targetKcal === null
        ? null
        : Math.round(input.targetKcal),
    educationalConfirmed: true,
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = doc(db, 'users', uid, 'goals', 'current');
    if (hasExisting) {
      await updateDoc(docRef, baseFields);
    } else {
      await setDoc(docRef, {
        userId: uid,
        ...baseFields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      hasExisting ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteCurrentGoal(uid: string): Promise<void> {
  const path = `users/${uid}/goals/current`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'goals', 'current'));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
