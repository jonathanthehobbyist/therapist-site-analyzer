'use client';

import { useEffect, useRef } from 'react';

interface SectionEntry {
  section: string;
  durationMs: number;
  viewOrder: number;
}

export function useShareAnalytics(analysisId: string | null, activeSection: string) {
  const pageViewIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>('');
  const startTimeRef = useRef<number>(Date.now());
  const sectionStartRef = useRef<number>(Date.now());
  const currentSectionRef = useRef<string>(activeSection);
  const sectionsRef = useRef<SectionEntry[]>([]);
  const orderRef = useRef<number>(1);
  const sentEndRef = useRef<boolean>(false);

  // Initialize session and send pageview
  useEffect(() => {
    if (!analysisId) return;

    sessionIdRef.current = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
    startTimeRef.current = Date.now();
    sectionStartRef.current = Date.now();
    currentSectionRef.current = activeSection;
    sectionsRef.current = [];
    orderRef.current = 1;
    sentEndRef.current = false;

    fetch(`/api/share/${analysisId}/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'pageview',
        sessionId: sessionIdRef.current,
        referrer: document.referrer || null,
        deviceType: window.innerWidth < 768 ? 'mobile' : 'desktop',
        userAgent: navigator.userAgent,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        pageViewIdRef.current = data.pageViewId;
      })
      .catch(() => {});

    // End handler
    function sendEnd() {
      if (sentEndRef.current || !pageViewIdRef.current) return;
      sentEndRef.current = true;

      // Finalize current section
      const now = Date.now();
      sectionsRef.current.push({
        section: currentSectionRef.current,
        durationMs: now - sectionStartRef.current,
        viewOrder: orderRef.current,
      });

      const payload = JSON.stringify({
        action: 'end',
        pageViewId: pageViewIdRef.current,
        totalDurationMs: now - startTimeRef.current,
        sections: sectionsRef.current,
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          `/api/share/${analysisId}/analytics`,
          new Blob([payload], { type: 'application/json' })
        );
      } else {
        fetch(`/api/share/${analysisId}/analytics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') sendEnd();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', sendEnd);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', sendEnd);
      sendEnd();
    };
  }, [analysisId]);

  // Track section changes
  useEffect(() => {
    if (!analysisId || activeSection === currentSectionRef.current) return;

    const now = Date.now();
    sectionsRef.current.push({
      section: currentSectionRef.current,
      durationMs: now - sectionStartRef.current,
      viewOrder: orderRef.current,
    });
    orderRef.current++;
    currentSectionRef.current = activeSection;
    sectionStartRef.current = now;
  }, [analysisId, activeSection]);
}
