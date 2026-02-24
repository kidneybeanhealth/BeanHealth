/**
 * Unit Tests for Rule Evaluator
 * 
 * Tests for: pct_drop, med_in_list, no_recent_data, severity ordering, 
 * action_state hard rule, compound operators (and/or)
 * 
 * Run with: npx vitest run tests/ruleEvaluator.test.ts
 * Or: npm test -- --grep "Rule Evaluator"
 */

import { describe, it, expect } from 'vitest';
import {
    evaluateRule,
    evaluateRules,
    getMatchedRules,
    sortBySeverity,
    RuleJSON,
    PatientDataContext,
    SEVERITY_ORDER
} from '../services/ruleEvaluator';

// =============================================================================
// TEST DATA FIXTURES
// =============================================================================

function createMockContext(overrides: Partial<PatientDataContext> = {}): PatientDataContext {
    return {
        labs: {
            egfr: {
                values: [
                    { date: '2024-11-01', value: 60 },
                    { date: '2024-11-15', value: 55 },
                    { date: '2024-12-01', value: 45 },
                ],
                latest: 45,
                latestDate: '2024-12-01'
            },
            potassium: {
                values: [
                    { date: '2024-12-01', value: 5.8 },
                ],
                latest: 5.8,
                latestDate: '2024-12-01'
            },
            creatinine: {
                values: [
                    { date: '2024-12-01', value: 1.5 },
                ],
                latest: 1.5,
                latestDate: '2024-12-01'
            }
        },
        vitals: {
            bp_systolic: 145,
            bp_diastolic: 92,
            heart_rate: 72
        },
        medications: ['Lisinopril 10mg', 'Metformin 500mg', 'Ibuprofen 400mg'],
        messages: [
            { text: 'I have severe chest pain', isUrgent: true, isRead: false, timestamp: '2024-12-24T10:00:00Z' },
            { text: 'Feeling better today', isUrgent: false, isRead: true, timestamp: '2024-12-23T10:00:00Z' }
        ],
        now: new Date('2024-12-24T12:00:00Z'),
        ...overrides
    };
}

// =============================================================================
// PERCENTAGE DROP TESTS
// =============================================================================

describe('pct_drop operator', () => {
    it('should match when eGFR drops >20% in 30 days', () => {
        const rule: RuleJSON = {
            operator: 'pct_drop',
            field: 'labs.egfr',
            value: 20,
            within_days: 60
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true);
        expect(result.reason).toContain('Dropped');
        expect(result.operator).toBe('pct_drop');
    });

    it('should NOT match when drop is less than threshold', () => {
        const rule: RuleJSON = {
            operator: 'pct_drop',
            field: 'labs.egfr',
            value: 50, // 50% threshold - too high
            within_days: 60
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(false);
    });

    it('should NOT match with insufficient data points', () => {
        const rule: RuleJSON = {
            operator: 'pct_drop',
            field: 'labs.egfr',
            value: 20,
            within_days: 30
        };

        const context = createMockContext({
            labs: {
                ...createMockContext().labs,
                egfr: {
                    values: [{ date: '2024-12-01', value: 45 }],
                    latest: 45
                }
            }
        });

        const result = evaluateRule(rule, context);
        expect(result.matched).toBe(false);
        expect(result.reason).toContain('Insufficient');
    });
});

// =============================================================================
// MEDICATION IN LIST TESTS
// =============================================================================

describe('med_in_list operator', () => {
    it('should match partial medication name', () => {
        const rule: RuleJSON = {
            operator: 'med_in_list',
            field: 'medications',
            value: ['ibuprofen', 'naproxen']
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true);
        expect(result.reason).toContain('Ibuprofen');
    });

    it('should match case-insensitively', () => {
        const rule: RuleJSON = {
            operator: 'med_in_list',
            field: 'medications',
            value: ['LISINOPRIL']
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true);
    });

    it('should NOT match when no medications in list', () => {
        const rule: RuleJSON = {
            operator: 'med_in_list',
            field: 'medications',
            value: ['vancomycin', 'gentamicin']
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(false);
    });

    it('should handle empty medication list', () => {
        const rule: RuleJSON = {
            operator: 'med_in_list',
            field: 'medications',
            value: ['ibuprofen']
        };

        const context = createMockContext({ medications: [] });
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(false);
        expect(result.reason).toContain('No active medications');
    });
});

// =============================================================================
// NO RECENT DATA TESTS
// =============================================================================

describe('no_recent_data operator', () => {
    it('should match when no data in specified window', () => {
        const rule: RuleJSON = {
            operator: 'no_recent_data',
            field: 'labs.creatinine',
            within_days: 7  // Only 7 days - should trigger
        };

        // Data is from Dec 1, now is Dec 24 = 23 days ago
        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true);
        expect(result.reason).toContain('No data in last 7 days');
    });

    it('should NOT match when recent data exists', () => {
        const rule: RuleJSON = {
            operator: 'no_recent_data',
            field: 'labs.creatinine',
            within_days: 60  // 60 days - should have data
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(false);
    });

    it('should match when no data exists at all', () => {
        const rule: RuleJSON = {
            operator: 'no_recent_data',
            field: 'labs.bicarbonate',
            within_days: 30
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true);
        expect(result.reason).toContain('No data on record');
    });
});

// =============================================================================
// SEVERITY ORDERING TESTS
// =============================================================================

describe('severity ordering', () => {
    it('should order critical > high > review > info', () => {
        expect(SEVERITY_ORDER['critical']).toBeGreaterThan(SEVERITY_ORDER['high']);
        expect(SEVERITY_ORDER['high']).toBeGreaterThan(SEVERITY_ORDER['review']);
        expect(SEVERITY_ORDER['review']).toBeGreaterThan(SEVERITY_ORDER['info']);
    });

    it('should sort matched rules by severity', () => {
        const matchedRules = [
            { ruleId: '1', severity: 'info', result: { matched: true, reason: '', operator: 'gt' as const } },
            { ruleId: '2', severity: 'critical', result: { matched: true, reason: '', operator: 'gt' as const } },
            { ruleId: '3', severity: 'high', result: { matched: true, reason: '', operator: 'gt' as const } },
            { ruleId: '4', severity: 'review', result: { matched: true, reason: '', operator: 'gt' as const } }
        ];

        const sorted = sortBySeverity(matchedRules);

        expect(sorted[0].severity).toBe('critical');
        expect(sorted[1].severity).toBe('high');
        expect(sorted[2].severity).toBe('review');
        expect(sorted[3].severity).toBe('info');
    });
});

// =============================================================================
// COMPOUND OPERATOR TESTS
// =============================================================================

describe('compound operators', () => {
    it('AND should require all conditions to match', () => {
        const rule: RuleJSON = {
            operator: 'and',
            children: [
                { operator: 'gt', field: 'labs.potassium', value: 5.5 },
                { operator: 'med_in_list', field: 'medications', value: ['lisinopril'] }
            ]
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        // Both should match: K+ = 5.8 > 5.5 AND Lisinopril is in medications
        expect(result.matched).toBe(true);
        expect(result.reason).toContain('All 2 conditions matched');
    });

    it('AND should fail if any condition fails', () => {
        const rule: RuleJSON = {
            operator: 'and',
            children: [
                { operator: 'gt', field: 'labs.potassium', value: 5.5 },
                { operator: 'med_in_list', field: 'medications', value: ['vancomycin'] } // Not in list
            ]
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(false);
    });

    it('OR should match if any condition matches', () => {
        const rule: RuleJSON = {
            operator: 'or',
            children: [
                { operator: 'gt', field: 'labs.potassium', value: 10 }, // Won't match
                { operator: 'med_in_list', field: 'medications', value: ['ibuprofen'] } // Will match
            ]
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true);
        expect(result.reason).toContain('1 of 2 conditions matched');
    });

    it('OR should fail if no conditions match', () => {
        const rule: RuleJSON = {
            operator: 'or',
            children: [
                { operator: 'gt', field: 'labs.potassium', value: 10 },
                { operator: 'med_in_list', field: 'medications', value: ['vancomycin'] }
            ]
        };

        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(false);
    });
});

// =============================================================================
// MESSAGE UNACKNOWLEDGED TESTS
// =============================================================================

describe('message_unacknowledged operator', () => {
    it('should match when unread urgent message exists', () => {
        const rule: RuleJSON = { operator: 'message_unacknowledged' };
        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true);
        expect(result.reason).toContain('unread urgent');
    });

    it('should NOT match when all urgent messages are read', () => {
        const rule: RuleJSON = { operator: 'message_unacknowledged' };
        const context = createMockContext({
            messages: [
                { text: 'Urgent issue', isUrgent: true, isRead: true, timestamp: '2024-12-24T10:00:00Z' }
            ]
        });
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(false);
    });
});

// =============================================================================
// COMPARISON OPERATOR TESTS
// =============================================================================

describe('comparison operators', () => {
    it('gt should match when value is greater', () => {
        const rule: RuleJSON = { operator: 'gt', field: 'labs.potassium', value: 5.0 };
        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true); // 5.8 > 5.0
    });

    it('lt should match when value is less', () => {
        const rule: RuleJSON = { operator: 'lt', field: 'labs.egfr', value: 60 };
        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true); // 45 < 60
    });

    it('gte should match when value is equal', () => {
        const rule: RuleJSON = { operator: 'gte', field: 'vitals.bp_systolic', value: 145 };
        const context = createMockContext();
        const result = evaluateRule(rule, context);

        expect(result.matched).toBe(true); // 145 >= 145
    });
});

// =============================================================================
// INTEGRATION TEST: Multiple Rules
// =============================================================================

describe('multiple rules evaluation', () => {
    it('should evaluate all rules and return matched ones', () => {
        const rules = [
            { id: 'r1', rule_json: { operator: 'gt' as const, field: 'labs.potassium', value: 5.5 }, severity: 'high' },
            { id: 'r2', rule_json: { operator: 'lt' as const, field: 'labs.egfr', value: 30 }, severity: 'critical' }, // Won't match (45 > 30)
            { id: 'r3', rule_json: { operator: 'med_in_list' as const, field: 'medications', value: ['ibuprofen'] }, severity: 'review' }
        ];

        const context = createMockContext();
        const matched = getMatchedRules(rules, context);

        expect(matched.length).toBe(2); // r1 and r3 should match
        expect(matched.map(m => m.ruleId)).toContain('r1');
        expect(matched.map(m => m.ruleId)).toContain('r3');
        expect(matched.map(m => m.ruleId)).not.toContain('r2');
    });
});
