import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Calculator, Flame, Info, LogIn, Target } from 'lucide-react';
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
  Select,
} from '@/src/components/ui';
import {
  ACTIVITY_FACTORS,
  ACTIVITY_LEVEL_OPTIONS,
  calculateBMR,
  calculateTDEE,
} from '@/src/lib/calculations';
import { calculateAgeFromBirthYear } from '@/src/lib/format/date';
import {
  energyFormSchema,
  type EnergyFormValues,
} from '@/src/lib/validation/schemas';
import type { ActivityLevel } from '@/src/types/health';

interface EnergyResult {
  bmr: number;
  tdee: number;
  heightCm: number;
  weightKg: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: ActivityLevel;
}

export function EnergyCalculatorPage() {
  const { user, profile } = useAuth();
  const [result, setResult] = useState<EnergyResult | null>(null);

  const profileAge = profile
    ? calculateAgeFromBirthYear(profile.birthYear)
    : null;
  const isProfileUnder18 = profileAge !== null && profileAge < 18;

  const form = useForm<EnergyFormValues>({
    resolver: zodResolver(energyFormSchema) as Resolver<EnergyFormValues>,
    defaultValues: {
      heightCm: 170,
      weightKg: 65,
      age: 28,
      sex: 'male',
      activityLevel: 'moderate',
    },
  });

  useEffect(() => {
    if (profile && !isProfileUnder18 && !form.formState.isDirty) {
      const derivedAge = calculateAgeFromBirthYear(profile.birthYear);
      form.reset({
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        age: derivedAge >= 18 && derivedAge <= 120 ? derivedAge : 28,
        sex: profile.sex === 'female' ? 'female' : 'male',
        activityLevel: profile.activityLevel,
      });
    }
  }, [profile, isProfileUnder18, form]);

  const watchedAge = Number(form.watch('age'));
  const isInputUnder18 =
    Number.isFinite(watchedAge) && watchedAge > 0 && watchedAge < 18;

  const onCalculate = (values: EnergyFormValues) => {
    const bmr = calculateBMR({
      weightKg: values.weightKg,
      heightCm: values.heightCm,
      age: values.age,
      sex: values.sex,
    });
    const tdee = calculateTDEE(bmr, values.activityLevel);
    setResult({
      bmr,
      tdee,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      age: values.age,
      sex: values.sex,
      activityLevel: values.activityLevel,
    });
  };

  if (isProfileUnder18) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Ước tính nhu cầu năng lượng (BMR / TDEE)
          </h1>
          <p className="text-sm text-slate-600">
            Công cụ học tập về năng lượng cơ bản dành cho người trưởng thành từ 18 tuổi trở lên.
          </p>
        </div>

        <Alert
          tone="warning"
          title="Chế độ giới hạn dành cho người dưới 18 tuổi"
        >
          <p>
            Trẻ em và thanh thiếu niên dưới 18 tuổi đang trong giai đoạn phát triển,
            nên hệ thống <strong>không tính toán hay hiển thị</strong> chỉ số BMR,
            TDEE, mục tiêu calo hay kế hoạch giảm cân. Đối tượng dưới 18 tuổi được
            đánh giá qua biểu đồ <strong>BMI theo tuổi (tham chiếu WHO)</strong> và
            cần tham khảo bác sĩ hoặc chuyên gia dinh dưỡng.
          </p>
        </Alert>

        <div className="flex flex-wrap gap-3">
          <Link to="/bmi">
            <Button variant="primary">Quay lại Tính BMI</Button>
          </Link>
          <Link to="/foods">
            <Button variant="outline">Khám phá Kho thực phẩm Việt</Button>
          </Link>
        </div>

        <DisclaimerBanner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Ước tính nhu cầu năng lượng (BMR / TDEE)
        </h1>
        <p className="text-sm text-slate-600">
          Tìm hiểu mức năng lượng cơ bản và tổng tiêu hao hàng ngày theo công thức
          Mifflin-St Jeor (chỉ dành cho người trưởng thành từ 18 tuổi trở lên).
        </p>
      </div>

      {profile?.sex === 'other' && (
        <Alert tone="info" title="Lưu ý về tham số giới tính trong công thức">
          Hồ sơ của bạn đang chọn giới tính &ldquo;Khác&rdquo;. Công thức Mifflin-St Jeor
          chỉ có hai hằng số tham chiếu Nam hoặc Nữ, vì vậy vui lòng chọn phương án
          gần nhất bên dưới để xem giá trị ước tính.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <Card className="lg:col-span-5 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Thông số ước tính (≥ 18 tuổi)
            </h2>
            <p className="text-xs text-slate-500">
              Chiều cao 120–230 cm · Cân nặng 20–300 kg · Tuổi 18–120.
            </p>
          </div>

          <form
            onSubmit={form.handleSubmit(onCalculate)}
            noValidate
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="energy-age"
                label="Tuổi"
                required
                hint="Từ 18 đến 120"
                error={form.formState.errors.age?.message}
              >
                <Input
                  id="energy-age"
                  type="text"
                  inputMode="numeric"
                  unitLabel="tuổi"
                  hasError={Boolean(form.formState.errors.age)}
                  {...form.register('age')}
                />
              </FormField>

              <FormField
                id="energy-sex"
                label="Giới tính tham chiếu"
                required
                error={form.formState.errors.sex?.message}
              >
                <Select
                  id="energy-sex"
                  hasError={Boolean(form.formState.errors.sex)}
                  options={[
                    { value: 'male', label: 'Nam' },
                    { value: 'female', label: 'Nữ' },
                  ]}
                  {...form.register('sex')}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                id="energy-height"
                label="Chiều cao"
                required
                hint="120 – 230 cm"
                error={form.formState.errors.heightCm?.message}
              >
                <Input
                  id="energy-height"
                  type="text"
                  inputMode="decimal"
                  unitLabel="cm"
                  hasError={Boolean(form.formState.errors.heightCm)}
                  {...form.register('heightCm')}
                />
              </FormField>

              <FormField
                id="energy-weight"
                label="Cân nặng"
                required
                hint="20 – 300 kg"
                error={form.formState.errors.weightKg?.message}
              >
                <Input
                  id="energy-weight"
                  type="text"
                  inputMode="decimal"
                  unitLabel="kg"
                  hasError={Boolean(form.formState.errors.weightKg)}
                  {...form.register('weightKg')}
                />
              </FormField>
            </div>

            <FormField
              id="energy-activity"
              label="Mức độ vận động hàng tuần"
              required
              error={form.formState.errors.activityLevel?.message}
            >
              <Select
                id="energy-activity"
                hasError={Boolean(form.formState.errors.activityLevel)}
                options={ACTIVITY_LEVEL_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: `${opt.labelVi} (×${ACTIVITY_FACTORS[opt.value]})`,
                }))}
                {...form.register('activityLevel')}
              />
            </FormField>

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">
                Mô tả 5 mức vận động:
              </p>
              <ul className="space-y-1 text-xs text-slate-600">
                {ACTIVITY_LEVEL_OPTIONS.map((opt) => (
                  <li key={opt.value}>
                    <span className="font-medium text-slate-800">{opt.labelVi}:</span>{' '}
                    {opt.descriptionVi}
                  </li>
                ))}
              </ul>
            </div>

            {isInputUnder18 && (
              <Alert
                tone="warning"
                title="Chế độ giới hạn (dưới 18 tuổi)"
              >
                Trẻ em và thanh thiếu niên dưới 18 tuổi được đánh giá qua biểu đồ BMI
                theo tuổi (tham chiếu tăng trưởng WHO) và không áp dụng công thức tính
                BMR/TDEE người lớn. Vui lòng tham khảo chuyên gia y tế.
              </Alert>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              leftIcon={<Calculator className="h-4 w-4" aria-hidden="true" />}
            >
              Tính BMR &amp; TDEE ước tính
            </Button>
          </form>
        </Card>

        <div className="lg:col-span-7 space-y-5">
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Kết quả năng lượng tham khảo
                </h2>
                <p className="text-xs text-slate-500">
                  Công thức Mifflin-St Jeor · Chỉ mang tính ước tính giáo dục
                </p>
              </div>
              <Badge tone="warning">Ước tính</Badge>
            </div>

            {!result || isInputUnder18 ? (
              <EmptyState
                icon={<Flame className="h-5 w-5" aria-hidden="true" />}
                title="Sẵn sàng ước tính BMR & TDEE"
                description="Nhập thông số người trưởng thành (≥ 18 tuổi) ở cột bên trái để xem mức năng lượng cơ bản và tổng tiêu hao hàng ngày."
              />
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-slate-600">
                        BMR · Trao đổi chất cơ bản
                      </span>
                      <Badge tone="warning">Ước tính</Badge>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-3xl font-bold text-forest-900 tabular-nums">
                        {Math.round(result.bmr).toLocaleString('vi-VN')}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        kcal/ngày
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-600">
                      Năng lượng tối thiểu cơ thể cần khi nghỉ ngơi hoàn toàn để duy trì
                      hô hấp, tuần hoàn và thân nhiệt.
                    </p>
                  </div>

                  <div className="rounded-xl border border-forest-200 bg-forest-50/50 p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-forest-900">
                        TDEE · Tổng tiêu hao hàng ngày
                      </span>
                      <Badge tone="warning">Ước tính</Badge>
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-3xl font-bold text-forest-900 tabular-nums">
                        {Math.round(result.tdee).toLocaleString('vi-VN')}
                      </span>
                      <span className="text-xs font-medium text-slate-600">
                        kcal/ngày
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-700">
                      Mức năng lượng ước tính cơ thể tiêu thụ trong một ngày bao gồm cả
                      sinh hoạt và vận động thể chất.
                    </p>
                  </div>
                </div>

                <Alert tone="info" title="Công thức chỉ cho kết quả ước tính">
                  Mọi công thức tính BMR và TDEE đều là giá trị trung bình thống kê. Nhu
                  cầu thực tế của từng người khác nhau tùy theo khối cơ, tình trạng sức
                  khỏe, giấc ngủ và mức độ vận động hàng ngày.
                </Alert>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  {user ? (
                    <>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Info className="h-4 w-4 shrink-0 text-forest-700" aria-hidden="true" />
                        <span>
                          Bạn có thể thiết lập mục tiêu an toàn dựa trên chỉ số TDEE này.
                        </span>
                      </div>
                      <Link to="/goals">
                        <Button
                          size="sm"
                          variant="primary"
                          leftIcon={<Target className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          Thiết lập mục tiêu
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Info className="h-4 w-4 shrink-0 text-forest-700" aria-hidden="true" />
                        <span>
                          Bạn đang ở chế độ khách. Đăng nhập để thiết lập mục tiêu và ghi
                          nhật ký ăn uống.
                        </span>
                      </div>
                      <Link to="/login" state={{ from: '/energy' }}>
                        <Button
                          size="sm"
                          variant="primary"
                          leftIcon={<LogIn className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          Đăng nhập
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>

          <DisclaimerBanner compact />
        </div>
      </div>
    </div>
  );
}
