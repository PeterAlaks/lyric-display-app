import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const animationDuration = 220;

export function SupportDevelopmentModal({ isOpen, onClose, isDark = false }) {
  const [entering, setEntering] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEntering(true);
      setExiting(false);
      requestAnimationFrame(() => {
        setEntering(false);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      setEntering(true);
      onClose();
    }, animationDuration);
  };

  const handleDonate = () => {
    window.open('https://paystack.shop/pay/lyricdisplay-support', '_blank');
  };

  if (!isOpen) return null;

  const overlayStateClass = entering || exiting ? 'opacity-0' : 'opacity-100';
  const panelStateClass = entering || exiting
    ? 'translate-y-8 opacity-0 scale-95'
    : 'translate-y-0 opacity-100 scale-100';

  const content = (
    <div
      className="fixed inset-0 z-[1300] flex items-center justify-center px-4 py-10"
      aria-modal="true"
      role="dialog"
      aria-labelledby="support-dev-modal-title"
    >
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200',
          overlayStateClass
        )}
        onClick={handleClose}
      />

      {/* Modal Panel */}
      <div
        className={cn(
          'relative transform rounded-2xl border shadow-2xl ring-1 transition-all duration-200 overflow-hidden',
          'w-full max-w-4xl',
          isDark
            ? 'bg-gray-900 text-gray-50 border-gray-800 ring-blue-500/35'
            : 'bg-white text-gray-900 border-gray-200 ring-blue-500/20',
          panelStateClass
        )}
        style={{ maxHeight: 'calc(100vh - 80px)' }}
      >
        <div className="flex h-full" style={{ minHeight: '500px', maxHeight: '600px' }}>
          {/* Left Half - Image */}
          <div className="w-1/2 relative overflow-hidden">
            <img
              src="/images/support-dev.jpg"
              alt="Support Development"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Right Half - Content */}
          <div className="w-1/2 flex flex-col">
            {/* Close Button */}
            <div className="absolute top-4 right-4 z-10">
              <button
                type="button"
                className={cn(
                  'rounded-full p-2 transition-colors',
                  isDark
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-white/10'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-black/5'
                )}
                onClick={handleClose}
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Container */}
            <div className="flex-1 flex flex-col justify-center px-10 py-12">
              <div className="space-y-6">
                {/* Header */}
                <div className="space-y-3">
                  <h2
                    id="support-dev-modal-title"
                    className="text-3xl font-bold tracking-tight"
                  >
                    Keep LyricDisplay Free
                  </h2>

                  {/* Description */}
                  <p
                    className={cn(
                      'text-sm leading-relaxed',
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    )}
                  >
                    LyricDisplay is a passion project built to serve worship teams and content creators worldwide.
                    Your donation helps us maintain servers, develop new features, and keep all functionality
                    completely free for everyone.
                  </p>

                  <p
                    className={cn(
                      'text-sm leading-relaxed',
                      isDark ? 'text-gray-300' : 'text-gray-600'
                    )}
                  >
                    Every contribution, no matter the size, makes a real difference in sustaining this project
                    and ensuring it remains accessible to all who need it.
                  </p>
                </div>

                {/* Donate Button */}
                <div className="pt-4">
                  <Button
                    onClick={handleDonate}
                    className={cn(
                      'w-full h-12 text-base font-semibold gap-2',
                      'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600',
                      'text-white shadow-lg hover:shadow-xl transition-all duration-200'
                    )}
                  >
                    <Heart className="h-5 w-5 fill-current" />
                    Support with a Donation
                  </Button>
                </div>

                {/* Footer Note */}
                <p
                  className={cn(
                    'text-xs text-center pt-2',
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  )}
                >
                  Thank you for considering supporting LyricDisplay!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default SupportDevelopmentModal;