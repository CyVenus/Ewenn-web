import { afterEach, describe, expect, it } from 'vitest';
import { APP_STORE_CAMPAIGN_URLS, APP_STORE_URL } from '../config';
import { CAMPAIGN_SOURCE_KEY, appStoreUrlFor, campaignSource, resolveAppStoreUrl } from './campaign';

const IG = APP_STORE_CAMPAIGN_URLS.instagram;
const X = APP_STORE_CAMPAIGN_URLS.x;

/** jsdom has no way to set window.location.search, so each test replaces it wholesale. */
function setSearch(search: string) {
  Object.defineProperty(window, 'location', { writable: true, value: { ...window.location, search } });
}

afterEach(() => {
  setSearch('');
  sessionStorage.clear();
});

describe('APP_STORE_CAMPAIGN_URLS', () => {
  it('tags each ad with its own campaign token and Ewenn as the app', () => {
    expect(IG).toBe('https://apps.apple.com/app/apple-store/id6804755458?pt=128520012&ct=ig_ad_launch_oct26&mt=8');
    expect(X).toBe('https://apps.apple.com/app/apple-store/id6804755458?pt=128520012&ct=x_launch_oct26&mt=8');
  });
});

describe('campaignSource', () => {
  it('reads utm_source from the URL, ignoring case and stray spaces', () => {
    expect(campaignSource('?utm_source=instagram&utm_medium=paid', null)).toBe('instagram');
    expect(campaignSource('?utm_source=%20Instagram%20', null)).toBe('instagram');
    expect(campaignSource('?utm_source=X', null)).toBe('x');
  });

  it('falls back to the remembered source when the URL has none or an empty one', () => {
    expect(campaignSource('', 'instagram')).toBe('instagram');
    expect(campaignSource('?utm_source=', 'x')).toBe('x');
    expect(campaignSource('?phase=night', 'x')).toBe('x');
  });

  it('lets a fresh source in the URL replace the remembered one', () => {
    expect(campaignSource('?utm_source=x', 'instagram')).toBe('x');
  });

  it('is null with nothing in the URL and nothing remembered', () => {
    expect(campaignSource('', null)).toBeNull();
  });
});

describe('appStoreUrlFor', () => {
  const links = { instagram: IG, x: X };

  it('picks the campaign link for a known source', () => {
    expect(appStoreUrlFor('instagram', links, APP_STORE_URL)).toBe(IG);
    expect(appStoreUrlFor('x', links, APP_STORE_URL)).toBe(X);
  });

  it('falls back for an unknown source or none', () => {
    expect(appStoreUrlFor('facebook', links, APP_STORE_URL)).toBe(APP_STORE_URL);
    expect(appStoreUrlFor(null, links, APP_STORE_URL)).toBe(APP_STORE_URL);
  });

  it('never hands back something from the object prototype', () => {
    expect(appStoreUrlFor('toString', links, APP_STORE_URL)).toBe(APP_STORE_URL);
    expect(appStoreUrlFor('__proto__', links, APP_STORE_URL)).toBe(APP_STORE_URL);
    expect(appStoreUrlFor('constructor', links, APP_STORE_URL)).toBe(APP_STORE_URL);
  });
});

describe('resolveAppStoreUrl', () => {
  it('links an ad visitor to their campaign and remembers where they came from', () => {
    setSearch('?utm_source=instagram&utm_medium=paid&utm_campaign=india_launch');
    expect(resolveAppStoreUrl()).toBe(IG);
    expect(sessionStorage.getItem(CAMPAIGN_SOURCE_KEY)).toBe('instagram');
  });

  it('keeps the campaign link after the visitor has clicked around the site', () => {
    sessionStorage.setItem(CAMPAIGN_SOURCE_KEY, 'x');
    expect(resolveAppStoreUrl()).toBe(X);
  });

  it('gives everyone else the listing', () => {
    expect(resolveAppStoreUrl()).toBe(APP_STORE_URL);
    setSearch('?utm_source=newsletter');
    expect(resolveAppStoreUrl()).toBe(APP_STORE_URL);
  });

  it('still honours the URL when storage throws on every access', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    };
    setSearch('?utm_source=instagram');
    expect(resolveAppStoreUrl(blocked)).toBe(IG);
    setSearch('');
    expect(resolveAppStoreUrl(blocked)).toBe(APP_STORE_URL);
  });

  it('works with no storage at all', () => {
    setSearch('?utm_source=x');
    expect(resolveAppStoreUrl(null)).toBe(X);
  });
});
