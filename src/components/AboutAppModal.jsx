import React from 'react';
import { Info, ExternalLink, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function AboutAppModal({ darkMode = false, onClose, version = '1.0.0' }) {

  const handleOpenWebsite = () => {
    window.open('https://lyricdisplay.app', '_blank');
  };

  const handleOpenAuthor = () => {
    window.open('https://linktr.ee/peteralaks', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* App Info Section */}
      <div className="flex flex-col items-start text-center">
        <img
          src={darkMode ? "/logos/LyricDisplay logo-white.png" : "/logos/LyricDisplay logo.png"}
          alt="LyricDisplay Logo"
          className="h-10 w-auto object-contain mb-3"
        />
        <p className={cn(
          'text-sm',
          darkMode ? 'text-gray-400' : 'text-gray-600'
        )}>
          Version {version}
        </p>
      </div>

      {/* Copyright & Credits */}
      <div className={cn(
        'rounded-xl p-4 space-y-3',
        darkMode ? 'bg-gray-800/50' : 'bg-gray-50'
      )}>
        <div className="space-y-2">
          <p className={cn(
            'text-sm font-medium',
            darkMode ? 'text-gray-200' : 'text-gray-900'
          )}>
            © {new Date().getFullYear()} LyricDisplay. All rights reserved.
          </p>
          <p className={cn(
            'text-sm',
            darkMode ? 'text-gray-400' : 'text-gray-600'
          )}>
            Designed and developed by <span className="font-medium">Peter Alakembi</span> and <span className="font-medium">David Okaliwe</span>.
          </p>
        </div>
      </div>

      {/* Lyrics Provider Disclaimer */}
      <div className={cn(
        'rounded-xl p-4 space-y-3 border',
        darkMode
          ? 'bg-gray-800/30 border-gray-700'
          : 'bg-gray-50 border-gray-200'
      )}>
        <div className="space-y-2">
          <h4 className={cn(
            'text-sm font-semibold',
            darkMode ? 'text-gray-200' : 'text-gray-900'
          )}>
            Lyrics Provider Credits & Disclaimer
          </h4>
          <p className={cn(
            'text-xs leading-relaxed',
            darkMode ? 'text-gray-400' : 'text-gray-600'
          )}>
            This application integrates optional online lyrics search features. All lyrics, metadata,
            and content obtained through these services remain the property of their respective copyright holders.
          </p>
          <p className={cn(
            'text-xs leading-relaxed',
            darkMode ? 'text-gray-400' : 'text-gray-600'
          )}>
            Logos and brand marks of providers are used for identification and attribution only and
            do not imply endorsement or affiliation.
          </p>
          <p className={cn(
            'text-xs leading-relaxed',
            darkMode ? 'text-gray-400' : 'text-gray-600'
          )}>
            This feature is offered "as is" for convenience and educational purposes. LyricDisplay
            and its developers are not affiliated with these content providers.
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={handleOpenWebsite}
          variant="outline"
          className={cn(
            'w-full gap-2',
            darkMode
              ? 'bg-gray-800/50 border-gray-700 text-gray-200 hover:bg-gray-800 hover:border-gray-600 hover:text-white'
              : ''
          )}
        >
          <Globe className="h-4 w-4" />
          Our Website
        </Button>
        <Button
          onClick={handleOpenAuthor}
          variant="outline"
          className={cn(
            'w-full gap-2',
            darkMode
              ? 'bg-gray-800/50 border-gray-700 text-gray-200 hover:bg-gray-800 hover:border-gray-600 hover:text-white'
              : ''
          )}
        >
          <ExternalLink className="h-4 w-4" />
          About Author
        </Button>
      </div>
    </div>
  );
}

export default AboutAppModal;