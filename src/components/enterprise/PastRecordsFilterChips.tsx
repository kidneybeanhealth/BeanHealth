/**
 * PastRecordsFilterChips — the Past Records filter row, for both dashboards
 *
 * Ten chips in one undifferentiated line read as ten equal choices, and they
 * are not. Seven of them narrow the SAME patient list by review state. Two open
 * a different document entirely, and one opens a register that has nothing to
 * do with reviews. Reception was clicking past the ones it wanted because
 * nothing on screen said they were different kinds of thing.
 *
 * So they are grouped, with a divider and a colour per group:
 *
 *   Follow-up   orange   narrows the list below
 *   Reports     sky      replaces the list with a report
 *   Registers   violet   replaces the list with a register
 *
 * Shared deliberately. Reception and the doctor dashboard are the same surface
 * for two roles, and this codebase has already paid for letting those two drift:
 * two independently-evolved copies of the patient card were merged in August,
 * and a dead third copy of the print sheet kept surfacing in greps afterwards.
 * Role differences belong in the `views` prop, not in a second copy of this row.
 */
import React from 'react';
import { getReviewFilterLabel, type PastRecordsView } from './PastRecordsPatientCard';

type GroupKey = 'followup' | 'reports' | 'registers';

const GROUP_OF: Record<string, GroupKey> = {
    all: 'followup',
    due_today: 'followup',
    due_tomorrow: 'followup',
    upcoming: 'followup',
    overdue: 'followup',
    review_completed: 'followup',
    followup_stopped: 'followup',
    weekly_report: 'reports',
    calendar: 'reports',
    dialysis: 'registers',
};

const GROUP_ORDER: GroupKey[] = ['followup', 'reports', 'registers'];

const GROUP_LABEL: Record<GroupKey, string> = {
    followup: 'Follow-up',
    reports: 'Reports',
    registers: 'Registers',
};

/** Active / idle styling per group. Idle stays neutral so the row reads calm. */
const GROUP_STYLE: Record<GroupKey, { on: string; off: string; dot: string }> = {
    followup: {
        on: 'bg-orange-100 text-orange-700 border-orange-300',
        off: 'bg-white text-gray-600 border-gray-200 hover:border-orange-200',
        dot: 'bg-orange-400',
    },
    reports: {
        on: 'bg-sky-100 text-sky-800 border-sky-300',
        off: 'bg-white text-gray-600 border-gray-200 hover:border-sky-200',
        dot: 'bg-sky-400',
    },
    registers: {
        on: 'bg-violet-100 text-violet-800 border-violet-300',
        off: 'bg-white text-gray-600 border-gray-200 hover:border-violet-200',
        dot: 'bg-violet-400',
    },
};

export interface PastRecordsFilterChipsProps {
    /** Views to offer, in the caller's preferred order within each group. */
    views: PastRecordsView[];
    value: PastRecordsView;
    onChange: (v: PastRecordsView) => void;
    /** Rendered at the end of the row, e.g. the review-date picker. */
    trailing?: React.ReactNode;
}

const PastRecordsFilterChips: React.FC<PastRecordsFilterChipsProps> = ({ views, value, onChange, trailing }) => {
    const grouped = GROUP_ORDER
        .map(g => ({ group: g, items: views.filter(v => (GROUP_OF[v] || 'followup') === g) }))
        .filter(g => g.items.length > 0);

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
            {grouped.map(({ group, items }, gi) => (
                <React.Fragment key={group}>
                    {gi > 0 && (
                        // A real separator rather than more whitespace: the point is
                        // that what follows is a different KIND of thing, not just
                        // another filter.
                        <span className="hidden sm:inline-block w-px h-6 bg-gray-200 mx-1" aria-hidden="true" />
                    )}
                    <span className="inline-flex items-center gap-1.5 pr-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${GROUP_STYLE[group].dot}`} aria-hidden="true" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {GROUP_LABEL[group]}
                        </span>
                    </span>
                    {items.map(key => {
                        const style = GROUP_STYLE[GROUP_OF[key] || 'followup'];
                        const active = value === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => onChange(key)}
                                aria-pressed={active}
                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${active ? style.on : style.off}`}
                            >
                                {getReviewFilterLabel(key)}
                            </button>
                        );
                    })}
                </React.Fragment>
            ))}
            {trailing}
        </div>
    );
};

export default PastRecordsFilterChips;
