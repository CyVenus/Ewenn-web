import schedule from '../phase-schedule.json' with { type: 'json' };

export type Phase = 'night' | 'day' | 'noon' | 'evening';

export type PhaseSchedule = {
  day: number;
  noon: number;
  evening: number;
  night: number;
};

/** The index in this array is the Rive `time` value. */
export const PHASES: readonly Phase[] = ['night', 'day', 'noon', 'evening'];

export const PHASE_SCHEDULE: PhaseSchedule = schedule;

export const PHASE_TIME_VALUE: Record<Phase, number> = { night: 0, day: 1, noon: 2, evening: 3 };

/** Local browser time, so the visitor's time zone and daylight saving apply automatically. */
export function getPhase(date: Date, activeSchedule: PhaseSchedule = PHASE_SCHEDULE): Phase {
  const hour = date.getHours() + date.getMinutes() / 60;
  if (hour >= activeSchedule.night || hour < activeSchedule.day) return 'night';
  if (hour >= activeSchedule.evening) return 'evening';
  if (hour >= activeSchedule.noon) return 'noon';
  return 'day';
}

export function parsePhaseOverride(search: string): Phase | null {
  const raw = new URLSearchParams(search).get('phase');
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  const named = PHASES.find((phase) => phase === value);
  if (named) return named;
  if (/^[0-3]$/.test(value)) return PHASES[Number(value)];
  return null;
}

export function isLampOnPhase(phase: Phase): boolean {
  return phase === 'evening' || phase === 'night';
}
