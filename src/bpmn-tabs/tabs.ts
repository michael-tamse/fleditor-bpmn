type TabId = string;

interface TabSpec {
  id: TabId;
  title: string;
  closable?: boolean;
}

interface TabEvents {
  onActivate?(id: TabId | null): void;
  onClose?(id: TabId): Promise<boolean> | boolean;     // return false, um Schließen zu verhindern
  onCreatePanel?(id: TabId, panelEl: HTMLElement): void;
  onDestroyPanel?(id: TabId, panelEl: HTMLElement): void;
  onAddRequest?(diagramType: 'bpmn' | 'dmn'): void;
}

export class Tabs {
  private root: HTMLElement;
  private tablist: HTMLElement;
  private panels: HTMLElement;
  private leftBtn: HTMLButtonElement;
  private rightBtn: HTMLButtonElement;
  private addBtn: HTMLButtonElement | null;
  private addMenu: HTMLElement | null;
  private ro: ResizeObserver;
  private currentId: TabId | null = null;
  private menu: HTMLElement | null = null;
  private menuTarget: TabId | null = null;

  constructor(root: HTMLElement, private events: TabEvents = {}) {
    this.root = root;
    this.tablist = root.querySelector('.tablist')!;
    this.panels  = root.querySelector('.panels')!;
    this.leftBtn = root.querySelector('.scroll-btn.left') as HTMLButtonElement;
    this.rightBtn= root.querySelector('.scroll-btn.right') as HTMLButtonElement;
    this.addBtn  = root.querySelector('.add-tab') as HTMLButtonElement | null;
    this.addMenu = root.querySelector('.add-tab-menu') as HTMLElement | null;

    this.bind();
    this.ro = new ResizeObserver(() => this.updateOverflow());
    this.ro.observe(this.tablist);
    this.updateOverflow();
  }

  add(spec: TabSpec) {
    const existing = this.tabById(spec.id);
    if (existing) { this.activate(spec.id); return; }

    // Tab Button
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.type = 'button';
    btn.role = 'tab';
    btn.id = `tab-${spec.id}`;
    btn.setAttribute('aria-selected', 'false');
    btn.setAttribute('aria-controls', `panel-${spec.id}`);
    btn.dataset.tabId = spec.id;
    btn.dataset.closable = spec.closable === false ? '0' : '1';
    btn.title = spec.title;

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = spec.title;

    const dirtyDot = document.createElement('span');
    dirtyDot.className = 'dirty';
    dirtyDot.setAttribute('aria-hidden', 'true');

    btn.append(dirtyDot, title);

    if (spec.closable !== false) {
      const close = document.createElement('button');
      close.className = 'close';
      close.type = 'button';
      close.setAttribute('aria-label', `Close ${spec.title}`);
      close.textContent = '✕';
      close.addEventListener('click', (e) => { e.stopPropagation(); this.close(spec.id); });
      close.addEventListener('auxclick', (e) => {
        if ((e as MouseEvent).button === 1) {
          e.preventDefault();
          e.stopPropagation();
          this.close(spec.id);
        }
      });
      btn.append(close);
    }

    btn.addEventListener('click', () => this.activate(spec.id));
    btn.addEventListener('contextmenu', (e) => this.openContextMenu(e as MouseEvent, spec.id));
    this.tablist.appendChild(btn);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'tabpanel';
    panel.id = `panel-${spec.id}`;
    panel.role = 'tabpanel';
    panel.setAttribute('aria-labelledby', btn.id);
    panel.setAttribute('aria-hidden', 'true');

    this.panels.appendChild(panel);
    this.events.onCreatePanel?.(spec.id, panel);

    if (!this.currentId) this.activate(spec.id);
    this.updateOverflow();
  }

  markDirty(id: TabId, dirty: boolean) {
    const tab = this.tabById(id);
    if (!tab) return;
    if (dirty) tab.setAttribute('data-dirty', 'true');
    else tab.removeAttribute('data-dirty');
  }

  async close(id: TabId) {
    const tab = this.tabById(id);
    const panel = this.panelById(id);
    if (!tab || !panel) return;
    if (!this.isTabClosable(tab)) return;

    const ok = await Promise.resolve(this.events.onClose?.(id) ?? true);
    if (!ok) return;

    const wasActive = this.currentId === id;
    const tabs = Array.from(this.tablist.querySelectorAll<HTMLElement>('.tab'));
    const idx = tabs.indexOf(tab);

    tab.remove();
    this.events.onDestroyPanel?.(id, panel);
    panel.remove();

    if (wasActive && tabs.length > 1) {
      const neighbor = tabs[idx + 1] ?? tabs[idx - 1];
      const nextId = neighbor?.dataset.tabId!;
      if (nextId) this.activate(nextId);
      else {
        this.currentId = null;
        this.events.onActivate?.(null);
      }
    } else if (wasActive) {
      this.currentId = null;
      this.events.onActivate?.(null);
    }
    this.updateOverflow();
  }

  activate(id: TabId) {
    const tab = this.tabById(id);
    const panel = this.panelById(id);
    if (!tab || !panel) return;

    this.tablist.querySelectorAll<HTMLElement>('.tab').forEach(t => {
      const sel = t === tab;
      t.setAttribute('aria-selected', sel ? 'true' : 'false');
      if (sel) (t as HTMLButtonElement).focus();
    });
    this.panels.querySelectorAll<HTMLElement>('.tabpanel').forEach(p => {
      p.setAttribute('aria-hidden', p === panel ? 'false' : 'true');
    });

    this.currentId = id;
    this.scrollTabIntoView(tab);
    this.events.onActivate?.(id);
  }

  getActiveId(): TabId | null {
    return this.currentId;
  }

  setTitle(id: TabId, title: string) {
    const tab = this.tabById(id);
    if (!tab) return;
    const span = tab.querySelector<HTMLSpanElement>('.title');
    if (span) span.textContent = title;
    tab.title = title;
  }

  async closeOthers(id: TabId) {
    const tabs = this.getTabs().filter((t) => t.dataset.tabId !== id && this.isTabClosable(t));
    for (const tab of tabs) {
      const tabId = tab.dataset.tabId;
      if (tabId) await this.close(tabId);
    }
  }

  async closeAll() {
    const tabs = this.getTabs().filter((t) => this.isTabClosable(t));
    for (const tab of tabs) {
      const tabId = tab.dataset.tabId;
      if (tabId) await this.close(tabId);
    }
  }

  /* ---------- internals ---------- */

  private bind() {
    // Keyboard navigation
    this.tablist.addEventListener('keydown', (e: KeyboardEvent) => {
      const tabs = Array.from(this.tablist.querySelectorAll<HTMLButtonElement>('.tab'));
      const current = document.activeElement as HTMLButtonElement;
      const i = tabs.indexOf(current);
      const go = (j: number) => tabs[j]?.focus();

      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); go(Math.min(i + 1, tabs.length - 1)); break;
        case 'ArrowLeft':  e.preventDefault(); go(Math.max(i - 1, 0)); break;
        case 'Home':       e.preventDefault(); go(0); break;
        case 'End':        e.preventDefault(); go(tabs.length - 1); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          current?.click();
          break;
        case 'w':
        case 'W':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); const id = current?.dataset.tabId!; this.close(id); }
          break;
      }
    });

    // Wheel = horizontal scroll
    this.tablist.addEventListener('wheel', (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        this.tablist.scrollLeft += e.deltaY;
        e.preventDefault();
      }
      this.updateOverflowSoon();
    }, { passive: false });

    // Drag scroll (nice to have)
    let dragging = false, startX = 0, startLeft = 0;
    this.tablist.addEventListener('pointerdown', (e) => {
      dragging = true; startX = (e as PointerEvent).clientX; startLeft = this.tablist.scrollLeft;
      (e.target as Element).setPointerCapture?.((e as any).pointerId);
    });
    window.addEventListener('pointerup', () => dragging = false);
    window.addEventListener('pointermove', (e) => {
      if (dragging) { this.tablist.scrollLeft = startLeft - ((e as PointerEvent).clientX - startX); this.updateOverflowSoon(); }
    });

    // Scroll buttons
    this.leftBtn.addEventListener('click', () => this.smoothStep(-1));
    this.rightBtn.addEventListener('click', () => this.smoothStep(+1));
    this.addBtn?.addEventListener('click', () => this.toggleAddMenu());

    // Add menu handlers
    this.addMenu?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const diagramType = target.getAttribute('data-diagram-type') as 'bpmn' | 'dmn';
      if (diagramType) {
        this.hideAddMenu();
        this.events.onAddRequest?.(diagramType);
      }
    });

    // Resize updates
    window.addEventListener('resize', () => this.updateOverflowSoon());

    this.setupContextMenu();
  }

  private smoothStep(direction: -1 | 1) {
    const items = Array.from(this.tablist.querySelectorAll<HTMLElement>('.tab'));
    if (!items.length) return;
    const { scrollLeft, clientWidth } = this.tablist;
    const targetX = direction > 0 ? scrollLeft + clientWidth : scrollLeft - clientWidth;
    const snaps = items.map(el => el.offsetLeft);
    let best = snaps[0];
    for (const x of snaps) {
      if (direction > 0 && x > scrollLeft && x <= targetX) best = x;
      if (direction < 0 && x < scrollLeft && x >= targetX) best = x;
    }
    this.tablist.scrollTo({ left: best, behavior: 'smooth' });
    this.updateOverflowSoon();
  }

  private scrollTabIntoView(tabEl: HTMLElement) {
    const list = this.tablist;
    const left = tabEl.offsetLeft;
    const right = left + tabEl.offsetWidth;
    const viewL = list.scrollLeft;
    const viewR = viewL + list.clientWidth;
    if (left < viewL) list.scrollTo({ left, behavior: 'smooth' });
    else if (right > viewR) list.scrollTo({ left: right - list.clientWidth, behavior: 'smooth' });
    this.updateOverflowSoon();
  }

  private updateOverflowSoon = (() => {
    let t: any; 
    return () => { clearTimeout(t); t = setTimeout(() => this.updateOverflow(), 60); };
  })();

  private updateOverflow() {
    const list = this.tablist;
    const overflow = list.scrollWidth > list.clientWidth + 1;
    this.leftBtn.classList.toggle('visible', overflow && list.scrollLeft > 0);
    this.rightBtn.classList.toggle('visible', overflow && (list.scrollLeft + list.clientWidth) < list.scrollWidth - 1);
  }

  private tabById(id: TabId)  { return this.tablist.querySelector<HTMLElement>(`.tab[data-tab-id="${id}"]`); }
  private panelById(id: TabId){ return this.panels.querySelector<HTMLElement>(`#panel-${id}`); }
  private getTabs() { return Array.from(this.tablist.querySelectorAll<HTMLElement>('.tab')); }
  private isTabClosable(tab: HTMLElement) { return tab.dataset.closable !== '0'; }

  destroy() { this.ro.disconnect(); }

  private setupContextMenu() {
    this.menu = document.createElement('div');
    this.menu.className = 'tab-menu';
    this.menu.innerHTML = `
      <button type="button" data-action="close">Tab schließen</button>
      <button type="button" data-action="close-others">Andere schließen</button>
      <button type="button" data-action="close-all">Alle schließen</button>
    `;
    this.root.appendChild(this.menu);

    this.menu.addEventListener('click', async (e) => {
      const action = (e.target as HTMLElement)?.getAttribute('data-action');
      if (!action) return;
      const targetId = this.menuTarget;
      this.hideContextMenu();
      if (!targetId) return;
      if (action === 'close') {
        await this.close(targetId);
      } else if (action === 'close-others') {
        await this.closeOthers(targetId);
      } else if (action === 'close-all') {
        await this.closeAll();
      }
    });

    document.addEventListener('click', (e) => {
      this.hideContextMenu();
      // Hide add menu if clicking outside
      if (!this.addBtn?.contains(e.target as Node) && !this.addMenu?.contains(e.target as Node)) {
        this.hideAddMenu();
      }
    });
    document.addEventListener('contextmenu', () => this.hideContextMenu());
    window.addEventListener('blur', () => { this.hideContextMenu(); this.hideAddMenu(); });
  }

  private openContextMenu(evt: MouseEvent, id: TabId) {
    evt.preventDefault();
    evt.stopPropagation();
    if (!this.menu) return;
    const tab = this.tabById(id);
    if (!tab || !this.isTabClosable(tab)) return;
    this.menuTarget = id;
    const rect = this.root.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    this.menu.classList.add('open');
    const { offsetWidth, offsetHeight } = this.menu;
    const maxLeft = Math.max(6, rect.width - offsetWidth - 6);
    const maxTop = Math.max(6, rect.height - offsetHeight - 6);
    const left = Math.min(Math.max(6, x), maxLeft);
    const top = Math.min(Math.max(6, y), maxTop);
    this.menu.style.left = `${left}px`;
    this.menu.style.top = `${top}px`;
  }

  private hideContextMenu() {
    if (!this.menu) return;
    this.menuTarget = null;
    this.menu.classList.remove('open');
  }

  private toggleAddMenu() {
    if (!this.addMenu) return;
    const isOpen = this.addMenu.classList.contains('open');
    if (isOpen) {
      this.hideAddMenu();
    } else {
      this.hideContextMenu();
      this.addMenu.classList.add('open');
    }
  }

  private hideAddMenu() {
    if (!this.addMenu) return;
    this.addMenu.classList.remove('open');
  }
}
