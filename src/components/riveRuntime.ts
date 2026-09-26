import { RuntimeLoader } from '@rive-app/react-webgl2';
import wasmUrl from '@rive-app/webgl2/rive.wasm?url';
import wasmFallbackUrl from '@rive-app/webgl2/rive_fallback.wasm?url';

/*
 * Imported for its side effect by every component that starts a Rive instance, so none of them
 * depends on another having been imported first. Self-host the runtime (the default would fetch
 * it from unpkg) and start compiling it before anything mounts.
 */
RuntimeLoader.setWasmUrl(wasmUrl);
RuntimeLoader.setWasmFallbackUrl(wasmFallbackUrl);
RuntimeLoader.awaitInstance().catch(() => undefined);
