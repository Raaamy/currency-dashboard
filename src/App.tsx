import { ConverterCard } from '@/components/Converter/ConverterCard';
import { Header } from '@/components/Header/Header';
import { MarketsSection } from '@/components/Markets/MarketsSection';
import { SettingsSheet } from '@/components/Settings/SettingsSheet';

export function App() {
  return (
    <div className="app">
      <main className="layout">
        <Header />
        <ConverterCard />
        <MarketsSection />
      </main>
      <SettingsSheet />
    </div>
  );
}
