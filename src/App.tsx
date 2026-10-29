import { useState } from 'react';
import { ConverterCard } from '@/components/Converter/ConverterCard';
import { Header } from '@/components/Header/Header';
import { MarketsSection } from '@/components/Markets/MarketsSection';
import { SettingsSheet } from '@/components/Settings/SettingsSheet';

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="app">
      <main className="layout">
        <Header onOpenSettings={() => setSettingsOpen(true)} />
        <ConverterCard />
        <MarketsSection />
      </main>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
