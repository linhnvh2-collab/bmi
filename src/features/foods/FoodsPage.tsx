import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Database,
  Heart,
  RefreshCw,
  Scale,
  Upload,
  Utensils,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Button,
  DisclaimerBanner,
  EmptyState,
  Skeleton,
  Tabs,
} from '@/src/components/ui';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import { fetchFoods } from '@/src/lib/firebase/foodsService';
import {
  filterByAllergens,
  MAX_COMPARE_FOODS,
  searchFoods,
} from '@/src/lib/nutrition';
import type {
  FoodCategory,
  FoodItem,
  VerificationStatus,
} from '@/src/types/food';
import { CompareTable, FilterBar, FoodCard } from './components';

type PageTab = 'catalog' | 'favorites' | 'compare';
const PAGE_SIZE = 12;

export function FoodsPage() {
  const { user, isAdmin, profile, favoriteIds, toggleFavorite } = useAuth();

  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<PageTab>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | 'all'>('all');
  const [excludedAllergen, setExcludedAllergen] = useState('');
  const [dietTag, setDietTag] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState<
    VerificationStatus | 'all'
  >('all');
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [compareIds, setCompareIds] = useState<string[]>([]);

  const loadFoods = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchFoods({ includeInactive: false, forceRefresh });
      setFoods(items);
    } catch (err) {
      setError(formatFirestoreUiErrorVi(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFoods(false);
  }, [loadFoods]);

  const userAllergens = useMemo(
    () => profile?.allergens ?? [],
    [profile?.allergens]
  );

  const filteredFoods = useMemo(() => {
    return searchFoods(foods, searchQuery, {
      category,
      excludedAllergens: excludedAllergen ? [excludedAllergen] : [],
      dietTag,
      verificationStatus: includeUnverified ? verificationFilter : 'verified',
      includeUnverified,
      includeInactive: false,
    });
  }, [
    foods,
    searchQuery,
    category,
    excludedAllergen,
    dietTag,
    verificationFilter,
    includeUnverified,
  ]);

  const unreviewedCountWhenFilteringAllergen = useMemo(() => {
    if (!excludedAllergen) return 0;
    const { unreviewedIds } = filterByAllergens(filteredFoods, [excludedAllergen]);
    return unreviewedIds.size;
  }, [filteredFoods, excludedAllergen]);

  const favoriteFoods = useMemo(
    () => foods.filter((f) => favoriteIds.has(f.id)),
    [foods, favoriteIds]
  );

  const compareFoods = useMemo(
    () => foods.filter((f) => compareIds.includes(f.id)),
    [foods, compareIds]
  );

  const handleToggleFavorite = async (foodId: string) => {
    setActionError(null);
    try {
      await toggleFavorite(foodId);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : formatFirestoreUiErrorVi(err)
      );
    }
  };

  const handleToggleCompare = (food: FoodItem) => {
    setCompareIds((prev) => {
      if (prev.includes(food.id)) {
        return prev.filter((id) => id !== food.id);
      }
      if (prev.length >= MAX_COMPARE_FOODS) {
        return prev;
      }
      return [...prev, food.id];
    });
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategory('all');
    setExcludedAllergen('');
    setDietTag('all');
    setVerificationFilter('all');
    setIncludeUnverified(false);
    setVisibleCount(PAGE_SIZE);
  };

  const tabItems: Array<{ value: PageTab; label: string }> = [
    { value: 'catalog', label: `Kho thực phẩm (${filteredFoods.length})` },
    ...(user
      ? [{ value: 'favorites' as const, label: `Yêu thích (${favoriteFoods.length})` }]
      : []),
    {
      value: 'compare',
      label: `So sánh (${compareFoods.length}/${MAX_COMPARE_FOODS})`,
    },
  ];

  const displayedFoods = filteredFoods.slice(0, visibleCount);
  const hasMore = displayedFoods.length < filteredFoods.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Kho dữ liệu thực phẩm Việt Nam
          </h1>
          <p className="text-sm text-slate-600">
            Tra cứu giá trị dinh dưỡng theo 100g, kiểm tra thông tin dị ứng và so sánh
            khẩu phần. Mặc định chỉ hiển thị dữ liệu đã xác minh nguồn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadFoods(true)}
            isLoading={loading}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Làm mới
          </Button>
          {isAdmin && (
            <Link to="/admin/foods">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Upload className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Quản trị &amp; Nhập dữ liệu
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />

        {compareFoods.length >= 2 && activeTab !== 'compare' && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActiveTab('compare')}
            leftIcon={<Scale className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Xem bảng so sánh ({compareFoods.length} món)
          </Button>
        )}
      </div>

      {error && <Alert tone="danger">{error}</Alert>}
      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <div className="space-y-5">
          <FilterBar
            searchQuery={searchQuery}
            onSearchQueryChange={(val) => {
              setSearchQuery(val);
              setVisibleCount(PAGE_SIZE);
            }}
            category={category}
            onCategoryChange={(val) => {
              setCategory(val);
              setVisibleCount(PAGE_SIZE);
            }}
            excludedAllergen={excludedAllergen}
            onExcludedAllergenChange={(val) => {
              setExcludedAllergen(val);
              setVisibleCount(PAGE_SIZE);
            }}
            dietTag={dietTag}
            onDietTagChange={(val) => {
              setDietTag(val);
              setVisibleCount(PAGE_SIZE);
            }}
            verificationFilter={verificationFilter}
            onVerificationFilterChange={(val) => {
              setVerificationFilter(val);
              setVisibleCount(PAGE_SIZE);
            }}
            includeUnverified={includeUnverified}
            onIncludeUnverifiedChange={(val) => {
              setIncludeUnverified(val);
              setVisibleCount(PAGE_SIZE);
            }}
            onReset={handleResetFilters}
          />

          {includeUnverified && (
            <Alert tone="warning" title="Đang hiển thị dữ liệu chưa xác minh / ước tính">
              Các món gắn nhãn &ldquo;Ước tính&rdquo; hoặc &ldquo;Chưa xác minh&rdquo; chỉ mang tính tham
              khảo sơ bộ và không phải số liệu đã kiểm chứng.
            </Alert>
          )}

          {unreviewedCountWhenFilteringAllergen > 0 && (
            <Alert
              tone="warning"
              title={`Lưu ý khi lọc dị ứng (${excludedAllergen})`}
            >
              Có {unreviewedCountWhenFilteringAllergen} món trong kết quả chưa được rà
              soát thông tin dị ứng (<code className="font-mono text-xs">allergensReviewed = false</code>).
              Không xem các món này là hoàn toàn an toàn khi chưa kiểm tra kỹ thành
              phần.
            </Alert>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-80 w-full" />
              <Skeleton className="h-80 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
          ) : foods.length === 0 ? (
            <EmptyState
              icon={<Database className="h-5 w-5" aria-hidden="true" />}
              title="Kho dữ liệu thực phẩm hiện đang trống"
              description="Chưa có món ăn hoặc thực phẩm nào được nhập vào cơ sở dữ liệu. Hệ thống không tự tạo dữ liệu giả."
              action={
                isAdmin ? (
                  <Link to="/admin/foods">
                    <Button
                      variant="primary"
                      leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                    >
                      Đi tới công cụ nhập dữ liệu (Admin)
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : filteredFoods.length === 0 ? (
            <EmptyState
              icon={<Utensils className="h-5 w-5" aria-hidden="true" />}
              title="Không tìm thấy thực phẩm phù hợp"
              description={
                !includeUnverified
                  ? 'Không có thực phẩm đã xác minh khớp bộ lọc hiện tại. Bạn có thể đặt lại bộ lọc hoặc bật tùy chọn xem thêm dữ liệu ước tính / chưa xác minh.'
                  : 'Hãy thử từ khóa khác (không cần dấu) hoặc đặt lại bộ lọc.'
              }
              action={
                <div className="flex flex-wrap justify-center gap-2.5">
                  <Button variant="outline" onClick={handleResetFilters}>
                    Đặt lại bộ lọc
                  </Button>
                  {!includeUnverified && (
                    <Button
                      variant="primary"
                      onClick={() => setIncludeUnverified(true)}
                    >
                      Hiện cả dữ liệu ước tính / chưa xác minh
                    </Button>
                  )}
                </div>
              }
            />
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {displayedFoods.map((food) => (
                  <FoodCard
                    key={food.id}
                    food={food}
                    userAllergens={userAllergens}
                    isFavorite={favoriteIds.has(food.id)}
                    onToggleFavorite={user ? handleToggleFavorite : undefined}
                    isCompareSelected={compareIds.includes(food.id)}
                    onToggleCompare={handleToggleCompare}
                    compareDisabled={compareIds.length >= MAX_COMPARE_FOODS}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                  >
                    Xem thêm ({filteredFoods.length - displayedFoods.length} món còn
                    lại)
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Favorites Tab */}
      {activeTab === 'favorites' && user && (
        <div className="space-y-4">
          {favoriteFoods.length === 0 ? (
            <EmptyState
              icon={<Heart className="h-5 w-5" aria-hidden="true" />}
              title="Chưa có món ăn yêu thích nào"
              description="Bạn có thể nhấn biểu tượng trái tim trên mỗi thực phẩm để lưu nhanh vào danh sách yêu thích của riêng mình."
              action={
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('catalog')}
                >
                  Khám phá kho thực phẩm
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {favoriteFoods.map((food) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  userAllergens={userAllergens}
                  isFavorite={true}
                  onToggleFavorite={handleToggleFavorite}
                  isCompareSelected={compareIds.includes(food.id)}
                  onToggleCompare={handleToggleCompare}
                  compareDisabled={compareIds.length >= MAX_COMPARE_FOODS}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compare Tab */}
      {activeTab === 'compare' && (
        <div className="space-y-4">
          {compareFoods.length < 2 ? (
            <EmptyState
              icon={<Scale className="h-5 w-5" aria-hidden="true" />}
              title="Chọn từ 2 đến 3 thực phẩm để so sánh"
              description={`Hiện bạn mới chọn ${compareFoods.length} món. Hãy tích chọn ô "So sánh" trên thẻ thực phẩm để đối chiếu hàm lượng dinh dưỡng và biểu đồ.`}
              action={
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('catalog')}
                >
                  Chọn thực phẩm để so sánh
                </Button>
              }
            />
          ) : (
            <CompareTable
              foods={compareFoods}
              onRemoveFood={(id) =>
                setCompareIds((prev) => prev.filter((item) => item !== id))
              }
            />
          )}
        </div>
      )}

      {/* Allergen & Educational Disclaimers */}
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-warm-700"
            aria-hidden="true"
          />
          <span>
            Thông tin dị ứng có thể chưa đầy đủ; hãy kiểm tra nhãn sản phẩm hoặc hỏi
            chuyên gia.
          </span>
        </div>
        <DisclaimerBanner compact />
      </div>
    </div>
  );
}
