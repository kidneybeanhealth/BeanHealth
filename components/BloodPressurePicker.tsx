import React, { useRef, useEffect } from 'react';

interface BloodPressurePickerProps {
  systolic: string;
  diastolic: string;
  onSystolicChange: (value: string) => void;
  onDiastolicChange: (value: string) => void;
  onSave: () => void;
}

const BloodPressurePicker: React.FC<BloodPressurePickerProps> = ({
  systolic,
  diastolic,
  onSystolicChange,
  onDiastolicChange,
  onSave
}) => {
  const incrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const decrementIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  useEffect(() => {
    return () => {
      // Cleanup intervals on unmount
      if (incrementIntervalRef.current) clearInterval(incrementIntervalRef.current);
      if (decrementIntervalRef.current) clearInterval(decrementIntervalRef.current);
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    };
  }, []);

  const handleIncrement = (type: 'systolic' | 'diastolic') => {
    const value = type === 'systolic' ? parseInt(systolic) || 0 : parseInt(diastolic) || 0;
    const max = type === 'systolic' ? 300 : 200;
    if (value < max) {
      type === 'systolic' ? onSystolicChange((value + 1).toString()) : onDiastolicChange((value + 1).toString());
    }
  };

  const handleDecrement = (type: 'systolic' | 'diastolic') => {
    const value = type === 'systolic' ? parseInt(systolic) || 0 : parseInt(diastolic) || 0;
    if (value > 0) {
      type === 'systolic' ? onSystolicChange((value - 1).toString()) : onDiastolicChange((value - 1).toString());
    }
  };

  const startLongPress = (type: 'systolic' | 'diastolic', action: 'increment' | 'decrement') => {
    // Clear any existing intervals
    stopLongPress();

    // First immediate action
    if (action === 'increment') {
      handleIncrement(type);
    } else {
      handleDecrement(type);
    }

    // Start interval after a short delay for continuous action
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      const intervalRef = action === 'increment' ? incrementIntervalRef : decrementIntervalRef;
      intervalRef.current = setInterval(() => {
        if (action === 'increment') {
          handleIncrement(type);
        } else {
          handleDecrement(type);
        }
      }, 100); // Fast increment/decrement every 100ms
    }, 500); // Wait 500ms before starting rapid changes
  };

  const stopLongPress = () => {
    if (incrementIntervalRef.current) {
      clearInterval(incrementIntervalRef.current);
      incrementIntervalRef.current = null;
    }
    if (decrementIntervalRef.current) {
      clearInterval(decrementIntervalRef.current);
      decrementIntervalRef.current = null;
    }
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    setTimeout(() => {
      isLongPressRef.current = false;
    }, 50);
  };

  const handleInputChange = (type: 'systolic' | 'diastolic', inputValue: string) => {
    // Allow only numbers or empty string
    const numericValue = inputValue.replace(/[^\d]/g, '');
    const max = type === 'systolic' ? 300 : 200;
    
    if (numericValue === '') {
      type === 'systolic' ? onSystolicChange('') : onDiastolicChange('');
      return;
    }
    
    const numValue = parseInt(numericValue) || 0;
    
    if (numValue <= max) {
      type === 'systolic' ? onSystolicChange(numericValue) : onDiastolicChange(numericValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave();
    } else if (e.key === 'Escape') {
      onSave();
    }
  };

  return (
    <div className="w-full space-y-3 p-3" onKeyDown={handleKeyDown}>
      <div className="text-center mb-2">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Blood Pressure (mmHg)</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Enter or adjust values</p>
      </div>

      <div className="flex items-end justify-center gap-1.5 overflow-hidden">
        {/* Systolic */}
        <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Systolic
          </label>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onPointerDown={() => startLongPress('systolic', 'decrement')}
              onPointerUp={stopLongPress}
              onPointerLeave={stopLongPress}
              onPointerCancel={stopLongPress}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded transition-colors select-none"
              style={{ touchAction: 'manipulation' }}
            >
              <span className="text-lg font-bold leading-none">−</span>
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={systolic}
              onChange={(e) => handleInputChange('systolic', e.target.value)}
              className="w-12 flex-shrink-0 text-center text-lg font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-0.5 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 text-gray-900 dark:text-gray-100"
              placeholder=""
            />
            <button
              type="button"
              onPointerDown={() => startLongPress('systolic', 'increment')}
              onPointerUp={stopLongPress}
              onPointerLeave={stopLongPress}
              onPointerCancel={stopLongPress}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded transition-colors select-none"
              style={{ touchAction: 'manipulation' }}
            >
              <span className="text-lg font-bold leading-none">+</span>
            </button>
          </div>
        </div>

        {/* Separator */}
        <div className="text-xl font-bold text-gray-400 dark:text-gray-500 pb-0.5 flex-shrink-0">/</div>

        {/* Diastolic */}
        <div className="flex flex-col items-center" style={{ minWidth: 0 }}>
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Diastolic
          </label>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onPointerDown={() => startLongPress('diastolic', 'decrement')}
              onPointerUp={stopLongPress}
              onPointerLeave={stopLongPress}
              onPointerCancel={stopLongPress}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded transition-colors select-none"
              style={{ touchAction: 'manipulation' }}
            >
              <span className="text-lg font-bold leading-none">−</span>
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={diastolic}
              onChange={(e) => handleInputChange('diastolic', e.target.value)}
              className="w-12 flex-shrink-0 text-center text-lg font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-0.5 py-1 focus:outline-none focus:ring-1 focus:ring-red-500 text-gray-900 dark:text-gray-100"
              placeholder=""
            />
            <button
              type="button"
              onPointerDown={() => startLongPress('diastolic', 'increment')}
              onPointerUp={stopLongPress}
              onPointerLeave={stopLongPress}
              onPointerCancel={stopLongPress}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded transition-colors select-none"
              style={{ touchAction: 'manipulation' }}
            >
              <span className="text-lg font-bold leading-none">+</span>
            </button>
          </div>
        </div>
      </div>

      {/* Current Value Display */}
      <div className="text-center pt-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Current Reading</p>
        <p className="text-xl font-bold text-red-600 dark:text-red-400">
          {systolic || '—'}/{diastolic || '—'}
        </p>
      </div>

      {/* Save Button */}
      <div className="text-center">
        <button
          onClick={onSave}
          className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-500 shadow-md active:scale-[0.98]"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default BloodPressurePicker;
