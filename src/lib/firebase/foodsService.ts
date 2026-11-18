import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  FIRESTORE_BATCH_LIMIT,
  normalizeVietnamese,
  validateFood,
} from '@/src/lib/nutrition';
import type { FoodInput, FoodItem, NutrientsPer100g } from '@/src/types/food';
import { db } from './config';
import { handleFirestoreError, OperationType } from './errors';

let cachedPublicFoods: FoodItem[] | null = null;
let cachedAdminFoods: FoodItem[] | null = null;

export function invalidateFoodsCache(): void {
  cachedPublicFoods = null;
  cachedAdminFoods = null;
}

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

function mapDocToFoodItem(id: string, data: Record<string, unknown>): FoodItem {
  const rawNutrients =
    typeof data.nutrientsPer100g === 'object' && data.nutrientsPer100g !== null
      ? (data.nutrientsPer100g as Record<string, unknown>)
      : {};

  const nutrientsPer100g: NutrientsPer100g = {
    energyKcal: parseNullableNum(rawNutrients.energyKcal),
    proteinG: parseNullableNum(rawNutrients.proteinG),
    fatG: parseNullableNum(rawNutrients.fatG),
    carbG: parseNullableNum(rawNutrients.carbG),
    fiberG: parseNullableNum(rawNutrients.fiberG),
    sugarG: parseNullableNum(rawNutrients.sugarG),
    sodiumMg: parseNullableNum(rawNutrients.sodiumMg),
  };

  const rawSource =
    typeof data.source === 'object' && data.source !== null
      ? (data.source as Record<string, unknown>)
      : null;

  return {
    id: String(data.id ?? id),
    nameVi: String(data.nameVi ?? ''),
    nameEn: String(data.nameEn ?? ''),
    aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : [],
    nameNormalized: String(
      data.nameNormalized ?? normalizeVietnamese(String(data.nameVi ?? ''))
    ),
    category: data.category as FoodItem['category'],
    nutrientsPer100g,
    servingUnits: Array.isArray(data.servingUnits)
      ? data.servingUnits.map((item) => {
          const obj = item as Record<string, unknown>;
          return {
            label: String(obj?.label ?? ''),
            grams: Number(obj?.grams ?? 0),
          };
        })
      : [],
    allergens: Array.isArray(data.allergens) ? data.allergens.map(String) : [],
    allergensReviewed: Boolean(data.allergensReviewed),
    dietTags: Array.isArray(data.dietTags) ? data.dietTags.map(String) : [],
    source: rawSource
      ? {
          name: String(rawSource.name ?? ''),
          year: parseNullableNum(rawSource.year),
          reference: String(rawSource.reference ?? ''),
        }
      : null,
    verificationStatus:
      (data.verificationStatus as FoodItem['verificationStatus']) ?? 'unverified',
    imagePath: data.imagePath ? String(data.imagePath) : null,
    isActive: data.isActive !== false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    updatedBy: String(data.updatedBy ?? ''),
  };
}

export async function fetchFoods(options?: {
  includeInactive?: boolean;
  forceRefresh?: boolean;
}): Promise<FoodItem[]> {
  const includeInactive = options?.includeInactive ?? false;
  const forceRefresh = options?.forceRefresh ?? false;

  if (!forceRefresh) {
    if (includeInactive && cachedAdminFoods) {
      return cachedAdminFoods;
    }
    if (!includeInactive && cachedPublicFoods) {
      return cachedPublicFoods;
    }
  }

  const path = 'foods';
  try {
    const q = includeInactive
      ? collection(db, 'foods')
      : query(collection(db, 'foods'), where('isActive', '==', true));

    const snap = await getDocs(q);
    const items = snap.docs
      .map((docSnap) => mapDocToFoodItem(docSnap.id, docSnap.data()))
      .sort((a, b) => a.nameVi.localeCompare(b.nameVi, 'vi'));

    if (includeInactive) {
      cachedAdminFoods = items;
      cachedPublicFoods = items.filter((item) => item.isActive);
    } else {
      cachedPublicFoods = items;
    }

    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchFoodById(
  foodId: string,
  options?: { forceRefresh?: boolean }
): Promise<FoodItem | null> {
  if (!options?.forceRefresh) {
    const cached =
      cachedAdminFoods?.find((f) => f.id === foodId) ??
      cachedPublicFoods?.find((f) => f.id === foodId);
    if (cached) {
      return cached;
    }
  }

  const path = `foods/${foodId}`;
  try {
    const snap = await getDoc(doc(db, 'foods', foodId));
    if (!snap.exists()) {
      return null;
    }
    return mapDocToFoodItem(snap.id, snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

function buildFirestoreFoodPayload(
  validData: FoodInput,
  adminUid: string
): Record<string, unknown> {
  return {
    id: validData.id,
    nameVi: validData.nameVi,
    nameEn: validData.nameEn ?? '',
    aliases: validData.aliases,
    nameNormalized: normalizeVietnamese(validData.nameVi),
    category: validData.category,
    nutrientsPer100g: validData.nutrientsPer100g,
    servingUnits: validData.servingUnits,
    allergens: validData.allergens,
    allergensReviewed: validData.allergensReviewed,
    dietTags: validData.dietTags,
    source: validData.source,
    verificationStatus: validData.verificationStatus,
    imagePath: validData.imagePath ?? null,
    isActive: validData.isActive,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  };
}

export async function upsertFood(
  input: FoodInput,
  adminUid: string,
  isExisting: boolean
): Promise<void> {
  const validation = validateFood(input);
  if (!validation.success) {
    throw new Error(validation.errors.join(' '));
  }

  const validData = validation.data;
  const path = `foods/${validData.id}`;
  const payload = buildFirestoreFoodPayload(validData, adminUid);

  try {
    const docRef = doc(db, 'foods', validData.id);
    if (isExisting) {
      await updateDoc(docRef, payload);
    } else {
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
    invalidateFoodsCache();
  } catch (error) {
    handleFirestoreError(
      error,
      isExisting ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function setFoodActiveStatus(
  food: FoodItem,
  isActive: boolean,
  adminUid: string
): Promise<void> {
  const path = `foods/${food.id}`;
  try {
    await updateDoc(doc(db, 'foods', food.id), {
      isActive,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
    invalidateFoodsCache();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export interface BatchImportSummary {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export async function batchImportFoods(
  validItems: FoodInput[],
  existingIds: Set<string>,
  adminUid: string,
  skippedInvalidCount: number
): Promise<BatchImportSummary> {
  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (let i = 0; i < validItems.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = validItems.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const validation = validateFood(item);
      if (!validation.success) {
        errors.push(`${item.id || 'Không rõ ID'}: ${validation.errors.join('; ')}`);
        continue;
      }
      const validData = validation.data;
      const docRef = doc(db, 'foods', validData.id);
      const payload = buildFirestoreFoodPayload(validData, adminUid);

      if (existingIds.has(validData.id)) {
        batch.update(docRef, payload);
        updated += 1;
      } else {
        batch.set(docRef, {
          ...payload,
          createdAt: serverTimestamp(),
        });
        created += 1;
      }
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'foods (batch import)');
    }
  }

  invalidateFoodsCache();

  return {
    created,
    updated,
    skipped: skippedInvalidCount,
    errors,
  };
}
