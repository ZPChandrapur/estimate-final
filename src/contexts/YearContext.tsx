import React, { createContext, useContext, useState } from 'react';

interface YearContextType {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
}

const YearContext = createContext<YearContextType>({
  selectedYear: 'all',
  setSelectedYear: () => {},
});

const STORAGE_KEY = 'zp_selected_year';

export const YearProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedYear, setSelectedYearState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || 'all'
  );

  const setSelectedYear = (year: string) => {
    localStorage.setItem(STORAGE_KEY, year);
    setSelectedYearState(year);
  };

  return (
    <YearContext.Provider value={{ selectedYear, setSelectedYear }}>
      {children}
    </YearContext.Provider>
  );
};

export const useYear = () => useContext(YearContext);

export const YEAR_OPTIONS = [
  '2023-24', '2024-25', '2025-26', '2026-27', '2027-28',
  '2028-29', '2029-30', '2030-31', '2031-32', '2032-33', '2033-34',
];
