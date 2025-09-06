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
          // Entferne mögliche Script Task-Einträge (je nach Provider/Version)
          Object.keys(entries).forEach((k) => {
            const v = entries[k];
            const title = (v && (v.title || v.alt || '')) + '';
            if (/script[- ]?task/i.test(k) || /\bscript\b/i.test(title)) {
              delete entries[k];
            }
          });
          // Entferne ad-hoc sub-process aus der Palette (vorsorglich)
          Object.keys(entries).forEach((k) => {
            const v = entries[k];
            const title = (v && (v.title || v.alt || '')) + '';
            if (/ad[- ]?hoc/i.test(k) || /ad[- ]?hoc/i.test(title)) {
              delete entries[k];
            }
          });
          return entries;
        };
      }

      // ContextPad filtern
      const contextPadProvider = injector.get('contextPadProvider', false);
      if (contextPadProvider && typeof contextPadProvider.getContextPadEntries === 'function') {
        const originalGetCP = contextPadProvider.getContextPadEntries.bind(contextPadProvider);

        function isTask(element) {
          const t = (element && (element.type || element.businessObject && element.businessObject.$type)) || '';
          return /Task$/.test(t);
        }

        contextPadProvider.getContextPadEntries = function (element) {
          const entries = originalGetCP(element) || {};

          // Entferne Data Object/Store Aktionen
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

          // Für Tasks: nur "Sub-Process (collapsed)" entfernen (expanded erlauben)
          if (isTask(element)) {
            Object.keys(entries).forEach((k) => {
              if (/sub[- ]?process.*collapsed/i.test(k)) {
                delete entries[k];
              }
            });
            // bekannte Varianten (nur collapsed entfernen)
            delete entries['append.subprocess-collapsed'];
          }

          // Entferne Script Task Create/Append-Einträge generell
          Object.keys(entries).forEach((k) => {
            const v = entries[k];
            const title = (v && (v.title || '')) + '';
            if (/script[- ]?task/i.test(k) || /\bscript\b/i.test(title)) {
              delete entries[k];
            }
          });
          delete entries['append.script-task'];
          delete entries['create.script-task'];

          return entries;
        };
      }

      // Replace-Menü (Change Type) filtern: Sub-Process (collapsed/expanded) entfernen
      const replaceMenuProvider = injector.get('replaceMenuProvider', false);
      if (replaceMenuProvider && typeof replaceMenuProvider.getEntries === 'function') {
        const originalReplaceEntries = replaceMenuProvider.getEntries.bind(replaceMenuProvider);
        replaceMenuProvider.getEntries = function(element) {
          const entries = originalReplaceEntries(element) || [];
          return entries.filter((entry) => {
            const id = String(entry.id || '');
            const label = String(entry.label || '');
            const targetType = entry && entry.target && entry.target.type ? String(entry.target.type) : '';
            const isExpanded = entry && entry.target && Object.prototype.hasOwnProperty.call(entry.target, 'isExpanded')
              ? !!entry.target.isExpanded
              : undefined;

            // Entferne nur Sub-Process (collapsed), expanded erlauben
            if (
              // robuste Erkennung über Zieltyp + Flag
              (targetType === 'bpmn:SubProcess' && isExpanded === false) ||
              // oder konservativ über ID/Label-Fallbacks
              /sub[- ]?process.*collapsed/i.test(id) || /collapsed.*sub[- ]?process/i.test(id) ||
              (/sub[- ]?process/i.test(label) && /collapsed/i.test(label))
            ) {
              return false;
            }

            // Entferne Script Task Optionen
            if (/script[- ]?task/i.test(id) || (/script/i.test(label) && /task/i.test(label)) || /bpmn:ScriptTask$/.test(targetType)) {
              return false;
            }

            // Entferne Ad-hoc Sub-Process Optionen
            if (/ad[- ]?hoc/i.test(id) || /ad[- ]?hoc/i.test(label) || /bpmn:AdHocSubProcess$/.test(targetType)) {
              return false;
            }

            return true;
          });
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
        // Nach Import Modell bereinigen (ScriptTask -> Task)
        sanitizeModel();
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

  // Hilfsfunktion: Script Tasks verhindern (ersetzt zu bpmn:Task)
  function sanitizeModel() {
    try {
      const elementRegistry = modeler.get('elementRegistry');
      const bpmnReplace = modeler.get('bpmnReplace');
      if (!elementRegistry || !bpmnReplace) return;
      const scriptTasks = elementRegistry.filter((el) => el?.businessObject?.$type === 'bpmn:ScriptTask');
      scriptTasks.forEach((el) => {
        try {
          bpmnReplace.replaceElement(el, { type: 'bpmn:Task' });
        } catch (e) {
          console.warn('Konnte ScriptTask nicht ersetzen:', e);
        }
      });
    } catch (e) {
      console.warn('Sanitize fehlgeschlagen:', e);
    }
  }

  // Auch nach jedem Import sicherstellen
  modeler.on('import.done', () => {
    sanitizeModel();
    // Palette nach Anpassungen neu zeichnen
    const palette = modeler.get('palette', false);
    if (palette && typeof palette._update === 'function') {
      try { palette._update(); } catch (_) {}
    }
  });

  // Fallback: DOM-basiertes Ausblenden von Replace-Menü-Einträgen,
  // falls Provider-Overrides eine Variante nicht abdecken.
  (function setupPopupFilter() {
    const hideEntry = (el) => {
      if (!el) return false;
      const id = (el.getAttribute('data-id') || '').toLowerCase();
      const text = (el.textContent || '').toLowerCase();
      if (
        id.includes('replace-with-subprocess-collapsed') ||
        (text.includes('sub-process') && text.includes('collapsed')) ||
        id.includes('replace-with-script-task') ||
        (text.includes('script') && text.includes('task')) ||
        id.includes('replace-with-ad-hoc-subprocess') ||
        id.includes('replace-with-adhoc-subprocess') ||
        text.includes('ad-hoc sub-process') ||
        text.includes('adhoc sub-process') ||
        text.includes('ad hoc sub-process')
      ) {
        el.remove();
        return true;
      }
      return false;
    };

    const observer = new MutationObserver((mutations) => {
      let changed = false;
      mutations.forEach((m) => {
        if (m.addedNodes && m.addedNodes.length) {
          m.addedNodes.forEach((n) => {
            if (!(n instanceof Element)) return;
            if (n.matches && n.matches('.djs-popup .entry')) {
              changed = hideEntry(n) || changed;
            }
            n.querySelectorAll && n.querySelectorAll('.djs-popup .entry').forEach((el) => {
              changed = hideEntry(el) || changed;
            });
          });
        }
      });
      // Keine weitere Aktion nötig; Entfernen aus DOM reicht.
    });

    observer.observe(document.body, { subtree: true, childList: true });
  })();
})();
