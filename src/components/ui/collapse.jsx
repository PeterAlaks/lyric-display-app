import React from 'react';

// Animates height between 0 and its content's natural height using the
// CSS grid-template-rows trick (0fr <-> 1fr), so callers don't need to
// measure content height in JS to animate to/from "auto".
export default function Collapse({ open, children, className = '', duration = 300 }) {
  return (
    <div
      className={`grid transition-[grid-template-rows] ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'} ${className}`}
      style={{ transitionDuration: `${duration}ms` }}
      aria-hidden={!open}
    >
      <div className="overflow-hidden min-h-0">
        {children}
      </div>
    </div>
  );
}
