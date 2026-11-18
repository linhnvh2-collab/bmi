import { ShieldCheck } from 'lucide-react';
import { Alert, Card } from '@/src/components/ui';

interface ConsentNoticeCardProps {
  accepted: boolean;
  onAcceptedChange?: (value: boolean) => void;
  readOnly?: boolean;
  error?: string;
}

export function ConsentNoticeCard({
  accepted,
  onAcceptedChange,
  readOnly = false,
  error,
}: ConsentNoticeCardProps) {
  return (
    <Card className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-forest-200 bg-forest-50 text-forest-800">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-900">
            Đồng ý xử lý &amp; lưu trữ dữ liệu sức khỏe cá nhân
          </h2>
          <p className="text-xs text-slate-500">
            Tham chiếu Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân (nội dung đang
            chờ chủ sở hữu rà soát pháp lý chính thức)
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-700 space-y-2.5">
        <p>
          <span className="font-semibold text-slate-900">1. Dữ liệu thu thập: </span>
          Tên hiển thị, năm sinh, giới tính, chiều cao (cm), cân nặng (kg), mức độ vận
          động, sở thích ăn uống, danh sách dị ứng thực phẩm và lịch sử chỉ số BMI.
        </p>
        <p>
          <span className="font-semibold text-slate-900">2. Mục đích xử lý: </span>
          Phục vụ trải nghiệm học tập dinh dưỡng Việt Nam, hiển thị lịch sử chỉ số BMI
          của riêng bạn và chuẩn bị ngữ cảnh cho các tính năng thực đơn tham khảo ở giai
          đoạn sau.
        </p>
        <p>
          <span className="font-semibold text-slate-900">
            3. Lưu trữ &amp; Quyền của chủ thể dữ liệu:{' '}
          </span>
          Dữ liệu được lưu trữ riêng biệt theo tài khoản của bạn trên Google Firebase
          Firestore. Bạn có toàn quyền xem, xuất toàn bộ dữ liệu dưới dạng tệp JSON
          hoặc yêu cầu xóa vĩnh viễn dữ liệu và tài khoản ngay tại trang Hồ sơ cá nhân.
        </p>
      </div>

      {!readOnly && onAcceptedChange ? (
        <div className="space-y-2">
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3.5 cursor-pointer hover:bg-slate-50 transition-colors">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => onAcceptedChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-forest-800 focus:ring-forest-700"
            />
            <span className="text-sm leading-relaxed text-slate-800">
              Tôi đã đọc, hiểu rõ mục đích thu thập và đồng ý cho ứng dụng lưu trữ các dữ
              liệu sức khỏe cá nhân nêu trên để sử dụng các tính năng học tập dinh
              dưỡng.
            </span>
          </label>
          {error && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
      ) : (
        <Alert tone="success" title="Đã xác nhận đồng ý lưu trữ dữ liệu">
          Bạn đã đồng ý lưu trữ dữ liệu sức khỏe cá nhân theo quy định tham chiếu Nghị
          định 13/2023/NĐ-CP. Bạn có thể xuất dữ liệu hoặc xóa tài khoản bất kỳ lúc nào
          bên dưới.
        </Alert>
      )}
    </Card>
  );
}
