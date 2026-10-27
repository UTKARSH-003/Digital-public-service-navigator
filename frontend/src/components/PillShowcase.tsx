import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  to: string;
  title: string;
  detail: string;
  children: ReactNode; // decorative visual
}

/**
 * Tall pill (≈500px, border-radius 9999px). The circular overlay is a real link: the secondary text is shown on
 * hover OR keyboard focus, and is always visible on touch devices (no hover-only information).
 */
export function PillShowcase({ to, title, detail, children }: Props) {
  return (
    <Link to={to} className="group relative block h-[500px] overflow-hidden rounded-full border border-line-strong bg-surface focus-visible:outline-offset-4" aria-label={`${title}. ${detail}`}>
      <div className="grayscale-hover absolute inset-0" aria-hidden>{children}</div>
      <span className="absolute left-1/2 top-1/2 grid h-44 w-44 -translate-x-1/2 -translate-y-[60%] place-items-center rounded-full border border-dark bg-paper/90 p-5 text-center backdrop-blur-sm sm:h-52 sm:w-52">
        <span className="t-display text-2xl leading-[0.95] sm:text-3xl">{title}<ArrowUpRight className="mx-auto mt-2 h-5 w-5" aria-hidden /></span>
      </span>
      <span className="pill-detail absolute inset-x-[16%] bottom-14 text-center text-sm font-bold leading-snug text-ink">{detail}</span>
    </Link>
  );
}
