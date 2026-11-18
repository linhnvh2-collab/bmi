import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthProvider';
import {
  Alert,
  Button,
  Card,
  DisclaimerBanner,
  FormField,
  Input,
  Tabs,
} from '@/src/components/ui';
import { auth, googleProvider } from '@/src/lib/firebase/config';
import { formatAuthErrorVi } from '@/src/lib/firebase/errors';
import {
  loginFormSchema,
  registerFormSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from '@/src/lib/validation/schemas';

type AuthTab = 'login' | 'register';

export function AuthPage() {
  const { user, authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AuthTab>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from || '/dashboard';

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  if (!authLoading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleLoginSubmit = async (values: LoginFormValues) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setAuthError(formatAuthErrorVi(error));
    }
  };

  const handleRegisterSubmit = async (values: RegisterFormValues) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      await updateProfile(cred.user, {
        displayName: values.displayName.trim(),
      });
      navigate('/profile', { replace: true });
    } catch (error) {
      setAuthError(formatAuthErrorVi(error));
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setAuthError(formatAuthErrorVi(error));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {activeTab === 'login' ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}
        </h1>
        <p className="text-sm text-slate-600">
          Đăng nhập để lưu lịch sử chỉ số BMI và quản lý hồ sơ dinh dưỡng của bạn.
        </p>
      </div>

      <Card className="space-y-5">
        <div className="flex justify-center">
          <Tabs
            value={activeTab}
            onChange={(val) => {
              setActiveTab(val);
              setAuthError(null);
            }}
            items={[
              { value: 'login', label: 'Đăng nhập' },
              { value: 'register', label: 'Đăng ký' },
            ]}
          />
        </div>

        {authError && (
          <Alert tone="danger" title="Không thể xác thực">
            {authError}
          </Alert>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          isLoading={isGoogleLoading}
          onClick={handleGoogleSignIn}
        >
          Tiếp tục với Google
        </Button>

        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200" />
          <span className="mx-3 shrink-0 text-xs text-slate-400">
            hoặc dùng email
          </span>
          <div className="flex-grow border-t border-slate-200" />
        </div>

        {activeTab === 'login' ? (
          <form
            onSubmit={loginForm.handleSubmit(handleLoginSubmit)}
            noValidate
            className="space-y-4"
          >
            <FormField
              id="login-email"
              label="Email"
              required
              error={loginForm.formState.errors.email?.message}
            >
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="ban@example.com"
                hasError={Boolean(loginForm.formState.errors.email)}
                {...loginForm.register('email')}
              />
            </FormField>

            <FormField
              id="login-password"
              label="Mật khẩu"
              required
              error={loginForm.formState.errors.password?.message}
            >
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Tối thiểu 6 ký tự"
                hasError={Boolean(loginForm.formState.errors.password)}
                {...loginForm.register('password')}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={loginForm.formState.isSubmitting}
              leftIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}
            >
              Đăng nhập
            </Button>
          </form>
        ) : (
          <form
            onSubmit={registerForm.handleSubmit(handleRegisterSubmit)}
            noValidate
            className="space-y-4"
          >
            <FormField
              id="register-name"
              label="Tên hiển thị"
              required
              error={registerForm.formState.errors.displayName?.message}
            >
              <Input
                id="register-name"
                type="text"
                autoComplete="name"
                placeholder="Ví dụ: Nguyễn Minh"
                hasError={Boolean(registerForm.formState.errors.displayName)}
                {...registerForm.register('displayName')}
              />
            </FormField>

            <FormField
              id="register-email"
              label="Email"
              required
              error={registerForm.formState.errors.email?.message}
            >
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="ban@example.com"
                hasError={Boolean(registerForm.formState.errors.email)}
                {...registerForm.register('email')}
              />
            </FormField>

            <FormField
              id="register-password"
              label="Mật khẩu"
              required
              error={registerForm.formState.errors.password?.message}
            >
              <Input
                id="register-password"
                type="password"
                autoComplete="new-password"
                placeholder="Tối thiểu 6 ký tự"
                hasError={Boolean(registerForm.formState.errors.password)}
                {...registerForm.register('password')}
              />
            </FormField>

            <FormField
              id="register-confirm-password"
              label="Xác nhận mật khẩu"
              required
              error={registerForm.formState.errors.confirmPassword?.message}
            >
              <Input
                id="register-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
                hasError={Boolean(registerForm.formState.errors.confirmPassword)}
                {...registerForm.register('confirmPassword')}
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={registerForm.formState.isSubmitting}
              leftIcon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
            >
              Tạo tài khoản
            </Button>
          </form>
        )}

        <div className="pt-2 text-center text-xs text-slate-600">
          Bạn chỉ muốn tính nhanh BMI?{' '}
          <Link to="/bmi" className="font-semibold text-forest-800 hover:underline">
            Dùng chế độ khách không cần đăng nhập
          </Link>
        </div>
      </Card>

      <DisclaimerBanner compact />
    </div>
  );
}
