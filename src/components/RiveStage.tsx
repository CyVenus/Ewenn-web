import { useState } from 'react';
import { DESKTOP_ARTBOARD } from '../config';
import type { SceneArtboard } from '../lib/artboard';
import type { Phase } from '../lib/phase';
import { RiveScene } from './RiveScene';

export type RiveStageProps = {
  artboard: SceneArtboard;
  phase: Phase;
  paused: boolean;
  onFailed: () => void;
  readProgress?: () => number;
  onWalk?: (shown: number) => void;
  onReady?: () => void;
};

export function RiveStage({ artboard, phase, paused, onFailed, readProgress, onWalk, onReady }: RiveStageProps) {
  const [mobileFailed, setMobileFailed] = useState(false);
  const effectiveArtboard: SceneArtboard = mobileFailed ? DESKTOP_ARTBOARD : artboard;

  const handleLoadError = () => {
    if (effectiveArtboard !== DESKTOP_ARTBOARD) {
      setMobileFailed(true);
      return;
    }
    console.error('[ewenn] The Rive scene failed to load; showing the static sky instead.');
    onFailed();
  };

  // `key` remounts the runtime whenever the artboard changes; useRive reads its params only on mount.
  return (
    <RiveScene
      key={effectiveArtboard}
      artboard={effectiveArtboard}
      phase={phase}
      paused={paused}
      onLoadError={handleLoadError}
      readProgress={readProgress}
      onWalk={onWalk}
      onReady={onReady}
    />
  );
}
