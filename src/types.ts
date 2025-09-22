export interface DiagramTabState {
  id: string;
  kind: 'bpmn' | 'dmn' | 'event';
  modeler: any;
  panelEl: HTMLElement;
  layoutEl: HTMLElement;
  canvasEl: HTMLElement;
  propertiesEl: HTMLElement;
  title: string;
  fileName?: string;
  dirty: boolean;
  baselineHash?: number;
  dirtyTimer?: any;
  isImporting: boolean;
  lastImportTime?: number;
}

export interface DiagramInit {
  title: string;
  xml?: string;
  fileName?: string;
  statusMessage?: string;
  activate?: boolean;
  kind?: 'bpmn' | 'dmn' | 'event';
}

export interface SidecarBridge {
  request(method: string, params?: any, timeout?: number): Promise<any>;
  emitEvent(event: string, data: any): void;
  onRequest(method: string, handler: (params: any) => Promise<any> | any): void;
  handshake(timeout?: number): Promise<any>;
}