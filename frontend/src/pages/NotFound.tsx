import { useI18n } from '../i18n';
import { LinkButton, PageContainer, PageTitle } from '../components/ui';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <PageContainer>
      <PageTitle eyebrow="404" sub={t('notfound.body')}>{t('notfound.title')}</PageTitle>
      <LinkButton to="/">{t('nav.home')}</LinkButton>
    </PageContainer>
  );
}
