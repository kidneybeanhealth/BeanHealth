import React, { useRef, useEffect, useState } from 'react';

interface BloodPressurePickerProps {
  systolic: string;
  diastolic: string;
  onSystolicChange: (value: string) => void;
  onDiastolicChange: (value: string) => void;
  onSave: () => void;
}

const ScrollPicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
  label: string;
}> = ({ value, onChange, min, max, label }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const currentValue = parseInt(value) || min;
  const currentIndex = values.indexOf(currentValue);
  
  useEffect(() => {
    if (scrollRef.current && !isDragging) {
      const itemHeight = 48; // height of each item
      const scrollPosition = currentIndex * itemHeight;
      scrollRef.current.scrollTo({
        top: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [currentIndex, isDragging]);
  
  const handleScroll = () => {
    if (scrollRef.current && !isDragging) {
      const itemHeight = 48;
      const scrollTop = scrollRef.current.scrollTop;
      const index = Math.round(scrollTop / itemHeight);
      const newValue = values[index];
      if (newValue !== undefined && newValue.toString() !== value) {
        onChange(newValue.toString());
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const currentVal = parseInt(value) || min;
    if (e.deltaY > 0 && currentVal < max) {
      onChange((currentVal + 1).toString());
    } else if (e.deltaY < 0 && currentVal > min) {
      onChange((currentVal - 1).toString());
    }
  };

  return (
    <div className="flex-1">
      <label className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-2 text-center">
        {label}
      </label>
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        className="relative h-48 overflow-y-scroll scrollbar-hide scroll-smooth"
        style={{
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {/* Top padding */}
        <div style={{ height: '96px' }}></div>
        
        {values.map((val) => {
          const isSelected = val === currentValue;
          return (
            <div
              key={val}
              onClick={() => onChange(val.toString())}
              className={`h-12 flex items-center justify-center cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'text-3xl font-bold text-rose-600 dark:text-rose-400 scale-110'
                  : 'text-xl text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'
              }`}
              style={{
                scrollSnapAlign: 'center'
              }}
            >
              {val}
            </div>
          );
        })}
        
        {/* Bottom padding */}
        <div style={{ height: '96px' }}></div>
      </div>
      
      {/* Selection indicator line */}
      <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 pointer-events-none">
        <div className="h-12 border-y-2 border-rose-300 dark:border-rose-700 bg-rose-50/30 dark:bg-rose-900/10"></div>
      </div>
    </div>
  );
};

const BloodPressurePicker: React.FC<BloodPressurePickerProps> = ({
  systolic,
  diastolic,
  onSystolicChange,
  onDiastolicChange,
  onSave
}) => {
  return (
    <div className="relative">
      <div className="flex items-stretch gap-6 py-4">
        <ScrollPicker
          value={systolic}
          onChange={onSystolicChange}
          min={40}
          max={250}
          label="Systolic"
        />
        
        <div className="flex items-center">
          <span className="text-4xl font-bold text-gray-300 dark:text-gray-600">/</span>
        </div>
        
        <ScrollPicker
          value={diastolic}
          onChange={onDiastolicChange}
          min={30}
          max={180}
          label="Diastolic"
        />
      </div>
      
      <div className="flex justify-center mt-4">
        <button
          onClick={onSave}
          className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default BloodPressurePicker;
