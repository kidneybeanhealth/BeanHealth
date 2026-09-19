/**
 * dialysisRegisterPrint — the printable dialysis register
 *
 * Kept in a .ts file, not the panel, for the same reason the Past Records sheet
 * was extracted: a print builder living in a .tsx drags React and react-hot-toast
 * in behind it for a document that needs neither.
 *
 * The template declares its own palette. It opens in a popup that follows the OS
 * theme, and the Past Records sheet once rendered near-black on near-black in the
 * preview a user checks before printing.
 */
import type { DialysisPatientRow } from '../../services/dialysisRegisterService';

export const escapeHtml = (value: unknown): string =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const fmtDay = (iso: string | null): string => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtShort = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

export interface BuildDialysisRegisterHtmlParams {
    patients: DialysisPatientRow[];
    orgLabel: string;
    periodLabel: string;
    totalSessions: number;
    totalPatients: number;
    /** Print each patient's session dates under their row. */
    includeDates: boolean;
}

export function buildDialysisRegisterHtml(params: BuildDialysisRegisterHtmlParams): string {
    const { patients, orgLabel, periodLabel, totalSessions, totalPatients, includeDates } = params;

    const rows = patients.map((p, i) => {
        const dates = includeDates && p.sessions.length > 0
            ? `<tr class="dates"><td></td><td colspan="5">${p.sessions
                .slice()
                .reverse()
                .map(s => `<span class="d${s.status === 'cancelled' ? ' cx' : ''}">${escapeHtml(fmtShort(s.createdAt))}</span>`)
                .join('')}</td></tr>`
            : '';
        return `
            <tr>
                <td class="num">${i + 1}</td>
                <td>
                    <div class="nm">${escapeHtml(p.name)}${p.isDeceased ? ' <span class="dec">deceased</span>' : ''}</div>
                    <div class="mr">${escapeHtml(p.mrNumber || '—')}</div>
                </td>
                <td class="ct">${p.sessionCount}</td>
                <td class="ct">${p.dayCount}</td>
                <td>${escapeHtml(fmtDay(p.firstSessionAt))}</td>
                <td>${escapeHtml(fmtDay(p.lastSessionAt))}</td>
            </tr>${dates}`;
    }).join('');

    return `<!doctype html>
<html><head><meta charset="utf-8" />
<title>Dialysis Register — ${escapeHtml(periodLabel)}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  :root { color-scheme: only light; }
  html, body { background: #ffffff; color: #111827; }
  body { font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 12px; margin: 0; }
  header { border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 12px; }
  h1 { font-size: 17px; margin: 0 0 2px; letter-spacing: .2px; }
  .sub { font-size: 12px; color: #4b5563; }
  .totals { margin: 10px 0 12px; display: flex; gap: 22px; font-size: 12px; }
  .totals b { font-size: 15px; display: block; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .6px;
       color: #374151; border-bottom: 1px solid #9ca3af; padding: 6px 6px; }
  td { padding: 7px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .num, .ct { text-align: center; }
  .ct { font-weight: 700; }
  .nm { font-weight: 600; }
  .mr { font-size: 10.5px; color: #6b7280; margin-top: 1px; }
  .dec { font-size: 9px; color: #b91c1c; font-weight: 700; text-transform: uppercase; }
  tr.dates td { border-bottom: 1px solid #e5e7eb; padding-top: 0; }
  .d { display: inline-block; font-size: 10px; color: #374151; border: 1px solid #d1d5db;
       border-radius: 3px; padding: 1px 5px; margin: 0 4px 3px 0; }
  .d.cx { color: #9ca3af; text-decoration: line-through; }
  footer { margin-top: 14px; font-size: 10px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 6px; }
</style></head>
<body>
  <header>
    <h1>Dialysis Register</h1>
    <div class="sub">${escapeHtml(orgLabel)} &middot; ${escapeHtml(periodLabel)}</div>
  </header>
  <div class="totals">
    <div><b>${totalPatients}</b> patients</div>
    <div><b>${totalSessions}</b> sessions</div>
  </div>
  <table>
    <colgroup>
      <col style="width:6%" /><col style="width:34%" /><col style="width:12%" />
      <col style="width:12%" /><col style="width:18%" /><col style="width:18%" />
    </colgroup>
    <thead><tr>
      <th>#</th><th>Patient / MR ID</th><th>Sessions</th><th>Days</th><th>First</th><th>Last</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <footer>
    Printed ${escapeHtml(new Date().toLocaleString('en-IN'))} from BeanHealth.
    One session is one dialysis prescription; a struck-through date was superseded at the pharmacy but the patient still attended.
  </footer>
  <script>window.onload = function () { window.print(); };</script>
</body></html>`;
}
