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

  function deriveProcessId(xml: string): string | null {
    try {
      const m = /<([\w-]+:)?process\b[^>]*\bid\s*=\s*"([^"]+)"/i.exec(xml);
      return m ? m[2] : null;
    } catch { return null; }
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
    }
  });

  // Drain any pending file paths buffered on the Rust side (race-safe)
  (async () => {
    try {
      const paths = (await invoke<string[] | undefined>('pending_files_take')) || [];
      if (paths.length) {
        for (const p of paths) {
          try {
            const xml = await readTextFile(p);
            const parts = String(p).split(/[\/\\]/);
            const fileName = parts[parts.length - 1] || 'diagram.bpmn20.xml';
            await host.request('doc.openExternal', { xml, fileName }, 120000);
          } catch (e) {
          }
        }
      }
    } catch (e) {
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
      const pid = deriveProcessId(xml);
      const suggested = sanitizeFileName((pid || 'diagram') + '.bpmn20.xml');
      const filePath = await save({
        defaultPath: suggested,
        filters: [ { name: 'BPMN', extensions: ['bpmn', 'xml'] } ]
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
        filters: [ { name: 'BPMN', extensions: ['bpmn', 'xml'] } ],
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
      for (const p of paths) {
        try {
          const xml = await readTextFile(p);
          const parts = String(p).split(/[/\\]/);
          const fileName = parts[parts.length - 1] || 'diagram.bpmn20.xml';
          await host.request('doc.openExternal', { xml, fileName }, 120000);
        } catch (e) {
          try { console.debug('[tauri-host]', 'failed to open file', p, e); } catch {}
        }
      }
    }).catch((e) => { try { console.debug('[tauri-host]', 'listen open-files failed (permissions?)', e); } catch {} });
  } catch (e) {
    try { console.debug('[tauri-host]', 'listen open-files threw sync', e); } catch {}
  }

  // Cleanup on unload
  window.addEventListener('unload', () => { try { unlisten && unlisten(); } catch {} host.dispose(); });
}
