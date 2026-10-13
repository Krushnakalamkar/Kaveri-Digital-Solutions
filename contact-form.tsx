'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { UploadField } from '@/components/admin/upload-field';
import { trackEvent } from '@/lib/analytics';

type Status = 'idle' | 'sending' | 'success' | 'error';
const budgets = ['', 'Not sure yet', 'Under 25,000 INR', '25,000 – 75,000 INR', '75,000 – 2,00,000 INR', 'Above 2,00,000 INR'];

export function ContactForm({ services = [] }: { services?: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const hasTrackedFormStart = useRef(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');

  function trackFormStart() {
    if (hasTrackedFormStart.current) return;
    hasTrackedFormStart.current = true;
    trackEvent('portfolio_enquiry_started');
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    if (e.defaultPrevented) return;
    e.preventDefault();
    if (status === 'sending') return;
    const fd = new FormData(e.currentTarget);
    const body: Record<string, string> = {};
    for (const key of ['name', 'email', 'phone', 'service', 'projectType', 'budget', 'message', 'attachmentUrl', 'website']) {
      const v = String(fd.get(key) ?? '').trim();
      if (v || key === 'website') body[key] = v;
    }
    setStatus('sending'); setError('');
    try {
      const res = await fetch('/portfolio-api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success === true) {
        trackEvent('portfolio_enquiry_submitted');
        setStatus('success');
        formRef.current?.reset();
        return;
      }
      setError(typeof data.error === 'string' ? data.error : 'Your message could not be sent. Please try again.');
      setStatus('error');
    } catch {
      setError('Network problem. Please check your connection and try again.');
      setStatus('error');
    }
  }

  if (status === 'success') return <div className="contact-success" role="status">
    <CheckCircle2 size={26} strokeWidth={1.5} aria-hidden="true" />
    <h2>Message received.</h2><p>Your enquiry was emailed to kalamkarkrushna007@gmail.com. I will reply to the email address you provided.</p>
    <button type="button" className="button-light focus-ring" onClick={() => setStatus('idle')}>Send another message</button>
  </div>;

  return <form ref={formRef} className="contact-form" onSubmit={submit} onFocusCapture={trackFormStart} onPointerDownCapture={trackFormStart} noValidate={false}>
    <div className="admin-field"><label htmlFor="c-name">Your name</label><input id="c-name" name="name" autoComplete="name" minLength={2} maxLength={120} required /></div>
    <div className="admin-field"><label htmlFor="c-email">Email address</label><input id="c-email" type="email" name="email" autoComplete="email" required /></div>
    <div className="contact-two">
      <div className="admin-field"><label htmlFor="c-phone">Phone (optional)</label><input id="c-phone" type="tel" name="phone" autoComplete="tel" /></div>
      <div className="admin-field"><label htmlFor="c-budget">Budget (optional)</label><select id="c-budget" name="budget">{budgets.map(b => <option key={b} value={b}>{b || 'Select a range'}</option>)}</select></div>
    </div>
    <div className="contact-two">
      <div className="admin-field"><label htmlFor="c-service">Service (optional)</label><select id="c-service" name="service"><option value="">Select a service</option>{services.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
      <div className="admin-field"><label htmlFor="c-type">Project type (optional)</label><input id="c-type" name="projectType" /></div>
    </div>
    <div className="admin-field"><label htmlFor="c-message">A little about your project</label><textarea id="c-message" name="message" rows={5} minLength={10} maxLength={10000} required /></div>
    <UploadField name="attachmentUrl" kind="attachment" label="Attachment (optional)" />
    <div className="hp-field" aria-hidden="true"><label htmlFor="c-website">Website</label><input id="c-website" name="website" tabIndex={-1} autoComplete="off" /></div>
    {status === 'error' ? <p className="contact-error" role="alert"><AlertCircle size={15} strokeWidth={1.75} aria-hidden="true" /> {error}</p> : null}
    <button className="button-primary focus-ring" type="submit" disabled={status === 'sending'} aria-busy={status === 'sending'}>
      {status === 'sending' ? <>Sending <Loader2 className="spin" size={16} strokeWidth={1.75} aria-hidden="true" /></> : <>Send enquiry <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" /></>}
    </button>
  </form>;
}
