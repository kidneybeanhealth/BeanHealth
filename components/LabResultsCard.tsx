import React, { useState, useEffect } from 'react';
import { LabResult, LabTestType } from '../types';
import { LabResultsService } from '../services/labResultsService';
import { getStatusIcon, getStatusColorClasses } from '../utils/ckdUtils';

interface LabResultsCardProps {
    patientId: string;
}

const LabResultsCard: React.FC<LabResultsCardProps> = ({ patientId }) => {
    const [latestResults, setLatestResults] = useState<Record<LabTestType, LabResult | null>>({
        creatinine: null,
        egfr: null,
        bun: null,
        potassium: null,
        hemoglobin: null,
        bicarbonate: null,
        acr: null
    });
    const [isAddingResult, setIsAddingResult] = useState(false);
    const [newResult, setNewResult] = useState({
        testType: 'egfr' as LabTestType,
        value: '',
        testDate: new Date().toISOString().split('T')[0]
    });
    const [viewingTrend, setViewingTrend] = useState<LabTestType | null>(null);
    const [trendData, setTrendData] = useState<{ date: string; value: number }[]>([]);

    useEffect(() => {
        loadLatestResults();
    }, [patientId]);

    const loadLatestResults = async () => {
        try {
            const results = await LabResultsService.getLatestResults(patientId);
            setLatestResults(results);
        } catch (error) {
            console.error('Error loading lab results:', error);
        }
    };

    const handleAddResult = async () => {
        const value = parseFloat(newResult.value);
        if (!value || value <= 0) {
            alert('Please enter a valid value');
            return;
        }

        try {
            const unit = getUnitForTest(newResult.testType);
            await LabResultsService.addLabResult(
                patientId,
                newResult.testType,
                value,
                unit,
                newResult.testDate
            );
            await loadLatestResults();
            setIsAddingResult(false);
            setNewResult({
                testType: 'egfr',
                value: '',
                testDate: new Date().toISOString().split('T')[0]
            });
        } catch (error) {
            console.error('Error adding lab result:', error);
            alert('Failed to add lab result. Please try again.');
        }
    };

    const handleViewTrend = async (testType: LabTestType) => {
        try {
            const data = await LabResultsService.getTrendData(patientId, testType, 10);
            setTrendData(data);
            setViewingTrend(testType);
        } catch (error) {
            console.error('Error loading trend data:', error);
        }
    };

    const getUnitForTest = (testType: LabTestType): string => {
        const units: Record<LabTestType, string> = {
            creatinine: 'mg/dL',
            egfr: 'ml/min/1.73m²',
            bun: 'mg/dL',
            potassium: 'mmol/L',
            hemoglobin: 'g/dL',
            bicarbonate: 'mmol/L',
            acr: 'mg/g'
        };
        return units[testType];
    };

    const getTestName = (testType: LabTestType): string => {
        const names: Record<LabTestType, string> = {
            creatinine: 'Creatinine',
            egfr: 'eGFR',
            bun: 'BUN',
            potassium: 'Potassium',
            hemoglobin: 'Hemoglobin',
            bicarbonate: 'Bicarbonate',
            acr: 'ACR'
        };
        return names[testType];
    };

    const keyTests: LabTestType[] = ['egfr', 'creatinine', 'potassium', 'hemoglobin'];

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200/40 dark:border-slate-700/40 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Lab Results & Trends</h3>
                <button
                    onClick={() => setIsAddingResult(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-cyan-500 rounded-xl hover:bg-cyan-600 transition-colors"
                >
                    + Add Result
                </button>
            </div>

            {/* Add Result Modal */}
            {isAddingResult && (
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Add New Lab Result</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Test Type</label>
                            <select
                                value={newResult.testType}
                                onChange={(e) => setNewResult({ ...newResult, testType: e.target.value as LabTestType })}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
                            >
                                {Object.keys(latestResults).map((testType) => (
                                    <option key={testType} value={testType}>
                                        {getTestName(testType as LabTestType)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Value</label>
                            <input
                                type="number"
                                step="0.01"
                                value={newResult.value}
                                onChange={(e) => setNewResult({ ...newResult, value: e.target.value })}
                                placeholder="Enter value"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Test Date</label>
                            <input
                                type="date"
                                value={newResult.testDate}
                                onChange={(e) => setNewResult({ ...newResult, testDate: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAddResult}
                            className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-xl transition-colors"
                        >
                            Add Result
                        </button>
                        <button
                            onClick={() => setIsAddingResult(false)}
                            className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Key Lab Results Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {keyTests.map((testType) => {
                    const result = latestResults[testType];
                    const colors = result ? getStatusColorClasses(result.status) : { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-600' };
                    const icon = result ? getStatusIcon(result.status) : '⚪';

                    return (
                        <div
                            key={testType}
                            className={`p-4 rounded-xl border ${colors.border} ${colors.bg} cursor-pointer hover:scale-105 transition-transform`}
                            onClick={() => result && handleViewTrend(testType)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{getTestName(testType)}</h4>
                                <span className="text-lg">{icon}</span>
                            </div>
                            {result ? (
                                <>
                                    <p className={`text-2xl font-bold ${colors.text}`}>
                                        {result.value} <span className="text-sm font-normal">{result.unit}</span>
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        {new Date(result.testDate).toLocaleDateString()}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-slate-500 dark:text-slate-400 italic">No data</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Secondary Labs */}
            <div className="grid grid-cols-3 gap-3">
                {['bun', 'bicarbonate', 'acr'].map((testType) => {
                    const result = latestResults[testType as LabTestType];
                    const colors = result ? getStatusColorClasses(result.status) : { bg: 'bg-slate-50 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-600' };
                    const icon = result ? getStatusIcon(result.status) : '⚪';

                    return (
                        <div
                            key={testType}
                            className={`p-3 rounded-lg border ${colors.border} ${colors.bg} cursor-pointer hover:scale-105 transition-transform`}
                            onClick={() => result && handleViewTrend(testType as LabTestType)}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300">{getTestName(testType as LabTestType)}</h5>
                                <span className="text-sm">{icon}</span>
                            </div>
                            {result ? (
                                <p className={`text-lg font-bold ${colors.text}`}>
                                    {result.value} <span className="text-xs">{result.unit}</span>
                                </p>
                            ) : (
                                <p className="text-xs text-slate-500 dark:text-slate-400 italic">No data</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Trend View Modal */}
            {viewingTrend && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                                {getTestName(viewingTrend)} Trend
                            </h3>
                            <button
                                onClick={() => setViewingTrend(null)}
                                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {trendData.length > 0 ? (
                            <div className="space-y-4">
                                {/* Simple line chart visualization */}
                                <div className="relative h-48 bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                                    <svg className="w-full h-full" viewBox="0 0 400 150">
                                        <polyline
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="text-cyan-500"
                                            points={trendData.map((point, idx) => {
                                                const x = (idx / (trendData.length - 1)) * 380 + 10;
                                                const maxValue = Math.max(...trendData.map(p => p.value));
                                                const minValue = Math.min(...trendData.map(p => p.value));
                                                const range = maxValue - minValue || 1;
                                                const y = 140 - ((point.value - minValue) / range) * 120;
                                                return `${x},${y}`;
                                            }).join(' ')}
                                        />
                                        {trendData.map((point, idx) => {
                                            const x = (idx / (trendData.length - 1)) * 380 + 10;
                                            const maxValue = Math.max(...trendData.map(p => p.value));
                                            const minValue = Math.min(...trendData.map(p => p.value));
                                            const range = maxValue - minValue || 1;
                                            const y = 140 - ((point.value - minValue) / range) * 120;
                                            return (
                                                <circle
                                                    key={idx}
                                                    cx={x}
                                                    cy={y}
                                                    r="4"
                                                    className="fill-cyan-500"
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>

                                {/* Data Table */}
                                <div className="space-y-2">
                                    {trendData.map((point, idx) => {
                                        const result = latestResults[viewingTrend];
                                        const colors = result ? getStatusColorClasses(result.status) : { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-700 dark:text-slate-300' };

                                        return (
                                            <div key={idx} className={`flex justify-between items-center p-3 rounded-lg ${colors.bg}`}>
                                                <span className="text-sm text-slate-600 dark:text-slate-400">
                                                    {new Date(point.date).toLocaleDateString()}
                                                </span>
                                                <span className={`text-lg font-bold ${colors.text}`}>
                                                    {point.value} {getUnitForTest(viewingTrend)}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-slate-500 dark:text-slate-400 py-8">No trend data available</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LabResultsCard;
