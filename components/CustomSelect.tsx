import React, { useState, useRef, useEffect } from 'react';
import { ChevronsUpDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  icon?: React.ReactNode;
  headerContent?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ label, value, onChange, options, icon, headerContent }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="group relative" ref={containerRef}>
      <div className="flex items-center justify-between pb-3">
        <p className="text-white text-lg font-medium leading-normal group-focus-within:text-purple-400 transition-colors">
          {label}
        </p>
        {headerContent}
      </div>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative w-full h-12 flex items-center justify-between rounded-lg 
          text-white/90 border border-white/10 bg-white/5 
          focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500
          transition-all px-4 text-sm font-medium
          ${isOpen ? 'ring-2 ring-purple-500/50 border-purple-500' : ''}
        `}
      >
        <div className="flex items-center gap-3 overflow-hidden">
            {icon && <span className="text-white/40 flex-shrink-0">{icon}</span>}
            <span className="truncate">{selectedOption?.label}</span>
        </div>
        <ChevronsUpDown className="text-white/40 w-5 h-5 flex-shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#1A1625] border border-white/10 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top">
          <div className="max-h-52 overflow-y-auto py-1 custom-scrollbar">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center justify-between px-4 py-3 text-sm text-left
                  transition-colors hover:bg-white/10
                  ${option.value === value ? 'text-purple-400 bg-white/5' : 'text-white/80'}
                `}
              >
                <span className="truncate mr-2">{option.label}</span>
                {option.value === value && <Check className="w-4 h-4 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};