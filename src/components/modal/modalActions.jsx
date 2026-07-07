import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const getModalActionTone = (action = {}, index = 0, actionCount = 1) => {
  const explicitTone = (action.tone || action.intent || action.variant || '').toLowerCase();

  if (action.destructive || explicitTone === 'destructive' || explicitTone === 'danger') {
    return 'destructive';
  }
  if (explicitTone === 'default' || explicitTone === 'primary') {
    return 'primary';
  }
  if (explicitTone === 'outline' || explicitTone === 'secondary') {
    return 'secondary';
  }
  if (explicitTone === 'ghost' || explicitTone === 'tertiary' || explicitTone === 'link') {
    return 'tertiary';
  }

  if (actionCount <= 1 || action.autoFocus || index === actionCount - 1) {
    return 'primary';
  }
  return 'secondary';
};

export const getModalActionButtonVariant = (tone) => {
  if (tone === 'primary') return 'default';
  if (tone === 'tertiary') return 'ghost';
  return 'outline';
};

export const getModalActionButtonClassName = (tone, isDark = false) => {
  const shared = 'min-w-[96px] rounded-md px-4 font-semibold shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/35';

  switch (tone) {
    case 'destructive':
      return cn(
        shared,
        isDark
          ? 'border-red-500/60 bg-red-600 text-white hover:border-red-400 hover:bg-red-500 hover:text-white'
          : 'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 hover:text-white'
      );
    case 'secondary':
      return cn(
        shared,
        isDark
          ? 'border-slate-600 bg-slate-900/70 text-slate-100 hover:border-slate-500 hover:bg-slate-800 hover:text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900'
      );
    case 'tertiary':
      return cn(
        shared,
        'min-w-0 shadow-none',
        isDark
          ? 'bg-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white'
          : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      );
    case 'primary':
    default:
      return cn(
        shared,
        isDark
          ? 'border-blue-500 bg-blue-500 text-white hover:border-blue-400 hover:bg-blue-400 hover:text-white'
          : 'border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 hover:text-white'
      );
  }
};

export function ModalActionButton({
  action,
  actionIndex = 0,
  actionCount = 1,
  className,
  darkMode = false,
  tone,
  variant,
  ...props
}) {
  const resolvedTone = tone || getModalActionTone(action, actionIndex, actionCount);

  return (
    <Button
      variant={variant || getModalActionButtonVariant(resolvedTone)}
      className={cn(getModalActionButtonClassName(resolvedTone, darkMode), className)}
      {...props}
    />
  );
}

export function ModalFooter({
  children,
  className,
  darkMode = false,
  leading,
  align = 'end',
}) {
  const alignClass = align === 'between' ? 'justify-between' : align === 'start' ? 'justify-start' : 'justify-end';

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-3 border-t px-6 py-4',
        alignClass,
        darkMode ? 'border-white/5 bg-slate-950/45' : 'border-slate-900/5 bg-[#f8fafc]',
        className
      )}
    >
      {leading && <div className="min-w-0 flex-1">{leading}</div>}
      {children}
    </div>
  );
}
