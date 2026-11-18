import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Heart,
  ShieldAlert,
  Utensils,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Button,
  Card,
  DisclaimerBanner,
  EmptyState,
  Skeleton,
} from '@/src/components/ui';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import { fetchFoodById } from '@/src/lib/firebase/foodsService';
import {
  ALLERGEN_DISCLAIMER_VI,
  DIET_TAG_LABELS,
  findMatchingAllergens,
  FOOD_CATEGORY_LABELS,
  scaleNutrients,
  VERIFICATION_STATUS_METADATA,
} from '@/src/lib/nutrition';
import type { FoodItem, NutrientsPer100g } from '@/src/types/food';
import {
  AllergenBadge,
  AllergenUnreviewedTag,
  NutrientTable,
  PortionCalculator,
  VerificationBadge,
} from './components';

export function FoodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, favoriteIds, toggleFavorite } = useAuth();

  const [food, setFood] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const [portionGrams, setPortionGrams] = useState<number | null>(null);
  const [scaledNutrients, setScaledNutrients] =
    useState<NutrientsPer100g | null>(null);
  const [favError, setFavError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const item = await fetchFoodById(id);
        if (!active) return;
        setFood(item);
        if (item) {
          const initialGrams =
            item.servingUnits.length > 0 ? item.servingUnits[0].grams : 100;
          setPortionGrams(initialGrams);
          setScaledNutrients(scaleNutrients(item.nutrientsPer100g, initialGrams));
        }
      } catch (err) {
        if (active) {
          setError(formatFirestoreUiErrorVi(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const userAllergens = useMemo(
    () => profile?.allergens ?? [],
    [profile?.allergens]
  );

  const matchedAllergens = useMemo(() => {
    if (!food) return [];
    return findMatchingAllergens(food.allergens, userAllergens);
  }, [food, userAllergens]);

  const handleToggleFavorite = async () => {
    if (!food) return;
    setFavError(null);
    try {
      await toggleFavorite(food.id);
    } catch (err) {
      setFavError(
        err instanceof Error ? err.message : formatFirestoreUiErrorVi(err)
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/foods">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Quay lại Kho thực phẩm
          </Button>
        </Link>
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  if (!food) {
    return (
      <div className="space-y-4">
        <Link to="/foods">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Quay lại Kho thực phẩm
          </Button>
        </Link>
        <EmptyState
          icon={<Utensils className="h-5 w-5" aria-hidden="true" />}
          title="Không tìm thấy thực phẩm"
          description="Mục thực phẩm này không tồn tại hoặc đã bị quản trị viên ẩn khỏi hệ thống."
        />
      </div>
    );
  }

  const verificationMeta = VERIFICATION_STATUS_METADATA[food.verificationStatus];
  const isFavorite = favoriteIds.has(food.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/foods">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            Quay lại Kho thực phẩm
          </Button>
        </Link>

        {user && (
          <Button
            variant={isFavorite ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleToggleFavorite}
            leftIcon={
              <Heart
                className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
            }
          >
            {isFavorite ? 'Đã lưu yêu thích' : 'Lưu yêu thích'}
          </Button>
        )}
      </div>

      {favError && <Alert tone="danger">{favError}</Alert>}

      {/* Food Summary Header */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5 space-y-4">
          {food.imagePath && !imgError ? (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
              <img
                src={food.imagePath}
                alt={food.nameVi}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-forest-200 bg-forest-50/45 p-6 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-forest-200 bg-white text-forest-700">
                <Utensils className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-forest-900">
                {FOOD_CATEGORY_LABELS[food.category]}
              </p>
              <p className="text-[11px] text-slate-500">
                Chưa có hình ảnh tĩnh cho món ăn này
              </p>
            </div>
          )}

          {/* Source & Verification */}
          <div className="space-y-2.5 border-t border-slate-200 pt-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">
                Trạng thái dữ liệu
              </span>
              <VerificationBadge status={food.verificationStatus} showFullLabel />
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              {verificationMeta.explanationVi}
            </p>

            {food.verificationStatus === 'verified' && food.source ? (
              <div className="rounded-lg border border-fresh-600/25 bg-fresh-50/60 p-3 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-forest-900">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Nguồn tham khảo đã xác minh</span>
                </div>
                <p className="text-slate-800">
                  {food.source.name} ({food.source.year})
                </p>
                <p className="text-slate-600">{food.source.reference}</p>
              </div>
            ) : food.source && food.source.name ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <p className="font-semibold text-slate-800">
                  Nguồn tham khảo sơ bộ
                </p>
                <p className="text-slate-700">
                  {food.source.name}
                  {food.source.year ? ` (${food.source.year})` : ''}
                </p>
                {food.source.reference && (
                  <p className="text-slate-500">{food.source.reference}</p>
                )}
              </div>
            ) : null}
          </div>
        </Card>

        <div className="lg:col-span-7 space-y-5">
          <Card className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-forest-800">
                {FOOD_CATEGORY_LABELS[food.category]}
                {food.nameEn ? ` · ${food.nameEn}` : ''}
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {food.nameVi}
              </h1>
              {food.aliases.length > 0 && (
                <p className="text-xs text-slate-500">
                  Tên gọi khác: {food.aliases.join(', ')}
                </p>
              )}
            </div>

            {food.dietTags.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                <span className="font-medium text-slate-700">Phù hợp:</span>
                <span>
                  {food.dietTags
                    .map((tag) => DIET_TAG_LABELS[tag] ?? tag)
                    .join(' · ')}
                </span>
              </div>
            )}

            {/* Allergen Section */}
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Thông tin dị ứng
              </h2>

              {matchedAllergens.length > 0 && (
                <Alert
                  tone="danger"
                  title="Cảnh báo trùng khớp hồ sơ dị ứng của bạn"
                >
                  <div className="flex items-start gap-2">
                    <ShieldAlert
                      className="mt-0.5 h-4 w-4 shrink-0 text-red-700"
                      aria-hidden="true"
                    />
                    <span>
                      Thực phẩm này có ghi nhận thành phần trùng với danh sách cần
                      tránh trong hồ sơ của bạn:{' '}
                      <strong>{matchedAllergens.join(', ')}</strong>.
                    </span>
                  </div>
                </Alert>
              )}

              {!food.allergensReviewed && (
                <Alert tone="warning" title="Thông tin dị ứng chưa được rà soát">
                  Mục thực phẩm này có đánh dấu{' '}
                  <code className="font-mono text-xs">allergensReviewed = false</code>.
                  Danh sách dị ứng dưới đây có thể còn thiếu sót.
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {food.allergens.length > 0 ? (
                  food.allergens.map((allergen) => (
                    <AllergenBadge
                      key={allergen}
                      label={allergen}
                      isMatchedUserAllergen={matchedAllergens.includes(allergen)}
                    />
                  ))
                ) : (
                  <span className="text-xs text-slate-500">
                    Không có chất dị ứng nào được liệt kê.
                  </span>
                )}
                {!food.allergensReviewed && <AllergenUnreviewedTag />}
              </div>

              <p className="text-xs leading-relaxed text-slate-600">
                {ALLERGEN_DISCLAIMER_VI}
              </p>
            </div>
          </Card>

          <PortionCalculator
            servingUnits={food.servingUnits}
            nutrientsPer100g={food.nutrientsPer100g}
            onPortionChange={(g, scaled) => {
              setPortionGrams(g);
              setScaledNutrients(scaled);
            }}
          />
        </div>
      </div>

      {/* Nutrient Table */}
      <NutrientTable
        per100g={food.nutrientsPer100g}
        perPortion={scaledNutrients}
        portionGrams={portionGrams ?? undefined}
        isEstimated={food.verificationStatus !== 'verified'}
      />

      <DisclaimerBanner />
    </div>
  );
}
