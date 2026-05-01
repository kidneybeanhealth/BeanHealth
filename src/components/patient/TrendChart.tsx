/**
 * TrendChart — Reusable chart component using Recharts
 * Supports Tamil (default) ↔ English
 */
import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { useLanguage } from '../../contexts/LanguageContext';

interface DataPoint {
  date: string;
  value: number;
  value2?: number;
}

interface Props {
  title: string;
  data: DataPoint[];
  color?: string;
  color2?: string;
  unit?: string;
  label1?: string;
  label2?: string;
  referenceMin?: number;
  referenceMax?: number;
}

const TrendChart: React.FC<Props> = ({
  title, data, color = '#8AC43C', color2, unit = '',
  label1, label2, referenceMin, referenceMax,
}) => {
  const { t } = useLanguage();

  if (data.length === 0) {
    return (
      <div className="pa-chart-card">
        <div className="pa-chart-title">{title}</div>
        <div className="pa-empty" style={{ padding: '32px 16px' }}>
          <p className="pa-empty-text">{t('trend.noData')}</p>
          <p className="pa-empty-subtext">{t('trend.startRecording')}</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return dateStr; }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)',
        padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: 12,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4, color: '#6B7280' }}>
          {formatDate(label)}
        </div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ fontWeight: 800, color: p.color }}>
            {p.name}: {p.value} {unit}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="pa-chart-card">
      <div className="pa-chart-title">{title}</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
          <XAxis dataKey="date" tickFormatter={formatDate}
            tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }}
            axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fontWeight: 600, fill: '#9CA3AF' }}
            axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          {referenceMin != null && (
            <ReferenceLine y={referenceMin} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.4} />
          )}
          {referenceMax != null && (
            <ReferenceLine y={referenceMax} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.4} />
          )}
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.5}
            dot={{ r: 3, fill: color }} activeDot={{ r: 5, fill: color }}
            name={label1 || title} />
          {color2 && (
            <Line type="monotone" dataKey="value2" stroke={color2} strokeWidth={2.5}
              dot={{ r: 3, fill: color2 }} activeDot={{ r: 5, fill: color2 }}
              name={label2 || 'Value 2'} strokeDasharray="5 3" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendChart;
