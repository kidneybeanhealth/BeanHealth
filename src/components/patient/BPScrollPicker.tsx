/**
 * BPScrollPicker — iOS-style scroll wheel picker for Blood Pressure
 * Drag/swipe to select systolic & diastolic values
 * Supports Tamil (default) ↔ English
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';

interface WheelProps {
  values: (number | string)[];
  selected: number | string;
  onChange: (v: number | string) => void;
  label: string;
  color: string;
}

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 3; // total visible rows (1 above + selected + 1 below)

const ScrollWheel: React.FC<WheelProps> = ({ values, selected, onChange, label, color }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const isProgrammaticScroll = useRef(true);

  // Initialize scroll position
  useEffect(() => {
    if (containerRef.current) {
      const selectedIdx = Math.max(0, values.indexOf(selected));
      const initOffset = selectedIdx * ITEM_HEIGHT;
      containerRef.current.scrollTop = initOffset;
      setOffset(initOffset);
      
      // Allow the DOM to settle
      setTimeout(() => {
        isProgrammaticScroll.current = false;
      }, 300);
    }
  }, [selected, values.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    setOffset(top);

    if (isProgrammaticScroll.current) return;

    // Debounce the change callback to only trigger once scrolling settles
    clearTimeout((containerRef.current as any)?._scrollTimeout);
    (containerRef.current as any)._scrollTimeout = setTimeout(() => {
      const idx = Math.round(top / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(idx, values.length - 1));
      onChange(values[clamped]);
    }, 150);
  };

  // Hold-to-scroll for arrows
  const intervalRef = useRef<number | undefined>(undefined);

  const startHoldUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent text selection/zoom
    const step = () => {
      if (containerRef.current) containerRef.current.scrollBy({ top: -ITEM_HEIGHT * 2, behavior: 'smooth' });
    };
    step();
    intervalRef.current = window.setInterval(step, 200);
  };

  const startHoldDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const step = () => {
      if (containerRef.current) containerRef.current.scrollBy({ top: ITEM_HEIGHT * 2, behavior: 'smooth' });
    };
    step();
    intervalRef.current = window.setInterval(step, 200);
  };

  const stopHold = () => {
    clearInterval(intervalRef.current);
  };

  const containerHeight = VISIBLE_ITEMS * ITEM_HEIGHT;
  const paddingTop = Math.floor(VISIBLE_ITEMS / 2) * ITEM_HEIGHT;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
        {label}
      </span>
      
      <button 
        className="pa-wheel-arrow" 
        onMouseDown={startHoldUp} onMouseUp={stopHold} onMouseLeave={stopHold}
        onTouchStart={startHoldUp} onTouchEnd={stopHold} onTouchCancel={stopHold}
        tabIndex={-1}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      
      <div
        className="pa-hide-scrollbar"
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          width: 80, height: containerHeight,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          position: 'relative',
          userSelect: 'none', borderRadius: 14,
          background: '#F9FAFB',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Selection highlight band */}
        <div style={{
          position: 'sticky', top: paddingTop, left: 4, right: 4,
          height: 0, zIndex: 0, pointerEvents: 'none'
        }}>
          <div style={{
            height: ITEM_HEIGHT, borderRadius: 10,
            background: color === 'red'
              ? 'linear-gradient(135deg, #FEF2F2, #FEE2E2)'
              : 'linear-gradient(135deg, #EFF6FF, #DBEAFE)',
            border: `1.5px solid ${color === 'red' ? '#FECACA' : '#BFDBFE'}`
          }} />
        </div>

        {/* Add padding at start and end to allow snapping of first/last items to center */}
        <div style={{ height: paddingTop }} />

        {/* Values */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {values.map((v, i) => {
            const distFromCenter = Math.abs(i * ITEM_HEIGHT - offset);
            const scale = Math.max(0.7, 1 - distFromCenter / (ITEM_HEIGHT * 3));
            const opacity = Math.max(0.2, 1 - distFromCenter / (ITEM_HEIGHT * 2.5));
            const isSelected = distFromCenter < ITEM_HEIGHT / 2;

            return (
              <div key={v} style={{
                height: ITEM_HEIGHT, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                transform: `scale(${scale})`,
                opacity,
                scrollSnapAlign: 'center',
                transition: 'opacity 0.1s ease, transform 0.1s ease',
              }}>
                <span style={{
                  fontSize: isSelected ? 28 : 20,
                  fontWeight: isSelected ? 900 : 600,
                  color: isSelected
                    ? (color === 'red' ? '#EF4444' : '#3B82F6')
                    : '#9CA3AF',
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {v}
                </span>
              </div>
            );
          })}
        </div>
        
        <div style={{ height: paddingTop }} />
      </div>

      <button 
        className="pa-wheel-arrow" 
        onMouseDown={startHoldDown} onMouseUp={stopHold} onMouseLeave={stopHold}
        onTouchStart={startHoldDown} onTouchEnd={stopHold} onTouchCancel={stopHold}
        tabIndex={-1}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
};

// ── Main BP Picker Component ──

interface BPScrollPickerProps {
  systole: number | null | undefined;
  diastole: number | null | undefined;
  onConfirm: (sys: number, dia: number) => void;
  onClose: () => void;
}

const BPScrollPicker: React.FC<BPScrollPickerProps> = ({ systole, diastole, onConfirm, onClose }) => {
  const { t } = useLanguage();
  const [sys, setSys] = useState<number | string>(systole || '—');
  const [dia, setDia] = useState<number | string>(diastole || '—');

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    if (sys !== (systole || '—') || dia !== (diastole || '—')) {
      if (!window.confirm(t('bp.discardChanges'))) return;
    }
    onClose();
  };

  const handleConfirm = () => {
    if (sys === '—' || dia === '—') {
      alert(t('bp.pleaseSelect') || 'Please select valid BP values');
      return;
    }
    if (window.confirm(`${t('bp.confirmSave')} ${sys}/${dia} mmHg?`)) {
      onConfirm(sys as number, dia as number);
    }
  };

  // Generate value ranges
  const sysValues: (number | string)[] = ['—', ...Array.from({ length: 141 }, (_, i) => 60 + i)]; // 60–200
  const diaValues: (number | string)[] = ['—', ...Array.from({ length: 101 }, (_, i) => 40 + i)]; // 40–140

  const getBPCategory = (s: number | string, d: number | string) => {
    if (s === '—' || d === '—') return { label: t('bp.selectValue') || 'Select BP', color: '#6B7280', bg: '#F3F4F6' };
    const numS = s as number;
    const numD = d as number;
    if (numS < 90 || numD < 60) return { label: t('bp.low'), color: '#3B82F6', bg: '#EFF6FF' };
    if (numS <= 120 && numD <= 80) return { label: t('bp.normal'), color: '#22C55E', bg: '#F0FDF4' };
    if (numS <= 139 || numD <= 89) return { label: t('bp.elevated'), color: '#F59E0B', bg: '#FFFBEB' };
    return { label: t('bp.high'), color: '#EF4444', bg: '#FEF2F2' };
  };

  const category = getBPCategory(sys, dia);

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      {/* Backdrop */}
      <div onClick={handleClose} style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      }} />

      {/* Sheet */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 400,
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '16px 24px 32px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
        animation: 'pa-slide-up 0.3s ease',
      }}>
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 99,
          background: '#E5E7EB', margin: '0 auto 16px',
        }} />

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A', margin: 0 }}>
            {t('bp.title')}
          </h3>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', margin: '4px 0 0' }}>
            {t('bp.subtitle')}
          </p>
        </div>

        {/* Live reading display */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, marginBottom: 20,
        }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: '#EF4444', fontVariantNumeric: 'tabular-nums' }}>
            {sys}
          </span>
          <span style={{ fontSize: 28, fontWeight: 300, color: '#D1D5DB' }}>/</span>
          <span style={{ fontSize: 36, fontWeight: 900, color: '#3B82F6', fontVariantNumeric: 'tabular-nums' }}>
            {dia}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginLeft: 4 }}>mmHg</span>
        </div>

        {/* Category badge */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 99,
            background: category.bg, color: category.color,
            fontSize: 12, fontWeight: 800,
            border: `1px solid ${category.color}20`,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: category.color,
              boxShadow: `0 0 6px ${category.color}80`,
            }} />
            {category.label}
          </span>
        </div>

        {/* Scroll wheels */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 24,
          marginBottom: 24,
        }}>
          <ScrollWheel
            values={sysValues}
            selected={sys as any}
            onChange={(val: any) => setSys(val)}
            label={t('bp.systolic')}
            color="red"
          />

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center',
            fontSize: 32, fontWeight: 200, color: '#E5E7EB',
          }}>
            /
          </div>

          <ScrollWheel
            values={diaValues}
            selected={dia as any}
            onChange={(val: any) => setDia(val)}
            label={t('bp.diastolic')}
            color="blue"
          />
        </div>

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={sys === '—' || dia === '—'}
          style={{
            width: '100%', padding: '14px',
            background: sys === '—' || dia === '—' ? '#D1D5DB' : 'linear-gradient(135deg, #6EA530, #8AC43C)',
            color: '#fff', border: 'none', borderRadius: 14,
            fontSize: 15, fontWeight: 800, 
            cursor: sys === '—' || dia === '—' ? 'not-allowed' : 'pointer',
            boxShadow: sys === '—' || dia === '—' ? 'none' : '0 4px 16px rgba(110, 165, 48, 0.3)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
          }}
          onMouseDown={e => { if (sys !== '—' && dia !== '—') e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          {t('bp.confirm')} {sys}/{dia} mmHg
        </button>
      </div>
    </div>,
    document.body
  );
};

export default BPScrollPicker;
