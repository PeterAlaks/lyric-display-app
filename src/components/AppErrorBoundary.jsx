import React from 'react';
import { isChunkLoadError, scheduleChunkLoadRecovery } from '../utils/chunkLoadRecovery';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    try { console.error('AppErrorBoundary', error, info); } catch { }
    if (scheduleChunkLoadRecovery(error, 'AppErrorBoundary')) {
      this.setState({ recovering: true });
    }
  }
  render() {
    if (this.state.hasError) {
      const isChunkError = isChunkLoadError(this.state.error);
      const title = isChunkError ? 'LyricDisplay needs to reload' : 'Something went wrong';
      const message = this.state.recovering
        ? 'A production bundle file could not be loaded. LyricDisplay is reloading this window.'
        : String(this.state.error?.message || this.state.error || 'Unknown error');

      return (
        <div style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
          <h3 style={{ margin: 0, marginBottom: 8, color: '#b91c1c' }}>{title}</h3>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#374151' }}>
            {message}
          </div>
          {isChunkError && !this.state.recovering && (
            <button
              type="button"
              onClick={() => window.electronAPI?.windowControls?.reload?.() || window.location.reload()}
              style={{
                marginTop: 12,
                border: 0,
                borderRadius: 6,
                background: '#2563eb',
                color: '#ffffff',
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload window
            </button>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
