import React, { useEffect } from 'react';
import { MonitorUp } from 'lucide-react';
import TutorialPopover from '@/components/ui/tutorial-popover';

const TutorialLineAnchor = React.memo(({
  active,
  open,
  index,
  loadKey,
  darkMode,
  onVisible,
  onOpenChange,
  onNeverShowAgain,
  children,
}) => {
  const anchorRef = React.useRef(null);

  useEffect(() => {
    if (!active) return undefined;

    const node = anchorRef.current;
    if (!node) return undefined;

    if (typeof IntersectionObserver === 'undefined') {
      onVisible(index);
      return undefined;
    }

    let hasReportedVisible = false;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!hasReportedVisible && entry?.isIntersecting && entry.intersectionRatio >= 0.5) {
        hasReportedVisible = true;
        onVisible(index);
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    observer.observe(node);

    return () => observer.disconnect();
  }, [active, index, loadKey, onVisible]);

  const child = React.Children.only(children);
  if (!active) return child;

  const anchor = React.cloneElement(child, { ref: anchorRef });

  return (
    <TutorialPopover
      anchor={anchor}
      open={open}
      onOpenChange={onOpenChange}
      title="Stage-only lyric marker"
      darkMode={darkMode}
      onNeverShowAgain={onNeverShowAgain}
      icon={MonitorUp}
    >
      Lines that start with <span className="font-mono">//</span> are hidden on output pages. Stage displays show the line after removing the marker.
    </TutorialPopover>
  );
});

TutorialLineAnchor.displayName = 'TutorialLineAnchor';

export default TutorialLineAnchor;
