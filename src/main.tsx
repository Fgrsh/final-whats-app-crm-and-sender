import { StrictMode, Component, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<Props, State> {
  declare props: Props;
  override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RootErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" dir="rtl">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white">حدث خطأ في واجهة التطبيق</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {this.state.error?.message || 'واجه التطبيق خطأ غير متوقع أثناء المعالجة.'}
            </p>
            <button
              id="reload-page-btn"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تشغيل الصفحة</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Global safety listener for unhandled errors and promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.warn('Global error intercepted:', event.error || event.message);
    // Prevent unhandled script error from crashing iframe parent observers
    event.preventDefault();
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.warn('Unhandled promise rejection intercepted:', event.reason);
    event.preventDefault();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
