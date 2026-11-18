import { NUTRIENT_FIELD_META } from '@/src/lib/nutrition';
import type { NutrientsPer100g } from '@/src/types/food';

interface NutrientTableProps {
  per100g: NutrientsPer100g;
  perPortion?: NutrientsPer100g | null;
  portionGrams?: number;
  isEstimated?: boolean;
}

function formatNutrientValue(
  value: number | null,
  unit: string
): string {
  if (value === null) {
    return 'Chưa có dữ liệu';
  }
  return `${value} ${unit}`;
}

export function NutrientTable({
  per100g,
  perPortion,
  portionGrams,
  isEstimated = false,
}: NutrientTableProps) {
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Thành phần dinh dưỡng</th>
              <th className="px-4 py-3 font-semibold text-right">
                Trên 100 g
              </th>
              {perPortion && portionGrams !== undefined && (
                <th className="px-4 py-3 font-semibold text-right">
                  Khẩu phần ({portionGrams} g)
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {NUTRIENT_FIELD_META.map((meta) => {
              const val100 = per100g[meta.key];
              const valPortion = perPortion ? perPortion[meta.key] : null;
              return (
                <tr key={meta.key} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {meta.labelVi}
                    {isEstimated && val100 !== null && (
                      <span className="ml-2 text-xs font-normal text-warm-700">
                        (Ước tính)
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums ${
                      val100 === null
                        ? 'text-xs font-sans text-slate-400 italic'
                        : 'font-semibold text-slate-900'
                    }`}
                  >
                    {formatNutrientValue(val100, meta.unit)}
                  </td>
                  {perPortion && portionGrams !== undefined && (
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums ${
                        valPortion === null
                          ? 'text-xs font-sans text-slate-400 italic'
                          : 'font-semibold text-forest-900'
                      }`}
                    >
                      {formatNutrientValue(valPortion, meta.unit)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Các ô ghi &ldquo;Chưa có dữ liệu&rdquo; có nghĩa là chưa có số liệu trong tài
        liệu gốc, không phải bằng 0.
      </p>
    </div>
  );
}
