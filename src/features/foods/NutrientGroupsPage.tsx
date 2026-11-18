import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers, Utensils } from 'lucide-react';
import {
  Alert,
  Badge,
  Button,
  Card,
  DisclaimerBanner,
  Skeleton,
} from '@/src/components/ui';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import { fetchFoods } from '@/src/lib/firebase/foodsService';
import {
  filterFoodsByNutrientGroup,
  NUTRIENT_NEED_GROUPS,
  VIETNAMESE_CATALOG_MAP,
} from '@/src/lib/nutrition';
import type { FoodItem, NutrientNeedGroupId } from '@/src/types/food';

export function NutrientGroupsPage() {
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] =
    useState<NutrientNeedGroupId>('rich_protein');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchFoods({ includeInactive: false });
        if (active) setFoods(items);
      } catch (err) {
        if (active) setError(formatFirestoreUiErrorVi(err));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const groupCounts = useMemo(() => {
    const counts = new Map<NutrientNeedGroupId, FoodItem[]>();
    for (const grp of NUTRIENT_NEED_GROUPS) {
      counts.set(grp.id, filterFoodsByNutrientGroup(foods, grp.id));
    }
    return counts;
  }, [foods]);

  const activeGroup = useMemo(
    () =>
      NUTRIENT_NEED_GROUPS.find((g) => g.id === selectedGroupId) ??
      NUTRIENT_NEED_GROUPS[0],
    [selectedGroupId]
  );

  const activeGroupFoods = groupCounts.get(activeGroup.id) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-800">
            <Layers className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Phân loại học tập từ dữ liệu thực tế</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            9 nhóm thực phẩm theo nhu cầu dinh dưỡng
          </h1>
          <p className="text-sm text-slate-600">
            Phân nhóm tự động dựa trên thành phần dinh dưỡng trên 100g của món ăn
            Việt Nam, giúp bạn chọn đúng món cho mục tiêu sức khỏe hằng ngày.
          </p>
        </div>

        <Link to="/foods">
          <Button variant="outline" size="sm">
            Mở toàn bộ Kho thực phẩm
          </Button>
        </Link>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* 9 Visual Nutrient Group Cards */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {NUTRIENT_NEED_GROUPS.map((group) => {
              const repFood = VIETNAMESE_CATALOG_MAP.get(
                group.representativeFoodId
              );
              const matchedItems = groupCounts.get(group.id) ?? [];
              const isSelected = group.id === selectedGroupId;

              return (
                <article
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`flex flex-col justify-between overflow-hidden rounded-xl border bg-white transition-all cursor-pointer ${
                    isSelected
                      ? 'border-forest-700 ring-2 ring-forest-700/15'
                      : 'border-slate-200 hover:border-forest-300'
                  }`}
                >
                  <div>
                    {repFood?.imagePath ? (
                      <div className="aspect-[16/10] w-full overflow-hidden border-b border-slate-200 bg-slate-100">
                        <img
                          src={repFood.imagePath}
                          alt={`${group.labelVi} — ${repFood.nameVi}`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[16/10] w-full items-center justify-center border-b border-slate-200 bg-forest-50/50">
                        <Utensils
                          className="h-6 w-6 text-forest-700"
                          aria-hidden="true"
                        />
                      </div>
                    )}

                    <div className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <Badge tone={group.tone}>{group.shortTagVi}</Badge>
                        <span className="font-mono text-xs font-semibold text-slate-600 tabular-nums">
                          {matchedItems.length} món
                        </span>
                      </div>

                      <h2 className="text-base font-semibold text-slate-900">
                        {group.labelVi}
                      </h2>

                      <p className="text-xs leading-relaxed text-slate-600">
                        {group.descriptionVi}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/60 px-4 py-2.5">
                    <span className="text-xs font-medium text-forest-800">
                      {isSelected ? 'Đang xem chi tiết bên dưới' : 'Chọn để xem món'}
                    </span>
                    <Link
                      to={`/foods?group=${group.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-forest-800 hover:underline whitespace-nowrap"
                    >
                      <span>Lọc kho</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Active Group Detail & Filtered Dish Preview */}
          <Card className="space-y-5">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={activeGroup.tone}>{activeGroup.thresholdRuleVi}</Badge>
                  <span className="text-xs font-medium text-slate-500">
                    {activeGroupFoods.length} món ăn phù hợp trong cơ sở dữ liệu
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {activeGroup.labelVi}
                </h2>
              </div>

              <Link to={`/foods?group=${activeGroup.id}`}>
                <Button variant="primary" size="sm">
                  Xem tất cả {activeGroupFoods.length} món nhóm này
                </Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-forest-50/40 p-3.5 space-y-1">
                <p className="text-xs font-semibold text-forest-900">
                  Vai trò &amp; lợi ích tham khảo
                </p>
                <p className="text-xs leading-relaxed text-slate-700">
                  {activeGroup.benefitsVi}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-warm-50/40 p-3.5 space-y-1">
                <p className="text-xs font-semibold text-warm-800">
                  Lưu ý sử dụng cân bằng
                </p>
                <p className="text-xs leading-relaxed text-slate-700">
                  {activeGroup.cautionsVi}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {activeGroupFoods.slice(0, 8).map((food) => (
                <Link
                  key={food.id}
                  to={`/foods/${food.id}`}
                  className="group rounded-xl border border-slate-200 bg-white overflow-hidden hover:border-forest-400 transition-colors"
                >
                  {food.imagePath ? (
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 border-b border-slate-200">
                      <img
                        src={food.imagePath}
                        alt={food.nameVi}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 border-b border-slate-200 bg-forest-50/40 px-3 text-center">
                      <Utensils
                        className="h-5 w-5 text-forest-700"
                        aria-hidden="true"
                      />
                      <span className="text-[11px] text-slate-500">
                        Chưa có ảnh món ăn
                      </span>
                    </div>
                  )}
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-semibold text-slate-900 group-hover:text-forest-800 line-clamp-1">
                      {food.nameVi}
                    </p>
                    <p className="font-mono text-xs text-slate-600 tabular-nums">
                      {food.nutrientsPer100g.energyKcal ?? '—'} kcal · Đạm{' '}
                      {food.nutrientsPer100g.proteinG ?? '—'}g · Xơ{' '}
                      {food.nutrientsPer100g.fiberG ?? '—'}g
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}

      <DisclaimerBanner />
    </div>
  );
}
