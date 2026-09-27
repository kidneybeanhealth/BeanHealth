/**
 * feedbackLinks — where the feedback form lives
 *
 * One definition, read by the printed poster and by the dashboards' "Open form"
 * button, so the two can never disagree about the address.
 *
 * Always the permanent domain, never `window.location.origin`: a poster printed
 * from a Vercel preview link or localhost would otherwise carry a URL that is
 * replaced on the next push, and a laminated poster stays on a wall for a year.
 * Set VITE_PUBLIC_APP_URL to change it, e.g. for a hospital on its own domain.
 */
export const PUBLIC_APP_URL = String(import.meta.env.VITE_PUBLIC_APP_URL || 'https://beanhealth.in').replace(/\/+$/, '');

/**
 * `desk` marks the form as running on a clinic tablet that is handed from
 * patient to patient. It switches off the per-phone daily throttle — which would
 * otherwise swallow every response after the first — and tags the response so
 * the dashboards can tell a desk entry from a poster scan.
 */
export const feedbackUrl = (code: string, opts: { desk?: boolean } = {}): string =>
    `${PUBLIC_APP_URL}/f/${encodeURIComponent(code)}${opts.desk ? '?desk=1' : ''}`;
