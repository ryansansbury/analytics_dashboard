/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { subDays, subMonths, format } from 'date-fns';
import type { DateRange, FilterState } from '../types';

type DatePreset = 'last30d' | 'last90d' | 'lastYear' | 'custom';

function getDateRangeFromPreset(preset: DatePreset): DateRange {
  const today = new Date();
  const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');

  switch (preset) {
    case 'last30d':
      return {
        startDate: formatDate(subDays(today, 30)),
        endDate: formatDate(today),
        preset,
      };
    case 'last90d':
      return {
        startDate: formatDate(subDays(today, 90)),
        endDate: formatDate(today),
        preset,
      };
    case 'lastYear':
      return {
        startDate: formatDate(subMonths(today, 12)),
        endDate: formatDate(today),
        preset,
      };
    default:
      return {
        startDate: formatDate(subDays(today, 30)),
        endDate: formatDate(today),
        preset: 'last30d',
      };
  }
}

interface FilterContextType {
  filters: FilterState;
  setDateRange: (range: DateRange) => void;
  setDatePreset: (preset: DatePreset) => void;
  setRegion: (region: string | undefined) => void;
  setSegment: (segment: string | undefined) => void;
  setCategory: (category: string | undefined) => void;
  resetFilters: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

const defaultFilters: FilterState = {
  dateRange: getDateRangeFromPreset('last90d'),
  region: undefined,
  segment: undefined,
  category: undefined,
};

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const setDateRange = useCallback((range: DateRange) => {
    setFilters((prev) => ({ ...prev, dateRange: range }));
  }, []);

  const setDatePreset = useCallback((preset: DatePreset) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: getDateRangeFromPreset(preset),
    }));
  }, []);

  const setRegion = useCallback((region: string | undefined) => {
    setFilters((prev) => ({ ...prev, region }));
  }, []);

  const setSegment = useCallback((segment: string | undefined) => {
    setFilters((prev) => ({ ...prev, segment }));
  }, []);

  const setCategory = useCallback((category: string | undefined) => {
    setFilters((prev) => ({ ...prev, category }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  return (
    <FilterContext.Provider
      value={{
        filters,
        setDateRange,
        setDatePreset,
        setRegion,
        setSegment,
        setCategory,
        resetFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextType {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}

export { getDateRangeFromPreset };
export type { DatePreset };
