import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Link = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="font-medium text-sky-300 transition-colors hover:text-sky-200"
  >
    {children}
  </a>
);

const CreditBlock = ({ title, children }) => (
  <section className="space-y-1.5">
    <h3 className="text-xs font-semibold text-white">{title}</h3>
    <div className="text-[11px] leading-relaxed text-slate-300">{children}</div>
  </section>
);

export function AboutAppModal({ version = '1.0.0', onClose }) {
  const closeWithAction = (action) => onClose?.({ action });

  return (
    <div
      className="relative flex min-h-0 flex-col overflow-hidden text-white"
      style={{
        height: 'min(590px, calc(100dvh - 112px))',
        background: 'linear-gradient(135deg, #000000 0%, #1f2937 50%, #111827 100%)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 12% 8%, rgba(71, 85, 105, 0.22), transparent 34%)',
        }}
      />

      <div className="relative z-10 flex min-h-0 flex-1 overflow-y-auto px-5 py-8 scrollbar-thin scrollbar-track-slate-900 scrollbar-thumb-slate-600 sm:px-6">
        <div className="my-auto w-full space-y-5">
          <div
            className="grid items-stretch gap-4"
            style={{ gridTemplateColumns: 'minmax(0, 3fr) 1px minmax(0, 7fr)' }}
          >
            <div className="flex min-w-0 flex-col items-start">
              <img
                src="/logos/LyricDisplay logo-white.png"
                alt="LyricDisplay Logo"
                className="mb-2 h-8 w-auto max-w-full object-contain"
              />
              <p className="text-xs text-slate-400">Version {version}</p>
            </div>

            <div aria-hidden="true" className="w-px self-stretch bg-white/15" />

            <div className="min-w-0 space-y-1.5">
              <p className="text-xs font-medium text-slate-100">
                &copy; {new Date().getFullYear()} LyricDisplay Technologies. Trademarks reserved.
              </p>
              <p className="text-[10px] leading-relaxed text-slate-400">
                Designed and developed by <span className="font-medium text-slate-300">Peter Alakembi</span> and{' '}
                <span className="font-medium text-slate-300">David Okaliwe</span>, among other contributors.
              </p>
              <p className="text-xs leading-relaxed text-slate-400">
                <Link href="https://lyricdisplay.app">Our Website</Link>
                <span className="mx-3" aria-hidden="true">·</span>
                <Link href="https://peteralakembi.design">About the Author</Link>
              </p>
            </div>
          </div>

          <CreditBlock title="Lyrics Providers">
            <p>
              This application integrates optional online lyrics search features. All lyrics, metadata,
              and content obtained through these services remain the property of their respective copyright holders.
              Logos and brand marks of providers are used for identification and attribution only and do not imply
              endorsement or affiliation. This feature is offered &quot;as is&quot; for convenience and educational purposes.
              LyricDisplay and its developers are not affiliated with these content providers.
            </p>
          </CreditBlock>

          <div className="space-y-4">
            <CreditBlock title="NDI Companion">
              <p>
                The NDI Companion is an optional, separate download that enables LyricDisplay outputs
                to be broadcast as NDI video sources. It is not included with or installed automatically
                alongside the LyricDisplay app. NDI is a registered trademark of Vizrt NDI AB; LyricDisplay
                is not affiliated with or endorsed by Vizrt NDI AB. Learn more at{' '}
                <Link href="https://ndi.video">ndi.video</Link>.
              </p>
            </CreditBlock>

            <CreditBlock title="Butterchurn / MilkDrop">
              <p>
                MilkDrop-compatible visualizations are rendered with{' '}
                <Link href="https://github.com/jberg/butterchurn">Butterchurn</Link>{' '}
                and butterchurn-presets by Jordan Berg, distributed under the MIT License.{' '}
                <Link href="https://www.geisswerks.com/about_milkdrop.html">MilkDrop</Link>{' '}
                was created by Ryan Geiss. Bundled preset names retain their original creator credits.
              </p>
            </CreditBlock>

            <CreditBlock title="Loading Screen Photography">
              <p>
                Photo by{' '}
                <Link href="https://unsplash.com/@elianna_gill03?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">
                  Elianna Gill
                </Link>{' '}
                on{' '}
                <Link href="https://unsplash.com/?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText">
                  Unsplash
                </Link>.
              </p>
            </CreditBlock>
          </div>
        </div>
      </div>

      <footer className="relative z-10 flex shrink-0 items-center justify-end gap-3 border-t border-white/10 bg-black/20 px-5 py-3.5 backdrop-blur-sm sm:px-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => closeWithAction('close')}
          className="border-white/20 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
        >
          Close
        </Button>
        <Button
          type="button"
          onClick={() => closeWithAction('checkUpdates')}
          className="gap-2 bg-white text-slate-950 hover:bg-slate-200"
        >
          <RefreshCw className="h-4 w-4" />
          Check for Updates
        </Button>
      </footer>
    </div>
  );
}

export default AboutAppModal;
