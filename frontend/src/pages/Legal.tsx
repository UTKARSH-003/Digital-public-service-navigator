import { Link, useParams } from 'react-router-dom';
import { Notice, PageContainer, PageTitle } from '../components/ui';

const PAGES: Record<string, { title: string; body: string[] }> = {
  privacy: { title: 'Privacy notice', body: [
    'What we collect: if you create an account, your email address (held by our authentication provider), saved services, checklist items you create, optional preferences you choose to give, and a short summary of eligibility results if you choose to save one.',
    'What we do not collect: Aadhaar numbers, OTPs, passwords for government sites, bank details or identity documents. Eligibility answers are used to compute a result and are not stored.',
    'Why: to provide the features you ask for. Preferences are used for recommendations only if you give consent, and you can withdraw consent at any time on the Profile page.',
    'Retention: account data is kept until you delete your account. Anonymous search queries are kept for a limited time (target 90 days) for improving search.',
    'Your choices: you can download your data and delete your account and all associated data from the Profile page.',
    'This notice is a draft and must be reviewed by qualified legal counsel for compliance with the Digital Personal Data Protection Act, 2023, including the appointment of a grievance contact, before public launch.',
  ] },
  terms: { title: 'Terms of use', body: [
    'This service provides general information to help you find public services. It is provided as is, without warranty of accuracy or completeness.',
    'It does not submit applications and cannot access government records. Always apply through the official portal.',
    'These terms are a draft and must be reviewed by qualified legal counsel before public launch.',
  ] },
  disclaimer: { title: 'Disclaimer', body: [
    'Digital Public Service Navigator is an independent service. It is not affiliated with, endorsed by, or operated by any government body.',
    'Eligibility results are preliminary, unofficial indications and never a government decision.',
    'Records marked “Demonstration record” or “Awaiting verification” have not been checked by a reviewer. Confirm every detail on the official source.',
  ] },
  contact: { title: 'Contact', body: [
    'To report an error or broken link, use “Report a problem” on any service page.',
    'Contact details and a grievance officer must be added by the operator of this deployment before launch.',
  ] },
};

export default function Legal() {
  const { page = '' } = useParams();
  const p = PAGES[page];
  if (!p) return <PageContainer><PageTitle>Not found</PageTitle></PageContainer>;
  return (
    <PageContainer narrow className="space-y-4"><PageTitle eyebrow="Legal">{p.title}</PageTitle>
      {page === 'privacy' && <Notice tone="warn">Draft for demonstration. Legal review required.</Notice>}
      {p.body.map((b, i) => <p key={i}>{b}</p>)}
      <Link to="/" className="inline-block underline">← Home</Link></PageContainer>
  );
}
