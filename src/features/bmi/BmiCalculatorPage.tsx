import { useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import {
  BookmarkPlus,
  Calculator,
  History,
  Info,
  LogIn,
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
import { ConsentNoticeCard } from '@/src/features/profile/ConsentNoticeCard';
import {
  BMI_CATEGORY_METADATA,
  calculateBMI,
  classifyBMI,
} from '@/src/lib/calculations';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import {
  addHealthRecord,
  deleteHealthRecord,
} from '@/src/lib/firebase/healthRecordsService';
import { saveUserProfile } from '@/src/lib/firebase/profileService';
import {
  calculateAgeFromBirthYear,
  formatVietnameseDateTime,
} from '@/src/lib/format/date';
import { bmiFormSchema, type BMIFormValues } from '@/src/lib/validation/schemas';
import type { BMIClassification, SexOption } from '@/src/types/health';
import { BmiHistoryChart } from './BmiHistoryChart';

interface CalculatedResult {
  bmi: number;
  heightCm: number;
  weightKg: number;
  age: number;
  note: string;
  classification: BMIClassification;
}

export function BmiCalculatorPage() {
  const {
    user,
    profile,
    healthRecords,
    recordsLoading,
    recordsError,
    refreshProfile,
  } = useAuth();

  const [result, setResult] = useState<CalculatedResult | null>(null);
  const [saveMessage, setSaveMessage] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Consent modal if user is signed in but hasn't accepted Decree 13/2023/ND-CP consent yet
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [modalConsentAccepted, setModalConsentAccepted] = useState(false);
  const [modalSex, setModalSex] = useState<SexOption>('other');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSavingConsent, setIsSavingConsent] = useState(false);

  const form = useForm<BMIFormValues>({
    resolver: zodResolver(bmiFormSchema) as Resolver<BMIFormValues>,
    defaultValues: {
      heightCm: 170,
      weightKg: 65,
      age: 30,
      note: '',
    },
  });

  // Pre-fill from saved profile once loaded if user hasn't calculated yet
  useEffect(() => {
    if (profile && !form.formState.isDirty) {
      const derivedAge = calculateAgeFromBirthYear(profile.birthYear);
      form.reset({
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        age: derivedAge >= 5 && derivedAge <= 120 ? derivedAge : 30,
        note: '',
      });
    }
  }, [profile, form]);

  const onCalculate = (values: BMIFormValues) => {
    setSaveMessage(null);
    const bmi = calculateBMI(values.weightKg, values.heightCm);
    const classification = classifyBMI(bmi, values.age);
    setResult({
      bmi,
      heightCm: values.heightCm,
      weightKg: values.weightKg,
      age: values.age,
      note: values.note ?? '',
      classification,
    });
  };

  const performSaveRecord = async (targetResult: CalculatedResult) => {
    if (!user) return;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await addHealthRecord(user.uid, {
        age: targetResult.age,
        heightCm: targetResult.heightCm,
        weightKg: targetResult.weightKg,
        bmi: targetResult.bmi,
        isUnder18: targetResult.classification.isLimitedMode,
        categoryKey: targetResult.classification.categoryKey,
        note: targetResult.note,
      });
      setSaveMessage({
        tone: 'success',
        text: 'Đã lưu kết quả BMI vào lịch sử cá nhân của bạn.',
      });
    } catch (error) {
      setSaveMessage({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveClick = async () => {
    if (!result || !user) return;
    if (!profile?.consentAccepted) {
      setModalConsentAccepted(false);
      setModalError(null);
      setConsentModalOpen(true);
      return;
    }
    await performSaveRecord(result);
  };

  const handleConsentAndSave = async () => {
    if (!user || !result) return;
    if (!modalConsentAccepted) {
      setModalError(
        'Vui lòng đánh dấu đồng ý trước khi lưu dữ liệu sức khỏe vào tài khoản.'
      );
      return;
    }

    setIsSavingConsent(true);
    setModalError(null);
    try {
      const currentYear = new Date().getFullYear();
      await saveUserProfile(
        user.uid,
        user.email ?? '',
        {
          displayName: user.displayName || 'Người dùng',
          birthYear: Math.max(1900, Math.min(2021, currentYear - result.age)),
          sex: modalSex,
          heightCm: result.heightCm,
          weightKg: result.weightKg,
          activityLevel: 'moderate',
          dietaryPreferences: [],
          allergens: [],
          consentAccepted: true,
        },
        Boolean(profile)
      );
      await refreshProfile();
      setConsentModalOpen(false);
      await performSaveRecord(result);
    } catch (error) {
      setModalError(formatFirestoreUiErrorVi(error));
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!user) return;
    setDeletingId(recordId);
    setSaveMessage(null);
    try {
      await deleteHealthRecord(user.uid, recordId);
      setSaveMessage({
        tone: 'success',
        text: 'Đã xóa bản ghi khỏi lịch sử.',
      });
    } catch (error) {
      setSaveMessage({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(error),
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Tính chỉ số BMI (Hệ mét)
        </h1>
        <p className="text-sm text-slate-600">
          Công cụ hỗ trợ tính toán ngay ở chế độ khách. Đăng nhập nếu bạn muốn lưu
          lịch sử và theo dõi biểu đồ theo thời gian.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Input Form */}
        <Card className="lg:col-span-5 space-y-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Nhập thông số đo
            </h2>
            <p className="text-xs text-slate-500">
              Ngưỡng người trưởng thành (18–120 tuổi): chiều cao 120–230 cm, cân nặng
              20–300 kg.
            </p>
          </div>

          <form
            onSubmit={form.handleSubmit(onCalculate)}
            noValidate
            className="space-y-4"
          >
            <FormField
              id="bmi-height"
              label="Chiều cao"
              required
              hint="Từ 120 đến 230 cm"
              error={form.formState.errors.heightCm?.message}
            >
              <Input
                id="bmi-height"
                type="text"
                inputMode="decimal"
                unitLabel="cm"
                placeholder="170"
                hasError={Boolean(form.formState.errors.heightCm)}
                {...form.register('heightCm')}
              />
            </FormField>

            <FormField
              id="bmi-weight"
              label="Cân nặng"
              required
              hint="Từ 20 đến 300 kg"
              error={form.formState.errors.weightKg?.message}
            >
              <Input
                id="bmi-weight"
                type="text"
                inputMode="decimal"
                unitLabel="kg"
                placeholder="65"
                hasError={Boolean(form.formState.errors.weightKg)}
                {...form.register('weightKg')}
              />
            </FormField>

            <FormField
              id="bmi-age"
              label="Tuổi"
              required
              hint="18–120 tuổi: phân loại người lớn · Dưới 18 tuổi (5–17): chế độ giới hạn"
              error={form.formState.errors.age?.message}
            >
              <Input
                id="bmi-age"
                type="text"
                inputMode="numeric"
                unitLabel="tuổi"
                placeholder="30"
                hasError={Boolean(form.formState.errors.age)}
                {...form.register('age')}
              />
            </FormField>

            <FormField
              id="bmi-note"
              label="Ghi chú (tùy chọn)"
              hint="Ví dụ: Đo buổi sáng trước khi ăn"
              error={form.formState.errors.note?.message}
            >
              <Input
                id="bmi-note"
                type="text"
                maxLength={300}
                placeholder="Ghi chú ngắn cho lần đo này"
                hasError={Boolean(form.formState.errors.note)}
                {...form.register('note')}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              leftIcon={<Calculator className="h-4 w-4" aria-hidden="true" />}
            >
              Tính chỉ số BMI
            </Button>
          </form>
        </Card>

        {/* Result Area */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="space-y-5">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Kết quả tham khảo
                </h2>
                <p className="text-xs text-slate-500">
                  {result
                    ? `Dựa trên chiều cao ${result.heightCm} cm · cân nặng ${result.weightKg} kg · ${result.age} tuổi`
                    : 'Nhập thông số và nhấn "Tính chỉ số BMI" để xem kết quả'}
                </p>
              </div>
              {result && !result.classification.isLimitedMode && (
                <Badge tone={result.classification.tone}>
                  {result.classification.labelVi}
                </Badge>
              )}
            </div>

            {!result ? (
              <EmptyState
                icon={<Calculator className="h-5 w-5" aria-hidden="true" />}
                title="Sẵn sàng tính chỉ số BMI"
                description="Kết quả chỉ số BMI cùng diễn giải phù hợp theo độ tuổi sẽ hiển thị ngay tại đây."
              />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-baseline justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-5">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Chỉ số BMI của bạn
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-4xl font-bold tracking-tight text-forest-900 tabular-nums">
                        {result.bmi.toFixed(1)}
                      </span>
                      <span className="text-sm font-medium text-slate-500">
                        kg/m²
                      </span>
                    </div>
                  </div>

                  {!result.classification.isLimitedMode && (
                    <div className="text-left sm:text-right">
                      <p className="text-xs font-medium text-slate-500">
                        Ngưỡng Châu Á - Thái Bình Dương
                      </p>
                      <p className="mt-1 text-base font-semibold text-slate-900">
                        {result.classification.labelVi}
                      </p>
                    </div>
                  )}
                </div>

                {result.classification.isLimitedMode ? (
                  <Alert
                    tone="warning"
                    title="Chế độ giới hạn dành cho người dưới 18 tuổi"
                  >
                    <p>
                      Trẻ em và thanh thiếu niên dưới 18 tuổi được đánh giá bằng biểu đồ{' '}
                      <strong>BMI theo tuổi (tham chiếu tăng trưởng của WHO)</strong>,
                      không áp dụng phân loại của người trưởng thành và không hiển thị
                      mục tiêu calo hay kế hoạch giảm cân. Vui lòng tham khảo ý kiến bác
                      sĩ hoặc chuyên gia dinh dưỡng để được đánh giá phù hợp.
                    </p>
                  </Alert>
                ) : (
                  <Alert tone="info" title="Diễn giải tham khảo">
                    {result.classification.shortDescVi}
                  </Alert>
                )}

                {saveMessage && (
                  <Alert tone={saveMessage.tone}>{saveMessage.text}</Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  {user ? (
                    <Button
                      variant="secondary"
                      onClick={handleSaveClick}
                      isLoading={isSaving}
                      leftIcon={
                        <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                      }
                    >
                      Lưu vào lịch sử
                    </Button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 w-full justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Info className="h-4 w-4 shrink-0 text-forest-700" aria-hidden="true" />
                        <span>
                          Bạn đang ở chế độ khách. Đăng nhập để lưu lịch sử và xem biểu
                          đồ tiến trình.
                        </span>
                      </div>
                      <Link to="/login" state={{ from: '/bmi' }}>
                        <Button
                          size="sm"
                          variant="primary"
                          leftIcon={<LogIn className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          Đăng nhập
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          <DisclaimerBanner compact />
        </div>
      </div>

      {/* Logged-in History & Chart Section */}
      {user && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-6 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900">
                Biểu đồ lịch sử BMI
              </h2>
              <p className="text-xs text-slate-500">
                Dữ liệu được đồng bộ trực tiếp từ các bản ghi bạn đã lưu.
              </p>
            </div>
            {recordsLoading ? (
              <Skeleton className="h-72 w-full" />
            ) : recordsError ? (
              <Alert tone="danger">{recordsError}</Alert>
            ) : (
              <BmiHistoryChart records={healthRecords} />
            )}
          </Card>

          <Card className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  Các lần đo đã lưu
                </h2>
                <p className="text-xs text-slate-500">
                  Tổng cộng {healthRecords.length} bản ghi
                </p>
              </div>
            </div>

            {recordsLoading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : recordsError ? (
              <Alert tone="danger">{recordsError}</Alert>
            ) : healthRecords.length === 0 ? (
              <EmptyState
                icon={<History className="h-5 w-5" aria-hidden="true" />}
                title="Chưa có bản ghi nào"
                description="Tính chỉ số BMI ở khung bên trên và nhấn 'Lưu vào lịch sử' để bắt đầu theo dõi."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">Thời gian</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">
                        Số đo
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">
                        BMI
                      </th>
                      <th className="px-3.5 py-2.5 font-semibold">Trạng thái</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {healthRecords.map((record) => {
                      const meta = BMI_CATEGORY_METADATA[record.categoryKey];
                      return (
                        <tr key={record.id} className="hover:bg-slate-50/70">
                          <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap">
                            <div>{formatVietnameseDateTime(record.createdAt)}</div>
                            {record.note && (
                              <div className="max-w-[160px] truncate text-[11px] text-slate-500">
                                {record.note}
                              </div>
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                            {record.heightCm} cm · {record.weightKg} kg
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-forest-900 tabular-nums">
                            {record.bmi.toFixed(1)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Badge tone={meta.tone}>
                              {record.isUnder18 ? '< 18 tuổi' : meta.labelVi}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteRecord(record.id)}
                              disabled={deletingId === record.id}
                              aria-label="Xóa bản ghi"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Consent Modal when saving first record without prior consent */}
      <Modal
        open={consentModalOpen}
        onClose={() => setConsentModalOpen(false)}
        title="Xác nhận đồng ý trước khi lưu dữ liệu sức khỏe"
        description="Theo yêu cầu bảo vệ dữ liệu cá nhân (tham chiếu Nghị định 13/2023/NĐ-CP), bạn cần xác nhận đồng ý trước khi lưu lần đo đầu tiên."
        maxWidthClass="max-w-xl"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConsentModalOpen(false)}
              disabled={isSavingConsent}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleConsentAndSave}
              isLoading={isSavingConsent}
            >
              Đồng ý và lưu kết quả
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField id="consent-sex" label="Giới tính (dùng cho hồ sơ cá nhân)">
            <Select
              id="consent-sex"
              value={modalSex}
              onChange={(e) => setModalSex(e.target.value as SexOption)}
              options={[
                { value: 'male', label: 'Nam' },
                { value: 'female', label: 'Nữ' },
                { value: 'other', label: 'Khác / Không muốn tiết lộ' },
              ]}
            />
          </FormField>

          <ConsentNoticeCard
            accepted={modalConsentAccepted}
            onAcceptedChange={setModalConsentAccepted}
            error={modalError ?? undefined}
          />
        </div>
      </Modal>
    </div>
  );
}
