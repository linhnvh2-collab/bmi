import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
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
  Input,
  Skeleton,
} from '@/src/components/ui';
import { VerificationBadge } from '@/src/features/foods/components';
import {
  DIARY_LIMITS,
  MEAL_TYPE_OPTIONS,
  sumDiaryNutrients,
} from '@/src/lib/diary';
import {
  saveFoodDiaryDay,
  subscribeFoodDiaryDay,
} from '@/src/lib/firebase/diaryService';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import {
  calculateAgeFromBirthYear,
  formatDisplayDateKeyVi,
  getTodayDateKey,
  shiftDateKey,
} from '@/src/lib/format/date';
import { NUTRIENT_PLAUSIBILITY_LIMITS, scaleNutrients } from '@/src/lib/nutrition';
import type { NutrientKey } from '@/src/types/food';
import type { DiaryEntry, FoodDiaryDay, MealType } from '@/src/types/stage3';
import { AddDiaryEntryModal } from './AddDiaryEntryModal';

const SUMMARY_NUTRIENTS: Array<{
  key: NutrientKey;
  labelVi: string;
  unit: string;
}> = [
  { key: 'energyKcal', labelVi: 'Năng lượng', unit: 'kcal' },
  { key: 'proteinG', labelVi: 'Chất đạm', unit: 'g' },
  { key: 'fatG', labelVi: 'Chất béo', unit: 'g' },
  { key: 'carbG', labelVi: 'Tinh bột', unit: 'g' },
  { key: 'fiberG', labelVi: 'Chất xơ', unit: 'g' },
  { key: 'sodiumMg', labelVi: 'Natri', unit: 'mg' },
];

export function FoodDiaryPage() {
  const { user, profile, currentGoal } = useAuth();
  const [dateKey, setDateKey] = useState<string>(() => getTodayDateKey());
  const [diaryDoc, setDiaryDoc] = useState<FoodDiaryDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMealType, setModalMealType] = useState<MealType>('breakfast');

  // Inline grams edit state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingGramsRaw, setEditingGramsRaw] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingDay, setSavingDay] = useState(false);

  const profileAge = profile
    ? calculateAgeFromBirthYear(profile.birthYear)
    : null;
  const isUnder18 = profileAge !== null && profileAge < 18;

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    setEditingEntryId(null);

    const unsubscribe = subscribeFoodDiaryDay(
      user.uid,
      dateKey,
      (docData) => {
        setDiaryDoc(docData);
        setLoading(false);
      },
      (err) => {
        setLoadError(formatFirestoreUiErrorVi(err));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, dateKey]);

  const entries = useMemo(() => diaryDoc?.entries ?? [], [diaryDoc]);
  const summary = useMemo(() => sumDiaryNutrients(entries), [entries]);

  const entriesByMeal = useMemo(() => {
    const grouped: Record<MealType, DiaryEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const entry of entries) {
      grouped[entry.mealType]?.push(entry);
    }
    return grouped;
  }, [entries]);

  const persistEntries = async (nextEntries: DiaryEntry[], successText: string) => {
    if (!user) return;
    setSavingDay(true);
    setActionMessage(null);
    try {
      await saveFoodDiaryDay(user.uid, dateKey, nextEntries, Boolean(diaryDoc));
      setActionMessage({ tone: 'success', text: successText });
    } catch (err) {
      setActionMessage({
        tone: 'danger',
        text:
          err instanceof Error ? err.message : formatFirestoreUiErrorVi(err),
      });
    } finally {
      setSavingDay(false);
    }
  };

  const handleAddEntry = async (newEntry: DiaryEntry) => {
    if (entries.length >= DIARY_LIMITS.MAX_ENTRIES_PER_DAY) {
      throw new Error(
        `Nhật ký ngày đã đạt giới hạn tối đa ${DIARY_LIMITS.MAX_ENTRIES_PER_DAY} món.`
      );
    }
    const next = [...entries, newEntry];
    await persistEntries(next, `Đã thêm "${newEntry.name}" vào nhật ký.`);
  };

  const handleDeleteEntry = async (entryId: string, entryName: string) => {
    const next = entries.filter((item) => item.id !== entryId);
    await persistEntries(next, `Đã xóa "${entryName}" khỏi nhật ký.`);
  };

  const startEditGrams = (entry: DiaryEntry) => {
    setEditingEntryId(entry.id);
    setEditingGramsRaw(String(entry.grams));
    setEditError(null);
  };

  const handleSaveGrams = async (entryId: string) => {
    const parsed = Number(editingGramsRaw.replace(',', '.'));
    if (
      !editingGramsRaw.trim() ||
      !Number.isFinite(parsed) ||
      parsed <= 0 ||
      parsed > NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax
    ) {
      setEditError(
        `Khối lượng phải lớn hơn 0 và tối đa ${NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax} g.`
      );
      return;
    }

    const rounded = Math.round(parsed * 10) / 10;
    const next = entries.map((item) =>
      item.id === entryId ? { ...item, grams: rounded } : item
    );
    setEditingEntryId(null);
    setEditError(null);
    await persistEntries(next, 'Đã cập nhật khối lượng khẩu phần.');
  };

  const todayKey = getTodayDateKey();
  const energySum = summary.byNutrient.energyKcal;
  const showAdultGoalBar =
    !isUnder18 &&
    currentGoal !== null &&
    currentGoal.targetKcal !== null &&
    currentGoal.targetKcal > 0;

  return (
    <div className="space-y-6">
      {/* Header + Date Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Nhật ký ăn uống
          </h1>
          <p className="text-sm text-slate-600">
            Ghi nhận các món ăn trong ngày và xem tổng dinh dưỡng trung thực với dữ liệu
            hiện có.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Ngày trước"
            onClick={() => setDateKey((prev) => shiftDateKey(prev, -1))}
            leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Trước
          </Button>

          <div className="relative flex items-center">
            <CalendarDays
              className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="date"
              aria-label="Chọn ngày nhật ký"
              value={dateKey}
              onChange={(e) => {
                if (e.target.value) setDateKey(e.target.value);
              }}
              className="h-9 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-medium text-slate-800 focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-600/20"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            aria-label="Ngày sau"
            onClick={() => setDateKey((prev) => shiftDateKey(prev, 1))}
          >
            <span>Sau</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          {dateKey !== todayKey && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDateKey(todayKey)}
            >
              Hôm nay
            </Button>
          )}
        </div>
      </div>

      {isUnder18 && (
        <Alert
          tone="warning"
          title="Chế độ giới hạn (dưới 18 tuổi)"
        >
          Bạn có thể dùng nhật ký để ghi nhận món ăn và tìm hiểu thành phần dinh dưỡng
          từng món. Ứng dụng không hiển thị mục tiêu calo, không so sánh với TDEE hay
          đưa ra nhận xét thiếu/thừa năng lượng cho người dưới 18 tuổi.
        </Alert>
      )}

      {loadError && <Alert tone="danger">{loadError}</Alert>}
      {actionMessage && (
        <Alert tone={actionMessage.tone}>{actionMessage.text}</Alert>
      )}

      {/* Daily Totals Summary */}
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Tổng hợp ngày {formatDisplayDateKeyVi(dateKey)}
              </h2>
              <p className="text-xs text-slate-500">
                {entries.length} món đã ghi nhận · Không tự quy đổi các giá trị thiếu
                thành 0
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {summary.hasEstimatedOrUnverified && (
                <Badge tone="warning">Ước tính</Badge>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setModalMealType('lunch');
                  setModalOpen(true);
                }}
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                Thêm món
              </Button>
            </div>
          </div>

          {/* Neutral Adult Goal Comparison (ONLY for adults 18+ with active calorie target) */}
          {showAdultGoalBar && currentGoal?.targetKcal && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800">
                  Bạn đã ghi nhận{' '}
                  <span className="font-mono font-bold text-forest-900 tabular-nums">
                    {energySum.knownTotal !== null
                      ? energySum.knownTotal.toLocaleString('vi-VN')
                      : 'Chưa có dữ liệu'}
                  </span>{' '}
                  /{' '}
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {currentGoal.targetKcal.toLocaleString('vi-VN')} kcal
                  </span>
                  {summary.hasEstimatedOrUnverified || energySum.isPartial
                    ? ' (Ước tính)'
                    : ''}
                </p>
                <Link
                  to="/goals"
                  className="text-xs font-semibold text-forest-800 hover:underline"
                >
                  Xem mục tiêu
                </Link>
              </div>

              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-forest-700 transition-all duration-300"
                  style={{
                    width: `${
                      energySum.knownTotal !== null
                        ? Math.min(
                            100,
                            Math.round(
                              (energySum.knownTotal / currentGoal.targetKcal) * 100
                            )
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>

              {energySum.isPartial && (
                <p className="text-xs text-amber-800">
                  Chưa đủ dữ liệu: {energySum.missingCount} món thiếu thông tin năng
                  lượng, nên tổng trên chỉ là tổng phần đã biết.
                </p>
              )}
            </div>
          )}

          {/* Nutrient Summary Grid */}
          {entries.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
              title={`Chưa có món ăn nào cho ngày ${formatDisplayDateKeyVi(dateKey)}`}
              description="Nhấn 'Thêm món' để chọn từ Kho thực phẩm Việt Nam hoặc tự nhập món ăn của bạn."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setModalMealType('breakfast');
                    setModalOpen(true);
                  }}
                  leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
                >
                  Ghi nhận món đầu tiên
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {SUMMARY_NUTRIENTS.map((item) => {
                const stat = summary.byNutrient[item.key];
                const isEnergyHiddenForUnder18 = false; // Per-food & daily nutrients shown; no calorie target/comparison for <18
                void isEnergyHiddenForUnder18;
                return (
                  <div
                    key={item.key}
                    className="rounded-lg border border-slate-200 bg-white p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium text-slate-500">
                        {item.labelVi}
                      </span>
                      {summary.hasEstimatedOrUnverified &&
                        stat.knownTotal !== null && (
                          <span className="text-[10px] font-semibold text-amber-700">
                            Ước tính
                          </span>
                        )}
                    </div>

                    {stat.knownTotal === null ? (
                      <p className="text-xs font-medium text-slate-400">
                        Chưa có dữ liệu
                      </p>
                    ) : (
                      <p className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {stat.knownTotal.toLocaleString('vi-VN')} {item.unit}
                      </p>
                    )}

                    {stat.isPartial && (
                      <p className="text-[11px] leading-snug text-amber-700">
                        Chưa đủ dữ liệu: {stat.missingCount} món thiếu thông tin
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Four Meal Sections */}
      {!loading && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {MEAL_TYPE_OPTIONS.map((meal) => {
            const mealEntries = entriesByMeal[meal.value];
            return (
              <Card key={meal.value} className="space-y-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {meal.labelVi}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {mealEntries.length > 0
                        ? `${mealEntries.length} món đã ghi`
                        : 'Chưa ghi món nào'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setModalMealType(meal.value);
                      setModalOpen(true);
                    }}
                    leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    Thêm món
                  </Button>
                </div>

                {mealEntries.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">
                    Chưa có món ăn cho {meal.labelVi.toLowerCase()}.
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-200">
                    {mealEntries.map((entry) => {
                      const scaled = scaleNutrients(
                        entry.nutrientsPer100gSnapshot,
                        entry.grams
                      );
                      const isEditingRow = editingEntryId === entry.id;

                      return (
                        <li key={entry.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {entry.name}
                                </span>
                                {entry.source === 'custom' ? (
                                  <Badge tone="neutral">
                                    Tự nhập — chưa xác minh
                                  </Badge>
                                ) : (
                                  <VerificationBadge
                                    status={entry.verificationStatusSnapshot}
                                  />
                                )}
                              </div>

                              <p className="text-xs text-slate-600 font-mono tabular-nums">
                                {entry.grams} g ·{' '}
                                {scaled.energyKcal !== null
                                  ? `${scaled.energyKcal} kcal`
                                  : 'Chưa có dữ liệu kcal'}{' '}
                                · Đạm:{' '}
                                {scaled.proteinG !== null
                                  ? `${scaled.proteinG}g`
                                  : 'Chưa có dữ liệu'}{' '}
                                · Béo:{' '}
                                {scaled.fatG !== null
                                  ? `${scaled.fatG}g`
                                  : 'Chưa có dữ liệu'}{' '}
                                · Carb:{' '}
                                {scaled.carbG !== null
                                  ? `${scaled.carbG}g`
                                  : 'Chưa có dữ liệu'}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEditGrams(entry)}
                                disabled={savingDay}
                                aria-label={`Sửa khối lượng ${entry.name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteEntry(entry.id, entry.name)
                                }
                                disabled={savingDay}
                                aria-label={`Xóa ${entry.name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          {isEditingRow && (
                            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                              <div className="w-32">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  unitLabel="g"
                                  value={editingGramsRaw}
                                  onChange={(e) => setEditingGramsRaw(e.target.value)}
                                  hasError={Boolean(editError)}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="primary"
                                isLoading={savingDay}
                                onClick={() => handleSaveGrams(entry.id)}
                                leftIcon={<Check className="h-3.5 w-3.5" aria-hidden="true" />}
                              >
                                Lưu
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingEntryId(null);
                                  setEditError(null);
                                }}
                                leftIcon={<X className="h-3.5 w-3.5" aria-hidden="true" />}
                              >
                                Hủy
                              </Button>
                              {editError && (
                                <p className="w-full text-xs text-red-700">
                                  {editError}
                                </p>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <DisclaimerBanner />

      <AddDiaryEntryModal
        open={modalOpen}
        initialMealType={modalMealType}
        userAllergens={profile?.allergens ?? []}
        onClose={() => setModalOpen(false)}
        onAddEntry={handleAddEntry}
      />
    </div>
  );
}
