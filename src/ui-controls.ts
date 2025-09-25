import { DiagramTabState, ToolbarSlot } from './types';

let modeler: any = null;
let menubarVisible = true;
let propertyPanelVisible = true;
let tabStates = new Map<string, DiagramTabState>();

export function setModeler(m: any) {
  modeler = m;
}

export function setTabStates(states: Map<string, DiagramTabState>) {
  tabStates = states;
}

export function debug(...args: any[]) {
  const DEBUG_ENABLED = (() => {
    try {
      const p = new URL(window.location.href).searchParams.get('debug');
      if (p === '1') return true;
      return localStorage.getItem('fleditor:debug') === '1';
    } catch {
      return false;
    }
  })();
  if (!DEBUG_ENABLED) return;
  try { console.debug('[fleditor]', ...args); } catch {}
}

export function setStatus(msg?: string) {
  const statusEl = document.querySelector<HTMLElement>('#status');
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

export function updateEmptyStateVisibility() {
  const el = document.querySelector<HTMLElement>('#emptyState');
  if (!el) return;
  const hasTabs = tabStates.size > 0;
  el.classList.toggle('visible', !hasTabs);
}

export function showConfirmDialog(
  message: string,
  title?: string,
  options?: { okLabel?: string; cancelLabel?: string; okVariant?: 'danger' | 'primary' }
): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.querySelector<HTMLElement>('#diagramTabs') || document.body;

    const overlay = document.createElement('div');
    overlay.className = 'tab-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const modal = document.createElement('div');
    modal.className = 'tab-confirm';

    const titleEl = document.createElement('div');
    titleEl.className = 'title';
    titleEl.textContent = title || 'Tab schließen?';

    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.textContent = message || '';

    const actions = document.createElement('div');
    actions.className = 'actions';

    const btnCancel = document.createElement('button');
    btnCancel.type = 'button';
    btnCancel.textContent = options?.cancelLabel || 'Abbrechen';

    const btnOk = document.createElement('button');
    btnOk.type = 'button';
    btnOk.className = options?.okVariant === 'primary' ? '' : 'danger';
    btnOk.textContent = options?.okLabel || 'Schließen';

    actions.append(btnCancel, btnOk);
    modal.append(titleEl, textEl, actions);
    overlay.append(modal);
    host.append(overlay);

    const cleanup = (val: boolean) => {
      try { document.removeEventListener('keydown', onKey); } catch {}
      try { overlay.remove(); } catch {}
      resolve(val);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
    };
    document.addEventListener('keydown', onKey, { capture: true });

    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    btnCancel.addEventListener('click', () => cleanup(false));
    btnOk.addEventListener('click', () => cleanup(true));

    setTimeout(() => btnOk.focus(), 0);
  });
}

export function applyPropertyPanelVisibility(state: DiagramTabState) {
  const layout = state.layoutEl;
  if (!layout) return;
  if (propertyPanelVisible) {
    layout.classList.remove('hide-properties');
    state.propertiesEl.style.display = '';
  } else {
    layout.classList.add('hide-properties');
    state.propertiesEl.style.display = 'none';
  }
}

export function setMenubarVisible(visible: boolean) {
  menubarVisible = !!visible;
  const header = document.querySelector<HTMLElement>('header.toolbar');
  if (header) header.style.display = menubarVisible ? '' : 'none';
}

export function setPropertyPanelVisible(visible: boolean) {
  propertyPanelVisible = !!visible;
  tabStates.forEach((state) => applyPropertyPanelVisibility(state));
}

export function zoom(delta: number) {
  const activeState = getActiveState();
  if (!activeState || !activeState.modeler) return;
  const canvas = activeState.modeler.get('canvas');
  const current = canvas.zoom();
  canvas.zoom(Math.max(0.2, Math.min(4, current + delta)));
}

export function zoomReset() {
  const activeState = getActiveState();
  if (!activeState || !activeState.modeler) return;
  activeState.modeler.get('canvas').zoom(1);
}

export function fitViewport() {
  const activeState = getActiveState();
  if (!activeState || !activeState.modeler) return;
  activeState.modeler.get('canvas').zoom('fit-viewport', 'auto');
}

function getActiveState() {
  return (window as any).getActiveState?.();
}

export function updateToolbarExtras() {
  const toolbarContainer = document.querySelector<HTMLElement>('.toolbar__right');
  if (!toolbarContainer) return;

  const activeState = getActiveState();
  const targetSlot: ToolbarSlot | null = activeState?.toolbarSlot ?? null;

  if (!targetSlot) {
    if (toolbarContainer.childElementCount > 0) {
      toolbarContainer.replaceChildren();
    }
    toolbarContainer.style.display = 'none';
    return;
  }

  toolbarContainer.style.display = 'flex';
  toolbarContainer.replaceChildren();

  const renderer = toolbarRenderers[targetSlot];
  if (renderer) {
    renderer(toolbarContainer);
  }
}

const toolbarRenderers: Record<ToolbarSlot, (container: HTMLElement) => void> = {
  'bpmn-controls': (container) => {
    container.append(
      createToolbarButton('btn-save-svg', 'Speichern SVG', 'Als SVG speichern'),
      createDivider(),
      createToolbarButton('btn-zoom-out', '−', 'Verkleinern'),
      createToolbarButton('btn-zoom-reset', '100%', '100%'),
      createToolbarButton('btn-zoom-in', '+', 'Vergrößern'),
      createDivider(),
      createToolbarButton('btn-fit', 'Fit', 'Auf Ansicht einpassen')
    );
  }
};

function createToolbarButton(id: string, label: string, title: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.type = 'button';
  btn.textContent = label;
  btn.title = title;
  return btn;
}

function createDivider(): HTMLSpanElement {
  const divider = document.createElement('span');
  divider.className = 'divider';
  return divider;
}

export function getMenubarVisible(): boolean {
  return menubarVisible;
}

export function getPropertyPanelVisible(): boolean {
  return propertyPanelVisible;
}
