import {
  PROTOCOL_ID,
  PROTOCOL_VERSION,
  type AnyMsg,
  type CapabilityDescriptor,
  type EventMsg,
  type HandshakeAckMsg,
  type HandshakeInitMsg,
  type ReqMsg,
  type ResMsg
} from './shared/protocol';
import type { Transport } from './transports/transport';

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

export type RequestHandler = (payload: any) => Promise<any> | any;

export class SidecarBridge {
  private transport: Transport;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer?: any; op: string }>();
  private handlers = new Map<string, RequestHandler>();
  private unlisten?: () => void;
  private _capabilities: CapabilityDescriptor | null = null;
  private _connected = false;
  private _role: 'component' | 'host';

  constructor(transport: Transport, role: 'component' | 'host' = 'component') {
    this.transport = transport;
    this._role = role;
    this.unlisten = this.transport.onMessage(this.onMessage);
  }

  get connected() { return this._connected; }
  get capabilities() { return this._capabilities; }

  async handshake(timeoutMs = 1200): Promise<CapabilityDescriptor | null> {
    const init: HandshakeInitMsg = {
      protocol: PROTOCOL_ID,
      protocolVersion: PROTOCOL_VERSION,
      kind: 'handshake:init',
      id: uid(),
      meta: { sender: this._role }
    };
    try { this.transport.send(init); } catch {}

    return new Promise((resolve) => {
      const t = setTimeout(() => resolve(null), timeoutMs);
      const off = this.transport.onMessage((msg) => {
        if (msg.kind === 'handshake:ack' && (msg as HandshakeAckMsg).capabilities?.protocol === PROTOCOL_ID) {
          clearTimeout(t);
          off();
          this._capabilities = (msg as HandshakeAckMsg).capabilities;
          this._connected = true;
          resolve(this._capabilities);
        }
      });
    });
  }

  onRequest(op: string, handler: RequestHandler) {
    this.handlers.set(op, handler);
  }

  request<T = any>(op: string, payload?: any, timeoutMs = 5000): Promise<T> {
    const id = uid();
    const req: ReqMsg = {
      protocol: PROTOCOL_ID,
      protocolVersion: PROTOCOL_VERSION,
      kind: 'req',
      id,
      op,
      payload,
      meta: { sender: this._role }
    };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(Object.assign(new Error('Request timeout'), { code: 'TIMEOUT', op }));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer, op });
      try { this.transport.send(req); } catch (e) { clearTimeout(timer); this.pending.delete(id); reject(e); }
    });
  }

  emitEvent(name: string, payload?: any) {
    const ev: EventMsg = {
      protocol: PROTOCOL_ID,
      protocolVersion: PROTOCOL_VERSION,
      kind: 'event',
      id: uid(),
      name,
      payload,
      meta: { sender: this._role }
    };
    try { this.transport.send(ev); } catch {}
  }

  dispose() {
    try { this.unlisten && this.unlisten(); } catch {}
    try { this.transport.close && this.transport.close(); } catch {}
    this.pending.clear();
  }

  private onMessage = async (msg: AnyMsg) => {
    // ignore own messages (best-effort)
    if (msg.meta?.sender === this._role) return;

    if (msg.kind === 'req') {
      const op = (msg as ReqMsg).op;
      const handler = this.handlers.get(op);
      const res: ResMsg = {
        protocol: PROTOCOL_ID,
        protocolVersion: PROTOCOL_VERSION,
        kind: 'res',
        id: uid(),
        op,
        inReplyTo: msg.id,
        ok: true,
        meta: { sender: this._role }
      };
      try {
        const out = handler ? await handler((msg as ReqMsg).payload) : { ok: false };
        res.payload = out;
      } catch (err: any) {
        res.ok = false;
        (res as any).error = { message: String(err?.message || err || 'error') };
      }
      try { this.transport.send(res); } catch {}
      return;
    }

    if (msg.kind === 'res') {
      const res = msg as ResMsg;
      // match pending by exact inReplyTo id
      if (!res.inReplyTo) return;
      const p = this.pending.get(res.inReplyTo);
      if (!p) return;
      if (p.timer) clearTimeout(p.timer);
      this.pending.delete(res.inReplyTo);
      if (res.ok === false) {
        p.reject(Object.assign(new Error('Request failed'), { op: res.op, payload: res.payload }));
      } else {
        p.resolve(res.payload as any);
      }
      return;
    }
  };
}
