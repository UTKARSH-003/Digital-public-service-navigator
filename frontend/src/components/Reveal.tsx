import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Clip-path reveal (700ms editorial easing) the first time the element scrolls into view. */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (shown || !el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return (
    // The observed wrapper is never clipped (a clipped target can report no intersection); the inner layer animates.
    <div ref={ref} className={className}>
      <div className={`reveal h-full ${shown ? 'is-revealed' : ''}`}>{children}</div>
    </div>
  );
}
