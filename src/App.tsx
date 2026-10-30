import { ConverterCard } from '@/components/Converter/ConverterCard';
import { Header } from '@/components/Header/Header';
import { MarketsSection } from '@/components/Markets/MarketsSection';

export function App() {
  return (
    <div className="app">
      <main className="layout">
        <Header />
        <ConverterCard />
        <MarketsSection />
      </main>
    </div>
  );
}
