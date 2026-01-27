import React from 'react';
import VerticalScrollPicker from './VerticalScrollPicker';

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
  // Parse values with defaults
  const systolicValue = parseInt(systolic) || 120;
  const diastolicValue = parseInt(diastolic) || 80;

  // Value constraints per medical standards
  const SYSTOLIC_MIN = 70;
  const SYSTOLIC_MAX = 220;
  const DIASTOLIC_MIN = 40;
  const DIASTOLIC_MAX = 140;

  const handleSystolicChange = (value: number) => {
    onSystolicChange(value.toString());
  };

  const handleDiastolicChange = (value: number) => {
    onDiastolicChange(value.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      onSave();
    }
  };

  return (
    <div className="w-full p-3 sm:p-4 space-y-4 sm:space-y-6" onKeyDown={handleKeyDown}>
      {/* Scroll Pickers Container - responsive gap */}
      <div className="flex items-start justify-center gap-4 sm:gap-6 md:gap-8">
        {/* Systolic Picker */}
        <VerticalScrollPicker
          value={systolicValue}
          min={SYSTOLIC_MIN}
          max={SYSTOLIC_MAX}
          onChange={handleSystolicChange}
          label="Systolic"
          unit="mmHg"
        />

        {/* Visual Separator - responsive sizing */}
        <div className="flex items-center pt-6 sm:pt-8">
          <div className="text-2xl sm:text-3xl font-bold text-gray-400 dark:text-gray-600">/</div>
        </div>

        {/* Diastolic Picker */}
        <VerticalScrollPicker
          value={diastolicValue}
          min={DIASTOLIC_MIN}
          max={DIASTOLIC_MAX}
          onChange={handleDiastolicChange}
          label="Diastolic"
          unit="mmHg"
        />
      </div>

      {/* Current Reading Display - responsive text */}
      <div className="text-center pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">Current Reading</p>
        <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">
          {systolic || '—'}/{diastolic || '—'}
        </p>
        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">mmHg</p>
      </div>

      {/* Save Button */}
      <div className="pt-2">
        <button
          onClick={onSave}
          className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-base font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-500 shadow-md active:scale-[0.98]"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default BloodPressurePicker;

