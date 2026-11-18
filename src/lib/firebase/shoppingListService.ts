import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { SHOPPING_LIST_LIMITS } from '@/src/lib/diary';
import type { ShoppingListDoc, ShoppingListItem } from '@/src/types/stage3';
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

function mapShoppingItem(raw: Record<string, unknown>): ShoppingListItem {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    category: (raw.category as ShoppingListItem['category']) ?? 'other',
    quantityLabel: String(raw.quantityLabel ?? ''),
    foodId: raw.foodId ? String(raw.foodId) : null,
    checked: Boolean(raw.checked),
    addedAt: String(raw.addedAt ?? new Date().toISOString()),
  };
}

function mapShoppingDoc(
  uid: string,
  data: Record<string, unknown>
): ShoppingListDoc {
  const items = Array.isArray(data.items)
    ? data.items
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === 'object')
        )
        .map(mapShoppingItem)
    : [];

  return {
    userId: String(data.userId ?? uid),
    items,
    updatedAt: toDate(data.updatedAt),
  };
}

export async function getShoppingList(
  uid: string
): Promise<ShoppingListDoc | null> {
  const path = `users/${uid}/shopping_list/current`;
  try {
    const snap = await getDoc(
      doc(db, 'users', uid, 'shopping_list', 'current')
    );
    if (!snap.exists()) {
      return null;
    }
    return mapShoppingDoc(uid, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeShoppingList(
  uid: string,
  onData: (list: ShoppingListDoc | null) => void,
  onError: (error: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/shopping_list/current`;
  const docRef = doc(db, 'users', uid, 'shopping_list', 'current');
  return onSnapshot(
    docRef,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      onData(mapShoppingDoc(uid, snap.data()));
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

export async function saveShoppingList(
  uid: string,
  items: ShoppingListItem[],
  hasExistingDoc: boolean
): Promise<void> {
  if (items.length > SHOPPING_LIST_LIMITS.MAX_ITEMS) {
    throw new Error(
      `Danh sách mua sắm hỗ trợ tối đa ${SHOPPING_LIST_LIMITS.MAX_ITEMS} mục.`
    );
  }

  const path = `users/${uid}/shopping_list/current`;
  const sanitizedItems = items.map((item) => ({
    id: item.id.slice(0, 128),
    name: item.name.trim().slice(0, SHOPPING_LIST_LIMITS.MAX_NAME_LENGTH),
    category: item.category,
    quantityLabel: item.quantityLabel
      .trim()
      .slice(0, SHOPPING_LIST_LIMITS.MAX_QUANTITY_LENGTH),
    foodId: item.foodId || null,
    checked: Boolean(item.checked),
    addedAt: item.addedAt,
  }));

  try {
    const docRef = doc(db, 'users', uid, 'shopping_list', 'current');
    if (hasExistingDoc) {
      await updateDoc(docRef, {
        items: sanitizedItems,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        userId: uid,
        items: sanitizedItems,
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
