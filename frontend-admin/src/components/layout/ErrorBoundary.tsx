import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full min-h-[400px] flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 mb-4 shadow-xl">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            {this.props.fallbackTitle ?? 'Произошла ошибка при отображении редактора'}
          </h2>
          <p className="max-w-md text-xs text-slate-400 mb-6 font-mono bg-slate-900 border border-slate-800 rounded-lg p-3 select-text text-left overflow-auto max-h-32">
            {this.state.error?.message || 'Неизвестная ошибка компонента'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white transition hover:bg-brand/90"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Перезагрузить страницу
            </button>
            {this.props.onReset && (
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-700"
              >
                <Trash2 className="h-3.5 w-3.5" /> Сбросить проект
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
