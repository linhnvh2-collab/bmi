import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { PROFILE_INPUT_LIMITS } from '@/src/lib/calculations/constants';
import type { HealthRecord, HealthRecordCreateInput } from '@/src/types/health';
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

export function subscribeHealthRecords(
  uid: string,
  onData: (records: HealthRecord[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/health_records`;
  const q = query(
    collection(db, 'users', uid, 'health_records'),
    where('userId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const records: HealthRecord[] = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
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
      onData(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedError) {
        onError(wrappedError);
      }
    }
  );
}

export async function addHealthRecord(
  uid: string,
  input: HealthRecordCreateInput
): Promise<string> {
  const path = `users/${uid}/health_records`;
  const isUnder18 = input.age < 18;
  const safeCategoryKey = isUnder18 ? 'under_18_limited' : input.categoryKey;

  try {
    const ref = await addDoc(collection(db, 'users', uid, 'health_records'), {
      userId: uid,
      age: Math.round(input.age),
      heightCm: Number(input.heightCm),
      weightKg: Number(input.weightKg),
      bmi: Number(input.bmi),
      isUnder18,
      categoryKey: safeCategoryKey,
      note: input.note.trim().slice(0, PROFILE_INPUT_LIMITS.MAX_NOTE_LENGTH),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteHealthRecord(
  uid: string,
  recordId: string
): Promise<void> {
  const path = `users/${uid}/health_records/${recordId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'health_records', recordId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
