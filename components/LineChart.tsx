import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface Line {
  dataKey: string;
  color: string;
}

interface ChartProps {
  data: Record<string, any>[];
  lines: Line[];
  xAxisKey: string;
}

const LineChart: React.FC<ChartProps> = ({ data, lines, xAxisKey }) => {
  const { theme } = useTheme();
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  
  const width = 500;
  const height = 300;
  const padding = 50;
  const svgWidth = width + padding * 2;
  const svgHeight = height + padding * 2;
  
  if (!data || data.length < 2) {
    return <div className="h-[350px] flex items-center justify-center text-gray-500 dark:text-gray-400">Not enough data to display chart.</div>;
  }
  
  const axisColor = theme === 'dark' ? '#94a3b8' : '#64748b';
  const gridColor = theme === 'dark' ? '#334155' : '#e2e8f0';


  const allYValues = data.flatMap(d => lines.map(line => d[line.dataKey])).filter(v => typeof v === 'number' && !isNaN(v));

  const yMin = Math.min(...allYValues);
  const yMax = Math.max(...allYValues);

  const yRangeBuffer = (yMax - yMin) * 0.1 || 5;
  const yDomainMin = Math.floor(yMin - yRangeBuffer);
  const yDomainMax = Math.ceil(yMax + yRangeBuffer);

  const xLabels = data.map(d => d[xAxisKey]);

  const xScale = (index: number) => padding + (index / (data.length - 1)) * width;
  const yScale = (value: number) => padding + height - ((value - yDomainMin) / (yDomainMax - yDomainMin)) * height;
  
  const createPath = (dataKey: string) => {
    let path = `M ${xScale(0)} ${yScale(data[0][dataKey])}`;
    data.slice(1).forEach((d, i) => {
      path += ` L ${xScale(i + 1)} ${yScale(d[dataKey])}`;
    });
    return path;
  };

  const findClosestIndex = (mouseX: number) => {
    let closestIndex = 0;
    let minDistance = Infinity;
    for (let i = 0; i < data.length; i++) {
      const distance = Math.abs(xScale(i) - mouseX);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }
    return closestIndex;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const svgX = e.clientX - svgRect.left;
    
    const index = findClosestIndex(svgX);
    const pointData = data[index];

    const content = (
      <>
        <div className="font-bold text-sm mb-1">{pointData[xAxisKey]}</div>
        {lines.map(line => (
          <div key={line.dataKey} style={{ color: line.color }} className="flex justify-between items-center text-xs">
            <span className="capitalize mr-2">{line.dataKey}:</span>
            <span className="font-semibold">{pointData[line.dataKey]}</span>
          </div>
        ))}
      </>
    );
    setTooltip({ x: xScale(index), y: yScale(pointData[lines[0].dataKey]), content });
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  };
  
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} role="img" aria-label={`Line chart showing trends for ${lines.map(l => l.dataKey).join(', ')}`}>
        {/* Y-Axis */}
        {[...Array(6)].map((_, i) => {
          const yValue = yDomainMin + i * (yDomainMax - yDomainMin) / 5;
          const yPos = yScale(yValue);
          return (
            <g key={i}>
              <text x={padding - 10} y={yPos + 5} textAnchor="end" fontSize="12" fill={axisColor}>
                {Math.round(yValue)}
              </text>
              <line x1={padding} y1={yPos} x2={padding + width} y2={yPos} stroke={gridColor} strokeDasharray="2,2" />
            </g>
          );
        })}

        {/* X-Axis */}
        {xLabels.map((label, i) => {
          if (i % Math.ceil(xLabels.length / 7) === 0) { // Show up to 7 labels
              return (
                <text key={i} x={xScale(i)} y={height + padding + 20} textAnchor="middle" fontSize="12" fill={axisColor}>
                    {label}
                </text>
              );
          }
          return null;
        })}
        
        {/* Lines */}
        {lines.map(line => (
          <path key={line.dataKey} d={createPath(line.dataKey)} fill="none" stroke={line.color} strokeWidth="2.5" />
        ))}
        
        {/* Vertical hover line and circles */}
        {tooltip && (
          <g>
            <line x1={tooltip.x} y1={padding} x2={tooltip.x} y2={padding + height} stroke="#94a3b8" strokeWidth="1" />
            {lines.map(line => {
                const pointData = data[findClosestIndex(tooltip.x)];
                return (
                     <circle key={line.dataKey} cx={tooltip.x} cy={yScale(pointData[line.dataKey])} r="5" fill={line.color} stroke={theme === 'dark' ? '#fefefe' : '#fff'} strokeWidth="2"/>
                );
            })}
          </g>
        )}
      </svg>
      {/* Legend */}
      <div className="flex justify-center space-x-4 mt-2">
        {lines.map(line => (
          <div key={line.dataKey} className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: line.color }}></span>
            <span className="capitalize">{line.dataKey}</span>
          </div>
        ))}
      </div>
       {/* Tooltip */}
       {tooltip && (
        <div
          className="absolute bg-gray-800 dark:bg-gray-900 text-white p-2 rounded-lg shadow-lg pointer-events-none transition-opacity transform -translate-x-1/2 -translate-y-[calc(100%+15px)]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  );
};

export default LineChart;