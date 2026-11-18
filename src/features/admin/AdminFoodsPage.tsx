import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArchiveRestore,
  CheckCircle2,
  Database,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  StatCard,
  Tabs,
} from '@/src/components/ui';
import {
  FileDropzone,
  SearchInput,
  VerificationBadge,
} from '@/src/features/foods/components';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import {
  batchImportFoods,
  fetchFoods,
  setFoodActiveStatus,
  syncReferenceCatalogToFirestore,
  upsertFood,
  type BatchImportSummary,
} from '@/src/lib/firebase/foodsService';
import {
  FOOD_CATEGORY_LABELS,
  searchFoods,
  validateImportPayload,
  VIETNAMESE_FOOD_CATALOG,
  type ImportRowPreview,
} from '@/src/lib/nutrition';
import type { FoodInput, FoodItem } from '@/src/types/food';
import { FoodFormModal } from './FoodFormModal';

type AdminTab = 'list' | 'import';

const CSV_TEMPLATE_EXAMPLE = [
  'id,nameVi,nameEn,aliases,category,energyKcal,proteinG,fatG,carbG,fiberG,sugarG,sodiumMg,servingUnits,allergens,allergensReviewed,dietTags,verificationStatus,sourceName,sourceYear,sourceReference,imagePath,isActive',
  '"vi-du-khong-dung-that","Món mẫu minh họa định dạng (KHÔNG nhập thật)","Format example only","Tên gọi khác 1;Tên gọi khác 2",rice_noodles,100,2.5,1.0,20.0,1.2,,150,"1 phần mẫu:100|1 chén mẫu:150","Gluten (lúa mì)",false,"vegetarian",unverified,"Tên nguồn tham khảo",2024,"Mã hoặc số trang","",true',
].join('\n');

const JSON_TEMPLATE_EXAMPLE = JSON.stringify(
  [
    {
      id: 'vi-du-khong-dung-that',
      nameVi: 'Món mẫu minh họa định dạng (KHÔNG nhập thật)',
      nameEn: 'Format example only',
      aliases: ['Tên gọi khác 1', 'Tên gọi khác 2'],
      category: 'rice_noodles',
      nutrientsPer100g: {
        energyKcal: 100,
        proteinG: 2.5,
        fatG: 1.0,
        carbG: 20.0,
        fiberG: 1.2,
        sugarG: null,
        sodiumMg: 150,
      },
      servingUnits: [
        { label: '1 phần mẫu', grams: 100 },
        { label: '1 chén mẫu', grams: 150 },
      ],
      allergens: ['Gluten (lúa mì)'],
      allergensReviewed: false,
      dietTags: ['vegetarian'],
      verificationStatus: 'unverified',
      source: {
        name: 'Tên nguồn tham khảo',
        year: 2024,
        reference: 'Mã hoặc số trang',
      },
      imagePath: null,
      isActive: true,
    },
  ],
  null,
  2
);

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AdminFoodsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('list');
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: 'success' | 'danger';
    text: string;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null);

  // Import state
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importParseError, setImportParseError] = useState<string | null>(null);
  const [importRows, setImportRows] = useState<ImportRowPreview[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] =
    useState<BatchImportSummary | null>(null);

  const loadAllFoods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchFoods({
        includeInactive: true,
        forceRefresh: true,
      });
      setFoods(items);
    } catch (err) {
      setError(formatFirestoreUiErrorVi(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAllFoods();
  }, [loadAllFoods]);

  const filteredFoods = useMemo(
    () =>
      searchFoods(foods, searchQuery, {
        includeInactive: true,
        includeUnverified: true,
      }),
    [foods, searchQuery]
  );

  const existingIdSet = useMemo(
    () => new Set(foods.map((f) => f.id)),
    [foods]
  );

  const handleSyncReferenceCatalog = async () => {
    if (!user) return;
    setSyncingCatalog(true);
    setStatusMessage(null);
    try {
      const summary = await syncReferenceCatalogToFirestore(user.uid);
      await loadAllFoods();
      setStatusMessage({
        tone: 'success',
        text: `Đã đồng bộ thư viện chuẩn (${VIETNAMESE_FOOD_CATALOG.length} món) lên Firestore: tạo mới ${summary.created}, cập nhật ${summary.updated}.`,
      });
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    } finally {
      setSyncingCatalog(false);
    }
  };

  const handleSaveFood = async (input: FoodInput, isExisting: boolean) => {
    if (!user) return;
    await upsertFood(input, user.uid, isExisting);
    await loadAllFoods();
    setStatusMessage({
      tone: 'success',
      text: isExisting
        ? `Đã cập nhật thực phẩm "${input.nameVi}".`
        : `Đã thêm thực phẩm "${input.nameVi}" vào kho dữ liệu.`,
    });
  };

  const handleToggleActive = async (food: FoodItem) => {
    if (!user) return;
    setStatusMessage(null);
    try {
      await setFoodActiveStatus(food, !food.isActive, user.uid);
      await loadAllFoods();
      setStatusMessage({
        tone: 'success',
        text: food.isActive
          ? `Đã ẩn (xóa mềm) "${food.nameVi}".`
          : `Đã khôi phục "${food.nameVi}".`,
      });
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    }
  };

  const handleFileLoaded = (fileName: string, content: string) => {
    setImportFileName(fileName);
    setImportSummary(null);
    const parsed = validateImportPayload(fileName, content);
    if (parsed.parseError) {
      setImportParseError(parsed.parseError);
      setImportRows([]);
    } else {
      setImportParseError(null);
      setImportRows(parsed.rows);
    }
  };

  const validImportRows = useMemo(
    () => importRows.filter((r) => r.valid && r.data),
    [importRows]
  );
  const invalidImportRows = useMemo(
    () => importRows.filter((r) => !r.valid),
    [importRows]
  );

  const handleConfirmImport = async () => {
    if (!user || validImportRows.length === 0) return;
    setIsImporting(true);
    setStatusMessage(null);
    try {
      const validData = validImportRows.map((r) => r.data!);
      const summary = await batchImportFoods(
        validData,
        existingIdSet,
        user.uid,
        invalidImportRows.length
      );
      setImportSummary(summary);
      await loadAllFoods();
    } catch (err) {
      setStatusMessage({
        tone: 'danger',
        text: formatFirestoreUiErrorVi(err),
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Quản trị kho dữ liệu thực phẩm
          </h1>
          <p className="text-sm text-slate-600">
            Thêm, chỉnh sửa, ẩn món ăn, đồng bộ danh mục Việt Nam chuẩn hoặc nhập hàng
            loạt từ tệp JSON/CSV.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            isLoading={syncingCatalog}
            onClick={handleSyncReferenceCatalog}
            leftIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          >
            Đồng bộ {VIETNAMESE_FOOD_CATALOG.length} món chuẩn lên Firestore
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setEditingFood(null);
              setModalOpen(true);
            }}
            leftIcon={<Plus className="h-4 w-4" aria-hidden="true" />}
          >
            Thêm thực phẩm
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'list', label: `Danh sách thực phẩm (${foods.length})` },
          { value: 'import', label: 'Nhập tệp JSON / CSV' },
        ]}
      />

      {error && <Alert tone="danger">{error}</Alert>}
      {statusMessage && (
        <Alert tone={statusMessage.tone}>{statusMessage.text}</Alert>
      )}

      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="max-w-md">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Tìm trong danh sách quản trị..."
            />
          </div>

          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : filteredFoods.length === 0 ? (
            <EmptyState
              icon={<Database className="h-5 w-5" aria-hidden="true" />}
              title="Chưa có thực phẩm nào"
              description="Hãy thêm thực phẩm mới hoặc chuyển sang tab 'Nhập tệp JSON / CSV' để tải dữ liệu đã chuẩn bị."
              action={
                <Button
                  variant="primary"
                  onClick={() => setActiveTab('import')}
                  leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                >
                  Mở công cụ nhập dữ liệu
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tên &amp; ID</th>
                    <th className="px-4 py-3 font-semibold">Nhóm</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Kcal/100g
                    </th>
                    <th className="px-4 py-3 font-semibold">Xác minh</th>
                    <th className="px-4 py-3 font-semibold">Trạng thái</th>
                    <th className="px-4 py-3 font-semibold text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredFoods.map((food) => (
                    <tr key={food.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {food.nameVi}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {food.id}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {FOOD_CATEGORY_LABELS[food.category]}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900">
                        {food.nutrientsPer100g.energyKcal ?? 'Chưa có'}
                      </td>
                      <td className="px-4 py-3">
                        <VerificationBadge status={food.verificationStatus} />
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={food.isActive ? 'success' : 'neutral'}>
                          {food.isActive ? 'Đang hiển thị' : 'Đã ẩn'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingFood(food);
                              setModalOpen(true);
                            }}
                            leftIcon={
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            }
                          >
                            Sửa
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActive(food)}
                            leftIcon={
                              food.isActive ? (
                                <Trash2
                                  className="h-3.5 w-3.5 text-red-700"
                                  aria-hidden="true"
                                />
                              ) : (
                                <ArchiveRestore
                                  className="h-3.5 w-3.5 text-forest-700"
                                  aria-hidden="true"
                                />
                              )
                            }
                          >
                            {food.isActive ? 'Ẩn' : 'Khôi phục'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'import' && (
        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-slate-900">
                  Mẫu định dạng nhập liệu (chỉ minh họa cấu trúc cột)
                </h2>
                <p className="text-xs text-slate-600">
                  Giá trị trong tệp mẫu chỉ là dữ liệu giả lập cấu trúc — không tự động
                  nạp vào cơ sở dữ liệu. Vui lòng thay thế bằng dữ liệu thật từ nguồn
                  bạn sở hữu trước khi tải lên.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadTextFile(
                      'foods-template-example.csv',
                      CSV_TEMPLATE_EXAMPLE,
                      'text/csv;charset=utf-8'
                    )
                  }
                  leftIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Tải mẫu CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadTextFile(
                      'foods-template-example.json',
                      JSON_TEMPLATE_EXAMPLE,
                      'application/json;charset=utf-8'
                    )
                  }
                  leftIcon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Tải mẫu JSON
                </Button>
              </div>
            </div>

            <FileDropzone onFileLoaded={handleFileLoaded} />
          </Card>

          {importParseError && (
            <Alert tone="danger" title="Lỗi đọc tệp">
              {importParseError}
            </Alert>
          )}

          {importSummary && (
            <Alert tone="success" title="Hoàn tất nhập dữ liệu">
              <div className="space-y-1 text-xs">
                <p>
                  Tạo mới: <strong>{importSummary.created}</strong> · Cập nhật:{' '}
                  <strong>{importSummary.updated}</strong> · Bỏ qua dòng lỗi:{' '}
                  <strong>{importSummary.skipped}</strong>
                </p>
                {importSummary.errors.length > 0 && (
                  <ul className="list-disc pl-4 text-red-700">
                    {importSummary.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            </Alert>
          )}

          {importRows.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label={`Tổng số dòng (${importFileName ?? ''})`}
                  value={String(importRows.length)}
                />
                <StatCard
                  label="Dòng hợp lệ (sẵn sàng nhập)"
                  value={String(validImportRows.length)}
                />
                <StatCard
                  label="Dòng bị từ chối (không ghi)"
                  value={String(invalidImportRows.length)}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-600">
                  Chỉ những dòng hợp lệ mới được ghi theo lô (tối đa 500 lệnh/lô). Các
                  dòng lỗi sẽ bị bỏ qua hoàn toàn.
                </p>
                <Button
                  variant="primary"
                  disabled={validImportRows.length === 0}
                  isLoading={isImporting}
                  onClick={handleConfirmImport}
                  leftIcon={<Upload className="h-4 w-4" aria-hidden="true" />}
                >
                  Xác nhận nhập {validImportRows.length} dòng hợp lệ
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">Dòng</th>
                      <th className="px-3.5 py-2.5 font-semibold">ID / Tên</th>
                      <th className="px-3.5 py-2.5 font-semibold">Kiểm tra</th>
                      <th className="px-3.5 py-2.5 font-semibold">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {importRows.map((row) => (
                      <tr key={`${row.rowNumber}-${row.id}`}>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-500">
                          #{row.rowNumber}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <p className="font-semibold text-slate-900">
                            {row.nameVi || '—'}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500">
                            {row.id || '—'}
                          </p>
                        </td>
                        <td className="px-3.5 py-2.5">
                          {row.valid ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-forest-800">
                              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                              {existingIdSet.has(row.id)
                                ? 'Hợp lệ (Cập nhật)'
                                : 'Hợp lệ (Tạo mới)'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                              <XCircle className="h-4 w-4" aria-hidden="true" />
                              Lỗi
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5">
                          {row.valid ? (
                            <span className="text-slate-500">Đạt kiểm tra Zod schema</span>
                          ) : (
                            <ul className="list-disc pl-4 space-y-0.5 text-red-700">
                              {row.errors.map((err, idx) => (
                                <li key={idx}>{err}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <FoodFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingFood={editingFood}
        onSave={handleSaveFood}
      />
    </div>
  );
}
