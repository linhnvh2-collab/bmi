import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/src/app/providers/AuthProvider';
import { AppRouter } from '@/src/app/router/AppRouter';
import { ErrorBoundary } from '@/src/components/ui';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
