import type { AnyMsg } from '../shared/protocol';

export interface Transport {
  send(msg: AnyMsg): void;
  onMessage(cb: (msg: AnyMsg) => void): () => void;
  close?(): void;
}

