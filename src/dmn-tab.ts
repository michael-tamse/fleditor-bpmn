import DmnJS from 'dmn-js/lib/Modeler';
import FlowableAutocompleteModule from './dmn/flowable-autocomplete';

// CSS als Strings importieren für Shadow DOM
import decisionTableCss from 'dmn-js/dist/assets/dmn-js-decision-table.css?inline';
import dmnFontCss from 'dmn-js/dist/assets/dmn-font/css/dmn.css?inline';
import dmnEmbeddedCss from 'dmn-js/dist/assets/dmn-font/css/dmn-embedded.css?inline';
import dmnDrdCss from 'dmn-js/dist/assets/dmn-js-drd.css?inline';
import dmnLiteralCss from 'dmn-js/dist/assets/dmn-js-literal-expression.css?inline';
import diagramCss from 'diagram-js/assets/diagram-js.css?inline';

// Einfaches Styling nach Official DMN-js Beispiel
const localCss = `
  :host {
    display: block;
    height: 100%;
    margin: 0;
    padding: 0;
  }
  .dmn-host {
    height: 100%;
    margin: 0;
    padding: 0;
  }
`;

export class DmnTab extends HTMLElement {
  private host!: HTMLDivElement;
  private modeler!: any;
  private _xml: string | undefined;
  private resizeObserver?: ResizeObserver;
  private initPromise?: Promise<void>;
  private pendingOperations: (() => void)[] = [];

  static get observedAttributes() {
    return ['xml'];
  }

  constructor() {
    super();

    // Temporär ohne Shadow DOM für Debug-Zwecke
    // this.shadowRootEl = this.attachShadow({ mode: 'open' });

    // Host-Container für DMN-js nach Official Example
    this.host = document.createElement('div');
    this.host.className = 'dmn-host';
    this.appendChild(this.host);

    // Minimal styling nach Official Example
    this.style.cssText = 'display: block; height: 100%; margin: 0; padding: 0;';
  }

  connectedCallback() {
    // Promise für die Initialisierung erstellen
    this.initPromise = new Promise((resolve) => {
      // Kleine Verzögerung um sicherzustellen, dass das Element im DOM ist
      requestAnimationFrame(() => {
        this.initializeModeler();
        resolve();
      });
    });
  }

  private initializeModeler() {
    try {
      // DMN-js Modeler initialisieren mit Flowable Support
      this.modeler = new DmnJS({
        container: this.host,
        keyboard: { bindTo: window },
        // Zusätzliche Config für besseres Layout
        width: '100%',
        height: '100%',
        // Flowable-spezifische Konfiguration
        decisionTable: {
          additionalModules: [ FlowableAutocompleteModule ]
        },
        literalExpression: {
          additionalModules: [ FlowableAutocompleteModule ]
        },
        // JUEL als Standard-Sprache für Flowable
        defaultInputExpressionLanguage: 'juel',
        defaultOutputExpressionLanguage: 'juel',
        defaultLiteralExpressionLanguage: 'juel'
      });

      // XML importieren falls bereits gesetzt
      if (this._xml) {
        this.import(this._xml);
      }

      // ResizeObserver für Layout-Updates
      this.resizeObserver = new ResizeObserver(() => {
        this.handleResize();
      });
      this.resizeObserver.observe(this);

      // IntersectionObserver für Tab-Sichtbarkeit
      const intersectionObserver = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          requestAnimationFrame(() => {
            this.handleResize();
          });
        }
      });
      intersectionObserver.observe(this);

      // Pending operations ausführen
      this.pendingOperations.forEach(op => op());
      this.pendingOperations = [];

    } catch (error) {
      console.error('DMN modeler initialization failed:', error);
    }
  }

  disconnectedCallback() {
    if (this.modeler) {
      this.modeler.detach();
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  attributeChangedCallback(name: string, _old: any, value: any) {
    if (name === 'xml') {
      this._xml = value;
      if (this.modeler) {
        this.import(value);
      }
    }
  }

  async import(xml: string) {
    this._xml = xml;
    if (!this.modeler) {
      // Modeler noch nicht initialisiert, wird später geladen
      return;
    }

    try {
      await this.modeler.importXML(xml);

      // Nach Import automatisch zur Decision Table View wechseln
      const views = this.modeler.getViews();
      if (views && views.length > 0) {
        const decisionTableView = views.find((v: any) => v.type === 'decisionTable');
        if (decisionTableView) {
          await this.modeler.open(decisionTableView);
        }
      }

      // Layout nach Import aktualisieren
      requestAnimationFrame(() => {
        this.handleResize();
      });
    } catch (err) {
      console.error('DMN import failed:', err);
    }
  }

  // Attach/Detach für Tab-Wechsel
  async attach() {
    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.modeler) {
      // Falls Modeler immer noch nicht verfügbar, in Warteschlange einreihen
      this.pendingOperations.push(() => this.attach());
      return;
    }

    if (this.modeler && this.host) {
      this.modeler.attachTo(this.host);
      this.handleResize();
    }
  }

  detach() {
    if (this.modeler) {
      this.modeler.detach();
    }
  }

  // Resize-Handling für DMN-Layout
  private handleResize() {
    try {
      if (this.modeler && this.isVisible()) {
        // DMN-js spezifisches Layout-Update
        if (this.modeler._container) {
          // Force relayout für Table-js
          requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
            // Zusätzliches Layout-Update für decision tables
            if (this.modeler.getActiveView?.()?.type === 'decisionTable') {
              const view = this.modeler.getActiveView();
              if (view && view.invalidateSize) {
                view.invalidateSize();
              }
            }
          });
        }
      }
    } catch (err) {
      console.warn('DMN resize handling failed:', err);
    }
  }

  private isVisible(): boolean {
    return this.offsetWidth > 0 && this.offsetHeight > 0;
  }

  // Public API für das Tab-System
  getXML(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.modeler) {
        // Fallback auf gespeicherte XML zurückgreifen
        if (this._xml) {
          resolve(this._xml);
        } else {
          reject(new Error('No modeler available and no XML cached'));
        }
        return;
      }

      this.modeler.saveXML((err: any, xml: string) => {
        if (err) reject(err);
        else resolve(xml);
      });
    });
  }

  markDirty() {
    this.dispatchEvent(new CustomEvent('dmn-changed', {
      bubbles: true,
      detail: { dirty: true }
    }));
  }
}

// Web Component registrieren
if (!customElements.get('dmn-tab')) {
  customElements.define('dmn-tab', DmnTab);
}