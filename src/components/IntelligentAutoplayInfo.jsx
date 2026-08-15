import React from 'react';
import { Sparkles, Clock, Zap, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ModalActionButton } from '@/components/modal/modalActions';

const FEATURES = [
  {
    icon: Clock,
    title: 'Perfect Timing',
    description: 'Slides advance exactly when the lyrics hit — no manual tapping needed.',
    accent: 'blue',
  },
  {
    icon: Zap,
    title: 'Smart Progression',
    description: 'Reads embedded timestamp data to stay in sync from start to finish.',
    accent: 'violet',
  },
  {
    icon: CheckCircle2,
    title: 'Standard Autoplay Still Available',
    description: 'Switch back to manual or fixed-interval autoplay at any time.',
    accent: 'emerald',
  },
];

const accentMap = {
  blue: {
    light: { bg: 'bg-blue-50', icon: 'text-blue-500', ring: 'ring-blue-100' },
    dark:  { bg: 'bg-blue-500/10', icon: 'text-blue-400', ring: 'ring-blue-500/20' },
  },
  violet: {
    light: { bg: 'bg-violet-50', icon: 'text-violet-500', ring: 'ring-violet-100' },
    dark:  { bg: 'bg-violet-500/10', icon: 'text-violet-400', ring: 'ring-violet-500/20' },
  },
  emerald: {
    light: { bg: 'bg-emerald-50', icon: 'text-emerald-500', ring: 'ring-emerald-100' },
    dark:  { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', ring: 'ring-emerald-500/20' },
  },
};

const IntelligentAutoplayInfo = ({ darkMode, onStart, onClose, setDontShowAgain }) => {
  const [dontShow, setDontShow] = React.useState(false);

  const handleStart = () => {
    if (dontShow && setDontShowAgain) setDontShowAgain(true);
    onStart();
  };

  const d = darkMode;

  return (
    <div className="flex flex-col" style={{ minHeight: 360 }}>

      {/* Hero */}
      <div className={`px-6 pt-6 pb-5 rounded-xl mb-1 ${d ? 'bg-linear-to-br from-violet-500/10 via-blue-500/5 to-transparent' : 'bg-linear-to-br from-violet-50 via-blue-50/60 to-white'}`}>
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl ring-1 shrink-0 ${d ? 'bg-violet-500/15 ring-violet-500/25 text-violet-300' : 'bg-violet-100 ring-violet-200 text-violet-600'}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`text-base font-semibold leading-snug mb-1 ${d ? 'text-white' : 'text-gray-900'}`}>
              Intelligent Autoplay detected
            </h3>
            <p className={`text-sm leading-relaxed ${d ? 'text-gray-400' : 'text-gray-500'}`}>
              Your lyrics contain timing data. Let LyricDisplay advance slides automatically in sync with the song.
            </p>
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div className="px-1 py-2 space-y-1.5 flex-1">
        {FEATURES.map(({ icon: Icon, title, description, accent }) => {
          const theme = accentMap[accent][d ? 'dark' : 'light'];
          return (
            <div
              key={title}
              className={`flex items-start gap-3.5 rounded-xl px-4 py-3 ring-1 ${theme.bg} ${theme.ring}`}
            >
              <div className={`mt-0.5 shrink-0 ${theme.icon}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className={`text-sm font-medium ${d ? 'text-gray-100' : 'text-gray-800'}`}>{title}</p>
                <p className={`text-xs mt-0.5 leading-relaxed ${d ? 'text-gray-400' : 'text-gray-500'}`}>{description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Don't show again */}
      <div className={`flex items-center gap-2.5 px-1 py-3 mt-1 border-t ${d ? 'border-gray-800' : 'border-gray-100'}`}>
        <Checkbox
          id="dont-show-again"
          checked={dontShow}
          onCheckedChange={setDontShow}
          className={`rounded ${d ? 'border-gray-600' : 'border-gray-300'}`}
        />
        <label
          htmlFor="dont-show-again"
          className={`text-xs cursor-pointer select-none ${d ? 'text-gray-400' : 'text-gray-500'}`}
        >
          Don't show this again
        </label>
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2.5 pt-3">
        <ModalActionButton
          type="button"
          tone="tertiary"
          darkMode={d}
          onClick={onClose}
        >
          Maybe later
        </ModalActionButton>
        <ModalActionButton
          type="button"
          tone="primary"
          darkMode={d}
          onClick={handleStart}
          className="gap-2"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Start Intelligent Autoplay
        </ModalActionButton>
      </div>
    </div>
  );
};

export default IntelligentAutoplayInfo;
