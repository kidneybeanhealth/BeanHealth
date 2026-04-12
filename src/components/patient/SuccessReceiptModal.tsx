/**
 * SuccessReceiptModal — A "Payment Screenshot" style success popup
 * Used when a set of vitals or intakes is completely filled and saved.
 * Supports Tamil (default) ↔ English
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import '../../styles/patient.css';

export interface ReceiptItem {
  label: string;
  value: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  titleKey: string;
  items: ReceiptItem[];
}

const SuccessReceiptModal: React.FC<Props> = ({ isOpen, onClose, titleKey, items }) => {
  const { t, lang } = useLanguage();
  const [show, setShow] = useState(false);
  const [timestamp, setTimestamp] = useState('');

  useEffect(() => {
    if (isOpen) {
      setShow(true);
      setTimestamp(new Date().toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-IN', { hour: '2-digit', minute: '2-digit' }));
    } else {
      setTimeout(() => setShow(false), 300);
    }
  }, [isOpen, lang]);

  if (!isOpen && !show) return null;

  return createPortal(
    <div className={`pa-modal-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} style={{ zIndex: 99999 }}>
      <div className={`pa-receipt-card ${isOpen ? 'open' : ''}`} onClick={e => e.stopPropagation()}>
        
        {/* Animated Checkmark Circle */}
        <div className="pa-receipt-check-wrap">
          <div className="pa-receipt-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
        
        <h3 className="pa-receipt-title">{t(titleKey)}</h3>
        
        <div className="pa-receipt-divider" />
        
        <div className="pa-receipt-details">
          {items.map((item, i) => (
            <div key={i} className="pa-receipt-row">
              <span className="pa-receipt-label">{item.label}</span>
              <span className="pa-receipt-value">{item.value}</span>
            </div>
          ))}
          
          <div className="pa-receipt-divider dashed" />
          
          <div className="pa-receipt-row">
            <span className="pa-receipt-label">{t('receipt.recorded')}</span>
            <span className="pa-receipt-value" style={{ color: '#6EA530' }}>{timestamp}</span>
          </div>
        </div>

        <button className="pa-btn-primary" onClick={onClose} style={{ marginTop: 24 }}>
          {t('action.done')}
        </button>
      </div>
    </div>,
    document.body
  );
};

export default SuccessReceiptModal;
