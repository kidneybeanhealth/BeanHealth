import React, { useState } from 'react';
import { LabTrendGraphProps, LabTrendData, VISIT_COLORS } from '../types/visitHistory';

interface TooltipData {
    value: number;
    unit: string;
    testName: string;
    date: string;
    visitIndex: number;
    status: string;
    x: number;
    y: number;
}

// Bar graph visualization for lab trends
const LabTrendGraph: React.FC<LabTrendGraphProps> = ({ trends, visits }) => {
    const [tooltip, setTooltip] = useState<TooltipData | null>(null);

    // Early return if no data
    if (!trends || trends.length === 0 || !visits || visits.length === 0) {
        return (
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800">
                <h3 className="text-lg font-bold text-[#222222] dark:text-white mb-4 flex items-center gap-2">
                    📊 Lab Trends
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                    No lab data available for trend analysis
                </p>
            </div>
        );
    }

    // Get status color  
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'normal': return 'bg-emerald-500';
            case 'borderline': return 'bg-amber-500';
            case 'abnormal': return 'bg-orange-500';
            case 'critical': return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    };

    const handleBarHover = (
        e: React.MouseEvent,
        trend: LabTrendData,
        point: { date: string; value: number; status: string },
        visitIdx: number
    ) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            x: rect.left + rect.width / 2,
            y: rect.top,
            value: point.value,
            unit: trend.unit,
            testName: trend.displayName,
            date: point.date,
            visitIndex: visitIdx,
            status: point.status,
        });
    };

    return (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 relative">
            <h3 className="text-lg font-bold text-[#222222] dark:text-white mb-4 flex items-center gap-2">
                📊 Lab Trends Comparison
            </h3>

            {/* Visit Legend */}
            <div className="flex items-center justify-center gap-6 mb-6 py-3 px-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl">
                {visits.map((visit, idx) => (
                    <div key={visit.id} className="flex items-center gap-2">
                        <div
                            className="w-4 h-4 rounded shadow-md ring-2 ring-white dark:ring-gray-700"
                            style={{ backgroundColor: visit.color }}
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Visit {idx + 1}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({new Date(visit.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                        </span>
                    </div>
                ))}
            </div>

            {/* Bar Graph Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {trends.slice(0, 6).map((trend) => {
                    if (!trend.dataPoints?.length) return null;

                    const values = trend.dataPoints.map(p => p.value);
                    const dataMin = Math.min(...values);
                    const dataMax = Math.max(...values);
                    const dataRange = dataMax - dataMin;

                    // SIMPLE SCALING: Use max value as 100%, but ensure differences are visible
                    // Scale from 0 to (max * 1.2) to give headroom
                    const scaleMax = dataMax * 1.2;

                    // Calculate bar heights as percentage of scaleMax
                    // But to make differences visible, we also show relative heights
                    const useRelativeScale = dataRange < dataMax * 0.2; // If range is less than 20% of max, use relative

                    let scaledMin: number, scaledMax: number;
                    if (useRelativeScale && dataRange > 0) {
                        // For small variations, zoom in: scale from (min - range) to (max + range)
                        scaledMin = Math.max(0, dataMin - dataRange * 2);
                        scaledMax = dataMax + dataRange * 2;
                    } else {
                        // Normal scale from 0 to max
                        scaledMin = 0;
                        scaledMax = scaleMax;
                    }

                    return (
                        <div key={trend.testType} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                            {/* Lab Name */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                    {trend.displayName}
                                </span>
                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    {trend.unit}
                                </span>
                            </div>

                            {/* Bar Chart Container */}
                            <div className="relative h-32 flex items-end justify-around gap-3 px-4 border-b-2 border-gray-300 dark:border-gray-600">
                                {/* Y-axis scale labels */}
                                <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[9px] text-gray-400 dark:text-gray-500 w-6">
                                    <span>{scaledMax.toFixed(0)}</span>
                                    <span>{((scaledMax + scaledMin) / 2).toFixed(0)}</span>
                                    <span>{scaledMin.toFixed(0)}</span>
                                </div>

                                {/* Bars for each visit */}
                                {trend.dataPoints.map((point, idx) => {
                                    // Calculate bar height as percentage
                                    const heightPercent = scaledMax === scaledMin
                                        ? 50
                                        : ((point.value - scaledMin) / (scaledMax - scaledMin)) * 100;

                                    const colorKeys = ['visit1', 'visit2', 'visit3'] as const;
                                    const visitColor = idx < colorKeys.length
                                        ? VISIT_COLORS[colorKeys[idx]]?.primary
                                        : '#6B7280';

                                    return (
                                        <div
                                            key={`${point.date}-${idx}`}
                                            className="relative flex-1 max-w-[50px] group cursor-pointer flex flex-col items-center"
                                            onMouseEnter={(e) => handleBarHover(e, trend, point, idx)}
                                            onMouseLeave={() => setTooltip(null)}
                                        >
                                            {/* Value Label Above Bar */}
                                            <div className="text-[10px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                                                {point.value.toFixed(1)}
                                            </div>

                                            {/* Bar Container */}
                                            <div className="w-full h-24 flex items-end">
                                                {/* Bar */}
                                                <div
                                                    className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-80 shadow-md relative"
                                                    style={{
                                                        height: `${Math.max(10, heightPercent)}%`,
                                                        backgroundColor: visitColor,
                                                    }}
                                                >
                                                    {/* Status dot at top of bar */}
                                                    <div className={`absolute -top-1 left-1/2 transform -translate-x-1/2 w-2.5 h-2.5 rounded-full ${getStatusColor(point.status)} ring-2 ring-white dark:ring-gray-800`} />
                                                </div>
                                            </div>

                                            {/* Visit number label */}
                                            <div className="text-[9px] text-gray-500 dark:text-gray-400 mt-1">
                                                V{idx + 1}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Reference Range Label */}
                            <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                                <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                                    <span>Normal range:</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        {trend.referenceMin} - {trend.referenceMax}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none animate-fadeIn"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y - 90,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <div className="bg-gray-900 dark:bg-gray-700 text-white rounded-xl shadow-2xl px-4 py-3 min-w-[130px]">
                        <div className="flex items-center gap-2 mb-2">
                            <div
                                className="w-3 h-3 rounded shadow"
                                style={{ backgroundColor: visits[tooltip.visitIndex]?.color }}
                            />
                            <span className="text-xs text-gray-300">
                                Visit {tooltip.visitIndex + 1}
                            </span>
                        </div>
                        <div className="text-lg font-bold">
                            {tooltip.value} <span className="text-sm font-normal text-gray-300">{tooltip.unit}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                            {new Date(tooltip.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </div>
                        <div className="mt-2">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tooltip.status === 'normal' ? 'bg-emerald-500/20 text-emerald-300' :
                                    tooltip.status === 'borderline' ? 'bg-amber-500/20 text-amber-300' :
                                        tooltip.status === 'abnormal' ? 'bg-orange-500/20 text-orange-300' :
                                            'bg-red-500/20 text-red-300'
                                }`}>
                                {tooltip.status.charAt(0).toUpperCase() + tooltip.status.slice(1)}
                            </span>
                        </div>
                        <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                    </div>
                </div>
            )}

            {/* Legend Footer */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span>Normal</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span>Borderline</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span>Abnormal</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabTrendGraph;
