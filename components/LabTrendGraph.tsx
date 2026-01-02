import React, { useMemo, useState } from 'react';
import { LabTrendGraphProps, LabTrendData, VISIT_COLORS } from '../types/visitHistory';

interface TooltipData {
    x: number;
    y: number;
    value: number;
    unit: string;
    testName: string;
    date: string;
    visitIndex: number;
    status: string;
}

// Enhanced CSS-based trend visualization with working tooltips
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

    // Get min/max for scaling
    const getValueRange = (trend: LabTrendData) => {
        if (!trend.dataPoints?.length) return { min: 0, max: 100 };
        const values = trend.dataPoints.map(p => p.value);
        const min = Math.min(...values, trend.referenceMin || 0);
        const max = Math.max(...values, trend.referenceMax || 100);
        const padding = (max - min) * 0.15 || 10;
        return { min: Math.max(0, min - padding), max: max + padding };
    };

    // Calculate position as percentage
    const getPosition = (value: number, min: number, max: number) => {
        if (max === min) return 50;
        return ((value - min) / (max - min)) * 100;
    };

    // Get status color and style
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'normal': return { bg: 'bg-emerald-500', ring: 'ring-emerald-300', shadow: 'shadow-emerald-200' };
            case 'borderline': return { bg: 'bg-amber-500', ring: 'ring-amber-300', shadow: 'shadow-amber-200' };
            case 'abnormal': return { bg: 'bg-orange-500', ring: 'ring-orange-300', shadow: 'shadow-orange-200' };
            case 'critical': return { bg: 'bg-red-500', ring: 'ring-red-300', shadow: 'shadow-red-200' };
            default: return { bg: 'bg-gray-500', ring: 'ring-gray-300', shadow: 'shadow-gray-200' };
        }
    };

    // Handle mouse events for tooltip
    const handlePointHover = (
        e: React.MouseEvent,
        trend: LabTrendData,
        point: { date: string; value: number; status: string },
        visitIdx: number
    ) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip({
            x: e.clientX,
            y: rect.top - 10,
            value: point.value,
            unit: trend.unit,
            testName: trend.displayName,
            date: point.date,
            visitIndex: visitIdx,
            status: point.status,
        });
    };

    const handlePointLeave = () => {
        setTooltip(null);
    };

    return (
        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_rgba(0,0,0,0.3)] border border-transparent dark:border-gray-800 relative">
            <h3 className="text-lg font-bold text-[#222222] dark:text-white mb-4 flex items-center gap-2">
                📊 Lab Trends Across Visits
            </h3>

            {/* Visit Legend */}
            <div className="flex items-center justify-center gap-6 mb-6 py-3 px-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800/30 rounded-xl">
                {visits.map((visit, idx) => (
                    <div key={visit.id} className="flex items-center gap-2">
                        <div
                            className="w-4 h-4 rounded-full shadow-md ring-2 ring-white dark:ring-gray-700"
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

            {/* Lab trends as horizontal bars */}
            <div className="space-y-5">
                {trends.slice(0, 6).map((trend) => {
                    const { min, max } = getValueRange(trend);
                    const refMinPos = getPosition(trend.referenceMin, min, max);
                    const refMaxPos = getPosition(trend.referenceMax, min, max);

                    return (
                        <div key={trend.testType} className="group">
                            {/* Label Row */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full shadow-sm"
                                        style={{ backgroundColor: trend.color }}
                                    />
                                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                                        {trend.displayName}
                                    </span>
                                </div>
                                <span className="text-xs font-medium px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                                    Normal: {trend.referenceMin}-{trend.referenceMax} {trend.unit}
                                </span>
                            </div>

                            {/* Bar Chart Container */}
                            <div className="relative h-12 bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-800/50 rounded-xl overflow-visible shadow-inner">
                                {/* Reference range highlight with gradient */}
                                <div
                                    className="absolute top-0 h-full bg-gradient-to-r from-emerald-100 via-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:via-emerald-900/20 dark:to-emerald-900/30 border-x-2 border-emerald-200 dark:border-emerald-800"
                                    style={{
                                        left: `${refMinPos}%`,
                                        width: `${refMaxPos - refMinPos}%`,
                                    }}
                                />

                                {/* Reference range labels */}
                                <div
                                    className="absolute -top-5 text-[10px] text-emerald-600 dark:text-emerald-500 font-medium"
                                    style={{ left: `${refMinPos}%`, transform: 'translateX(-50%)' }}
                                >
                                    {trend.referenceMin}
                                </div>
                                <div
                                    className="absolute -top-5 text-[10px] text-emerald-600 dark:text-emerald-500 font-medium"
                                    style={{ left: `${refMaxPos}%`, transform: 'translateX(-50%)' }}
                                >
                                    {trend.referenceMax}
                                </div>

                                {/* Connecting line between points */}
                                {trend.dataPoints && trend.dataPoints.length > 1 && (
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                        <defs>
                                            <linearGradient id={`line-gradient-${trend.testType}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                                {trend.dataPoints.map((_, idx) => {
                                                    const colorKeys = ['visit1', 'visit2', 'visit3'] as const;
                                                    const color = idx < colorKeys.length ? VISIT_COLORS[colorKeys[idx]]?.primary : '#6B7280';
                                                    return (
                                                        <stop key={idx} offset={`${(idx / (trend.dataPoints!.length - 1)) * 100}%`} stopColor={color} />
                                                    );
                                                })}
                                            </linearGradient>
                                        </defs>
                                        <polyline
                                            fill="none"
                                            stroke={`url(#line-gradient-${trend.testType})`}
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeDasharray="4 2"
                                            points={trend.dataPoints.map((point, idx) => {
                                                const x = (getPosition(point.value, min, max) / 100) * 100;
                                                return `${x}%,50%`;
                                            }).join(' ')}
                                            style={{ opacity: 0.5 }}
                                        />
                                    </svg>
                                )}

                                {/* Data points */}
                                {trend.dataPoints?.map((point, idx) => {
                                    const position = getPosition(point.value, min, max);
                                    const colorKeys = ['visit1', 'visit2', 'visit3'] as const;
                                    const visitColor = idx < colorKeys.length
                                        ? VISIT_COLORS[colorKeys[idx]]?.primary
                                        : '#6B7280';
                                    const statusStyle = getStatusStyle(point.status);

                                    return (
                                        <div
                                            key={`${point.date}-${idx}`}
                                            className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 z-10 cursor-pointer"
                                            style={{ left: `${position}%` }}
                                            onMouseEnter={(e) => handlePointHover(e, trend, point, idx)}
                                            onMouseLeave={handlePointLeave}
                                        >
                                            {/* Outer glow ring */}
                                            <div
                                                className={`absolute inset-0 w-8 h-8 -m-2 rounded-full opacity-0 group-hover:opacity-30 transition-opacity duration-200 ${statusStyle.bg}`}
                                            />
                                            {/* Main point */}
                                            <div
                                                className={`w-5 h-5 rounded-full border-3 border-white dark:border-gray-900 shadow-lg transition-all duration-200 hover:scale-125 hover:shadow-xl flex items-center justify-center`}
                                                style={{ backgroundColor: visitColor }}
                                            >
                                                <span className="text-[8px] font-bold text-white drop-shadow">
                                                    {idx + 1}
                                                </span>
                                            </div>
                                            {/* Value label on hover */}
                                            <div className="absolute -bottom-7 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded shadow-sm">
                                                    {point.value}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Scale indicators */}
                                <div className="absolute left-2 top-1/2 transform -translate-y-1/2 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                    {min.toFixed(1)}
                                </div>
                                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                                    {max.toFixed(1)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Floating Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none animate-fadeIn"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y - 80,
                        transform: 'translateX(-50%)',
                    }}
                >
                    <div className="bg-gray-900 dark:bg-gray-700 text-white rounded-xl shadow-2xl px-4 py-3 min-w-[140px]">
                        {/* Visit indicator */}
                        <div className="flex items-center gap-2 mb-2">
                            <div
                                className="w-3 h-3 rounded-full shadow"
                                style={{ backgroundColor: visits[tooltip.visitIndex]?.color }}
                            />
                            <span className="text-xs text-gray-300">
                                Visit {tooltip.visitIndex + 1}
                            </span>
                        </div>
                        {/* Value */}
                        <div className="text-lg font-bold">
                            {tooltip.value} <span className="text-sm font-normal text-gray-300">{tooltip.unit}</span>
                        </div>
                        {/* Test name */}
                        <div className="text-xs text-gray-400 mt-1">
                            {tooltip.testName}
                        </div>
                        {/* Date */}
                        <div className="text-xs text-gray-400">
                            {new Date(tooltip.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                            })}
                        </div>
                        {/* Status badge */}
                        <div className="mt-2">
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${tooltip.status === 'normal' ? 'bg-emerald-500/20 text-emerald-300' :
                                    tooltip.status === 'borderline' ? 'bg-amber-500/20 text-amber-300' :
                                        tooltip.status === 'abnormal' ? 'bg-orange-500/20 text-orange-300' :
                                            'bg-red-500/20 text-red-300'
                                }`}>
                                {tooltip.status.charAt(0).toUpperCase() + tooltip.status.slice(1)}
                            </span>
                        </div>
                        {/* Arrow */}
                        <div className="absolute left-1/2 transform -translate-x-1/2 -bottom-2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                    </div>
                </div>
            )}

            {/* Legend Footer */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-center gap-6 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-2 bg-gradient-to-r from-emerald-100 to-emerald-50 rounded border border-emerald-200" />
                        <span>Normal Range</span>
                    </div>
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
