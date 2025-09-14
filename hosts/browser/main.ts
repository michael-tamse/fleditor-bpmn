import { PROTOCOL_ID, PROTOCOL_VERSION, isAnyMsg, type AnyMsg } from '../../src/sidecar/shared/protocol';
import { SidecarBridge } from '../../src/sidecar/bridge';
import { createPostMessageTransport } from '../../src/sidecar/transports/postMessage';

const $ = <T extends Element>(sel: string) => document.querySelector<T>(sel)!;
const iframe = $('#editor') as HTMLIFrameElement;
const btnLoadToHost = $('#btn-load-to-host') as HTMLButtonElement;
const btnOpenInEditor = $('#btn-open-in-editor') as HTMLButtonElement;
const btnSaveFromEditor = $('#btn-save-from-editor') as HTMLButtonElement;
const fileInput = $('#host-file') as HTMLInputElement;
const chkMenubar = $('#chk-menubar') as HTMLInputElement;
const chkProps = $('#chk-props') as HTMLInputElement;
const stateEl = $('#state') as HTMLSpanElement;

let bridge: SidecarBridge | null = null;
let lastXml: string | null = null;
let uiState = { menubar: true, propertyPanel: true };

function setState(text: string) { stateEl.textContent = text; }

function download(filename: string, data: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Quick handshake ACK on raw postMessage to avoid race
window.addEventListener('message', (e: MessageEvent<any>) => {
  const msg: AnyMsg = e.data;
  if (!isAnyMsg(msg)) return;
  if (msg.kind === 'handshake:init') {
    const ack = {
      protocol: PROTOCOL_ID,
      protocolVersion: PROTOCOL_VERSION,
      kind: 'handshake:ack' as const,
      id: Math.random().toString(36).slice(2),
      capabilities: {
        protocol: PROTOCOL_ID,
        protocolVersion: PROTOCOL_VERSION,
        host: { id: 'browser-host', version: 'dev' },
        features: { ui: { propertyPanel: true, menubar: true }, storage: { modes: ['pwaFs'], default: 'pwaFs' } },
        operations: [
          { name: 'doc.load' },
          { name: 'doc.save' },
          { name: 'ui.setPropertyPanel' },
          { name: 'ui.setMenubar' }
        ]
      },
      meta: { sender: 'host' as const }
    };
    try { iframe.contentWindow?.postMessage(ack, '*'); } catch {}
    setState('Handshake: verbunden');
  }
});

function setupBridge() {
  if (!iframe.contentWindow) return;
  const transport = createPostMessageTransport(iframe.contentWindow, '*');
  bridge = new SidecarBridge(transport, 'host');

  // Handle component → host requests
  bridge.onRequest('doc.load', async () => {
    if (lastXml && lastXml.trim()) return lastXml;
    // fallback: simple starter definitions
    return `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Defs_1" targetNamespace="http://example.com">\n  <bpmn:process id="Process_host" isExecutable="true">\n    <bpmn:startEvent id="Start_A"/>\n  </bpmn:process>\n  <bpmndi:BPMNDiagram id="BPMNDiagram_1">\n    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_host">\n      <bpmndi:BPMNShape id="_shape_start" bpmnElement="Start_A"><dc:Bounds x="173" y="102" width="36" height="36"/></bpmndi:BPMNShape>\n    </bpmndi:BPMNPlane>\n  </bpmndi:BPMNDiagram>\n</bpmn:definitions>`;
  });

  bridge.onRequest('doc.save', async (p: any) => {
    const xml = String(p?.xml || '');
    if (xml) download('diagram-from-editor.bpmn', xml, 'application/xml');
    return { ok: true };
  });

  // Listen for events (ui.state, doc.changed) on raw transport
  transport.onMessage((msg) => {
    if (msg.kind === 'event' && msg.name === 'ui.state') {
      const s = msg.payload || {};
      uiState.menubar = !!s.menubar;
      uiState.propertyPanel = !!s.propertyPanel;
      chkMenubar.checked = uiState.menubar;
      chkProps.checked = uiState.propertyPanel;
      setState(`Handshake: verbunden · UI: Menü=${uiState.menubar ? 'an' : 'aus'}, Properties=${uiState.propertyPanel ? 'an' : 'aus'}`);
    }
    if (msg.kind === 'event' && msg.name === 'doc.changed') {
      const dirty = !!(msg.payload && msg.payload.dirty);
      stateEl.textContent = `Handshake: verbunden · Doc: ${dirty ? 'dirty' : 'clean'}`;
    }
  });
}

btnLoadToHost.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.onchange = async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const text = await f.text();
    lastXml = text;
    setState('Datei in Host gepuffert');
  };
  fileInput.click();
});

btnOpenInEditor.addEventListener('click', async () => {
  // Editor holt über doc.load; hier einfach UI-Hinweis
  setState('Bitte im Editor auf „Öffnen“ klicken');
});

btnSaveFromEditor.addEventListener('click', async () => {
  // Nutzer klickt im Editor auf „Speichern XML“; Host empfängt doc.save und lädt herunter.
  setState('Bitte im Editor auf „Speichern XML“ klicken');
});

chkMenubar.addEventListener('change', async () => {
  if (!bridge) return;
  try { await bridge.request('ui.setMenubar', { visible: chkMenubar.checked }); } catch {}
});

chkProps.addEventListener('change', async () => {
  if (!bridge) return;
  try { await bridge.request('ui.setPropertyPanel', { visible: chkProps.checked }); } catch {}
});

// Initialize after iframe has a contentWindow
if (iframe.contentWindow) setupBridge();
else iframe.addEventListener('load', setupBridge, { once: true });

