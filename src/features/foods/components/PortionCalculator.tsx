import { useMemo, useState } from 'react';
import { Scale } from 'lucide-react';
import { Card, FormField, Input, Select, Tabs } from '@/src/components/ui';
import {
  gramsFromServing,
  NUTRIENT_PLAUSIBILITY_LIMITS,
  scaleNutrients,
} from '@/src/lib/nutrition';
import type { NutrientsPer100g, ServingUnit } from '@/src/types/food';

interface PortionCalculatorProps {
  servingUnits: ServingUnit[];
  nutrientsPer100g: NutrientsPer100g;
  onPortionChange: (grams: number | null, scaled: NutrientsPer100g | null) => void;
}

type Mode = 'serving' | 'grams';

export function PortionCalculator({
  servingUnits,
  nutrientsPer100g,
  onPortionChange,
}: PortionCalculatorProps) {
  const hasServings = servingUnits.length > 0;
  const [mode, setMode] = useState<Mode>(hasServings ? 'serving' : 'grams');
  const [selectedIndex, setSelectedIndex] = useState<string>('0');
  const [quantityRaw, setQuantityRaw] = useState<string>('1');
  const [gramsRaw, setGramsRaw] = useState<string>(
    hasServings ? String(servingUnits[0].grams) : '100'
  );

  const computed = useMemo(() => {
    if (mode === 'serving' && hasServings) {
      const idx = Number(selectedIndex);
      const unit = servingUnits[idx];
      const qty = Number(quantityRaw.replace(',', '.'));
      if (!unit) {
        return {
          grams: null,
          scaled: null,
          error: 'Đơn vị khẩu phần không hợp lệ.',
        };
      }
      if (!quantityRaw.trim() || !Number.isFinite(qty) || qty <= 0) {
        return {
          grams: null,
          scaled: null,
          error: 'Số lượng khẩu phần phải lớn hơn 0.',
        };
      }
      const totalGrams = gramsFromServing(unit, qty);
      if (totalGrams > NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax) {
        return {
          grams: null,
          scaled: null,
          error: `Tổng khối lượng tối đa ${NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax} g.`,
        };
      }
      return {
        grams: totalGrams,
        scaled: scaleNutrients(nutrientsPer100g, totalGrams),
        error: null,
      };
    }

    const gramsVal = Number(gramsRaw.replace(',', '.'));
    if (!gramsRaw.trim() || !Number.isFinite(gramsVal) || gramsVal <= 0) {
      return {
        grams: null,
        scaled: null,
        error: 'Khối lượng phải là số dương lớn hơn 0 g.',
      };
    }
    if (gramsVal > NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax) {
      return {
        grams: null,
        scaled: null,
        error: `Khối lượng khẩu phần không vượt quá ${NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax} g.`,
      };
    }
    const roundedGrams = Math.round(gramsVal * 10) / 10;
    return {
      grams: roundedGrams,
      scaled: scaleNutrients(nutrientsPer100g, roundedGrams),
      error: null,
    };
  }, [mode, hasServings, selectedIndex, quantityRaw, gramsRaw, servingUnits, nutrientsPer100g]);

  // Synchronize upward safely during user changes via event handlers + memoized trigger
  const syncUpward = (
    nextMode: Mode,
    nextIdx: string,
    nextQty: string,
    nextGrams: string
  ) => {
    if (nextMode === 'serving' && hasServings) {
      const unit = servingUnits[Number(nextIdx)];
      const qty = Number(nextQty.replace(',', '.'));
      if (
        unit &&
        nextQty.trim() &&
        Number.isFinite(qty) &&
        qty > 0 &&
        gramsFromServing(unit, qty) <= NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax
      ) {
        const g = gramsFromServing(unit, qty);
        onPortionChange(g, scaleNutrients(nutrientsPer100g, g));
        return;
      }
      onPortionChange(null, null);
      return;
    }

    const gVal = Number(nextGrams.replace(',', '.'));
    if (
      nextGrams.trim() &&
      Number.isFinite(gVal) &&
      gVal > 0 &&
      gVal <= NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax
    ) {
      const rounded = Math.round(gVal * 10) / 10;
      onPortionChange(rounded, scaleNutrients(nutrientsPer100g, rounded));
      return;
    }
    onPortionChange(null, null);
  };

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-forest-700" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-900">
            Tính khẩu phần ăn
          </h2>
        </div>

        {hasServings && (
          <Tabs
            value={mode}
            onChange={(val) => {
              setMode(val);
              syncUpward(val, selectedIndex, quantityRaw, gramsRaw);
            }}
            items={[
              { value: 'serving', label: 'Theo đơn vị' },
              { value: 'grams', label: 'Nhập gram' },
            ]}
          />
        )}
      </div>

      {mode === 'serving' && hasServings ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField id="portion-unit-select" label="Đơn vị khẩu phần">
            <Select
              id="portion-unit-select"
              value={selectedIndex}
              onChange={(e) => {
                const nextIdx = e.target.value;
                setSelectedIndex(nextIdx);
                syncUpward(mode, nextIdx, quantityRaw, gramsRaw);
              }}
              options={servingUnits.map((unit, idx) => ({
                value: String(idx),
                label: `${unit.label} (${unit.grams} g)`,
              }))}
            />
          </FormField>

          <FormField
            id="portion-quantity-input"
            label="Số lượng"
            error={computed.error ?? undefined}
          >
            <Input
              id="portion-quantity-input"
              type="text"
              inputMode="decimal"
              value={quantityRaw}
              hasError={Boolean(computed.error)}
              onChange={(e) => {
                const val = e.target.value;
                setQuantityRaw(val);
                syncUpward(mode, selectedIndex, val, gramsRaw);
              }}
              placeholder="1"
            />
          </FormField>
        </div>
      ) : (
        <FormField
          id="portion-grams-input"
          label="Khối lượng khẩu phần (gram)"
          hint={`Từ > 0 đến ${NUTRIENT_PLAUSIBILITY_LIMITS.portionGramsMax} g`}
          error={computed.error ?? undefined}
        >
          <Input
            id="portion-grams-input"
            type="text"
            inputMode="decimal"
            unitLabel="g"
            value={gramsRaw}
            hasError={Boolean(computed.error)}
            onChange={(e) => {
              const val = e.target.value;
              setGramsRaw(val);
              syncUpward(mode, selectedIndex, quantityRaw, val);
            }}
            placeholder="100"
          />
        </FormField>
      )}

      {computed.grams !== null && (
        <p className="text-xs text-slate-600">
          Đang quy đổi theo khẩu phần:{' '}
          <span className="font-mono font-semibold text-forest-900 tabular-nums">
            {computed.grams} g
          </span>
        </p>
      )}
    </Card>
  );
}
