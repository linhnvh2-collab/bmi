import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { FavoriteFood } from '@/src/types/food';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';

function toDate(value: unknown): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return new Date();
}

export function subscribeFavorites(
  uid: string,
  onData: (favorites: FavoriteFood[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/favorites`;
  const q = query(
    collection(db, 'users', uid, 'favorites'),
    where('userId', '==', uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => {
          const data = docSnap.data();
          return {
            userId: String(data.userId ?? uid),
            foodId: String(data.foodId ?? docSnap.id),
            createdAt: toDate(data.createdAt),
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export async function addFavoriteFood(uid: string, foodId: string): Promise<void> {
  const path = `users/${uid}/favorites/${foodId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'favorites', foodId), {
      userId: uid,
      foodId,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeFavoriteFood(
  uid: string,
  foodId: string
): Promise<void> {
  const path = `users/${uid}/favorites/${foodId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'favorites', foodId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
