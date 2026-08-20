import type { ReceptionPastRecordPatient } from '../../services/enterpriseReviewService';

export const formatPastDate = (value?: string | null): string => {
    if (!value) return '--';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

interface PastRecordsPrintOptions {
    records: ReceptionPastRecordPatient[];
    /** Reception passes the hospital; the doctor panel has only its own name. */
    orgLabel: string;
    filterLabel: string;
    /** Shown under the hospital name, e.g. the doctor whose list this is. */
    scopeLabel?: string | null;
    footerNote: string;
}

/**
 * The call-round worksheet.
 *
 * This is a working document, not a report: reception dials down it and writes
 * the outcome next to each name. The layout follows that, left to right —
 * who to call, when they are due, when they were last seen, then an empty
 * ruled box wide enough to actually write in.
 *
 * MR number sits under the name rather than in its own column. It is only ever
 * read together with the name, and giving it a column cost width that the
 * remarks box needed.
 *
 * Both dashboards render this. They previously held byte-identical copies of
 * the whole template, which is how the two sheets drifted apart before.
 */
export function buildPastRecordsPrintHtml({
    records,
    orgLabel,
    filterLabel,
    scopeLabel,
    footerNote,
}: PastRecordsPrintOptions): string {
    const generatedAt = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });

    const rowsHtml = records
        .map((patient, index) => {
            const relationLabel = patient.gender === 'F' ? 'W/o' : 'S/o';
            return `
                <tr>
                    <td class="num">${index + 1}</td>
                    <td>
                        <div class="pname">${escapeHtml(patient.name || '--')}</div>
                        <div class="pmr">${escapeHtml(patient.mr_number || '--')}</div>
                    </td>
                    <td class="date">${formatPastDate(patient.latestReviewDate)}</td>
                    <td class="date">${formatPastDate(patient.lastVisitAt)}</td>
                    <td class="age">${patient.age ?? '--'}</td>
                    <td class="rel">${relationLabel} ${escapeHtml(patient.father_husband_name || '--')}</td>
                    <td class="remarks"></td>
                </tr>
            `;
        })
        .join('');

    return `
        <!doctype html>
        <html>
        <head>
            <meta charset="utf-8" />
            <title>Past Records Print List</title>
            <style>
                * { box-sizing: border-box; }
                /* Declare the palette outright. The sheet opens in a popup that
                   follows the OS theme, and a dark-mode machine was rendering
                   near-black text on a near-black background before print. */
                :root { color-scheme: light; }
                html, body { background: #ffffff; }
                body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #1f2937; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
                .title { font-size: 20px; font-weight: 700; margin: 0; }
                .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
                .pill { display: inline-block; background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; margin-right: 8px; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; table-layout: fixed; }
                thead th { text-align: left; font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; background: #f9fafb; border: 1px solid #d1d5db; padding: 8px 6px; }
                tbody td { border: 1px solid #d1d5db; padding: 8px 6px; font-size: 12px; vertical-align: top; }

                /* Fixed widths: the remarks box must not be squeezed by a long name. */
                col.c-num     { width: 4%; }
                col.c-patient { width: 24%; }
                col.c-due     { width: 11%; }
                col.c-visit   { width: 11%; }
                col.c-age     { width: 6%; }
                col.c-rel     { width: 18%; }
                col.c-remarks { width: 26%; }

                .num { text-align: center; color: #6b7280; }
                .pname { font-weight: 700; font-size: 12.5px; line-height: 1.3; }
                .pmr { font-size: 11px; color: #4b5563; letter-spacing: 0.02em; margin-top: 2px; }
                .date { white-space: nowrap; font-size: 11.5px; }
                .age { text-align: center; }
                .rel { font-size: 11.5px; }

                /* Ruled, so handwriting has a line to sit on and two attempts fit. */
                .remarks {
                    background-image: repeating-linear-gradient(
                        to bottom,
                        transparent 0,
                        transparent 20px,
                        #e5e7eb 20px,
                        #e5e7eb 21px
                    );
                }
                tbody tr { height: 46px; page-break-inside: avoid; }
                .footer { margin-top: 14px; font-size: 11px; color: #6b7280; }

                @media print {
                    body { margin: 10mm; }
                    .no-print { display: none; }
                    /* Column headings repeat on every sheet — a page 3 with no
                       headings is a page someone writes in the wrong box. */
                    thead { display: table-header-group; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <h1 class="title">Past Records List</h1>
                    <p class="meta">${escapeHtml(orgLabel || 'Hospital')}</p>
                    ${scopeLabel ? `<p class="meta">${escapeHtml(scopeLabel)}</p>` : ''}
                    <p class="meta">Generated: ${generatedAt}</p>
                </div>
                <div>
                    <span class="pill">Filter: ${escapeHtml(filterLabel)}</span>
                    <span class="pill">Total: ${records.length}</span>
                </div>
            </div>

            <table>
                <colgroup>
                    <col class="c-num" />
                    <col class="c-patient" />
                    <col class="c-due" />
                    <col class="c-visit" />
                    <col class="c-age" />
                    <col class="c-rel" />
                    <col class="c-remarks" />
                </colgroup>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Patient / MR ID</th>
                        <th>Due Date</th>
                        <th>Last Visit</th>
                        <th>Age</th>
                        <th>S/o / W/o</th>
                        <th>Remarks</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <p class="footer">${escapeHtml(footerNote)}</p>

            <script>
                window.onload = function () {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;
}
