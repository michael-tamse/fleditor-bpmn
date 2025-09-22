import {
  sanitizeFileName,
  deriveProcessId,
  deriveDmnId,
  syncDmnDecisionIdWithName,
  wrapDmnTableValuesInCDATA,
  removeDMNDI,
  applyExportTransformations,
  applyPreExportConfigurations
} from './bpmn-xml-utils';
import { showConfirmDialog } from './ui-controls';

import { DiagramTabState, DiagramInit, SidecarBridge } from './types';

let activeTabState: DiagramTabState | null = null;
let modeler: any = null;
let sidecar: SidecarBridge | null = null;
let tabSequence = 1;

export function setActiveTabState(state: DiagramTabState | null) {
  activeTabState = state;
}

export function setModeler(m: any) {
  modeler = m;
}

export function setSidecar(s: SidecarBridge | null) {
  sidecar = s;
}

export function setTabSequence(seq: number) {
  tabSequence = seq;
}

function getActiveState(): DiagramTabState | null {
  const getActiveStateFn = (window as any).getActiveState;
  return getActiveStateFn ? getActiveStateFn() : activeTabState;
}

function hostAvailable(): boolean {
  const globalSidecar = (window as any).sidecar || sidecar;
  try { return !!(globalSidecar && (globalSidecar as any).capabilities); } catch { return false; }
}

function debug(...args: any[]) {
  const DEBUG_ENABLED = (() => {
    try {
      const p = new URL(window.location.href).searchParams.get('debug');
      if (p === '1') return true;
      return localStorage.getItem('fleditor:debug') === '1';
    } catch {
      return false;
    }
  })();
  if (DEBUG_ENABLED) console.log('[fleditor]', ...args);
}

function setStatus(msg?: string) {
  const setStatusFn = (window as any).setStatus;
  if (setStatusFn) setStatusFn(msg);
}


async function updateBaseline(state: DiagramTabState) {
  const { updateBaseline } = await import('./change-tracker');
  return updateBaseline(state);
}

async function bootstrapState(state: DiagramTabState, init: DiagramInit) {
  const { bootstrapState } = await import('./modeler-setup');
  return bootstrapState(state, init);
}

function persistActiveTab(state: DiagramTabState | null) {
  const persistFn = (window as any).persistActiveTab;
  if (persistFn) persistFn(state);
}

function findTabByProcessId(pid: string): DiagramTabState | null {
  const findFn = (window as any).findTabByProcessId;
  return findFn ? findFn(pid) : null;
}

function createDiagramTab(init: DiagramInit) {
  const createFn = (window as any).createDiagramTab;
  if (createFn) createFn(init);
}

export async function openFileAsTab(file: File) {
  if (!file) return;
  try {
    const raw = await file.text();
    const fileName = sanitizeFileName(file.name || 'diagram.bpmn20.xml');
    await openXmlConsideringDuplicates(raw, fileName, 'file');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Import der Datei.');
    setStatus('Import fehlgeschlagen');
  }
}

export async function openFileIntoState(file: File, state: DiagramTabState) {
  if (!file) return;
  try {
    const raw = await file.text();
    const title = file.name || state.title || `Datei ${tabSequence}`;
    await bootstrapState(state, {
      title,
      xml: raw,
      fileName: sanitizeFileName(file.name || state.fileName || 'diagram.bpmn20.xml'),
      statusMessage: file.name ? `Geladen: ${file.name}` : 'Datei geladen'
    });
    const tabsControl = (window as any).tabsControl;
    if (tabsControl?.getActiveId() === state.id) {
      const setActiveTab = (window as any).setActiveTab;
      if (setActiveTab) setActiveTab(state.id);
    }
  } catch (err) {
    console.error(err);
    alert('Fehler beim Import der Datei.');
    setStatus('Import fehlgeschlagen');
  }
}

export function triggerOpen() {
  const input = document.querySelector<HTMLInputElement>('#file-input');
  if (!input) return;
  input.value = '';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) openFileAsTab(file);
  };
  input.click();
}

export function deriveDecisionId(xml: string): string | null {
  try {
    const m = /<decision\b[^>]*\bid\s*=\s*\"([^\"]+)\"/i.exec(xml);
    return m ? m[1] : null;
  } catch { return null; }
}

export function deriveProcessIdFromModel(): string | null {
  try {
    const canvas = modeler.get('canvas');
    const root = canvas && canvas.getRootElement && canvas.getRootElement();
    const bo = root && (root as any).businessObject;
    if (!bo) return null;
    if (bo.$type === 'bpmn:Process' && bo.id) return String(bo.id);
    let defs: any = bo.$parent;
    while (defs && !Array.isArray((defs as any).rootElements)) defs = defs.$parent;
    const rootElements = defs && Array.isArray(defs.rootElements) ? defs.rootElements : [];
    const processEl = rootElements.find((e: any) => e && e.$type === 'bpmn:Process');
    if (processEl && processEl.id) return String(processEl.id);
    if (bo.$type === 'bpmn:Collaboration' && Array.isArray((bo as any).participants)) {
      const p = (bo as any).participants.find((x: any) => x && x.processRef && x.processRef.id);
      if (p && p.processRef && p.processRef.id) return String(p.processRef.id);
    }
  } catch {}
  return null;
}

export function deriveDmnDecisionIdFromModel(): string | null {
  try {
    const activeView = modeler.getActiveView();
    if (!activeView || !activeView.element) return null;
    const decision = activeView.element;
    if (!decision) return null;
    if (decision.id) {
      return String(decision.id);
    } else if (decision.$attrs && decision.$attrs.id) {
      return String(decision.$attrs.id);
    }
    return null;
  } catch (e) {
    console.warn('Failed to derive DMN decision ID from model:', e);
    return null;
  }
}

export async function openXmlConsideringDuplicates(xml: string, fileName?: string, source: 'host' | 'file' | 'unknown' = 'unknown') {
  const diagramType = detectDiagramType(xml);
  console.log('[openXmlConsideringDuplicates] Diagram type detected:', diagramType);

  let id: string | null;
  if (diagramType === 'dmn') {
    id = deriveDmnId(xml);
    console.log('[openXmlConsideringDuplicates] DMN ID extracted:', id);
  } else {
    id = deriveProcessId(xml);
    console.log('[openXmlConsideringDuplicates] BPMN ID extracted:', id);
  }

  const existing = id ? findTabByProcessId(id) : null;
  console.log('[openXmlConsideringDuplicates] Existing tab found:', existing ? existing.id : 'none');
  if (!existing) {
    const title = id || (fileName || `Diagramm ${tabSequence}`);
    createDiagramTab({
      title,
      xml,
      fileName: fileName ? sanitizeFileName(fileName) : undefined,
      statusMessage: source === 'host' ? 'Aus Host geladen' : (fileName ? `Geladen: ${fileName}` : 'Datei geladen'),
      kind: diagramType
    });
    return;
  }

  if (fileName && existing.fileName && sanitizeFileName(fileName) !== sanitizeFileName(existing.fileName)) {
    const titleMsg = `${id ? `[${id}] ` : ''}Gleiches Diagramm (ID) geöffnet`;
    const ok = await showConfirmDialog(
      'Ein Diagramm mit gleicher Prozess-ID ist bereits geöffnet. Neues Tab öffnen?',
      titleMsg,
      { okLabel: 'Neuer Tab', okVariant: 'primary', cancelLabel: 'Im vorhandenen Tab überschreiben' }
    );
    if (ok) {
      const title = id || (fileName || `Diagramm ${tabSequence}`);
      createDiagramTab({
        title,
        xml,
        fileName: sanitizeFileName(fileName),
        statusMessage: source === 'host' ? 'Aus Host geladen' : (fileName ? `Geladen: ${fileName}` : 'Datei geladen'),
        kind: diagramType
      });
      return;
    }
  }

  if (existing.dirty) {
    const titleMsg = `${id ? `[${id}] ` : ''}Diagramm überschreiben?`;
    const ok = await showConfirmDialog('Es gibt ungespeicherte Änderungen. Änderungen überschreiben?', titleMsg, { okLabel: 'Ja' });
    if (!ok) {
      setStatus('Öffnen abgebrochen');
      const tabsControl = (window as any).tabsControl;
      tabsControl?.activate(existing.id);
      return;
    }
  }

  const tabsControl = (window as any).tabsControl;
  tabsControl?.activate(existing.id);
  await bootstrapState(existing, {
    title: id || existing.title || 'Diagramm',
    xml,
    fileName: fileName ? sanitizeFileName(fileName) : existing.fileName,
    statusMessage: source === 'host' ? 'Aus Host geladen' : (fileName ? `Geladen: ${fileName}` : 'Datei geladen'),
    activate: true
  });
}

export function detectDiagramType(xml: string): 'bpmn' | 'dmn' {
  if (xml.includes('dmn:definitions') ||
      xml.includes('<definitions') && xml.includes('dmn') ||
      xml.includes('<decision') ||
      xml.includes('dmn:decision')) {
    return 'dmn';
  }
  return 'bpmn';
}

export async function saveXML() {
  const state = getActiveState();
  if (!state) return;
  try {
    const withFlowableHeader = await prepareXmlForExport();
    debug('save: browser download fallback');

    let id: string | null;
    let extension: string;
    if (state.kind === 'dmn') {
      id = deriveDmnId(withFlowableHeader);
      extension = '.dmn';
    } else {
      id = deriveProcessId(withFlowableHeader);
      extension = '.bpmn20.xml';
    }

    const name = sanitizeFileName((id || 'diagram') + extension);
    download(name, withFlowableHeader, 'application/xml');
    state.fileName = name;
    persistActiveTab(state);
    await updateBaseline(state);
    setStatus('XML exportiert');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Export als XML');
  }
}

export async function saveSVG() {
  const state = getActiveState();
  if (!state || !state.modeler) return;

  // SVG export is only supported for BPMN diagrams
  if (state.kind !== 'bpmn') {
    setStatus('SVG-Export nur für BPMN-Diagramme verfügbar');
    return;
  }

  try {
    const { svg } = await state.modeler.saveSVG();
    let name = 'diagram.svg';
    try {
      const { xml } = await state.modeler.saveXML({ format: false });
      const pid = deriveProcessId(xml);
      name = sanitizeFileName(((pid || 'diagram') + '.svg'));
    } catch {}
    debug('save-svg: browser download fallback');
    download(name, svg, 'image/svg+xml');
    setStatus('SVG exportiert');
  } catch (err) {
    console.error(err);
    alert('Fehler beim Export als SVG');
  }
}

export async function saveSVGWithSidecarFallback() {
  const state = getActiveState();
  if (!state || !state.modeler) return;

  // SVG export is only supported for BPMN diagrams
  if (state.kind !== 'bpmn') {
    setStatus('SVG-Export nur für BPMN-Diagramme verfügbar');
    return;
  }

  try {
    const { svg } = await state.modeler.saveSVG();
    if (hostAvailable() && sidecar) {
      let suggestedName = 'diagram.svg';
      try {
        const { xml } = await state.modeler.saveXML({ format: false });
        const pid = deriveProcessId(xml);
        suggestedName = sanitizeFileName(((pid || 'diagram') + '.svg'));
      } catch {}
      debug('save-svg: request host doc.saveSvg', { size: svg.length, suggestedName });
      const res: any = await sidecar.request('doc.saveSvg', { svg, suggestedName }, 120000);
      if (res && res.ok) {
        debug('save-svg: host ok', { path: (res && res.path) || undefined });
        setStatus('Über Host gespeichert');
        return;
      }
      if (res && res.canceled) {
        debug('save-svg: host canceled');
        setStatus('Speichern abgebrochen');
        return;
      }
      debug('save-svg: host returned not ok', res);
      setStatus('Speichern fehlgeschlagen' + ((res && res.error) ? (': ' + String(res.error)) : ''));
    }
  } catch (e) {
    debug('save-svg: host error/no host; fallback', e);
  }
  await saveSVG();
}

export function download(filename: string, data: string, type: string) {
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

export async function prepareXmlForExport(): Promise<string> {
  const state = getActiveState();
  if (!state) throw new Error('No active diagram state');

  if (state.kind === 'dmn') {
    const { xml } = await state.modeler.saveXML({ format: true });
    const syncedXml = syncDmnDecisionIdWithName(xml);
    const cdataXml = wrapDmnTableValuesInCDATA(syncedXml);
    const cleanedXml = removeDMNDI(cdataXml);
    debug('DMN save: ID-name sync, CDATA wrapping, and DMNDI removal applied', {
      original: xml.length,
      synced: syncedXml.length,
      cdata: cdataXml.length,
      cleaned: cleanedXml.length
    });
    return cleanedXml;
  }

  const { applyPreExportConfigurations } = await import('./model-transformations');
  applyPreExportConfigurations(state.modeler);
  const { xml } = await state.modeler.saveXML({ format: true });
  return applyExportTransformations(xml);
}

export async function openViaSidecarOrFile() {
  const waitForHostConnected = (timeoutMs = 2000) => new Promise<boolean>((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (hostAvailable()) return resolve(true);
      if (Date.now() - start >= timeoutMs) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });

  const currentSidecar = (window as any).sidecar || sidecar;

  if (!hostAvailable() || !currentSidecar) {
    setStatus('Verbinde mit Host…');
    const connected = await waitForHostConnected(2000);
    if (!connected) {
      debug('open: host not connected after wait; falling back to file input');
      setStatus('Host nicht verbunden - lokale Datei wählen');
      triggerOpen(); // Fallback to local file picker
      return;
    }
  }

  try {
    debug('open: request host doc.load');
    const useSidecar = (window as any).sidecar || sidecar;
    const res: any = await useSidecar!.request('doc.load', undefined, 120000);
    let xml: string | undefined;
    let fileName: string | undefined;
    let canceled = false;
    if (typeof res === 'string') {
      xml = res;
    } else if (res && typeof res === 'object') {
      if (typeof res.xml === 'string') xml = res.xml;
      if (typeof res.fileName === 'string') fileName = sanitizeFileName(res.fileName);
      if (res.canceled === true) canceled = true;
    }
    if (typeof xml === 'string' && xml.trim()) {
      debug('open: host response', { length: xml.length, fileName });
      await openXmlConsideringDuplicates(xml, fileName, 'host');
      return;
    }
    if (canceled) {
      debug('open: host canceled by user');
      setStatus('Öffnen abgebrochen');
      return;
    }
    debug('open: host returned empty/invalid; aborting without fallback');
    setStatus('Öffnen fehlgeschlagen');
  } catch (e) {
    debug('open: host error; aborting without fallback', e);
    setStatus('Öffnen fehlgeschlagen');
  }
}

export async function saveXMLWithSidecarFallback() {
  const state = getActiveState();
  if (!state) return;
  try {
    const xml = await prepareXmlForExport();
    if (hostAvailable() && sidecar) {
      debug('save: request host doc.save', { size: xml.length });
      const res: any = await sidecar.request('doc.save', { xml, diagramType: state.kind }, 120000);
      if (res && res.ok) {
        debug('save: host ok', { path: (res && res.path) || undefined });
        const path = typeof res.path === 'string' ? res.path : undefined;
        if (path) {
          const parts = path.split(/[/\\]/);
          const fileName = parts[parts.length - 1];
          if (fileName) state.fileName = fileName;
        }
        persistActiveTab(state);
        await updateBaseline(state);
        setStatus('Über Host gespeichert');
        return;
      }
      if (res && res.canceled) {
        debug('save: host canceled');
        setStatus('Speichern abgebrochen');
        return;
      }
      debug('save: host returned not ok', res);
      setStatus('Speichern fehlgeschlagen' + ((res && res.error) ? (': ' + String(res.error)) : ''));
    }
  } catch (e) {
    debug('save: host error/no host; fallback', e);
  }
  await saveXML();
}