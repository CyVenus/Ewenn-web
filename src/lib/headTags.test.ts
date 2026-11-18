import { describe, expect, it } from 'vitest';
import { buildHeadTags, type HeadTag } from './headTags';

const find = (tags: HeadTag[], key: string, value: string) => tags.find((tag) => tag.attrs[key] === value);

describe('buildHeadTags', () => {
  it('points each page canonical at itself, not at the home page', () => {
    const tags = buildHeadTags({ siteUrl: 'https://ewenn.app', appStoreId: '', path: '/privacy/' });
    expect(find(tags, 'rel', 'canonical')?.attrs.href).toBe('https://ewenn.app/privacy/');
    expect(find(tags, 'property', 'og:url')?.attrs.content).toBe('https://ewenn.app/privacy/');
  });

  it('gives the home page its own canonical', () => {
    const tags = buildHeadTags({ siteUrl: 'https://ewenn.app', appStoreId: '', path: '/' });
    expect(find(tags, 'rel', 'canonical')?.attrs.href).toBe('https://ewenn.app/');
  });

  it('emits an absolute share image, which relative URLs cannot be', () => {
    const tags = buildHeadTags({ siteUrl: 'https://ewenn.app', appStoreId: '', path: '/' });
    expect(find(tags, 'property', 'og:image')?.attrs.content).toBe('https://ewenn.app/og-image.png?v=2');
    expect(find(tags, 'name', 'twitter:image')?.attrs.content).toBe('https://ewenn.app/og-image.png?v=2');
  });

  it('tolerates a trailing slash on the origin', () => {
    const tags = buildHeadTags({ siteUrl: 'https://ewenn.app/', appStoreId: '', path: '/terms/' });
    expect(find(tags, 'rel', 'canonical')?.attrs.href).toBe('https://ewenn.app/terms/');
  });

  it('omits canonical entirely when no origin is configured', () => {
    const tags = buildHeadTags({ siteUrl: '', appStoreId: '', path: '/' });
    expect(find(tags, 'rel', 'canonical')).toBeUndefined();
  });

  /**
   * The Smart App Banner and the App Store badge must never disagree about whether the app is
   * live, which is why both ask the same predicate rather than each testing the ID themselves.
   */
  it('omits the Smart App Banner while the App Store ID is a placeholder', () => {
    const tags = buildHeadTags({ siteUrl: 'https://ewenn.app', appStoreId: '', path: '/' });
    expect(find(tags, 'name', 'apple-itunes-app')).toBeUndefined();
  });

  it('emits the Smart App Banner from the same ID that gates the badge', () => {
    const tags = buildHeadTags({ siteUrl: 'https://ewenn.app', appStoreId: '1234567890', path: '/' });
    expect(find(tags, 'name', 'apple-itunes-app')?.attrs.content).toBe('app-id=1234567890');
  });

  it('never emits a banner for a non-numeric ID', () => {
    for (const id of ['TODO', 'id1234567890', '123abc', ' 123']) {
      const tags = buildHeadTags({ siteUrl: 'https://ewenn.app', appStoreId: id, path: '/' });
      expect(find(tags, 'name', 'apple-itunes-app'), id).toBeUndefined();
    }
  });
});
