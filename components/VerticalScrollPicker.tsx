import React, { useRef, useEffect, useState, useCallback } from 'react';

interface VerticalScrollPickerProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  label?: string;
  unit?: string;
}

/**
 * VerticalScrollPicker - A mobile-inspired scroll picker for numeric values
 * 
 * Features:
 * - Smooth vertical scrolling with snapping to discrete values
 * - Center-focused selection with faded/scaled surrounding values
 * - Mouse wheel, touch, and trackpad support
 * - Keyboard navigation (arrow keys)
 * - Accessibility (ARIA roles and keyboard support)
 * - Theme-aware (uses existing Tailwind theme)
 */
const VerticalScrollPicker: React.FC<VerticalScrollPickerProps> = ({
  value,
  min,
  max,
  onChange,
  label,
  unit
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTickValueRef = useRef<number>(value);

  /**
   * Play a subtle tick sound using Web Audio API
   */
  const playTickSound = useCallback(() => {
    try {
      // Create or reuse AudioContext
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      // Create oscillator for tick sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Short, subtle tick sound (like a clock)
      oscillator.frequency.setValueAtTime(1800, ctx.currentTime);
      oscillator.type = 'sine';
      
      // Quick fade in and out for a soft click
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 0.005);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.03);
    } catch (e) {
      // Silently fail if audio is not supported
    }
  }, []);
  
  // Responsive item height based on viewport
  // Mobile: 40px, Tablet: 44px, Desktop: 48px
  const [itemHeight, setItemHeight] = useState(48);
  const [visibleItems, setVisibleItems] = useState(2);

  // Handle responsive sizing
  useEffect(() => {
    const updateSizing = () => {
      const width = window.innerWidth;
      if (width < 640) {
        // Mobile - smaller items, fewer visible
        setItemHeight(36);
        setVisibleItems(2);
      } else if (width < 1024) {
        // Tablet
        setItemHeight(44);
        setVisibleItems(2);
      } else {
        // Desktop
        setItemHeight(48);
        setVisibleItems(2);
      }
    };

    updateSizing();
    window.addEventListener('resize', updateSizing);
    return () => window.removeEventListener('resize', updateSizing);
  }, []);

  // Generate array of all possible values
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  /**
   * Scrolls the container to center the selected value
   */
  const scrollToValue = useCallback((targetValue: number, smooth = true) => {
    if (!scrollContainerRef.current) return;
    
    const index = targetValue - min;
    const scrollPosition = index * itemHeight;
    
    scrollContainerRef.current.scrollTo({
      top: scrollPosition,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }, [min, itemHeight]);

  /**
   * Initialize scroll position on mount or value/sizing change
   */
  useEffect(() => {
    scrollToValue(value, false);
  }, [value, scrollToValue, itemHeight]);

  /**
   * Handle scroll events - snap to nearest value after scrolling stops
   */
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    setIsScrolling(true);
    
    // Calculate current value from scroll position and play tick if changed
    const scrollTop = scrollContainerRef.current.scrollTop;
    const currentIndex = Math.round(scrollTop / itemHeight);
    const currentValue = Math.max(min, Math.min(max, min + currentIndex));
    
    if (currentValue !== lastTickValueRef.current) {
      playTickSound();
      lastTickValueRef.current = currentValue;
    }
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Debounce: snap to nearest value after 150ms of no scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      if (!scrollContainerRef.current) return;
      
      const scrollTop = scrollContainerRef.current.scrollTop;
      const index = Math.round(scrollTop / itemHeight);
      const snappedValue = Math.max(min, Math.min(max, min + index));
      
      if (snappedValue !== value) {
        onChange(snappedValue);
      }
      
      scrollToValue(snappedValue, true);
      setIsScrolling(false);
    }, 150);
  }, [min, max, value, onChange, scrollToValue, itemHeight, playTickSound]);

  /**
   * Handle wheel events for mouse wheel scrolling
   */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (!scrollContainerRef.current) return;
    
    const delta = e.deltaY > 0 ? 1 : -1;
    const newValue = Math.max(min, Math.min(max, value + delta));
    
    if (newValue !== value) {
      playTickSound();
      onChange(newValue);
    }
  }, [value, min, max, onChange, playTickSound]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newValue = Math.max(min, value - 1);
      if (newValue !== value) {
        playTickSound();
        onChange(newValue);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newValue = Math.min(max, value + 1);
      if (newValue !== value) {
        playTickSound();
        onChange(newValue);
      }
    }
  }, [value, min, max, onChange]);

  /**
   * Handle direct click on a value
   */
  const handleValueClick = useCallback((clickedValue: number) => {
    if (clickedValue !== value) {
      onChange(clickedValue);
    }
  }, [value, onChange]);

  /**
   * Calculate visual styling for each value based on distance from selected value
   */
  const getItemStyle = (itemValue: number): string => {
    const distance = Math.abs(itemValue - value);
    
    if (distance === 0) {
      // Selected value - prominent and fully opaque
      return 'text-gray-900 dark:text-white scale-110 font-bold opacity-100';
    } else if (distance === 1) {
      // Adjacent values - slightly faded
      return 'text-gray-600 dark:text-gray-400 scale-95 opacity-60';
    } else {
      // Distant values - more faded
      return 'text-gray-400 dark:text-gray-600 scale-90 opacity-40';
    }
  };

  /**
   * Cleanup timeout on unmount
   */
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center space-y-1 sm:space-y-2">
      {/* Label */}
      {label && (
        <label className="block text-xs sm:text-xs font-medium text-gray-600 dark:text-gray-400">
          {label}
        </label>
      )}
      
      {/* Scroll picker container - responsive width */}
      <div className="relative w-16 sm:w-20 md:w-24">
        {/* Selection indicator - center line */}
        <div 
          className="absolute left-0 right-0 z-10 pointer-events-none"
          style={{ 
            top: `${visibleItems * itemHeight}px`,
            height: `${itemHeight}px`
          }}
        >
          <div className="w-full h-full border-y-2 border-red-500/20 dark:border-red-400/20 bg-red-50/30 dark:bg-red-900/10 rounded-md sm:rounded-lg" />
        </div>

        {/* Gradient fade overlays - top and bottom (responsive height) */}
        <div 
          className="absolute left-0 right-0 top-0 h-10 sm:h-14 md:h-16 pointer-events-none z-20 bg-gradient-to-b from-white dark:from-transparent to-transparent"
        />
        <div 
          className="absolute left-0 right-0 bottom-0 h-10 sm:h-14 md:h-16 pointer-events-none z-20 bg-gradient-to-t from-white dark:from-transparent to-transparent"
        />

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="listbox"
          aria-label={label || 'Value picker'}
          aria-activedescendant={`value-${value}`}
          className="overflow-y-scroll scrollbar-hide focus:outline-none focus:ring-2 focus:ring-red-500 rounded-md sm:rounded-lg bg-white dark:bg-transparent w-full"
          style={{
            height: `${itemHeight * (visibleItems * 2 + 1)}px`,
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
          }}
        >
          {/* Top padding */}
          <div style={{ height: `${itemHeight * visibleItems}px` }} />
          
          {/* Values list */}
          {values.map((itemValue) => (
            <div
              key={itemValue}
              id={`value-${itemValue}`}
              role="option"
              aria-selected={itemValue === value}
              onClick={() => handleValueClick(itemValue)}
              onMouseEnter={() => setHoveredValue(itemValue)}
              onMouseLeave={() => setHoveredValue(null)}
              className={`
                flex items-center justify-center cursor-pointer
                transition-all duration-200 ease-out select-none
                ${getItemStyle(itemValue)}
                ${hoveredValue === itemValue && itemValue !== value ? 'opacity-80' : ''}
              `}
              style={{ 
                height: `${itemHeight}px`,
                // Responsive font sizes: mobile smaller, desktop larger
                fontSize: itemValue === value 
                  ? (itemHeight < 40 ? '1.5rem' : itemHeight < 48 ? '1.75rem' : '2rem')
                  : (itemHeight < 40 ? '1.125rem' : itemHeight < 48 ? '1.25rem' : '1.5rem'),
                lineHeight: `${itemHeight}px`,
              }}
            >
              {itemValue}
            </div>
          ))}
          
          {/* Bottom padding */}
          <div style={{ height: `${itemHeight * visibleItems}px` }} />
        </div>
      </div>

      {/* Unit label */}
      {unit && (
        <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 font-medium">
          {unit}
        </span>
      )}

      {/* Hidden scrollbar styles */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default VerticalScrollPicker;
