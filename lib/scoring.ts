import { SeoComparisonRow } from './seo-comparison';
import { HipaaFinding } from './hipaa';

/**
 * SEO Comparison score: percentage of rows that pass or warn.
 * Pass = full points, Warning = half points, Fail = 0.
 */
export function scoreSEOComparison(rows: SeoComparisonRow[]): number {
  if (rows.length === 0) return 0;
  const total = rows.length;
  const points = rows.reduce((sum, row) => {
    if (row.status === 'pass') return sum + 1;
    if (row.status === 'warning') return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((points / total) * 100);
}

/**
 * SEO Hygiene score: calculated in seo-hygiene.ts directly (weighted deductions).
 * This is a passthrough for consistency.
 */
export function scoreSEOHygiene(score: number): number {
  return score;
}

/**
 * HIPAA risk level from findings.
 */
export function scoreHIPAA(
  findings: HipaaFinding[]
): 'Low' | 'Moderate' | 'High' | 'Critical' {
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;

  if (highCount >= 3) return 'Critical';
  if (highCount >= 1) return 'High';
  if (mediumCount >= 2) return 'Moderate';
  return 'Low';
}

/**
 * Letter grade from numeric score.
 */
export function letterGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
