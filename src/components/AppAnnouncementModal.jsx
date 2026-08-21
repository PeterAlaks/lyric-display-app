import { BellRing, X } from 'lucide-react';

export default function AppAnnouncementModal({ announcement, darkMode = false, modalId, onClose }) {
  return (
    <article className={`flex h-full min-h-0 flex-col ${darkMode ? 'bg-[#10131b] text-slate-50' : 'bg-white text-slate-950'}`}>
      <div className="relative aspect-3/1 w-full shrink-0 overflow-hidden bg-slate-200 dark:bg-slate-800">
        <img
          src={announcement.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          draggable="false"
        />
        <div className={`pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b ${darkMode ? 'from-black/55' : 'from-black/35'} to-transparent`} />
        <button
          type="button"
          onClick={() => onClose?.({ dismissed: true, reason: 'close-button' })}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black/35 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-black/55"
          aria-label="Close announcement"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
        <div className="min-h-0 flex-1 overflow-y-auto pr-2">
          <div className={`mb-2.5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] ${darkMode ? 'text-violet-300' : 'text-violet-600'}`}>
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${darkMode ? 'bg-violet-400/10' : 'bg-violet-50'}`}>
              <BellRing className="h-3.5 w-3.5" aria-hidden />
            </span>
            LyricDisplay announcement
          </div>
          <h2
            id={`modal-${modalId}-title`}
            className="overflow-hidden text-xl font-semibold leading-tight tracking-tight sm:text-2xl"
            style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}
          >
            {announcement.title}
          </h2>
          <div className={`mt-3 whitespace-pre-line text-sm leading-6 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {announcement.body}
          </div>
        </div>
        <div className={`mt-4 flex shrink-0 justify-end border-t pt-4 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={() => onClose?.({ dismissed: true, reason: 'acknowledged' })}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#10131b]"
          >
            Got it
          </button>
        </div>
      </div>
    </article>
  );
}
