import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  Select,
} from '@/src/components/ui';
import {
  ALLERGEN_OPTIONS,
  DIET_TAG_OPTIONS,
  FOOD_CATEGORY_OPTIONS,
  NUTRIENT_FIELD_META,
  slugifyFoodId,
  validateFood,
} from '@/src/lib/nutrition';
import type {
  FoodCategory,
  FoodInput,
  FoodItem,
  NutrientKey,
  VerificationStatus,
} from '@/src/types/food';

interface FoodFormModalProps {
  open: boolean;
  onClose: () => void;
  editingFood: FoodItem | null;
  onSave: (input: FoodInput, isExisting: boolean) => Promise<void>;
}

interface RawFoodFormValues {
  id: string;
  nameVi: string;
  nameEn: string;
  aliasesText: string;
  category: FoodCategory;
  energyKcal: string;
  proteinG: string;
  fatG: string;
  carbG: string;
  fiberG: string;
  sugarG: string;
  sodiumMg: string;
  servingUnits: Array<{ label: string; grams: string }>;
  allergens: string[];
  allergensReviewed: boolean;
  dietTags: string[];
  verificationStatus: VerificationStatus;
  sourceName: string;
  sourceYear: string;
  sourceReference: string;
  imagePath: string;
  isActive: boolean;
}

function toStringOrEmpty(val: number | null | undefined): string {
  return val === null || val === undefined ? '' : String(val);
}

function parseNullableNutrient(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed.replace(',', '.'));
  return Number.isNaN(num) ? Number.NaN : num;
}

export function FoodFormModal({
  open,
  onClose,
  editingFood,
  onSave,
}: FoodFormModalProps) {
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RawFoodFormValues>({
    defaultValues: {
      id: '',
      nameVi: '',
      nameEn: '',
      aliasesText: '',
      category: 'rice_noodles',
      energyKcal: '',
      proteinG: '',
      fatG: '',
      carbG: '',
      fiberG: '',
      sugarG: '',
      sodiumMg: '',
      servingUnits: [{ label: '1 phần', grams: '100' }],
      allergens: [],
      allergensReviewed: false,
      dietTags: [],
      verificationStatus: 'unverified',
      sourceName: '',
      sourceYear: '',
      sourceReference: '',
      imagePath: '',
      isActive: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'servingUnits',
  });

  useEffect(() => {
    if (!open) return;
    setFormErrors([]);
    if (editingFood) {
      form.reset({
        id: editingFood.id,
        nameVi: editingFood.nameVi,
        nameEn: editingFood.nameEn,
        aliasesText: editingFood.aliases.join(', '),
        category: editingFood.category,
        energyKcal: toStringOrEmpty(editingFood.nutrientsPer100g.energyKcal),
        proteinG: toStringOrEmpty(editingFood.nutrientsPer100g.proteinG),
        fatG: toStringOrEmpty(editingFood.nutrientsPer100g.fatG),
        carbG: toStringOrEmpty(editingFood.nutrientsPer100g.carbG),
        fiberG: toStringOrEmpty(editingFood.nutrientsPer100g.fiberG),
        sugarG: toStringOrEmpty(editingFood.nutrientsPer100g.sugarG),
        sodiumMg: toStringOrEmpty(editingFood.nutrientsPer100g.sodiumMg),
        servingUnits: editingFood.servingUnits.map((u) => ({
          label: u.label,
          grams: String(u.grams),
        })),
        allergens: editingFood.allergens,
        allergensReviewed: editingFood.allergensReviewed,
        dietTags: editingFood.dietTags,
        verificationStatus: editingFood.verificationStatus,
        sourceName: editingFood.source?.name ?? '',
        sourceYear: toStringOrEmpty(editingFood.source?.year),
        sourceReference: editingFood.source?.reference ?? '',
        imagePath: editingFood.imagePath ?? '',
        isActive: editingFood.isActive,
      });
    } else {
      form.reset({
        id: '',
        nameVi: '',
        nameEn: '',
        aliasesText: '',
        category: 'rice_noodles',
        energyKcal: '',
        proteinG: '',
        fatG: '',
        carbG: '',
        fiberG: '',
        sugarG: '',
        sodiumMg: '',
        servingUnits: [{ label: '1 phần', grams: '100' }],
        allergens: [],
        allergensReviewed: false,
        dietTags: [],
        verificationStatus: 'unverified',
        sourceName: '',
        sourceYear: '',
        sourceReference: '',
        imagePath: '',
        isActive: true,
      });
    }
  }, [open, editingFood, form]);

  const selectedAllergens = form.watch('allergens');
  const selectedDietTags = form.watch('dietTags');
  const verificationStatus = form.watch('verificationStatus');
  const nameViValue = form.watch('nameVi');

  const toggleArrayField = (
    field: 'allergens' | 'dietTags',
    value: string
  ) => {
    const current = form.getValues(field);
    if (current.includes(value)) {
      form.setValue(
        field,
        current.filter((item) => item !== value)
      );
    } else {
      form.setValue(field, [...current, value]);
    }
  };

  const handleSubmit = async (raw: RawFoodFormValues) => {
    setFormErrors([]);
    const hasAnySource =
      raw.sourceName.trim() !== '' ||
      raw.sourceYear.trim() !== '' ||
      raw.sourceReference.trim() !== '';

    const candidate = {
      id: raw.id.trim(),
      nameVi: raw.nameVi.trim(),
      nameEn: raw.nameEn.trim(),
      aliases: raw.aliasesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      category: raw.category,
      nutrientsPer100g: {
        energyKcal: parseNullableNutrient(raw.energyKcal),
        proteinG: parseNullableNutrient(raw.proteinG),
        fatG: parseNullableNutrient(raw.fatG),
        carbG: parseNullableNutrient(raw.carbG),
        fiberG: parseNullableNutrient(raw.fiberG),
        sugarG: parseNullableNutrient(raw.sugarG),
        sodiumMg: parseNullableNutrient(raw.sodiumMg),
      },
      servingUnits: raw.servingUnits
        .filter((u) => u.label.trim() !== '' || u.grams.trim() !== '')
        .map((u) => ({
          label: u.label.trim(),
          grams: Number(u.grams.replace(',', '.')),
        })),
      allergens: raw.allergens,
      allergensReviewed: raw.allergensReviewed,
      dietTags: raw.dietTags,
      source: hasAnySource
        ? {
            name: raw.sourceName.trim(),
            year: parseNullableNutrient(raw.sourceYear),
            reference: raw.sourceReference.trim(),
          }
        : null,
      verificationStatus: raw.verificationStatus,
      imagePath: raw.imagePath.trim() ? raw.imagePath.trim() : null,
      isActive: raw.isActive,
    };

    const validation = validateFood(candidate);
    if (!validation.success) {
      setFormErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(validation.data, Boolean(editingFood));
      onClose();
    } catch (error) {
      setFormErrors([
        error instanceof Error
          ? error.message
          : 'Không thể lưu dữ liệu thực phẩm.',
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editingFood ? `Chỉnh sửa: ${editingFood.nameVi}` : 'Thêm thực phẩm mới'}
      description="Các trường dinh dưỡng để trống sẽ được lưu là null ('Chưa có dữ liệu'), không quy về 0."
      maxWidthClass="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button
            variant="primary"
            isLoading={isSubmitting}
            onClick={form.handleSubmit(handleSubmit)}
          >
            {editingFood ? 'Lưu thay đổi' : 'Tạo thực phẩm'}
          </Button>
        </>
      }
    >
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        noValidate
        className="space-y-5"
      >
        {formErrors.length > 0 && (
          <Alert tone="danger" title="Dữ liệu chưa hợp lệ">
            <ul className="list-disc pl-4 space-y-1 text-xs">
              {formErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            id="food-name-vi"
            label="Tên tiếng Việt"
            required
          >
            <Input
              id="food-name-vi"
              placeholder="Ví dụ: Phở bò"
              {...form.register('nameVi')}
            />
          </FormField>

          <FormField
            id="food-id"
            label="Mã slug (ID)"
            required
            hint={
              editingFood
                ? 'ID không thay đổi sau khi tạo.'
                : 'Chỉ gồm chữ không dấu, số, gạch ngang.'
            }
          >
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  id="food-id"
                  disabled={Boolean(editingFood)}
                  placeholder="pho-bo"
                  {...form.register('id')}
                />
              </div>
              {!editingFood && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    form.setValue('id', slugifyFoodId(nameViValue))
                  }
                >
                  Tạo slug
                </Button>
              )}
            </div>
          </FormField>

          <FormField id="food-name-en" label="Tên tiếng Anh (tùy chọn)">
            <Input
              id="food-name-en"
              placeholder="Beef noodle soup"
              {...form.register('nameEn')}
            />
          </FormField>

          <FormField id="food-category" label="Nhóm thực phẩm" required>
            <Select
              id="food-category"
              options={FOOD_CATEGORY_OPTIONS.map((c) => ({
                value: c.value,
                label: c.labelVi,
              }))}
              {...form.register('category')}
            />
          </FormField>
        </div>

        <FormField
          id="food-aliases"
          label="Tên gọi khác / vùng miền (phân tách bằng dấu phẩy)"
        >
          <Input
            id="food-aliases"
            placeholder="Phở bò tái, Phở Hà Nội"
            {...form.register('aliasesText')}
          />
        </FormField>

        {/* Nutrients per 100g */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-900">
            Thành phần dinh dưỡng trên 100 g (để trống nếu chưa có dữ liệu)
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {NUTRIENT_FIELD_META.map((meta) => (
              <FormField
                key={meta.key}
                id={`nutrient-${meta.key}`}
                label={meta.labelVi}
              >
                <Input
                  id={`nutrient-${meta.key}`}
                  type="text"
                  inputMode="decimal"
                  unitLabel={meta.unit}
                  placeholder="null"
                  {...form.register(meta.key as keyof RawFoodFormValues & NutrientKey)}
                />
              </FormField>
            ))}
          </div>
        </div>

        {/* Serving units */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">
              Đơn vị khẩu phần quy đổi
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => append({ label: '', grams: '' })}
              leftIcon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              Thêm đơn vị
            </Button>
          </div>

          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Ví dụ: 1 chén, 1 tô"
                    {...form.register(`servingUnits.${index}.label`)}
                  />
                </div>
                <div className="w-36">
                  <Input
                    type="text"
                    inputMode="decimal"
                    unitLabel="g"
                    placeholder="100"
                    {...form.register(`servingUnits.${index}.grams`)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Xóa đơn vị"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Verification & Source */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="food-verification"
              label="Trạng thái xác minh"
              required
            >
              <Select
                id="food-verification"
                options={[
                  { value: 'verified', label: 'Đã xác minh (bắt buộc có nguồn)' },
                  { value: 'estimated', label: 'Ước tính' },
                  { value: 'unverified', label: 'Chưa xác minh' },
                ]}
                {...form.register('verificationStatus')}
              />
            </FormField>

            <FormField
              id="food-image-path"
              label="Đường dẫn ảnh tĩnh (/images/foods/...)"
            >
              <Input
                id="food-image-path"
                placeholder="/images/foods/pho-bo.jpg"
                {...form.register('imagePath')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField
              id="food-source-name"
              label="Tên nguồn"
              required={verificationStatus === 'verified'}
            >
              <Input
                id="food-source-name"
                placeholder="Bảng thành phần thực phẩm..."
                {...form.register('sourceName')}
              />
            </FormField>

            <FormField
              id="food-source-year"
              label="Năm"
              required={verificationStatus === 'verified'}
            >
              <Input
                id="food-source-year"
                type="text"
                inputMode="numeric"
                placeholder="2024"
                {...form.register('sourceYear')}
              />
            </FormField>

            <FormField
              id="food-source-ref"
              label="Tham chiếu / Trang"
              required={verificationStatus === 'verified'}
            >
              <Input
                id="food-source-ref"
                placeholder="Mã số / trang..."
                {...form.register('sourceReference')}
              />
            </FormField>
          </div>
        </div>

        {/* Allergens & Diet tags */}
        <div className="space-y-4 border-t border-slate-200 pt-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                Chất gây dị ứng
              </span>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  {...form.register('allergensReviewed')}
                  className="h-4 w-4 rounded border-slate-300 text-forest-800"
                />
                <span>Đã rà soát thông tin dị ứng (allergensReviewed)</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGEN_OPTIONS.map((allergen) => {
                const selected = selectedAllergens.includes(allergen);
                return (
                  <button
                    key={allergen}
                    type="button"
                    onClick={() => toggleArrayField('allergens', allergen)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                      selected
                        ? 'border-red-300 bg-red-50 text-red-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                    <span>{allergen}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-semibold text-slate-900">
              Nhãn chế độ ăn
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DIET_TAG_OPTIONS.map((tag) => {
                const selected = selectedDietTags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    type="button"
                    onClick={() => toggleArrayField('dietTags', tag.value)}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer ${
                      selected
                        ? 'border-forest-700 bg-forest-50 text-forest-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" aria-hidden="true" />}
                    <span>{tag.labelVi}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
