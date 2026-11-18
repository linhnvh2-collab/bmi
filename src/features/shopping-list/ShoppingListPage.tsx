import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CheckSquare,
  Copy,
  Database,
  Plus,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
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
import { SearchInput } from '@/src/features/foods/components';
import { SHOPPING_LIST_LIMITS } from '@/src/lib/diary';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import { fetchFoods } from '@/src/lib/firebase/foodsService';
import {
  saveShoppingList,
  subscribeShoppingList,
} from '@/src/lib/firebase/shoppingListService';
import {
  FOOD_CATEGORY_LABELS,
  FOOD_CATEGORY_OPTIONS,
  searchFoods,
} from '@/src/lib/nutrition';
import {
  shoppingItemSchema,
  type ShoppingItemValues,
} from '@/src/lib/validation/schemas';
import type { FoodCategory, FoodItem } from '@/src/types/food';
import type { ShoppingListDoc, ShoppingListItem } from '@/src/types/stage3';

function createItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `shop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const CATEGORY_SELECT_OPTIONS: Array<{
  value: FoodCategory | 'other';
  label: string;
}> = [
  ...FOOD_CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.labelVi })),
  { value: 'other', label: 'Khác' },
];

export function ShoppingListPage() {
  const { user } = useAuth();
  const [listDoc, setListDoc] = useState<ShoppingListDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const [clearModalOpen, setClearModalOpen] = useState(false);

  // Optional food database picker
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [foodQuery, setFoodQuery] = useState('');
  const [showFoodPicker, setShowFoodPicker] = useState(false);

  const form = useForm<ShoppingItemValues>({
    resolver: zodResolver(shoppingItemSchema) as Resolver<ShoppingItemValues>,
    defaultValues: {
      name: '',
      category: 'vegetables',
      quantityLabel: '',
    },
  });

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeShoppingList(
      user.uid,
      (docData) => {
        setListDoc(docData);
        setLoading(false);
      },
      (err) => {
        setLoadError(formatFirestoreUiErrorVi(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!showFoodPicker || foods.length > 0) return;
    let active = true;
    const load = async () => {
      setFoodsLoading(true);
      try {
        const items = await fetchFoods({ includeInactive: false });
        if (active) setFoods(items);
      } catch {
        // Bỏ qua lỗi tĩnh ở bộ gợi ý phụ, người dùng vẫn nhập tay được
      } finally {
        if (active) setFoodsLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [showFoodPicker, foods.length]);

  const items = useMemo(() => listDoc?.items ?? [], [listDoc]);
  const checkedCount = useMemo(
    () => items.filter((item) => item.checked).length,
    [items]
  );

  const groupedItems = useMemo(() => {
    const map = new Map<FoodCategory | 'other', ShoppingListItem[]>();
    for (const item of items) {
      const existing = map.get(item.category) ?? [];
      existing.push(item);
      map.set(item.category, existing);
    }
    return Array.from(map.entries());
  }, [items]);

  const matchedFoods = useMemo(
    () =>
      searchFoods(foods, foodQuery, {
        includeUnverified: true,
      }).slice(0, 12),
    [foods, foodQuery]
  );

  const persistItems = async (
    nextItems: ShoppingListItem[],
    successText?: string
  ) => {
    if (!user) return;
    setSaving(true);
    setFeedback(null);
    try {
      await saveShoppingList(user.uid, nextItems, Boolean(listDoc));
      if (successText) {
        setFeedback({ tone: 'success', text: successText });
      }
    } catch (err) {
      setFeedback({
        tone: 'danger',
        text:
          err instanceof Error ? err.message : formatFirestoreUiErrorVi(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddManualItem = async (values: ShoppingItemValues) => {
    if (items.length >= SHOPPING_LIST_LIMITS.MAX_ITEMS) {
      setFeedback({
        tone: 'danger',
        text: `Danh sách hỗ trợ tối đa ${SHOPPING_LIST_LIMITS.MAX_ITEMS} mục.`,
      });
      return;
    }

    const nextItem: ShoppingListItem = {
      id: createItemId(),
      name: values.name.trim(),
      category: values.category,
      quantityLabel: values.quantityLabel.trim(),
      foodId: null,
      checked: false,
      addedAt: new Date().toISOString(),
    };

    await persistItems([nextItem, ...items], `Đã thêm "${nextItem.name}".`);
    form.reset({
      name: '',
      category: values.category,
      quantityLabel: '',
    });
  };

  const handleAddFromDatabase = async (food: FoodItem) => {
    if (items.length >= SHOPPING_LIST_LIMITS.MAX_ITEMS) {
      setFeedback({
        tone: 'danger',
        text: `Danh sách hỗ trợ tối đa ${SHOPPING_LIST_LIMITS.MAX_ITEMS} mục.`,
      });
      return;
    }

    const defaultQuantity =
      food.servingUnits.length > 0 ? food.servingUnits[0].label : '';

    const nextItem: ShoppingListItem = {
      id: createItemId(),
      name: food.nameVi,
      category: food.category,
      quantityLabel: defaultQuantity,
      foodId: food.id,
      checked: false,
      addedAt: new Date().toISOString(),
    };

    await persistItems(
      [nextItem, ...items],
      `Đã thêm "${food.nameVi}" vào danh sách đi chợ.`
    );
  };

  const handleToggleChecked = async (itemId: string) => {
    const next = items.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    await persistItems(next);
  };

  const handleDeleteItem = async (itemId: string) => {
    const next = items.filter((item) => item.id !== itemId);
    await persistItems(next);
  };

  const handleClearChecked = async () => {
    const next = items.filter((item) => !item.checked);
    await persistItems(next, 'Đã dọn các mục đã đánh dấu mua xong.');
  };

  const handleClearAll = async () => {
    await persistItems([], 'Đã xóa toàn bộ danh sách mua sắm.');
    setClearModalOpen(false);
  };

  const handleCopyPlainText = async () => {
    if (items.length === 0) return;
    const lines = items.map(
      (item) =>
        `${item.checked ? '[x]' : '[ ]'} ${item.name}${
          item.quantityLabel ? ` (${item.quantityLabel})` : ''
        }`
    );
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setFeedback({
        tone: 'success',
        text: 'Đã sao chép danh sách mua sắm vào bộ nhớ tạm.',
      });
    } catch {
      setFeedback({
        tone: 'danger',
        text: 'Trình duyệt không cho phép sao chép tự động.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Danh sách đi chợ &amp; mua sắm
          </h1>
          <p className="text-sm text-slate-600">
            Ghi chú thực phẩm cần chuẩn bị, nhóm theo danh mục và đánh dấu khi đã mua.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFoodPicker((prev) => !prev)}
            leftIcon={<Database className="h-4 w-4" aria-hidden="true" />}
          >
            {showFoodPicker ? 'Ẩn gợi ý từ Kho' : 'Chọn từ Kho thực phẩm'}
          </Button>
          {items.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyPlainText}
              leftIcon={<Copy className="h-4 w-4" aria-hidden="true" />}
            >
              Sao chép
            </Button>
          )}
        </div>
      </div>

      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {/* Add Item Card */}
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">
          Thêm thực phẩm cần mua
        </h2>

        <form
          onSubmit={form.handleSubmit(handleAddManualItem)}
          noValidate
          className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end"
        >
          <div className="sm:col-span-5">
            <FormField
              id="shop-name"
              label="Tên thực phẩm"
              required
              error={form.formState.errors.name?.message}
            >
              <Input
                id="shop-name"
                placeholder="Ví dụ: Rau muống, Ức gà, Đậu hũ..."
                hasError={Boolean(form.formState.errors.name)}
                {...form.register('name')}
              />
            </FormField>
          </div>

          <div className="sm:col-span-3">
            <FormField
              id="shop-qty"
              label="Số lượng (tùy chọn)"
              error={form.formState.errors.quantityLabel?.message}
            >
              <Input
                id="shop-qty"
                placeholder="500 g, 2 bó..."
                hasError={Boolean(form.formState.errors.quantityLabel)}
                {...form.register('quantityLabel')}
              />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <FormField id="shop-cat" label="Nhóm">
              <Select
                id="shop-cat"
                options={CATEGORY_SELECT_OPTIONS}
                {...form.register('category')}
              />
            </FormField>
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={saving}
              leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
            >
              Thêm
            </Button>
          </div>
        </form>

        {showFoodPicker && (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-700">
              Chọn nhanh từ Kho thực phẩm Việt Nam:
            </p>
            <SearchInput
              value={foodQuery}
              onChange={setFoodQuery}
              placeholder="Tìm món ăn hoặc nguyên liệu..."
            />
            {foodsLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : matchedFoods.length === 0 ? (
              <p className="text-xs text-slate-500">
                {foods.length === 0
                  ? 'Kho thực phẩm hiện chưa có dữ liệu. Bạn có thể tự nhập tên thực phẩm ở biểu mẫu phía trên.'
                  : 'Không có món khớp từ khóa tìm kiếm.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {matchedFoods.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    disabled={saving}
                    onClick={() => handleAddFromDatabase(food)}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-left text-xs hover:border-forest-500 hover:bg-forest-50/50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {food.nameVi}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {FOOD_CATEGORY_LABELS[food.category]}
                      </p>
                    </div>
                    <Plus className="h-4 w-4 shrink-0 text-forest-700" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Shopping List View */}
      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-5 w-5" aria-hidden="true" />}
          title="Danh sách mua sắm đang trống"
          description="Thêm các nguyên liệu bạn cần chuẩn bị bằng khung nhập phía trên hoặc chọn từ Kho thực phẩm."
        />
      ) : (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="text-xs text-slate-600">
              Tổng cộng <strong className="text-slate-900">{items.length}</strong>{' '}
              mục · Đã mua{' '}
              <strong className="text-forest-800">{checkedCount}</strong> mục
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {checkedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearChecked}
                  disabled={saving}
                  leftIcon={<CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Xóa mục đã mua
                </Button>
              )}
              <Button
                variant="danger"
                size="sm"
                onClick={() => setClearModalOpen(true)}
                disabled={saving}
                leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Xóa tất cả
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {groupedItems.map(([categoryKey, categoryItems]) => {
              const categoryLabel =
                categoryKey === 'other'
                  ? 'Khác'
                  : FOOD_CATEGORY_LABELS[categoryKey];
              return (
                <div
                  key={categoryKey}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      {categoryLabel}
                    </h3>
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      {categoryItems.length}
                    </span>
                  </div>

                  <ul className="space-y-2">
                    {categoryItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <label className="flex min-w-0 flex-1 items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.checked}
                            disabled={saving}
                            onChange={() => handleToggleChecked(item.id)}
                            className="h-4 w-4 shrink-0 rounded border-slate-300 text-forest-800 focus:ring-forest-600"
                          />
                          <div className="min-w-0">
                            <p
                              className={`truncate text-sm font-medium ${
                                item.checked
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900'
                              }`}
                            >
                              {item.name}
                            </p>
                            {item.quantityLabel && (
                              <p className="text-xs text-slate-500">
                                {item.quantityLabel}
                              </p>
                            )}
                          </div>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id)}
                          disabled={saving}
                          aria-label={`Xóa ${item.name}`}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <DisclaimerBanner compact />

      <Modal
        open={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        title="Xóa toàn bộ danh sách mua sắm?"
        description="Hành động này sẽ xóa hết các mục hiện có trong danh sách đi chợ của bạn."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setClearModalOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button
              variant="danger"
              onClick={handleClearAll}
              isLoading={saving}
            >
              Xác nhận xóa hết
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Bạn có thể thêm lại các món mới bất cứ lúc nào.
        </p>
      </Modal>
    </div>
  );
}
