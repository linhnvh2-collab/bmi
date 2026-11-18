import type { SexOption } from '@/src/types/health';
import type {
  CalorieTargetAdjustmentReason,
  GoalType,
} from '@/src/types/stage3';
import {
  KCAL_PER_KG_APPROX,
  MAX_DAILY_DEFICIT_KCAL,
  MAX_DAILY_SURPLUS_KCAL,
  MAX_DAILY_TARGET_KCAL,
  MAX_WEEKLY_WEIGHT_CHANGE_KG,
  MIN_DAILY_KCAL_BY_SEX,
  MIN_GOAL_DURATION_WEEKS,
} from './constants';

export interface BuildCalorieTargetInput {
  tdee: number;
  sex: SexOption;
  goalType: GoalType;
  requestedWeeklyChangeKg?: number;
}

export interface BuildCalorieTargetResult {
  targetKcal: number | null;
  effectiveWeeklyChangeKg: number;
  wasAdjusted: boolean;
  reasonCode: CalorieTargetAdjustmentReason;
  messageVi: string | null;
}

/**
 * Tính mục tiêu năng lượng hàng ngày (kcal/ngày) được kẹp chặt trong giới hạn an toàn.
 * Không bao giờ trả về giá trị thấp hơn `MIN_DAILY_KCAL_BY_SEX[sex]` dù đầu vào thế nào.
 */
export function buildCalorieTarget({
  tdee,
  sex,
  goalType,
  requestedWeeklyChangeKg = 0,
}: BuildCalorieTargetInput): BuildCalorieTargetResult {
  if (!Number.isFinite(tdee) || tdee <= 0) {
    throw new Error('Giá trị TDEE phải là số dương hợp lệ.');
  }

  if (goalType === 'healthy_habits') {
    return {
      targetKcal: null,
      effectiveWeeklyChangeKg: 0,
      wasAdjusted: false,
      reasonCode: 'healthy_habits',
      messageVi: null,
    };
  }

  const minKcal = MIN_DAILY_KCAL_BY_SEX[sex] ?? MIN_DAILY_KCAL_BY_SEX.other;
  const safeRequestedPace =
    Number.isFinite(requestedWeeklyChangeKg) && requestedWeeklyChangeKg > 0
      ? requestedWeeklyChangeKg
      : 0;

  if (goalType === 'maintain') {
    const roundedTdee = Math.round(tdee);
    if (roundedTdee < minKcal) {
      return {
        targetKcal: minKcal,
        effectiveWeeklyChangeKg: 0,
        wasAdjusted: true,
        reasonCode: 'clamped_min_kcal',
        messageVi: `Mức TDEE ước tính (${roundedTdee} kcal) thấp hơn ngưỡng tối thiểu an toàn theo cấu hình (${minKcal} kcal/ngày). Hệ thống đã tự động giữ mục tiêu ở mức tối thiểu ${minKcal} kcal/ngày.`,
      };
    }
    return {
      targetKcal: Math.min(MAX_DAILY_TARGET_KCAL, roundedTdee),
      effectiveWeeklyChangeKg: 0,
      wasAdjusted: false,
      reasonCode: 'maintain',
      messageVi: null,
    };
  }

  if (goalType === 'lose_gradual') {
    let clampedWeekly = safeRequestedPace;
    let wasAdjusted = false;
    let reasonCode: CalorieTargetAdjustmentReason = 'none';
    const reasons: string[] = [];

    if (clampedWeekly > MAX_WEEKLY_WEIGHT_CHANGE_KG.loss) {
      clampedWeekly = MAX_WEEKLY_WEIGHT_CHANGE_KG.loss;
      wasAdjusted = true;
      reasonCode = 'clamped_weekly_loss_max';
      reasons.push(
        `Tốc độ giảm mong muốn (${safeRequestedPace} kg/tuần) vượt quá giới hạn an toàn tối đa ${MAX_WEEKLY_WEIGHT_CHANGE_KG.loss} kg/tuần và đã được điều chỉnh xuống ${clampedWeekly} kg/tuần.`
      );
    }

    let dailyDeficit = Math.round((clampedWeekly * KCAL_PER_KG_APPROX) / 7);
    if (dailyDeficit > MAX_DAILY_DEFICIT_KCAL) {
      dailyDeficit = MAX_DAILY_DEFICIT_KCAL;
      clampedWeekly =
        Math.round(((dailyDeficit * 7) / KCAL_PER_KG_APPROX) * 100) / 100;
      wasAdjusted = true;
      reasonCode = 'clamped_deficit_max';
      reasons.push(
        `Mức thâm hụt năng lượng hàng ngày đã được giới hạn ở tối đa ${MAX_DAILY_DEFICIT_KCAL} kcal/ngày.`
      );
    }

    let targetKcal = Math.round(tdee - dailyDeficit);
    if (targetKcal < minKcal) {
      targetKcal = minKcal;
      const actualDeficit = Math.max(0, Math.round(tdee - minKcal));
      clampedWeekly =
        Math.round(((actualDeficit * 7) / KCAL_PER_KG_APPROX) * 100) / 100;
      wasAdjusted = true;
      reasonCode = 'clamped_min_kcal';
      reasons.push(
        `Mục tiêu không được hạ thấp hơn ngưỡng tối thiểu an toàn (${minKcal} kcal/ngày), nên hệ thống đã điều chỉnh về ${minKcal} kcal/ngày.`
      );
    }

    return {
      targetKcal,
      effectiveWeeklyChangeKg: clampedWeekly,
      wasAdjusted,
      reasonCode,
      messageVi: reasons.length > 0 ? reasons.join(' ') : null,
    };
  }

  // goalType === 'gain_gradual'
  let clampedWeekly = safeRequestedPace;
  let wasAdjusted = false;
  let reasonCode: CalorieTargetAdjustmentReason = 'none';
  const reasons: string[] = [];

  if (clampedWeekly > MAX_WEEKLY_WEIGHT_CHANGE_KG.gain) {
    clampedWeekly = MAX_WEEKLY_WEIGHT_CHANGE_KG.gain;
    wasAdjusted = true;
    reasonCode = 'clamped_weekly_gain_max';
    reasons.push(
      `Tốc độ tăng mong muốn (${safeRequestedPace} kg/tuần) vượt quá giới hạn an toàn tối đa ${MAX_WEEKLY_WEIGHT_CHANGE_KG.gain} kg/tuần và đã được điều chỉnh xuống ${clampedWeekly} kg/tuần.`
    );
  }

  let dailySurplus = Math.round((clampedWeekly * KCAL_PER_KG_APPROX) / 7);
  if (dailySurplus > MAX_DAILY_SURPLUS_KCAL) {
    dailySurplus = MAX_DAILY_SURPLUS_KCAL;
    clampedWeekly =
      Math.round(((dailySurplus * 7) / KCAL_PER_KG_APPROX) * 100) / 100;
    wasAdjusted = true;
    reasonCode = 'clamped_surplus_max';
    reasons.push(
      `Mức năng lượng tăng thêm hàng ngày đã được giới hạn ở tối đa ${MAX_DAILY_SURPLUS_KCAL} kcal/ngày để đảm bảo tăng chậm, ổn định.`
    );
  }

  let targetKcal = Math.min(
    MAX_DAILY_TARGET_KCAL,
    Math.round(tdee + dailySurplus)
  );
  if (targetKcal < minKcal) {
    targetKcal = minKcal;
    wasAdjusted = true;
    reasonCode = 'clamped_min_kcal';
    reasons.push(
      `Mục tiêu đã được nâng lên mức tối thiểu an toàn (${minKcal} kcal/ngày).`
    );
  }

  return {
    targetKcal,
    effectiveWeeklyChangeKg: clampedWeekly,
    wasAdjusted,
    reasonCode,
    messageVi: reasons.length > 0 ? reasons.join(' ') : null,
  };
}

export function evaluateGoalDurationWeeks(
  startWeightKg: number,
  targetWeightKg: number | null,
  effectiveWeeklyChangeKg: number
): {
  estimatedWeeks: number | null;
  belowRecommendedMinimum: boolean;
} {
  if (
    targetWeightKg === null ||
    !Number.isFinite(targetWeightKg) ||
    effectiveWeeklyChangeKg <= 0
  ) {
    return { estimatedWeeks: null, belowRecommendedMinimum: false };
  }

  const diff = Math.abs(targetWeightKg - startWeightKg);
  if (diff < 0.1) {
    return { estimatedWeeks: 0, belowRecommendedMinimum: false };
  }

  const estimatedWeeks = Math.ceil(diff / effectiveWeeklyChangeKg);
  return {
    estimatedWeeks,
    belowRecommendedMinimum: estimatedWeeks < MIN_GOAL_DURATION_WEEKS,
  };
}
