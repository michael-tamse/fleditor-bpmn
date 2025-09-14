import type { AnyMsg } from '../shared/protocol';
import type { Transport } from './transport';

// In-memory loopback transport for tests; requires manual peer wiring.
export function createMemoryTransport(): [Transport, Transport] {
  const aListeners = new Set<(msg: AnyMsg) => void>();
  const bListeners = new Set<(msg: AnyMsg) => void>();
  let aClosed = false;
  let bClosed = false;

  const a: Transport = {
    send(msg) {
      if (aClosed) return;
      bListeners.forEach((cb) => cb(msg));
    },
    onMessage(cb) {
      aListeners.add(cb);
      return () => aListeners.delete(cb);
    },
    close() { aClosed = true; aListeners.clear(); }
  };

  const b: Transport = {
    send(msg) {
      if (bClosed) return;
      aListeners.forEach((cb) => cb(msg));
    },
    onMessage(cb) {
      bListeners.add(cb);
      return () => bListeners.delete(cb);
    },
    close() { bClosed = true; bListeners.clear(); }
  };

  return [a, b];
}

