import type { FoodInput, ServingUnit } from '@/src/types/food';
import { validateFood } from './validation';

export interface ImportRowPreview {
  rowNumber: number;
  id: string;
  nameVi: string;
  valid: boolean;
  data?: FoodInput;
  errors: string[];
}

function parseNullableNumberCell(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isNaN(raw) ? Number.NaN : raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') {
      return null;
    }
    const num = Number(trimmed.replace(',', '.'));
    return Number.isNaN(num) ? Number.NaN : num;
  }
  return Number.NaN;
}

function parseBooleanCell(raw: unknown, defaultValue: boolean): boolean | unknown {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const low = raw.trim().toLowerCase();
    if (low === '') return defaultValue;
    if (low === 'true' || low === '1' || low === 'co' || low === 'yes') return true;
    if (low === 'false' || low === '0' || low === 'khong' || low === 'no') return false;
  }
  return raw;
}

function parseListCell(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Định dạng cột servingUnits trong CSV: "1 chén:100|1 tô:350" hoặc JSON array.
 */
function parseServingUnitsCell(raw: unknown): ServingUnit[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => ({
      label: String((item as Record<string, unknown>)?.label ?? '').trim(),
      grams: Number((item as Record<string, unknown>)?.grams),
    }));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[')) {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          label: String((item as Record<string, unknown>)?.label ?? '').trim(),
          grams: Number((item as Record<string, unknown>)?.grams),
        }));
      }
    }
    return trimmed
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const sepIdx = part.lastIndexOf(':');
        if (sepIdx === -1) {
          return { label: part, grams: Number.NaN };
        }
        return {
          label: part.slice(0, sepIdx).trim(),
          grams: Number(part.slice(sepIdx + 1).trim()),
        };
      });
  }
  return [];
}

/**
 * Bộ phân tích CSV tuân thủ RFC-4180 cơ bản (hỗ trợ dấu ngoặc kép và dấu phẩy bên trong).
 */
export function parseCsvRows(csvText: string): Record<string, string>[] {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (char === '\r' && nextChar === '\n') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
      i += 1;
    } else if (char === '\n' || char === '\r') {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  if (nonEmptyRows.length < 2) {
    return [];
  }

  const headers = nonEmptyRows[0].map((h) => h.trim());
  return nonEmptyRows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      if (header) {
        record[header] = cells[idx] ?? '';
      }
    });
    return record;
  });
}

function normalizeRawImportItem(raw: Record<string, unknown>): unknown {
  const rawNutrients =
    typeof raw.nutrientsPer100g === 'object' && raw.nutrientsPer100g !== null
      ? (raw.nutrientsPer100g as Record<string, unknown>)
      : raw;

  const rawSource =
    typeof raw.source === 'object' && raw.source !== null
      ? (raw.source as Record<string, unknown>)
      : null;

  const sourceName = rawSource
    ? String(rawSource.name ?? '').trim()
    : String(raw.sourceName ?? '').trim();
  const sourceYearRaw = rawSource ? rawSource.year : raw.sourceYear;
  const sourceYear = parseNullableNumberCell(sourceYearRaw);
  const sourceReference = rawSource
    ? String(rawSource.reference ?? '').trim()
    : String(raw.sourceReference ?? '').trim();

  const hasAnySource =
    sourceName !== '' || sourceYear !== null || sourceReference !== '';

  let parsedServingUnits: ServingUnit[] = [];
  try {
    parsedServingUnits = parseServingUnitsCell(raw.servingUnits);
  } catch {
    parsedServingUnits = [{ label: '', grams: Number.NaN }];
  }

  return {
    id: String(raw.id ?? '').trim(),
    nameVi: String(raw.nameVi ?? '').trim(),
    nameEn: String(raw.nameEn ?? '').trim(),
    aliases: parseListCell(raw.aliases),
    category: String(raw.category ?? '').trim(),
    nutrientsPer100g: {
      energyKcal: parseNullableNumberCell(rawNutrients.energyKcal),
      proteinG: parseNullableNumberCell(rawNutrients.proteinG),
      fatG: parseNullableNumberCell(rawNutrients.fatG),
      carbG: parseNullableNumberCell(rawNutrients.carbG),
      fiberG: parseNullableNumberCell(rawNutrients.fiberG),
      sugarG: parseNullableNumberCell(rawNutrients.sugarG),
      sodiumMg: parseNullableNumberCell(rawNutrients.sodiumMg),
    },
    servingUnits: parsedServingUnits,
    allergens: parseListCell(raw.allergens),
    allergensReviewed: parseBooleanCell(raw.allergensReviewed, false),
    dietTags: parseListCell(raw.dietTags),
    source: hasAnySource
      ? {
          name: sourceName,
          year: sourceYear,
          reference: sourceReference,
        }
      : null,
    verificationStatus: String(raw.verificationStatus ?? 'unverified').trim(),
    imagePath: raw.imagePath ? String(raw.imagePath).trim() : null,
    isActive: parseBooleanCell(raw.isActive, true),
  };
}

export function validateImportPayload(
  fileName: string,
  content: string
): {
  rows: ImportRowPreview[];
  parseError?: string;
} {
  const lowerName = fileName.toLowerCase();
  let rawObjects: Record<string, unknown>[] = [];

  if (lowerName.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        return {
          rows: [],
          parseError: 'Tệp JSON phải là một mảng ([...]) chứa các đối tượng thực phẩm.',
        };
      }
      rawObjects = parsed.map((item) =>
        typeof item === 'object' && item !== null
          ? (item as Record<string, unknown>)
          : {}
      );
    } catch {
      return {
        rows: [],
        parseError: 'Không thể phân tích cú pháp JSON. Vui lòng kiểm tra lại định dạng tệp.',
      };
    }
  } else if (lowerName.endsWith('.csv')) {
    rawObjects = parseCsvRows(content);
    if (rawObjects.length === 0) {
      return {
        rows: [],
        parseError:
          'Tệp CSV trống hoặc không có dòng dữ liệu hợp lệ (cần dòng tiêu đề và ít nhất 1 dòng dữ liệu).',
      };
    }
  } else {
    return {
      rows: [],
      parseError: 'Chỉ hỗ trợ tệp định dạng .json hoặc .csv.',
    };
  }

  const rows: ImportRowPreview[] = rawObjects.map((raw, index) => {
    const normalized = normalizeRawImportItem(raw) as Record<string, unknown>;
    const validation = validateFood(normalized);
    if (validation.success) {
      return {
        rowNumber: index + 1,
        id: validation.data.id,
        nameVi: validation.data.nameVi,
        valid: true,
        data: validation.data,
        errors: [],
      };
    }
    return {
      rowNumber: index + 1,
      id: String(raw.id ?? ''),
      nameVi: String(raw.nameVi ?? ''),
      valid: false,
      errors: validation.errors,
    };
  });

  return { rows };
}
