import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '@/App';
import { AppProviders } from '@/state/AppProviders';

const rates = {
  base: 'EUR' as const,
  rates: { EUR: 1, USD: 1.1, GBP: 0.85, AED: 4 },
  fetchedAt: 0,
  publishedAt: Date.UTC(2026, 9, 29, 2, 2),
};

const originalShowModal = HTMLDialogElement.prototype.showModal;
const originalClose = HTMLDialogElement.prototype.close;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

afterAll(() => {
  HTMLDialogElement.prototype.showModal = originalShowModal;
  HTMLDialogElement.prototype.close = originalClose;
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
  document.body.style.overflow = '';
});

function renderApp() {
  return render(
    <AppProviders initialSettings={{ language: 'nl', theme: 'system' }} initialData={{ rates }}>
      <App />
    </AppProviders>,
  );
}

const caption = () => screen.getByRole('banner').querySelector('p') as HTMLElement;
const dialog = () => document.querySelector('dialog') as HTMLDialogElement;

describe('Header + SettingsSheet', () => {
  it('switching to English changes the header caption and the sheet title', () => {
    renderApp();
    expect(caption()).toHaveTextContent('Koersen bijgewerkt');
    expect(dialog()).not.toHaveAttribute('open');

    fireEvent.click(screen.getByRole('button', { name: 'Instellingen' }));
    expect(dialog()).toHaveAttribute('open');
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Sluiten' })).toHaveFocus();

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(caption()).toHaveTextContent('Rates updated');
    expect(within(dialog()).getByRole('heading', { level: 2 })).toHaveTextContent('Settings');
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
  });

  it('appearance sets and clears data-theme on <html>', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Instellingen' }));

    fireEvent.click(screen.getByRole('radio', { name: 'Donker' }));
    expect(document.documentElement.dataset.theme).toBe('dark');

    fireEvent.click(screen.getByRole('radio', { name: 'Systeem' }));
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });

  it('close button, Escape and backdrop click close the dialog', async () => {
    renderApp();
    const open = () => fireEvent.click(screen.getByRole('button', { name: 'Instellingen' }));

    open();
    fireEvent.click(screen.getByRole('button', { name: 'Sluiten' }));
    await waitFor(() => expect(dialog()).not.toHaveAttribute('open'));
    expect(document.body.style.overflow).toBe('');

    open();
    expect(dialog()).toHaveAttribute('open');
    fireEvent(dialog(), new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(dialog()).not.toHaveAttribute('open'));

    open();
    fireEvent.click(within(dialog()).getByRole('heading', { level: 2 }));
    expect(dialog()).toHaveAttribute('open');
    fireEvent.click(dialog());
    await waitFor(() => expect(dialog()).not.toHaveAttribute('open'));
  });

  it('shows a dash when there are no rates', () => {
    render(
      <AppProviders initialSettings={{ language: 'en', theme: 'system' }} initialData={{}}>
        <App />
      </AppProviders>,
    );
    expect(caption()).toHaveTextContent('Rates updated —');
  });
});
