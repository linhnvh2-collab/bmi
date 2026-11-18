import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { X } from 'lucide-react';
import { Alert, Card, FormField, Input, Tabs } from '@/src/components/ui';
import {
  NUTRIENT_FIELD_META,
  NUTRIENT_PLAUSIBILITY_LIMITS,
  scaleNutrients,
} from '@/src/lib/nutrition';
import type { FoodItem, NutrientKey } from '@/src/types/food';
import { VerificationBadge } from './VerificationBadge';

interface CompareTableProps {
  foods: FoodItem[];
  onRemoveFood: (foodId: string) => void;
}

type CompareBasis = 'per100g' | 'portion';

const BAR_COLORS = ['#14422C', '#16A34A', '#CA8A04'];

export function CompareTable({ foods, onRemoveFood }: CompareTableProps) {
  const [basis, setBasis] = useState<CompareBasis>('per100g');
  const [portionGramsRaw, setPortionGramsRaw] = useState<string>('150');
  const [chartNutrientKey, setChartNutrientKey] =
    useState<NutrientKey>('energyKcal');

  const portionGrams = useMemo(() => {
    const val = Number(portionGramsRaw.replace(',', '.'));
    if (
      !portionGramsRaw.trim() ||
      !Number.isFinite(val) ||
      val <= 0 ||
      val > NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax
    ) {
      return null;
    }
    return Math.round(val * 10) / 10;
  }, [portionGramsRaw]);

  const effectiveFoods = useMemo(
    () =>
      foods.map((food) => ({
        food,
        nutrients:
          basis === 'per100g'
            ? food.nutrientsPer100g
            : portionGrams !== null
              ? scaleNutrients(food.nutrientsPer100g, portionGrams)
              : null,
      })),
    [foods, basis, portionGrams]
  );

  // Build Recharts data excluding null values (never plotting null as 0)
  const macroChartData = useMemo(() => {
    const macroKeys: Array<{ key: NutrientKey; label: string }> = [
      { key: 'proteinG', label: 'Đạm (g)' },
      { key: 'fatG', label: 'Béo (g)' },
      { key: 'carbG', label: 'Carb (g)' },
      { key: 'fiberG', label: 'Chất xơ (g)' },
    ];

    return macroKeys.map((macro) => {
      const point: Record<string, string | number> = {
        nutrient: macro.label,
      };
      effectiveFoods.forEach(({ food, nutrients }) => {
        const val = nutrients ? nutrients[macro.key] : null;
        if (val !== null) {
          point[food.id] = val;
        }
      });
      return point;
    });
  }, [effectiveFoods]);

  const selectedSingleNutrientData = useMemo(() => {
    return effectiveFoods
      .filter(({ nutrients }) => nutrients && nutrients[chartNutrientKey] !== null)
      .map(({ food, nutrients }) => ({
        name: food.nameVi,
        value: nutrients![chartNutrientKey] as number,
      }));
  }, [effectiveFoods, chartNutrientKey]);

  const missingForSelectedChart = effectiveFoods.filter(
    ({ nutrients }) => !nutrients || nutrients[chartNutrientKey] === null
  );

  const selectedMeta = NUTRIENT_FIELD_META.find(
    (m) => m.key === chartNutrientKey
  )!;

  return (
    <div className="space-y-6">
      {/* Basis Selector */}
      <Card className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            So sánh thành phần dinh dưỡng ({foods.length} món)
          </h2>
          <p className="text-xs text-slate-500">
            Các giá trị &ldquo;Chưa có dữ liệu&rdquo; được giữ nguyên và không vẽ thành số 0 trên
            biểu đồ.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Tabs
            value={basis}
            onChange={setBasis}
            items={[
              { value: 'per100g', label: 'Trên 100 g' },
              { value: 'portion', label: 'Theo khẩu phần (g)' },
            ]}
          />
          {basis === 'portion' && (
            <div className="w-36">
              <FormField
                id="compare-portion-grams"
                label="Khối lượng"
                error={portionGrams === null ? 'Nhập > 0 g' : undefined}
              >
                <Input
                  id="compare-portion-grams"
                  type="text"
                  inputMode="decimal"
                  unitLabel="g"
                  value={portionGramsRaw}
                  hasError={portionGrams === null}
                  onChange={(e) => setPortionGramsRaw(e.target.value)}
                />
              </FormField>
            </div>
          )}
        </div>
      </Card>

      {/* Comparison Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">
                Chỉ số (
                {basis === 'per100g'
                  ? '100 g'
                  : portionGrams !== null
                    ? `${portionGrams} g`
                    : '—'}
                )
              </th>
              {foods.map((food) => (
                <th key={food.id} className="px-4 py-3 font-semibold min-w-[180px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">
                        {food.nameVi}
                      </p>
                      <VerificationBadge status={food.verificationStatus} />
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveFood(food.id)}
                      aria-label={`Bỏ ${food.nameVi} khỏi so sánh`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {NUTRIENT_FIELD_META.map((meta) => (
              <tr key={meta.key} className="hover:bg-slate-50/70">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {meta.labelVi} ({meta.unit})
                </td>
                {effectiveFoods.map(({ food, nutrients }) => {
                  const val = nutrients ? nutrients[meta.key] : null;
                  return (
                    <td
                      key={`${food.id}-${meta.key}`}
                      className={`px-4 py-3 font-mono tabular-nums ${
                        val === null
                          ? 'font-sans text-xs italic text-slate-400'
                          : 'font-semibold text-slate-900'
                      }`}
                    >
                      {val === null ? 'Chưa có dữ liệu' : `${val} ${meta.unit}`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Single Nutrient Bar Chart (default Energy) */}
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Biểu đồ so sánh theo chỉ tiêu
            </h3>
            <select
              aria-label="Chọn chỉ tiêu biểu đồ"
              value={chartNutrientKey}
              onChange={(e) => setChartNutrientKey(e.target.value as NutrientKey)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-800"
            >
              {NUTRIENT_FIELD_META.map((meta) => (
                <option key={meta.key} value={meta.key}>
                  {meta.labelVi} ({meta.unit})
                </option>
              ))}
            </select>
          </div>

          {missingForSelectedChart.length > 0 && (
            <Alert tone="info">
              Không vẽ lên biểu đồ đối với món chưa có dữ liệu{' '}
              {selectedMeta.labelVi.toLowerCase()}:{' '}
              {missingForSelectedChart.map((m) => m.food.nameVi).join(', ')}.
            </Alert>
          )}

          {selectedSingleNutrientData.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500">
              Các món được chọn đều chưa có dữ liệu cho chỉ tiêu này.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={selectedSingleNutrientData}
                  margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} width={46} />
                  <Tooltip
                    formatter={(val) => [
                      `${val} ${selectedMeta.unit}`,
                      selectedMeta.labelVi,
                    ]}
                  />
                  <Bar
                    dataKey="value"
                    name={`${selectedMeta.labelVi} (${selectedMeta.unit})`}
                    fill="#14422C"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Macro Grouped Bar Chart */}
        <Card className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-900">
              So sánh nhóm chất sinh năng lượng &amp; chất xơ (g)
            </h3>
            <p className="text-xs text-slate-500">
              Giá trị khuyết (null) được loại trừ khỏi cột tương ứng thay vì hiển thị
              bằng 0.
            </p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={macroChartData}
                margin={{ top: 10, right: 16, left: 0, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="nutrient" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {foods.map((food, idx) => (
                  <Bar
                    key={food.id}
                    dataKey={food.id}
                    name={food.nameVi}
                    fill={BAR_COLORS[idx % BAR_COLORS.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
