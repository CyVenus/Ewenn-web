import { APP_STORE_CAMPAIGN_URLS, APP_STORE_URL } from '../config';

/** Where the landing page's `utm_source` is kept, so it outlives a visit to the doc pages. */
export const CAMPAIGN_SOURCE_KEY = 'ewenn:utm_source';

/**
 * This URL's `utm_source`, else the one remembered from earlier in the tab. A fresh source in the
 * URL always wins, so the most recent ad a visitor came through is the one credited.
 */
export function campaignSource(search: string, remembered: string | null): string | null {
  const fromUrl = new URLSearchParams(search).get('utm_source')?.trim().toLowerCase();
  return fromUrl || remembered;
}

/**
 * `Object.hasOwn` rather than `links[source]`, or `?utm_source=toString` would hand the badge a
 * function from the object's prototype for its href.
 */
export function appStoreUrlFor(
  source: string | null,
  links: Readonly<Record<string, string>>,
  fallback: string,
): string {
  return source !== null && Object.hasOwn(links, source) ? links[source] : fallback;
}

/**
 * The badge's href for this visitor. Storage is wrapped because Safari with cookies blocked, and
 * some in-app browsers, throw on any access: the URL's own source still applies, it just isn't
 * remembered.
 */
export function resolveAppStoreUrl(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null = sessionStorageOrNull(),
): string {
  let remembered: string | null = null;
  try {
    remembered = storage?.getItem(CAMPAIGN_SOURCE_KEY) ?? null;
  } catch {
    // Unreadable storage is the same as nothing remembered.
  }
  const source = campaignSource(window.location.search, remembered);
  if (source !== null && source !== remembered) {
    try {
      storage?.setItem(CAMPAIGN_SOURCE_KEY, source);
    } catch {
      // Not remembered, which only matters if the visitor leaves the home page first.
    }
  }
  return appStoreUrlFor(source, APP_STORE_CAMPAIGN_URLS, APP_STORE_URL);
}

/** Merely reading `window.sessionStorage` throws where storage is blocked. */
function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
