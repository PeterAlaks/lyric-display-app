import React from 'react';
import { AlertTriangle, Check, Copy, MonitorSmartphone, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';

const copyToClipboard = async (value) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to the selection-based copy path used by older renderer contexts.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
};

export default function NetworkAddressChangedModal({
  darkMode,
  previousIPAddress,
  newIPAddress,
  serverPort = 4000,
  affectedRemoteOutputCount = 0,
}) {
  const [copied, setCopied] = React.useState(false);
  const copiedTimerRef = React.useRef(null);
  const outputBaseUrl = `http://${newIPAddress}:${serverPort}`;
  const affectedOutputCopy = affectedRemoteOutputCount === 1
    ? 'A remote output page was using the previous address and may now be disconnected.'
    : affectedRemoteOutputCount > 1
      ? `${affectedRemoteOutputCount} remote output pages were using the previous address and may now be disconnected.`
      : 'A remote output page previously used this computer and may now be disconnected.';

  React.useEffect(() => () => {
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
  }, []);

  const handleCopy = async () => {
    try {
      await copyToClipboard(newIPAddress || '');
      setCopied(true);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.warn('Failed to copy the new network address:', error);
    }
  };

  return (
    <div className="space-y-5">
      <div className={`flex gap-3 rounded-xl border p-4 ${
        darkMode
          ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
          : 'border-amber-200 bg-amber-50 text-amber-950'
      }`}>
        <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${darkMode ? 'text-amber-300' : 'text-amber-600'}`} />
        <div>
          <p className="font-semibold">External output pages may need to reconnect</p>
          <p className={`mt-1 text-sm leading-relaxed ${darkMode ? 'text-amber-100/75' : 'text-amber-900/75'}`}>
            This computer is now using a different local network address. {affectedOutputCopy}
          </p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Network className={`h-4 w-4 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <span className={`text-xs font-semibold uppercase tracking-wide ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            New IP address
          </span>
        </div>
        <div className={`flex items-center gap-2 rounded-xl border p-2 ${
          darkMode ? 'border-gray-700 bg-gray-900/70' : 'border-gray-200 bg-gray-50'
        }`}>
          <code className={`min-w-0 flex-1 break-all px-2 text-lg font-semibold tracking-wide ${
            darkMode ? 'text-blue-200' : 'text-blue-700'
          }`}>
            {newIPAddress}
          </code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={darkMode ? 'border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700 hover:text-white' : ''}
            aria-label="Copy new IP address"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        {previousIPAddress && (
          <p className={`mt-2 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Previous IP address: <code>{previousIPAddress}</code>
          </p>
        )}
      </div>

      <div className={`rounded-xl border p-4 ${darkMode ? 'border-gray-700/80 bg-gray-900/45' : 'border-gray-200 bg-white'}`}>
        <div className="flex gap-3">
          <MonitorSmartphone className={`mt-0.5 h-5 w-5 shrink-0 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`} />
          <div className="min-w-0">
            <p className={`font-semibold ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>What to do</p>
            <ol className={`mt-2 list-decimal space-y-2 pl-4 text-sm leading-relaxed ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              <li>
                On each remote output page, replace the old IP with the new one and keep its output route unchanged. For example: <code className="break-all font-semibold">{outputBaseUrl}/#/output1</code>.
              </li>
              <li>Reload the page, then update any saved browser-source or integration URL that still uses the previous IP address.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
