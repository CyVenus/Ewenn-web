import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DOC_ROUTES } from '../lib/routes';
import type { Doc } from './doc';
import { PRIVACY_DOC } from './privacy';
import { SUPPORT_DOC } from './support';
import { TERMS_DOC } from './terms';

const DOCS: [string, Doc][] = [
  ['privacy', PRIVACY_DOC],
  ['terms', TERMS_DOC],
  ['support', SUPPORT_DOC],
];

describe.each(DOCS)('%s document', (name, doc) => {
  it('has a title, a description and an updated date', () => {
    expect(doc.title).toBeTruthy();
    expect(doc.description).toBeTruthy();
    expect(doc.updated).toMatch(/^Last updated /);
  });

  it('declares the directory path the footer links to', () => {
    expect(doc.path).toBe(`/${name}/`);
    expect(DOC_ROUTES).toContain(name);
  });

  it('renders prose without throwing', () => {
    const { container } = render(<div>{doc.body}</div>);
    expect(container.textContent?.length ?? 0).toBeGreaterThan(400);
  });

  it('has no nested h1 — the page shell owns the only one', () => {
    render(<div>{doc.body}</div>);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});

/**
 * These are production documents transcribed from the published pages, not placeholders. Three
 * external consumers link to them — App Store Connect, both Rewenn subscription products and the
 * paywall inside the binary — so the dates and the contact address are part of the contract, not
 * incidental copy.
 */
describe('legal invariants', () => {
  it('keeps the published dates on privacy and terms', () => {
    expect(PRIVACY_DOC.updated).toBe('Last updated 23 September 2026');
    expect(TERMS_DOC.updated).toBe('Last updated 30 August 2026');
  });

  it('reaches the same contact address from every document', () => {
    for (const [, doc] of DOCS) {
      const { container } = render(<div>{doc.body}</div>);
      expect(container.textContent).toContain('ewenn.app@gmail.com');
    }
  });

  it('states Apple auto-renewal terms in the Terms document', () => {
    const { container } = render(<div>{TERMS_DOC.body}</div>);
    expect(container.textContent?.toLowerCase()).toContain('renew');
  });
});
