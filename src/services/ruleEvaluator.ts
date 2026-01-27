/**
 * JSON-Driven Rule Evaluator
 * 
 * Deterministic evaluation of alert rules against patient data.
 * Supports operators: gt, lt, gte, lte, eq, ne, pct_drop, pct_rise, 
 * abs_change, no_recent_data, med_in_list, message_unacknowledged, and, or
 * 
 * NO ML, NO INFERENCE, NO GUESSING - Pure deterministic if-else logic
 */

// =============================================================================
// TYPES
// =============================================================================

export type RuleOperator =
    | 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne'       // Comparison
    | 'pct_drop' | 'pct_rise' | 'abs_change'          // Trend
    | 'no_recent_data'                                 // Data presence
    | 'med_in_list'                                    // Medication check
    | 'message_unacknowledged'                         // Message state
    | 'and' | 'or';                                    // Compound

export interface RuleJSON {
    operator: RuleOperator;
    field?: string;                 // e.g., 'labs.egfr', 'vitals.bp_systolic'
    value?: number | string | string[];
    within_days?: number;           // For trend/time-based operators
    children?: RuleJSON[];          // For 'and'/'or' compound rules
}

export interface RuleEvaluationResult {
    matched: boolean;
    reason: string;
    matchedValue?: any;             // The actual value that triggered the match
    operator: RuleOperator;
    field?: string;
}

// Patient data context for evaluation
export interface PatientDataContext {
    // Lab results: { testType: { values: [{date, value}], latest: value } }
    labs: Record<string, {
        values: { date: string; value: number }[];
        latest?: number;
        latestDate?: string;
    }>;

    // Vitals
    vitals: {
        bp_systolic?: number;
        bp_diastolic?: number;
        heart_rate?: number;
        weight?: number;
        temperature?: number;
    };

    // Active medications (lowercase names for matching)
    medications: string[];

    // Patient messages
    messages: {
        text: string;
        isUrgent: boolean;
        isRead: boolean;
        timestamp: string;
    }[];

    // Current timestamp for calculations
    now: Date;
}

// =============================================================================
// FIELD VALUE RESOLVER
// =============================================================================

/**
 * Resolves a field path like 'labs.egfr' or 'vitals.bp_systolic' to actual value
 */
export function resolveFieldValue(
    context: PatientDataContext,
    field: string
): { value: any; found: boolean } {
    const parts = field.split('.');

    if (parts[0] === 'labs' && parts.length >= 2) {
        const testType = parts[1];
        const labData = context.labs[testType];
        if (!labData) return { value: undefined, found: false };

        if (parts[2] === 'values') {
            return { value: labData.values, found: true };
        }
        // Default: return latest value
        return { value: labData.latest, found: labData.latest !== undefined };
    }

    if (parts[0] === 'vitals' && parts.length >= 2) {
        const vitalType = parts[1] as keyof typeof context.vitals;
        const value = context.vitals[vitalType];
        return { value, found: value !== undefined };
    }

    if (parts[0] === 'medications') {
        return { value: context.medications, found: true };
    }

    if (parts[0] === 'messages') {
        return { value: context.messages, found: true };
    }

    return { value: undefined, found: false };
}

// =============================================================================
// OPERATOR IMPLEMENTATIONS
// =============================================================================

/**
 * Comparison operators: gt, lt, gte, lte, eq, ne
 */
function evaluateComparison(
    operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne',
    actualValue: number | undefined,
    targetValue: number
): RuleEvaluationResult {
    if (actualValue === undefined) {
        return { matched: false, reason: 'No data available', operator };
    }

    let matched = false;
    switch (operator) {
        case 'gt': matched = actualValue > targetValue; break;
        case 'lt': matched = actualValue < targetValue; break;
        case 'gte': matched = actualValue >= targetValue; break;
        case 'lte': matched = actualValue <= targetValue; break;
        case 'eq': matched = actualValue === targetValue; break;
        case 'ne': matched = actualValue !== targetValue; break;
    }

    const opSymbols = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '=', ne: '!=' };
    return {
        matched,
        reason: matched
            ? `Value ${actualValue} ${opSymbols[operator]} ${targetValue}`
            : `Value ${actualValue} not ${opSymbols[operator]} ${targetValue}`,
        matchedValue: actualValue,
        operator
    };
}

/**
 * Percentage drop/rise operators: pct_drop, pct_rise
 */
function evaluatePercentChange(
    operator: 'pct_drop' | 'pct_rise',
    values: { date: string; value: number }[],
    threshold: number,
    withinDays: number,
    now: Date
): RuleEvaluationResult {
    if (!values || values.length < 2) {
        return {
            matched: false,
            reason: 'Insufficient data points for trend analysis',
            operator
        };
    }

    // Filter values within the time window
    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - withinDays);

    const recentValues = values.filter(v => new Date(v.date) >= cutoffDate);

    if (recentValues.length < 2) {
        return {
            matched: false,
            reason: `Less than 2 data points in last ${withinDays} days`,
            operator
        };
    }

    // Sort by date ascending
    recentValues.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const oldest = recentValues[0].value;
    const newest = recentValues[recentValues.length - 1].value;

    if (oldest === 0) {
        return { matched: false, reason: 'Cannot calculate % change from zero', operator };
    }

    const percentChange = ((newest - oldest) / oldest) * 100;

    if (operator === 'pct_drop') {
        const matched = percentChange <= -threshold;
        return {
            matched,
            reason: matched
                ? `Dropped ${Math.abs(percentChange).toFixed(1)}% (threshold: ${threshold}%)`
                : `Change ${percentChange.toFixed(1)}% (threshold: -${threshold}%)`,
            matchedValue: { oldest, newest, percentChange },
            operator
        };
    } else {
        const matched = percentChange >= threshold;
        return {
            matched,
            reason: matched
                ? `Increased ${percentChange.toFixed(1)}% (threshold: ${threshold}%)`
                : `Change ${percentChange.toFixed(1)}% (threshold: +${threshold}%)`,
            matchedValue: { oldest, newest, percentChange },
            operator
        };
    }
}

/**
 * Absolute change operator: abs_change
 */
function evaluateAbsChange(
    values: { date: string; value: number }[],
    threshold: number,
    withinDays: number,
    now: Date
): RuleEvaluationResult {
    if (!values || values.length < 2) {
        return {
            matched: false,
            reason: 'Insufficient data points for change analysis',
            operator: 'abs_change'
        };
    }

    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - withinDays);

    const recentValues = values.filter(v => new Date(v.date) >= cutoffDate);

    if (recentValues.length < 2) {
        return {
            matched: false,
            reason: `Less than 2 data points in last ${withinDays} days`,
            operator: 'abs_change'
        };
    }

    recentValues.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const oldest = recentValues[0].value;
    const newest = recentValues[recentValues.length - 1].value;
    const absChange = Math.abs(newest - oldest);

    const matched = absChange >= threshold;
    return {
        matched,
        reason: matched
            ? `Absolute change ${absChange.toFixed(2)} >= ${threshold}`
            : `Absolute change ${absChange.toFixed(2)} < ${threshold}`,
        matchedValue: { oldest, newest, absChange },
        operator: 'abs_change'
    };
}

/**
 * No recent data operator: no_recent_data
 */
function evaluateNoRecentData(
    values: { date: string; value: number }[],
    withinDays: number,
    now: Date
): RuleEvaluationResult {
    if (!values || values.length === 0) {
        return {
            matched: true,
            reason: `No data on record`,
            operator: 'no_recent_data'
        };
    }

    const cutoffDate = new Date(now);
    cutoffDate.setDate(cutoffDate.getDate() - withinDays);

    const recentValues = values.filter(v => new Date(v.date) >= cutoffDate);

    const matched = recentValues.length === 0;

    if (matched) {
        // Find the most recent date
        const sortedValues = [...values].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        const daysSince = Math.floor(
            (now.getTime() - new Date(sortedValues[0].date).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
            matched: true,
            reason: `No data in last ${withinDays} days (last: ${daysSince} days ago)`,
            matchedValue: { lastDate: sortedValues[0].date, daysSince },
            operator: 'no_recent_data'
        };
    }

    return {
        matched: false,
        reason: `Has ${recentValues.length} data point(s) in last ${withinDays} days`,
        operator: 'no_recent_data'
    };
}

/**
 * Medication in list operator: med_in_list
 */
function evaluateMedInList(
    medications: string[],
    targetMeds: string[]
): RuleEvaluationResult {
    if (!medications || medications.length === 0) {
        return {
            matched: false,
            reason: 'No active medications',
            operator: 'med_in_list'
        };
    }

    const normalizedMeds = medications.map(m => m.toLowerCase());
    const normalizedTargets = targetMeds.map(t => t.toLowerCase());

    const matchedMeds: string[] = [];

    for (const med of normalizedMeds) {
        for (const target of normalizedTargets) {
            // Partial match: "ibuprofen 400mg" matches "ibuprofen"
            if (med.includes(target)) {
                matchedMeds.push(medications[normalizedMeds.indexOf(med)]);
                break;
            }
        }
    }

    const matched = matchedMeds.length > 0;
    return {
        matched,
        reason: matched
            ? `Found: ${matchedMeds.join(', ')}`
            : `No match for: ${targetMeds.join(', ')}`,
        matchedValue: matchedMeds,
        operator: 'med_in_list'
    };
}

/**
 * Message unacknowledged operator: message_unacknowledged
 */
function evaluateMessageUnacknowledged(
    messages: { text: string; isUrgent: boolean; isRead: boolean; timestamp: string }[]
): RuleEvaluationResult {
    if (!messages || messages.length === 0) {
        return {
            matched: false,
            reason: 'No messages',
            operator: 'message_unacknowledged'
        };
    }

    // Find unread urgent messages
    const unreadUrgent = messages.filter(m => m.isUrgent && !m.isRead);

    if (unreadUrgent.length > 0) {
        return {
            matched: true,
            reason: `${unreadUrgent.length} unread urgent message(s)`,
            matchedValue: unreadUrgent.length,
            operator: 'message_unacknowledged'
        };
    }

    return {
        matched: false,
        reason: 'No unread urgent messages',
        operator: 'message_unacknowledged'
    };
}

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

/**
 * Evaluate a single rule against patient data context
 */
export function evaluateRule(
    rule: RuleJSON,
    context: PatientDataContext
): RuleEvaluationResult {
    const { operator, field, value, within_days, children } = rule;

    // Compound operators
    if (operator === 'and' && children) {
        const results = children.map(child => evaluateRule(child, context));
        const allMatched = results.every(r => r.matched);
        return {
            matched: allMatched,
            reason: allMatched
                ? `All ${results.length} conditions matched`
                : `${results.filter(r => !r.matched).length} condition(s) did not match`,
            matchedValue: results,
            operator: 'and'
        };
    }

    if (operator === 'or' && children) {
        const results = children.map(child => evaluateRule(child, context));
        const anyMatched = results.some(r => r.matched);
        return {
            matched: anyMatched,
            reason: anyMatched
                ? `${results.filter(r => r.matched).length} of ${results.length} conditions matched`
                : `None of ${results.length} conditions matched`,
            matchedValue: results,
            operator: 'or'
        };
    }

    // Comparison operators
    if (['gt', 'lt', 'gte', 'lte', 'eq', 'ne'].includes(operator)) {
        if (!field) return { matched: false, reason: 'Field required', operator };
        const { value: actualValue } = resolveFieldValue(context, field);
        const result = evaluateComparison(
            operator as 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'ne',
            actualValue as number,
            value as number
        );
        result.field = field;
        return result;
    }

    // Percentage change operators
    if (operator === 'pct_drop' || operator === 'pct_rise') {
        if (!field) return { matched: false, reason: 'Field required', operator };
        // Ensure we get the values array, not the latest single value
        let labField = field;
        if (!labField.endsWith('.values')) {
            labField = labField.replace('.latest', '') + '.values';
        }
        const { value: values } = resolveFieldValue(context, labField);
        const result = evaluatePercentChange(
            operator,
            values as { date: string; value: number }[],
            value as number,
            within_days || 30,
            context.now
        );
        result.field = field;
        return result;
    }

    // Absolute change operator
    if (operator === 'abs_change') {
        if (!field) return { matched: false, reason: 'Field required', operator };
        // Ensure we get the values array, not the latest single value
        let labField = field;
        if (!labField.endsWith('.values')) {
            labField = labField.replace('.latest', '') + '.values';
        }
        const { value: values } = resolveFieldValue(context, labField);
        const result = evaluateAbsChange(
            values as { date: string; value: number }[],
            value as number,
            within_days || 30,
            context.now
        );
        result.field = field;
        return result;
    }

    // No recent data operator
    if (operator === 'no_recent_data') {
        if (!field) return { matched: false, reason: 'Field required', operator };
        // Ensure we get the values array, not the latest single value
        let labField = field;
        if (!labField.endsWith('.values')) {
            labField = labField.replace('.latest', '') + '.values';
        }
        const { value: values } = resolveFieldValue(context, labField);
        const result = evaluateNoRecentData(
            values as { date: string; value: number }[],
            within_days || 60,
            context.now
        );
        result.field = field;
        return result;
    }

    // Medication in list operator
    if (operator === 'med_in_list') {
        const result = evaluateMedInList(
            context.medications,
            value as string[]
        );
        return result;
    }

    // Message unacknowledged operator
    if (operator === 'message_unacknowledged') {
        return evaluateMessageUnacknowledged(context.messages);
    }

    return { matched: false, reason: `Unknown operator: ${operator}`, operator };
}

/**
 * Evaluate multiple rules and return all results
 */
export function evaluateRules(
    rules: { id: string; rule_json: RuleJSON; severity: string }[],
    context: PatientDataContext
): {
    ruleId: string;
    severity: string;
    result: RuleEvaluationResult
}[] {
    return rules.map(rule => ({
        ruleId: rule.id,
        severity: rule.severity,
        result: evaluateRule(rule.rule_json, context)
    }));
}

/**
 * Get matched rules only (fired alerts)
 */
export function getMatchedRules(
    rules: { id: string; rule_json: RuleJSON; severity: string }[],
    context: PatientDataContext
): {
    ruleId: string;
    severity: string;
    result: RuleEvaluationResult
}[] {
    return evaluateRules(rules, context).filter(r => r.result.matched);
}

// =============================================================================
// SEVERITY ORDERING
// =============================================================================

export const SEVERITY_ORDER: Record<string, number> = {
    'critical': 4,
    'high': 3,
    'review': 2,
    'info': 1
};

/**
 * Sort matched rules by severity (highest first)
 */
export function sortBySeverity(
    matchedRules: { ruleId: string; severity: string; result: RuleEvaluationResult }[]
): { ruleId: string; severity: string; result: RuleEvaluationResult }[] {
    return [...matchedRules].sort((a, b) =>
        (SEVERITY_ORDER[b.severity] || 0) - (SEVERITY_ORDER[a.severity] || 0)
    );
}
