import { isLiveAppStoreId } from '../config.ts';

export type HeadTag = { tag: 'meta' | 'link'; attrs: Record<string, string> };

/**
 * `path` is the page's own canonical path, so each document points at itself. Every page
 * used to receive `canonical: /`, which was inert only because SITE_URL was empty -- with
 * an origin set it would have told search engines that the privacy policy was the home page.
 */
export function buildHeadTags({
  siteUrl,
  appStoreId,
  path,
}: {
  siteUrl: string;
  appStoreId: string;
  path: string;
}): HeadTag[] {
  const origin = siteUrl.replace(/\/+$/, '');
  // `?v=2` is the 2026-10-24 share image; bump it whenever og-image.png changes.
  const shareImage = `${origin}/og-image.png?v=2`;
  const tags: HeadTag[] = [
    { tag: 'meta', attrs: { property: 'og:image', content: shareImage } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: shareImage } },
  ];
  if (origin) {
    tags.push({ tag: 'link', attrs: { rel: 'canonical', href: `${origin}${path}` } });
    tags.push({ tag: 'meta', attrs: { property: 'og:url', content: `${origin}${path}` } });
  }
  if (isLiveAppStoreId(appStoreId)) {
    tags.push({ tag: 'meta', attrs: { name: 'apple-itunes-app', content: `app-id=${appStoreId}` } });
  }
  return tags;
}
