import { RotateCcw } from 'lucide-react';
import { Button, Select } from '@/src/components/ui';
import {
  ALLERGEN_OPTIONS,
  DIET_TAG_OPTIONS,
  FOOD_CATEGORY_OPTIONS,
} from '@/src/lib/nutrition';
import type { FoodCategory, VerificationStatus } from '@/src/types/food';
import { SearchInput } from './SearchInput';

interface FilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  category: FoodCategory | 'all';
  onCategoryChange: (val: FoodCategory | 'all') => void;
  excludedAllergen: string;
  onExcludedAllergenChange: (val: string) => void;
  dietTag: string;
  onDietTagChange: (val: string) => void;
  verificationFilter: VerificationStatus | 'all';
  onVerificationFilterChange: (val: VerificationStatus | 'all') => void;
  includeUnverified: boolean;
  onIncludeUnverifiedChange: (val: boolean) => void;
  onReset: () => void;
}

export function FilterBar({
  searchQuery,
  onSearchQueryChange,
  category,
  onCategoryChange,
  excludedAllergen,
  onExcludedAllergenChange,
  dietTag,
  onDietTagChange,
  verificationFilter,
  onVerificationFilterChange,
  includeUnverified,
  onIncludeUnverifiedChange,
  onReset,
}: FilterBarProps) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SearchInput
            value={searchQuery}
            onChange={onSearchQueryChange}
          />
        </div>

        <div className="lg:col-span-3">
          <Select
            aria-label="Lọc theo nhóm thực phẩm"
            value={category}
            onChange={(e) =>
              onCategoryChange(e.target.value as FoodCategory | 'all')
            }
            options={[
              { value: 'all', label: 'Tất cả nhóm thực phẩm' },
              ...FOOD_CATEGORY_OPTIONS.map((c) => ({
                value: c.value,
                label: c.labelVi,
              })),
            ]}
          />
        </div>

        <div className="lg:col-span-2">
          <Select
            aria-label="Loại trừ chất dị ứng"
            value={excludedAllergen}
            onChange={(e) => onExcludedAllergenChange(e.target.value)}
            options={[
              { value: '', label: 'Không lọc dị ứng' },
              ...ALLERGEN_OPTIONS.map((a) => ({
                value: a,
                label: `Tránh: ${a}`,
              })),
            ]}
          />
        </div>

        <div className="lg:col-span-2">
          <Select
            aria-label="Lọc theo chế độ ăn"
            value={dietTag}
            onChange={(e) => onDietTagChange(e.target.value)}
            options={[
              { value: 'all', label: 'Mọi chế độ ăn' },
              ...DIET_TAG_OPTIONS.map((d) => ({
                value: d.value,
                label: d.labelVi,
              })),
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3.5">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2.5 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={includeUnverified}
              onChange={(e) => {
                const checked = e.target.checked;
                onIncludeUnverifiedChange(checked);
                if (!checked) {
                  onVerificationFilterChange('all');
                }
              }}
              className="h-4 w-4 rounded border-slate-300 text-forest-800 focus:ring-forest-700"
            />
            <span>Hiện cả dữ liệu ước tính / chưa xác minh</span>
          </label>

          {includeUnverified && (
            <div className="w-48">
              <Select
                aria-label="Mức độ xác minh"
                value={verificationFilter}
                onChange={(e) =>
                  onVerificationFilterChange(
                    e.target.value as VerificationStatus | 'all'
                  )
                }
                options={[
                  { value: 'all', label: 'Tất cả trạng thái' },
                  { value: 'verified', label: 'Đã xác minh' },
                  { value: 'estimated', label: 'Ước tính' },
                  { value: 'unverified', label: 'Chưa xác minh' },
                ]}
              />
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          leftIcon={<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
        >
          Đặt lại bộ lọc
        </Button>
      </div>
    </div>
  );
}
