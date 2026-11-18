import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  Check,
  Download,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Button,
  Card,
  DisclaimerBanner,
  FormField,
  Input,
  Modal,
  Select,
  Skeleton,
} from '@/src/components/ui';
import {
  ACTIVITY_LEVEL_OPTIONS,
  PROFILE_INPUT_LIMITS,
} from '@/src/lib/calculations/constants';
import {
  formatAuthErrorVi,
  formatFirestoreUiErrorVi,
} from '@/src/lib/firebase/errors';
import {
  deleteUserDataAndAccount,
  exportUserData,
  saveUserProfile,
} from '@/src/lib/firebase/profileService';
import {
  ALLERGEN_OPTIONS,
  BUDGET_LEVEL_OPTIONS,
  DIET_MODE_OPTIONS,
  DIETARY_PREFERENCE_OPTIONS,
  NUTRITION_GOAL_OPTIONS,
  PREP_TIME_OPTIONS,
} from '@/src/lib/nutrition';
import {
  calculateAgeFromBirthDate,
  calculateAgeFromBirthYear,
} from '@/src/lib/format/date';
import {
  profileFormSchema,
  type ProfileFormValues,
} from '@/src/lib/validation/schemas';
import { ConsentNoticeCard } from './ConsentNoticeCard';

const PRESET_DIETARY_PREFERENCES: readonly string[] = DIETARY_PREFERENCE_OPTIONS;
const PRESET_ALLERGENS: readonly string[] = ALLERGEN_OPTIONS;

export function ProfilePage() {
  const { user, profile, profileLoading, profileError, refreshProfile } =
    useAuth();
  const navigate = useNavigate();

  const [saveStatus, setSaveStatus] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);
  const [customDietary, setCustomDietary] = useState('');
  const [customAllergen, setCustomAllergen] = useState('');
  const [customDisliked, setCustomDisliked] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema) as Resolver<ProfileFormValues>,
    defaultValues: {
      displayName: user?.displayName || '',
      birthYear: 1995,
      birthDate: null,
      sex: 'other',
      heightCm: 170,
      weightKg: 65,
      activityLevel: 'moderate',
      dietaryPreferences: [],
      allergens: [],
      dislikedFoods: [],
      budgetLevel: 'standard',
      dailyBudgetVnd: null,
      prepTimePreference: 'moderate',
      mealsPerDay: 4,
      nutritionGoal: 'nutrition_balance',
      dietMode: 'balanced',
      consentAccepted: false,
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        displayName: profile.displayName,
        birthYear: profile.birthYear,
        birthDate: profile.birthDate ?? null,
        sex: profile.sex,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel,
        dietaryPreferences: profile.dietaryPreferences,
        allergens: profile.allergens,
        dislikedFoods: profile.dislikedFoods ?? [],
        budgetLevel: profile.budgetLevel ?? 'standard',
        dailyBudgetVnd: profile.dailyBudgetVnd ?? null,
        prepTimePreference: profile.prepTimePreference ?? 'moderate',
        mealsPerDay: profile.mealsPerDay ?? 4,
        nutritionGoal: profile.nutritionGoal ?? 'nutrition_balance',
        dietMode: profile.dietMode ?? 'balanced',
        consentAccepted: profile.consentAccepted,
      });
    } else if (user) {
      form.setValue('displayName', user.displayName || 'Người dùng');
    }
  }, [profile, user, form]);

  const birthDateVal = form.watch('birthDate');
  const birthYearVal = form.watch('birthYear');
  const resolvedAge =
    typeof birthDateVal === 'string' && birthDateVal
      ? calculateAgeFromBirthDate(birthDateVal)
      : Number.isFinite(Number(birthYearVal))
        ? calculateAgeFromBirthYear(Number(birthYearVal))
        : null;

  const dietaryPreferences = form.watch('dietaryPreferences');
  const allergens = form.watch('allergens');
  const dislikedFoods = form.watch('dislikedFoods') ?? [];
  const consentAccepted = form.watch('consentAccepted');

  const toggleItem = (
    field: 'dietaryPreferences' | 'allergens' | 'dislikedFoods',
    value: string,
    maxCount: number
  ) => {
    const current = form.getValues(field) ?? [];
    if (current.includes(value)) {
      form.setValue(
        field,
        current.filter((item) => item !== value),
        { shouldDirty: true, shouldValidate: true }
      );
    } else if (current.length < maxCount) {
      form.setValue(field, [...current, value], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const addCustomItem = (
    field: 'dietaryPreferences' | 'allergens' | 'dislikedFoods',
    rawValue: string,
    maxCount: number,
    clearInput: () => void
  ) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const current = form.getValues(field) ?? [];
    if (!current.includes(trimmed) && current.length < maxCount) {
      form.setValue(field, [...current, trimmed.slice(0, 60)], {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
    clearInput();
  };

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) return;
    setSaveStatus(null);
    try {
      await saveUserProfile(user.uid, user.email ?? '', values, Boolean(profile));
      await refreshProfile();
      setSaveStatus({
        tone: 'success',
        text: 'Đã lưu hồ sơ cá nhân và cấu hình dinh dưỡng thành công.',
      });
    } catch (error) {
      setSaveStatus({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(error),
      });
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsExporting(true);
    setSaveStatus(null);
    try {
      const exported = await exportUserData(user.uid);
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bmi-viet-meal-planner-data-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setSaveStatus({
        tone: 'success',
        text: 'Đã xuất toàn bộ dữ liệu cá nhân, lịch sử BMI và thực đơn thành tệp JSON.',
      });
    } catch (error) {
      setSaveStatus({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(error),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (deleteConfirmText.trim().toUpperCase() !== 'XOA') {
      setDeleteError('Vui lòng nhập chính xác chữ XOA để xác nhận.');
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteUserDataAndAccount(user);
      setDeleteModalOpen(false);
      navigate('/', { replace: true });
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes('auth/')
          ? formatAuthErrorVi(error)
          : formatFirestoreUiErrorVi(error);
      setDeleteError(message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Hồ sơ cá nhân &amp; Quyền riêng tư
          </h1>
          <p className="text-sm text-slate-600">
            Thông tin được lưu riêng theo tài khoản của bạn để hỗ trợ theo dõi BMI,
            phân tích nhu cầu dinh dưỡng và tạo thực đơn AI cá nhân hóa.
          </p>
        </div>

        <Link to="/nutrition-plan">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
          >
            Xem kế hoạch dinh dưỡng
          </Button>
        </Link>
      </div>

      {profileError && <Alert tone="danger">{profileError}</Alert>}
      {saveStatus && <Alert tone={saveStatus.tone}>{saveStatus.text}</Alert>}

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
        {/* Consent Gate (Decree 13/2023/ND-CP) */}
        <ConsentNoticeCard
          accepted={consentAccepted}
          onAcceptedChange={(checked) =>
            form.setValue('consentAccepted', checked, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
          readOnly={Boolean(profile?.consentAccepted)}
          error={form.formState.errors.consentAccepted?.message}
        />

        {/* Basic Personal & Body Info */}
        <Card className="space-y-5">
          <div className="space-y-1 border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Thông tin cơ bản &amp; Chỉ số thể chất
            </h2>
            <p className="text-xs text-slate-500">
              Độ tuổi và giới tính giúp phân biệt chế độ người trưởng thành (18+) và chế
              độ giới hạn dưới 18 tuổi.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="profile-display-name"
              label="Tên hiển thị"
              required
              error={form.formState.errors.displayName?.message}
            >
              <Input
                id="profile-display-name"
                type="text"
                maxLength={100}
                hasError={Boolean(form.formState.errors.displayName)}
                {...form.register('displayName')}
              />
            </FormField>

            <FormField id="profile-email" label="Email tài khoản">
              <Input
                id="profile-email"
                type="email"
                value={user?.email ?? ''}
                disabled
              />
            </FormField>

            <FormField
              id="profile-birth-date"
              label="Ngày sinh chính xác (tùy chọn)"
              hint={
                resolvedAge !== null
                  ? `Độ tuổi hiện tại: ${resolvedAge} tuổi`
                  : 'Tự động đồng bộ năm sinh và tính tuổi theo ngày.'
              }
              error={form.formState.errors.birthDate?.message}
            >
              <Input
                id="profile-birth-date"
                type="date"
                value={birthDateVal ?? ''}
                onChange={(e) => {
                  const next = e.target.value.trim();
                  form.setValue('birthDate', next ? next : null, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                  if (/^\d{4}-\d{2}-\d{2}$/.test(next)) {
                    const y = Number(next.slice(0, 4));
                    if (
                      y >= PROFILE_INPUT_LIMITS.BIRTH_YEAR_MIN &&
                      y <= PROFILE_INPUT_LIMITS.BIRTH_YEAR_MAX
                    ) {
                      form.setValue('birthYear', y, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }
                }}
              />
            </FormField>

            <FormField
              id="profile-birth-year"
              label="Năm sinh"
              required
              hint="Từ 1900 đến 2021"
              error={form.formState.errors.birthYear?.message}
            >
              <Input
                id="profile-birth-year"
                type="text"
                inputMode="numeric"
                hasError={Boolean(form.formState.errors.birthYear)}
                {...form.register('birthYear')}
              />
            </FormField>

            <FormField
              id="profile-sex"
              label="Giới tính"
              required
              hint="Thông số Nam/Nữ cần cho công thức BMR; chọn Khác nếu chỉ theo dõi BMI."
              error={form.formState.errors.sex?.message}
            >
              <Select
                id="profile-sex"
                hasError={Boolean(form.formState.errors.sex)}
                options={[
                  { value: 'male', label: 'Nam' },
                  { value: 'female', label: 'Nữ' },
                  { value: 'other', label: 'Khác / Không muốn tiết lộ' },
                ]}
                {...form.register('sex')}
              />
            </FormField>

            <FormField
              id="profile-height"
              label="Chiều cao hiện tại"
              required
              error={form.formState.errors.heightCm?.message}
            >
              <Input
                id="profile-height"
                type="text"
                inputMode="decimal"
                unitLabel="cm"
                hasError={Boolean(form.formState.errors.heightCm)}
                {...form.register('heightCm')}
              />
            </FormField>

            <FormField
              id="profile-weight"
              label="Cân nặng hiện tại"
              required
              error={form.formState.errors.weightKg?.message}
            >
              <Input
                id="profile-weight"
                type="text"
                inputMode="decimal"
                unitLabel="kg"
                hasError={Boolean(form.formState.errors.weightKg)}
                {...form.register('weightKg')}
              />
            </FormField>
          </div>

          <FormField
            id="profile-activity"
            label="Mức độ vận động hàng ngày"
            required
            hint="Dùng để ước tính nhu cầu năng lượng TDEE (chỉ dành cho 18+)."
            error={form.formState.errors.activityLevel?.message}
          >
            <Select
              id="profile-activity"
              hasError={Boolean(form.formState.errors.activityLevel)}
              options={ACTIVITY_LEVEL_OPTIONS.map((opt) => ({
                value: opt.value,
                label: `${opt.labelVi} — ${opt.descriptionVi}`,
              }))}
              {...form.register('activityLevel')}
            />
          </FormField>
        </Card>

        {/* Personalized Nutrition Plan Settings */}
        <Card className="space-y-5">
          <div className="space-y-1 border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Nhu cầu &amp; Thói quen ăn uống cá nhân
            </h2>
            <p className="text-xs text-slate-500">
              Các tùy chọn này giúp hệ thống cá nhân hóa gợi ý khẩu phần, tỷ lệ dinh
              dưỡng và thực đơn AI phù hợp thời gian nấu nướng cùng ngân sách của bạn.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField id="profile-nutrition-goal" label="Mục tiêu dinh dưỡng chính">
              <Select
                id="profile-nutrition-goal"
                options={NUTRITION_GOAL_OPTIONS.map((g) => ({
                  value: g.value,
                  label: g.labelVi,
                }))}
                {...form.register('nutritionGoal')}
              />
            </FormField>

            <FormField id="profile-diet-mode" label="Chế độ ăn ưu tiên">
              <Select
                id="profile-diet-mode"
                options={DIET_MODE_OPTIONS.map((d) => ({
                  value: d.value,
                  label: d.labelVi,
                }))}
                {...form.register('dietMode')}
              />
            </FormField>

            <FormField id="profile-budget-level" label="Mức ngân sách bữa ăn">
              <Select
                id="profile-budget-level"
                options={BUDGET_LEVEL_OPTIONS.map((b) => ({
                  value: b.value,
                  label: b.labelVi,
                }))}
                {...form.register('budgetLevel')}
              />
            </FormField>

            <FormField
              id="profile-prep-time"
              label="Thời gian chuẩn bị / nấu nướng"
            >
              <Select
                id="profile-prep-time"
                options={PREP_TIME_OPTIONS.map((p) => ({
                  value: p.value,
                  label: p.labelVi,
                }))}
                {...form.register('prepTimePreference')}
              />
            </FormField>

            <FormField
              id="profile-meals-per-day"
              label="Số bữa ăn mong muốn mỗi ngày"
              hint="Dùng khi AI phân bổ khung bữa trong thực đơn cá nhân."
            >
              <Select
                id="profile-meals-per-day"
                options={[
                  { value: '3', label: '3 bữa chính (Sáng · Trưa · Tối)' },
                  { value: '4', label: '4 bữa (3 bữa chính + 1 bữa phụ chiều)' },
                  { value: '5', label: '5 bữa (3 bữa chính + 2 bữa phụ)' },
                ]}
                {...form.register('mealsPerDay')}
              />
            </FormField>

            <FormField
              id="profile-daily-budget-vnd"
              label="Ngân sách ăn uống tham khảo mỗi ngày (tùy chọn)"
              hint="Ví dụ: 80000 cho ~80.000đ/ngày."
              error={form.formState.errors.dailyBudgetVnd?.message}
            >
              <Input
                id="profile-daily-budget-vnd"
                type="text"
                inputMode="numeric"
                unitLabel="VNĐ"
                placeholder="VD: 80000"
                hasError={Boolean(form.formState.errors.dailyBudgetVnd)}
                {...form.register('dailyBudgetVnd')}
              />
            </FormField>
          </div>

          {/* Disliked foods */}
          <div className="space-y-3 border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-800">
              Món ăn / nguyên liệu không thích (tối đa 20)
            </label>
            {dislikedFoods.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dislikedFoods.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-800"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      aria-label={`Xóa ${item}`}
                      onClick={() => toggleItem('dislikedFoods', item, 20)}
                      className="text-slate-600 hover:text-red-700 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2 max-w-md">
              <Input
                type="text"
                value={customDisliked}
                onChange={(e) => setCustomDisliked(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomItem(
                      'dislikedFoods',
                      customDisliked,
                      20,
                      () => setCustomDisliked('')
                    );
                  }
                }}
                placeholder="Ví dụ: Khổ qua, nội tạng, sầu riêng..."
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  addCustomItem(
                    'dislikedFoods',
                    customDisliked,
                    20,
                    () => setCustomDisliked('')
                  )
                }
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                Thêm
              </Button>
            </div>
          </div>
        </Card>

        {/* Dietary Preferences & Allergens */}
        <Card className="space-y-6">
          <div className="space-y-1 border-b border-slate-200 pb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Sở thích ăn uống &amp; Dị ứng thực phẩm
            </h2>
            <p className="text-xs text-slate-500">
              Dùng để lọc thực phẩm an toàn và loại trừ chất gây dị ứng trong thực đơn AI.
            </p>
          </div>

          {/* Dietary preferences */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-800">
              Sở thích ăn uống (tối đa {PROFILE_INPUT_LIMITS.MAX_DIETARY_PREFERENCES})
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_DIETARY_PREFERENCES.map((item) => {
                const selected = dietaryPreferences.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      toggleItem(
                        'dietaryPreferences',
                        item,
                        PROFILE_INPUT_LIMITS.MAX_DIETARY_PREFERENCES
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'border-forest-700 bg-forest-50 text-forest-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selected && (
                      <Check className="h-3.5 w-3.5 text-forest-700" aria-hidden="true" />
                    )}
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>

            {dietaryPreferences.some(
              (item) => !PRESET_DIETARY_PREFERENCES.includes(item)
            ) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {dietaryPreferences
                  .filter((item) => !PRESET_DIETARY_PREFERENCES.includes(item))
                  .map((custom) => (
                    <span
                      key={custom}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-forest-700 bg-forest-50 px-3 py-1.5 text-xs font-medium text-forest-900"
                    >
                      <span>{custom}</span>
                      <button
                        type="button"
                        aria-label={`Xóa ${custom}`}
                        onClick={() =>
                          toggleItem(
                            'dietaryPreferences',
                            custom,
                            PROFILE_INPUT_LIMITS.MAX_DIETARY_PREFERENCES
                          )
                        }
                        className="text-forest-800 hover:text-red-700 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
              </div>
            )}

            <div className="flex gap-2 max-w-md">
              <Input
                type="text"
                value={customDietary}
                onChange={(e) => setCustomDietary(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomItem(
                      'dietaryPreferences',
                      customDietary,
                      PROFILE_INPUT_LIMITS.MAX_DIETARY_PREFERENCES,
                      () => setCustomDietary('')
                    );
                  }
                }}
                placeholder="Thêm sở thích khác (ví dụ: Ít cay)..."
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  addCustomItem(
                    'dietaryPreferences',
                    customDietary,
                    PROFILE_INPUT_LIMITS.MAX_DIETARY_PREFERENCES,
                    () => setCustomDietary('')
                  )
                }
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                Thêm
              </Button>
            </div>
          </div>

          {/* Allergens */}
          <div className="space-y-3 border-t border-slate-200 pt-5">
            <label className="block text-sm font-medium text-slate-800">
              Thực phẩm dị ứng hoặc cần tránh (tối đa{' '}
              {PROFILE_INPUT_LIMITS.MAX_ALLERGENS})
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_ALLERGENS.map((item) => {
                const selected = allergens.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() =>
                      toggleItem(
                        'allergens',
                        item,
                        PROFILE_INPUT_LIMITS.MAX_ALLERGENS
                      )
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                      selected
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selected && (
                      <Check className="h-3.5 w-3.5 text-red-700" aria-hidden="true" />
                    )}
                    <span>{item}</span>
                  </button>
                );
              })}
            </div>

            {allergens.some((item) => !PRESET_ALLERGENS.includes(item)) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {allergens
                  .filter((item) => !PRESET_ALLERGENS.includes(item))
                  .map((custom) => (
                    <span
                      key={custom}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-900"
                    >
                      <span>{custom}</span>
                      <button
                        type="button"
                        aria-label={`Xóa ${custom}`}
                        onClick={() =>
                          toggleItem(
                            'allergens',
                            custom,
                            PROFILE_INPUT_LIMITS.MAX_ALLERGENS
                          )
                        }
                        className="text-red-800 hover:text-red-950 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
              </div>
            )}

            <div className="flex gap-2 max-w-md">
              <Input
                type="text"
                value={customAllergen}
                onChange={(e) => setCustomAllergen(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomItem(
                      'allergens',
                      customAllergen,
                      PROFILE_INPUT_LIMITS.MAX_ALLERGENS,
                      () => setCustomAllergen('')
                    );
                  }
                }}
                placeholder="Thêm chất dị ứng khác (ví dụ: Mắm tôm)..."
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  addCustomItem(
                    'allergens',
                    customAllergen,
                    PROFILE_INPUT_LIMITS.MAX_ALLERGENS,
                    () => setCustomAllergen('')
                  )
                }
                leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
              >
                Thêm
              </Button>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 pt-5">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={form.formState.isSubmitting}
              leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}
            >
              Lưu hồ sơ cá nhân
            </Button>
          </div>
        </Card>
      </form>

      {/* Data Rights: Export & Delete */}
      <Card className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            Quản lý &amp; Quyền đối với dữ liệu cá nhân
          </h2>
          <p className="text-xs leading-relaxed text-slate-600">
            Bạn có thể tải xuống toàn bộ hồ sơ, lịch sử BMI và thực đơn đã lưu của
            mình, hoặc xóa vĩnh viễn toàn bộ dữ liệu và tài khoản khỏi hệ thống.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            isLoading={isExporting}
            onClick={handleExportData}
            leftIcon={<Download className="h-4 w-4" aria-hidden="true" />}
          >
            Xuất dữ liệu của tôi (JSON)
          </Button>

          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setDeleteConfirmText('');
              setDeleteError(null);
              setDeleteModalOpen(true);
            }}
            leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
          >
            Xóa dữ liệu &amp; tài khoản
          </Button>
        </div>
      </Card>

      <DisclaimerBanner compact />

      {/* Delete Account Modal */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Xác nhận xóa vĩnh viễn dữ liệu và tài khoản"
        description="Hành động này không thể hoàn tác. Toàn bộ hồ sơ, lịch sử BMI và tài khoản đăng nhập của bạn sẽ bị xóa vĩnh viễn."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isDeletingAccount}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAccount}
              isLoading={isDeletingAccount}
            >
              Xóa vĩnh viễn
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="danger">
            Nếu bạn đã đăng nhập từ lâu, hệ thống có thể yêu cầu bạn đăng xuất và đăng
            nhập lại gần đây trước khi xóa tài khoản để đảm bảo an toàn.
          </Alert>

          <FormField
            id="confirm-delete-input"
            label="Nhập chữ XOA để xác nhận"
            error={deleteError ?? undefined}
          >
            <Input
              id="confirm-delete-input"
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="XOA"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
