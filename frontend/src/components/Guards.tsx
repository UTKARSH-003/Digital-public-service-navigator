import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../i18n';
import { PageContainer, PageTitle, Spinner } from './ui';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageContainer><Spinner /></PageContainer>;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

/** UI convenience only. The API rejects non-staff requests regardless of what is rendered here. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { session, loading, role } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();
  if (loading) return <PageContainer><Spinner /></PageContainer>;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (role === 'user') return <PageContainer><PageTitle eyebrow="403" sub={t('forbidden.body')}>{t('forbidden.title')}</PageTitle></PageContainer>;
  return <>{children}</>;
}
