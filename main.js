/*
  Einfache BPMN Editor-Seite mit bpmn.io Modeler
  - Neues Diagramm
  - Öffnen (Datei)
  - Speichern (XML/SVG)
  - Zoom/Fit
  - Drag&Drop Import
*/

(function () {
  const $ = (sel) => document.querySelector(sel);
  const statusEl = $('#status');

  // Erstelle Modeler
  const modeler = new BpmnJS({
    container: '#canvas',
  });

  // UI anpassen: Entferne DataObject/DataStore in Palette & ContextPad
  (function customizeProviders() {
    try {
      const injector = modeler.get('injector');

      // Palette filtern
      const paletteProvider = injector.get('paletteProvider', false);
      if (paletteProvider && typeof paletteProvider.getPaletteEntries === 'function') {
        const originalGet = paletteProvider.getPaletteEntries.bind(paletteProvider);
        paletteProvider.getPaletteEntries = function () {
          const entries = originalGet();
          const keys = Object.keys(entries);
          keys.forEach((k) => {
            if (/data-(object|store)/i.test(k)) {
              delete entries[k];
            }
          });
          // Fallback: auch bekannte Aktionsnamen entfernen
          delete entries['create.data-object'];
          delete entries['create.data-object-reference'];
          delete entries['create.data-store'];
          delete entries['create.data-store-reference'];
          return entries;
        };
      }

      // ContextPad filtern
      const contextPadProvider = injector.get('contextPadProvider', false);
      if (contextPadProvider && typeof contextPadProvider.getContextPadEntries === 'function') {
        const originalGetCP = contextPadProvider.getContextPadEntries.bind(contextPadProvider);
        contextPadProvider.getContextPadEntries = function (element) {
          const entries = originalGetCP(element) || {};
          Object.keys(entries).forEach((k) => {
            if (/data-(object|store)/i.test(k)) {
              delete entries[k];
            }
          });
          // Fallback: bekannte Schlüssel entfernen (je nach Version variierend)
          delete entries['append.data-object-reference'];
          delete entries['append.data-store-reference'];
          delete entries['create.data-object'];
          delete entries['create.data-store'];
          return entries;
        };
      }

      // Palette nach Import/Init neu zeichnen
      modeler.on('import.done', () => {
        const palette = modeler.get('palette', false);
        if (palette && typeof palette._update === 'function') {
          try { palette._update(); } catch (_) {}
        }
      });
    } catch (e) {
      // still continue if customization fails
      console.warn('Palette/ContextPad customization failed:', e);
    }
  })();

  // Starter Diagramm (minimales BPMN 2.0)
  const initialXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
  }

  async function createNew() {
    try {
      await modeler.importXML(initialXml);
      const canvas = modeler.get('canvas');
      canvas.zoom('fit-viewport', 'auto');
      setStatus('Neues Diagramm geladen');
    } catch (err) {
      console.error(err);
      alert('Fehler beim Erstellen eines neuen Diagramms');
      setStatus('Fehler beim Laden');
    }
  }

  async function openFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await modeler.importXML(e.target.result);
        modeler.get('canvas').zoom('fit-viewport', 'auto');
        setStatus(`Geladen: ${file.name}`);
      } catch (err) {
        console.error(err);
        alert('Fehler beim Import der Datei.');
        setStatus('Import fehlgeschlagen');
      }
    };
    reader.readAsText(file);
  }

  function triggerOpen() {
    const input = $('#file-input');
    input.value = '';
    input.onchange = () => openFile(input.files[0]);
    input.click();
  }

  async function saveXML() {
    try {
      const { xml } = await modeler.saveXML({ format: true });
      download('diagram.bpmn', xml, 'application/xml');
      setStatus('XML exportiert');
    } catch (err) {
      console.error(err);
      alert('Fehler beim Export als XML');
    }
  }

  async function saveSVG() {
    try {
      const { svg } = await modeler.saveSVG();
      download('diagram.svg', svg, 'image/svg+xml');
      setStatus('SVG exportiert');
    } catch (err) {
      console.error(err);
      alert('Fehler beim Export als SVG');
    }
  }

  function download(filename, data, type) {
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

  function zoom(delta) {
    const canvas = modeler.get('canvas');
    const current = canvas.zoom();
    canvas.zoom(Math.max(0.2, Math.min(4, current + delta)));
  }

  function zoomReset() {
    modeler.get('canvas').zoom(1);
  }

  function fitViewport() {
    modeler.get('canvas').zoom('fit-viewport', 'auto');
  }

  // Drag & Drop Import
  (function setupDragAndDrop() {
    const target = $('#canvas');
    if (!target) return;
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((evt) => {
      target.addEventListener(evt, stop, false);
    });
    target.addEventListener('drop', (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) openFile(file);
    });
  })();

  // Toolbar Events
  $('#btn-new')?.addEventListener('click', createNew);
  $('#btn-open')?.addEventListener('click', triggerOpen);
  $('#btn-save-xml')?.addEventListener('click', saveXML);
  $('#btn-save-svg')?.addEventListener('click', saveSVG);
  $('#btn-zoom-in')?.addEventListener('click', () => zoom(+0.2));
  $('#btn-zoom-out')?.addEventListener('click', () => zoom(-0.2));
  $('#btn-zoom-reset')?.addEventListener('click', zoomReset);
  $('#btn-fit')?.addEventListener('click', fitViewport);

  // Initial laden
  createNew();
})();
