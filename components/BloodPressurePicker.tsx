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

  const increment = () => {
    const currentVal = parseInt(value) || min;
    if (currentVal < max) {
      onChange((currentVal + 1).toString());
    }
  };

  const decrement = () => {
    const currentVal = parseInt(value) || min;
    if (currentVal > min) {
      onChange((currentVal - 1).toString());
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center">
      <label className="text-xs font-semibold text-red-700 dark:text-red-400 block mb-2 text-center uppercase tracking-wider">
        {label}
      </label>
      
      {/* Increment button */}
      <button
        onClick={increment}
        className="w-12 h-10 flex items-center justify-center bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg mb-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 active:scale-95"
      >
        <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
        </svg>
      </button>
      
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={() => setIsDragging(false)}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        className="relative h-48 w-full overflow-y-scroll scrollbar-hide scroll-smooth"
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
                  ? 'text-3xl font-bold text-red-600 dark:text-red-400 scale-110'
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
        <div className="h-12 border-y-2 border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-900/10"></div>
      </div>
      
      {/* Decrement button */}
      <button
        onClick={decrement}
        className="w-12 h-10 flex items-center justify-center bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg mt-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-500 active:scale-95"
      >
        <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
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
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave();
    } else if (e.key === 'Escape') {
      onSave();
    }
  };

  return (
    <div className="relative" onKeyDown={handleKeyDown}>
      <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 border-2 border-red-200 dark:border-red-900">
        <div className="text-center mb-3">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Blood Pressure (mmHg)</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scroll or click to adjust</p>
        </div>
        
        <div className="flex items-stretch gap-4 py-4">
          <ScrollPicker
            value={systolic}
            onChange={onSystolicChange}
            min={40}
            max={250}
            label="Systolic"
          />
          
          <div className="flex items-center">
            <span className="text-4xl font-bold text-red-400 dark:text-red-600">/</span>
          </div>
          
          <ScrollPicker
            value={diastolic}
            onChange={onDiastolicChange}
            min={30}
            max={180}
            label="Diastolic"
          />
        </div>
        
        <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-red-200 dark:border-red-900">
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">
              {systolic}/{diastolic}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Current selection</p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center mt-4 gap-3">
        <button
          onClick={onSave}
          className="px-8 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 shadow-md hover:shadow-lg active:scale-95"
        >
          Save Blood Pressure
        </button>
      </div>
    </div>
  );
};

export default BloodPressurePicker;
