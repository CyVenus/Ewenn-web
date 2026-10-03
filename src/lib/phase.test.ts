import { describe, expect, it } from 'vitest';
import {
  PHASES,
  PHASE_SCHEDULE,
  PHASE_TIME_VALUE,
  getPhase,
  isLampOnPhase,
  parsePhaseOverride,
} from './phase';

/** Local time on purpose: the visitor's own clock is the whole input to this module. */
const at = (hour: number, minute = 0) => new Date(2026, 0, 15, hour, minute);

describe('getPhase', () => {
  it('opens each phase exactly on its scheduled hour', () => {
    expect(getPhase(at(PHASE_SCHEDULE.day))).toBe('day');
    expect(getPhase(at(PHASE_SCHEDULE.noon))).toBe('noon');
    expect(getPhase(at(PHASE_SCHEDULE.evening))).toBe('evening');
    expect(getPhase(at(PHASE_SCHEDULE.night))).toBe('night');
  });

  it('holds each phase until one minute before the next', () => {
    expect(getPhase(at(PHASE_SCHEDULE.noon - 1, 59))).toBe('day');
    expect(getPhase(at(PHASE_SCHEDULE.evening - 1, 59))).toBe('noon');
    expect(getPhase(at(PHASE_SCHEDULE.night - 1, 59))).toBe('evening');
  });

  it('carries night across midnight rather than resetting at 00:00', () => {
    expect(getPhase(at(23, 59))).toBe('night');
    expect(getPhase(at(0))).toBe('night');
    expect(getPhase(at(3))).toBe('night');
    expect(getPhase(at(PHASE_SCHEDULE.day - 1, 59))).toBe('night');
  });

  it('accounts for minutes, not just the hour', () => {
    expect(getPhase(at(PHASE_SCHEDULE.day - 1, 30))).toBe('night');
    expect(getPhase(at(PHASE_SCHEDULE.day, 30))).toBe('day');
  });

  it('returns a known phase for every half hour of the day', () => {
    for (let half = 0; half < 48; half += 1) {
      const phase = getPhase(at(Math.floor(half / 2), (half % 2) * 30));
      expect(PHASES).toContain(phase);
    }
  });
});

describe('PHASE_TIME_VALUE', () => {
  it('pins the four numbers the .riv transitions compare against', () => {
    expect(PHASE_TIME_VALUE).toEqual({ night: 0, day: 1, noon: 2, evening: 3 });
  });

  it('is the index of the phase in PHASES, so the two can never disagree', () => {
    for (const [phase, value] of Object.entries(PHASE_TIME_VALUE)) {
      expect(PHASES[value]).toBe(phase);
    }
  });
});

describe('parsePhaseOverride', () => {
  it('accepts a phase name in any case, with surrounding space', () => {
    expect(parsePhaseOverride('?phase=Night')).toBe('night');
    expect(parsePhaseOverride('?phase=  evening ')).toBe('evening');
    expect(parsePhaseOverride('?phase=NOON')).toBe('noon');
  });

  it('accepts the Rive index as a shorthand', () => {
    expect(parsePhaseOverride('?phase=0')).toBe('night');
    expect(parsePhaseOverride('?phase=1')).toBe('day');
    expect(parsePhaseOverride('?phase=3')).toBe('evening');
  });

  it('rejects anything it does not recognise instead of guessing', () => {
    expect(parsePhaseOverride('')).toBeNull();
    expect(parsePhaseOverride('?phase=')).toBeNull();
    expect(parsePhaseOverride('?phase=4')).toBeNull();
    expect(parsePhaseOverride('?phase=-1')).toBeNull();
    expect(parsePhaseOverride('?phase=dusk')).toBeNull();
    expect(parsePhaseOverride('?other=night')).toBeNull();
  });
});

describe('isLampOnPhase', () => {
  it('lights the lamp for evening and night only', () => {
    expect(isLampOnPhase('evening')).toBe(true);
    expect(isLampOnPhase('night')).toBe(true);
    expect(isLampOnPhase('day')).toBe(false);
    expect(isLampOnPhase('noon')).toBe(false);
  });
});
