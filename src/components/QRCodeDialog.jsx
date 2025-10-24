import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react';
import QRCode from 'qrcode';
import { X, Smartphone, Wifi } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { resolveBackendUrl } from "../utils/network";
import useToast from '../hooks/useToast';

const ANIMATION_DURATION = 300;

const QRCodeDialog = ({ isOpen, onClose, darkMode }) => {
  const [localIP, setLocalIP] = useState('');
  const [qrCodeDataURL, setQRCodeDataURL] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [entering, setEntering] = useState(false);

  const [joinCode, setJoinCode] = useState(null);
  const { showToast } = useToast();

  const refreshJoinCode = useCallback(async () => {
    try {
      if (window.electronAPI?.getJoinCode) {
        const code = await window.electronAPI.getJoinCode();
        if (code) {
          setJoinCode(code);
          return;
        }
      }

      const response = await fetch(resolveBackendUrl('/api/auth/join-code'));
      if (!response.ok) {
        throw new Error(`Failed to fetch join code: ${response.status}`);
      }
      const payload = await response.json();
      setJoinCode(payload?.joinCode || null);
    } catch (error) {
      console.warn('Failed to load join code for QR dialog', error);
    }
  }, [resolveBackendUrl]);
  useEffect(() => {
    if (isOpen) {
      refreshJoinCode();
    }
  }, [isOpen, refreshJoinCode]);

  useEffect(() => {
    const handleJoinCodeUpdated = (event) => {
      const nextCode = event?.detail?.joinCode;
      if (typeof nextCode === 'string') {
        setJoinCode(nextCode);
      } else {
        setJoinCode(null);
        if (isOpen) {
          refreshJoinCode();
        }
      }
    };

    window.addEventListener('join-code-updated', handleJoinCodeUpdated);
    return () => window.removeEventListener('join-code-updated', handleJoinCodeUpdated);
  }, [isOpen, refreshJoinCode]);

  useEffect(() => {
    if (!isOpen) return;

    const getLocalIP = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getLocalIP) {
          const ip = await window.electronAPI.getLocalIP();
          setLocalIP(ip);
        } else {
          setLocalIP('localhost');
        }
      } catch (error) {
        console.error('Error getting local IP:', error);
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
        const url = `http://${localIP}:4000/?client=mobile&joinCode=${joinCode}`;

        const dataURL = await QRCode.toDataURL(url, {
          width: 200,
          margin: 2,
          color: {
            dark: darkMode ? '#FFFFFF' : '#000000',
            light: darkMode ? '#1F2937' : '#FFFFFF'
          },
          errorCorrectionLevel: 'M'
        });

        setQRCodeDataURL(dataURL);
      } catch (error) {
        console.error('Error generating QR code:', error);
      } finally {
        setIsGenerating(false);
      }
    };

    generateQRCode();
  }, [localIP, isOpen, darkMode, joinCode]);


  useLayoutEffect(() => {
    if (isOpen) {
      setVisible(true);
      setExiting(false);
      setEntering(true);
      const raf = requestAnimationFrame(() => setEntering(false));
      return () => cancelAnimationFrame(raf);
    }

    if (!visible) {
      return undefined;
    }

    setEntering(false);
    setExiting(true);
    const timeout = setTimeout(() => {
      setExiting(false);
      setVisible(false);
    }, ANIMATION_DURATION);

    return () => clearTimeout(timeout);
  }, [isOpen, visible]);

  if (!visible) return null;

  const connectionURL = `http://${localIP}:4000/?client=mobile`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${(exiting || entering) ? 'opacity-0' : 'opacity-100'}`}
        onClick={onClose}
      />

      {/* Dialog */}
      <div className={`
        relative w-full max-w-md mx-4 rounded-xl shadow-2xl p-6
        ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}
        transition-all duration-300 ease-out
        ${(exiting || entering) ? 'opacity-0 translate-y-1 scale-95' : 'opacity-100 translate-y-0 scale-100'}
      `}>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Smartphone className="w-6 h-6" />
            Connect Mobile Controller
          </h2>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className={darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="text-center space-y-4">

          {/* QR Code */}
          <div className={`
            mx-auto w-52 h-52 flex items-center justify-center rounded-lg border-2 border-dashed
            ${darkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-50'}
          `}>
            {isGenerating ? (
              <div className="flex flex-col items-center gap-2">
                <Wifi className={`w-8 h-8 animate-pulse ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Generating QR Code...
                </span>
              </div>
            ) : qrCodeDataURL ? (
              <img
                src={qrCodeDataURL}
                alt="QR Code for mobile connection"
                className="w-48 h-48 rounded"
              />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <X className={`w-8 h-8 ${darkMode ? 'text-red-400' : 'text-red-500'}`} />
                <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Failed to generate QR Code
                </span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Scan QR code with your mobile device or visit:
            </p>
            <div className={`
              px-3 py-2 rounded-md text-sm font-mono break-all
              ${darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}
            `}>
              {connectionURL}
            </div>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Make sure your mobile device is connected to the same network
            </p>
            {joinCode && (
              <div className="mt-3 space-y-2">
                <div
                  className={`
        px-3 py-2 rounded-md text-sm font-mono flex items-center justify-between
        ${darkMode ? 'bg-gray-700 text-yellow-300' : 'bg-gray-100 text-yellow-800'}
      `}
                >
                  <span>Join Code: {joinCode}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(joinCode).then(() => {
                        showToast({
                          title: 'Copied',
                          message: 'Join code copied to clipboard',
                          variant: 'success',
                          duration: 2000,
                        });
                      }).catch(() => {
                        showToast({
                          title: 'Copy failed',
                          message: 'Could not copy join code',
                          variant: 'error',
                        });
                      });
                    }}
                    className={`ml-2 px-2 py-1 rounded text-xs font-medium transition-colors ${darkMode
                      ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Copy URL Button */}
          <Button
            onClick={() => {
              navigator.clipboard.writeText(connectionURL).then(() => {
                showToast({
                  title: 'Copied',
                  message: 'URL copied to clipboard',
                  variant: 'success',
                  duration: 2000,
                });
              }).catch(() => {
                showToast({
                  title: 'Copy failed',
                  message: 'Could not copy URL',
                  variant: 'error',
                });
              });
            }}
            variant="outline"
            className="w-full text-black border-gray-300 hover:bg-gray-100 dark:text-white dark:border-gray-600 dark:hover:bg-gray-800"
          >
            Copy URL to Clipboard
          </Button>

        </div>
      </div>
    </div>
  );
};

export default QRCodeDialog;
