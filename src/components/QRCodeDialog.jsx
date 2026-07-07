import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Wifi, Copy, Check } from 'lucide-react';
import useToast from '../hooks/useToast';
import { REQUEST_MODAL_CLOSE_EVENT } from '@/constants/modalEvents';

const animationDuration = 220;

const QRCodeDialog = ({ isOpen, onClose, darkMode }) => {
  const [localIP, setLocalIP] = useState('');
  const [qrCodeDataURL, setQRCodeDataURL] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(false);
  const [joinCode, setJoinCode] = useState(null);
  const [copiedURL, setCopiedURL] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const { showToast } = useToast();

  const port = import.meta.env.DEV ? '5173' : '4000';
  const urlBase = `http://${localIP}:${port}/`;
  const connectionURL = `${urlBase}?client=mobile`;

  const handleClose = useCallback(() => { onClose?.(); }, [onClose]);

  const refreshJoinCode = useCallback(async () => {
    try {
      if (window.electronAPI?.getJoinCode) {
        const code = await window.electronAPI.getJoinCode();
        setJoinCode(code || null);
        return;
      }
      setJoinCode(null);
    } catch {
      console.warn('Failed to load join code for QR dialog');
    }
  }, []);

  useEffect(() => {
    if (isOpen) refreshJoinCode();
  }, [isOpen, refreshJoinCode]);

  useEffect(() => {
    const handleJoinCodeUpdated = (event) => {
      const nextCode = event?.detail?.joinCode;
      if (typeof nextCode === 'string') {
        setJoinCode(nextCode);
      } else {
        setJoinCode(null);
        if (isOpen) refreshJoinCode();
      }
    };
    window.addEventListener('join-code-updated', handleJoinCodeUpdated);
    return () => window.removeEventListener('join-code-updated', handleJoinCodeUpdated);
  }, [isOpen, refreshJoinCode]);

  useEffect(() => {
    if (!isOpen) return;
    const getLocalIP = async () => {
      try {
        if (window.electronAPI?.getLocalIP) {
          const ip = await window.electronAPI.getLocalIP();
          setLocalIP(ip);
        } else {
          setLocalIP('localhost');
        }
      } catch {
        setLocalIP('localhost');
      }
    };
    getLocalIP();
  }, [isOpen]);

  useEffect(() => {
    if (!localIP || !isOpen || !joinCode) return;
    const generateQRCode = async () => {
      setIsGenerating(true);
      try {
        const url = `${urlBase}?client=mobile&joinCode=${joinCode}`;
        const dataURL = await QRCode.toDataURL(url, {
          width: 240,
          margin: 2,
          color: {
            dark: darkMode ? '#FFFFFF' : '#0F172A',
            light: darkMode ? '#1E293B' : '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
        });
        setQRCodeDataURL(dataURL);
      } catch (err) {
        console.error('QR generation failed:', err);
      } finally {
        setIsGenerating(false);
      }
    };
    generateQRCode();
  }, [localIP, isOpen, darkMode, joinCode, urlBase]);

  useLayoutEffect(() => {
    if (isOpen) {
      setVisible(true);
      setExiting(false);
      setEntering(true);
      const raf = requestAnimationFrame(() => setEntering(false));
      return () => cancelAnimationFrame(raf);
    }
    if (!visible) return undefined;
    setEntering(false);
    setExiting(true);
    const timeout = setTimeout(() => {
      setExiting(false);
      setVisible(false);
    }, animationDuration);
    return () => clearTimeout(timeout);
  }, [isOpen, visible]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const registerCloseCandidate = (event) => {
      const detail = event?.detail;
      if (!detail || !Array.isArray(detail.candidates)) return;
      detail.candidates.push({ priority: 50, close: () => handleClose() });
    };
    window.addEventListener(REQUEST_MODAL_CLOSE_EVENT, registerCloseCandidate);
    return () => window.removeEventListener(REQUEST_MODAL_CLOSE_EVENT, registerCloseCandidate);
  }, [handleClose, isOpen]);

  const copyURL = () => {
    navigator.clipboard.writeText(connectionURL).then(() => {
      setCopiedURL(true);
      setTimeout(() => setCopiedURL(false), 2000);
    }).catch(() => showToast({ title: 'Copy failed', message: 'Could not copy URL', variant: 'error' }));
  };

  const copyCode = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }).catch(() => showToast({ title: 'Copy failed', message: 'Could not copy join code', variant: 'error' }));
  };

  if (!visible) return null;

  const d = darkMode;
  const topMenuHeight = typeof document !== 'undefined'
    ? (getComputedStyle(document.body).getPropertyValue('--top-menu-height')?.trim() || '0px')
    : '0px';

  const isAnimating = exiting || entering;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ top: topMenuHeight }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 backdrop-blur-sm transition-opacity duration-200 ${
          isAnimating ? 'opacity-0' : 'opacity-100'
        } ${d ? 'bg-black/60' : 'bg-black/30'}`}
        onClick={handleClose}
      />

      {/* Panel — wider: max-w-md → max-w-lg */}
      <div className={`
        relative w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden
        transition-all duration-220 ease-out
        ${isAnimating ? 'opacity-0 translate-y-4 scale-[0.97]' : 'opacity-100 translate-y-0 scale-100'}
        ${d ? 'bg-gray-900 border border-slate-800/80 text-gray-50' : 'bg-white border border-slate-200/80 text-gray-900'}
      `}>

        {/* Header */}
        <div className={`flex items-center justify-between border-b px-5 py-4 ${d ? 'border-white/5 bg-slate-950/45' : 'border-slate-900/5 bg-[#f8fafc]'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${d ? 'bg-blue-500/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <Smartphone className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className={`text-[15px] font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>Mobile Controller</h2>
              <p className={`mt-0.5 text-xs ${d ? 'text-gray-500' : 'text-gray-400'}`}>Scan to connect from your device</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className={`p-1.5 rounded-lg transition-colors ${
              d ? 'text-gray-500 hover:bg-gray-800 hover:text-gray-300' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            }`}
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* QR Code */}
        <div className="px-5 pt-5 pb-4">
          {/* QR well */}
          <div className={`mb-4 flex items-center justify-center rounded-2xl p-4 ${d ? 'bg-gray-800/60' : 'bg-gray-50'}`}>
            <div className={`flex h-52 w-52 items-center justify-center rounded-xl ${d ? 'bg-[#1E293B]' : 'bg-white'}`}>
              {isGenerating ? (
                <div className="flex flex-col items-center gap-3">
                  <Wifi className={`h-8 w-8 animate-pulse ${d ? 'text-gray-500' : 'text-gray-400'}`} />
                  <span className={`text-xs ${d ? 'text-gray-500' : 'text-gray-400'}`}>Generating...</span>
                </div>
              ) : qrCodeDataURL ? (
                <img src={qrCodeDataURL} alt="Scan to connect" className="h-48 w-48 rounded-lg" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <X className={`h-7 w-7 ${d ? 'text-red-400' : 'text-red-500'}`} />
                  <span className={`text-xs ${d ? 'text-gray-400' : 'text-gray-500'}`}>Generation failed</span>
                </div>
              )}
            </div>
          </div>

          {/* URL row */}
          <div className="space-y-2">
            <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${d ? 'bg-gray-800 border border-gray-700' : 'bg-gray-50 border border-gray-200'}`}>
              <span className={`flex-1 truncate font-mono text-xs ${d ? 'text-gray-300' : 'text-gray-600'}`}>{connectionURL}</span>
              <button
                onClick={copyURL}
                className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                  copiedURL
                    ? (d ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                    : (d ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200')
                }`}
              >
                {copiedURL ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedURL ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Join code */}
            {joinCode && (
              <div className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${d ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-100'}`}>
                <span className={`shrink-0 text-xs font-medium ${d ? 'text-amber-400' : 'text-amber-600'}`}>Join code</span>
                <span className={`flex-1 font-mono text-xs font-bold tracking-[0.25em] ${d ? 'text-amber-200' : 'text-amber-900'}`}>{joinCode}</span>
                <button
                  onClick={copyCode}
                  className={`shrink-0 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all ${
                    copiedCode
                      ? (d ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                      : (d ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300' : 'bg-amber-100 hover:bg-amber-200 text-amber-700')
                  }`}
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer note */}
        <div className={`flex items-center gap-2 border-t px-5 py-3.5 ${d ? 'border-white/5 bg-slate-950/45 text-gray-500' : 'border-slate-900/5 bg-[#f8fafc] text-gray-400'}`}>
          <Wifi className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">Device must be on the same network</span>
        </div>
      </div>
    </div>
  );
};

export default QRCodeDialog;
