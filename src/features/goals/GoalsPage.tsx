import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Badge,
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
import { calculateBMR, calculateTDEE } from '@/src/lib/calculations';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import {
  deleteCurrentGoal,
  saveCurrentGoal,
} from '@/src/lib/firebase/goalsService';
import {
  calculateAgeFromBirthYear,
  formatDisplayDateKeyVi,
  getTodayDateKey,
} from '@/src/lib/format/date';
import {
  buildCalorieTarget,
  evaluateGoalDurationWeeks,
  GOAL_SAFETY_SCREENING_QUESTIONS,
  GOAL_TYPE_LABELS,
  GOAL_TYPE_OPTIONS,
  MAX_DAILY_DEFICIT_KCAL,
  MAX_WEEKLY_WEIGHT_CHANGE_KG,
  MIN_DAILY_KCAL_BY_SEX,
  MIN_GOAL_DURATION_WEEKS,
} from '@/src/lib/safety';
import { goalFormSchema, type GoalFormValues } from '@/src/lib/validation/schemas';
import type { GoalType } from '@/src/types/stage3';

export function GoalsPage() {
  const { user, profile, profileLoading, currentGoal, goalLoading, goalError } =
    useAuth();

  // Sàng lọc an toàn CHỈ lưu trong component state — KHÔNG BAO GIỜ ghi vào Firestore.
  const [screeningChecks, setScreeningChecks] = useState<Record<string, boolean>>(
    {}
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const hasScreeningRisk = useMemo(
    () => Object.values(screeningChecks).some(Boolean),
    [screeningChecks]
  );

  const profileAge = profile
    ? calculateAgeFromBirthYear(profile.birthYear)
    : null;
  const isUnder18 = profileAge !== null && profileAge < 18;

  const estimatedTdee = useMemo(() => {
    if (!profile || profileAge === null || profileAge < 18) return null;
    const formulaSex = profile.sex === 'female' ? 'female' : 'male';
    const bmr = calculateBMR({
      weightKg: profile.weightKg,
      heightCm: profile.heightCm,
      age: profileAge,
      sex: formulaSex,
    });
    return calculateTDEE(bmr, profile.activityLevel);
  }, [profile, profileAge]);

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema) as Resolver<GoalFormValues>,
    defaultValues: {
      goalType: 'healthy_habits',
      startWeightKg: profile?.weightKg ?? 65,
      targetWeightKg: null,
      weeklyChangeKg: 0.25,
      educationalConfirmed: false,
    },
  });

  useEffect(() => {
    if (currentGoal) {
      form.reset({
        goalType: currentGoal.goalType,
        startWeightKg: currentGoal.startWeightKg,
        targetWeightKg: currentGoal.targetWeightKg,
        weeklyChangeKg: currentGoal.weeklyChangeKg || 0.25,
        educationalConfirmed: currentGoal.educationalConfirmed,
      });
    } else if (profile) {
      form.reset({
        goalType: 'healthy_habits',
        startWeightKg: profile.weightKg,
        targetWeightKg: null,
        weeklyChangeKg: 0.25,
        educationalConfirmed: false,
      });
    }
  }, [currentGoal, profile, form]);

  const watchedGoalType = form.watch('goalType');
  const watchedStartWeight = Number(form.watch('startWeightKg')) || 0;
  const watchedTargetWeightRaw = form.watch('targetWeightKg');
  const watchedTargetWeight =
    watchedTargetWeightRaw === null || watchedTargetWeightRaw === undefined
      ? null
      : Number(watchedTargetWeightRaw);
  const watchedWeeklyPace = Number(form.watch('weeklyChangeKg')) || 0;

  // Nếu có bất kỳ câu trả lời sàng lọc "Có", khóa ngay các mục tiêu calo/giảm-tăng cân
  useEffect(() => {
    if (hasScreeningRisk && watchedGoalType !== 'healthy_habits') {
      form.setValue('goalType', 'healthy_habits', { shouldValidate: true });
    }
  }, [hasScreeningRisk, watchedGoalType, form]);

  const effectiveGoalType: GoalType = hasScreeningRisk
    ? 'healthy_habits'
    : watchedGoalType;

  const targetComputation = useMemo(() => {
    if (!estimatedTdee || !profile) return null;
    return buildCalorieTarget({
      tdee: estimatedTdee,
      sex: profile.sex,
      goalType: effectiveGoalType,
      requestedWeeklyChangeKg:
        effectiveGoalType === 'lose_gradual' ||
        effectiveGoalType === 'gain_gradual'
          ? watchedWeeklyPace
          : 0,
    });
  }, [estimatedTdee, profile, effectiveGoalType, watchedWeeklyPace]);

  const durationCheck = useMemo(() => {
    if (!targetComputation) return null;
    if (
      effectiveGoalType !== 'lose_gradual' &&
      effectiveGoalType !== 'gain_gradual'
    ) {
      return null;
    }
    return evaluateGoalDurationWeeks(
      watchedStartWeight,
      Number.isFinite(watchedTargetWeight) ? watchedTargetWeight : null,
      targetComputation.effectiveWeeklyChangeKg
    );
  }, [
    targetComputation,
    effectiveGoalType,
    watchedStartWeight,
    watchedTargetWeight,
  ]);

  const handleSaveGoal = async (values: GoalFormValues) => {
    if (!user || !profile || !targetComputation) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const safeGoalType: GoalType = hasScreeningRisk
        ? 'healthy_habits'
        : values.goalType;

      const finalTarget = buildCalorieTarget({
        tdee: estimatedTdee ?? 1800,
        sex: profile.sex,
        goalType: safeGoalType,
        requestedWeeklyChangeKg:
          safeGoalType === 'lose_gradual' || safeGoalType === 'gain_gradual'
            ? values.weeklyChangeKg
            : 0,
      });

      await saveCurrentGoal(
        user.uid,
        {
          goalType: safeGoalType,
          startDate: currentGoal?.startDate || getTodayDateKey(),
          startWeightKg: values.startWeightKg,
          targetWeightKg:
            safeGoalType === 'healthy_habits'
              ? null
              : (values.targetWeightKg ?? null),
          weeklyChangeKg: finalTarget.effectiveWeeklyChangeKg,
          targetKcal: finalTarget.targetKcal,
          educationalConfirmed: values.educationalConfirmed,
        },
        Boolean(currentGoal)
      );

      setIsEditing(false);
      setFeedback({
        tone: 'success',
        text: 'Đã lưu mục tiêu dinh dưỡng vào hồ sơ của bạn.',
      });
    } catch (error) {
      setFeedback({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndGoal = async () => {
    if (!user) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await deleteCurrentGoal(user.uid);
      setEndModalOpen(false);
      setIsEditing(false);
      setFeedback({
        tone: 'success',
        text: 'Đã kết thúc mục tiêu hiện tại. Bạn có thể thiết lập mục tiêu mới bất cứ lúc nào.',
      });
    } catch (error) {
      setFeedback({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(error),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (profileLoading || goalLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Mục tiêu dinh dưỡng cá nhân
          </h1>
          <p className="text-sm text-slate-600">
            Cần hoàn tất hồ sơ cá nhân để xác định độ tuổi (≥ 18 tuổi) và các chỉ số
            tham chiếu trước khi đặt mục tiêu.
          </p>
        </div>

        <EmptyState
          icon={<Target className="h-5 w-5" aria-hidden="true" />}
          title="Chưa có hồ sơ cá nhân"
          description="Vui lòng cập nhật năm sinh, chiều cao, cân nặng, mức vận động và xác nhận đồng ý lưu dữ liệu trong Hồ sơ cá nhân trước."
          action={
            <Link to="/profile">
              <Button variant="primary">Thiết lập Hồ sơ cá nhân</Button>
            </Link>
          }
        />

        <DisclaimerBanner />
      </div>
    );
  }

  if (isUnder18) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Mục tiêu dinh dưỡng cá nhân
          </h1>
          <p className="text-sm text-slate-600">
            Tính năng đặt mục tiêu năng lượng và cân nặng chỉ dành cho người trưởng thành.
          </p>
        </div>

        <Alert
          tone="warning"
          title="Chế độ giới hạn dành cho người dưới 18 tuổi"
        >
          Tài khoản dưới 18 tuổi không sử dụng mục tiêu calo hay kế hoạch giảm cân.
          Trẻ em và thanh thiếu niên cần được đánh giá theo biểu đồ BMI theo tuổi (WHO)
          bởi bác sĩ hoặc chuyên gia dinh dưỡng. Bạn vẫn có thể sử dụng Kho thực phẩm và
          Nhật ký ăn uống ở chế độ xem thông tin món ăn.
        </Alert>

        <div className="flex flex-wrap gap-3">
          <Link to="/diary">
            <Button variant="primary">Mở Nhật ký ăn uống</Button>
          </Link>
          <Link to="/foods">
            <Button variant="outline">Khám phá Kho thực phẩm</Button>
          </Link>
        </div>

        <DisclaimerBanner />
      </div>
    );
  }

  const showForm = !currentGoal || isEditing;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Mục tiêu dinh dưỡng (≥ 18 tuổi)
          </h1>
          <p className="text-sm text-slate-600">
            Thiết lập định hướng ăn uống an toàn với kiểm tra sàng lọc sức khỏe và giới
            hạn năng lượng tối thiểu.
          </p>
        </div>
        <Link to="/energy">
          <Button variant="outline" size="sm">
            Xem công cụ tính BMR/TDEE
          </Button>
        </Link>
      </div>

      {goalError && <Alert tone="danger">{goalError}</Alert>}
      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {/* Active Goal Summary View */}
      {currentGoal && !isEditing && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-900">
                  Mục tiêu đang hoạt động
                </h2>
                <Badge tone="success">Đang theo dõi</Badge>
              </div>
              <p className="text-xs text-slate-500">
                Bắt đầu từ ngày {formatDisplayDateKeyVi(currentGoal.startDate)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                leftIcon={<Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Chỉnh sửa
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setEndModalOpen(true)}
                leftIcon={<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Kết thúc mục tiêu
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
              <p className="text-xs text-slate-500">Định hướng mục tiêu</p>
              <p className="text-sm font-semibold text-slate-900">
                {GOAL_TYPE_LABELS[currentGoal.goalType]}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Mức năng lượng tham khảo</p>
                {currentGoal.targetKcal !== null && (
                  <Badge tone="warning">Ước tính</Badge>
                )}
              </div>
              <p className="font-mono text-xl font-bold text-forest-900 tabular-nums">
                {currentGoal.targetKcal !== null
                  ? `${currentGoal.targetKcal.toLocaleString('vi-VN')} kcal/ngày`
                  : 'Không đặt mức calo'}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
              <p className="text-xs text-slate-500">Cân nặng bắt đầu / mục tiêu</p>
              <p className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                {currentGoal.startWeightKg} kg
                {currentGoal.targetWeightKg !== null
                  ? ` → ${currentGoal.targetWeightKg} kg`
                  : ''}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-1">
              <p className="text-xs text-slate-500">Tốc độ tối đa mỗi tuần</p>
              <p className="font-mono text-base font-semibold text-slate-900 tabular-nums">
                {currentGoal.weeklyChangeKg > 0
                  ? `${currentGoal.weeklyChangeKg} kg/tuần`
                  : 'Không đặt nhịp thay đổi'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-xs text-slate-500">
              Bạn có thể sử dụng mức tham khảo này trong Nhật ký ăn uống hàng ngày.
            </p>
            <Link to="/diary">
              <Button variant="primary" size="sm">
                Mở Nhật ký ăn uống hôm nay
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Goal Creation / Editing Flow */}
      {showForm && (
        <div className="space-y-6">
          {/* 4.2 Safety Screening (component state only) */}
          <Card className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-forest-200 bg-forest-50 text-forest-800">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  Sàng lọc an toàn trước khi thiết lập mục tiêu
                </h2>
                <p className="text-xs leading-relaxed text-slate-600">
                  Vì lý do riêng tư và an toàn, câu trả lời bên dưới{' '}
                  <strong>chỉ xử lý tạm thời trên trình duyệt</strong> và{' '}
                  <strong>không bao giờ được lưu vào cơ sở dữ liệu</strong>. Hãy đánh
                  dấu nếu bạn thuộc một trong các trường hợp sau:
                </p>
              </div>
            </div>

            <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              {GOAL_SAFETY_SCREENING_QUESTIONS.map((q) => (
                <label
                  key={q.id}
                  className="flex items-start gap-3 cursor-pointer text-sm text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(screeningChecks[q.id])}
                    onChange={(e) =>
                      setScreeningChecks((prev) => ({
                        ...prev,
                        [q.id]: e.target.checked,
                      }))
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-forest-800 focus:ring-forest-600"
                  />
                  <span>{q.labelVi}</span>
                </label>
              ))}
            </div>

            {hasScreeningRisk && (
              <Alert
                tone="warning"
                title="Khuyến nghị tham khảo ý kiến bác sĩ hoặc chuyên gia dinh dưỡng"
              >
                <p>
                  Vì bạn đã đánh dấu ít nhất một yếu tố cần theo dõi y tế đặc biệt,
                  ứng dụng <strong>không tạo mục tiêu giảm cân hay mức calo</strong> để
                  đảm bảo an toàn. Bạn vui lòng trao đổi trực tiếp với bác sĩ hoặc
                  chuyên gia dinh dưỡng. Hiện chỉ mục tiêu{' '}
                  <strong>&ldquo;Thói quen ăn uống lành mạnh&rdquo;</strong> (không có
                  con số calo) được mở để bạn sử dụng.
                </p>
              </Alert>
            )}
          </Card>

          {/* Goal Settings Form */}
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  {currentGoal ? 'Cập nhật mục tiêu' : 'Chọn mục tiêu phù hợp'}
                </h2>
                <p className="text-xs text-slate-500">
                  TDEE ước tính từ hồ sơ hiện tại:{' '}
                  <span className="font-mono font-semibold text-slate-800 tabular-nums">
                    {estimatedTdee ? `${Math.round(estimatedTdee).toLocaleString('vi-VN')} kcal/ngày` : '—'}
                  </span>{' '}
                  (Ước tính)
                </p>
              </div>
              {isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Hủy chỉnh sửa
                </Button>
              )}
            </div>

            <form
              onSubmit={form.handleSubmit(handleSaveGoal)}
              noValidate
              className="space-y-5"
            >
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-800">
                  Loại mục tiêu <span className="text-red-600">*</span>
                </p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {GOAL_TYPE_OPTIONS.map((option) => {
                    const disabled =
                      hasScreeningRisk && option.value !== 'healthy_habits';
                    const selected = effectiveGoalType === option.value;
                    return (
                      <label
                        key={option.value}
                        className={`flex flex-col gap-1.5 rounded-xl border p-4 transition-colors ${
                          disabled
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100/70 opacity-60'
                            : selected
                              ? 'cursor-pointer border-forest-700 bg-forest-50/70'
                              : 'cursor-pointer border-slate-200 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            value={option.value}
                            disabled={disabled}
                            checked={selected}
                            onChange={() =>
                              form.setValue('goalType', option.value, {
                                shouldValidate: true,
                              })
                            }
                            className="h-4 w-4 text-forest-800 focus:ring-forest-600"
                          />
                          <span className="text-sm font-semibold text-slate-900">
                            {option.labelVi}
                          </span>
                        </div>
                        <p className="pl-6 text-xs leading-relaxed text-slate-600">
                          {option.descriptionVi}
                        </p>
                      </label>
                    );
                  })}
                </div>
              </div>

              {effectiveGoalType !== 'healthy_habits' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    id="goal-start-weight"
                    label="Cân nặng hiện tại"
                    required
                    error={form.formState.errors.startWeightKg?.message}
                  >
                    <Input
                      id="goal-start-weight"
                      type="text"
                      inputMode="decimal"
                      unitLabel="kg"
                      hasError={Boolean(form.formState.errors.startWeightKg)}
                      {...form.register('startWeightKg')}
                    />
                  </FormField>

                  <FormField
                    id="goal-target-weight"
                    label="Cân nặng mục tiêu (tùy chọn)"
                    error={form.formState.errors.targetWeightKg?.message}
                  >
                    <Input
                      id="goal-target-weight"
                      type="text"
                      inputMode="decimal"
                      unitLabel="kg"
                      placeholder="Để trống nếu không đặt"
                      hasError={Boolean(form.formState.errors.targetWeightKg)}
                      {...form.register('targetWeightKg')}
                    />
                  </FormField>

                  {(effectiveGoalType === 'lose_gradual' ||
                    effectiveGoalType === 'gain_gradual') && (
                    <FormField
                      id="goal-weekly-pace"
                      label="Nhịp thay đổi mong muốn"
                      hint={`Giới hạn an toàn: tối đa ${
                        effectiveGoalType === 'lose_gradual'
                          ? MAX_WEEKLY_WEIGHT_CHANGE_KG.loss
                          : MAX_WEEKLY_WEIGHT_CHANGE_KG.gain
                      } kg/tuần`}
                      error={form.formState.errors.weeklyChangeKg?.message}
                    >
                      <Select
                        id="goal-weekly-pace"
                        options={[
                          { value: '0.25', label: '0.25 kg / tuần (Nhẹ nhàng)' },
                          { value: '0.5', label: '0.50 kg / tuần (Tối đa an toàn)' },
                        ]}
                        {...form.register('weeklyChangeKg')}
                      />
                    </FormField>
                  )}
                </div>
              )}

              {/* Live Clamped Calorie Target Preview */}
              {targetComputation && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Xem trước mức năng lượng tham khảo hàng ngày
                    </span>
                    <Badge
                      tone={
                        targetComputation.targetKcal === null
                          ? 'success'
                          : 'warning'
                      }
                    >
                      {targetComputation.targetKcal === null
                        ? 'Không đặt mức calo'
                        : 'Ước tính'}
                    </Badge>
                  </div>

                  {targetComputation.targetKcal !== null ? (
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold text-forest-900 tabular-nums">
                        {targetComputation.targetKcal.toLocaleString('vi-VN')}
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        kcal/ngày
                      </span>
                      <span className="text-xs text-slate-500">
                        (Ngưỡng tối thiểu cấu hình:{' '}
                        {MIN_DAILY_KCAL_BY_SEX[profile.sex]} kcal/ngày · Thâm hụt tối
                        đa: {MAX_DAILY_DEFICIT_KCAL} kcal/ngày)
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-700">
                      Mục tiêu tập trung vào thói quen ăn uống cân bằng mà không ràng
                      buộc con số calo hay cân nặng.
                    </p>
                  )}

                  {targetComputation.wasAdjusted && targetComputation.messageVi && (
                    <Alert tone="warning" title="Mức mục tiêu đã được điều chỉnh an toàn">
                      {targetComputation.messageVi}
                    </Alert>
                  )}

                  {durationCheck?.estimatedWeeks !== null &&
                    durationCheck?.belowRecommendedMinimum && (
                      <Alert tone="info" title="Lưu ý về thời gian thực hiện">
                        Với khoảng thay đổi hiện tại (~{durationCheck.estimatedWeeks}{' '}
                        tuần), thời gian ngắn hơn mức tối thiểu khuyến nghị (
                        {MIN_GOAL_DURATION_WEEKS} tuần) để tạo thói quen bền vững. Hãy cân
                        nhắc đặt nhịp độ chậm hơn.
                      </Alert>
                    )}
                </div>
              )}

              {/* Mandatory educational confirmation checkbox */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-forest-800 focus:ring-forest-600"
                    {...form.register('educationalConfirmed')}
                  />
                  <span>
                    Tôi hiểu đây là thông tin tham khảo mang tính giáo dục, không phải
                    chỉ định điều trị hay thực đơn y khoa cá nhân hóa.
                  </span>
                </label>
                {form.formState.errors.educationalConfirmed && (
                  <p className="text-xs text-red-700">
                    {form.formState.errors.educationalConfirmed.message}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  isLoading={isSaving}
                  leftIcon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                >
                  {currentGoal ? 'Lưu cập nhật mục tiêu' : 'Lưu mục tiêu'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <DisclaimerBanner />

      <Modal
        open={endModalOpen}
        onClose={() => setEndModalOpen(false)}
        title="Kết thúc mục tiêu hiện tại?"
        description="Mục tiêu hiện tại sẽ được gỡ bỏ khỏi hồ sơ. Dữ liệu nhật ký ăn uống và lịch sử BMI của bạn vẫn được giữ nguyên."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setEndModalOpen(false)}
              disabled={isDeleting}
            >
              Giữ lại
            </Button>
            <Button
              variant="danger"
              onClick={handleEndGoal}
              isLoading={isDeleting}
              leftIcon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
            >
              Xác nhận kết thúc
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Bạn luôn có thể thiết lập lại mục tiêu mới bất cứ lúc nào sau khi kết thúc.
        </p>
      </Modal>
    </div>
  );
}
