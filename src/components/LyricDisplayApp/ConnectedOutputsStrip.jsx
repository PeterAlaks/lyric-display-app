import React from 'react';
import { Monitor } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import { useConnectedOutputs } from '../../hooks/useStoreSelectors';
import useHorizontalWheelScroll from '../../hooks/useHorizontalWheelScroll';
import { formatOutputLabel } from '../../utils/outputLabels';

const ConnectedOutputsStrip = ({ darkMode, isOutputOn }) => {
  const connectedOutputs = useConnectedOutputs();
  const totalInstances = connectedOutputs.reduce((total, output) => total + output.instanceCount, 0);
  const { containerRef, scrollerRef } = useHorizontalWheelScroll();

  return (
    <div
      ref={containerRef}
      className="my-6 flex h-6 items-center gap-3"
      aria-live="polite"
      aria-label={`${totalInstances} connected output ${totalInstances === 1 ? 'display' : 'displays'}`}
    >
      <Tooltip content="Connected output displays" side="top">
        <span
          className={`flex shrink-0 items-center justify-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
          aria-label="Connected output displays"
        >
          <Monitor className="h-4 w-4" aria-hidden="true" />
        </span>
      </Tooltip>

      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        <div
          ref={scrollerRef}
          className="scrollbar-none flex h-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-contain"
          tabIndex={connectedOutputs.length > 0 ? 0 : undefined}
        >
          {connectedOutputs.length > 0 ? (
            <div className="flex h-full shrink-0 items-center gap-1.5">
              {connectedOutputs.map((output) => {
                const isLive = output.enabled && (!output.masterControlled || isOutputOn);
                const label = formatOutputLabel(output.id);

                return (
                  <span
                    key={output.id}
                    className={`inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold ${isLive
                      ? darkMode
                        ? 'border-emerald-400/35 text-emerald-300'
                        : 'border-emerald-200 text-emerald-700'
                      : darkMode
                        ? 'border-gray-600 bg-gray-700/70 text-gray-300'
                        : 'border-gray-200 bg-gray-100 text-gray-600'
                      }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-500' : darkMode ? 'bg-gray-500' : 'bg-gray-400'}`} aria-hidden="true" />
                    <span>{label}</span>
                    {output.instanceCount > 1 && <span className="opacity-70">×{output.instanceCount}</span>}
                  </span>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full min-w-0 flex-1 items-center">
              <span className={`truncate text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                No output displays connected
              </span>
            </div>
          )}
        </div>
        <div
          className={`pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-linear-to-l to-transparent ${darkMode ? 'from-gray-800' : 'from-white'}`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};

export default ConnectedOutputsStrip;
