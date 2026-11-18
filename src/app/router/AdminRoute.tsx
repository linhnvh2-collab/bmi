import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import { Button, Card, Skeleton } from '@/src/components/ui';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, authLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <Card className="space-y-4 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">
            Không có quyền truy cập khu vực quản trị
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Trang quản lý kho dữ liệu thực phẩm chỉ dành cho tài khoản có quyền
            quản trị viên (<code className="font-mono text-xs">admin: true</code>{' '}
            qua Firebase custom claims).
          </p>
          <div className="pt-2">
            <Link to="/foods">
              <Button variant="primary">Quay lại Kho thực phẩm</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
