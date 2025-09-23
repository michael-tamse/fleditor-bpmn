/* flowable-autocomplete.ts
   Mini-Autocomplete + Snippet-Tabstops für dmn-js Decision Tables (Plain TS)
   - Öffnen: automatisch bei passenden Präfixen oder CTRL+SPACE
   - Auswahl: ↑/↓, Enter/Tab
   - Tab-Stops: [[…]] Marker, Tab/Shift+Tab springt durch
*/
type Suggestion = {
  label: string;
  insertText: string;   // darf [[…]]-Marker enthalten
  detail?: string;
  keywords?: string[];
};

const SUGGESTIONS: Suggestion[] = [
  // ---- Collection Helpers (Strings) ----
  {
    label: 'collection:anyOf(var, "a","b")',
    insertText: '${collection:anyOf([[inVarCollection]], \'"[[\\"a\\",\\"b\\"]]"\' )}',
    detail: 'Prüft ob Variable einen der angegebenen String-Werte enthält',
    keywords: ['${co','anyof','collection','strings']
  },
  {
    label: 'collection:noneOf(var, "a","b")',
    insertText: '${collection:noneOf([[inVarCollection]], \'"[[\\"a\\",\\"b\\"]]"\' )}',
    detail: 'Prüft ob Variable keinen der angegebenen String-Werte enthält',
    keywords: ['${co','noneof','collection','strings']
  },
  {
    label: 'collection:allOf(var, "a","b")',
    insertText: '${collection:allOf([[inVarCollection]], \'"[[\\"a\\",\\"b\\"]]"\' )}',
    detail: 'Prüft ob Variable alle angegebenen String-Werte enthält',
    keywords: ['${co','allof','collection','strings']
  },
  {
    label: 'collection:notAllOf(var, "a","b")',
    insertText: '${collection:notAllOf([[inVarCollection]], \'"[[\\"a\\",\\"b\\"]]"\' )}',
    detail: 'Prüft ob Variable nicht alle angegebenen String-Werte enthält',
    keywords: ['${co','notallof','collection','strings']
  },

  // ---- Collection Helpers (Numbers) ----
  {
    label: 'collection:noneOf(var, 9,8,2)',
    insertText: '${collection:noneOf([[inVarNumber]], \'[[9,8,2]]\')}',
    detail: 'Prüft ob Variable keinen der angegebenen Zahlenwerte enthält',
    keywords: ['${co','noneof','numbers']
  },
  {
    label: 'collection:allOf(var, 7,8,9)',
    insertText: '${collection:allOf([[inVarNumber]], \'[[7,8,9]]\')}',
    detail: 'Prüft ob Variable alle angegebenen Zahlenwerte enthält',
    keywords: ['${co','allof','numbers']
  },
  {
    label: 'collection:anyOf(var, 10,1,12)',
    insertText: '${collection:anyOf([[inVarNumber]], \'[[10,1,12]]\')}',
    detail: 'Prüft ob Variable einen der angegebenen Zahlenwerte enthält',
    keywords: ['${co','anyof','numbers']
  },

  // ---- Vergleichsoperatoren ----
  { label: '== "text"', insertText: '== "[[text]]"', detail: 'Gleichheit für Strings', keywords: ['=='] },
  { label: '!= "text"', insertText: '!= "[[text]]"', detail: 'Ungleichheit für Strings', keywords: ['!='] },
  { label: '== number', insertText: '== [[2]]', detail: 'Gleichheit für Zahlen', keywords: ['=='] },
  { label: '!= number', insertText: '!= [[3]]', detail: 'Ungleichheit für Zahlen', keywords: ['!='] },
  { label: '< number',  insertText: '< [[10]]', detail: 'Kleiner als', keywords: ['<'] },
  { label: '> number',  insertText: '> [[4]]', detail: 'Größer als', keywords: ['>'] },
  { label: '>= number', insertText: '>= [[5]]', detail: 'Größer gleich', keywords: ['>='] },
  { label: '<= number', insertText: '<= [[6]]', detail: 'Kleiner gleich', keywords: ['<='] },

  // ---- Dates ----
  {
    label: "date:toDate('YYYY-MM-DD')",
    insertText: "date:toDate('[[2025-09-15]]')",
    detail: 'Konvertiert String zu Datum',
    keywords: ['date','toDate']
  },

  // ---- Boolean ----
  { label: '== true',  insertText: '== [[true]]', detail: 'Wahrheitswert prüfen', keywords: ['true']  },
  { label: '!= false', insertText: '!= [[false]]', detail: 'Nicht-Falsch prüfen', keywords: ['false'] },

  // ---- Variables ----
  { label: '${variable}', insertText: '${[[variableName]]}', detail: 'JUEL Variable', keywords: ['${', 'var'] },

  // ---- Empty/Null checks ----
  { label: 'empty(var)', insertText: 'empty([[variable]])', detail: 'Prüft ob Variable leer ist', keywords: ['empty'] },
  { label: '!empty(var)', insertText: '!empty([[variable]])', detail: 'Prüft ob Variable nicht leer ist', keywords: ['!empty', 'not empty'] }
];

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, text?: string
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function editableTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof HTMLElement)) return null;
  if (node.getAttribute('contenteditable') === 'true') return node;
  return node.closest('[contenteditable="true"]') as HTMLElement | null;
}

function caretRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0).cloneRange();
  r.collapse(true);
  const rects = r.getClientRects();
  if (rects.length) return rects[0];
  const dummy = document.createElement('span');
  dummy.textContent = '\u200B';
  r.insertNode(dummy);
  const rect = dummy.getBoundingClientRect();
  dummy.remove();
  return rect;
}

function insertTextAtSelection(text: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const r = sel.getRangeAt(0);
  r.deleteContents();
  r.insertNode(document.createTextNode(text));
  sel.collapse(r.endContainer, (r.endContainer as Text).length || 0);
}

function tokenBeforeCaret(): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const r = sel.getRangeAt(0);
  const pre = r.cloneRange();
  pre.selectNodeContents(r.startContainer);
  pre.setEnd(r.startContainer, r.startOffset);
  const s = pre.toString();
  const m = s.match(/([$\w:!<>=]{1,20})$/);
  return m ? m[1] : '';
}

// ---- Placeholder Engine ----
// Marker-Syntax: [[…]]  (z. B. [[inVarCollection]] oder [[10,1,12]])
type PH = { node: Text; start: number; end: number };

function findPlaceholders(root: HTMLElement): PH[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: PH[] = [];
  while (walker.nextNode()) {
    const n = walker.currentNode as Text;
    const txt = n.nodeValue || '';
    const re = /\[\[(.+?)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt))) {
      out.push({ node: n, start: m.index, end: m.index + m[0].length });
    }
  }
  return out;
}

function selectRange(node: Text, start: number, end: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.setStart(node, start);
  r.setEnd(node, end);
  sel.removeAllRanges();
  sel.addRange(r);
}

function currentSelectionIsInside(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const anchor = sel.anchorNode;
  return !!anchor && el.contains(anchor);
}

class FlowableAutocomplete {
  private container: HTMLElement;
  private popup: HTMLDivElement;
  private list!: HTMLUListElement;
  private visible = false;
  private activeIndex = 0;
  private anchorEl: HTMLElement | null = null;

  // Tabstop-Session
  private phList: PH[] = [];
  private phIndex = -1;

  static $inject = [ 'eventBus', 'sheet' ];

  constructor(eventBus: any, sheet: any) {
    this.container = sheet.getContainer();
    this.popup = this.buildPopup();

    this.container.addEventListener('keydown', this.onKeyDown, true);
    this.container.addEventListener('input', this.onInput, true);
    this.container.addEventListener('focusin', (e) => {
      this.anchorEl = editableTarget(e.target);
      this.resetPH();
    });
    this.container.addEventListener('click', () => this.hide());

    eventBus.on('sheet.clear', () => { this.hide(); this.resetPH(); });
  }

  private buildPopup(): HTMLDivElement {
    const root = createEl('div', 'flowable-ac');
    Object.assign(root.style, {
      position: 'fixed', display: 'none', zIndex: '9999',
      minWidth: '320px', maxHeight: '300px', overflowY: 'auto',
      border: '1px solid #d0d7de', background: '#fff',
      boxShadow: '0 8px 24px rgba(140,149,159,0.2)', borderRadius: '8px',
      fontSize: '13px', fontFamily: 'system-ui, sans-serif'
    } as CSSStyleDeclaration);
    this.list = createEl('ul', 'flowable-ac-list') as HTMLUListElement;
    Object.assign(this.list.style, { listStyle: 'none', margin: '4px', padding: '0' });
    root.appendChild(this.list);
    document.body.appendChild(root);
    return root;
  }

  // ---- Events ----

  private onKeyDown = (e: KeyboardEvent) => {
    const target = editableTarget(e.target);
    if (!target) return;

    // Manuell öffnen
    if (e.ctrlKey && e.key === ' ') {
      e.preventDefault();
      this.anchorEl = target;
      this.openWithToken(tokenBeforeCaret());
      return;
    }

    // Während Popup offen ist: Navigation
    if (this.visible) {
      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); this.setActive(this.activeIndex + 1); return;
        case 'ArrowUp':   e.preventDefault(); this.setActive(this.activeIndex - 1); return;
        case 'Tab':
        case 'Enter':     e.preventDefault(); this.applyActive(); return;
        case 'Escape':    e.preventDefault(); this.hide(); return;
      }
    }

    // Tabstop-Navigation (nur wenn wir Platzhalter in dieser Zelle haben)
    if (e.key === 'Tab' && this.anchorEl && currentSelectionIsInside(this.anchorEl)) {
      const list = this.ensurePHList();
      if (list.length) {
        e.preventDefault();
        if (e.shiftKey) this.jumpPH(-1);
        else this.jumpPH(+1);
      }
    }
  };

  private onInput = (e: Event) => {
    const t = editableTarget(e.target);
    if (!t) return;

    // Trigger-Heuristik für das Popup
    const tok = tokenBeforeCaret();
    if (
      tok.startsWith('${co') || tok.startsWith('${') || tok.startsWith('date') ||
      ['==','!=','<=','>=','<','>'].includes(tok) ||
      tok.startsWith('tru') || tok.startsWith('fal') || tok.startsWith('emp')
    ) {
      this.anchorEl = t;
      this.openWithToken(tok);
    } else if (this.visible) {
      this.openWithToken(tok);
    }

    // Wenn wir gerade in einer Snippet-Session sind: nach Tipp-Ereignis neu scannen
    if (this.anchorEl && currentSelectionIsInside(this.anchorEl)) {
      this.refreshPH();
    }
  };

  // ---- Popup ----

  private openWithToken(token: string) {
    const items = SUGGESTIONS.filter(s => this.matches(s, token));
    if (!items.length) { this.hide(); return; }

    this.list.innerHTML = '';
    items.forEach((s, i) => {
      const li = createEl('li', 'flowable-ac-item') as HTMLLIElement;
      Object.assign(li.style, {
        padding: '8px 12px', cursor: 'pointer', borderRadius: '4px',
        margin: '2px 0'
      });
      li.dataset.index = String(i);

      const title = createEl('div', 'flowable-ac-title', s.label);
      Object.assign(title.style, {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '12px', fontWeight: '500', color: '#24292f'
      });

      li.appendChild(title);

      if (s.detail) {
        const detail = createEl('div', 'flowable-ac-detail', s.detail);
        Object.assign(detail.style, {
          fontSize: '11px', opacity: '0.7', marginTop: '2px',
          color: '#656d76'
        });
        li.appendChild(detail);
      }

      li.addEventListener('mouseenter', () => this.setActive(Number(li.dataset.index)));
      li.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        this.activeIndex = Number(li.dataset.index);
        this.applyActive(items);
      });

      this.list.appendChild(li);
    });

    this.activeIndex = 0;
    this.updateActiveStyles();
    const rect = caretRect();
    if (rect) {
      this.popup.style.left = Math.round(rect.left) + 'px';
      this.popup.style.top  = Math.round(rect.bottom + 6) + 'px';
    }
    this.popup.style.display = 'block';
    this.visible = true;
    (this.popup as any)._items = items;
  }

  private setActive(i: number) {
    const items: Suggestion[] = (this.popup as any)._items || [];
    if (!items.length) return;
    this.activeIndex = (i + items.length) % items.length;
    this.updateActiveStyles();
  }

  private updateActiveStyles() {
    Array.from(this.list.children).forEach((el, i) => {
      (el as HTMLElement).style.background = (i === this.activeIndex) ? '#f2f8ff' : 'transparent';
    });
  }

  private applyActive(itemsParam?: Suggestion[]) {
    const items: Suggestion[] = itemsParam || (this.popup as any)._items || [];
    const s = items[this.activeIndex];
    if (!s) return;
    insertTextAtSelection(s.insertText);
    this.hide();

    // Starte Tabstop-Session in aktueller Zelle
    if (this.anchorEl) {
      this.phList = findPlaceholders(this.anchorEl);
      this.phIndex = -1;
      this.jumpPH(+1); // direkt zum ersten [[…]]
    }
  }

  private hide() {
    this.popup.style.display = 'none';
    this.visible = false;
    (this.popup as any)._items = [];
  }

  private matches(s: Suggestion, token: string): boolean {
    if (!token) return false;
    const t = token.toLowerCase();
    if (s.label.toLowerCase().includes(t)) return true;
    return s.keywords?.some(k => k.toLowerCase().startsWith(t)) ?? false;
  }

  // ---- Placeholder Session ----

  private ensurePHList(): PH[] {
    if (!this.anchorEl) return [];
    if (!this.phList.length) this.phList = findPlaceholders(this.anchorEl);
    return this.phList;
  }

  private jumpPH(delta: number) {
    const list = this.ensurePHList();
    if (!list.length) return;
    this.phIndex = (this.phIndex + delta + list.length) % list.length;
    const ph = list[this.phIndex];
    selectRange(ph.node, ph.start, ph.end);
  }

  private refreshPH() {
    if (!this.anchorEl) return;
    // Re-scan; set index auf nächsten existierenden
    const old = this.phList[this.phIndex];
    this.phList = findPlaceholders(this.anchorEl);
    if (!this.phList.length) { this.resetPH(); return; }

    if (old) {
      // Versuche, den Platzhalter mit gleicher Text-Position zu finden (best effort)
      // sonst bleibt der Index einfach bestehen
      const idx = this.phList.findIndex(ph => ph.node === old.node && ph.start === old.start && ph.end === old.end);
      if (idx >= 0) this.phIndex = idx;
      else if (this.phIndex >= this.phList.length) this.phIndex = this.phList.length - 1;
    } else {
      this.phIndex = -1;
    }
  }

  private resetPH() {
    this.phList = [];
    this.phIndex = -1;
  }
}

// dmn-js DI Module
export default {
  __init__: [ 'flowableAutocomplete' ],
  flowableAutocomplete: [ 'type', FlowableAutocomplete ]
};