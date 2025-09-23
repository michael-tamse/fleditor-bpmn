import { SidecarBridge } from '../../src/sidecar/bridge';
import { createDomTransport } from '../../src/sidecar/transports/dom';
import { PROTOCOL_ID, PROTOCOL_VERSION, type HandshakeAckMsg } from '../../src/sidecar/shared/protocol';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

function isTauri(): boolean {
  try {
    const w: any = window as any;
    // Tauri v1 exposes __TAURI__ / __TAURI_IPC__, v2 exposes __TAURI_INTERNALS__
    return !!w.__TAURI__ || !!w.__TAURI_IPC__ || !!w.__TAURI_INTERNALS__;
  } catch { return false; }
}

// Always register the host bridge; handlers guard on __TAURI__ when needed
{
  const transport = createDomTransport();
  const host = new SidecarBridge(transport, 'host');

  // Minimal visible status helper (for release builds without DevTools)
  function setHostStatus(msg: string) {
    try {
      const el = document.querySelector<HTMLElement>('#status');
      if (el) el.textContent = `[Host] ${msg}`;
    } catch {}
  }

  // Queue external open requests until the component is ready (handshake observed)
  let handshakeSeen = false;
  const externalOpenQueue: Array<{ xml: string; fileName: string } > = [];
  let flushing = false;
  async function flushExternalQueue() {
    if (!handshakeSeen || flushing) return;
    try { console.debug('[tauri-host]', 'flushExternalQueue: start', { queued: externalOpenQueue.length }); } catch {}
    setHostStatus(`flush queue… (${externalOpenQueue.length})`);
    flushing = true;
    try {
      while (externalOpenQueue.length) {
        const item = externalOpenQueue.shift()!;
        try {
          try { console.debug('[tauri-host]', 'flushExternalQueue: forwarding to component', { fileName: item.fileName, size: item.xml.length }); } catch {}
          setHostStatus(`forwarding ${item.fileName}…`);
          const res: any = await host.request('doc.openExternal', { xml: item.xml, fileName: item.fileName }, 120000);
          try { console.debug('[tauri-host]', 'flushExternalQueue: component replied', { ok: !!(res && res.ok) }); } catch {}
          setHostStatus(`component replied: ${res && res.ok ? 'ok' : 'not ok'}`);
        } catch {
          // ignore and continue
        }
      }
    } finally {
      flushing = false;
      try { console.debug('[tauri-host]', 'flushExternalQueue: done'); } catch {}
      setHostStatus('flush done');
    }
  }
  function enqueueExternal(xml: string, fileName: string) {
    externalOpenQueue.push({ xml, fileName });
    try { console.debug('[tauri-host]', 'enqueueExternal', { fileName, size: xml.length, queued: externalOpenQueue.length, handshakeSeen }); } catch {}
    setHostStatus(`queued ${fileName} (${xml.length} bytes)`);
    flushExternalQueue();
  }

  function deriveProcessId(xml: string): string | null {
    try {
      const m = /<([\w-]+:)?process\b[^>]*\bid\s*=\s*"([^"]+)"/i.exec(xml);
      return m ? m[2] : null;
    } catch { return null; }
  }

  function deriveDmnId(xml: string): string | null {
    try {
      if (!xml || typeof xml !== 'string') {
        return null;
      }
      // Try multiple patterns for decision ID
      const patterns = [
        /<([\w-]+:)?decision\b[^>]*\bid\s*=\s*"([^"]+)"/i,
        /<([\w-]+:)?decision\b[^>]*\bid\s*=\s*'([^']+)'/i,
        /<decision\b[^>]*\bid\s*=\s*"([^"]+)"/i,
        /<dmn:decision\b[^>]*\bid\s*=\s*"([^"]+)"/i,
        /<([\w-]+:)?decision\b[^>]*\bname\s*=\s*"([^"]+)"/i,
        /<([\w-]+:)?definitions\b[^>]*\bid\s*=\s*"([^"]+)"/i
      ];
      for (const pattern of patterns) {
        const match = pattern.exec(xml);
        if (match) {
          return match[2] || match[1];
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  function sanitizeFileName(name: string): string {
    return name.replace(/[\\/:*?"<>|\n\r]+/g, '_');
  }

  // Respond to handshake:init with capabilities only in Tauri environment
  const sendAck = () => {
    const ack: HandshakeAckMsg = {
      protocol: PROTOCOL_ID,
      protocolVersion: PROTOCOL_VERSION,
      kind: 'handshake:ack',
      id: Math.random().toString(36).slice(2),
      capabilities: {
        protocol: PROTOCOL_ID,
        protocolVersion: PROTOCOL_VERSION,
        host: { id: 'tauri-host', version: '1.0.0' },
        features: {
          storage: { modes: ['tauriFs'], default: 'tauriFs' },
          ui: { propertyPanel: true, menubar: true }
        },
        operations: [
          { name: 'doc.load' },
          { name: 'doc.save' },
          { name: 'doc.saveSvg' },
          // host-initiated open of external files
          { name: 'doc.openExternal' },
          { name: 'ui.setPropertyPanel' },
          { name: 'ui.setMenubar' }
        ]
      },
      meta: { sender: 'host' }
    };
    try { transport.send(ack); } catch {}
    try { console.debug('[tauri-host]', 'handshake:ack sent'); } catch {}
  };

  const unlisten = transport.onMessage((msg) => {
    if (msg.protocol === PROTOCOL_ID && msg.kind === 'handshake:init') {
      // In browser dev (no __TAURI__), do not acknowledge so the editor remains standalone
      if (!isTauri()) {
        // Retry a few times in case Tauri globals not yet injected
        let attempts = 0;
        const retry = () => {
          if (isTauri()) { sendAck(); return; }
          attempts++;
          if (attempts < 10) setTimeout(retry, 150);
          else { try { console.debug('[tauri-host]', 'handshake:init ignored (not Tauri)'); } catch {} }
        };
        retry();
        return;
      }
      sendAck();
      try { console.debug('[tauri-host]', 'handshake:init observed → ready to flush queue'); } catch {}
      handshakeSeen = true;
      flushExternalQueue();
    }
  });

  // Drain any pending file paths buffered on the Rust side (race-safe)
  (async () => {
    try {
      const paths = (await invoke<string[] | undefined>('pending_files_take')) || [];
      try { console.debug('[tauri-host]', 'pending_files_take', { count: paths.length, paths }); } catch {}
      setHostStatus(`pending_files_take: ${paths.length}`);
      if (paths.length) {
        for (const p of paths) {
          try {
            const xml = await readTextFile(p);
            const parts = String(p).split(/[\/\\]/);
            const fileName = parts[parts.length - 1] || 'diagram.bpmn20.xml';
            try { console.debug('[tauri-host]', 'pending_files_take: read file', { path: p, fileName, size: xml.length }); } catch {}
            setHostStatus(`read ${fileName} (${xml.length} bytes)`);
            enqueueExternal(xml, fileName);
          } catch (e) {
            try { console.debug('[tauri-host]', 'pending_files_take: read failed', { path: p, error: String((e as any)?.message || e) }); } catch {}
            setHostStatus(`failed to read ${String(p)}: ${String((e as any)?.message || e)}`);
          }
        }
      }
    } catch (e) {
      try { console.debug('[tauri-host]', 'pending_files_take: invoke failed', e); } catch {}
    }
  })();

  // Note: We rely on the Sidecar doc.load flow to show the open dialog.
  // If dialog issues reappear, consider re-introducing a guarded, non-blocking intercept.

  // Implement doc.save -> native save dialog + write file
  host.onRequest('doc.save', async (payload: any) => {
    try {
      console.debug('[tauri-host]', 'doc.save request', { size: String(payload?.xml || '').length });
      if (!isTauri()) return { ok: false };
      const xml = String(payload?.xml ?? '');
      if (!xml) return { ok: false };
      // save dialog + write file via Tauri v2 APIs
      const diagramType = payload?.diagramType || 'bpmn';
      let id: string | null;
      let extension: string;
      let filterName: string;
      let extensions: string[];

      if (diagramType === 'dmn') {
        id = deriveDmnId(xml);
        extension = '.dmn';
        filterName = 'DMN';
        extensions = ['dmn', 'xml'];
      } else {
        id = deriveProcessId(xml);
        extension = '.bpmn20.xml';
        filterName = 'BPMN';
        extensions = ['bpmn', 'xml'];
      }

      const suggested = sanitizeFileName((id || 'diagram') + extension);
      const filePath = await save({
        defaultPath: suggested,
        filters: [ { name: filterName, extensions } ]
      });
      if (!filePath) { console.debug('[tauri-host]', 'doc.save canceled'); return { ok: false, canceled: true }; }
      await writeTextFile(filePath as string, xml);
      console.debug('[tauri-host]', 'doc.save ok', { path: filePath });
      return { ok: true, path: filePath };
    } catch (e: any) {
      console.debug('[tauri-host]', 'doc.save error', e);
      return { ok: false, error: String(e?.message || e) };
    }
  });

  // Implement doc.load -> open dialog + read file
  host.onRequest('doc.load', async () => {
    try { console.debug('[tauri-host]', 'doc.load request'); } catch {}
    if (!isTauri()) return '';
    try {
      // open dialog + read file via Tauri v2 APIs
      const sel = await open({
        filters: [
          { name: 'BPMN', extensions: ['bpmn', 'bpmn20.xml'] },
          { name: 'DMN', extensions: ['dmn'] },
          { name: 'XML', extensions: ['xml'] }
        ],
        multiple: false
      });
      const path = Array.isArray(sel) ? sel[0] : sel;
      if (!path) { try { console.debug('[tauri-host]', 'doc.load canceled'); } catch {} return { canceled: true } as any; }
      const xml = await readTextFile(path as string);
      const parts = String(path).split(/[\/\\]/);
      const fileName = parts[parts.length - 1] || 'diagram.bpmn20.xml';
      try { console.debug('[tauri-host]', 'doc.load ok', { path }); } catch {}
      return { xml: String(xml ?? ''), fileName } as any;
    } catch (e) {
      try { console.debug('[tauri-host]', 'doc.load error', e); } catch {}
      return '';
    }
  });

  // Implement doc.saveSvg -> save SVG via native dialog
  host.onRequest('doc.saveSvg', async (payload: any) => {
    try {
      console.debug('[tauri-host]', 'doc.saveSvg request', { size: String(payload?.svg || '').length });
      if (!isTauri()) return { ok: false };
      const svg = String(payload?.svg ?? '');
      if (!svg) return { ok: false };
      // save dialog + write file via Tauri v2 APIs
      const suggested = sanitizeFileName(String(payload?.suggestedName || 'diagram.svg'));
      const filePath = await save({
        defaultPath: suggested,
        filters: [ { name: 'SVG', extensions: ['svg'] } ]
      });
      if (!filePath) { console.debug('[tauri-host]', 'doc.saveSvg canceled'); return { ok: false, canceled: true }; }
      await writeTextFile(filePath as string, svg);
      console.debug('[tauri-host]', 'doc.saveSvg ok', { path: filePath });
      return { ok: true, path: filePath };
    } catch (e: any) {
      console.debug('[tauri-host]', 'doc.saveSvg error', e);
      return { ok: false, error: String(e?.message || e) };
    }
  });

  // Listen for native "open-files" events from Rust (single-instance + OS integration)
  try {
    listen<string[] | string>('open-files', async ({ payload }) => {
      try { console.debug('[tauri-host]', 'open-files', payload); } catch {}
      const paths = Array.isArray(payload) ? payload : [payload];
      setHostStatus(`open-files event: ${paths.length}`);
      for (const p of paths) {
        try {
          const xml = await readTextFile(p);
          const parts = String(p).split(/[/\\]/);
          const fileName = parts[parts.length - 1] || 'diagram.bpmn20.xml';
          try { console.debug('[tauri-host]', 'open-files: read file', { path: p, fileName, size: xml.length }); } catch {}
          setHostStatus(`read ${fileName} (${xml.length} bytes)`);
          enqueueExternal(xml, fileName);
        } catch (e) {
          try { console.debug('[tauri-host]', 'failed to open file', p, e); } catch {}
          setHostStatus(`failed to read ${String(p)}: ${String((e as any)?.message || e)}`);
        }
      }
    }).catch((e) => { try { console.debug('[tauri-host]', 'listen open-files failed (permissions?)', e); } catch {} });
  } catch (e) {
    try { console.debug('[tauri-host]', 'listen open-files threw sync', e); } catch {}
  }

  // Safety: if handshake somehow never arrives, try a delayed flush to not drop user-initiated opens
  setTimeout(() => { try { console.debug('[tauri-host]', 'safety flush timer fired', { handshakeSeen, queued: externalOpenQueue.length }); } catch {} if (!handshakeSeen) flushExternalQueue(); }, 2000);

  // Cleanup on unload
  window.addEventListener('unload', () => { try { unlisten && unlisten(); } catch {} host.dispose(); });
}
