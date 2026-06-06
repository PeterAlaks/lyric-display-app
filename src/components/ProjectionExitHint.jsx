import React from 'react';

const HINT_DURATION_MS = 7000;

const ProjectionExitHint = ({ visible }) => {
  const [showHint, setShowHint] = React.useState(Boolean(visible));

  React.useEffect(() => {
    if (!visible) {
      setShowHint(false);
      return undefined;
    }

    setShowHint(true);
    const timeout = window.setTimeout(() => {
      setShowHint(false);
    }, HINT_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [visible]);

  if (!visible || !showHint) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 flex items-center justify-center px-6 pointer-events-none"
      style={{ zIndex: 2147483647 }}
    >
      <div className="rounded-lg border border-white/18 bg-black/78 px-5 py-3 text-center text-white shadow-2xl backdrop-blur-sm">
        <div className="text-lg font-semibold tracking-normal">Press Esc key to close</div>
      </div>
    </div>
  );
};

export default ProjectionExitHint;
