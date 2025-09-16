// Sidecar protocol types (component ↔ host)
// Minimal, versioned message envelope with req/res, events and handshake.

export const PROTOCOL_ID = 'bpmn-sidecar' as const;
export const PROTOCOL_VERSION = '1.0.0' as const;

export type OperationName =
  | 'doc.load'
  | 'doc.save'
  | 'doc.saveSvg'
  | 'doc.openExternal'
  | 'ui.setPropertyPanel'
  | 'ui.setMenubar';

export interface CapabilityDescriptor {
  protocol: typeof PROTOCOL_ID;
  protocolVersion: string;
  host: { id: string; version: string };
  features: {
    storage?: { modes: Array<'http' | 'tauriFs' | 'pwaFs'>; default: string };
    ui?: { propertyPanel: boolean; menubar: boolean };
  };
  operations: Array<{ name: OperationName | string }>; // allow forward-compat
}

export type MsgKind =
  | 'handshake:init'
  | 'handshake:ack'
  | 'req'
  | 'res'
  | 'event'
  | 'error';

export interface BaseMsg {
  protocol: typeof PROTOCOL_ID;
  protocolVersion: string;
  kind: MsgKind;
  id: string;
  // internal hint to avoid local loops across transports
  meta?: { sender?: 'component' | 'host' };
}

export interface HandshakeInitMsg extends BaseMsg {
  kind: 'handshake:init';
}

export interface HandshakeAckMsg extends BaseMsg {
  kind: 'handshake:ack';
  capabilities: CapabilityDescriptor;
}

export interface ReqMsg<P = any> extends BaseMsg {
  kind: 'req';
  op: OperationName | string;
  payload?: P;
}

export interface ResMsg<R = any> extends BaseMsg {
  kind: 'res';
  op: OperationName | string;
  inReplyTo: string; // id of req
  payload?: R;
  ok?: boolean;
}

export interface EventMsg<P = any> extends BaseMsg {
  kind: 'event';
  name: string;
  payload?: P;
}

export interface ErrorMsg extends BaseMsg {
  kind: 'error';
  inReplyTo?: string;
  code: string;
  message: string;
}

export type AnyMsg =
  | HandshakeInitMsg
  | HandshakeAckMsg
  | ReqMsg
  | ResMsg
  | EventMsg
  | ErrorMsg;

export function isAnyMsg(x: any): x is AnyMsg {
  return !!x && x.protocol === PROTOCOL_ID && typeof x.kind === 'string' && typeof x.id === 'string';
}
