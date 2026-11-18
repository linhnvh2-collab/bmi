import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, Clock, Coins, MapPin, ShieldAlert } from 'lucide-react';
import { Alert, Badge, Card } from '@/src/components/ui';
import { VerificationBadge } from '@/src/features/foods/components';
import {
  evaluateSmartSubstitutions,
  FOOD_CATEGORY_LABELS,
  getFoodPracticalMeta,
  getPortionNutrientComparison,
} from '@/src/lib/nutrition';
import type { FoodItem } from '@/src/types/food';
import type { BudgetLevel, NutritionGoalMode } from '@/src/types/health';

interface FoodSubstitutionCompareTableProps {
  targetFood: FoodItem;
  targetPortionGrams: number;
  catalogFoods: FoodItem[];
  excludedAllergens?: string[];
  dislikedFoods?: string[];
  nutritionGoal?: NutritionGoalMode;
  budgetLevel?: BudgetLevel;
}

export function FoodSubstitutionCompareTable({
  targetFood,
  targetPortionGrams,
  catalogFoods,
  excludedAllergens = [],
  dislikedFoods = [],
  nutritionGoal = 'nutrition_balance',
  budgetLevel = 'standard',
}: FoodSubstitutionCompareTableProps) {
  const [preferQuickPrep, setPreferQuickPrep] = useState(false);
  const [preferEconomy, setPreferEconomy] = useState(
    budgetLevel === 'economy'
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(
    null
  );

  const candidates = useMemo(
    () =>
      evaluateSmartSubstitutions(targetFood, catalogFoods, {
        excludedAllergens,
        dislikedFoods,
        nutritionGoal,
        budgetLevel,
        preferQuickPrep,
        preferEconomy,
        limit: 6,
      }),
    [
      targetFood,
      catalogFoods,
      excludedAllergens,
      dislikedFoods,
      nutritionGoal,
      budgetLevel,
      preferQuickPrep,
      preferEconomy,
    ]
  );

  const activeCandidate = useMemo(() => {
    if (candidates.length === 0) return null;
    return (
      candidates.find((c) => c.food.id === selectedCandidateId) ?? candidates[0]
    );
  }, [candidates, selectedCandidateId]);

  const targetMeta = useMemo(() => getFoodPracticalMeta(targetFood), [targetFood]);

  const comparisonRows = useMemo(() => {
    if (!activeCandidate) return [];
    return getPortionNutrientComparison(
      targetFood,
      targetPortionGrams,
      activeCandidate.food,
      activeCandidate.portionGrams
    );
  }, [targetFood, targetPortionGrams, activeCandidate]);

  if (catalogFoods.length === 0) {
    return null;
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight
              className="h-4 w-4 text-forest-700"
              aria-hidden="true"
            />
            <h2 className="text-base font-semibold text-slate-900">
              Thay thế thực phẩm thông minh &amp; So sánh chi tiết
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Đánh giá dựa trên giá trị dinh dưỡng thực tế trên 100g, chi phí, thời
            gian chế biến và bộ lọc dị ứng — không quy đồng chỉ theo tên nhóm món.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPreferQuickPrep((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              preferQuickPrep
                ? 'border-forest-700 bg-forest-50 text-forest-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Dễ &amp; nhanh (≤15p)</span>
          </button>

          <button
            type="button"
            onClick={() => setPreferEconomy((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              preferEconomy
                ? 'border-forest-700 bg-forest-50 text-forest-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Coins className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Tiết kiệm hơn</span>
          </button>
        </div>
      </div>

      {candidates.length === 0 || !activeCandidate ? (
        <Alert tone="warning">
          Không tìm thấy thực phẩm thay thế an toàn phù hợp sau khi áp dụng danh
          sách dị ứng và thực phẩm không thích trong hồ sơ của bạn.
        </Alert>
      ) : (
        <>
          {/* Candidate Selector Strip */}
          <div className="flex flex-wrap gap-2">
            {candidates.map((cand) => {
              const isSelected = cand.food.id === activeCandidate.food.id;
              return (
                <button
                  key={cand.food.id}
                  type="button"
                  onClick={() => setSelectedCandidateId(cand.food.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-forest-700 bg-forest-50 text-forest-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="block font-semibold">{cand.food.nameVi}</span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {cand.food.nutrientsPer100g.energyKcal ?? '—'} kcal/100g · ~
                    {cand.practical.prepTimeMinutes}p
                  </span>
                </button>
              );
            })}
          </div>

          {/* Equivalence Rationale */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={activeCandidate.equivalenceTone}>
                  {activeCandidate.equivalenceLabelVi}
                </Badge>
                <span className="text-xs font-medium text-slate-700">
                  {FOOD_CATEGORY_LABELS[activeCandidate.food.category]}
                </span>
              </div>
              <Link
                to={`/foods/${activeCandidate.food.id}`}
                className="text-xs font-semibold text-forest-800 hover:underline"
              >
                Mở chi tiết {activeCandidate.food.nameVi} →
              </Link>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              {activeCandidate.reasonVi}.
            </p>
          </div>

          {/* Side-by-side Nutrient & Practical Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3 py-2.5 font-semibold">Tiêu chí đối chiếu</th>
                  <th className="px-3 py-2.5 font-semibold">
                    Món hiện tại: {targetFood.nameVi} ({targetPortionGrams}g)
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-forest-900">
                    Đề xuất thay thế: {activeCandidate.food.nameVi} (
                    {activeCandidate.portionGrams}g)
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Chênh lệch / 100g</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {comparisonRows.map((row) => {
                  const delta100 =
                    row.key === 'energyKcal'
                      ? activeCandidate.deltasPer100g.energyKcal
                      : row.key === 'proteinG'
                        ? activeCandidate.deltasPer100g.proteinG
                        : row.key === 'carbG'
                          ? activeCandidate.deltasPer100g.carbG
                          : row.key === 'fatG'
                            ? activeCandidate.deltasPer100g.fatG
                            : row.key === 'fiberG'
                              ? activeCandidate.deltasPer100g.fiberG
                              : null;
                  return (
                    <tr key={row.key} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        {row.labelVi}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 tabular-nums">
                        {row.originalVal !== null
                          ? `${row.originalVal} ${row.unit}`
                          : 'Chưa có dữ liệu'}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-forest-900 tabular-nums">
                        {row.substituteVal !== null
                          ? `${row.substituteVal} ${row.unit}`
                          : 'Chưa có dữ liệu'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 tabular-nums">
                        {delta100 === null
                          ? '—'
                          : `${delta100 > 0 ? '+' : ''}${delta100} ${row.unit}`}
                      </td>
                    </tr>
                  );
                })}

                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    Thời gian chuẩn bị ước tính
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    ~{targetMeta.prepTimeMinutes} phút
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    ~{activeCandidate.practical.prepTimeMinutes} phút
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">Ước tính chế biến</td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    Ngân sách &amp; Độ sẵn có
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    {targetMeta.budgetLabelVi}
                  </td>
                  <td className="px-3 py-2.5 text-slate-700">
                    <span className="block">{activeCandidate.practical.budgetLabelVi}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {activeCandidate.practical.availabilityVi}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">Tại chợ/siêu thị Việt</td>
                </tr>

                <tr className="hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    Xác minh dữ liệu &amp; Dị ứng
                  </td>
                  <td className="px-3 py-2.5 space-y-1">
                    <VerificationBadge status={targetFood.verificationStatus} />
                    <p className="text-[11px] text-slate-500">
                      {targetFood.allergens.length > 0
                        ? targetFood.allergens.join(', ')
                        : 'Không liệt kê dị ứng'}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 space-y-1">
                    <VerificationBadge
                      status={activeCandidate.food.verificationStatus}
                    />
                    <p className="text-[11px] text-slate-500">
                      {activeCandidate.food.allergens.length > 0
                        ? activeCandidate.food.allergens.join(', ')
                        : 'Không liệt kê dị ứng'}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-600">
                    {excludedAllergens.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-forest-800">
                        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                        An toàn theo hồ sơ
                      </span>
                    ) : (
                      'Kiểm tra dị ứng cá nhân'
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
