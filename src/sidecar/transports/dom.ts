import { PROTOCOL_ID, isAnyMsg, type AnyMsg } from '../shared/protocol';
import type { Transport } from './transport';

// DOM CustomEvent based transport (same window). Useful for Angular wrappers.
export function createDomTransport(channel = PROTOCOL_ID): Transport {
  let disposed = false;
  const listeners = new Set<(msg: AnyMsg) => void>();

  const handler = (evt: Event) => {
    const ce = evt as CustomEvent<any>;
    const msg = ce?.detail;
    if (isAnyMsg(msg)) {
      listeners.forEach((cb) => cb(msg));
    }
  };

  window.addEventListener(channel, handler as EventListener);

  return {
    send(msg: AnyMsg) {
      if (disposed) return;
      const ev = new CustomEvent(channel, { detail: msg });
      window.dispatchEvent(ev);
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    close() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      window.removeEventListener(channel, handler as EventListener);
    }
  };
}

