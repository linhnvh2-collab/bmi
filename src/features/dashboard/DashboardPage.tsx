import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Calculator,
  Calendar,
  Camera,
  FileText,
  Flame,
  Layers,
  ShoppingCart,
  Sparkles,
  Target,
  UserCircle2,
  Utensils,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  DisclaimerBanner,
  EmptyState,
  Skeleton,
  StatCard,
} from '@/src/components/ui';
import { BmiHistoryChart } from '@/src/features/bmi/BmiHistoryChart';
import {
  ACTIVITY_LEVEL_OPTIONS,
  BMI_CATEGORY_METADATA,
} from '@/src/lib/calculations';
import { subscribeMealPlans } from '@/src/lib/firebase/mealPlansService';
import {
  calculateAgeFromBirthYear,
  formatVietnameseDate,
  formatVietnameseDateTime,
} from '@/src/lib/format/date';
import { GOAL_TYPE_LABELS } from '@/src/lib/safety';
import type { SavedMealPlan } from '@/src/types/mealPlan';

export function DashboardPage() {
  const {
    user,
    profile,
    profileLoading,
    profileError,
    healthRecords,
    recordsLoading,
    recordsError,
    favoriteIds,
    currentGoal,
  } = useAuth();

  const [savedPlans, setSavedPlans] = useState<SavedMealPlan[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMealPlans(
      user.uid,
      (plans) => setSavedPlans(plans),
      () => setSavedPlans([])
    );
    return () => unsub();
  }, [user]);

  const latestRecord = healthRecords[0] ?? null;
  const profileAge = profile ? calculateAgeFromBirthYear(profile.birthYear) : null;
  const isUnder18 =
    (profileAge !== null && profileAge < 18) || Boolean(latestRecord?.isUnder18);

  const latestMeta = latestRecord
    ? BMI_CATEGORY_METADATA[latestRecord.categoryKey]
    : null;

  const activityLabel = profile
    ? ACTIVITY_LEVEL_OPTIONS.find((opt) => opt.value === profile.activityLevel)
        ?.labelVi ?? '—'
    : 'Chưa thiết lập';

  const latestPlan = savedPlans[0] ?? null;
  const latestPlanDay = latestPlan?.days[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Tổng quan sức khỏe
          </h1>
          <p className="text-sm text-slate-600">
            Xin chào{' '}
            <span className="font-semibold text-slate-900">
              {profile?.displayName || user?.displayName || user?.email}
            </span>
            . Các số liệu dưới đây được tổng hợp trực tiếp từ hồ sơ và lịch sử đo
            thực tế của bạn.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/meal-planner">
            <Button
              variant="primary"
              leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            >
              Thực đơn AI
            </Button>
          </Link>
          <Link to="/bmi">
            <Button
              variant="outline"
              leftIcon={<Calculator className="h-4 w-4" aria-hidden="true" />}
            >
              Đo &amp; lưu BMI
            </Button>
          </Link>
          <Link to="/profile">
            <Button
              variant="outline"
              leftIcon={<UserCircle2 className="h-4 w-4" aria-hidden="true" />}
            >
              Hồ sơ
            </Button>
          </Link>
        </div>
      </div>

      {profileError && <Alert tone="danger">{profileError}</Alert>}
      {recordsError && <Alert tone="danger">{recordsError}</Alert>}

      {!profileLoading && !profile && (
        <Alert
          tone="warning"
          title="Bạn chưa hoàn tất hồ sơ cá nhân & đồng ý lưu trữ dữ liệu"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Vui lòng thiết lập hồ sơ và xác nhận đồng ý theo Nghị định 13/2023/NĐ-CP
              để lưu trữ dữ liệu sức khỏe cá nhân.
            </span>
            <Link to="/profile" className="shrink-0">
              <Button size="sm" variant="primary">
                Thiết lập hồ sơ
              </Button>
            </Link>
          </div>
        </Alert>
      )}

      {isUnder18 && (
        <Alert tone="warning" title="Tài khoản đang ở chế độ giới hạn (dưới 18 tuổi)">
          Ứng dụng chỉ hiển thị chỉ số BMI thuần túy và không hiển thị phân loại người
          trưởng thành hay mục tiêu năng lượng. Trẻ em và thanh thiếu niên cần được đánh
          giá qua biểu đồ tăng trưởng WHO bởi bác sĩ hoặc chuyên gia dinh dưỡng.
        </Alert>
      )}

      {/* KPI Row */}
      {recordsLoading || profileLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Chỉ số BMI gần nhất"
            value={latestRecord ? latestRecord.bmi.toFixed(1) : '—'}
            unit={latestRecord ? 'kg/m²' : undefined}
            caption={
              latestRecord
                ? `Cập nhật: ${formatVietnameseDate(latestRecord.createdAt)}`
                : 'Chưa có bản ghi BMI nào được lưu'
            }
            badge={
              latestRecord && latestMeta ? (
                <Badge tone={latestMeta.tone}>
                  {latestRecord.isUnder18 ? 'Dưới 18 tuổi' : latestMeta.labelVi}
                </Badge>
              ) : undefined
            }
          />

          <StatCard
            label="Chiều cao · Cân nặng gần nhất"
            value={
              latestRecord
                ? `${latestRecord.heightCm} / ${latestRecord.weightKg}`
                : profile
                  ? `${profile.heightCm} / ${profile.weightKg}`
                  : '—'
            }
            unit={latestRecord || profile ? 'cm / kg' : undefined}
            caption={
              latestRecord
                ? 'Theo lần đo BMI gần nhất'
                : profile
                  ? 'Theo thông tin hồ sơ cá nhân'
                  : 'Chưa có số đo'
            }
          />

          <StatCard
            label="Tổng số lần đã lưu"
            value={String(healthRecords.length)}
            unit="bản ghi"
            caption={
              healthRecords.length > 0
                ? 'Dữ liệu thuộc quyền sở hữu riêng của bạn'
                : 'Hãy tính và lưu lần đo đầu tiên'
            }
          />

          <StatCard
            label="Mức độ vận động (hồ sơ)"
            value={activityLabel}
            caption={
              profile
                ? `Sở thích: ${profile.dietaryPreferences.length} · Dị ứng: ${profile.allergens.length}`
                : 'Lưu sẵn cho thực đơn cá nhân'
            }
          />
        </div>
      )}

      {/* Active AI Meal Plan + Quick Feature Links */}
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-forest-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-900">
              {latestPlan ? `Thực đơn AI hiện tại: ${latestPlan.title}` : 'Thực đơn AI & Công cụ dinh dưỡng nhanh'}
            </h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/nutrition-plan">
              <Button size="sm" variant="outline">
                Kế hoạch dinh dưỡng
              </Button>
            </Link>
            <Link to="/nutrients">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                9 nhóm chất
              </Button>
            </Link>
            <Link to="/scanner">
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Camera className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Quét ảnh món
              </Button>
            </Link>
          </div>
        </div>

        {latestPlan && latestPlanDay ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                <strong>{latestPlanDay.dayLabelVi}</strong> ·{' '}
                {latestPlanDay.dailyTotals.energyKcal !== null
                  ? `~${latestPlanDay.dailyTotals.energyKcal.toLocaleString('vi-VN')} kcal (Ước tính)`
                  : 'Chế độ thói quen lành mạnh'}
              </span>
              <Link
                to="/meal-planner"
                className="font-semibold text-forest-800 hover:underline"
              >
                Mở chi tiết &amp; Đổi món →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {latestPlanDay.meals.map((slot) => (
                <div
                  key={slot.slotType}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1"
                >
                  <p className="text-xs font-semibold text-forest-900">
                    {slot.labelVi}
                  </p>
                  <p className="text-xs text-slate-700 line-clamp-2">
                    {slot.dishes.map((d) => d.nameVi).join(', ')}
                  </p>
                  <p className="font-mono text-[11px] text-slate-500">
                    {slot.totals.energyKcal !== null
                      ? `~${slot.totals.energyKcal} kcal`
                      : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-600">
              Chưa có thực đơn AI nào được tạo. Hãy tạo thực đơn 1, 3 hoặc 7 ngày phù
              hợp với thể trạng và sở thích Việt Nam của bạn.
            </p>
            <Link to="/meal-planner" className="shrink-0">
              <Button size="sm" variant="primary">
                Tạo thực đơn AI ngay
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* Main Content Split: Chart + Context Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Diễn biến BMI theo thời gian
              </h2>
              <p className="text-xs text-slate-500">
                Biểu đồ chỉ vẽ từ các bản ghi thực tế bạn đã lưu trong Firestore.
              </p>
            </div>
          </div>

          {recordsLoading ? (
            <Skeleton className="h-72 w-full" />
          ) : healthRecords.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-5 w-5" aria-hidden="true" />}
              title="Chưa có dữ liệu lịch sử BMI"
              description="Bạn chưa lưu kết quả đo BMI nào. Hãy tính chỉ số BMI và nhấn lưu để bắt đầu theo dõi xu hướng sức khỏe cá nhân."
              action={
                <Link to="/bmi">
                  <Button variant="primary" size="sm">
                    Tính &amp; lưu BMI đầu tiên
                  </Button>
                </Link>
              }
            />
          ) : (
            <BmiHistoryChart
              records={healthRecords}
              showAdultReferenceLines={!isUnder18}
            />
          )}
        </Card>

        <div className="lg:col-span-5 space-y-5">
          <Card className="space-y-4">
            <div className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-forest-700" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Lịch sử đo gần đây
              </h2>
            </div>

            {recordsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : healthRecords.length === 0 ? (
              <p className="text-xs leading-relaxed text-slate-500">
                Chưa có bản ghi nào. Khi bạn lưu kết quả trên trang Tính BMI, 5 lần đo
                gần nhất sẽ hiển thị tại đây.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {healthRecords.slice(0, 5).map((rec) => {
                  const meta = BMI_CATEGORY_METADATA[rec.categoryKey];
                  return (
                    <li
                      key={rec.id}
                      className="flex items-center justify-between gap-3 py-2.5 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Calendar
                            className="h-3.5 w-3.5 text-slate-400"
                            aria-hidden="true"
                          />
                          <span>{formatVietnameseDateTime(rec.createdAt)}</span>
                        </div>
                        <p className="text-slate-500 font-mono tabular-nums">
                          {rec.heightCm} cm · {rec.weightKg} kg
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm font-semibold text-forest-900 tabular-nums">
                          {rec.bmi.toFixed(1)}
                        </span>
                        <Badge tone={meta.tone}>
                          {rec.isUnder18 ? '< 18' : meta.labelVi}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Utensils className="h-4 w-4 text-forest-700" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Kho thực phẩm Việt Nam
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              Tra cứu dinh dưỡng theo 100g hoặc khẩu phần quen thuộc, đối chiếu dị ứng
              theo hồ sơ và so sánh thực phẩm. Bạn hiện đang lưu{' '}
              <span className="font-mono font-semibold text-forest-900">
                {favoriteIds.size}
              </span>{' '}
              món ăn yêu thích.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/foods">
                <Button size="sm" variant="primary">
                  Mở Kho thực phẩm
                </Button>
              </Link>
              <Link to="/nutrients">
                <Button size="sm" variant="outline">
                  9 nhóm dinh dưỡng
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Target className="h-4 w-4 text-forest-700" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Năng lượng, Mục tiêu &amp; Nhật ký
              </h2>
            </div>
            {isUnder18 ? (
              <p className="text-xs leading-relaxed text-slate-600">
                Ở chế độ giới hạn dưới 18 tuổi, bạn có thể ghi lại món ăn hàng ngày tại{' '}
                <strong>Nhật ký ăn uống</strong> và lập <strong>Danh sách đi chợ</strong>{' '}
                (không hiển thị mức calo hay mục tiêu giảm cân).
              </p>
            ) : currentGoal ? (
              <p className="text-xs leading-relaxed text-slate-600">
                Mục tiêu hiện tại:{' '}
                <strong>{GOAL_TYPE_LABELS[currentGoal.goalType]}</strong>
                {currentGoal.targetKcal !== null && (
                  <>
                    {' '}
                    · Tham khảo:{' '}
                    <span className="font-mono font-semibold text-forest-900 tabular-nums">
                      {currentGoal.targetKcal.toLocaleString('vi-VN')} kcal/ngày
                    </span>{' '}
                    (Ước tính)
                  </>
                )}
                .
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-slate-600">
                Chưa có mục tiêu nào được lưu. Bạn có thể ước tính BMR/TDEE, đặt mục tiêu
                an toàn hoặc ghi nhật ký ăn uống hàng ngày.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/diary">
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<BookOpen className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Nhật ký ăn uống
                </Button>
              </Link>
              {!isUnder18 && (
                <>
                  <Link to="/energy">
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Flame className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      Tính BMR/TDEE
                    </Button>
                  </Link>
                  <Link to="/goals">
                    <Button
                      size="sm"
                      variant="outline"
                      leftIcon={<Target className="h-3.5 w-3.5" aria-hidden="true" />}
                    >
                      Mục tiêu
                    </Button>
                  </Link>
                </>
              )}
              <Link to="/shopping-list">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={
                    <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
                  }
                >
                  Đi chợ
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <DisclaimerBanner />
    </div>
  );
}
