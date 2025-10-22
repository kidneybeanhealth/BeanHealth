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

  const startLongPress = (e: React.MouseEvent | React.TouchEvent, type: 'systolic' | 'diastolic', action: 'increment' | 'decrement') => {
    e.preventDefault();
    isLongPressRef.current = false;
    
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
    }, 300); // Wait 300ms before starting rapid changes
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
    <div className="w-full max-w-md mx-auto space-y-4 p-4" onKeyDown={handleKeyDown}>
      <div className="text-center">
        <p className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-300">Blood Pressure (mmHg)</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter or adjust values</p>
      </div>

      <div className="flex items-end justify-center gap-2 sm:gap-4">
        {/* Systolic */}
        <div className="flex flex-col items-center flex-shrink-0">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 whitespace-nowrap">
            Systolic
          </label>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => startLongPress(e, 'systolic', 'decrement')}
              onMouseUp={stopLongPress}
              onMouseLeave={stopLongPress}
              onTouchStart={(e) => startLongPress(e, 'systolic', 'decrement')}
              onTouchEnd={stopLongPress}
              className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded-lg transition-colors touch-manipulation"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={systolic}
              onChange={(e) => handleInputChange('systolic', e.target.value)}
              className="w-14 sm:w-16 flex-shrink-0 text-center text-lg sm:text-xl font-bold bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 dark:text-gray-100"
              placeholder=""
            />
            <button
              type="button"
              onMouseDown={(e) => startLongPress(e, 'systolic', 'increment')}
              onMouseUp={stopLongPress}
              onMouseLeave={stopLongPress}
              onTouchStart={(e) => startLongPress(e, 'systolic', 'increment')}
              onTouchEnd={stopLongPress}
              className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded-lg transition-colors touch-manipulation"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Separator */}
        <div className="text-2xl sm:text-3xl font-bold text-gray-400 dark:text-gray-500 pb-1 flex-shrink-0">/</div>

        {/* Diastolic */}
        <div className="flex flex-col items-center flex-shrink-0">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 whitespace-nowrap">
            Diastolic
          </label>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onMouseDown={(e) => startLongPress(e, 'diastolic', 'decrement')}
              onMouseUp={stopLongPress}
              onMouseLeave={stopLongPress}
              onTouchStart={(e) => startLongPress(e, 'diastolic', 'decrement')}
              onTouchEnd={stopLongPress}
              className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded-lg transition-colors touch-manipulation"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={diastolic}
              onChange={(e) => handleInputChange('diastolic', e.target.value)}
              className="w-14 sm:w-16 flex-shrink-0 text-center text-lg sm:text-xl font-bold bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-1 py-1.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 dark:text-gray-100"
              placeholder=""
            />
            <button
              type="button"
              onMouseDown={(e) => startLongPress(e, 'diastolic', 'increment')}
              onMouseUp={stopLongPress}
              onMouseLeave={stopLongPress}
              onTouchStart={(e) => startLongPress(e, 'diastolic', 'increment')}
              onTouchEnd={stopLongPress}
              className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 dark:active:bg-gray-500 rounded-lg transition-colors touch-manipulation"
            >
              <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Current Value Display */}
      <div className="text-center pt-3 border-t border-gray-200 dark:border-gray-700 mx-auto">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Reading</p>
        <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">
          {systolic || '—'}/{diastolic || '—'}
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-center">
        <button
          onClick={onSave}
          className="w-full max-w-xs px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm sm:text-base font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md hover:shadow-lg active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default BloodPressurePicker;
