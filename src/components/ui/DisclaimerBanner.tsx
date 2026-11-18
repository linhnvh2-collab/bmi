import { ShieldCheck } from 'lucide-react';

interface DisclaimerBannerProps {
  compact?: boolean;
  className?: string;
}

export function DisclaimerBanner({
  compact = false,
  className = '',
}: DisclaimerBannerProps) {
  return (
    <aside
      aria-label="Tuyên bố miễn trừ trách nhiệm y khoa"
      className={`flex items-start gap-3 rounded-xl border border-warm-500/35 bg-warm-50/85 text-slate-800 ${
        compact ? 'px-4 py-3 text-xs' : 'px-5 py-4 text-sm'
      } ${className}`}
    >
      <ShieldCheck
        className="mt-0.5 h-4 w-4 shrink-0 text-warm-700"
        aria-hidden="true"
      />
      <p className="leading-relaxed">
        <span className="font-semibold text-warm-800">Lưu ý giáo dục: </span>
        Đây là công cụ học tập về dinh dưỡng Việt Nam, KHÔNG phải công cụ chẩn đoán,
        điều trị y khoa hay tư vấn dinh dưỡng lâm sàng. Mọi kết quả chỉ mang tính tham
        khảo; vui lòng trao đổi với bác sĩ hoặc chuyên gia dinh dưỡng khi cần đánh giá
        sức khỏe chuyên sâu.
      </p>
    </aside>
  );
}
