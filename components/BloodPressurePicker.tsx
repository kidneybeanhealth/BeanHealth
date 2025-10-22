import React from 'react';

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

  const handleInputChange = (type: 'systolic' | 'diastolic', inputValue: string) => {
    // Allow only numbers
    const numericValue = inputValue.replace(/[^\d]/g, '');
    const value = numericValue === '' ? '0' : numericValue;
    const max = type === 'systolic' ? 300 : 200;
    const numValue = parseInt(value) || 0;
    
    if (numValue <= max) {
      type === 'systolic' ? onSystolicChange(value) : onDiastolicChange(value);
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
    <div className="space-y-3 sm:space-y-4 p-4 sm:p-0" onKeyDown={handleKeyDown}>
      <div className="text-center mb-3 sm:mb-4">
        <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Blood Pressure (mmHg)</p>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">Enter or adjust values</p>
      </div>

      <div className="flex items-center justify-center gap-2 sm:gap-6">
        {/* Systolic */}
        <div className="flex-1 max-w-[120px] sm:max-w-[140px]">
          <label className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5 sm:mb-2 text-center">
            Systolic
          </label>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => handleDecrement('systolic')}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors active:scale-95 flex-shrink-0"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={systolic}
              onChange={(e) => handleInputChange('systolic', e.target.value)}
              className="w-14 sm:w-20 text-center text-xl sm:text-2xl font-bold bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-1 sm:px-2 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => handleIncrement('systolic')}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors active:scale-95 flex-shrink-0"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Separator */}
        <div className="text-2xl sm:text-3xl font-bold text-gray-400 dark:text-gray-500 mt-4 sm:mt-6 flex-shrink-0">/</div>

        {/* Diastolic */}
        <div className="flex-1 max-w-[120px] sm:max-w-[140px]">
          <label className="text-[10px] sm:text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5 sm:mb-2 text-center">
            Diastolic
          </label>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => handleDecrement('diastolic')}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors active:scale-95 flex-shrink-0"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={diastolic}
              onChange={(e) => handleInputChange('diastolic', e.target.value)}
              className="w-14 sm:w-20 text-center text-xl sm:text-2xl font-bold bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg px-1 sm:px-2 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={() => handleIncrement('diastolic')}
              className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors active:scale-95 flex-shrink-0"
            >
              <svg className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Current Value Display */}
      <div className="text-center mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1">Current Reading</p>
        <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">
          {systolic || '0'}/{diastolic || '0'}
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-center mt-3 sm:mt-4">
        <button
          onClick={onSave}
          className="w-full sm:w-auto px-6 sm:px-8 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm sm:text-base font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md hover:shadow-lg active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default BloodPressurePicker;
