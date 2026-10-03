import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHASE_TICK_MS, usePhase } from './usePhase';

/** jsdom has no way to set window.location.search, so each test replaces it wholesale. */
function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...window.location, search },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setSearch('');
  document.documentElement.removeAttribute('data-phase');
});

afterEach(() => {
  vi.useRealTimers();
});

const atHour = (hour: number) => vi.setSystemTime(new Date(2026, 0, 15, hour, 0, 0));

describe('usePhase', () => {
  it('starts on the phase the clock is in', () => {
    atHour(13);
    const { result } = renderHook(() => usePhase());
    expect(result.current).toBe('noon');
  });

  it('re-evaluates on the tick when the phase rolls over', () => {
    atHour(15);
    const { result } = renderHook(() => usePhase());
    expect(result.current).toBe('noon');

    act(() => {
      atHour(16);
      vi.advanceTimersByTime(PHASE_TICK_MS);
    });
    expect(result.current).toBe('evening');
  });

  it('re-evaluates when a backgrounded tab becomes visible again', () => {
    atHour(19);
    const { result } = renderHook(() => usePhase());
    expect(result.current).toBe('evening');

    act(() => {
      atHour(21);
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('night');
  });

  it('mirrors the phase onto <html data-phase>, which is what the CSS selects on', () => {
    atHour(8);
    renderHook(() => usePhase());
    expect(document.documentElement.dataset.phase).toBe('day');
  });

  describe('?phase override', () => {
    it('pins the phase regardless of the clock', () => {
      atHour(13);
      setSearch('?phase=night');
      const { result } = renderHook(() => usePhase());
      expect(result.current).toBe('night');
    });

    it('stops the tick, so a screenshot can never change phase under the camera', () => {
      atHour(13);
      setSearch('?phase=night');
      const { result } = renderHook(() => usePhase());

      act(() => {
        atHour(8);
        vi.advanceTimersByTime(PHASE_TICK_MS * 5);
      });
      expect(result.current).toBe('night');
    });

    it('ignores an unrecognised value and follows the clock', () => {
      atHour(13);
      setSearch('?phase=dusk');
      const { result } = renderHook(() => usePhase());
      expect(result.current).toBe('noon');
    });
  });

  it('removes its interval on unmount', () => {
    atHour(13);
    const clear = vi.spyOn(window, 'clearInterval');
    const { unmount } = renderHook(() => usePhase());
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
