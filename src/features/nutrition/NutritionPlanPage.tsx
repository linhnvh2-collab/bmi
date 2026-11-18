import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Droplets,
  Flame,
  Info,
  Leaf,
  ShieldAlert,
  Sparkles,
  Utensils,
} from 'lucide-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  DisclaimerBanner,
  FormField,
  Input,
  Select,
  StatCard,
} from '@/src/components/ui';
import { VerificationBadge } from '@/src/features/foods/components';
import { ACTIVITY_LEVEL_OPTIONS, BMI_INPUT_LIMITS } from '@/src/lib/calculations';
import { fetchFoods } from '@/src/lib/firebase/foodsService';
import {
  calculateAgeFromBirthDate,
  calculateAgeFromBirthYear,
} from '@/src/lib/format/date';
import {
  BUDGET_LEVEL_OPTIONS,
  buildPersonalizedNutritionPlan,
  DIET_MODE_OPTIONS,
  FOOD_CATEGORY_LABELS,
  NUTRITION_GOAL_OPTIONS,
  PREP_TIME_OPTIONS,
} from '@/src/lib/nutrition';
import type { FoodItem } from '@/src/types/food';
import type {
  ActivityLevel,
  BudgetLevel,
  DietMode,
  NutritionGoalMode,
  PrepTimePreference,
  SexOption,
} from '@/src/types/health';

const MACRO_COLORS = ['#1B4332', '#2D6A4F', '#D97706'];

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function NutritionPlanPage() {
  const { user, profile } = useAuth();

  const profileAge = profile
    ? (profile.birthDate
        ? calculateAgeFromBirthDate(profile.birthDate)
        : null) ?? calculateAgeFromBirthYear(profile.birthYear)
    : null;

  const [ageRaw, setAgeRaw] = useState<string>('28');
  const [sex, setSex] = useState<SexOption | ''>('other');
  const [heightRaw, setHeightRaw] = useState<string>('170');
  const [weightRaw, setWeightRaw] = useState<string>('65');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | ''>('moderate');
  const [nutritionGoal, setNutritionGoal] =
    useState<NutritionGoalMode>('nutrition_balance');
  const [dietMode, setDietMode] = useState<DietMode>('balanced');
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel>('standard');
  const [prepTimePreference, setPrepTimePreference] =
    useState<PrepTimePreference>('moderate');
  const [mealsPerDay, setMealsPerDay] = useState<3 | 4 | 5>(4);
  const [catalogFoods, setCatalogFoods] = useState<FoodItem[]>([]);
  // Client-only medical safety screening (NEVER stored in Firestore)
  const [hasMedicalScreeningRisk, setHasMedicalScreeningRisk] = useState(false);

  useEffect(() => {
    void fetchFoods({ includeInactive: false })
      .then(setCatalogFoods)
      .catch(() => setCatalogFoods([]));
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (profileAge !== null) setAgeRaw(String(profileAge));
    setSex(profile.sex);
    setHeightRaw(String(profile.heightCm));
    setWeightRaw(String(profile.weightKg));
    setActivityLevel(profile.activityLevel);
    if (profile.nutritionGoal) setNutritionGoal(profile.nutritionGoal);
    if (profile.dietMode) setDietMode(profile.dietMode);
    if (profile.budgetLevel) setBudgetLevel(profile.budgetLevel);
    if (profile.prepTimePreference)
      setPrepTimePreference(profile.prepTimePreference);
    if (profile.mealsPerDay) setMealsPerDay(profile.mealsPerDay);
  }, [profile, profileAge]);

  const plan = useMemo(() => {
    return buildPersonalizedNutritionPlan({
      age: parseOptionalNumber(ageRaw),
      sex: sex || null,
      heightCm: parseOptionalNumber(heightRaw),
      weightKg: parseOptionalNumber(weightRaw),
      activityLevel: activityLevel || null,
      nutritionGoal,
      dietMode,
      budgetLevel,
      prepTimePreference,
      mealsPerDay,
      allergens: profile?.allergens ?? [],
      dislikedFoods: profile?.dislikedFoods ?? [],
      hasMedicalScreeningRisk,
      catalog: catalogFoods.length > 0 ? catalogFoods : undefined,
    });
  }, [
    ageRaw,
    sex,
    heightRaw,
    weightRaw,
    activityLevel,
    nutritionGoal,
    dietMode,
    budgetLevel,
    prepTimePreference,
    mealsPerDay,
    profile?.allergens,
    profile?.dislikedFoods,
    hasMedicalScreeningRisk,
    catalogFoods,
  ]);

  const macroChartData = useMemo(() => {
    if (!plan.macros) return [];
    return [
      {
        name: `Đạm (${plan.macros.proteinPct}%)`,
        value: plan.macros.proteinKcal,
        grams: plan.macros.proteinG,
      },
      {
        name: `Tinh bột (${plan.macros.carbPct}%)`,
        value: plan.macros.carbKcal,
        grams: plan.macros.carbG,
      },
      {
        name: `Chất béo (${plan.macros.fatPct}%)`,
        value: plan.macros.fatKcal,
        grams: plan.macros.fatG,
      },
    ];
  }, [plan]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Kế hoạch dinh dưỡng cá nhân hóa (Ước tính học tập)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Phân tích thể trạng &amp; Chế độ dinh dưỡng cá nhân
          </h1>
          <p className="text-sm text-slate-600">
            Tổng hợp BMI, BMR/TDEE (khi đủ thông số sinh học), tỷ lệ đạm–tinh
            bột–béo, bảng đề xuất cá nhân và thực phẩm Việt phù hợp.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {user && (
            <Link to="/profile">
              <Button variant="outline" size="sm">
                Cập nhật hồ sơ gốc
              </Button>
            </Link>
          )}
          <Link to="/meal-planner">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Utensils className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Tạo thực đơn AI
            </Button>
          </Link>
        </div>
      </div>

      {/* Interactive Profile Parameters */}
      <Card className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Thông số phân tích thể trạng
            </h2>
            <p className="text-xs text-slate-500">
              {profile
                ? 'Đã đồng bộ từ hồ sơ cá nhân. Hệ thống không tự suy đoán giá trị nếu bạn xóa trống thông số.'
                : 'Chế độ khách: nhập đầy đủ thông số để xem gợi ý kế hoạch dinh dưỡng.'}
            </p>
          </div>
          <Badge tone="warning">Mọi con số chỉ mang tính Ước tính tham khảo</Badge>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="np-age" label="Độ tuổi">
            <Input
              id="np-age"
              type="number"
              min={BMI_INPUT_LIMITS.LIMITED_AGE_MIN}
              max={BMI_INPUT_LIMITS.AGE_MAX}
              value={ageRaw}
              placeholder="VD: 28"
              onChange={(e) => setAgeRaw(e.target.value)}
            />
          </FormField>

          <FormField
            id="np-sex"
            label="Thông số sinh học (tính BMR)"
            hint="Không tự mặc định nếu chọn Khác / Chưa cung cấp."
          >
            <Select
              id="np-sex"
              value={sex}
              onChange={(e) => setSex(e.target.value as SexOption | '')}
              options={[
                { value: 'male', label: 'Nam' },
                { value: 'female', label: 'Nữ' },
                { value: 'other', label: 'Khác / Không cung cấp' },
              ]}
            />
          </FormField>

          <FormField id="np-height" label="Chiều cao">
            <Input
              id="np-height"
              type="number"
              unitLabel="cm"
              min={BMI_INPUT_LIMITS.HEIGHT_CM_MIN}
              max={BMI_INPUT_LIMITS.HEIGHT_CM_MAX}
              value={heightRaw}
              placeholder="VD: 170"
              onChange={(e) => setHeightRaw(e.target.value)}
            />
          </FormField>

          <FormField id="np-weight" label="Cân nặng">
            <Input
              id="np-weight"
              type="number"
              unitLabel="kg"
              min={BMI_INPUT_LIMITS.WEIGHT_KG_MIN}
              max={BMI_INPUT_LIMITS.WEIGHT_KG_MAX}
              value={weightRaw}
              placeholder="VD: 65"
              onChange={(e) => setWeightRaw(e.target.value)}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <FormField id="np-activity" label="Mức độ vận động">
            <Select
              id="np-activity"
              value={activityLevel}
              onChange={(e) =>
                setActivityLevel(e.target.value as ActivityLevel | '')
              }
              options={[
                { value: '', label: 'Chưa chọn mức vận động' },
                ...ACTIVITY_LEVEL_OPTIONS.map((a) => ({
                  value: a.value,
                  label: a.labelVi,
                })),
              ]}
            />
          </FormField>

          <FormField id="np-goal" label="Mục tiêu dinh dưỡng">
            <Select
              id="np-goal"
              value={plan.isUnder18 || hasMedicalScreeningRisk ? 'healthy_habits' : nutritionGoal}
              disabled={plan.isUnder18 || hasMedicalScreeningRisk}
              onChange={(e) =>
                setNutritionGoal(e.target.value as NutritionGoalMode)
              }
              options={NUTRITION_GOAL_OPTIONS.map((g) => ({
                value: g.value,
                label: g.labelVi,
              }))}
            />
          </FormField>

          <FormField id="np-diet-mode" label="Chế độ ăn áp dụng">
            <Select
              id="np-diet-mode"
              value={dietMode}
              onChange={(e) => setDietMode(e.target.value as DietMode)}
              options={DIET_MODE_OPTIONS.map((d) => ({
                value: d.value,
                label: d.labelVi,
              }))}
            />
          </FormField>

          <FormField id="np-budget" label="Ngân sách bữa ăn">
            <Select
              id="np-budget"
              value={budgetLevel}
              onChange={(e) => setBudgetLevel(e.target.value as BudgetLevel)}
              options={BUDGET_LEVEL_OPTIONS.map((b) => ({
                value: b.value,
                label: b.labelVi,
              }))}
            />
          </FormField>

          <FormField id="np-prep" label="Thời gian chuẩn bị">
            <Select
              id="np-prep"
              value={prepTimePreference}
              onChange={(e) =>
                setPrepTimePreference(e.target.value as PrepTimePreference)
              }
              options={PREP_TIME_OPTIONS.map((p) => ({
                value: p.value,
                label: p.labelVi,
              }))}
            />
          </FormField>
        </div>

        {/* Client-only Medical Safety Screening Gate */}
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 text-xs text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={hasMedicalScreeningRisk}
            onChange={(e) => setHasMedicalScreeningRisk(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-forest-800"
          />
          <span>
            <strong>Sàng lọc an toàn (không lưu lên máy chủ):</strong> Tôi đang
            mang thai, cho con bú, đang điều trị bệnh lý chuyển hóa/thận/tim mạch
            hoặc có tiền sử rối loạn ăn uống. Nếu chọn ô này, hệ thống chỉ gợi ý{' '}
            <em>thói quen ăn uống lành mạnh</em>, không gợi ý thâm hụt calo giảm cân.
          </span>
        </label>
      </Card>

      {!plan.hasSufficientBodyMetrics || plan.bmi === null || !plan.bmiClassification ? (
        <Alert tone="warning" title={plan.bodyStateTitleVi}>
          <div className="space-y-1.5 text-xs">
            <p>{plan.bodyStateAdviceVi}</p>
            <p className="font-medium text-amber-900">
              Còn thiếu / chưa hợp lệ: {plan.missingFields.join('; ')}.
            </p>
          </div>
        </Alert>
      ) : plan.isUnder18 ? (
        /* Under 18 Strict Limited Mode */
        <div className="space-y-5">
          <Alert tone="warning" title={plan.bodyStateTitleVi}>
            <div className="space-y-2 text-xs leading-relaxed">
              <p>{plan.bodyStateAdviceVi}</p>
              <p>
                Chỉ số BMI hiện tại:{' '}
                <strong className="font-mono">{plan.bmi.toFixed(1)} kg/m²</strong>{' '}
                (không phân loại ngưỡng người trưởng thành). Lượng nước tham khảo:{' '}
                <strong className="font-mono">
                  ~{plan.waterLitresEstimated} lít/ngày
                </strong>{' '}
                (Ước tính).
              </p>
            </div>
          </Alert>

          <Card className="space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Gợi ý học tập dinh dưỡng phù hợp lứa tuổi
            </h2>
            <p className="text-xs leading-relaxed text-slate-600">
              Bạn vẫn có thể khám phá Kho thực phẩm Việt Nam, học cách kết hợp 9 nhóm
              chất dinh dưỡng hoặc dùng Trình tạo thực đơn AI ở chế độ xây dựng thói
              quen ăn uống lành mạnh (không thiết lập giới hạn calo).
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <Link to="/nutrients">
                <Button variant="outline" size="sm">
                  Xem 9 nhóm dinh dưỡng
                </Button>
              </Link>
              <Link to="/meal-planner">
                <Button variant="primary" size="sm">
                  Lập thực đơn lành mạnh
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        /* Adult Personalized Plan */
        <div className="space-y-6">
          {hasMedicalScreeningRisk && (
            <Alert tone="warning" title="Đang bật chế độ ưu tiên an toàn sức khỏe">
              <div className="flex items-start gap-2 text-xs">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Hệ thống đã khóa mục tiêu giảm cân/thâm hụt calo và chuyển sang gợi
                  ý cân bằng thói quen lành mạnh. Hãy trao đổi trực tiếp với bác sĩ
                  điều trị để có hướng dẫn cá nhân hóa chính xác.
                </span>
              </div>
            </Alert>
          )}

          {plan.missingTdeeReasonVi && (
            <Alert tone="info" title="Chưa thể tính đầy đủ BMR / TDEE">
              <div className="flex items-start gap-2 text-xs">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{plan.missingTdeeReasonVi}</span>
              </div>
            </Alert>
          )}

          {plan.safetyAdjustmentMessageVi && (
            <Alert tone="info" title="Điều chỉnh giới hạn an toàn">
              {plan.safetyAdjustmentMessageVi}
            </Alert>
          )}

          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="BMI hiện tại"
              value={plan.bmi.toFixed(1)}
              unit="kg/m²"
              badge={
                <Badge tone={plan.bmiClassification.tone}>
                  {plan.bmiClassification.labelVi}
                </Badge>
              }
              caption="Ngưỡng tham khảo người châu Á"
            />
            <StatCard
              label="BMR · TDEE ước tính"
              value={
                plan.bmr !== null
                  ? `${plan.bmr} · ${plan.tdee ?? 'Chưa tính'}`
                  : 'Chưa đủ thông số'
              }
              unit={plan.bmr !== null ? 'kcal' : undefined}
              caption={
                plan.bmr !== null
                  ? 'Mifflin-St Jeor (Ước tính)'
                  : 'Cần chọn giới tính sinh học (Nam/Nữ)'
              }
            />
            <StatCard
              label="Mục tiêu năng lượng gợi ý"
              value={
                plan.targetKcal !== null
                  ? plan.targetKcal.toLocaleString('vi-VN')
                  : 'Không đặt calo'
              }
              unit={plan.targetKcal !== null ? 'kcal/ngày' : undefined}
              caption={
                plan.targetKcal !== null
                  ? `Ước tính · Phân bổ ${plan.mealsPerDay} bữa/ngày`
                  : plan.bmr === null
                    ? 'Thiếu BMR/TDEE nên không ước tính kcal'
                    : 'Chế độ xây dựng thói quen lành mạnh'
              }
            />
            <StatCard
              label="Nước uống & Chất xơ gợi ý"
              value={`${plan.waterLitresEstimated ?? '—'} L · ${plan.fiberTargetG ?? 25}g`}
              caption="Ước tính theo cân nặng & khẩu phần"
            />
          </div>

          {/* Body State Advisory + Macro Split Chart */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <Leaf className="h-4 w-4 text-forest-700" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Nhận định thể trạng &amp; Định hướng thực đơn
                </h2>
              </div>

              <div className="rounded-lg border border-slate-200 bg-forest-50/45 p-4 space-y-2">
                <p className="text-sm font-semibold text-forest-900">
                  {plan.bodyStateTitleVi}
                </p>
                <p className="text-xs leading-relaxed text-slate-700">
                  {plan.bodyStateAdviceVi}
                </p>
              </div>

              <div className="space-y-2.5 text-xs leading-relaxed text-slate-600">
                <div className="flex items-start gap-2">
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-forest-700"
                    aria-hidden="true"
                  />
                  {plan.bmr !== null && plan.tdee !== null ? (
                    <p>
                      <strong>Vì sao có mức gợi ý này?</strong> Nhu cầu nền (BMR){' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {plan.bmr} kcal
                      </span>{' '}
                      nhân với hệ số vận động cho TDEE{' '}
                      <span className="font-mono font-semibold text-slate-900">
                        {plan.tdee} kcal
                      </span>
                      . Chế độ <em>{DIET_MODE_OPTIONS.find((d) => d.value === dietMode)?.labelVi}</em>{' '}
                      và mục tiêu{' '}
                      <em>
                        {NUTRITION_GOAL_OPTIONS.find((g) => g.value === plan.effectiveGoal)?.labelVi}
                      </em>{' '}
                      xác định tỷ lệ Đạm / Tinh bột / Chất béo tương ứng.
                    </p>
                  ) : (
                    <p>
                      {plan.missingTdeeReasonVi ??
                        'Hệ thống chỉ hiển thị chỉ số khi đủ thông số sinh học và vận động.'}
                    </p>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <Droplets
                    className="mt-0.5 h-4 w-4 shrink-0 text-sky-700"
                    aria-hidden="true"
                  />
                  <p>
                    <strong>Bù nước hợp lý:</strong> Ước tính khoảng{' '}
                    <span className="font-mono font-semibold text-slate-900">
                      {plan.waterLitresEstimated} lít/ngày
                    </span>{' '}
                    (tính theo ~35 ml/kg, ưu tiên nước lọc, nước canh rau, trà nhạt
                    không đường).
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link to="/meal-planner">
                  <Button
                    variant="primary"
                    leftIcon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
                  >
                    Tạo thực đơn AI phù hợp kế hoạch này
                  </Button>
                </Link>
              </div>
            </Card>

            <Card className="lg:col-span-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <Flame className="h-4 w-4 text-forest-700" aria-hidden="true" />
                <h2 className="text-base font-semibold text-slate-900">
                  Phân bổ nhóm chất đa lượng tham khảo (Ước tính)
                </h2>
              </div>

              {plan.macros ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs text-slate-500">Chất đạm</p>
                      <p className="font-mono text-lg font-bold text-forest-900 tabular-nums">
                        {plan.macros.proteinG}g
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {plan.macros.proteinPct}% · {plan.macros.proteinKcal} kcal
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs text-slate-500">Tinh bột</p>
                      <p className="font-mono text-lg font-bold text-forest-700 tabular-nums">
                        {plan.macros.carbG}g
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {plan.macros.carbPct}% · {plan.macros.carbKcal} kcal
                      </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <p className="text-xs text-slate-500">Chất béo</p>
                      <p className="font-mono text-lg font-bold text-amber-700 tabular-nums">
                        {plan.macros.fatG}g
                      </p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {plan.macros.fatPct}% · {plan.macros.fatKcal} kcal
                      </p>
                    </div>
                  </div>

                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={macroChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {macroChartData.map((_, idx) => (
                            <Cell
                              key={idx}
                              fill={MACRO_COLORS[idx % MACRO_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: unknown, name: unknown) => [
                            `${Number(val)} kcal`,
                            String(name),
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs leading-relaxed text-slate-600">
                  {plan.bmr === null || plan.tdee === null ? (
                    <span>
                      Chưa đủ thông số sinh học (Nam/Nữ) hoặc mức độ vận động để
                      tính định lượng calo và gram đa lượng. Bạn vẫn có thể áp dụng
                      nguyên tắc chia đĩa ăn cân đối bên dưới.
                    </span>
                  ) : (
                    <span>
                      Ở chế độ <strong>Xây dựng thói quen ăn uống lành mạnh</strong>,
                      ứng dụng không áp đặt chỉ tiêu calo hoặc gram đa lượng cố định.
                      Hãy tập trung ăn đủ rau xanh, nguồn đạm đa dạng và hạn chế đồ
                      uống nhiều đường.
                    </span>
                  )}
                </div>
              )}
            </Card>
          </div>

          {/* Personalized Structured Comparison Table */}
          {plan.comparisonRows.length > 0 && (
            <Card className="space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h2 className="text-base font-semibold text-slate-900">
                  Bảng đối chiếu nhu cầu &amp; Đề xuất dinh dưỡng cá nhân
                </h2>
                <p className="text-xs text-slate-500">
                  Tóm tắt thể trạng hiện tại, nhu cầu tham khảo, mục tiêu cá nhân và
                  điểm cần ưu tiên cải thiện.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
                      <th className="px-3 py-2.5 font-semibold">Chỉ tiêu</th>
                      <th className="px-3 py-2.5 font-semibold">Hiện tại / Dữ liệu</th>
                      <th className="px-3 py-2.5 font-semibold">Nhu cầu tham khảo</th>
                      <th className="px-3 py-2.5 font-semibold">Mục tiêu của bạn</th>
                      <th className="px-3 py-2.5 font-semibold">Điểm cần cải thiện</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {plan.comparisonRows.map((row) => (
                      <tr key={row.metricVi} className="hover:bg-slate-50/50">
                        <td className="px-3 py-3 font-semibold text-slate-900">
                          {row.metricVi}
                        </td>
                        <td className="px-3 py-3 font-mono text-slate-700 tabular-nums">
                          {row.currentValueVi}
                        </td>
                        <td className="px-3 py-3 font-mono text-forest-800 tabular-nums">
                          {row.referenceNeedVi}
                        </td>
                        <td className="px-3 py-3 text-slate-700">
                          {row.userGoalVi}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {row.improvementFocusVi}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Recommended Foods & Limit Guidance */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className="h-4 w-4 text-forest-700"
                    aria-hidden="true"
                  />
                  <h2 className="text-base font-semibold text-slate-900">
                    Thực phẩm Việt Nam nên ưu tiên theo hồ sơ
                  </h2>
                </div>
                <span className="text-xs text-slate-500">
                  {profile?.allergens.length
                    ? `Đã loại trừ: ${profile.allergens.join(', ')}`
                    : 'Lọc theo mục tiêu & ngân sách'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {plan.recommendedFoods.map((rec) => (
                  <Link
                    key={rec.food.id}
                    to={`/foods/${rec.food.id}`}
                    className="group rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 hover:border-forest-400 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 group-hover:text-forest-800">
                          {rec.food.nameVi}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {FOOD_CATEGORY_LABELS[rec.food.category]} · ~{rec.prepTimeMinutes} phút
                        </p>
                      </div>
                      <VerificationBadge status={rec.food.verificationStatus} />
                    </div>
                    <p className="font-mono text-xs text-forest-900 tabular-nums">
                      {rec.food.nutrientsPer100g.energyKcal ?? '—'} kcal · Đạm{' '}
                      {rec.food.nutrientsPer100g.proteinG ?? '—'}g · Xơ{' '}
                      {rec.food.nutrientsPer100g.fiberG ?? '—'}g / 100g
                    </p>
                    <p className="text-xs leading-relaxed text-slate-600">
                      {rec.reasonVi}
                    </p>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="lg:col-span-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <ShieldAlert
                  className="h-4 w-4 text-amber-700"
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-slate-900">
                  Nhóm thực phẩm nên hạn chế (có căn cứ)
                </h2>
              </div>

              <div className="space-y-3">
                {plan.foodsToLimit.map((item) => (
                  <div
                    key={item.titleVi}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1"
                  >
                    <p className="text-xs font-semibold text-slate-900">
                      {item.titleVi}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-600">
                      {item.reasonVi}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      <strong>Ví dụ:</strong> {item.examplesVi}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Metric Meanings & Limitations */}
      <Card className="space-y-4">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            Ý nghĩa &amp; Giới hạn khoa học của từng chỉ số
          </h2>
          <p className="text-xs text-slate-500">
            Hiểu đúng phạm vi tham khảo của BMI, BMR, TDEE và đa lượng để sử dụng an
            toàn.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {plan.metricExplanations.map((note) => (
            <div
              key={note.titleVi}
              className="rounded-lg border border-slate-200 bg-white p-4 space-y-1.5"
            >
              <p className="text-sm font-semibold text-slate-900">
                {note.titleVi}
              </p>
              <p className="text-xs leading-relaxed text-slate-700">
                <strong>Ý nghĩa:</strong> {note.meaningVi}
              </p>
              <p className="text-xs leading-relaxed text-amber-900">
                <strong>Giới hạn:</strong> {note.limitationVi}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <DisclaimerBanner />
    </div>
  );
}
