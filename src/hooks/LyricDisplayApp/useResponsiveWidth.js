import { useState, useEffect } from 'react';

export const useResponsiveWidth = (ref, hasLyrics, breakpoint = 700) => {
  const [availableWidth, setAvailableWidth] = useState(1000);

  useEffect(() => {
    if (!ref.current || !hasLyrics) return;

    const updateWidth = () => {
      if (ref.current) {
        setAvailableWidth(ref.current.offsetWidth);
      }
    };

    const observer = new ResizeObserver(updateWidth);
    observer.observe(ref.current);

    updateWidth();

    return () => observer.disconnect();
  }, [ref, hasLyrics]);

  const useIconOnlyButtons = availableWidth < breakpoint;

  return { availableWidth, useIconOnlyButtons };
};