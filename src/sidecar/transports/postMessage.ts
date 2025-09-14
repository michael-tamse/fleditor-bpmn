import { PROTOCOL_ID, isAnyMsg, type AnyMsg } from '../shared/protocol';
import type { Transport } from './transport';

// window.postMessage transport (iframe/parent or same-window). Add origin checks in host.
export function createPostMessageTransport(target: Window = window.parent, targetOrigin: string = '*'): Transport {
  let disposed = false;
  const listeners = new Set<(msg: AnyMsg) => void>();

  const onMessage = (e: MessageEvent<any>) => {
    const msg = e?.data;
    if (isAnyMsg(msg)) {
      listeners.forEach((cb) => cb(msg));
    }
  };

  window.addEventListener('message', onMessage as EventListener);

  return {
    send(msg: AnyMsg) {
      if (disposed) return;
      try {
        target.postMessage(msg, targetOrigin);
      } catch {
        // ignore
      }
    },
    onMessage(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    close() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      window.removeEventListener('message', onMessage as EventListener);
    }
  };
}

