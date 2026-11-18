import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Calculator,
  Database,
  LayoutDashboard,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Button,
  Card,
  DisclaimerBanner,
  ImageSlot,
} from '@/src/components/ui';
import { ASIA_PACIFIC_BMI_THRESHOLDS } from '@/src/lib/calculations';

const BMI_REFERENCE_ROWS = [
  {
    label: 'Thiếu cân',
    range: `< ${ASIA_PACIFIC_BMI_THRESHOLDS.UNDERWEIGHT_MAX}`,
    note: 'Cần chú ý bổ sung năng lượng và đa dạng vi chất',
  },
  {
    label: 'Bình thường',
    range: `${ASIA_PACIFIC_BMI_THRESHOLDS.UNDERWEIGHT_MAX} – ${ASIA_PACIFIC_BMI_THRESHOLDS.NORMAL_MAX}`,
    note: 'Khoảng tham chiếu cân bằng cho người trưởng thành Châu Á',
  },
  {
    label: 'Thừa cân',
    range: `23.0 – ${ASIA_PACIFIC_BMI_THRESHOLDS.OVERWEIGHT_MAX}`,
    note: 'Ngưỡng lưu ý sớm, nên điều chỉnh khẩu phần hợp lý',
  },
  {
    label: 'Béo phì',
    range: `≥ ${ASIA_PACIFIC_BMI_THRESHOLDS.OBESE_MIN.toFixed(1)}`,
    note: 'Nên tham khảo chuyên gia y tế hoặc dinh dưỡng',
  },
];

export function HomePage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Hero Split */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch">
        <Card padding="lg" className="lg:col-span-7 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-forest-800">
              <span>Giáo dục dinh dưỡng Việt Nam</span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span>Đơn vị mét (cm, kg, kcal)</span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span>Giai đoạn 1</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl leading-[1.2]">
              Hiểu đúng chỉ số cơ thể và nền tảng dinh dưỡng món Việt
            </h1>

            <p className="max-w-2xl text-base leading-relaxed text-slate-600">
              BMI &amp; AI Vietnamese Meal Planner là công cụ học tập giúp bạn tìm hiểu
              chỉ số khối cơ thể (BMI) theo thang tham chiếu Châu Á - Thái Bình Dương,
              theo dõi thay đổi theo thời gian và chuẩn bị hồ sơ thói quen ăn uống an
              toàn trước khi khám phá dữ liệu món ăn Việt.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/bmi">
              <Button
                size="lg"
                variant="primary"
                leftIcon={<Calculator className="h-4 w-4" aria-hidden="true" />}
              >
                Tính chỉ số BMI ngay
              </Button>
            </Link>
            {user ? (
              <Link to="/dashboard">
                <Button
                  size="lg"
                  variant="outline"
                  leftIcon={<LayoutDashboard className="h-4 w-4" aria-hidden="true" />}
                >
                  Mở tổng quan sức khỏe
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Đăng nhập lưu lịch sử
                </Button>
              </Link>
            )}
          </div>
        </Card>

        {/* Reference Table Card */}
        <Card padding="lg" className="lg:col-span-5 flex flex-col justify-between gap-5">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Ngưỡng BMI Châu Á - Thái Bình Dương (≥ 18 tuổi)
            </h2>
            <p className="text-xs leading-relaxed text-slate-500">
              Áp dụng cho người trưởng thành. Người dưới 18 tuổi sử dụng chế độ giới hạn
              không phân loại người lớn.
            </p>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Phân loại</th>
                  <th className="px-3.5 py-2.5 font-semibold text-right">
                    Khoảng BMI
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {BMI_REFERENCE_ROWS.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-50/70">
                    <td className="px-3.5 py-2.5">
                      <p className="font-medium text-slate-900">{row.label}</p>
                      <p className="text-[11px] text-slate-500">{row.note}</p>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-forest-800 tabular-nums whitespace-nowrap">
                      {row.range}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Link
            to="/bmi"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest-800 hover:text-forest-900"
          >
            <span>Trải nghiệm tính toán ở chế độ khách</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Card>
      </section>

      {/* Educational Disclaimer */}
      <DisclaimerBanner />

      {/* Feature Pillars */}
      <section aria-labelledby="stage1-capabilities" className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="stage1-capabilities"
              className="text-xl font-semibold text-slate-900"
            >
              Các tính năng hiện có ở Giai đoạn 1
            </h2>
            <p className="text-sm text-slate-600">
              Xây dựng nền tảng đo lường chính xác, bảo mật dữ liệu và tôn trọng quyền
              riêng tư.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Card className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-forest-200 bg-forest-50 text-forest-800">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Tính BMI linh hoạt &amp; Chế độ giới hạn &lt; 18 tuổi
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Tính nhanh ngay ở chế độ khách không cần tài khoản. Với người dưới 18 tuổi,
              hệ thống chỉ hiển thị chỉ số BMI cùng khuyến nghị tham chiếu biểu đồ tăng
              trưởng WHO.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-forest-200 bg-forest-50 text-forest-800">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Hồ sơ &amp; Bảo vệ dữ liệu cá nhân
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Yêu cầu xác nhận đồng ý trước khi lưu dữ liệu sức khỏe (tham chiếu Nghị
              định 13/2023/NĐ-CP). Hỗ trợ xuất toàn bộ dữ liệu JSON và xóa tài khoản
              bất cứ lúc nào.
            </p>
          </Card>

          <Card className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-forest-200 bg-forest-50 text-forest-800">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              Biểu đồ theo dõi tiến trình thực tế
            </h3>
            <p className="text-sm leading-relaxed text-slate-600">
              Khi đăng nhập, bạn có thể lưu các lần đo BMI vào Firestore và theo dõi xu
              hướng thay đổi qua biểu đồ trực quan hoàn toàn từ dữ liệu thật của chính
              bạn.
            </p>
          </Card>
        </div>
      </section>

      {/* Food Imagery Slots (Empty states per Section 4 rules - no unverified internet food images) */}
      <section aria-labelledby="vietnamese-food-slots" className="space-y-4">
        <div className="space-y-1">
          <h2
            id="vietnamese-food-slots"
            className="text-xl font-semibold text-slate-900"
          >
            Không gian khám phá món ăn Việt Nam (Giai đoạn tiếp theo)
          </h2>
          <p className="text-sm text-slate-600">
            Cơ sở dữ liệu thực phẩm Việt Nam sẽ được nạp từ nguồn đã xác minh và hình
            ảnh do bạn cung cấp ở Giai đoạn 2.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <ImageSlot
            title="Nhóm món nước truyền thống"
            subtitle="Chưa có ảnh món ăn. Dữ liệu định lượng từ nguồn xác minh sẽ hiển thị tại đây."
            icon={<Utensils className="h-5 w-5" aria-hidden="true" />}
          />
          <ImageSlot
            title="Cơm gia đình &amp; Món mặn"
            subtitle="Chưa có ảnh món ăn. Mọi giá trị ước tính sau này sẽ được gắn nhãn 'Ước tính'."
            icon={<Database className="h-5 w-5" aria-hidden="true" />}
          />
          <ImageSlot
            title="Rau xanh &amp; Canh thanh đạm"
            subtitle="Chưa có ảnh món ăn. Sẵn sàng tích hợp danh mục thực phẩm theo hồ sơ dị ứng."
            icon={<Utensils className="h-5 w-5" aria-hidden="true" />}
          />
        </div>
      </section>
    </div>
  );
}
