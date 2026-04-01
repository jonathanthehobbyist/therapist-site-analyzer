'use client';

import { useState } from 'react';

export default function IntakePage() {
  const [siteUrl, setSiteUrl] = useState('');
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/intake/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl, email, company: honeypot }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center gap-1 mb-6">
            <span className="w-3 h-3 rounded-full bg-brand-sage" />
            <span className="w-3 h-3 rounded-full bg-brand-sky" />
            <span className="w-3 h-3 rounded-full bg-brand-gold" />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-10">
            <div className="w-12 h-12 rounded-full bg-brand-sage-light flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-brand-sage-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-brand-charcoal mb-2">We got your submission!</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              We&apos;ll review your website and send your free analysis to <span className="font-medium text-brand-charcoal">{email}</span> once it&apos;s ready.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-1 mb-4">
            <span className="w-3 h-3 rounded-full bg-brand-sage" />
            <span className="w-3 h-3 rounded-full bg-brand-sky" />
            <span className="w-3 h-3 rounded-full bg-brand-gold" />
          </div>
          <h1 className="text-2xl font-bold text-brand-charcoal">Practice Persona</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Get a free website analysis for your therapy practice.
            <br />
            We&apos;ll review your SEO, page speed, and HIPAA compliance.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-brand-charcoal mb-1.5">Your website URL</label>
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="e.g. www.mytherapypractice.com"
              required
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-sage focus:border-brand-sage outline-none transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-charcoal mb-1.5">Your email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-brand-sage focus:border-brand-sage outline-none transition-shadow"
            />
          </div>

          {/* Honeypot — invisible to users, bots fill it */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <input
              type="text"
              name="company"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="bg-brand-rose-light/30 text-brand-rose-dark text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-sage-dark text-white font-medium py-3 rounded-lg hover:bg-brand-charcoal transition-colors text-sm disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Get My Free Analysis'}
          </button>

          <p className="text-xs text-gray-400 text-center leading-relaxed">
            We&apos;ll never share your email. Your analysis is completely free.
          </p>
        </form>
      </div>
    </div>
  );
}
