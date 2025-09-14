# Angular Host (Starter)

This folder contains a minimal Sidecar host skeleton for Angular. Copy the code snippets into your Angular app.

Transport: DOM CustomEvents (same-window). The editor (this repo) auto-falls back to DOM transport when it's not inside an iframe.

## 1) Host Service (Angular)

Create an Angular service and paste the code below. It wraps the Sidecar bridge and exposes `request`, `emit`, and helpers.

```ts
// sidecar-host.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { SidecarBridge } from '../../src/sidecar/bridge';
import { createDomTransport } from '../../src/sidecar/transports/dom';

@Injectable({ providedIn: 'root' })
export class SidecarHostService implements OnDestroy {
  private bridge = new SidecarBridge(createDomTransport(), 'host');
  private ui = { menubar: true, propertyPanel: true };

  constructor() {
    // optional: listen to events (ui.state, doc.changed)
    // (bridge exposes only req/res/event sending; to listen low-level, use transport directly if needed)
  }

  async setMenubar(visible: boolean) {
    return this.bridge.request('ui.setMenubar', { visible });
  }
  async setPropertyPanel(visible: boolean) {
    return this.bridge.request('ui.setPropertyPanel', { visible });
  }
  async docLoad(xmlProvider: () => Promise<string> | string) {
    this.bridge.onRequest('doc.load', async () => xmlProvider());
  }
  async docSave(handler: (xml: string) => Promise<void> | void) {
    this.bridge.onRequest('doc.save', async (p: any) => { await handler(String(p?.xml || '')); return { ok: true }; });
  }

  ngOnDestroy(): void { this.bridge.dispose(); }
}
```

## 2) Host Component (Angular)

Create a component that renders the editor (its HTML/JS bundle) inside the Angular app. The simplest integration is to include the editor bundle on the page and let DOM transport work within the same window.

```ts
// editor-host.component.ts
import { Component, AfterViewInit } from '@angular/core';
import { SidecarHostService } from './sidecar-host.service';

@Component({
  selector: 'app-editor-host',
  template: `
    <div class="toolbar">
      <button (click)="toggleMenu()">Toggle Menubar</button>
      <button (click)="toggleProps()">Toggle Properties</button>
      <button (click)="save()">Save</button>
      <button (click)="open()">Open</button>
    </div>
    <div id="editor-root"></div>
  `,
  styles: [':host, #editor-root { display:block; height:100%; }']
})
export class EditorHostComponent implements AfterViewInit {
  menubar = true; props = true;
  constructor(private sidecar: SidecarHostService) {}

  ngAfterViewInit() {
    // Include the editor app bundle and mount into #editor-root.
    // Option A: serve the built app (dist) as static assets in Angular and inject a script tag here.
    // Option B: host the editor app under the same origin and navigate into it (router outlet).
    // For quick start, load via iframe:
    const iframe = document.createElement('iframe');
    iframe.src = '/index.html'; // editor entry (ensure asset served by Angular dev/prod server)
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = 'calc(100vh - 48px)';
    document.querySelector('#editor-root')!.appendChild(iframe);
    // With iframe, prefer postMessage transport. If you want DOM transport, load the editor into the same window.
  }

  toggleMenu() { this.menubar = !this.menubar; this.sidecar.setMenubar(this.menubar); }
  toggleProps() { this.props = !this.props; this.sidecar.setPropertyPanel(this.props); }
  open() { /* the editor issues doc.load on its Open button; provide a handler in the service */ }
  save() { /* the editor issues doc.save on its Save button; handle in the service */ }
}
```

## 3) Wiring doc.load / doc.save

In your Angular module or component init, register handlers:

```ts
constructor(private sidecar: SidecarHostService) {
  this.sidecar.docLoad(async () => {
    // return XML from your API or file picker
    return `<?xml version="1.0"?><bpmn:definitions xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\"><bpmn:process id=\"P\"/></bpmn:definitions>`;
  });
  this.sidecar.docSave(async (xml) => {
    // persist XML to API or download
    console.log('save xml', xml);
  });
}
```

## Notes
- If you use an iframe, the component’s Sidecar transport should be `postMessage` to target the iframe window – adapt the service accordingly.
- If you mount the editor into the same window (no iframe), DOM transport works as-is; ensure the editor JS is loaded on the same page.
- Add origin checks and proper save/open integration for production.
