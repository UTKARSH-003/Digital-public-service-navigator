import type { CSSProperties, ElementType } from 'react';

/** Echo layers: colour token + upward offset in em. Layer order = back to front after the foreground. */
const ECHOES: { color: string; offset: number }[] = [
  { color: 'var(--color-echo-4)', offset: 0.16 },
  { color: 'var(--color-echo-3)', offset: 0.12 },
  { color: 'var(--color-echo-2)', offset: 0.08 },
  { color: 'var(--color-echo-1)', offset: 0.04 },
];

interface Props {
  /** One entry per visual line. Every layer renders the same lines, so wrapping is identical. */
  lines: string[];
  as?: ElementType;
  className?: string;
  id?: string;
}

/**
 * Five-layer typographic echo: the real heading (#111, in normal flow) plus four decorative
 * copies stacked behind it at -0.04em steps. The copies are absolutely positioned, aria-hidden and
 * pointer-events:none, so assistive technology reads the headline exactly once and the foreground
 * stays crisp. Offsets are in `em`, so the effect scales with the fluid font size.
 */
export function TypographicEcho({ lines, as: Tag = 'h1', className = 't-hero', id }: Props) {
  const body = lines.map((l, i) => (
    <span key={i} className="block">
      {l}
    </span>
  ));
  return (
    // padding-top reserves room for the highest echo so it is never clipped by a parent
    // the container carries the display class so every `em` below (padding, offsets) uses the same font size
    <div className={`relative ${className}`} style={{ paddingTop: '0.2em' }}>
      {ECHOES.map((e, i) => (
        <span
          key={i}
          aria-hidden="true"
          data-echo={i + 2}
          className={`${className} pointer-events-none absolute inset-x-0 bottom-0 select-none`}
          style={{ color: e.color, top: '0.2em', transform: `translateY(-${e.offset}em)` } as CSSProperties}
        >
          {body}
        </span>
      ))}
      <Tag id={id} className={`${className} relative text-ink`} style={{ color: 'var(--color-foreground)' }}>
        {body}
      </Tag>
    </div>
  );
}
