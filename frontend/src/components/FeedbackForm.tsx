import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { useI18n } from '../i18n';
import { Button, ErrorBox, Notice, Select } from './ui';

export function FeedbackForm({ serviceId }: { serviceId?: string }) {
  const { t } = useI18n();
  const [type, setType] = useState('inaccurate_info');
  const [message, setMessage] = useState('');
  const m = useMutation({ mutationFn: () => api('/api/feedback', { method: 'POST', body: { service_id: serviceId, report_type: type, message } }) });
  const submit = (e: FormEvent) => { e.preventDefault(); m.mutate(); };
  if (m.isSuccess) return <Notice tone="good">{t('feedback.thanks')}</Notice>;
  return (
    <form onSubmit={submit} className="space-y-3">
      <Select label={t('feedback.type')} value={type} onChange={(e) => setType(e.target.value)}>
        <option value="inaccurate_info">Inaccurate information</option><option value="broken_link">Broken link</option>
        <option value="outdated">Outdated</option><option value="suggestion">Suggestion</option><option value="other">Other</option>
      </Select>
      <div className="space-y-1">
        <label htmlFor="fb-msg" className="block text-sm font-medium">{t('feedback.message')}</label>
        <textarea id="fb-msg" required minLength={5} maxLength={2000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="w-full  border border-line-strong p-3" />
        <p className="text-xs text-grey-strong">Please do not include OTPs, passwords or ID numbers.</p>
      </div>
      {m.error && <ErrorBox error={m.error} />}
      <Button type="submit" disabled={m.isPending || message.trim().length < 5}>{t('feedback.send')}</Button>
    </form>
  );
}
