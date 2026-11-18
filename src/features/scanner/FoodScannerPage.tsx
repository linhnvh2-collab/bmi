import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Camera,
  Check,
  ChefHat,
  History,
  Image as ImageIcon,
  ImageUp,
  Plus,
  ShieldAlert,
  Sparkles,
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
  Select,
} from '@/src/components/ui';
import { VerificationBadge } from '@/src/features/foods/components';
import { DIARY_LIMITS, MEAL_TYPE_OPTIONS } from '@/src/lib/diary';
import {
  getFoodDiaryDay,
  saveFoodDiaryDay,
} from '@/src/lib/firebase/diaryService';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import { fetchFoods } from '@/src/lib/firebase/foodsService';
import {
  deleteFoodScanRecordAndImage,
  markFoodScanConfirmed,
  saveFoodScanRecord,
  subscribeFoodScans,
  uploadFoodScanImage,
} from '@/src/lib/firebase/foodScansService';
import {
  formatVietnameseDateTime,
  getTodayDateKey,
} from '@/src/lib/format/date';
import { findMatchingAllergens, scaleNutrients } from '@/src/lib/nutrition';
import type { FoodItem } from '@/src/types/food';
import type {
  FoodScanHistoryRecord,
  ScannedFoodAnalysisResponse,
} from '@/src/types/mealPlan';
import type { DiaryEntry, MealType } from '@/src/types/stage3';

interface EditableScannedItem {
  localId: string;
  detectedNameVi: string;
  confidenceLabel: 'cao' | 'trung_binh' | 'thap';
  cookingMethodVi: string;
  possibleIngredients: string[];
  portionUncertaintyNote: string;
  matchedFoodId: string;
  grams: number;
  mealType: MealType;
}

const CONFIDENCE_LABELS: Record<
  'cao' | 'trung_binh' | 'thap',
  { label: string; tone: 'success' | 'warning' | 'neutral' }
> = {
  cao: { label: 'Độ rõ: Cao', tone: 'success' },
  trung_binh: { label: 'Độ rõ: Trung bình', tone: 'warning' },
  thap: { label: 'Độ rõ: Thấp (Ước đoán)', tone: 'neutral' },
};

const SAMPLE_LIBRARY_IMAGES = [
  {
    id: 'pho-bo-sample',
    label: 'Phở bò tái',
    src: '/src/assets/images/pho_bo_tai_1795014138618.jpg',
  },
  {
    id: 'bun-cha-sample',
    label: 'Bún chả Hà Nội',
    src: '/src/assets/images/bun_cha_ha_noi_1795014138982.jpg',
  },
  {
    id: 'com-gao-lut-sample',
    label: 'Cơm gạo lứt',
    src: '/src/assets/images/com_gao_lut_1795014139927.jpg',
  },
  {
    id: 'dau-phu-sample',
    label: 'Đậu phụ sốt cà chua',
    src: '/src/assets/images/dau_phu_sot_ca_1795014144381.jpg',
  },
  {
    id: 'ca-hoi-sample',
    label: 'Cá hồi áp chảo',
    src: '/src/assets/images/ca_hoi_ap_chao_1795014141272.jpg',
  },
  {
    id: 'banh-mi-sample',
    label: 'Bánh mì Việt Nam',
    src: '/src/assets/images/banh_mi_viet_1795014140855.jpg',
  },
];

export function FoodScannerPage() {
  const { user, profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [catalogFoods, setCatalogFoods] = useState<FoodItem[]>([]);
  const [scanHistory, setScanHistory] = useState<FoodScanHistoryRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<
    'image/jpeg' | 'image/png' | 'image/webp'
  >('image/jpeg');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ScannedFoodAnalysisResponse | null>(
    null
  );
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [editableItems, setEditableItems] = useState<EditableScannedItem[]>([]);

  const [isSavingDiary, setIsSavingDiary] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  useEffect(() => {
    void fetchFoods({ includeInactive: false })
      .then(setCatalogFoods)
      .catch(() => setCatalogFoods([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeFoodScans(
      user.uid,
      setScanHistory,
      () => {
        // Ignore silent subscription warning; user can still scan
      }
    );
    return () => unsub();
  }, [user]);

  const foodMap = useMemo(
    () => new Map(catalogFoods.map((f) => [f.id, f])),
    [catalogFoods]
  );

  const loadImageFile = (file: File) => {
    setAnalyzeError(null);
    setStorageWarning(null);
    setSaveStatus(null);
    setAnalysis(null);
    setActiveScanId(null);
    setEditableItems([]);

    const resolvedMime =
      file.type === 'image/png' || file.type === 'image/webp'
        ? file.type
        : 'image/jpeg';

    if (
      file.type !== 'image/jpeg' &&
      file.type !== 'image/png' &&
      file.type !== 'image/webp'
    ) {
      setAnalyzeError('Vui lòng chọn tệp ảnh định dạng JPG, PNG hoặc WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAnalyzeError(
        'Kích thước ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhẹ hơn.'
      );
      return;
    }

    setSelectedFile(file);
    setMimeType(resolvedMime);
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      setPreviewUrl(result);
      const base64Part = result.includes(',') ? result.split(',')[1] : result;
      setImageBase64(base64Part);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadImageFile(file);
    e.target.value = '';
  };

  const handleSelectSampleImage = async (sample: {
    id: string;
    label: string;
    src: string;
  }) => {
    setAnalyzeError(null);
    try {
      const resp = await fetch(sample.src);
      if (!resp.ok) throw new Error('Không thể tải ảnh mẫu.');
      const blob = await resp.blob();
      const file = new File([blob], `${sample.id}.jpg`, {
        type: blob.type === 'image/png' ? 'image/png' : 'image/jpeg',
      });
      loadImageFile(file);
    } catch {
      setAnalyzeError('Không thể nạp ảnh mẫu từ thư viện. Vui lòng thử tải ảnh từ thiết bị.');
    }
  };

  const handleAddManualItem = () => {
    setEditableItems((prev) => [
      ...prev,
      {
        localId: `manual-${Date.now()}`,
        detectedNameVi: 'Món bổ sung thủ công',
        confidenceLabel: 'cao',
        cookingMethodVi: 'Người dùng tự nhập',
        possibleIngredients: [],
        portionUncertaintyNote:
          'Mục tự thêm để điều chỉnh đầy đủ bữa ăn trước khi lưu nhật ký.',
        matchedFoodId: '',
        grams: 100,
        mealType: 'lunch',
      },
    ]);
  };

  const handleAnalyzeImage = async () => {
    if (!imageBase64) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    setStorageWarning(null);
    setSaveStatus(null);

    try {
      const resp = await fetch('/api/ai/analyze-food-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          customFoods: catalogFoods.map((f) => ({
            id: f.id,
            nameVi: f.nameVi,
            category: f.category,
            nutrientsPer100g: f.nutrientsPer100g,
            servingUnits: f.servingUnits,
            allergens: f.allergens,
            allergensReviewed: f.allergensReviewed,
            dietTags: f.dietTags,
            verificationStatus: f.verificationStatus,
            imagePath: f.imagePath,
            ingredients: f.ingredients ?? [],
            preparationNote: f.preparationNote ?? '',
            isActive: f.isActive,
          })),
        }),
      });

      const data = (await resp.json()) as ScannedFoodAnalysisResponse & {
        error?: string;
      };

      if (!resp.ok || !Array.isArray(data.items)) {
        throw new Error(
          data.error || 'Không thể phân tích ảnh món ăn lúc này.'
        );
      }

      setAnalysis(data);
      const nextItems: EditableScannedItem[] = data.items.map((item, idx) => ({
        localId: `scan-${Date.now()}-${idx}`,
        detectedNameVi: item.detectedNameVi,
        confidenceLabel: item.confidenceLabel,
        cookingMethodVi: item.cookingMethodVi ?? 'Chưa xác định rõ qua ảnh',
        possibleIngredients: item.possibleIngredients,
        portionUncertaintyNote: item.portionUncertaintyNote,
        matchedFoodId: item.matchedFoodId ?? '',
        grams: item.estimatedGrams,
        mealType: 'lunch',
      }));
      setEditableItems(nextItems);

      // Save scan record (+ Storage photo when available) for logged-in users
      if (user) {
        const scanId = `scan-${Date.now()}`;
        let storagePath: string | null = null;
        if (selectedFile) {
          const uploadRes = await uploadFoodScanImage(
            user.uid,
            scanId,
            selectedFile
          );
          storagePath = uploadRes.storagePath;
          if (uploadRes.warningVi) {
            setStorageWarning(uploadRes.warningVi);
          }
        }
        await saveFoodScanRecord(user.uid, {
          id: scanId,
          storagePath,
          summaryVi: data.summaryVi,
          isFoodImage: data.isFoodImage !== false && data.items.length > 0,
          detectedCount: data.detectedCount ?? data.items.length,
          items: data.items.map((it) => ({
            detectedNameVi: it.detectedNameVi,
            matchedFoodId: it.matchedFoodId,
            grams: it.estimatedGrams,
            confidenceLabel: it.confidenceLabel,
            cookingMethodVi: it.cookingMethodVi,
          })),
          confirmedToDiary: false,
        }).catch(() => undefined);
        setActiveScanId(scanId);
      }
    } catch (err) {
      setAnalyzeError(
        err instanceof Error ? err.message : 'Lỗi kết nối khi phân tích ảnh.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirmSaveToDiary = async () => {
    if (!user || editableItems.length === 0) return;
    setIsSavingDiary(true);
    setSaveStatus(null);
    const todayKey = getTodayDateKey();

    try {
      const existingDoc = await getFoodDiaryDay(user.uid, todayKey);
      const existingEntries = existingDoc?.entries ?? [];
      if (
        existingEntries.length + editableItems.length >
        DIARY_LIMITS.MAX_ENTRIES_PER_DAY
      ) {
        throw new Error(
          `Nhật ký hôm nay vượt quá giới hạn tối đa ${DIARY_LIMITS.MAX_ENTRIES_PER_DAY} món.`
        );
      }

      const nowIso = new Date().toISOString();
      const entriesToAdd: DiaryEntry[] = editableItems.map((item, idx) => {
        const matchedFood = item.matchedFoodId
          ? foodMap.get(item.matchedFoodId)
          : undefined;
        const safeGrams =
          Number.isFinite(item.grams) && item.grams > 0
            ? Math.min(DIARY_LIMITS.MAX_GRAMS, Math.round(item.grams))
            : 100;

        if (matchedFood) {
          return {
            id: `scan-${Date.now()}-${idx}-${matchedFood.id}`,
            mealType: item.mealType,
            source: 'database',
            foodId: matchedFood.id,
            name: item.detectedNameVi.trim() || matchedFood.nameVi,
            grams: safeGrams,
            nutrientsPer100gSnapshot: matchedFood.nutrientsPer100g,
            verificationStatusSnapshot: matchedFood.verificationStatus,
            loggedAt: nowIso,
          };
        }

        return {
          id: `scan-custom-${Date.now()}-${idx}`,
          mealType: item.mealType,
          source: 'custom',
          foodId: null,
          name: item.detectedNameVi.trim() || 'Món ăn từ ảnh',
          grams: safeGrams,
          nutrientsPer100gSnapshot: {
            energyKcal: null,
            proteinG: null,
            fatG: null,
            carbG: null,
            fiberG: null,
            sugarG: null,
            sodiumMg: null,
          },
          verificationStatusSnapshot: 'unverified',
          loggedAt: nowIso,
        };
      });

      await saveFoodDiaryDay(
        user.uid,
        todayKey,
        [...existingEntries, ...entriesToAdd],
        Boolean(existingDoc)
      );

      if (activeScanId) {
        await markFoodScanConfirmed(user.uid, activeScanId).catch(
          () => undefined
        );
      }

      setSaveStatus({
        tone: 'success',
        text: `Đã lưu ${entriesToAdd.length} món ăn bạn xác nhận vào Nhật ký ăn uống hôm nay.`,
      });
    } catch (err) {
      setSaveStatus({
        tone: 'danger',
        text:
          err instanceof Error ? err.message : formatFirestoreUiErrorVi(err),
      });
    } finally {
      setIsSavingDiary(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-800">
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Nhận diện món ăn qua hình ảnh (Ước tính AI)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quét ảnh món ăn Việt Nam
          </h1>
          <p className="text-sm text-slate-600">
            Chụp ảnh trực tiếp, tải tệp từ thiết bị hoặc chọn ảnh từ thư viện mẫu
            để Gemini AI nhận diện món có thể có, đối chiếu Kho thực phẩm và xác
            nhận trước khi ghi vào Nhật ký.
          </p>
        </div>

        <Link to="/diary">
          <Button variant="outline" size="sm">
            Mở Nhật ký ăn uống
          </Button>
        </Link>
      </div>

      {/* Upload / Camera / Gallery Area */}
      <Card className="space-y-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-3">
            {previewUrl ? (
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                <img
                  src={previewUrl}
                  alt="Ảnh món ăn đã chọn"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-6 text-center hover:border-forest-500 hover:bg-forest-50/30 transition-colors cursor-pointer"
              >
                <ImageUp
                  className="h-8 w-8 text-forest-700"
                  aria-hidden="true"
                />
                <span className="text-sm font-semibold text-slate-800">
                  Chọn hoặc chụp ảnh bữa ăn
                </span>
                <span className="text-xs text-slate-500">
                  Hỗ trợ JPG, PNG, WEBP · Tối đa 5 MB
                </span>
              </button>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => cameraInputRef.current?.click()}
                leftIcon={<Camera className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Chụp ảnh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                leftIcon={<ImageUp className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                {previewUrl ? 'Đổi tệp ảnh' : 'Tải từ thiết bị'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!imageBase64}
                isLoading={isAnalyzing}
                onClick={handleAnalyzeImage}
                leftIcon={<Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                {isAnalyzing ? 'Đang phân tích...' : 'Phân tích ảnh với AI'}
              </Button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <Alert tone="info" title="Lưu ý về độ chính xác khi nhận diện qua ảnh">
              Hình ảnh không thể đo chính xác khối lượng tịnh, lượng dầu ăn ngấm,
              nước dùng hay gia vị ẩn. Mọi dữ liệu dinh dưỡng đều gắn nhãn{' '}
              <strong>Ước tính</strong> và ứng dụng <strong>chỉ lưu vào Nhật ký</strong>{' '}
              sau khi bạn kiểm tra, chỉnh sửa và bấm nút xác nhận.
            </Alert>

            {/* Library Sample Picker */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ImageIcon className="h-3.5 w-3.5 text-forest-700" aria-hidden="true" />
                <span>Hoặc chọn nhanh ảnh món Việt từ thư viện mẫu</span>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {SAMPLE_LIBRARY_IMAGES.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => void handleSelectSampleImage(sample)}
                    className="group overflow-hidden rounded-lg border border-slate-200 bg-white text-left hover:border-forest-500 transition-colors cursor-pointer"
                  >
                    <div className="aspect-square w-full overflow-hidden bg-slate-100">
                      <img
                        src={sample.src}
                        alt={sample.label}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <span className="block truncate px-1.5 py-1 text-[10px] font-medium text-slate-700 group-hover:text-forest-800">
                      {sample.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {storageWarning && <Alert tone="warning">{storageWarning}</Alert>}
            {analyzeError && <Alert tone="danger">{analyzeError}</Alert>}
            {saveStatus && <Alert tone={saveStatus.tone}>{saveStatus.text}</Alert>}

            {analysis && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Tóm tắt phân tích AI ·{' '}
                    {analysis.isFoodImage === false
                      ? 'Không phát hiện món ăn rõ ràng'
                      : `Ước đoán ${analysis.detectedCount ?? editableItems.length} món`}
                  </span>
                  <Badge tone="warning">Ước tính</Badge>
                </div>
                <p className="text-xs leading-relaxed text-slate-700">
                  {analysis.summaryVi}
                </p>
                <p className="text-xs leading-relaxed text-amber-800 flex items-start gap-1.5">
                  <AlertTriangle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{analysis.overallCautionVi}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Editable Detected Items Confirmation Workflow */}
      {analysis && (
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Kiểm tra &amp; Chỉnh sửa trước khi lưu ({editableItems.length} món)
              </h2>
              <p className="text-xs text-slate-500">
                Chỉnh sửa tên món, chọn món đối chiếu trong Kho thực phẩm, điều
                chỉnh số gram hoặc thêm/xóa món rồi mới bấm xác nhận lưu nhật ký.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddManualItem}
                leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Thêm món thủ công
              </Button>
              {user && editableItems.length > 0 && (
                <Button
                  variant="primary"
                  isLoading={isSavingDiary}
                  onClick={handleConfirmSaveToDiary}
                  leftIcon={<Check className="h-4 w-4" aria-hidden="true" />}
                >
                  Xác nhận lưu vào Nhật ký hôm nay
                </Button>
              )}
            </div>
          </div>

          {editableItems.length === 0 ? (
            <EmptyState
              icon={<Camera className="h-5 w-5" aria-hidden="true" />}
              title={
                analysis.isFoodImage === false
                  ? 'Ảnh không chứa món ăn hoặc chưa đủ rõ để nhận diện'
                  : 'Không nhận diện được món ăn rõ ràng'
              }
              description="Bạn có thể thử ảnh cận cảnh rõ ánh sáng hơn, bấm 'Thêm món thủ công' ở trên hoặc nhập trực tiếp tại Nhật ký ăn uống."
            />
          ) : (
            <div className="space-y-4">
              {editableItems.map((item) => {
                const matchedFood = item.matchedFoodId
                  ? foodMap.get(item.matchedFoodId)
                  : undefined;
                const scaled = matchedFood
                  ? scaleNutrients(
                      matchedFood.nutrientsPer100g,
                      Math.max(10, item.grams || 100)
                    )
                  : null;
                const matchedUserAllergens =
                  matchedFood && profile?.allergens.length
                    ? findMatchingAllergens(
                        matchedFood.allergens,
                        profile.allergens
                      )
                    : [];
                const confMeta = CONFIDENCE_LABELS[item.confidenceLabel];

                return (
                  <div
                    key={item.localId}
                    className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={confMeta.tone}>{confMeta.label}</Badge>
                          <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                            <ChefHat className="h-3.5 w-3.5 text-forest-700" aria-hidden="true" />
                            Chế biến: <strong>{item.cookingMethodVi}</strong>
                          </span>
                          {matchedFood && (
                            <VerificationBadge
                              status={matchedFood.verificationStatus}
                            />
                          )}
                        </div>
                        {item.possibleIngredients.length > 0 && (
                          <p className="text-xs text-slate-600">
                            <strong>Thành phần quan sát được:</strong>{' '}
                            {item.possibleIngredients.join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-amber-800">
                          {item.portionUncertaintyNote}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setEditableItems((prev) =>
                            prev.filter((i) => i.localId !== item.localId)
                          )
                        }
                        aria-label={`Bỏ ${item.detectedNameVi}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    {matchedUserAllergens.length > 0 && (
                      <Alert tone="danger" title="Cảnh báo dị ứng từ hồ sơ">
                        <div className="flex items-center gap-2 text-xs">
                          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>
                            Món đối chiếu có chứa chất dị ứng bạn cần tránh:{' '}
                            <strong>{matchedUserAllergens.join(', ')}</strong>.
                          </span>
                        </div>
                      </Alert>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <FormField
                        id={`name-${item.localId}`}
                        label="Tên món xác nhận (chỉnh sửa nếu cần)"
                      >
                        <Input
                          id={`name-${item.localId}`}
                          type="text"
                          value={item.detectedNameVi}
                          onChange={(e) =>
                            setEditableItems((prev) =>
                              prev.map((row) =>
                                row.localId === item.localId
                                  ? { ...row, detectedNameVi: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </FormField>

                      <FormField
                        id={`match-${item.localId}`}
                        label="Đối chiếu Kho thực phẩm"
                      >
                        <Select
                          id={`match-${item.localId}`}
                          value={item.matchedFoodId}
                          onChange={(e) =>
                            setEditableItems((prev) =>
                              prev.map((row) =>
                                row.localId === item.localId
                                  ? { ...row, matchedFoodId: e.target.value }
                                  : row
                              )
                            )
                          }
                          options={[
                            {
                              value: '',
                              label: 'Tự nhập tên (Chưa có dữ liệu dinh dưỡng)',
                            },
                            ...catalogFoods.map((f) => ({
                              value: f.id,
                              label: `${f.nameVi} (${f.nutrientsPer100g.energyKcal ?? '—'} kcal/100g)`,
                            })),
                          ]}
                        />
                      </FormField>

                      <FormField
                        id={`grams-${item.localId}`}
                        label="Khối lượng khẩu phần"
                      >
                        <Input
                          id={`grams-${item.localId}`}
                          type="number"
                          unitLabel="g"
                          min={10}
                          max={DIARY_LIMITS.MAX_GRAMS}
                          value={item.grams}
                          onChange={(e) =>
                            setEditableItems((prev) =>
                              prev.map((row) =>
                                row.localId === item.localId
                                  ? { ...row, grams: Number(e.target.value) }
                                  : row
                              )
                            )
                          }
                        />
                      </FormField>

                      <FormField id={`meal-${item.localId}`} label="Ghi vào bữa">
                        <Select
                          id={`meal-${item.localId}`}
                          value={item.mealType}
                          onChange={(e) =>
                            setEditableItems((prev) =>
                              prev.map((row) =>
                                row.localId === item.localId
                                  ? {
                                      ...row,
                                      mealType: e.target.value as MealType,
                                    }
                                  : row
                              )
                            )
                          }
                          options={MEAL_TYPE_OPTIONS.map((m) => ({
                            value: m.value,
                            label: m.labelVi,
                          }))}
                        />
                      </FormField>
                    </div>

                    {scaled ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 font-mono text-xs text-slate-700 tabular-nums">
                        Dinh dưỡng quy đổi từ DB (Ước tính):{' '}
                        <strong>{scaled.energyKcal ?? '—'} kcal</strong> · Đạm{' '}
                        {scaled.proteinG ?? '—'}g · Carb {scaled.carbG ?? '—'}g · Béo{' '}
                        {scaled.fatG ?? '—'}g · Xơ {scaled.fiberG ?? '—'}g
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        Chưa ghép với món trong Kho thực phẩm: khi lưu sẽ ghi nhận ở
                        dạng Tự nhập (Chưa có dữ liệu kcal/macro).
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Scan History (Firestore + Storage) */}
      {user && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-forest-700" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-900">
                Lịch sử phân tích ảnh món ăn ({scanHistory.length})
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              Bạn có thể xóa lịch sử và ảnh đính kèm bất cứ lúc nào
            </span>
          </div>

          {scanHistory.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-500">
              Chưa có lịch sử quét ảnh món ăn nào được lưu.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {scanHistory.map((rec) => (
                <li
                  key={rec.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="space-y-0.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {rec.items.length > 0
                          ? rec.items.map((i) => i.detectedNameVi).join(', ')
                          : 'Không phát hiện món ăn'}
                      </span>
                      <Badge
                        tone={rec.confirmedToDiary ? 'success' : 'neutral'}
                      >
                        {rec.confirmedToDiary
                          ? 'Đã xác nhận lưu Nhật ký'
                          : 'Chưa lưu Nhật ký'}
                      </Badge>
                    </div>
                    <p className="text-slate-500">
                      {formatVietnameseDateTime(rec.createdAt)} ·{' '}
                      {rec.detectedCount} món ước đoán ·{' '}
                      {rec.storagePath ? 'Có lưu ảnh' : 'Chỉ lưu kết quả văn bản'}
                    </p>
                  </div>

                  <button
                    type="button"
                    aria-label="Xóa lịch sử quét ảnh"
                    onClick={() =>
                      void deleteFoodScanRecordAndImage(user.uid, rec)
                    }
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <DisclaimerBanner />
    </div>
  );
}
