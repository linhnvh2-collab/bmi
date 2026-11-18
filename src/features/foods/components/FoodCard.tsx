import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Apple,
  Beef,
  Coffee,
  Egg,
  Fish,
  Heart,
  Leaf,
  Scale,
  Soup,
  Sprout,
  Utensils,
} from 'lucide-react';
import {
  findMatchingAllergens,
  FOOD_CATEGORY_LABELS,
} from '@/src/lib/nutrition';
import type { FoodCategory, FoodItem } from '@/src/types/food';
import { AllergenBadge, AllergenUnreviewedTag } from './AllergenBadge';
import { VerificationBadge } from './VerificationBadge';

interface FoodCardProps {
  food: FoodItem;
  userAllergens: string[];
  isFavorite: boolean;
  onToggleFavorite?: (foodId: string) => void;
  isCompareSelected: boolean;
  onToggleCompare: (food: FoodItem) => void;
  compareDisabled: boolean;
}

const categoryIcons: Record<FoodCategory, typeof Utensils> = {
  rice_noodles: Utensils,
  meat: Beef,
  fish_seafood: Fish,
  eggs_dairy: Egg,
  vegetables: Leaf,
  fruits: Apple,
  legumes_nuts: Sprout,
  soups: Soup,
  snacks: Utensils,
  drinks: Coffee,
  condiments: Utensils,
};

function fmtMacro(val: number | null): string {
  return val === null ? '—' : `${val}g`;
}

export function FoodCard({
  food,
  userAllergens,
  isFavorite,
  onToggleFavorite,
  isCompareSelected,
  onToggleCompare,
  compareDisabled,
}: FoodCardProps) {
  const [imgError, setImgError] = useState(false);
  const CategoryIcon = categoryIcons[food.category] ?? Utensils;
  const matchedAllergens = findMatchingAllergens(food.allergens, userAllergens);
  const energyText =
    food.nutrientsPer100g.energyKcal !== null
      ? `${food.nutrientsPer100g.energyKcal} kcal`
      : 'Chưa có dữ liệu';

  return (
    <article className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white overflow-hidden transition-colors hover:border-forest-300">
      <div>
        {/* 4:3 Image Slot or Category Empty State */}
        <Link to={`/foods/${food.id}`} className="block">
          {food.imagePath && !imgError ? (
            <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 border-b border-slate-200">
              <img
                src={food.imagePath}
                alt={food.nameVi}
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 border-b border-slate-200 bg-forest-50/45 px-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-forest-200 bg-white text-forest-700">
                <CategoryIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {FOOD_CATEGORY_LABELS[food.category]} · Chưa có ảnh món ăn
              </span>
            </div>
          )}
        </Link>

        <div className="p-4 space-y-3">
          {/* Category quiet metadata + verification badge */}
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-500">
              {FOOD_CATEGORY_LABELS[food.category]}
            </span>
            <VerificationBadge status={food.verificationStatus} />
          </div>

          {/* Food title */}
          <div>
            <Link
              to={`/foods/${food.id}`}
              className="text-base font-semibold text-slate-900 hover:text-forest-800 transition-colors"
            >
              {food.nameVi}
            </Link>
            {food.nameEn && (
              <p className="text-xs text-slate-500">{food.nameEn}</p>
            )}
          </div>

          {/* Energy + Macro strip per 100g */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-600">Năng lượng / 100g</span>
              <span className="font-mono text-sm font-semibold text-forest-900 tabular-nums">
                {energyText}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 border-t border-slate-200/80 pt-2 text-center font-mono text-[11px] tabular-nums">
              <div>
                <span className="block text-[10px] font-sans text-slate-500">Đạm</span>
                <span className="font-semibold text-slate-800">
                  {fmtMacro(food.nutrientsPer100g.proteinG)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-sans text-slate-500">Carb</span>
                <span className="font-semibold text-slate-800">
                  {fmtMacro(food.nutrientsPer100g.carbG)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-sans text-slate-500">Béo</span>
                <span className="font-semibold text-slate-800">
                  {fmtMacro(food.nutrientsPer100g.fatG)}
                </span>
              </div>
            </div>
          </div>

          {/* Allergen tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {food.allergens.map((allergen) => (
              <AllergenBadge
                key={allergen}
                label={allergen}
                isMatchedUserAllergen={matchedAllergens.includes(allergen)}
              />
            ))}
            {!food.allergensReviewed && <AllergenUnreviewedTag />}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-4 py-2.5">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={isCompareSelected}
            disabled={!isCompareSelected && compareDisabled}
            onChange={() => onToggleCompare(food)}
            className="h-4 w-4 rounded border-slate-300 text-forest-800 focus:ring-forest-700 disabled:opacity-40"
          />
          <Scale className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span>So sánh</span>
        </label>

        <div className="flex items-center gap-2">
          {onToggleFavorite && (
            <button
              type="button"
              onClick={() => onToggleFavorite(food.id)}
              aria-label={
                isFavorite
                  ? `Bỏ thích ${food.nameVi}`
                  : `Lưu yêu thích ${food.nameVi}`
              }
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                isFavorite
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:text-red-700'
              }`}
            >
              <Heart
                className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
            </button>
          )}
          <Link
            to={`/foods/${food.id}`}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-forest-800 hover:bg-forest-50 whitespace-nowrap"
          >
            Chi tiết
          </Link>
        </div>
      </div>
    </article>
  );
}
