import React, { useState } from 'react';
import { RuleJSON, RuleOperator } from '../services/ruleEvaluator';

// =============================================================================
// TYPES
// =============================================================================

interface Condition {
    id: string;
    category: 'labs' | 'vitals' | 'medications' | 'messages';
    field: string;
    operator: RuleOperator;
    value: string | number | string[];
    withinDays?: number;
}

interface RuleBuilderProps {
    initialRule?: RuleJSON;
    onChange: (ruleJson: RuleJSON) => void;
}

// =============================================================================
// FIELD OPTIONS
// =============================================================================

const FIELD_OPTIONS = {
    labs: [
        { value: 'egfr', label: 'eGFR', unit: 'mL/min' },
        { value: 'creatinine', label: 'Creatinine', unit: 'mg/dL' },
        { value: 'potassium', label: 'Potassium (K+)', unit: 'mEq/L' },
        { value: 'sodium', label: 'Sodium (Na+)', unit: 'mEq/L' },
        { value: 'phosphorus', label: 'Phosphorus', unit: 'mg/dL' },
        { value: 'calcium', label: 'Calcium', unit: 'mg/dL' },
        { value: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL' },
        { value: 'bicarbonate', label: 'Bicarbonate', unit: 'mEq/L' },
    ],
    vitals: [
        { value: 'bp_systolic', label: 'BP Systolic', unit: 'mmHg' },
        { value: 'bp_diastolic', label: 'BP Diastolic', unit: 'mmHg' },
        { value: 'heart_rate', label: 'Heart Rate', unit: 'bpm' },
        { value: 'weight', label: 'Weight', unit: 'kg' },
    ],
    medications: [
        { value: 'nephrotoxic', label: 'Nephrotoxic Drugs (NSAIDs, etc.)' },
        { value: 'custom', label: 'Custom medication list' },
    ],
    messages: [
        { value: 'unacknowledged', label: 'Unacknowledged urgent messages' },
    ],
};

const OPERATOR_OPTIONS: { value: RuleOperator; label: string; category: string[] }[] = [
    { value: 'gt', label: 'Greater than (>)', category: ['labs', 'vitals'] },
    { value: 'lt', label: 'Less than (<)', category: ['labs', 'vitals'] },
    { value: 'gte', label: 'Greater or equal (≥)', category: ['labs', 'vitals'] },
    { value: 'lte', label: 'Less or equal (≤)', category: ['labs', 'vitals'] },
    { value: 'pct_drop', label: 'Percentage drop (%↓)', category: ['labs'] },
    { value: 'pct_rise', label: 'Percentage rise (%↑)', category: ['labs'] },
    { value: 'abs_change', label: 'Absolute change (Δ)', category: ['labs'] },
    { value: 'no_recent_data', label: 'No data in X days', category: ['labs'] },
    { value: 'med_in_list', label: 'Patient taking medication', category: ['medications'] },
    { value: 'message_unacknowledged', label: 'Has unread urgent message', category: ['messages'] },
];

const NEPHROTOXIC_MEDS = [
    'ibuprofen', 'naproxen', 'aspirin', 'diclofenac', 'meloxicam',
    'gentamicin', 'vancomycin', 'amphotericin', 'acyclovir', 'lithium'
];

// =============================================================================
// COMPONENT
// =============================================================================

const RuleBuilder: React.FC<RuleBuilderProps> = ({ initialRule, onChange }) => {
    const [conditions, setConditions] = useState<Condition[]>(() => {
        if (initialRule && initialRule.operator !== 'and' && initialRule.operator !== 'or') {
            return [{
                id: crypto.randomUUID(),
                category: initialRule.field?.startsWith('labs') ? 'labs' :
                    initialRule.field?.startsWith('vitals') ? 'vitals' :
                        initialRule.operator === 'med_in_list' ? 'medications' : 'messages',
                field: initialRule.field?.split('.')[1] || '',
                operator: initialRule.operator,
                value: initialRule.value as any || '',
                withinDays: initialRule.within_days
            }];
        }
        return [{
            id: crypto.randomUUID(),
            category: 'labs',
            field: 'potassium',
            operator: 'gt',
            value: 5.5,
        }];
    });

    const [logicOperator, setLogicOperator] = useState<'and' | 'or'>('and');

    // Build RuleJSON from conditions
    const buildRuleJson = (conds: Condition[]): RuleJSON => {
        if (conds.length === 1) {
            const c = conds[0];
            return buildSingleCondition(c);
        }

        return {
            operator: logicOperator,
            children: conds.map(c => buildSingleCondition(c))
        };
    };

    const buildSingleCondition = (c: Condition): RuleJSON => {
        if (c.operator === 'med_in_list') {
            const meds = c.field === 'nephrotoxic'
                ? NEPHROTOXIC_MEDS
                : (typeof c.value === 'string' ? c.value.split(',').map(m => m.trim()) : c.value as string[]);
            return {
                operator: 'med_in_list',
                field: 'medications',
                value: meds
            };
        }

        if (c.operator === 'message_unacknowledged') {
            return { operator: 'message_unacknowledged' };
        }

        if (c.operator === 'no_recent_data') {
            return {
                operator: 'no_recent_data',
                field: `labs.${c.field}`,
                within_days: c.withinDays || 60
            };
        }

        if (['pct_drop', 'pct_rise', 'abs_change'].includes(c.operator)) {
            return {
                operator: c.operator,
                field: `labs.${c.field}`,
                value: typeof c.value === 'number' ? c.value : parseFloat(c.value as string) || 0,
                within_days: c.withinDays || 30
            };
        }

        // Comparison operators
        const prefix = c.category === 'vitals' ? 'vitals' : 'labs';
        return {
            operator: c.operator,
            field: `${prefix}.${c.field}`,
            value: typeof c.value === 'number' ? c.value : parseFloat(c.value as string) || 0
        };
    };

    const handleConditionChange = (id: string, updates: Partial<Condition>) => {
        const newConditions = conditions.map(c =>
            c.id === id ? { ...c, ...updates } : c
        );
        setConditions(newConditions);
        onChange(buildRuleJson(newConditions));
    };

    const addCondition = () => {
        const newConditions = [...conditions, {
            id: crypto.randomUUID(),
            category: 'labs' as const,
            field: 'creatinine',
            operator: 'gt' as RuleOperator,
            value: 1.5,
        }];
        setConditions(newConditions);
        onChange(buildRuleJson(newConditions));
    };

    const removeCondition = (id: string) => {
        if (conditions.length <= 1) return;
        const newConditions = conditions.filter(c => c.id !== id);
        setConditions(newConditions);
        onChange(buildRuleJson(newConditions));
    };

    const getOperatorsForCategory = (category: string) => {
        return OPERATOR_OPTIONS.filter(op => op.category.includes(category));
    };

    const needsWithinDays = (op: string) => {
        return ['pct_drop', 'pct_rise', 'abs_change', 'no_recent_data'].includes(op);
    };

    const needsValue = (op: string) => {
        return !['no_recent_data', 'message_unacknowledged'].includes(op);
    };

    return (
        <div className="space-y-4">
            {/* Logic Operator (if multiple conditions) */}
            {conditions.length > 1 && (
                <div className="flex items-center gap-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Match:
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setLogicOperator('and'); onChange(buildRuleJson(conditions)); }}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${logicOperator === 'and'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            ALL conditions (AND)
                        </button>
                        <button
                            onClick={() => { setLogicOperator('or'); onChange(buildRuleJson(conditions)); }}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${logicOperator === 'or'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                }`}
                        >
                            ANY condition (OR)
                        </button>
                    </div>
                </div>
            )}

            {/* Conditions */}
            {conditions.map((condition, idx) => (
                <div key={condition.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            Condition {idx + 1}
                        </span>
                        {conditions.length > 1 && (
                            <button
                                onClick={() => removeCondition(condition.id)}
                                className="text-red-500 hover:text-red-700 text-sm"
                            >
                                ✕ Remove
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Category */}
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
                            <select
                                value={condition.category}
                                onChange={(e) => {
                                    const newCat = e.target.value as Condition['category'];
                                    const firstField = Object.keys(FIELD_OPTIONS).includes(newCat)
                                        ? FIELD_OPTIONS[newCat][0]?.value || ''
                                        : '';
                                    const operators = getOperatorsForCategory(newCat);
                                    handleConditionChange(condition.id, {
                                        category: newCat,
                                        field: firstField,
                                        operator: operators[0]?.value || 'gt'
                                    });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                            >
                                <option value="labs">🧪 Lab Results</option>
                                <option value="vitals">💓 Vitals</option>
                                <option value="medications">💊 Medications</option>
                                <option value="messages">💬 Messages</option>
                            </select>
                        </div>

                        {/* Field */}
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Field</label>
                            <select
                                value={condition.field}
                                onChange={(e) => handleConditionChange(condition.id, { field: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                            >
                                {FIELD_OPTIONS[condition.category]?.map(f => (
                                    <option key={f.value} value={f.value}>
                                        {f.label} {f.unit ? `(${f.unit})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Operator */}
                        <div>
                            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Condition</label>
                            <select
                                value={condition.operator}
                                onChange={(e) => handleConditionChange(condition.id, { operator: e.target.value as RuleOperator })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                            >
                                {getOperatorsForCategory(condition.category).map(op => (
                                    <option key={op.value} value={op.value}>{op.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Value */}
                        {needsValue(condition.operator) && (
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    {condition.operator === 'med_in_list' && condition.field === 'custom'
                                        ? 'Medications (comma-separated)'
                                        : ['pct_drop', 'pct_rise'].includes(condition.operator)
                                            ? 'Threshold (%)'
                                            : 'Value'}
                                </label>
                                {condition.operator === 'med_in_list' && condition.field === 'custom' ? (
                                    <input
                                        type="text"
                                        value={condition.value as string}
                                        onChange={(e) => handleConditionChange(condition.id, { value: e.target.value })}
                                        placeholder="ibuprofen, naproxen..."
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                    />
                                ) : (
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={condition.value as number}
                                        onChange={(e) => handleConditionChange(condition.id, { value: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                    />
                                )}
                            </div>
                        )}

                        {/* Within Days (for trend operators) */}
                        {needsWithinDays(condition.operator) && (
                            <div>
                                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Within (days)</label>
                                <input
                                    type="number"
                                    value={condition.withinDays || 30}
                                    onChange={(e) => handleConditionChange(condition.id, { withinDays: parseInt(e.target.value) || 30 })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                                />
                            </div>
                        )}
                    </div>
                </div>
            ))}

            {/* Add Condition Button */}
            <button
                onClick={addCondition}
                className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg hover:border-indigo-500 hover:text-indigo-500 transition-colors text-sm font-medium"
            >
                + Add another condition
            </button>
        </div>
    );
};

export default RuleBuilder;
