import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/src/components/ui';
import { ASIA_PACIFIC_BMI_THRESHOLDS } from '@/src/lib/calculations';
import { formatShortChartDate, formatVietnameseDateTime } from '@/src/lib/format/date';
import type { HealthRecord } from '@/src/types/health';

interface BmiHistoryChartProps {
  records: HealthRecord[];
  showAdultReferenceLines?: boolean;
}

interface ChartPoint {
  label: string;
  fullDate: string;
  bmi: number;
  weightKg: number;
  heightCm: number;
}

export function BmiHistoryChart({
  records,
  showAdultReferenceLines = true,
}: BmiHistoryChartProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
        title="Chưa có dữ liệu biểu đồ"
        description="Khi bạn lưu ít nhất 1 lần đo BMI vào tài khoản, biểu đồ diễn biến chỉ số BMI theo thời gian sẽ tự động hiển thị tại đây."
      />
    );
  }

  const orderedAsc = [...records].reverse();
  const data: ChartPoint[] = orderedAsc.map((record) => ({
    label: formatShortChartDate(record.createdAt),
    fullDate: formatVietnameseDateTime(record.createdAt),
    bmi: record.bmi,
    weightKg: record.weightKg,
    heightCm: record.heightCm,
  }));

  const hasOnlyUnder18 = records.every((r) => r.isUnder18);

  return (
    <div className="space-y-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 12, right: 16, left: 0, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: '#475569' }}
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 12, fill: '#475569' }}
              tickLine={false}
              axisLine={{ stroke: '#CBD5E1' }}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
                borderRadius: '0.5rem',
                fontSize: '12px',
              }}
              labelFormatter={(_label, payload) => {
                const point = payload?.[0]?.payload as ChartPoint | undefined;
                return point ? point.fullDate : '';
              }}
              formatter={(value, name) => {
                if (name === 'bmi') {
                  return [`${value} kg/m²`, 'Chỉ số BMI'];
                }
                return [String(value), String(name)];
              }}
            />
            {showAdultReferenceLines && !hasOnlyUnder18 && (
              <>
                <ReferenceLine
                  y={ASIA_PACIFIC_BMI_THRESHOLDS.UNDERWEIGHT_MAX}
                  stroke="#0284C7"
                  strokeDasharray="4 4"
                  label={{
                    value: '18.5',
                    position: 'insideTopRight',
                    fill: '#0369A1',
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  y={23.0}
                  stroke="#D97706"
                  strokeDasharray="4 4"
                  label={{
                    value: '23.0',
                    position: 'insideTopRight',
                    fill: '#B45309',
                    fontSize: 11,
                  }}
                />
                <ReferenceLine
                  y={ASIA_PACIFIC_BMI_THRESHOLDS.OBESE_MIN}
                  stroke="#DC2626"
                  strokeDasharray="4 4"
                  label={{
                    value: '25.0',
                    position: 'insideTopRight',
                    fill: '#B91C1C',
                    fontSize: 11,
                  }}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="bmi"
              name="bmi"
              stroke="#14422C"
              strokeWidth={2.5}
              dot={{ r: 4, fill: '#16A34A', stroke: '#14422C', strokeWidth: 1.5 }}
              activeDot={{ r: 6, fill: '#14422C' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {showAdultReferenceLines && !hasOnlyUnder18 && (
        <p className="text-xs text-slate-500">
          Đường nét đứt tham chiếu ngưỡng người trưởng thành Châu Á - Thái Bình Dương:
          18.5 (Bình thường), 23.0 (Thừa cân), 25.0 (Béo phì).
        </p>
      )}
    </div>
  );
}
