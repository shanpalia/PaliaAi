import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

class AppErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('PaliaAi render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#fff' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>PaliaAi</h1>
          <p style={{ marginTop: 12 }}>App load karte waqt error aaya. Blank screen ke bajay error dikhaya ja raha hai.</p>
          <pre style={{ marginTop: 16, padding: 12, background: '#f1f5f9', borderRadius: 8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{this.state.error}</pre>
          <button style={{ marginTop: 16, padding: '10px 14px', background: '#059669', color: '#fff', borderRadius: 8 }} onClick={() => window.location.reload()}>Reload PaliaAi</button>
        </main>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
