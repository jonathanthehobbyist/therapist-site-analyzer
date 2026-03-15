'use client';

import { useState, useEffect } from 'react';

const ALL_COLORS = [
  { name: 'Charcoal', hex: '#2A2A2A' },
  { name: 'Charcoal Light', hex: '#4A4A4A' },
  { name: 'Gray 950', hex: '#030712' },
  { name: 'Gray 900', hex: '#111827' },
  { name: 'Gray 850', hex: '#182031' },
  { name: 'Gray 800', hex: '#1F2937' },
  { name: 'Gray 700', hex: '#374151' },
  { name: 'Gray 600', hex: '#4B5563' },
  { name: 'Gray 500', hex: '#6B7280' },
  { name: 'Gray 400', hex: '#9CA3AF' },
  { name: 'Gray 300', hex: '#D1D5DB' },
  { name: 'Gray 200', hex: '#E5E7EB' },
  { name: 'Gray 100', hex: '#F3F4F6' },
  { name: 'Gray 50', hex: '#F9FAFB' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Rose', hex: '#E53E3E' },
  { name: 'Rose Dark', hex: '#C53030' },
  { name: 'Rose Light', hex: '#FEB2B2' },
  { name: 'Orange', hex: '#E8852E' },
  { name: 'Gold', hex: '#EDA125' },
  { name: 'Gold Light', hex: '#F8D48C' },
  { name: 'Sage', hex: '#6DB872' },
  { name: 'Sage Dark', hex: '#4E9453' },
  { name: 'Sage Light', hex: '#B5D9B7' },
  { name: 'Sky', hex: '#B8D4E3' },
  { name: 'Sky Light', hex: '#D6E8F0' },
  { name: 'Background', hex: '#F2F2F3' },
];

const THRESHOLD_GROUPS = [
  {
    label: 'Performance Scores',
    description: 'SEO Hygiene, Page Speed, and general score displays',
    items: [
      { key: 'threshold_score_good', label: 'Good (green)', description: 'Score at or above this is green', unit: '' },
      { key: 'threshold_score_warn', label: 'Warning (orange)', description: 'Score at or above this is orange, below is red', unit: '' },
      { key: 'threshold_seo_warn', label: 'SEO Warning', description: 'SEO score below this is red', unit: '' },
    ],
  },
  {
    label: 'Visitor Drop-off',
    description: 'Estimated bounce rate on Page Speed cards',
    items: [
      { key: 'threshold_dropoff_good', label: 'Good (green)', description: 'Drop-off at or below this is green', unit: '%' },
      { key: 'threshold_dropoff_warn', label: 'Warning (orange)', description: 'Drop-off at or below this is orange, above is red', unit: '%' },
    ],
  },
  {
    label: 'Keyword Difficulty',
    description: 'Color coding for keyword difficulty scores',
    items: [
      { key: 'threshold_kw_difficulty_hard', label: 'Hard (red)', description: 'Difficulty at or above this is red', unit: '' },
      { key: 'threshold_kw_difficulty_medium', label: 'Medium (orange)', description: 'Difficulty at or above this is orange', unit: '' },
    ],
  },
  {
    label: 'Core Web Vitals',
    description: 'Google Lighthouse metric thresholds',
    items: [
      { key: 'threshold_lcp_good', label: 'LCP Good', description: 'Largest Contentful Paint', unit: 'ms' },
      { key: 'threshold_lcp_warn', label: 'LCP Warning', description: '', unit: 'ms' },
      { key: 'threshold_fcp_good', label: 'FCP Good', description: 'First Contentful Paint', unit: 'ms' },
      { key: 'threshold_fcp_warn', label: 'FCP Warning', description: '', unit: 'ms' },
      { key: 'threshold_cls_good', label: 'CLS Good', description: 'Cumulative Layout Shift', unit: '' },
      { key: 'threshold_cls_warn', label: 'CLS Warning', description: '', unit: '' },
      { key: 'threshold_tbt_good', label: 'TBT Good', description: 'Total Blocking Time', unit: 'ms' },
      { key: 'threshold_tbt_warn', label: 'TBT Warning', description: '', unit: 'ms' },
      { key: 'threshold_si_good', label: 'SI Good', description: 'Speed Index', unit: 'ms' },
      { key: 'threshold_si_warn', label: 'SI Warning', description: '', unit: 'ms' },
      { key: 'threshold_fid_good', label: 'FID/INP Good', description: 'First Input Delay', unit: 'ms' },
      { key: 'threshold_fid_warn', label: 'FID/INP Warning', description: '', unit: 'ms' },
    ],
  },
];

const THEME_ROLES = [
  { key: 'theme_text_primary', label: 'Primary Text', description: 'Headings, bold labels, nav items' },
  { key: 'theme_text_secondary', label: 'Secondary Text', description: 'Body text, descriptions, subtitles' },
  { key: 'theme_btn_primary_bg', label: 'Primary Button Background', description: 'Save, submit, main CTA buttons' },
  { key: 'theme_btn_primary_text', label: 'Primary Button Text', description: 'Text color on primary buttons' },
  { key: 'theme_btn_secondary_bg', label: 'Secondary Button Background', description: 'Show more, cancel, secondary actions' },
  { key: 'theme_btn_secondary_text', label: 'Secondary Button Text', description: 'Text color on secondary buttons' },
];

const GRAY_COLORS = [
  { name: 'Gray 950', hex: '#030712', usage: 'Near-black text, strongest emphasis', tailwind: 'text-gray-950' },
  { name: 'Gray 900', hex: '#111827', usage: 'Very dark text, high contrast headings', tailwind: 'text-gray-900' },
  { name: 'Gray 850', hex: '#182031', usage: 'Dark text, between 800 and 900', tailwind: 'text-gray-850' },
  { name: 'Gray 50', hex: '#F9FAFB', usage: 'Subtle backgrounds, table stripes', tailwind: 'bg-gray-50' },
  { name: 'Gray 100', hex: '#F3F4F6', usage: 'Borders, dividers, tag backgrounds', tailwind: 'bg-gray-100 / border-gray-100' },
  { name: 'Gray 200', hex: '#E5E7EB', usage: 'Input borders, card borders, hover backgrounds', tailwind: 'bg-gray-200 / border-gray-200' },
  { name: 'Gray 300', hex: '#D1D5DB', usage: 'Toggle off state', tailwind: 'bg-gray-300' },
  { name: 'Gray 400', hex: '#9CA3AF', usage: 'Placeholder text, muted labels, timestamps', tailwind: 'text-gray-400' },
  { name: 'Gray 500', hex: '#6B7280', usage: 'Secondary text, table headers, subtitles', tailwind: 'text-gray-500' },
  { name: 'Gray 600', hex: '#4B5563', usage: 'Body text, descriptions, explanations', tailwind: 'text-gray-600' },
  { name: 'Gray 700', hex: '#374151', usage: 'Form labels, stronger body text', tailwind: 'text-gray-700' },
  { name: 'Gray 800', hex: '#1F2937', usage: 'Hover states on dark text', tailwind: 'text-gray-800' },
];

const BRAND_COLORS = [
  { name: 'Background', variable: '--color-brand-bg', hex: '#F2F2F3', tailwind: 'bg-brand-bg' },
  { name: 'Cream', variable: '--color-brand-cream', hex: '#F5EDE4', tailwind: 'bg-brand-cream' },
  { name: 'Cream Dark', variable: '--color-brand-cream-dark', hex: '#EDE0D3', tailwind: 'bg-brand-cream-dark' },
  { name: 'Rose', variable: '--color-brand-rose', hex: '#E53E3E', tailwind: 'bg-brand-rose' },
  { name: 'Rose Light', variable: '--color-brand-rose-light', hex: '#FEB2B2', tailwind: 'bg-brand-rose-light' },
  { name: 'Rose Dark', variable: '--color-brand-rose-dark', hex: '#C53030', tailwind: 'bg-brand-rose-dark' },
  { name: 'Red', variable: '--color-brand-red', hex: '#E53E3E', tailwind: 'bg-brand-red' },
  { name: 'Orange', variable: '--color-brand-orange', hex: '#E8852E', tailwind: 'bg-brand-orange' },
  { name: 'Sky', variable: '--color-brand-sky', hex: '#B8D4E3', tailwind: 'bg-brand-sky' },
  { name: 'Sky Light', variable: '--color-brand-sky-light', hex: '#D6E8F0', tailwind: 'bg-brand-sky-light' },
  { name: 'Sage', variable: '--color-brand-sage', hex: '#6DB872', tailwind: 'bg-brand-sage' },
  { name: 'Sage Light', variable: '--color-brand-sage-light', hex: '#B5D9B7', tailwind: 'bg-brand-sage-light' },
  { name: 'Sage Dark', variable: '--color-brand-sage-dark', hex: '#4E9453', tailwind: 'bg-brand-sage-dark' },
  { name: 'Gold', variable: '--color-brand-gold', hex: '#EDA125', tailwind: 'bg-brand-gold' },
  { name: 'Gold Light', variable: '--color-brand-gold-light', hex: '#F8D48C', tailwind: 'bg-brand-gold-light' },
  { name: 'Charcoal', variable: '--color-brand-charcoal', hex: '#2A2A2A', tailwind: 'bg-brand-charcoal' },
  { name: 'Charcoal Light', variable: '--color-brand-charcoal-light', hex: '#4A4A4A', tailwind: 'bg-brand-charcoal-light' },
];

function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedName = ALL_COLORS.find(c => c.hex === value)?.name || '';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
      >
        <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: value }} />
        <span className="text-xs text-gray-600">{selectedName && <span className="font-medium mr-1">{selectedName}</span>}<span className="font-mono">{value}</span></span>
        <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-30 w-72">
            <div className="grid grid-cols-1 gap-0.5 max-h-72 overflow-y-auto">
              {ALL_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => { onChange(c.hex); setOpen(false); }}
                  className={`flex items-center gap-3 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    value === c.hex ? 'bg-brand-sky/10' : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded border-2 shrink-0 ${
                      value === c.hex ? 'border-brand-sky' : 'border-gray-200'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="text-xs font-medium text-brand-charcoal">{c.name}</span>
                  <span className="text-xs font-mono text-gray-400 ml-auto">{c.hex}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const TEMPLATE_SECTIONS = [
  { key: 'seo', label: 'SEO', titleKey: 'template_seo_title', descKey: 'template_seo_description' },
  { key: 'pagespeed', label: 'Page Speed', titleKey: 'template_pagespeed_title', descKey: 'template_pagespeed_description' },
  { key: 'hipaa', label: 'HIPAA', titleKey: 'template_hipaa_title', descKey: 'template_hipaa_description' },
  { key: 'keywords', label: 'Keywords', titleKey: 'template_keywords_title', descKey: 'template_keywords_description' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setSettings);
  }, []);

  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);

  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);

  async function saveThresholds() {
    setThresholdSaving(true);
    const updates: Record<string, string> = {};
    for (const group of THRESHOLD_GROUPS) {
      for (const item of group.items) {
        if (settings[item.key]) updates[item.key] = settings[item.key];
      }
    }
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setThresholdSaving(false);
    setThresholdSaved(true);
    setTimeout(() => setThresholdSaved(false), 2000);
  }

  async function saveTemplates() {
    setTemplateSaving(true);
    const updates: Record<string, string> = {};
    for (const section of TEMPLATE_SECTIONS) {
      updates[section.titleKey] = settings[section.titleKey] || '';
      updates[section.descKey] = settings[section.descKey] || '';
    }
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setTemplateSaving(false);
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2000);
  }

  async function saveTheme() {
    setSaving(true);
    const themeKeys = THEME_ROLES.map(r => r.key);
    const updates: Record<string, string> = {};
    for (const key of themeKeys) {
      if (settings[key]) updates[key] = settings[key];
    }
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-brand-charcoal-light mb-8">Settings</h1>

      {/* Score Thresholds */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-charcoal">Score Thresholds</h2>
            <p className="text-xs text-gray-400 mt-0.5">Configure when scores turn red, orange, or green</p>
          </div>
          <button
            onClick={saveThresholds}
            disabled={thresholdSaving}
            className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors disabled:opacity-50 cursor-pointer"
          >
            {thresholdSaved ? 'Saved!' : thresholdSaving ? 'Saving...' : 'Save Thresholds'}
          </button>
        </div>
        <div className="p-5 space-y-8">
          {THRESHOLD_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-sm font-semibold text-brand-charcoal mb-1">{group.label}</h3>
              <p className="text-xs text-gray-400 mb-4">{group.description}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {group.items.map((item) => (
                  <div key={item.key}>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">{item.label}</label>
                    {item.description && <p className="text-[10px] text-gray-400 mb-1">{item.description}</p>}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={item.key.includes('cls') ? '0.01' : '1'}
                        value={settings[item.key] || ''}
                        onChange={(e) => setSettings(prev => ({ ...prev, [item.key]: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-sky"
                      />
                      {item.unit && <span className="text-xs text-gray-400 shrink-0">{item.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Templates */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-charcoal">Custom Templates</h2>
            <p className="text-xs text-gray-400 mt-0.5">Starting text when you switch a section to &ldquo;Custom&rdquo; mode on an analysis</p>
          </div>
          <button
            onClick={saveTemplates}
            disabled={templateSaving}
            className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors disabled:opacity-50 cursor-pointer"
          >
            {templateSaved ? 'Saved!' : templateSaving ? 'Saving...' : 'Save Templates'}
          </button>
        </div>
        <div className="p-5 space-y-6">
          {TEMPLATE_SECTIONS.map((section) => (
            <div key={section.key}>
              <h3 className="text-sm font-semibold text-brand-charcoal mb-3">{section.label}</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Title</label>
                  <input
                    type="text"
                    value={settings[section.titleKey] || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, [section.titleKey]: e.target.value }))}
                    placeholder={`e.g. Your ${section.label} Results`}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-sky"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
                  <textarea
                    value={settings[section.descKey] || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, [section.descKey]: e.target.value }))}
                    rows={3}
                    placeholder="Template paragraph that pre-fills when you switch to Custom mode..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-sky resize-y"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme Picker */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-charcoal">Theme</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choose colors for text and buttons across the app</p>
          </div>
          <button
            onClick={saveTheme}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium bg-brand-charcoal-light text-white rounded-md hover:bg-brand-charcoal transition-colors disabled:opacity-50 cursor-pointer"
          >
            {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Theme'}
          </button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {THEME_ROLES.map((role) => (
              <div key={role.key}>
                <p className="text-sm font-medium text-brand-charcoal mb-1">{role.label}</p>
                <p className="text-xs text-gray-400 mb-2">{role.description}</p>
                <ColorPicker
                  value={settings[role.key] || '#000000'}
                  onChange={(hex) => setSettings(prev => ({ ...prev, [role.key]: hex }))}
                />
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-4">Preview</p>
            <div className="bg-brand-bg rounded-lg p-6 space-y-3">
              <p className="text-lg font-bold" style={{ color: settings.theme_text_primary || '#2A2A2A' }}>
                Primary heading text
              </p>
              <p className="text-sm" style={{ color: settings.theme_text_secondary || '#6B7280' }}>
                Secondary body text — descriptions, subtitles, and explanations use this color.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  className="px-4 py-2 text-xs font-medium rounded-md transition-colors"
                  style={{
                    backgroundColor: settings.theme_btn_primary_bg || '#4A4A4A',
                    color: settings.theme_btn_primary_text || '#FFFFFF',
                  }}
                >
                  Primary Button
                </button>
                <button
                  className="px-4 py-2 text-xs font-medium rounded-md transition-colors"
                  style={{
                    backgroundColor: settings.theme_btn_secondary_bg || '#F3F4F6',
                    color: settings.theme_btn_secondary_text || '#4A4A4A',
                  }}
                >
                  Secondary Button
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Brand Colors */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-brand-charcoal">Brand Colors</h2>
          <p className="text-xs text-gray-400 mt-0.5">{BRAND_COLORS.length} colors defined in globals.css</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Swatch</th>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Name</th>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Hex</th>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">CSS Variable</th>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Tailwind</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {BRAND_COLORS.map((color) => (
              <tr key={color.variable} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4">
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-200"
                    style={{ backgroundColor: color.hex }}
                  />
                </td>
                <td className="px-5 py-4 font-medium text-brand-charcoal">{color.name}</td>
                <td className="px-5 py-4 text-gray-500 font-mono text-xs">{color.hex}</td>
                <td className="px-5 py-4 text-gray-500 font-mono text-xs">{color.variable}</td>
                <td className="px-5 py-4 text-gray-500 font-mono text-xs">{color.tailwind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gray Scale */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mt-8">
        <div className="px-5 py-3.5 bg-gray-50 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-brand-charcoal">Gray Scale</h2>
          <p className="text-xs text-gray-400 mt-0.5">Tailwind grays used for text, borders, and backgrounds</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Swatch</th>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Name</th>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Hex</th>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Usage</th>
              <th className="text-left px-5 py-3.5 font-medium text-gray-500 text-xs">Tailwind</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {GRAY_COLORS.map((color) => (
              <tr key={color.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4">
                  <div
                    className="w-10 h-10 rounded-lg border border-gray-200"
                    style={{ backgroundColor: color.hex }}
                  />
                </td>
                <td className="px-5 py-4 font-medium text-brand-charcoal">{color.name}</td>
                <td className="px-5 py-4 text-gray-500 font-mono text-xs">{color.hex}</td>
                <td className="px-5 py-4 text-gray-500 text-xs">{color.usage}</td>
                <td className="px-5 py-4 text-gray-500 font-mono text-xs">{color.tailwind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
