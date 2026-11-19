import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BookOpen,
  Calculator,
  Camera,
  Flame,
  Home,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  UserCircle2,
  Utensils,
  X,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import { Button } from '@/src/components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Trang chủ', icon: Home },
  { to: '/bmi', label: 'Tính BMI', icon: Calculator },
  { to: '/energy', label: 'Năng lượng BMR/TDEE', icon: Flame },
  { to: '/nutrition-plan', label: 'Kế hoạch dinh dưỡng', icon: Sparkles },
  { to: '/foods', label: 'Thực phẩm Việt', icon: Utensils },
  { to: '/nutrients', label: '9 nhóm dinh dưỡng', icon: Layers },
  { to: '/meal-planner', label: 'Thực đơn AI', icon: Sparkles },
  { to: '/scanner', label: 'Quét ảnh món ăn', icon: Camera },
  { to: '/goals', label: 'Mục tiêu', icon: Target },
  { to: '/diary', label: 'Nhật ký ăn uống', icon: BookOpen },
  { to: '/shopping-list', label: 'Danh sách đi chợ', icon: ShoppingCart },
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/profile', label: 'Hồ sơ cá nhân', icon: UserCircle2 },
];

const MOBILE_BOTTOM_NAV_PATHS = new Set([
  '/',
  '/foods',
  '/meal-planner',
  '/diary',
  '/dashboard',
]);

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Trang chủ',
  '/bmi': 'Công cụ tính BMI',
  '/energy': 'Ước tính BMR / TDEE',
  '/nutrition-plan': 'Kế hoạch dinh dưỡng cá nhân',
  '/foods': 'Kho thực phẩm Việt Nam',
  '/nutrients': '9 nhóm nhu cầu dinh dưỡng',
  '/meal-planner': 'Thực đơn AI cá nhân hóa',
  '/scanner': 'Quét ảnh món ăn',
  '/goals': 'Mục tiêu dinh dưỡng',
  '/diary': 'Nhật ký ăn uống',
  '/shopping-list': 'Danh sách đi chợ',
  '/admin/foods': 'Quản trị kho thực phẩm',
  '/dashboard': 'Tổng quan sức khỏe',
  '/profile': 'Hồ sơ & Quyền riêng tư',
  '/login': 'Đăng nhập / Đăng ký',
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, isAdmin, signOutUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const currentTitle = location.pathname.startsWith('/foods/')
    ? 'Chi tiết thực phẩm'
    : (ROUTE_TITLES[location.pathname] ?? 'BMI & AI Vietnamese Meal Planner');

  const handleSignOut = async () => {
    await signOutUser();
    setMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-800 text-white">
            <Activity className="h-4 w-4" aria-hidden="true" />
          </div>
          <Link
            to="/"
            className="text-[13px] font-bold leading-tight tracking-tight text-forest-900"
          >
            BMI &amp; AI Vietnamese Meal Planner
          </Link>
        </div>

        <nav aria-label="Điều hướng chính" className="flex-1 space-y-1 p-4 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                    isActive
                      ? 'bg-forest-50 text-forest-900 border border-forest-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          {isAdmin && (
            <div className="pt-3 mt-3 border-t border-slate-200">
              <p className="px-3.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Quản trị
              </p>
              <NavLink
                to="/admin/foods"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
                    isActive
                      ? 'bg-forest-50 text-forest-900 border border-forest-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                  }`
                }
              >
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Quản trị thực phẩm</span>
              </NavLink>
            </div>
          )}
        </nav>

        <div className="border-t border-slate-200 p-4 space-y-3">
          {user ? (
            <div className="space-y-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900">
                  {profile?.displayName || user.displayName || 'Người dùng'}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleSignOut}
                leftIcon={<LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                Đăng xuất
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-slate-600">
                Chế độ khách: tính BMI không cần đăng nhập.
              </p>
              <Link to="/login" className="block">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  leftIcon={<LogIn className="h-3.5 w-3.5" aria-hidden="true" />}
                >
                  Đăng nhập
                </Button>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-xs">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Mở menu điều hướng"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden cursor-pointer"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              <Link
                to="/"
                className="truncate max-w-[180px] sm:max-w-none text-xs sm:text-sm font-bold text-forest-900 lg:hidden"
              >
                BMI &amp; AI Vietnamese Meal Planner
              </Link>
              <span className="text-slate-300 lg:hidden" aria-hidden="true">
                /
              </span>
              <span className="truncate text-sm font-semibold text-slate-800">
                {currentTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {location.pathname !== '/bmi' ? (
              <Link to="/bmi">
                <Button size="sm" variant="primary">
                  Tính BMI
                </Button>
              </Link>
            ) : user ? (
              <Link to="/dashboard">
                <Button size="sm" variant="outline">
                  Xem tổng quan
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button size="sm" variant="primary">
                  Đăng nhập
                </Button>
              </Link>
            )}
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/40"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white border-r border-slate-200 shadow-xl">
              <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 px-5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest-800 text-white">
                    <Activity className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <span className="text-[13px] font-bold leading-tight text-forest-900">
                    BMI &amp; AI Vietnamese Meal Planner
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Đóng menu"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 p-4 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                          isActive
                            ? 'bg-forest-50 text-forest-900 border border-forest-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
                {isAdmin && (
                  <div className="pt-3 mt-3 border-t border-slate-200">
                    <NavLink
                      to="/admin/foods"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium ${
                          isActive
                            ? 'bg-forest-50 text-forest-900 border border-forest-200'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`
                      }
                    >
                      <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Quản trị thực phẩm</span>
                    </NavLink>
                  </div>
                )}
              </nav>
              <div className="border-t border-slate-200 p-4">
                {user ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleSignOut}
                    leftIcon={<LogOut className="h-4 w-4" aria-hidden="true" />}
                  >
                    Đăng xuất
                  </Button>
                ) : (
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block"
                  >
                    <Button variant="primary" className="w-full">
                      Đăng nhập / Đăng ký
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Page Viewport */}
        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>

        {/* Footer */}
        <footer className="hidden lg:block border-t border-slate-200 bg-white px-8 py-4 text-xs text-slate-500">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <span>
              BMI &amp; AI Vietnamese Meal Planner · Công cụ giáo dục dinh dưỡng Việt Nam
            </span>
            <span>Đơn vị chuẩn: cm · kg · kcal</span>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Điều hướng di động"
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white/95 backdrop-blur-xs lg:hidden"
      >
        {NAV_ITEMS.filter((item) => MOBILE_BOTTOM_NAV_PATHS.has(item.to)).map(
          (item) => {
            const Icon = item.icon;
            const shortLabel =
              item.to === '/foods'
                ? 'Thực phẩm'
                : item.to === '/meal-planner'
                  ? 'Thực đơn'
                  : item.to === '/diary'
                    ? 'Nhật ký'
                    : item.label;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex min-h-[54px] flex-col items-center justify-center gap-1 px-1 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'text-forest-800 bg-forest-50/70'
                      : 'text-slate-600 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{shortLabel}</span>
              </NavLink>
            );
          }
        )}
      </nav>
    </div>
  );
}
