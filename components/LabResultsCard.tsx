import React, { useState, useEffect } from 'react';
import { LabResult, LabTestType, CustomLabType } from '../types';
import { LabResultsService } from '../services/labResultsService';
import { CustomLabTypesService } from '../services/customLabTypesService';
import { getStatusIcon, getStatusColorClasses } from '../utils/ckdUtils';

interface LabResultsCardProps {
    patientId: string;
}

const LabResultsCard: React.FC<LabResultsCardProps> = ({ patientId }) => {
    // Dynamic lab types from database
    const [availableLabTypes, setAvailableLabTypes] = useState<CustomLabType[]>([]);
    const [latestResults, setLatestResults] = useState<Record<string, LabResult | null>>({});
    const [isAddingResult, setIsAddingResult] = useState(false);
    const [newResult, setNewResult] = useState({
        testType: '' as LabTestType,
        value: '',
        testDate: new Date().toISOString().split('T')[0]
    });
    const [viewingTrend, setViewingTrend] = useState<LabTestType | null>(null);
    const [trendData, setTrendData] = useState<{ date: string; value: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadLabTypesAndResults();
    }, [patientId]);

    const loadLabTypesAndResults = async () => {
        setIsLoading(true);
        try {
            // Load available lab types for this patient
            const labTypes = await CustomLabTypesService.getLabTypesForPatient(patientId);
            setAvailableLabTypes(labTypes);

            // Set default test type for new results
            if (labTypes.length > 0 && !newResult.testType) {
                setNewResult(prev => ({ ...prev, testType: labTypes[0].code }));
            }

            // Load latest results
            await loadLatestResults(labTypes);
        } catch (error) {
            console.error('Error loading lab types:', error);
            // Fallback to loading just results with system types
            await loadLatestResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadLatestResults = async (labTypes?: CustomLabType[]) => {
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
            await loadLabTypesAndResults();
            setIsAddingResult(false);
            setNewResult({
                testType: availableLabTypes[0]?.code || 'egfr',
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

    // Get unit from available lab types or fallback to hardcoded
    const getUnitForTest = (testType: LabTestType): string => {
        const labType = availableLabTypes.find(lt => lt.code === testType);
        if (labType) return labType.unit;

        // Fallback for system types
        const units: Record<string, string> = {
            creatinine: 'mg/dL',
            egfr: 'ml/min/1.73m²',
            bun: 'mg/dL',
            potassium: 'mmol/L',
            hemoglobin: 'g/dL',
            bicarbonate: 'mmol/L',
            acr: 'mg/g'
        };
        return units[testType] || '';
    };

    // Get display name from available lab types or fallback
    const getTestName = (testType: LabTestType): string => {
        const labType = availableLabTypes.find(lt => lt.code === testType);
        if (labType) return labType.name;

        // Fallback for system types
        const names: Record<string, string> = {
            creatinine: 'Creatinine',
            egfr: 'eGFR',
            bun: 'BUN',
            potassium: 'Potassium',
            hemoglobin: 'Hemoglobin',
            bicarbonate: 'Bicarbonate',
            acr: 'ACR'
        };
        return names[testType] || testType;
    };

    // Key tests to show prominently (first 4 by display order)
    const keyTests = availableLabTypes.slice(0, 4).map(lt => lt.code);
    // Secondary tests (remaining)
    const secondaryTests = availableLabTypes.slice(4).map(lt => lt.code);

    return (
        <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-4 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] transition-all duration-300 border border-transparent dark:border-[#8AC43C]/20">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-[#222222] dark:text-white">Lab Results</h3>
                <button
                    onClick={() => setIsAddingResult(true)}
                    className="min-w-[100px] px-4 py-2 text-xs font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-full hover:opacity-90 transition-all shadow-sm active:scale-95"
                >
                    + Add Result
                </button>
            </div>

            {/* Add Result Modal */}
            {isAddingResult && (
                <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-none">
                    <h4 className="text-lg font-bold text-[#222222] dark:text-white mb-6">Add New Lab Result</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Test Type</label>
                            <select
                                value={newResult.testType}
                                onChange={(e) => setNewResult({ ...newResult, testType: e.target.value as LabTestType })}
                                className="w-full px-4 py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-xl text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                            >
                                {Object.keys(latestResults).map((testType) => (
                                    <option key={testType} value={testType}>
                                        {getTestName(testType as LabTestType)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Value</label>
                            <input
                                type="number"
                                step="0.01"
                                value={newResult.value}
                                onChange={(e) => setNewResult({ ...newResult, value: e.target.value })}
                                placeholder="Enter value"
                                className="w-full px-4 py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-xl text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Test Date</label>
                            <input
                                type="date"
                                value={newResult.testDate}
                                onChange={(e) => setNewResult({ ...newResult, testDate: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-xl text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAddResult}
                            className="flex-1 min-w-[100px] px-4 py-2.5 bg-[#8AC43C] hover:bg-[#7ab332] text-white dark:text-[#222222] text-xs font-bold rounded-full transition-colors"
                        >
                            Add Result
                        </button>
                        <button
                            onClick={() => setIsAddingResult(false)}
                            className="flex-1 min-w-[100px] px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[#222222] dark:text-white text-xs font-bold rounded-full transition-colors"
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
                    const colors = result ? getStatusColorClasses(result.status) : { bg: 'bg-gray-100 dark:bg-[#8AC43C]/20', text: 'text-gray-500 dark:text-[#a0a0a0]', border: 'border-gray-200 dark:border-[#8AC43C]/10' };
                    const icon = result ? getStatusIcon(result.status) : '⚪';

                    return (
                        <div
                            key={testType}
                            className={`group p-5 rounded-2xl border-none ${colors.bg} cursor-pointer hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 relative overflow-hidden`}
                            onClick={() => result && handleViewTrend(testType)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <h4 className="text-xs font-bold text-[#717171] dark:text-[#a0a0a0] uppercase tracking-wider">{getTestName(testType)}</h4>
                                <span className="text-lg transform group-hover:scale-110 transition-transform">{icon}</span>
                            </div>
                            {result ? (
                                <>
                                    <p className={`text-2xl font-bold ${colors.text}`}>
                                        {result.value} <span className="text-sm font-normal">{result.unit}</span>
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {new Date(result.testDate).toLocaleDateString()}
                                    </p>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">No data</p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Secondary Labs */}
            {secondaryTests.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {secondaryTests.map((testType) => {
                        const result = latestResults[testType];
                        const colors = result ? getStatusColorClasses(result.status) : { bg: 'bg-gray-50 dark:bg-[#8AC43C]/20', text: 'text-gray-500 dark:text-[#a0a0a0]', border: 'border-gray-200 dark:border-[#8AC43C]/10' };
                        const icon = result ? getStatusIcon(result.status) : '⚪';

                        return (
                            <div
                                key={testType}
                                className={`p-3 rounded-lg border ${colors.border} ${colors.bg} cursor-pointer hover:scale-105 transition-transform`}
                                onClick={() => result && handleViewTrend(testType as LabTestType)}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300">{getTestName(testType as LabTestType)}</h5>
                                    <span className="text-sm">{icon}</span>
                                </div>
                                {result ? (
                                    <p className={`text-lg font-bold ${colors.text}`}>
                                        {result.value} <span className="text-xs">{result.unit}</span>
                                    </p>
                                ) : (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">No data</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Trend View Modal */}
            {viewingTrend && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                {getTestName(viewingTrend)} Trend
                            </h3>
                            <button
                                onClick={() => setViewingTrend(null)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {trendData.length > 0 ? (
                            <div className="space-y-4">
                                {/* Simple line chart visualization */}
                                <div className="relative h-48 bg-gray-50 dark:bg-gray-700 rounded-xl p-4">
                                    <svg className="w-full h-full" viewBox="0 0 400 150">
                                        <polyline
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            className="text-secondary-700"
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
                                                    className="fill-secondary-700"
                                                />
                                            );
                                        })}
                                    </svg>
                                </div>

                                {/* Data Table */}
                                <div className="space-y-2">
                                    {trendData.map((point, idx) => {
                                        const result = latestResults[viewingTrend];
                                        const colors = result ? getStatusColorClasses(result.status) : { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300' };

                                        return (
                                            <div key={idx} className={`flex justify-between items-center p-3 rounded-lg ${colors.bg}`}>
                                                <span className="text-sm text-gray-600 dark:text-gray-400">
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
                            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No trend data available</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LabResultsCard;
