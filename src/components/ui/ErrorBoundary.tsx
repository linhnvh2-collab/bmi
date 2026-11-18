import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Đã xảy ra lỗi không mong muốn.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = (): void => {
    this.setState({ hasError: false, message: '' });
    window.location.assign('/');
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F8FAF9] p-6">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h1 className="text-lg font-semibold text-slate-900">
              Đã xảy ra sự cố hiển thị
            </h1>
            <p className="text-sm leading-relaxed text-slate-600">
              Ứng dụng gặp lỗi khi xử lý dữ liệu. Vui lòng tải lại trang để tiếp tục.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-600 break-words">
              {this.state.message}
            </div>
            <Button onClick={this.handleReload} variant="primary">
              Quay về trang chủ
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
