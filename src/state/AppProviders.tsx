import type { ReactNode } from 'react';
import { DataProvider, type InitialData } from './DataContext';
import { SettingsProvider, type Settings } from './SettingsContext';

export interface AppProvidersProps {
  children: ReactNode;
  /** Fixed items/base/amount/metalUnit (merged over defaults, normalised); storage is not read. For tests. */
  initialSettings?: Partial<Settings>;
  /** Fixed data; when given, nothing is fetched or polled. For tests. */
  initialData?: InitialData;
}

export function AppProviders({ children, initialSettings, initialData }: AppProvidersProps) {
  return (
    <SettingsProvider initialSettings={initialSettings}>
      <DataProvider initialData={initialData}>{children}</DataProvider>
    </SettingsProvider>
  );
}
