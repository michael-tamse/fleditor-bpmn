import BpmnModeler from 'bpmn-js/lib/Modeler';
import { Tabs } from './tabs';

const el = document.getElementById('diagramTabs')!;
type ModelerInstance = InstanceType<typeof BpmnModeler>;

const editors = new Map<string, ModelerInstance>();
const savedHash = new Map<string, number>(); // optional für Dirty-Check baseline

let seq = 1;

const tabs = new Tabs(el, {
  onCreatePanel(id, panel) {
    const modeler = new BpmnModeler({ container: panel as HTMLElement });
    editors.set(id, modeler);

    // Beispiel: XML laden (ersetzte xmlString durch echte Daten)
    // await modeler.importXML(xmlString);
    baseline(id, modeler); // baseline-Hash setzen

    // Dirty-Tracking
    modeler.get('eventBus').on('commandStack.changed', () => tabs.markDirty(id, true));
  },

  onActivate(id) {
    if (!id) return;
    // Canvas auf neue Sichtbarkeit reagieren lassen
    const modeler = editors.get(id);
    if (!modeler) return;
    const canvas = modeler.get('canvas');
    canvas.resized(); // wichtig bei display:none → block
    // Optional: Fit auf Viewport (nur wenn erwünscht)
    // canvas.zoom('fit-viewport', 'auto');
  },

  async onClose(id) {
    const modeler = editors.get(id);
    if (!modeler) return true;

    // Dirty-Check
    const isDirty = await dirty(id, modeler);
    if (isDirty) {
      const ok = confirm('Es gibt ungespeicherte Änderungen. Tab trotzdem schließen?');
      if (!ok) return false;
    }
    return true;
  },

  onDestroyPanel(id, _panel) {
    const modeler = editors.get(id);
    if (modeler) { modeler.destroy(); editors.delete(id); savedHash.delete(id); }
  },

  onAddRequest() {
    addDiagram();
  }
});

function addDiagram(title = `Diagram ${seq}`) {
  const id = `diagram-${seq++}`;
  tabs.add({ id, title, closable: true });
}

// Hilfsfunktionen
function baseline(id: string, modeler: ModelerInstance) {
  modeler.saveXML({ format: true }).then(({ xml }: { xml: string }) => savedHash.set(id, hash(xml)));
}
async function dirty(id: string, modeler: ModelerInstance) {
  try {
    const { xml }: { xml: string } = await modeler.saveXML({ format: true });
    const base = savedHash.get(id);
    return typeof base === 'number' ? base !== hash(xml) : false;
  } catch {
    return false;
  }
}
function hash(s: string) { let h = 0; for (let i=0;i<s.length;i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0; return h; }

// Beispiel: Tabs anlegen
addDiagram('Process A.bpmn');
addDiagram('Order.bpmn');

// Beispiel: Nach dem Speichern Dirty zurücksetzen und Baseline neu setzen
async function saveActive(id: string) {
  const modeler = editors.get(id);
  if (!modeler) return;
  const { xml }: { xml: string } = await modeler.saveXML({ format: true });
  // ... speichern (Filesystem/Backend)
  savedHash.set(id, hash(xml));
  tabs.markDirty(id, false);
}
