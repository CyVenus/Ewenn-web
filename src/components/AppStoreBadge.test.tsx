import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const store = { id: '', url: '' };

vi.mock('../config', async () => {
  const actual = await vi.importActual<typeof import('../config')>('../config');
  return {
    ...actual,
    get APP_STORE_ID() {
      return store.id;
    },
    get APP_STORE_LIVE() {
      return /^\d+$/.test(store.id);
    },
    get APP_STORE_URL() {
      if (store.url !== '') return store.url;
      return store.id ? `https://apps.apple.com/app/id${store.id}` : 'https://apps.apple.com/in/iphone/apps';
    },
  };
});

async function renderBadge(options?: { id?: string; url?: string }) {
  store.id = options?.id ?? '';
  store.url = options?.url ?? '';
  vi.resetModules();
  const { AppStoreBadge } = await import('./AppStoreBadge');
  return render(<AppStoreBadge />);
}

/** jsdom has no way to set window.location.search, so each test replaces it wholesale. */
function setSearch(search: string) {
  Object.defineProperty(window, 'location', { writable: true, value: { ...window.location, search } });
}

afterEach(() => {
  store.id = '';
  store.url = '';
  setSearch('');
  sessionStorage.clear();
});

describe('AppStoreBadge', () => {
  it('renders Apple official artwork', async () => {
    const { container } = await renderBadge();
    const img = container.querySelector('img.store-badge__img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('app-store-badge'));
  });

  it('renders a link to the default App Store URL when no ID is set', async () => {
    await renderBadge();
    const link = screen.getByRole('link', { name: 'Download Ewenn on the App Store' });
    expect(link).toHaveAttribute('href', 'https://apps.apple.com/in/iphone/apps');
  });

  it('opens the App Store in a new tab with noopener noreferrer security attributes', async () => {
    await renderBadge();
    const link = screen.getByRole('link', { name: 'Download Ewenn on the App Store' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('links to the specific App Store ID when set', async () => {
    await renderBadge({ id: '1234567890' });
    const link = screen.getByRole('link', { name: 'Download Ewenn on the App Store' });
    expect(link).toHaveAttribute('href', 'https://apps.apple.com/app/id1234567890');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('supports custom URL override', async () => {
    await renderBadge({ url: 'https://apps.apple.com/app/custom-app/id999999' });
    const link = screen.getByRole('link', { name: 'Download Ewenn on the App Store' });
    expect(link).toHaveAttribute('href', 'https://apps.apple.com/app/custom-app/id999999');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('does not dim, tint or otherwise alter the artwork', async () => {
    const { container } = await renderBadge();
    const img = container.querySelector('img.store-badge__img') as HTMLElement;
    expect(img.style.filter).toBe('');
    expect(img.style.opacity).toBe('');
    expect(img.className).toBe('store-badge__img');
  });

  it('links a visitor from the Instagram ad to its campaign link', async () => {
    setSearch('?utm_source=instagram&utm_medium=paid');
    await renderBadge({ id: '6804755458' });
    const link = screen.getByRole('link', { name: 'Download Ewenn on the App Store' });
    expect(link.getAttribute('href')).toMatch(/[?&]ct=ig_ad_launch_oct26&mt=8$/);
  });

  it('keeps the campaign link once the visitor comes back without the query', async () => {
    sessionStorage.setItem('ewenn:utm_source', 'x');
    await renderBadge({ id: '6804755458' });
    const link = screen.getByRole('link', { name: 'Download Ewenn on the App Store' });
    expect(link.getAttribute('href')).toMatch(/[?&]ct=x_launch_oct26&mt=8$/);
  });

  it('falls back to a plain image when APP_STORE_URL is empty', async () => {
    // When URL is explicitly configured as empty
    vi.doMock('../config', async () => ({
      APP_STORE_URL: '',
      APP_STORE_CAMPAIGN_URLS: {},
    }));
    vi.resetModules();
    const { AppStoreBadge } = await import('./AppStoreBadge');
    const { container } = render(<AppStoreBadge />);
    expect(container.querySelector('a')).toBeNull();
    expect(screen.getByRole('img', { name: 'Ewenn is coming soon to the App Store' })).toBeInTheDocument();
  });
});
