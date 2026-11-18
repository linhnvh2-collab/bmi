import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from 'firebase/storage';
import type { FoodScanHistoryRecord } from '@/src/types/mealPlan';
import { db, storage } from './config';
import { handleFirestoreError, OperationType } from './errors';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
}

export async function uploadFoodScanImage(
  uid: string,
  scanId: string,
  file: File
): Promise<{ storagePath: string | null; warningVi: string | null }> {
  const ext =
    file.type === 'image/png'
      ? 'png'
      : file.type === 'image/webp'
        ? 'webp'
        : 'jpg';
  const storagePath = `users/${uid}/food_scans/${scanId}.${ext}`;
  try {
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return { storagePath, warningVi: null };
  } catch {
    return {
      storagePath: null,
      warningVi:
        'Không thể tải ảnh lên Firebase Storage (có thể bucket Storage chưa bật quy tắc hoặc hạn mức Spark); hệ thống vẫn lưu lịch sử phân tích dạng văn bản.',
    };
  }
}

export async function resolveFoodScanDownloadUrl(
  storagePath: string | null
): Promise<string | null> {
  if (!storagePath) return null;
  try {
    return await getDownloadURL(ref(storage, storagePath));
  } catch {
    return null;
  }
}

export async function saveFoodScanRecord(
  uid: string,
  record: Omit<FoodScanHistoryRecord, 'userId' | 'createdAt'>
): Promise<void> {
  const path = `users/${uid}/food_scans/${record.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'food_scans', record.id), {
      id: record.id,
      userId: uid,
      storagePath: record.storagePath,
      summaryVi: record.summaryVi.slice(0, 600),
      isFoodImage: record.isFoodImage,
      detectedCount: record.detectedCount,
      items: record.items.slice(0, 30),
      confirmedToDiary: record.confirmedToDiary,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markFoodScanConfirmed(
  uid: string,
  scanId: string
): Promise<void> {
  const path = `users/${uid}/food_scans/${scanId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'food_scans', scanId), {
      confirmedToDiary: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFoodScanRecordAndImage(
  uid: string,
  record: Pick<FoodScanHistoryRecord, 'id' | 'storagePath'>
): Promise<void> {
  const path = `users/${uid}/food_scans/${record.id}`;
  if (record.storagePath) {
    try {
      await deleteObject(ref(storage, record.storagePath));
    } catch {
      // Proceed to delete metadata record even if storage object was already removed
    }
  }
  try {
    await deleteDoc(doc(db, 'users', uid, 'food_scans', record.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeFoodScans(
  uid: string,
  onData: (records: FoodScanHistoryRecord[]) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/food_scans`;
  const q = query(
    collection(db, 'users', uid, 'food_scans'),
    where('userId', '==', uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: String(data.id ?? d.id),
            userId: String(data.userId ?? uid),
            storagePath:
              typeof data.storagePath === 'string' ? data.storagePath : null,
            summaryVi: String(data.summaryVi ?? ''),
            isFoodImage: Boolean(data.isFoodImage),
            detectedCount: Number(data.detectedCount ?? 0),
            items: Array.isArray(data.items)
              ? (data.items as FoodScanHistoryRecord['items'])
              : [],
            confirmedToDiary: Boolean(data.confirmedToDiary),
            createdAt: toDate(data.createdAt),
          } satisfies FoodScanHistoryRecord;
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 20);
      onData(items);
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
