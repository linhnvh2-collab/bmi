import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { z } from 'zod';
import type { FoodItem, NutrientsPer100g } from './src/types/food.ts';
import type {
  MealPlanDay,
  MealPlanDish,
  MealPlanSlot,
  MealPlanSlotType,
  ScannedFoodAnalysisResponse,
  ScannedFoodMatch,
  SwapDishSuggestion,
} from './src/types/mealPlan.ts';
import { normalizeVietnamese } from './src/lib/nutrition/normalize.ts';
import { VIETNAMESE_FOOD_CATALOG } from './src/lib/nutrition/vietnameseCatalog.ts';
import {
  GEMINI_MODEL,
  generateGeminiJsonContent,
  hasConfiguredGeminiKey,
  sanitizeAiErrorResponse,
} from './src/server/geminiService.ts';
import {
  buildCompactCatalogForPrompt,
  buildMergedCatalog,
  customFoodInputSchema,
  deriveFoodPracticalMeta,
  filterSafeCatalog,
  scaleNutrientsDeterministic,
  SLOT_META,
  sumNutrientsDeterministic,
} from './src/server/nutritionEngine.ts';
import { createAiRateLimiter } from './src/server/rateLimiter.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const dietModeEnum = z.enum([
  'balanced',
  'plant_heavy',
  'high_protein',
  'vegetarian',
  'budget_friendly',
  'custom',
]);

const nutritionGoalEnum = z.enum([
  'maintain',
  'lose_gradual',
  'gain_gradual',
  'build_muscle',
  'nutrition_balance',
  'healthy_habits',
]);

const slotTypeEnum = z.enum([
  'breakfast',
  'morning_snack',
  'lunch',
  'afternoon_snack',
  'dinner',
]);

const mealPlanRequestSchema = z.object({
  durationDays: z.union([z.literal(1), z.literal(3), z.literal(7)]),
  targetKcalPerDay: z.number().min(800).max(6000).nullable(),
  dietMode: dietModeEnum,
  nutritionGoal: nutritionGoalEnum,
  budgetLevel: z.enum(['economy', 'standard', 'flexible']).default('standard'),
  dailyBudgetVnd: z.number().min(10000).max(5000000).nullable().optional(),
  prepTimePreference: z
    .enum(['quick', 'moderate', 'elaborate'])
    .default('moderate'),
  mealsPerDay: z.union([z.literal(3), z.literal(4), z.literal(5)]).default(5),
  isUnder18: z.boolean().default(false),
  hasMedicalScreeningRisk: z.boolean().default(false),
  excludedAllergens: z.array(z.string()).max(20).default([]),
  dislikedFoods: z.array(z.string()).max(20).default([]),
  preferredTags: z.array(z.string()).max(20).default([]),
  availableIngredients: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
  customFoods: z.array(customFoodInputSchema).max(150).optional(),
});

const swapMealRequestSchema = z.object({
  slotType: slotTypeEnum,
  currentFoodId: z.string().min(1),
  currentGrams: z.number().min(10).max(1500),
  dietMode: dietModeEnum.default('balanced'),
  nutritionGoal: nutritionGoalEnum.default('nutrition_balance'),
  targetKcalPerDay: z.number().min(800).max(6000).nullable().default(null),
  isUnder18: z.boolean().default(false),
  hasMedicalScreeningRisk: z.boolean().default(false),
  preferQuickPrep: z.boolean().default(false),
  preferEconomy: z.boolean().default(false),
  availableIngredients: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
  excludedAllergens: z.array(z.string()).max(20).default([]),
  dislikedFoods: z.array(z.string()).max(20).default([]),
  customFoods: z.array(customFoodInputSchema).max(150).optional(),
});

const swapSlotRequestSchema = z.object({
  slotType: slotTypeEnum,
  currentFoodIds: z.array(z.string()).max(10).default([]),
  dietMode: dietModeEnum.default('balanced'),
  nutritionGoal: nutritionGoalEnum.default('nutrition_balance'),
  targetSlotKcal: z.number().min(100).max(2500).nullable().default(null),
  budgetLevel: z.enum(['economy', 'standard', 'flexible']).default('standard'),
  prepTimePreference: z
    .enum(['quick', 'moderate', 'elaborate'])
    .default('moderate'),
  preferQuickPrep: z.boolean().default(false),
  preferEconomy: z.boolean().default(false),
  isUnder18: z.boolean().default(false),
  hasMedicalScreeningRisk: z.boolean().default(false),
  availableIngredients: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
  excludedAllergens: z.array(z.string()).max(20).default([]),
  dislikedFoods: z.array(z.string()).max(20).default([]),
  customFoods: z.array(customFoodInputSchema).max(150).optional(),
});

const analyzeImageRequestSchema = z.object({
  imageBase64: z.string().min(20),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  customFoods: z.array(customFoodInputSchema).max(150).optional(),
});

function getActiveSlotMetas(mealsPerDay: 3 | 4 | 5) {
  if (mealsPerDay === 3) {
    return SLOT_META.filter(
      (s) =>
        s.slotType === 'breakfast' ||
        s.slotType === 'lunch' ||
        s.slotType === 'dinner'
    );
  }
  if (mealsPerDay === 4) {
    return SLOT_META.filter((s) => s.slotType !== 'morning_snack');
  }
  return SLOT_META;
}

function foodMatchesAvailableIngredients(
  food: FoodItem,
  normAvailable: string[]
): boolean {
  if (normAvailable.length === 0) return false;
  const hay = normalizeVietnamese(
    [food.nameVi, ...food.aliases, ...(food.ingredients ?? [])].join(' ')
  );
  return normAvailable.some((kw) => hay.includes(kw));
}

function buildDishFromCatalog(
  slotDishId: string,
  food: FoodItem,
  grams: number,
  servingLabel?: string,
  prepNote?: string,
  aiReason?: string
): MealPlanDish {
  const practical = deriveFoodPracticalMeta(food);
  return {
    slotDishId,
    foodId: food.id,
    nameVi: food.nameVi,
    category: food.category,
    imagePath: food.imagePath,
    grams,
    servingLabel:
      servingLabel?.trim() || food.servingUnits[0]?.label || `${grams}g`,
    nutrientsScaled: scaleNutrientsDeterministic(food.nutrientsPer100g, grams),
    nutrientsPer100g: food.nutrientsPer100g,
    verificationStatus: food.verificationStatus,
    allergens: food.allergens,
    ingredients: food.ingredients ?? [],
    prepNote:
      prepNote?.trim() ||
      food.preparationNote ||
      'Chế biến chín kỹ, giữ vị thanh đạm.',
    prepTimeMinutes: practical.prepTimeMinutes,
    budgetTier: practical.budgetTier,
    aiReason:
      aiReason?.trim() || 'Phù hợp cân đối nhóm chất trong khung bữa này.',
  };
}

function handleAiRouteError(
  res: Response,
  routeName: string,
  fallbackMessage: string,
  err: unknown
): void {
  console.error(`Error ${routeName}:`, err);
  const sanitized = sanitizeAiErrorResponse(err, fallbackMessage);
  res.status(sanitized.status).json(sanitized.body);
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  // Basic HTTP security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      model: GEMINI_MODEL,
      hasGeminiKey: hasConfiguredGeminiKey(),
    });
  });

  // Protect AI endpoints from abuse/burst traffic
  app.use('/api/ai', createAiRateLimiter({ windowMs: 60_000, maxRequests: 25 }));

  // 1. AI Meal Plan Generator (Gemini chooses foodIds + portions; NutritionEngine computes exact macros/kcal)
  app.post('/api/ai/meal-plan', async (req: Request, res: Response) => {
    try {
      const parsed = mealPlanRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Tham số tạo thực đơn không hợp lệ.',
          details: parsed.error.issues.map((i) => i.message),
        });
        return;
      }

      const input = parsed.data;
      const effectiveSafetyLock =
        input.isUnder18 || input.hasMedicalScreeningRisk;
      const effectiveGoal = effectiveSafetyLock
        ? 'healthy_habits'
        : input.nutritionGoal;
      const effectiveTargetKcal = effectiveSafetyLock
        ? null
        : input.targetKcalPerDay;

      const mergedMap = buildMergedCatalog(input.customFoods);
      const safeCatalog = filterSafeCatalog(
        Array.from(mergedMap.values()),
        input.excludedAllergens,
        input.dislikedFoods,
        input.dietMode
      );

      if (safeCatalog.length < 6) {
        res.status(400).json({
          error:
            'Danh sách món ăn an toàn sau khi lọc dị ứng và sở thích quá ít để lập thực đơn cân bằng. Vui lòng kiểm tra lại hồ sơ.',
        });
        return;
      }

      const safeMap = new Map<string, FoodItem>(
        safeCatalog.map((f) => [f.id, f])
      );
      const activeSlots = getActiveSlotMetas(input.mealsPerDay);
      const compactCatalog = buildCompactCatalogForPrompt(safeCatalog);

      const systemInstruction = `Bạn là chuyên gia giáo dục dinh dưỡng Việt Nam của ứng dụng VitaMeal AI.
NHIỆM VỤ: Lập thực đơn ăn uống Việt Nam lành mạnh, đa dạng trong ${input.durationDays} ngày từ DANH SÁCH MÓN ĐƯỢC CUNG CẤP.
QUY TẮC BẮT BUỘC:
1. CHỈ được chọn foodId có mặt chính xác trong danh sách JSON catalog bên dưới. Tuyệt đối KHÔNG tự bịa foodId mới hoặc tự tính calo.
2. Mỗi ngày gồm đúng ${activeSlots.length} khung bữa: ${activeSlots.map((s) => s.slotType).join(', ')}. Bữa chính (lunch, dinner) nên có 2-3 món hài hòa tinh bột/đạm/rau-canh; bữa sáng 1-2 món; bữa phụ 1 món.
3. Đa dạng món giữa các ngày: không lặp lại quá nhiều một món qua các ngày; ưu tiên tận dụng availableIngredients nếu hợp lý; tôn trọng budgetLevel và prepTimePreference (prepMin).
4. Khối lượng grams chọn sát với defG (hoặc bội số hợp lý từ 50g đến 600g).
5. Ngôn ngữ hoàn toàn bằng tiếng Việt có dấu, ngắn gọn, mang tính giáo dục (KHÔNG chẩn đoán hay hứa chữa bệnh).
${effectiveSafetyLock ? '6. LƯU Ý AN TOÀN ĐẶC BIỆT: Người dùng dưới 18 tuổi hoặc có yếu tố sàng lọc sức khỏe. KHÔNG đặt mục tiêu giảm cân, KHÔNG dùng ngôn từ cắt giảm hay kiêng khem hà khắc; chỉ tập trung ăn đủ chất và lành mạnh.' : ''}`;

      const userPrompt = JSON.stringify({
        durationDays: input.durationDays,
        mealsPerDay: input.mealsPerDay,
        slotOrder: activeSlots.map((s) => s.slotType),
        nutritionGoal: effectiveGoal,
        dietMode: input.dietMode,
        budgetLevel: input.budgetLevel,
        dailyBudgetVnd: input.dailyBudgetVnd ?? null,
        prepTimePreference: input.prepTimePreference,
        targetKcalPerDay: effectiveTargetKcal,
        preferredTags: input.preferredTags,
        availableIngredients: input.availableIngredients,
        catalog: compactCatalog,
      });

      const rawText = await generateGeminiJsonContent({
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              aiSummary: { type: Type.STRING },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayIndex: { type: Type.INTEGER },
                    dayLabelVi: { type: Type.STRING },
                    meals: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          slotType: {
                            type: Type.STRING,
                            enum: activeSlots.map((s) => s.slotType),
                          },
                          dishes: {
                            type: Type.ARRAY,
                            items: {
                              type: Type.OBJECT,
                              properties: {
                                foodId: { type: Type.STRING },
                                grams: { type: Type.NUMBER },
                                servingLabel: { type: Type.STRING },
                                prepNote: { type: Type.STRING },
                                aiReason: { type: Type.STRING },
                              },
                              required: [
                                'foodId',
                                'grams',
                                'servingLabel',
                                'prepNote',
                                'aiReason',
                              ],
                            },
                          },
                        },
                        required: ['slotType', 'dishes'],
                      },
                    },
                  },
                  required: ['dayIndex', 'dayLabelVi', 'meals'],
                },
              },
            },
            required: ['title', 'aiSummary', 'days'],
          },
        },
      });

      const aiJson = JSON.parse(rawText) as {
        title?: string;
        aiSummary?: string;
        days?: Array<{
          dayIndex?: number;
          dayLabelVi?: string;
          meals?: Array<{
            slotType?: MealPlanSlotType;
            dishes?: Array<{
              foodId?: string;
              grams?: number;
              servingLabel?: string;
              prepNote?: string;
              aiReason?: string;
            }>;
          }>;
        }>;
      };

      const rawDays = Array.isArray(aiJson.days) ? aiJson.days : [];
      const builtDays: MealPlanDay[] = [];
      const planFoodCounts = new Map<string, number>();

      for (let dIdx = 0; dIdx < input.durationDays; dIdx += 1) {
        const aiDay = rawDays[dIdx] ?? {};
        const daySlots: MealPlanSlot[] = [];
        let dayHasEstimated = false;
        const allDayNutrients: NutrientsPer100g[] = [];
        const dayUsedIds = new Set<string>();

        for (const slotMeta of activeSlots) {
          const aiSlot = aiDay.meals?.find(
            (m) => m.slotType === slotMeta.slotType
          );
          const aiDishes = Array.isArray(aiSlot?.dishes) ? aiSlot.dishes : [];
          const resolvedDishes: MealPlanDish[] = [];

          const pickAlternativeFood = (offset: number): FoodItem => {
            const categoryPool = safeCatalog.filter((f) =>
              slotMeta.fallbackCategories.includes(f.category)
            );
            const pool = categoryPool.length > 0 ? categoryPool : safeCatalog;
            const fresh = pool.filter(
              (f) => !dayUsedIds.has(f.id) && (planFoodCounts.get(f.id) ?? 0) < 2
            );
            const sourcePool = fresh.length > 0 ? fresh : pool;
            return sourcePool[(dIdx * 3 + offset) % sourcePool.length] ?? safeCatalog[0];
          };

          for (let dishIdx = 0; dishIdx < aiDishes.length; dishIdx += 1) {
            const candidate = aiDishes[dishIdx];
            let catalogFood = candidate.foodId
              ? safeMap.get(candidate.foodId)
              : undefined;

            // Enforce diversity: avoid repeating the same dish in a day or >2 times across multi-day plan
            const totalUsage = catalogFood
              ? planFoodCounts.get(catalogFood.id) ?? 0
              : 0;
            if (
              !catalogFood ||
              dayUsedIds.has(catalogFood.id) ||
              (input.durationDays > 1 && totalUsage >= 2)
            ) {
              catalogFood = pickAlternativeFood(dishIdx);
            }

            dayUsedIds.add(catalogFood.id);
            planFoodCounts.set(
              catalogFood.id,
              (planFoodCounts.get(catalogFood.id) ?? 0) + 1
            );

            const rawGrams = Number(candidate.grams);
            const fallbackGrams = catalogFood.servingUnits[0]?.grams ?? 100;
            const grams =
              Number.isFinite(rawGrams) && rawGrams >= 20 && rawGrams <= 1500
                ? Math.round(rawGrams)
                : fallbackGrams;

            const dish = buildDishFromCatalog(
              `d${dIdx + 1}-${slotMeta.slotType}-${dishIdx + 1}-${catalogFood.id}`,
              catalogFood,
              grams,
              candidate.servingLabel,
              candidate.prepNote,
              candidate.aiReason
            );

            if (catalogFood.verificationStatus !== 'verified') {
              dayHasEstimated = true;
            }
            allDayNutrients.push(dish.nutrientsScaled);
            resolvedDishes.push(dish);
          }

          if (resolvedDishes.length === 0) {
            const fallbackFood = pickAlternativeFood(0);
            dayUsedIds.add(fallbackFood.id);
            planFoodCounts.set(
              fallbackFood.id,
              (planFoodCounts.get(fallbackFood.id) ?? 0) + 1
            );
            const grams = fallbackFood.servingUnits[0]?.grams ?? 100;
            const dish = buildDishFromCatalog(
              `d${dIdx + 1}-${slotMeta.slotType}-1-${fallbackFood.id}`,
              fallbackFood,
              grams,
              fallbackFood.servingUnits[0]?.label,
              fallbackFood.preparationNote,
              'Bổ sung cân bằng cho khung bữa.'
            );
            if (fallbackFood.verificationStatus !== 'verified') {
              dayHasEstimated = true;
            }
            allDayNutrients.push(dish.nutrientsScaled);
            resolvedDishes.push(dish);
          }

          const slotSum = sumNutrientsDeterministic(
            resolvedDishes.map((d) => d.nutrientsScaled)
          );

          daySlots.push({
            slotType: slotMeta.slotType,
            diaryMealType: slotMeta.diaryMealType,
            labelVi: slotMeta.labelVi,
            dishes: resolvedDishes,
            totals: slotSum.totals,
            isPartial: slotSum.isPartial,
          });
        }

        const daySum = sumNutrientsDeterministic(allDayNutrients);
        builtDays.push({
          dayIndex: dIdx + 1,
          dayLabelVi: aiDay.dayLabelVi?.trim() || `Ngày ${dIdx + 1}`,
          meals: daySlots,
          dailyTotals: daySum.totals,
          hasEstimatedOrUnverified: dayHasEstimated,
          isPartial: daySum.isPartial,
        });
      }

      res.json({
        title:
          aiJson.title?.trim() ||
          `Thực đơn Việt Nam ${input.durationDays} ngày (Ước tính)`,
        aiSummary:
          aiJson.aiSummary?.trim() ||
          'Thực đơn kết hợp đa dạng món ăn Việt Nam phù hợp hồ sơ của bạn.',
        durationDays: input.durationDays,
        dietMode: input.dietMode,
        nutritionGoal: effectiveGoal,
        targetKcalPerDay: effectiveTargetKcal,
        availableIngredients: input.availableIngredients,
        days: builtDays,
        isEstimated: true,
      });
    } catch (err) {
      handleAiRouteError(
        res,
        '/api/ai/meal-plan',
        'Không thể tạo thực đơn từ Gemini AI lúc này. Vui lòng thử lại sau ít phút.',
        err
      );
    }
  });

  // 2. AI Swap Single Dish Endpoint (supports quick-prep / economy / availableIngredients preferences)
  app.post('/api/ai/swap-meal', async (req: Request, res: Response) => {
    try {
      const parsed = swapMealRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Yêu cầu đổi món không hợp lệ.',
          details: parsed.error.issues.map((i) => i.message),
        });
        return;
      }

      const input = parsed.data;
      const mergedMap = buildMergedCatalog(input.customFoods);
      const currentFood =
        mergedMap.get(input.currentFoodId) ?? VIETNAMESE_FOOD_CATALOG[0];
      const safeCatalog = filterSafeCatalog(
        Array.from(mergedMap.values()),
        input.excludedAllergens,
        input.dislikedFoods,
        input.dietMode
      ).filter((f) => f.id !== input.currentFoodId);

      if (safeCatalog.length < 3) {
        res.status(400).json({
          error: 'Không đủ món ăn an toàn thay thế sau khi lọc dị ứng.',
        });
        return;
      }

      const normAvail = input.availableIngredients
        .map(normalizeVietnamese)
        .filter(Boolean);

      const targetKcal = currentFood.nutrientsPer100g.energyKcal ?? 120;
      const targetProtein = currentFood.nutrientsPer100g.proteinG ?? 5;
      const candidates = [...safeCatalog]
        .sort((a, b) => {
          const metaA = deriveFoodPracticalMeta(a);
          const metaB = deriveFoodPracticalMeta(b);
          const prefA =
            (input.preferQuickPrep && metaA.prepTimeMinutes <= 15 ? -28 : 0) +
            (input.preferEconomy && metaA.budgetTier === 'economy' ? -28 : 0) +
            (foodMatchesAvailableIngredients(a, normAvail) ? -25 : 0);
          const prefB =
            (input.preferQuickPrep && metaB.prepTimeMinutes <= 15 ? -28 : 0) +
            (input.preferEconomy && metaB.budgetTier === 'economy' ? -28 : 0) +
            (foodMatchesAvailableIngredients(b, normAvail) ? -25 : 0);

          const scoreA =
            (a.category === currentFood.category ? 0 : 45) +
            Math.abs((a.nutrientsPer100g.energyKcal ?? 120) - targetKcal) +
            Math.abs((a.nutrientsPer100g.proteinG ?? 5) - targetProtein) * 4 +
            prefA;
          const scoreB =
            (b.category === currentFood.category ? 0 : 45) +
            Math.abs((b.nutrientsPer100g.energyKcal ?? 120) - targetKcal) +
            Math.abs((b.nutrientsPer100g.proteinG ?? 5) - targetProtein) * 4 +
            prefB;
          return scoreA - scoreB;
        })
        .slice(0, 22);

      const candidateMap = new Map(candidates.map((c) => [c.id, c]));

      const systemInstruction = `Bạn là trợ lý giáo dục dinh dưỡng Việt Nam.
Hãy chọn 3 ĐẾN 4 món thay thế TỐT NHẤT và KHÁC NHAU cho món "${currentFood.nameVi}" (${input.currentGrams}g) trong khung bữa "${input.slotType}" từ danh sách ứng viên bên dưới.
QUY TẮC:
- Chỉ dùng foodId có trong danh sách ứng viên.
- Giải thích rõ ràng 4 ý ngắn gọn bằng tiếng Việt (tuyệt đối không hứa chữa bệnh hay đưa ra kết luận y khoa).
- Nếu preferQuickPrep=true ưu tiên món prepMin <= 15; nếu preferEconomy=true ưu tiên budget='economy'; nếu có availableIngredients ưu tiên món dùng nguyên liệu đó.
- Nếu người dùng dưới 18 tuổi hoặc đang bảo vệ sức khỏe (${input.isUnder18 || input.hasMedicalScreeningRisk}), không nói về thâm hụt calo giảm cân.`;

      const rawText = await generateGeminiJsonContent({
        contents: JSON.stringify({
          currentDish: {
            id: currentFood.id,
            nameVi: currentFood.nameVi,
            grams: input.currentGrams,
          },
          dietMode: input.dietMode,
          preferQuickPrep: input.preferQuickPrep,
          preferEconomy: input.preferEconomy,
          availableIngredients: input.availableIngredients,
          nutritionGoal:
            input.isUnder18 || input.hasMedicalScreeningRisk
              ? 'healthy_habits'
              : input.nutritionGoal,
          candidates: buildCompactCatalogForPrompt(candidates),
        }),
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    foodId: { type: Type.STRING },
                    grams: { type: Type.NUMBER },
                    servingLabel: { type: Type.STRING },
                    prepNote: { type: Type.STRING },
                    whyChosen: { type: Type.STRING },
                    keyNutrients: { type: Type.STRING },
                    goalFit: { type: Type.STRING },
                    caution: { type: Type.STRING },
                  },
                  required: [
                    'foodId',
                    'grams',
                    'servingLabel',
                    'prepNote',
                    'whyChosen',
                    'keyNutrients',
                    'goalFit',
                    'caution',
                  ],
                },
              },
            },
            required: ['suggestions'],
          },
        },
      });

      const aiJson = JSON.parse(rawText) as {
        suggestions?: Array<{
          foodId?: string;
          grams?: number;
          servingLabel?: string;
          prepNote?: string;
          whyChosen?: string;
          keyNutrients?: string;
          goalFit?: string;
          caution?: string;
        }>;
      };

      const seenIds = new Set<string>();
      const results: SwapDishSuggestion[] = [];

      for (const s of aiJson.suggestions ?? []) {
        if (!s.foodId || seenIds.has(s.foodId)) continue;
        const food = candidateMap.get(s.foodId);
        if (!food) continue;
        seenIds.add(food.id);

        const grams =
          Number.isFinite(Number(s.grams)) &&
          Number(s.grams) >= 20 &&
          Number(s.grams) <= 1500
            ? Math.round(Number(s.grams))
            : food.servingUnits[0]?.grams ?? 100;
        const meta = deriveFoodPracticalMeta(food);

        results.push({
          foodId: food.id,
          nameVi: food.nameVi,
          category: food.category,
          imagePath: food.imagePath,
          grams,
          servingLabel:
            s.servingLabel?.trim() || food.servingUnits[0]?.label || `${grams}g`,
          nutrientsScaled: scaleNutrientsDeterministic(
            food.nutrientsPer100g,
            grams
          ),
          nutrientsPer100g: food.nutrientsPer100g,
          verificationStatus: food.verificationStatus,
          allergens: food.allergens,
          ingredients: food.ingredients ?? [],
          prepNote:
            s.prepNote?.trim() ||
            food.preparationNote ||
            'Chế biến thanh đạm, giữ nguyên vị tự nhiên.',
          prepTimeMinutes: meta.prepTimeMinutes,
          budgetTier: meta.budgetTier,
          aiExplanation: {
            whyChosen:
              s.whyChosen?.trim() || 'Tương đồng nhóm bữa và dễ thay thế.',
            keyNutrients:
              s.keyNutrients?.trim() ||
              `Khoảng ${food.nutrientsPer100g.energyKcal ?? '—'} kcal/100g.`,
            goalFit:
              s.goalFit?.trim() || 'Hài hòa với mục tiêu dinh dưỡng hiện tại.',
            caution:
              s.caution?.trim() ||
              'Kiểm tra kỹ thành phần dị ứng và điều chỉnh gia vị vừa phải.',
          },
        });
      }

      for (const fallbackFood of candidates) {
        if (results.length >= 3) break;
        if (seenIds.has(fallbackFood.id)) continue;
        seenIds.add(fallbackFood.id);
        const grams = fallbackFood.servingUnits[0]?.grams ?? 100;
        const meta = deriveFoodPracticalMeta(fallbackFood);
        results.push({
          foodId: fallbackFood.id,
          nameVi: fallbackFood.nameVi,
          category: fallbackFood.category,
          imagePath: fallbackFood.imagePath,
          grams,
          servingLabel: fallbackFood.servingUnits[0]?.label ?? `${grams}g`,
          nutrientsScaled: scaleNutrientsDeterministic(
            fallbackFood.nutrientsPer100g,
            grams
          ),
          nutrientsPer100g: fallbackFood.nutrientsPer100g,
          verificationStatus: fallbackFood.verificationStatus,
          allergens: fallbackFood.allergens,
          ingredients: fallbackFood.ingredients ?? [],
          prepNote:
            fallbackFood.preparationNote ??
            'Chế biến chín vừa, cân đối rau xanh kèm theo.',
          prepTimeMinutes: meta.prepTimeMinutes,
          budgetTier: meta.budgetTier,
          aiExplanation: {
            whyChosen: 'Món ăn an toàn trong cùng nhóm năng lượng tương đương.',
            keyNutrients: `Cung cấp khoảng ${fallbackFood.nutrientsPer100g.proteinG ?? '—'}g đạm / 100g.`,
            goalFit: 'Phù hợp để đa dạng hóa bữa ăn hằng ngày.',
            caution: 'Lưu ý lượng gia vị chấm kèm theo.',
          },
        });
      }

      res.json({ suggestions: results });
    } catch (err) {
      handleAiRouteError(
        res,
        '/api/ai/swap-meal',
        'Không thể gợi ý món ăn thay thế lúc này. Vui lòng thử lại.',
        err
      );
    }
  });

  // 3. AI Swap Whole Meal Slot Endpoint
  app.post('/api/ai/swap-slot', async (req: Request, res: Response) => {
    try {
      const parsed = swapSlotRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Tham số đổi cả bữa không hợp lệ.',
          details: parsed.error.issues.map((i) => i.message),
        });
        return;
      }

      const input = parsed.data;
      const slotMeta =
        SLOT_META.find((s) => s.slotType === input.slotType) ?? SLOT_META[2];
      const mergedMap = buildMergedCatalog(input.customFoods);
      const excludeSet = new Set(input.currentFoodIds);

      const safeCatalog = filterSafeCatalog(
        Array.from(mergedMap.values()),
        input.excludedAllergens,
        input.dislikedFoods,
        input.dietMode
      );
      const preferredPool = safeCatalog.filter((f) => !excludeSet.has(f.id));
      const catalogToUse =
        preferredPool.length >= 4 ? preferredPool : safeCatalog;

      if (catalogToUse.length < 3) {
        res.status(400).json({
          error: 'Không đủ món ăn an toàn để đổi cả khung bữa.',
        });
        return;
      }

      const safeMap = new Map<string, FoodItem>(
        catalogToUse.map((f) => [f.id, f])
      );
      const compactCatalog = buildCompactCatalogForPrompt(catalogToUse);
      const dishCountHint =
        input.slotType === 'lunch' || input.slotType === 'dinner'
          ? '2 đến 3 món (cân bằng tinh bột/đạm/rau-canh)'
          : input.slotType === 'breakfast'
            ? '1 đến 2 món'
            : '1 món';

      const systemInstruction = `Bạn là chuyên gia giáo dục dinh dưỡng Việt Nam.
Hãy chọn bộ ${dishCountHint} mới cho khung bữa "${slotMeta.labelVi}" (${slotMeta.slotType}) từ catalog bên dưới, khác với các món hiện tại (${input.currentFoodIds.join(', ')}).
CHỈ chọn foodId có trong catalog. Ngôn ngữ tiếng Việt có dấu, ngắn gọn, không nhận định y khoa.`;

      const rawText = await generateGeminiJsonContent({
        contents: JSON.stringify({
          slotType: input.slotType,
          targetSlotKcal:
            input.isUnder18 || input.hasMedicalScreeningRisk
              ? null
              : input.targetSlotKcal,
          dietMode: input.dietMode,
          budgetLevel: input.preferEconomy ? 'economy' : input.budgetLevel,
          prepTimePreference: input.preferQuickPrep
            ? 'quick'
            : input.prepTimePreference,
          availableIngredients: input.availableIngredients,
          catalog: compactCatalog,
        }),
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dishes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    foodId: { type: Type.STRING },
                    grams: { type: Type.NUMBER },
                    servingLabel: { type: Type.STRING },
                    prepNote: { type: Type.STRING },
                    aiReason: { type: Type.STRING },
                  },
                  required: [
                    'foodId',
                    'grams',
                    'servingLabel',
                    'prepNote',
                    'aiReason',
                  ],
                },
              },
            },
            required: ['dishes'],
          },
        },
      });

      const aiJson = JSON.parse(rawText) as {
        dishes?: Array<{
          foodId?: string;
          grams?: number;
          servingLabel?: string;
          prepNote?: string;
          aiReason?: string;
        }>;
      };

      const seen = new Set<string>();
      const dishes: MealPlanDish[] = [];
      for (let i = 0; i < (aiJson.dishes ?? []).length; i += 1) {
        const candidate = aiJson.dishes![i];
        if (!candidate.foodId || seen.has(candidate.foodId)) continue;
        const food = safeMap.get(candidate.foodId);
        if (!food) continue;
        seen.add(food.id);
        const rawGrams = Number(candidate.grams);
        const grams =
          Number.isFinite(rawGrams) && rawGrams >= 20 && rawGrams <= 1500
            ? Math.round(rawGrams)
            : food.servingUnits[0]?.grams ?? 100;
        dishes.push(
          buildDishFromCatalog(
            `swapslot-${Date.now()}-${i}-${food.id}`,
            food,
            grams,
            candidate.servingLabel,
            candidate.prepNote,
            candidate.aiReason
          )
        );
      }

      if (dishes.length === 0) {
        const fallbackPool = catalogToUse.filter((f) =>
          slotMeta.fallbackCategories.includes(f.category)
        );
        const pick = fallbackPool[0] ?? catalogToUse[0];
        const grams = pick.servingUnits[0]?.grams ?? 100;
        dishes.push(
          buildDishFromCatalog(
            `swapslot-${Date.now()}-0-${pick.id}`,
            pick,
            grams
          )
        );
      }

      const slotSum = sumNutrientsDeterministic(
        dishes.map((d) => d.nutrientsScaled)
      );

      const newSlot: MealPlanSlot = {
        slotType: slotMeta.slotType,
        diaryMealType: slotMeta.diaryMealType,
        labelVi: slotMeta.labelVi,
        dishes,
        totals: slotSum.totals,
        isPartial: slotSum.isPartial,
      };

      res.json({ slot: newSlot });
    } catch (err) {
      handleAiRouteError(
        res,
        '/api/ai/swap-slot',
        'Không thể đổi cả khung bữa từ AI lúc này. Vui lòng thử lại.',
        err
      );
    }
  });

  // 4. AI Food Image Recognition (Multimodal)
  app.post(
    '/api/ai/analyze-food-image',
    async (req: Request, res: Response) => {
      try {
        const parsed = analyzeImageRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          res.status(400).json({
            error:
              'Ảnh tải lên không hợp lệ hoặc vượt quá định dạng hỗ trợ (JPG, PNG, WEBP).',
          });
          return;
        }

        const { imageBase64, mimeType, customFoods } = parsed.data;
        const cleanBase64 = imageBase64.replace(
          /^data:image\/[a-z+]+;base64,/i,
          ''
        );
        const approxBytes = Math.ceil((cleanBase64.length * 3) / 4);
        if (approxBytes > 5 * 1024 * 1024) {
          res.status(400).json({
            error: 'Kích thước ảnh vượt quá giới hạn tối đa 5 MB.',
          });
          return;
        }

        const mergedMap = buildMergedCatalog(customFoods);
        const allCatalog = Array.from(mergedMap.values()).filter(
          (f) => f.isActive
        );
        const catalogRefList = allCatalog.map((f) => ({
          id: f.id,
          nameVi: f.nameVi,
          aliases: f.aliases,
        }));

        const promptText = `Hãy phân tích bức ảnh này một cách trung thực và trả về JSON theo schema.
- Trước hết xác định isFoodImage: nếu ảnh KHÔNG phải đồ ăn/thức uống hoặc quá mờ không thể nhận dạng bất kỳ món nào, đặt isFoodImage=false, items=[] và giải thích rõ ở summaryVi.
- Nếu có đồ ăn/đồ uống, đặt isFoodImage=true và liệt kê từng món nhìn thấy (detectedCount = số món tách biệt).
- Nêu rõ cookingMethodVi (ví dụ: luộc, hấp, chiên, xào, nướng, nấu nước dùng, ăn sống...) nếu quan sát được, hoặc "Chưa xác định rõ qua ảnh".
- Gợi ý 'suggestedCatalogFoodId' khớp nhất từ catalog bên dưới (hoặc để chuỗi rỗng "" nếu không có món tương đồng trong catalog).
- Ước lượng khối lượng tham khảo (estimatedGrams) và luôn nêu 'portionUncertaintyNote' vì ảnh chụp không cân được khối lượng tịnh, dầu mỡ ẩn hay gia vị.
- Toàn bộ bằng tiếng Việt có dấu, KHÔNG khẳng định chắc chắn 100% thành phần ẩn.
Danh sách catalog tham chiếu: ${JSON.stringify(catalogRefList)}`;

        const rawText = await generateGeminiJsonContent({
          contents: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isFoodImage: { type: Type.BOOLEAN },
                summaryVi: { type: Type.STRING },
                overallCautionVi: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      detectedNameVi: { type: Type.STRING },
                      confidenceLabel: {
                        type: Type.STRING,
                        enum: ['cao', 'trung_binh', 'thap'],
                      },
                      estimatedGrams: { type: Type.NUMBER },
                      cookingMethodVi: { type: Type.STRING },
                      possibleIngredients: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      portionUncertaintyNote: { type: Type.STRING },
                      suggestedCatalogFoodId: { type: Type.STRING },
                    },
                    required: [
                      'detectedNameVi',
                      'confidenceLabel',
                      'estimatedGrams',
                      'cookingMethodVi',
                      'possibleIngredients',
                      'portionUncertaintyNote',
                      'suggestedCatalogFoodId',
                    ],
                  },
                },
              },
              required: ['isFoodImage', 'summaryVi', 'overallCautionVi', 'items'],
            },
          },
        });

        const aiJson = JSON.parse(rawText) as {
          isFoodImage?: boolean;
          summaryVi?: string;
          overallCautionVi?: string;
          items?: Array<{
            detectedNameVi?: string;
            confidenceLabel?: 'cao' | 'trung_binh' | 'thap';
            estimatedGrams?: number;
            cookingMethodVi?: string;
            possibleIngredients?: string[];
            portionUncertaintyNote?: string;
            suggestedCatalogFoodId?: string;
          }>;
        };

        const isFoodImage =
          aiJson.isFoodImage !== false && Array.isArray(aiJson.items);

        const matchedItems: ScannedFoodMatch[] = isFoodImage
          ? (aiJson.items ?? []).map((item) => {
              const directId = item.suggestedCatalogFoodId?.trim();
              let matched = directId ? mergedMap.get(directId) : undefined;

              if (!matched && item.detectedNameVi) {
                const q = normalizeVietnamese(item.detectedNameVi);
                matched = allCatalog.find((f) => {
                  const fn = normalizeVietnamese(f.nameVi);
                  return (
                    fn === q ||
                    fn.includes(q) ||
                    q.includes(fn) ||
                    f.aliases.some((al) => {
                      const na = normalizeVietnamese(al);
                      return na === q || q.includes(na);
                    })
                  );
                });
              }

              const rawGrams = Number(item.estimatedGrams);
              const estimatedGrams =
                Number.isFinite(rawGrams) && rawGrams >= 10 && rawGrams <= 2000
                  ? Math.round(rawGrams)
                  : matched?.servingUnits[0]?.grams ?? 150;

              return {
                detectedNameVi:
                  item.detectedNameVi?.trim() || 'Món ăn chưa rõ tên',
                confidenceLabel: item.confidenceLabel ?? 'trung_binh',
                estimatedGrams,
                possibleIngredients: Array.isArray(item.possibleIngredients)
                  ? item.possibleIngredients.map(String).slice(0, 8)
                  : [],
                cookingMethodVi:
                  item.cookingMethodVi?.trim() || 'Chưa xác định rõ qua ảnh',
                portionUncertaintyNote:
                  item.portionUncertaintyNote?.trim() ||
                  'Khối lượng và lượng dầu mỡ/gia vị ẩn chỉ là ước tính từ hình ảnh.',
                matchedFoodId: matched?.id ?? null,
                matchedFoodNameVi: matched?.nameVi ?? null,
                matchedCategory: matched?.category ?? null,
                nutrientsPer100g: matched?.nutrientsPer100g ?? null,
                verificationStatus: matched?.verificationStatus ?? 'unverified',
              };
            })
          : [];

        const payload: ScannedFoodAnalysisResponse = {
          isFoodImage: isFoodImage && matchedItems.length > 0,
          detectedCount: matchedItems.length,
          summaryVi:
            aiJson.summaryVi?.trim() ||
            (matchedItems.length > 0
              ? `Nhận diện được ${matchedItems.length} món có thể có trong ảnh (ước tính).`
              : 'Không nhận diện được món ăn rõ ràng trong ảnh này.'),
          overallCautionVi:
            aiJson.overallCautionVi?.trim() ||
            'Nhận diện qua ảnh không thể đo chính xác khối lượng tịnh, nước chấm hay dầu mỡ ẩn. Bạn nên kiểm tra và chỉnh sửa lại tên món cùng số gram trước khi ghi vào nhật ký.',
          items: matchedItems,
        };

        res.json(payload);
      } catch (err) {
        handleAiRouteError(
          res,
          '/api/ai/analyze-food-image',
          'Không thể phân tích ảnh món ăn lúc này. Vui lòng thử ảnh rõ nét hơn hoặc thử lại sau.',
          err
        );
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        next();
        return;
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        const template = fs.readFileSync(indexPath, 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `VitaMeal AI server running on http://0.0.0.0:${PORT} (model: ${GEMINI_MODEL})`
    );
  });
}

void createApp();
