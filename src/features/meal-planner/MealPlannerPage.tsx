import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  BookOpen,
  Check,
  ChefHat,
  Clock,
  Coins,
  Info,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Sparkles,
  Star,
  Trash2,
  Utensils,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  DisclaimerBanner,
  EmptyState,
  FormField,
  Input,
  Modal,
  Select,
  Skeleton,
} from '@/src/components/ui';
import { VerificationBadge } from '@/src/features/foods/components';
import { DIARY_LIMITS, SHOPPING_LIST_LIMITS } from '@/src/lib/diary';
import {
  getFoodDiaryDay,
  saveFoodDiaryDay,
} from '@/src/lib/firebase/diaryService';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import { fetchFoods } from '@/src/lib/firebase/foodsService';
import {
  deleteUserMealPlan,
  saveUserMealPlan,
  subscribeMealPlans,
} from '@/src/lib/firebase/mealPlansService';
import {
  getShoppingList,
  saveShoppingList,
} from '@/src/lib/firebase/shoppingListService';
import {
  calculateAgeFromBirthDate,
  calculateAgeFromBirthYear,
  getTodayDateKey,
} from '@/src/lib/format/date';
import {
  BUDGET_LEVEL_OPTIONS,
  buildPersonalizedNutritionPlan,
  DIET_MODE_OPTIONS,
  NUTRITION_GOAL_OPTIONS,
  PREP_TIME_OPTIONS,
  scaleNutrients,
} from '@/src/lib/nutrition';
import type { FoodItem, NutrientKey, NutrientsPer100g } from '@/src/types/food';
import type {
  BudgetLevel,
  DietMode,
  NutritionGoalMode,
  PrepTimePreference,
} from '@/src/types/health';
import type {
  MealPlanDay,
  MealPlanDish,
  MealPlanSlot,
  SavedMealPlan,
  SwapDishSuggestion,
} from '@/src/types/mealPlan';
import type { DiaryEntry, ShoppingListItem } from '@/src/types/stage3';

const NUTRIENT_KEYS: NutrientKey[] = [
  'energyKcal',
  'proteinG',
  'fatG',
  'carbG',
  'fiberG',
  'sugarG',
  'sodiumMg',
];

const BUDGET_TIER_SHORT_LABELS: Record<BudgetLevel, string> = {
  economy: 'Tiết kiệm',
  standard: 'Trung bình',
  flexible: 'Linh hoạt',
};

function recalculateSlotAndDayTotals(day: MealPlanDay): MealPlanDay {
  const allDayNutrients: NutrientsPer100g[] = [];
  let hasEstimatedOrUnverified = false;

  const updatedMeals = day.meals.map((slot) => {
    const slotTotals: NutrientsPer100g = {
      energyKcal: null,
      proteinG: null,
      fatG: null,
      carbG: null,
      fiberG: null,
      sugarG: null,
      sodiumMg: null,
    };
    let slotPartial = false;

    for (const key of NUTRIENT_KEYS) {
      let sum = 0;
      let known = 0;
      for (const dish of slot.dishes) {
        if (dish.verificationStatus !== 'verified') {
          hasEstimatedOrUnverified = true;
        }
        const v = dish.nutrientsScaled[key];
        if (v === null) {
          slotPartial = true;
        } else {
          sum += v;
          known += 1;
        }
      }
      if (known > 0) {
        slotTotals[key] =
          key === 'energyKcal' ? Math.round(sum) : Math.round(sum * 10) / 10;
      }
    }

    for (const dish of slot.dishes) {
      allDayNutrients.push(dish.nutrientsScaled);
    }

    return {
      ...slot,
      totals: slotTotals,
      isPartial: slotPartial,
    };
  });

  const dailyTotals: NutrientsPer100g = {
    energyKcal: null,
    proteinG: null,
    fatG: null,
    carbG: null,
    fiberG: null,
    sugarG: null,
    sodiumMg: null,
  };
  let dayPartial = false;

  for (const key of NUTRIENT_KEYS) {
    let sum = 0;
    let known = 0;
    for (const n of allDayNutrients) {
      const v = n[key];
      if (v === null) {
        dayPartial = true;
      } else {
        sum += v;
        known += 1;
      }
    }
    if (known > 0) {
      dailyTotals[key] =
        key === 'energyKcal' ? Math.round(sum) : Math.round(sum * 10) / 10;
    }
  }

  return {
    ...day,
    meals: updatedMeals,
    dailyTotals,
    hasEstimatedOrUnverified,
    isPartial: dayPartial,
  };
}

export function MealPlannerPage() {
  const { user, profile, currentGoal } = useAuth();

  const [savedPlans, setSavedPlans] = useState<SavedMealPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);

  const [catalogFoods, setCatalogFoods] = useState<FoodItem[]>([]);

  // Generator controls
  const [durationDays, setDurationDays] = useState<1 | 3 | 7>(1);
  const [mealsPerDay, setMealsPerDay] = useState<3 | 4 | 5>(4);
  const [dietMode, setDietMode] = useState<DietMode>('balanced');
  const [nutritionGoal, setNutritionGoal] =
    useState<NutritionGoalMode>('nutrition_balance');
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('standard');
  const [prepTimePreference, setPrepTimePreference] =
    useState<PrepTimePreference>('moderate');
  const [availableIngredients, setAvailableIngredients] = useState<string[]>([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [hasMedicalScreeningRisk, setHasMedicalScreeningRisk] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [swappingSlotType, setSwappingSlotType] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [actionStatus, setActionStatus] = useState<{
    tone: 'success' | 'danger' | 'warning';
    text: string;
  } | null>(null);

  // Swap modal state
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState<{
    dayIdx: number;
    slot: MealPlanSlot;
    dish: MealPlanDish;
  } | null>(null);
  const [swapPreferQuick, setSwapPreferQuick] = useState(false);
  const [swapPreferEconomy, setSwapPreferEconomy] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuggestions, setSwapSuggestions] = useState<SwapDishSuggestion[]>(
    []
  );

  const profileAge = profile
    ? (profile.birthDate
        ? calculateAgeFromBirthDate(profile.birthDate)
        : null) ?? calculateAgeFromBirthYear(profile.birthYear)
    : null;
  const isUnder18 = profileAge !== null && profileAge < 18;

  useEffect(() => {
    if (!profile) return;
    if (profile.dietMode) setDietMode(profile.dietMode);
    if (profile.nutritionGoal) setNutritionGoal(profile.nutritionGoal);
    if (profile.budgetLevel) setBudgetLevel(profile.budgetLevel);
    if (profile.prepTimePreference)
      setPrepTimePreference(profile.prepTimePreference);
    if (profile.mealsPerDay) setMealsPerDay(profile.mealsPerDay);
  }, [profile]);

  useEffect(() => {
    void fetchFoods({ includeInactive: false })
      .then(setCatalogFoods)
      .catch(() => setCatalogFoods([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    setPlansLoading(true);
    setPlansError(null);
    const unsub = subscribeMealPlans(
      user.uid,
      (plans) => {
        setSavedPlans(plans);
        setSelectedPlanId((prev) =>
          prev && plans.some((p) => p.id === prev)
            ? prev
            : (plans[0]?.id ?? null)
        );
        setPlansLoading(false);
      },
      (err) => {
        setPlansError(formatFirestoreUiErrorVi(err));
        setPlansLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const activePlan = useMemo(
    () => savedPlans.find((p) => p.id === selectedPlanId) ?? savedPlans[0] ?? null,
    [savedPlans, selectedPlanId]
  );

  useEffect(() => {
    setEditingTitle(false);
    setTitleDraft(activePlan?.title ?? '');
  }, [activePlan?.id, activePlan?.title]);

  const activeDay: MealPlanDay | null = useMemo(() => {
    if (!activePlan || activePlan.days.length === 0) return null;
    return activePlan.days[activeDayIndex] ?? activePlan.days[0];
  }, [activePlan, activeDayIndex]);

  const personalizedReference = useMemo(() => {
    if (isUnder18 || hasMedicalScreeningRisk || !profile) return null;
    return buildPersonalizedNutritionPlan({
      age: profileAge,
      sex: profile.sex,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      activityLevel: profile.activityLevel,
      nutritionGoal,
      dietMode,
      budgetLevel,
      prepTimePreference,
      mealsPerDay,
      hasMedicalScreeningRisk,
    });
  }, [
    isUnder18,
    hasMedicalScreeningRisk,
    profile,
    profileAge,
    nutritionGoal,
    dietMode,
    budgetLevel,
    prepTimePreference,
    mealsPerDay,
  ]);

  const estimatedTargetKcal = useMemo(() => {
    if (isUnder18 || hasMedicalScreeningRisk) return null;
    if (currentGoal?.targetKcal) return currentGoal.targetKcal;
    if (personalizedReference?.targetKcal) return personalizedReference.targetKcal;
    return null;
  }, [
    isUnder18,
    hasMedicalScreeningRisk,
    currentGoal?.targetKcal,
    personalizedReference,
  ]);

  const customFoodsPayload = useMemo(
    () =>
      catalogFoods.map((f) => ({
        id: f.id,
        nameVi: f.nameVi,
        category: f.category,
        nutrientsPer100g: f.nutrientsPer100g,
        servingUnits: f.servingUnits,
        allergens: f.allergens,
        allergensReviewed: f.allergensReviewed,
        dietTags: f.dietTags,
        verificationStatus: f.verificationStatus,
        imagePath: f.imagePath,
        ingredients: f.ingredients ?? [],
        preparationNote: f.preparationNote ?? '',
        isActive: f.isActive,
      })),
    [catalogFoods]
  );

  const persistUpdatedPlan = async (
    nextPlan: Partial<SavedMealPlan> & { days?: MealPlanDay[] },
    successText?: string
  ) => {
    if (!user || !activePlan) return;
    await saveUserMealPlan(
      user.uid,
      {
        id: activePlan.id,
        title: nextPlan.title ?? activePlan.title,
        durationDays: activePlan.durationDays,
        dietMode: activePlan.dietMode,
        nutritionGoal: activePlan.nutritionGoal,
        targetKcalPerDay: activePlan.targetKcalPerDay,
        days: nextPlan.days ?? activePlan.days,
        aiSummary: activePlan.aiSummary,
        isEstimated: true,
        isFavorite:
          nextPlan.isFavorite !== undefined
            ? nextPlan.isFavorite
            : activePlan.isFavorite,
        availableIngredients:
          nextPlan.availableIngredients ?? activePlan.availableIngredients,
      },
      true
    );
    if (successText) {
      setActionStatus({ tone: 'success', text: successText });
    }
  };

  const handleAddAvailableIngredient = () => {
    const clean = ingredientInput.trim();
    if (!clean) return;
    if (
      !availableIngredients.includes(clean) &&
      availableIngredients.length < 20
    ) {
      setAvailableIngredients((prev) => [...prev, clean.slice(0, 60)]);
    }
    setIngredientInput('');
  };

  const handleGeneratePlan = async () => {
    if (!user) return;
    setIsGenerating(true);
    setActionStatus(null);
    try {
      const resp = await fetch('/api/ai/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationDays,
          mealsPerDay,
          targetKcalPerDay: estimatedTargetKcal,
          dietMode,
          nutritionGoal:
            isUnder18 || hasMedicalScreeningRisk
              ? 'healthy_habits'
              : nutritionGoal,
          budgetLevel,
          dailyBudgetVnd: profile?.dailyBudgetVnd ?? null,
          prepTimePreference,
          isUnder18,
          hasMedicalScreeningRisk,
          excludedAllergens: profile?.allergens ?? [],
          dislikedFoods: profile?.dislikedFoods ?? [],
          preferredTags: profile?.dietaryPreferences ?? [],
          availableIngredients,
          customFoods: customFoodsPayload,
        }),
      });

      const data = (await resp.json()) as {
        error?: string;
        title?: string;
        aiSummary?: string;
        durationDays?: 1 | 3 | 7;
        dietMode?: DietMode;
        nutritionGoal?: NutritionGoalMode;
        targetKcalPerDay?: number | null;
        availableIngredients?: string[];
        days?: MealPlanDay[];
      };

      if (!resp.ok || !data.days) {
        throw new Error(
          data.error || 'Không thể tạo thực đơn từ AI. Vui lòng thử lại.'
        );
      }

      const planId = `plan-${Date.now()}`;
      await saveUserMealPlan(
        user.uid,
        {
          id: planId,
          title:
            data.title ??
            `Thực đơn ${durationDays} ngày (${DIET_MODE_OPTIONS.find((d) => d.value === dietMode)?.labelVi ?? dietMode})`,
          durationDays: data.durationDays ?? durationDays,
          dietMode: data.dietMode ?? dietMode,
          nutritionGoal: data.nutritionGoal ?? nutritionGoal,
          targetKcalPerDay: data.targetKcalPerDay ?? null,
          days: data.days,
          aiSummary: data.aiSummary ?? '',
          isEstimated: true,
          isFavorite: false,
          availableIngredients: data.availableIngredients ?? availableIngredients,
        },
        false
      );

      setSelectedPlanId(planId);
      setActiveDayIndex(0);
      setActionStatus({
        tone: 'success',
        text: 'Đã tạo và lưu thực đơn AI mới vào tài khoản của bạn.',
      });
    } catch (err) {
      setActionStatus({
        tone: 'danger',
        text:
          err instanceof Error
            ? err.message
            : 'Lỗi kết nối khi tạo thực đơn AI.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleFavoritePlan = async (plan: SavedMealPlan) => {
    if (!user) return;
    try {
      await saveUserMealPlan(
        user.uid,
        {
          id: plan.id,
          title: plan.title,
          durationDays: plan.durationDays,
          dietMode: plan.dietMode,
          nutritionGoal: plan.nutritionGoal,
          targetKcalPerDay: plan.targetKcalPerDay,
          days: plan.days,
          aiSummary: plan.aiSummary,
          isEstimated: true,
          isFavorite: !plan.isFavorite,
          availableIngredients: plan.availableIngredients,
        },
        true
      );
    } catch (err) {
      setActionStatus({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    }
  };

  const handleSavePlanTitle = async () => {
    const clean = titleDraft.trim();
    if (!clean || !activePlan) {
      setEditingTitle(false);
      return;
    }
    try {
      await persistUpdatedPlan(
        { title: clean.slice(0, 120) },
        'Đã cập nhật tên thực đơn.'
      );
      setEditingTitle(false);
    } catch (err) {
      setActionStatus({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    }
  };

  const handleAdjustDishGrams = async (
    dayIdx: number,
    slotType: MealPlanSlot['slotType'],
    dish: MealPlanDish,
    deltaGrams: number
  ) => {
    if (!activePlan) return;
    const nextGrams = Math.max(25, Math.min(1500, dish.grams + deltaGrams));
    if (nextGrams === dish.grams) return;

    const updatedDays = activePlan.days.map((d, idx) => {
      if (idx !== dayIdx) return d;
      const nextMeals = d.meals.map((m) => {
        if (m.slotType !== slotType) return m;
        const nextDishes = m.dishes.map((item) => {
          if (item.slotDishId !== dish.slotDishId) return item;
          return {
            ...item,
            grams: nextGrams,
            servingLabel: `${nextGrams}g`,
            nutrientsScaled: scaleNutrients(item.nutrientsPer100g, nextGrams),
          };
        });
        return { ...m, dishes: nextDishes };
      });
      return recalculateSlotAndDayTotals({ ...d, meals: nextMeals });
    });

    try {
      await persistUpdatedPlan({ days: updatedDays });
    } catch (err) {
      setActionStatus({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    }
  };

  const handleSwapEntireSlot = async (
    dayIdx: number,
    slot: MealPlanSlot
  ) => {
    if (!user || !activePlan) return;
    setSwappingSlotType(slot.slotType);
    setActionStatus(null);
    try {
      const resp = await fetch('/api/ai/swap-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotType: slot.slotType,
          currentFoodIds: slot.dishes.map((d) => d.foodId),
          dietMode: activePlan.dietMode,
          nutritionGoal: activePlan.nutritionGoal,
          targetSlotKcal: slot.totals.energyKcal,
          budgetLevel,
          prepTimePreference,
          isUnder18,
          hasMedicalScreeningRisk,
          availableIngredients: activePlan.availableIngredients ?? [],
          excludedAllergens: profile?.allergens ?? [],
          dislikedFoods: profile?.dislikedFoods ?? [],
          customFoods: customFoodsPayload,
        }),
      });
      const data = (await resp.json()) as {
        error?: string;
        slot?: MealPlanSlot;
      };
      if (!resp.ok || !data.slot) {
        throw new Error(data.error || 'Không thể đổi cả khung bữa lúc này.');
      }

      const updatedDays = activePlan.days.map((d, idx) => {
        if (idx !== dayIdx) return d;
        const nextMeals = d.meals.map((m) =>
          m.slotType === slot.slotType ? data.slot! : m
        );
        return recalculateSlotAndDayTotals({ ...d, meals: nextMeals });
      });

      await persistUpdatedPlan(
        { days: updatedDays },
        `Đã làm mới toàn bộ ${slot.labelVi} với gợi ý từ AI.`
      );
    } catch (err) {
      setActionStatus({
        tone: 'danger',
        text:
          err instanceof Error
            ? err.message
            : 'Không thể đổi cả bữa ăn lúc này.',
      });
    } finally {
      setSwappingSlotType(null);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!user) return;
    setActionStatus(null);
    try {
      await deleteUserMealPlan(user.uid, planId);
      setActionStatus({
        tone: 'success',
        text: 'Đã xóa thực đơn đã lưu.',
      });
    } catch (err) {
      setActionStatus({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    }
  };

  const fetchSwapSuggestions = async (
    target: { dayIdx: number; slot: MealPlanSlot; dish: MealPlanDish },
    preferQuick: boolean,
    preferEconomy: boolean
  ) => {
    setSwapLoading(true);
    setSwapError(null);
    try {
      const resp = await fetch('/api/ai/swap-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotType: target.slot.slotType,
          currentFoodId: target.dish.foodId,
          currentGrams: target.dish.grams,
          dietMode: activePlan?.dietMode ?? dietMode,
          nutritionGoal: activePlan?.nutritionGoal ?? nutritionGoal,
          targetKcalPerDay: activePlan?.targetKcalPerDay ?? estimatedTargetKcal,
          isUnder18,
          hasMedicalScreeningRisk,
          preferQuickPrep: preferQuick,
          preferEconomy,
          availableIngredients: activePlan?.availableIngredients ?? [],
          excludedAllergens: profile?.allergens ?? [],
          dislikedFoods: profile?.dislikedFoods ?? [],
          customFoods: customFoodsPayload,
        }),
      });

      const data = (await resp.json()) as {
        error?: string;
        suggestions?: SwapDishSuggestion[];
      };

      if (!resp.ok || !data.suggestions) {
        throw new Error(data.error || 'Không thể tải gợi ý đổi món từ AI.');
      }

      setSwapSuggestions(data.suggestions);
    } catch (err) {
      setSwapError(
        err instanceof Error ? err.message : 'Lỗi khi gợi ý đổi món.'
      );
    } finally {
      setSwapLoading(false);
    }
  };

  const handleOpenSwap = async (
    dayIdx: number,
    slot: MealPlanSlot,
    dish: MealPlanDish
  ) => {
    const target = { dayIdx, slot, dish };
    setSwapTarget(target);
    setSwapSuggestions([]);
    setSwapPreferQuick(false);
    setSwapPreferEconomy(false);
    setSwapModalOpen(true);
    await fetchSwapSuggestions(target, false, false);
  };

  const handleConfirmSwap = async (suggestion: SwapDishSuggestion) => {
    if (!user || !activePlan || !swapTarget) return;
    const { dayIdx, slot, dish } = swapTarget;

    const updatedDays = activePlan.days.map((d, idx) => {
      if (idx !== dayIdx) return d;
      const nextMeals = d.meals.map((m) => {
        if (m.slotType !== slot.slotType) return m;
        const nextDishes = m.dishes.map((item) => {
          if (item.slotDishId !== dish.slotDishId) return item;
          return {
            slotDishId: `${item.slotDishId}-swapped-${Date.now()}`,
            foodId: suggestion.foodId,
            nameVi: suggestion.nameVi,
            category: suggestion.category,
            imagePath: suggestion.imagePath,
            grams: suggestion.grams,
            servingLabel: suggestion.servingLabel,
            nutrientsScaled: scaleNutrients(
              suggestion.nutrientsPer100g,
              suggestion.grams
            ),
            nutrientsPer100g: suggestion.nutrientsPer100g,
            verificationStatus: suggestion.verificationStatus,
            allergens: suggestion.allergens,
            ingredients: suggestion.ingredients,
            prepNote: suggestion.prepNote,
            prepTimeMinutes: suggestion.prepTimeMinutes,
            budgetTier: suggestion.budgetTier,
            aiReason: `${suggestion.aiExplanation.whyChosen} ${suggestion.aiExplanation.goalFit}`,
          };
        });
        return { ...m, dishes: nextDishes };
      });
      return recalculateSlotAndDayTotals({ ...d, meals: nextMeals });
    });

    try {
      await persistUpdatedPlan(
        { days: updatedDays },
        `Đã đổi "${dish.nameVi}" sang "${suggestion.nameVi}".`
      );
      setSwapModalOpen(false);
    } catch (err) {
      setSwapError(formatFirestoreUiErrorVi(err));
    }
  };

  const handleLogSlotToDiary = async (slot: MealPlanSlot) => {
    if (!user) return;
    setActionStatus(null);
    const todayKey = getTodayDateKey();
    try {
      const existingDoc = await getFoodDiaryDay(user.uid, todayKey);
      const existingEntries = existingDoc?.entries ?? [];
      if (
        existingEntries.length + slot.dishes.length >
        DIARY_LIMITS.MAX_ENTRIES_PER_DAY
      ) {
        setActionStatus({
          tone: 'warning',
          text: `Nhật ký hôm nay đã đạt gần giới hạn tối đa ${DIARY_LIMITS.MAX_ENTRIES_PER_DAY} món.`,
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const addedEntries: DiaryEntry[] = slot.dishes.map((dish, idx) => ({
        id: `mp-${Date.now()}-${idx}-${dish.foodId}`,
        mealType: slot.diaryMealType,
        source: 'database',
        foodId: dish.foodId,
        name: dish.nameVi,
        grams: dish.grams,
        nutrientsPer100gSnapshot: dish.nutrientsPer100g,
        verificationStatusSnapshot: dish.verificationStatus,
        loggedAt: nowIso,
      }));

      await saveFoodDiaryDay(
        user.uid,
        todayKey,
        [...existingEntries, ...addedEntries],
        Boolean(existingDoc)
      );

      setActionStatus({
        tone: 'success',
        text: `Đã ghi ${slot.dishes.length} món từ ${slot.labelVi} vào Nhật ký ăn uống hôm nay.`,
      });
    } catch (err) {
      setActionStatus({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    }
  };

  const handleAddDayToShoppingList = async (day: MealPlanDay) => {
    if (!user) return;
    setActionStatus(null);
    try {
      const existingList = await getShoppingList(user.uid);
      const currentItems = existingList?.items ?? [];
      const existingNames = new Set(
        currentItems.map((i) => i.name.toLowerCase())
      );

      const additions: ShoppingListItem[] = [];
      const nowIso = new Date().toISOString();

      for (const slot of day.meals) {
        for (const dish of slot.dishes) {
          const targets =
            dish.ingredients.length > 0 ? dish.ingredients : [dish.nameVi];
          for (const ing of targets) {
            const cleanName = ing.trim();
            if (!cleanName || existingNames.has(cleanName.toLowerCase())) {
              continue;
            }
            if (
              currentItems.length + additions.length >=
              SHOPPING_LIST_LIMITS.MAX_ITEMS
            ) {
              break;
            }
            existingNames.add(cleanName.toLowerCase());
            additions.push({
              id: `mp-shop-${Date.now()}-${additions.length}`,
              name: cleanName.slice(0, SHOPPING_LIST_LIMITS.MAX_NAME_LENGTH),
              category: dish.category,
              quantityLabel: `Từ món ${dish.nameVi}`,
              foodId: dish.foodId,
              checked: false,
              addedAt: nowIso,
            });
          }
        }
      }

      if (additions.length === 0) {
        setActionStatus({
          tone: 'warning',
          text: 'Các nguyên liệu trong ngày này đều đã có sẵn trong Danh sách đi chợ.',
        });
        return;
      }

      await saveShoppingList(
        user.uid,
        [...currentItems, ...additions],
        Boolean(existingList)
      );
      setActionStatus({
        tone: 'success',
        text: `Đã thêm ${additions.length} nguyên liệu mới vào Danh sách đi chợ.`,
      });
    } catch (err) {
      setActionStatus({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Trình lập thực đơn AI tích hợp dữ liệu Việt Nam</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Thực đơn AI cá nhân hóa
          </h1>
          <p className="text-sm text-slate-600">
            Gemini AI gợi ý kết hợp món ăn từ Kho thực phẩm Việt Nam; mọi chỉ số
            calo, đa lượng và chất xơ được tính toán trực tiếp từ cơ sở dữ liệu.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link to="/diary">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Mở Nhật ký
            </Button>
          </Link>
          <Link to="/shopping-list">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Danh sách đi chợ
            </Button>
          </Link>
        </div>
      </div>

      {isUnder18 && (
        <Alert tone="warning" title="Chế độ an toàn dưới 18 tuổi">
          Thực đơn AI cho người dưới 18 tuổi chỉ tập trung vào xây dựng bữa ăn đủ
          chất, đa dạng món Việt và thói quen lành mạnh — không áp dụng chế độ giảm
          cân hay giới hạn calo.
        </Alert>
      )}

      {/* Generator Card */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Cấu hình tạo thực đơn mới
            </h2>
            <p className="text-xs text-slate-500">
              {profile?.allergens.length
                ? `Tự động loại trừ dị ứng: ${profile.allergens.join(', ')}.`
                : 'Chưa khai báo dị ứng trong hồ sơ.'}{' '}
              {estimatedTargetKcal !== null
                ? `Mục tiêu tham khảo: ~${estimatedTargetKcal.toLocaleString('vi-VN')} kcal/ngày (Ước tính).`
                : 'Không áp đặt mục tiêu calo (ưu tiên chất lượng bữa ăn).'}
            </p>
          </div>
          <Badge tone="warning">Dữ liệu thực đơn là Ước tính học tập</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField id="mp-duration" label="Số ngày lập thực đơn">
            <Select
              id="mp-duration"
              value={String(durationDays)}
              onChange={(e) =>
                setDurationDays(Number(e.target.value) as 1 | 3 | 7)
              }
              options={[
                { value: '1', label: '1 ngày' },
                { value: '3', label: '3 ngày' },
                { value: '7', label: '7 ngày (cả tuần)' },
              ]}
            />
          </FormField>

          <FormField id="mp-meals-per-day" label="Số bữa mỗi ngày">
            <Select
              id="mp-meals-per-day"
              value={String(mealsPerDay)}
              onChange={(e) =>
                setMealsPerDay(Number(e.target.value) as 3 | 4 | 5)
              }
              options={[
                { value: '3', label: '3 bữa (Sáng · Trưa · Tối)' },
                { value: '4', label: '4 bữa (+ Bữa phụ chiều)' },
                { value: '5', label: '5 bữa (+ 2 bữa phụ sáng/chiều)' },
              ]}
            />
          </FormField>

          <FormField id="mp-diet" label="Chế độ ăn">
            <Select
              id="mp-diet"
              value={dietMode}
              onChange={(e) => setDietMode(e.target.value as DietMode)}
              options={DIET_MODE_OPTIONS.map((d) => ({
                value: d.value,
                label: d.labelVi,
              }))}
            />
          </FormField>

          <FormField id="mp-goal" label="Mục tiêu">
            <Select
              id="mp-goal"
              value={
                isUnder18 || hasMedicalScreeningRisk
                  ? 'healthy_habits'
                  : nutritionGoal
              }
              disabled={isUnder18 || hasMedicalScreeningRisk}
              onChange={(e) =>
                setNutritionGoal(e.target.value as NutritionGoalMode)
              }
              options={NUTRITION_GOAL_OPTIONS.map((g) => ({
                value: g.value,
                label: g.labelVi,
              }))}
            />
          </FormField>

          <FormField id="mp-budget" label="Ngân sách">
            <Select
              id="mp-budget"
              value={budgetLevel}
              onChange={(e) => setBudgetLevel(e.target.value as BudgetLevel)}
              options={BUDGET_LEVEL_OPTIONS.map((b) => ({
                value: b.value,
                label: b.labelVi,
              }))}
            />
          </FormField>

          <FormField id="mp-prep" label="Thời gian chế biến">
            <Select
              id="mp-prep"
              value={prepTimePreference}
              onChange={(e) =>
                setPrepTimePreference(e.target.value as PrepTimePreference)
              }
              options={PREP_TIME_OPTIONS.map((p) => ({
                value: p.value,
                label: p.labelVi,
              }))}
            />
          </FormField>
        </div>

        {/* Available Ingredients Tag Input */}
        <div className="space-y-2 border-t border-slate-200 pt-4">
          <label
            htmlFor="mp-available-ing"
            className="block text-xs font-semibold text-slate-800"
          >
            Nguyên liệu đang có sẵn tại nhà (tùy chọn — AI ưu tiên kết hợp)
          </label>
          {availableIngredients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {availableIngredients.map((ing) => (
                <span
                  key={ing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-forest-200 bg-forest-50 px-2.5 py-1 text-xs font-medium text-forest-900"
                >
                  <span>{ing}</span>
                  <button
                    type="button"
                    aria-label={`Bỏ ${ing}`}
                    onClick={() =>
                      setAvailableIngredients((prev) =>
                        prev.filter((i) => i !== ing)
                      )
                    }
                    className="text-forest-800 hover:text-red-700 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex max-w-md gap-2">
            <Input
              id="mp-available-ing"
              type="text"
              value={ingredientInput}
              onChange={(e) => setIngredientInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddAvailableIngredient();
                }
              }}
              placeholder="Ví dụ: Trứng gà, rau muống, đậu phụ..."
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddAvailableIngredient}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Thêm
            </Button>
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={hasMedicalScreeningRisk}
            onChange={(e) => setHasMedicalScreeningRisk(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-forest-800"
          />
          <span>
            Tôi đang có tình trạng sức khỏe đặc biệt / mang thai / cho con bú hoặc
            cần tránh chế độ giảm cân (chỉ tạo thực đơn thói quen lành mạnh, không lưu
            thông tin sàng lọc này lên máy chủ).
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">
            Thời gian tạo thực đơn 7 ngày thường mất 5–12 giây tùy tốc độ phản hồi
            Gemini AI.
          </p>
          <Button
            variant="primary"
            size="lg"
            isLoading={isGenerating}
            onClick={handleGeneratePlan}
            leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
          >
            {isGenerating
              ? 'Đang tạo thực đơn với Gemini AI...'
              : `Tạo thực đơn ${durationDays} ngày với Gemini AI`}
          </Button>
        </div>
      </Card>

      {plansError && <Alert tone="danger">{plansError}</Alert>}
      {actionStatus && <Alert tone={actionStatus.tone}>{actionStatus.text}</Alert>}

      {/* Saved Plans Selector */}
      {plansLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : savedPlans.length === 0 ? (
        <EmptyState
          icon={<Utensils className="h-5 w-5" aria-hidden="true" />}
          title="Bạn chưa có thực đơn AI nào được lưu"
          description="Chọn số ngày và nhấn 'Tạo thực đơn với Gemini AI' ở trên để nhận gợi ý bữa ăn Việt Nam chi tiết."
        />
      ) : (
        <div className="space-y-6">
          {/* Saved Plans Bar */}
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Thực đơn đã lưu ({savedPlans.length})
              </h2>
              {activePlan && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeletePlan(activePlan.id)}
                  leftIcon={
                    <Trash2 className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                  }
                >
                  Xóa thực đơn này
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {savedPlans.map((p) => {
                const selected = p.id === activePlan?.id;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      selected
                        ? 'border-forest-700 bg-forest-50 text-forest-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={
                        p.isFavorite ? 'Bỏ đánh dấu yêu thích' : 'Đánh dấu yêu thích'
                      }
                      onClick={() => handleToggleFavoritePlan(p)}
                      className={`cursor-pointer ${
                        p.isFavorite
                          ? 'text-amber-500'
                          : 'text-slate-300 hover:text-amber-500'
                      }`}
                    >
                      <Star
                        className={`h-4 w-4 ${p.isFavorite ? 'fill-current' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(p.id);
                        setActiveDayIndex(0);
                      }}
                      className="text-left font-medium cursor-pointer"
                    >
                      <span className="block font-semibold">{p.title}</span>
                      <span className="text-[11px] text-slate-500">
                        {p.durationDays} ngày ·{' '}
                        {p.targetKcalPerDay
                          ? `~${p.targetKcalPerDay} kcal/ngày`
                          : 'Thói quen lành mạnh'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>

          {activePlan && (
            <>
              {/* Plan Summary + Day Tabs + Nutrition Progress Bars */}
              <Card className="space-y-4">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5 flex-1">
                    {editingTitle ? (
                      <div className="flex max-w-md items-center gap-2">
                        <Input
                          type="text"
                          value={titleDraft}
                          maxLength={120}
                          onChange={(e) => setTitleDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void handleSavePlanTitle();
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={handleSavePlanTitle}
                          leftIcon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          Lưu
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingTitle(false)}
                        >
                          Hủy
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">
                          {activePlan.title}
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            setTitleDraft(activePlan.title);
                            setEditingTitle(true);
                          }}
                          aria-label="Sửa tên thực đơn"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <Badge tone="warning">Ước tính</Badge>
                      </div>
                    )}

                    {activePlan.aiSummary && (
                      <p className="text-xs leading-relaxed text-slate-600">
                        {activePlan.aiSummary}
                      </p>
                    )}
                  </div>

                  {activeDay && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddDayToShoppingList(activeDay)}
                      leftIcon={
                        <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                      }
                    >
                      Thêm nguyên liệu ngày này vào Đi chợ
                    </Button>
                  )}
                </div>

                {/* Day Selector Tabs */}
                {activePlan.days.length > 1 && (
                  <div className="flex flex-wrap gap-2">
                    {activePlan.days.map((d, idx) => (
                      <button
                        key={d.dayIndex}
                        type="button"
                        onClick={() => setActiveDayIndex(idx)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                          idx === activeDayIndex
                            ? 'border-forest-700 bg-forest-800 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {d.dayLabelVi}
                      </button>
                    ))}
                  </div>
                )}

                {/* Daily Totals Strip with Target Progress Bars */}
                {activeDay && (
                  <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:grid-cols-5">
                    {[
                      {
                        label: 'Năng lượng ngày',
                        actual: activeDay.dailyTotals.energyKcal,
                        target: activePlan.targetKcalPerDay,
                        unit: 'kcal',
                      },
                      {
                        label: 'Chất đạm',
                        actual: activeDay.dailyTotals.proteinG,
                        target: personalizedReference?.macros?.proteinG ?? null,
                        unit: 'g',
                      },
                      {
                        label: 'Tinh bột',
                        actual: activeDay.dailyTotals.carbG,
                        target: personalizedReference?.macros?.carbG ?? null,
                        unit: 'g',
                      },
                      {
                        label: 'Chất béo',
                        actual: activeDay.dailyTotals.fatG,
                        target: personalizedReference?.macros?.fatG ?? null,
                        unit: 'g',
                      },
                      {
                        label: 'Chất xơ',
                        actual: activeDay.dailyTotals.fiberG,
                        target: personalizedReference?.fiberTargetG ?? 25,
                        unit: 'g',
                      },
                    ].map((stat) => {
                      const pct =
                        stat.actual !== null && stat.target && stat.target > 0
                          ? Math.min(100, Math.round((stat.actual / stat.target) * 100))
                          : null;
                      return (
                        <div key={stat.label} className="space-y-1">
                          <span className="text-[11px] text-slate-500">
                            {stat.label}
                          </span>
                          <p className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                            {stat.actual !== null
                              ? `${stat.actual.toLocaleString('vi-VN')} ${stat.unit}`
                              : 'Chưa đủ'}
                            {stat.target && (
                              <span className="font-normal text-xs text-slate-500">
                                {' '}
                                / {stat.target.toLocaleString('vi-VN')}
                              </span>
                            )}
                          </p>
                          {pct !== null && (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-forest-700"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Meal Slots */}
              {activeDay && (
                <div className="space-y-5">
                  {activeDay.meals.map((slot) => (
                    <Card key={slot.slotType} className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-slate-900">
                              {slot.labelVi}
                            </h3>
                            <span className="font-mono text-xs font-semibold text-forest-800 tabular-nums">
                              {slot.totals.energyKcal !== null
                                ? `~${slot.totals.energyKcal} kcal`
                                : 'Chưa có dữ liệu kcal'}
                            </span>
                          </div>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                            Đạm: {slot.totals.proteinG ?? '—'}g · Carb:{' '}
                            {slot.totals.carbG ?? '—'}g · Béo:{' '}
                            {slot.totals.fatG ?? '—'}g · Xơ:{' '}
                            {slot.totals.fiberG ?? '—'}g
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={swappingSlotType === slot.slotType}
                            onClick={() =>
                              handleSwapEntireSlot(activeDayIndex, slot)
                            }
                            leftIcon={
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                            }
                          >
                            Đổi cả bữa
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleLogSlotToDiary(slot)}
                            leftIcon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
                          >
                            Xác nhận đã ăn → Ghi nhật ký
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {slot.dishes.map((dish) => (
                          <div
                            key={dish.slotDishId}
                            className="flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white"
                          >
                            <div>
                              <Link to={`/foods/${dish.foodId}`} className="block">
                                {dish.imagePath ? (
                                  <div className="aspect-[16/10] w-full overflow-hidden border-b border-slate-200 bg-slate-100">
                                    <img
                                      src={dish.imagePath}
                                      alt={dish.nameVi}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-1 border-b border-slate-200 bg-forest-50/40 px-3 text-center">
                                    <Utensils
                                      className="h-5 w-5 text-forest-700"
                                      aria-hidden="true"
                                    />
                                    <span className="text-[11px] text-slate-500">
                                      Chưa có ảnh món ăn
                                    </span>
                                  </div>
                                )}
                              </Link>

                              <div className="p-3.5 space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <Link
                                    to={`/foods/${dish.foodId}`}
                                    className="text-sm font-semibold text-slate-900 hover:text-forest-800"
                                  >
                                    {dish.nameVi}
                                  </Link>
                                  <VerificationBadge status={dish.verificationStatus} />
                                </div>

                                {/* Portion Grams Adjuster (+/- 25g) */}
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
                                  <span className="font-mono text-xs text-slate-800 tabular-nums">
                                    {dish.servingLabel} ({dish.grams}g) ·{' '}
                                    <strong>
                                      {dish.nutrientsScaled.energyKcal ?? '—'} kcal
                                    </strong>
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label={`Giảm khẩu phần ${dish.nameVi}`}
                                      onClick={() =>
                                        handleAdjustDishGrams(
                                          activeDayIndex,
                                          slot.slotType,
                                          dish,
                                          -25
                                        )
                                      }
                                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Minus className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      aria-label={`Tăng khẩu phần ${dish.nameVi}`}
                                      onClick={() =>
                                        handleAdjustDishGrams(
                                          activeDayIndex,
                                          slot.slotType,
                                          dish,
                                          25
                                        )
                                      }
                                      className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <Plus className="h-3 w-3" aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>

                                <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                                  Đạm {dish.nutrientsScaled.proteinG ?? '—'}g · Carb{' '}
                                  {dish.nutrientsScaled.carbG ?? '—'}g · Béo{' '}
                                  {dish.nutrientsScaled.fatG ?? '—'}g · Xơ{' '}
                                  {dish.nutrientsScaled.fiberG ?? '—'}g
                                </p>

                                {(dish.prepTimeMinutes || dish.budgetTier) && (
                                  <p className="text-[11px] text-slate-500">
                                    {dish.prepTimeMinutes
                                      ? `~${dish.prepTimeMinutes} phút`
                                      : ''}
                                    {dish.prepTimeMinutes && dish.budgetTier
                                      ? ' · '
                                      : ''}
                                    {dish.budgetTier
                                      ? `Chi phí ${BUDGET_TIER_SHORT_LABELS[dish.budgetTier]}`
                                      : ''}
                                  </p>
                                )}

                                {dish.ingredients.length > 0 && (
                                  <p className="text-[11px] text-slate-600 line-clamp-2">
                                    <strong>Nguyên liệu:</strong>{' '}
                                    {dish.ingredients.slice(0, 4).join(', ')}
                                  </p>
                                )}

                                <div className="rounded-lg bg-slate-50 p-2.5 text-xs space-y-1">
                                  <div className="flex items-start gap-1.5 text-slate-700">
                                    <ChefHat
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-700"
                                      aria-hidden="true"
                                    />
                                    <span>{dish.prepNote}</span>
                                  </div>
                                  <div className="flex items-start gap-1.5 text-slate-600">
                                    <Info
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700"
                                      aria-hidden="true"
                                    />
                                    <span>{dish.aiReason}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-3.5 py-2">
                              <Link
                                to={`/foods/${dish.foodId}`}
                                className="text-xs font-medium text-forest-800 hover:underline"
                              >
                                Chi tiết &amp; So sánh
                              </Link>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleOpenSwap(activeDayIndex, slot, dish)
                                }
                                leftIcon={
                                  <ArrowLeftRight
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                }
                              >
                                Đổi món
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* AI Swap Meal Modal */}
      <Modal
        open={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        title={
          swapTarget
            ? `Đổi món: ${swapTarget.dish.nameVi} (${swapTarget.slot.labelVi})`
            : 'Gợi ý món ăn thay thế'
        }
        description="Các lựa chọn dưới đây đã loại trừ chất gây dị ứng trong hồ sơ của bạn và tính dinh dưỡng trực tiếp từ Kho thực phẩm."
        maxWidthClass="max-w-3xl"
      >
        <div className="space-y-4">
          {swapTarget && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-700">
                Món hiện tại:{' '}
                <strong>{swapTarget.dish.nameVi}</strong> (
                <span className="font-mono tabular-nums">
                  {swapTarget.dish.nutrientsScaled.energyKcal ?? '—'} kcal · Đạm{' '}
                  {swapTarget.dish.nutrientsScaled.proteinG ?? '—'}g
                </span>
                )
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !swapPreferQuick;
                    setSwapPreferQuick(next);
                    void fetchSwapSuggestions(swapTarget, next, swapPreferEconomy);
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    swapPreferQuick
                      ? 'border-forest-700 bg-forest-50 text-forest-900'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  Dễ nấu hơn
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !swapPreferEconomy;
                    setSwapPreferEconomy(next);
                    void fetchSwapSuggestions(swapTarget, swapPreferQuick, next);
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                    swapPreferEconomy
                      ? 'border-forest-700 bg-forest-50 text-forest-900'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <Coins className="h-3 w-3" aria-hidden="true" />
                  Tiết kiệm hơn
                </button>
              </div>
            </div>
          )}

          {swapError && <Alert tone="danger">{swapError}</Alert>}

          {swapLoading ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Gemini AI đang chọn món thay thế phù hợp...</span>
              </div>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </div>
          ) : (
            <div className="space-y-3">
              {swapSuggestions.map((sug) => {
                const origKcal = swapTarget?.dish.nutrientsScaled.energyKcal ?? null;
                const sugKcal = sug.nutrientsScaled.energyKcal;
                const deltaKcal =
                  origKcal !== null && sugKcal !== null ? sugKcal - origKcal : null;

                return (
                  <div
                    key={sug.foodId}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row"
                  >
                    {sug.imagePath ? (
                      <img
                        src={sug.imagePath}
                        alt={sug.nameVi}
                        className="h-24 w-32 shrink-0 rounded-lg object-cover border border-slate-200"
                      />
                    ) : (
                      <div className="flex h-24 w-32 shrink-0 flex-col items-center justify-center rounded-lg border border-slate-200 bg-forest-50/40 text-center">
                        <Utensils
                          className="h-5 w-5 text-forest-700"
                          aria-hidden="true"
                        />
                        <span className="text-[10px] text-slate-500">
                          Chưa có ảnh
                        </span>
                      </div>
                    )}

                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">
                              {sug.nameVi}
                            </h4>
                            <VerificationBadge status={sug.verificationStatus} />
                          </div>
                          <p className="font-mono text-xs text-forest-800 tabular-nums">
                            {sug.servingLabel} ({sug.grams}g) ·{' '}
                            {sugKcal ?? '—'} kcal
                            {deltaKcal !== null && (
                              <span className="text-slate-500">
                                {' '}
                                ({deltaKcal > 0 ? `+${deltaKcal}` : deltaKcal} kcal)
                              </span>
                            )}{' '}
                            · Đạm {sug.nutrientsScaled.proteinG ?? '—'}g
                            {sug.prepTimeMinutes
                              ? ` · ~${sug.prepTimeMinutes}p`
                              : ''}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleConfirmSwap(sug)}
                        >
                          Chọn thay thế
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
                        <p>
                          <strong>Lý do chọn:</strong> {sug.aiExplanation.whyChosen}
                        </p>
                        <p>
                          <strong>Dinh dưỡng chính:</strong>{' '}
                          {sug.aiExplanation.keyNutrients}
                        </p>
                        <p>
                          <strong>Phù hợp mục tiêu:</strong>{' '}
                          {sug.aiExplanation.goalFit}
                        </p>
                        <p className="flex items-start gap-1 text-amber-800">
                          <ShieldAlert
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{sug.aiExplanation.caution}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <DisclaimerBanner />
    </div>
  );
}
