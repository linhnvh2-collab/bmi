import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Plus } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Skeleton,
  Tabs,
} from '@/src/components/ui';
import {
  PortionCalculator,
  SearchInput,
  VerificationBadge,
} from '@/src/features/foods/components';
import { MEAL_TYPE_OPTIONS } from '@/src/lib/diary';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import { fetchFoods } from '@/src/lib/firebase/foodsService';
import {
  ALLERGEN_DISCLAIMER_VI,
  findMatchingAllergens,
  FOOD_CATEGORY_LABELS,
  scaleNutrients,
  searchFoods,
} from '@/src/lib/nutrition';
import {
  customDiaryEntrySchema,
  type CustomDiaryEntryValues,
} from '@/src/lib/validation/schemas';
import type { FoodItem, NutrientsPer100g } from '@/src/types/food';
import type { DiaryEntry, MealType } from '@/src/types/stage3';

interface AddDiaryEntryModalProps {
  open: boolean;
  initialMealType: MealType;
  userAllergens: string[];
  onClose: () => void;
  onAddEntry: (entry: DiaryEntry) => Promise<void>;
}

type ModalTab = 'database' | 'custom';

function createEntryId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AddDiaryEntryModal({
  open,
  initialMealType,
  userAllergens,
  onClose,
  onAddEntry,
}: AddDiaryEntryModalProps) {
  const [tab, setTab] = useState<ModalTab>('database');
  const [mealType, setMealType] = useState<MealType>(initialMealType);

  // Database search state
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [foodsError, setFoodsError] = useState<string | null>(null);
  const [queryText, setQueryText] = useState('');
  const [includeUnverified, setIncludeUnverified] = useState(true);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [portionGrams, setPortionGrams] = useState<number | null>(null);
  const [scaledPreview, setScaledPreview] = useState<NutrientsPer100g | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const customForm = useForm<CustomDiaryEntryValues>({
    resolver: zodResolver(
      customDiaryEntrySchema
    ) as Resolver<CustomDiaryEntryValues>,
    defaultValues: {
      mealType: initialMealType,
      name: '',
      grams: 100,
      energyKcal: null,
      proteinG: null,
      fatG: null,
      carbG: null,
    },
  });

  useEffect(() => {
    if (!open) return;
    setMealType(initialMealType);
    setSelectedFood(null);
    setPortionGrams(null);
    setScaledPreview(null);
    setSubmitError(null);
    customForm.reset({
      mealType: initialMealType,
      name: '',
      grams: 100,
      energyKcal: null,
      proteinG: null,
      fatG: null,
      carbG: null,
    });
  }, [open, initialMealType, customForm]);

  useEffect(() => {
    if (!open || foods.length > 0) return;
    let active = true;
    const load = async () => {
      setFoodsLoading(true);
      setFoodsError(null);
      try {
        const items = await fetchFoods({ includeInactive: false });
        if (active) setFoods(items);
      } catch (err) {
        if (active) setFoodsError(formatFirestoreUiErrorVi(err));
      } finally {
        if (active) setFoodsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [open, foods.length]);

  const filteredFoods = useMemo(
    () =>
      searchFoods(foods, queryText, {
        includeUnverified,
      }).slice(0, 20),
    [foods, queryText, includeUnverified]
  );

  const matchedAllergens = useMemo(() => {
    if (!selectedFood) return [];
    return findMatchingAllergens(selectedFood.allergens, userAllergens);
  }, [selectedFood, userAllergens]);

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
    const defaultGrams =
      food.servingUnits.length > 0 ? food.servingUnits[0].grams : 100;
    setPortionGrams(defaultGrams);
    setScaledPreview(scaleNutrients(food.nutrientsPer100g, defaultGrams));
    setSubmitError(null);
  };

  const handleConfirmDatabaseEntry = async () => {
    if (!selectedFood || !portionGrams || portionGrams <= 0) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const entry: DiaryEntry = {
        id: createEntryId(),
        mealType,
        source: 'database',
        foodId: selectedFood.id,
        name: selectedFood.nameVi,
        grams: Math.round(portionGrams * 10) / 10,
        nutrientsPer100gSnapshot: { ...selectedFood.nutrientsPer100g },
        verificationStatusSnapshot: selectedFood.verificationStatus,
        loggedAt: new Date().toISOString(),
      };
      await onAddEntry(entry);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : formatFirestoreUiErrorVi(err)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmCustomEntry = async (values: CustomDiaryEntryValues) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const entry: DiaryEntry = {
        id: createEntryId(),
        mealType: values.mealType,
        source: 'custom',
        foodId: null,
        name: values.name.trim(),
        grams: Math.round(values.grams * 10) / 10,
        nutrientsPer100gSnapshot: {
          energyKcal: values.energyKcal ?? null,
          proteinG: values.proteinG ?? null,
          fatG: values.fatG ?? null,
          carbG: values.carbG ?? null,
          fiberG: null,
          sugarG: null,
          sodiumMg: null,
        },
        verificationStatusSnapshot: 'unverified',
        loggedAt: new Date().toISOString(),
      };
      await onAddEntry(entry);
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : formatFirestoreUiErrorVi(err)
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm món vào nhật ký"
      description="Chọn từ Kho thực phẩm Việt Nam hoặc tự nhập món ngoài danh mục."
      maxWidthClass="max-w-2xl"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onChange={(val) => {
              setTab(val);
              setSubmitError(null);
            }}
            items={[
              {
                value: 'database',
                label: 'Từ Kho thực phẩm',
              },
              {
                value: 'custom',
                label: 'Tự nhập (chưa xác minh)',
              },
            ]}
          />

          {tab === 'database' && (
            <div className="w-44">
              <Select
                aria-label="Chọn bữa ăn"
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
                options={MEAL_TYPE_OPTIONS.map((m) => ({
                  value: m.value,
                  label: m.labelVi,
                }))}
              />
            </div>
          )}
        </div>

        {submitError && <Alert tone="danger">{submitError}</Alert>}

        {tab === 'database' ? (
          <div className="space-y-4">
            {!selectedFood ? (
              <>
                <div className="space-y-2.5">
                  <SearchInput
                    value={queryText}
                    onChange={setQueryText}
                    placeholder="Tìm món ăn (ví dụ: pho bo, com tam, rau muong)..."
                  />
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUnverified}
                      onChange={(e) => setIncludeUnverified(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-forest-800 focus:ring-forest-600"
                    />
                    <span>Bao gồm cả món Ước tính / Chưa xác minh</span>
                  </label>
                </div>

                {foodsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                  </div>
                ) : foodsError ? (
                  <Alert tone="danger">{foodsError}</Alert>
                ) : filteredFoods.length === 0 ? (
                  <Alert tone="info" title="Không tìm thấy món phù hợp">
                    {foods.length === 0
                      ? 'Kho thực phẩm hiện chưa có dữ liệu nào. Bạn có thể chuyển sang tab "Tự nhập (chưa xác minh)" để ghi nhận món ăn.'
                      : 'Thử từ khóa không dấu khác hoặc chuyển sang tab "Tự nhập (chưa xác minh)".'}
                  </Alert>
                ) : (
                  <ul className="max-h-72 divide-y divide-slate-200 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                    {filteredFoods.map((food) => (
                      <li key={food.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectFood(food)}
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-forest-50/50 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {food.nameVi}
                            </p>
                            <p className="text-xs text-slate-500">
                              {FOOD_CATEGORY_LABELS[food.category]} ·{' '}
                              {food.nutrientsPer100g.energyKcal !== null
                                ? `${food.nutrientsPer100g.energyKcal} kcal/100g`
                                : 'Chưa có dữ liệu năng lượng'}
                            </p>
                          </div>
                          <VerificationBadge status={food.verificationStatus} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {selectedFood.nameVi}
                      </h3>
                      <VerificationBadge status={selectedFood.verificationStatus} />
                    </div>
                    <p className="text-xs text-slate-500">
                      {FOOD_CATEGORY_LABELS[selectedFood.category]}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFood(null)}
                  >
                    Chọn món khác
                  </Button>
                </div>

                {/* Allergen Warning BEFORE Adding */}
                {matchedAllergens.length > 0 && (
                  <Alert
                    tone="danger"
                    title="Cảnh báo dị ứng trùng với hồ sơ cá nhân"
                  >
                    <p>
                      Món ăn này có chứa chất gây dị ứng bạn đã khai báo:{' '}
                      <strong>{matchedAllergens.join(', ')}</strong>. Hãy cân nhắc
                      trước khi thêm vào nhật ký.
                    </p>
                    <p className="mt-1 text-xs">{ALLERGEN_DISCLAIMER_VI}</p>
                  </Alert>
                )}

                {!selectedFood.allergensReviewed && (
                  <Alert
                    tone="warning"
                    title="Thông tin dị ứng chưa được rà soát đầy đủ"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className="h-4 w-4 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <span>{ALLERGEN_DISCLAIMER_VI}</span>
                    </div>
                  </Alert>
                )}

                <PortionCalculator
                  servingUnits={selectedFood.servingUnits}
                  nutrientsPer100g={selectedFood.nutrientsPer100g}
                  onPortionChange={(g, scaled) => {
                    setPortionGrams(g);
                    setScaledPreview(scaled);
                  }}
                />

                {scaledPreview && portionGrams && (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Ước tính cho{' '}
                      <strong className="font-mono">{portionGrams} g</strong>:
                    </span>
                    <span className="font-mono font-semibold text-forest-900 tabular-nums">
                      {scaledPreview.energyKcal !== null
                        ? `${scaledPreview.energyKcal} kcal`
                        : 'Chưa có dữ liệu kcal'}{' '}
                      · Đạm:{' '}
                      {scaledPreview.proteinG !== null
                        ? `${scaledPreview.proteinG}g`
                        : '—'}{' '}
                      · Béo:{' '}
                      {scaledPreview.fatG !== null ? `${scaledPreview.fatG}g` : '—'} ·
                      Carb:{' '}
                      {scaledPreview.carbG !== null
                        ? `${scaledPreview.carbG}g`
                        : '—'}
                    </span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                    Hủy
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleConfirmDatabaseEntry}
                    isLoading={isSubmitting}
                    disabled={!portionGrams || portionGrams <= 0}
                    leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                  >
                    Thêm vào nhật ký
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form
            onSubmit={customForm.handleSubmit(handleConfirmCustomEntry)}
            noValidate
            className="space-y-4"
          >
            <Alert tone="warning" title="Tự nhập — chưa xác minh">
              Món tự nhập chỉ lưu trong nhật ký cá nhân của bạn, luôn được gắn nhãn{' '}
              <strong>&ldquo;Tự nhập — chưa xác minh&rdquo;</strong> và không trộn vào
              Kho thực phẩm Việt Nam. Các ô dinh dưỡng để trống sẽ được giữ là{' '}
              <em>&ldquo;Chưa có dữ liệu&rdquo;</em> (không tự tính bằng 0).
            </Alert>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="custom-meal"
                label="Bữa ăn"
                required
                error={customForm.formState.errors.mealType?.message}
              >
                <Select
                  id="custom-meal"
                  options={MEAL_TYPE_OPTIONS.map((m) => ({
                    value: m.value,
                    label: m.labelVi,
                  }))}
                  {...customForm.register('mealType')}
                />
              </FormField>

              <FormField
                id="custom-grams"
                label="Khối lượng khẩu phần"
                required
                error={customForm.formState.errors.grams?.message}
              >
                <Input
                  id="custom-grams"
                  type="text"
                  inputMode="decimal"
                  unitLabel="g"
                  hasError={Boolean(customForm.formState.errors.grams)}
                  {...customForm.register('grams')}
                />
              </FormField>
            </div>

            <FormField
              id="custom-name"
              label="Tên món ăn"
              required
              error={customForm.formState.errors.name?.message}
            >
              <Input
                id="custom-name"
                placeholder="Ví dụ: Bánh mì ốp la tự làm"
                hasError={Boolean(customForm.formState.errors.name)}
                {...customForm.register('name')}
              />
            </FormField>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-700">
                  Thông tin dinh dưỡng trên 100g (tùy chọn — để trống nếu chưa rõ)
                </p>
                <Badge tone="neutral">Chưa xác minh</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <FormField
                  id="custom-kcal"
                  label="Năng lượng (kcal)"
                  error={customForm.formState.errors.energyKcal?.message}
                >
                  <Input
                    id="custom-kcal"
                    type="text"
                    inputMode="decimal"
                    placeholder="Trống = chưa rõ"
                    hasError={Boolean(customForm.formState.errors.energyKcal)}
                    {...customForm.register('energyKcal')}
                  />
                </FormField>
                <FormField
                  id="custom-protein"
                  label="Đạm (g)"
                  error={customForm.formState.errors.proteinG?.message}
                >
                  <Input
                    id="custom-protein"
                    type="text"
                    inputMode="decimal"
                    placeholder="Trống"
                    hasError={Boolean(customForm.formState.errors.proteinG)}
                    {...customForm.register('proteinG')}
                  />
                </FormField>
                <FormField
                  id="custom-fat"
                  label="Béo (g)"
                  error={customForm.formState.errors.fatG?.message}
                >
                  <Input
                    id="custom-fat"
                    type="text"
                    inputMode="decimal"
                    placeholder="Trống"
                    hasError={Boolean(customForm.formState.errors.fatG)}
                    {...customForm.register('fatG')}
                  />
                </FormField>
                <FormField
                  id="custom-carb"
                  label="Tinh bột (g)"
                  error={customForm.formState.errors.carbG?.message}
                >
                  <Input
                    id="custom-carb"
                    type="text"
                    inputMode="decimal"
                    placeholder="Trống"
                    hasError={Boolean(customForm.formState.errors.carbG)}
                    {...customForm.register('carbG')}
                  />
                </FormField>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                Lưu món tự nhập
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
