import { describe, expect, it } from 'vitest';
import { STOPS } from '../config';
import { trailingSentence } from './sentences';

describe('trailingSentence', () => {
  it('returns the last of two sentences', () => {
    expect(trailingSentence('Set a goal. Get gentle steps.')).toBe('Get gentle steps.');
  });

  it('leaves a one-sentence title alone', () => {
    expect(trailingSentence('Better with a friend.')).toBeUndefined();
  });

  it('only splits at the end of a sentence', () => {
    expect(trailingSentence("Ewenn's AI. Small steps!")).toBe('Small steps!');
    expect(trailingSentence('Version 2.0 is here')).toBeUndefined();
  });

  it('finds a phrase in every stop title that has one', () => {
    for (const stop of STOPS) {
      const phrase = trailingSentence(stop.title);
      if (phrase) expect(stop.title.endsWith(phrase)).toBe(true);
    }
  });
});
