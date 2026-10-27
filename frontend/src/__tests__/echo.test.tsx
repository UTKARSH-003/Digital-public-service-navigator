import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypographicEcho } from '../components/TypographicEcho';

describe('TypographicEcho', () => {
  it('exposes one accessible heading and hides the decorative copies', () => {
    const { container } = render(<TypographicEcho as="h1" lines={['PUBLIC', 'SERVICES.']} />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const echoes = container.querySelectorAll('[data-echo]');
    expect(echoes).toHaveLength(4);
    echoes.forEach((e) => expect(e).toHaveAttribute('aria-hidden', 'true'));
  });
});
