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
  VIETNAMESE_CATALOG_MAP,
  VIETNAMESE_FOOD_CATALOG,
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

  const catalogFallback = VIETNAMESE_CATALOG_MAP.get(String(data.id ?? id));

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
    imagePath: data.imagePath
      ? String(data.imagePath)
      : (catalogFallback?.imagePath ?? null),
    ingredients: Array.isArray(data.ingredients)
      ? data.ingredients.map(String)
      : catalogFallback?.ingredients,
    preparationNote:
      typeof data.preparationNote === 'string' && data.preparationNote.trim()
        ? data.preparationNote
        : catalogFallback?.preparationNote,
    isActive: data.isActive !== false,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    updatedBy: String(data.updatedBy ?? ''),
  };
}

function mergeCatalogWithFirestore(
  firestoreFoods: FoodItem[],
  includeInactive: boolean
): FoodItem[] {
  const merged = new Map<string, FoodItem>();

  for (const seedItem of VIETNAMESE_FOOD_CATALOG) {
    merged.set(seedItem.id, seedItem);
  }
  for (const fsItem of firestoreFoods) {
    merged.set(fsItem.id, fsItem);
  }

  return Array.from(merged.values())
    .filter((item) => includeInactive || item.isActive)
    .sort((a, b) => a.nameVi.localeCompare(b.nameVi, 'vi'));
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
    const firestoreItems = snap.docs.map((docSnap) =>
      mapDocToFoodItem(docSnap.id, docSnap.data())
    );

    const items = mergeCatalogWithFirestore(firestoreItems, includeInactive);

    if (includeInactive) {
      cachedAdminFoods = items;
      cachedPublicFoods = items.filter((item) => item.isActive);
    } else {
      cachedPublicFoods = items;
    }

    return items;
  } catch (error) {
    if (!includeInactive) {
      // Fallback safely to curated built-in Vietnamese reference catalog if offline or unindexed
      console.warn('Firestore foods read error, falling back to reference catalog:', error);
      return VIETNAMESE_FOOD_CATALOG;
    }
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
    if (snap.exists()) {
      return mapDocToFoodItem(snap.id, snap.data());
    }
  } catch (error) {
    // Allow catalog lookup fallback if document does not exist in Firestore yet
    console.warn('Firestore fetchFoodById error:', path, error);
  }

  return VIETNAMESE_CATALOG_MAP.get(foodId) ?? null;
}

function buildFirestoreFoodPayload(
  validData: FoodInput,
  adminUid: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
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

  if (validData.ingredients && validData.ingredients.length > 0) {
    payload.ingredients = validData.ingredients;
  }
  if (validData.preparationNote && validData.preparationNote.trim()) {
    payload.preparationNote = validData.preparationNote.trim();
  }

  return payload;
}

export async function upsertFood(
  input: FoodInput,
  adminUid: string,
  isExistingInFirestore: boolean
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
    const snap = isExistingInFirestore ? await getDoc(docRef) : null;
    if (snap && snap.exists()) {
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
      isExistingInFirestore ? OperationType.UPDATE : OperationType.CREATE,
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
    const docRef = doc(db, 'foods', food.id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await updateDoc(docRef, {
        isActive,
        updatedAt: serverTimestamp(),
        updatedBy: adminUid,
      });
    } else {
      const payload = buildFirestoreFoodPayload(
        {
          id: food.id,
          nameVi: food.nameVi,
          nameEn: food.nameEn,
          aliases: food.aliases,
          category: food.category,
          nutrientsPer100g: food.nutrientsPer100g,
          servingUnits: food.servingUnits,
          allergens: food.allergens,
          allergensReviewed: food.allergensReviewed,
          dietTags: food.dietTags,
          source: food.source,
          verificationStatus: food.verificationStatus,
          imagePath: food.imagePath,
          ingredients: food.ingredients,
          preparationNote: food.preparationNote,
          isActive,
        },
        adminUid
      );
      await setDoc(docRef, {
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
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
  existingFirestoreIds: Set<string>,
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

      if (existingFirestoreIds.has(validData.id)) {
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

export async function syncReferenceCatalogToFirestore(
  adminUid: string
): Promise<BatchImportSummary> {
  const snap = await getDocs(collection(db, 'foods'));
  const existingFirestoreIds = new Set(snap.docs.map((d) => d.id));
  const items: FoodInput[] = VIETNAMESE_FOOD_CATALOG.map((item) => ({
    id: item.id,
    nameVi: item.nameVi,
    nameEn: item.nameEn,
    aliases: item.aliases,
    category: item.category,
    nutrientsPer100g: item.nutrientsPer100g,
    servingUnits: item.servingUnits,
    allergens: item.allergens,
    allergensReviewed: item.allergensReviewed,
    dietTags: item.dietTags,
    source: item.source,
    verificationStatus: item.verificationStatus,
    imagePath: item.imagePath,
    ingredients: item.ingredients,
    preparationNote: item.preparationNote,
    isActive: item.isActive,
  }));
  return batchImportFoods(items, existingFirestoreIds, adminUid, 0);
}
