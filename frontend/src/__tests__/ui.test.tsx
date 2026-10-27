import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '../i18n';
import { AuthProvider } from '../hooks/useAuth';
import Layout from '../layouts/Layout';
import { StatusBadge, ErrorBox } from '../components/ui';
import Login from '../pages/Login';

afterEach(() => { localStorage.clear(); document.documentElement.lang = 'en'; });

const wrap = (ui: React.ReactNode) => render(
  <QueryClientProvider client={new QueryClient()}><I18nProvider><AuthProvider><MemoryRouter>{ui}</MemoryRouter></AuthProvider></I18nProvider></QueryClientProvider>,
);

describe('Layout', () => {
  it('has a skip link, the independence banner, and a working language switcher', () => {
    wrap(<Layout />);
    expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#main');
    expect(screen.getAllByText(/Not an official government website/).length).toBeGreaterThanOrEqual(1);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'hi' } });
    expect(document.documentElement.lang).toBe('hi');
    expect(screen.getAllByText('होम').length).toBeGreaterThan(0);
  });
  it('mobile menu toggle exposes expanded state', () => {
    wrap(<Layout />);
    const btn = screen.getByRole('button', { name: /menu/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
  });
  it('hides the admin link for anonymous visitors', () => {
    wrap(<Layout />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });
});

describe('components', () => {
  it('never labels a demonstration record as verified', () => {
    wrap(<StatusBadge status="demonstration" />);
    expect(screen.getByText('Demonstration record')).toBeInTheDocument();
    expect(screen.queryByText('Verified')).not.toBeInTheDocument();
  });
  it('ErrorBox announces errors', () => {
    wrap(<ErrorBox error={new Error('Boom')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
  });
});

describe('Login', () => {
  it('explains when sign-in is not configured and disables submit', () => {
    wrap(<Login />);
    expect(screen.getByText(/Sign-in is not configured/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });
});
