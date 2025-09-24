export type FieldType = 'string' | 'integer' | 'double' | 'boolean' | 'json';

export interface EventField {
  name: string;
  type: FieldType;
  // UI-Status, nicht serialisiert:
  ui?: Record<string, never>; // Removed header, fullPayload, meta
}

export interface EventModel {
  key: string;
  name: string;
  correlationParameters: Array<{ name: string; type: FieldType }>;
  payload: Array<{ name: string; type: FieldType }>;
}

export interface EventEditor {
  getModel(): EventModel;
  setModel(model: EventModel): void;
  setReadOnly(readOnly: boolean): void;
  dispose(): void;
}

interface EventEditorOptions {
  model?: EventModel;
  onChange?: (model: EventModel) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

interface InternalField extends EventField {
  id: string;
  isCorrelation: boolean;
}

class EventEditorImpl implements EventEditor {
  private container: HTMLElement;
  private options: EventEditorOptions;
  private fields: InternalField[] = [];
  private originalModel: EventModel | null = null;
  private isDirty = false;
  private readOnly = false;
  private nextFieldId = 1;

  // DOM Elements
  private keyInput!: HTMLInputElement;
  private nameInput!: HTMLInputElement;
  private tableBody!: HTMLTableSectionElement;
  private addButton!: HTMLButtonElement;

  constructor(container: HTMLElement, options: EventEditorOptions = {}) {
    this.container = container;
    this.options = options;

    this.createUI();

    if (options.model) {
      this.setModel(options.model);
    }
  }

  private createUI() {
    this.container.innerHTML = `
      <div class="event-editor">
        <div class="event-header">
          <div class="header-form">
            <div class="form-group">
              <label for="event-key">Event Key</label>
              <input type="text" id="event-key" class="event-key-input" placeholder="customerPaymentEvent" required>
            </div>
            <div class="form-group">
              <label for="event-name">Generated Name</label>
              <input type="text" id="event-name" class="event-name-input" readonly>
            </div>
          </div>
        </div>

        <div class="event-table-container">
          <table class="event-table">
            <thead>
              <tr>
                <th>Field name</th>
                <th>Type</th>
                <th title="Correlation parameter">Correlation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody class="event-table-body">
            </tbody>
          </table>
        </div>

        <div class="event-actions">
          <button type="button" id="add-attribute" class="btn-primary">+ Add attribute</button>
        </div>
      </div>
    `;

    this.bindElements();
    this.bindEvents();
  }

  private bindElements() {
    this.keyInput = this.container.querySelector('#event-key')!;
    this.nameInput = this.container.querySelector('#event-name')!;
    this.tableBody = this.container.querySelector('.event-table-body')!;
    this.addButton = this.container.querySelector('#add-attribute')!;
  }

  private bindEvents() {
    // Header input - key input triggers name generation and change tracking
    this.keyInput.addEventListener('input', () => this.onKeyChange());

    // Buttons
    this.addButton.addEventListener('click', () => this.addField());

    // Table delegation
    this.tableBody.addEventListener('click', this.handleTableClick.bind(this));
    this.tableBody.addEventListener('change', this.handleTableChange.bind(this));
    this.tableBody.addEventListener('dragstart', this.handleDragStart.bind(this));
    this.tableBody.addEventListener('dragover', this.handleDragOver.bind(this));
    this.tableBody.addEventListener('drop', this.handleDrop.bind(this));
  }

  private onKeyChange() {
    // Generate name from key
    this.generateNameFromKey();
    // Update tab title immediately
    this.updateTabTitle();
    // Trigger change detection
    this.validateAndNotifyChange();
  }

  private generateNameFromKey() {
    const key = this.keyInput.value.trim();
    // Simply copy key to name
    this.nameInput.value = key;
  }

  private updateTabTitle() {
    const key = this.keyInput.value.trim();
    const name = this.nameInput.value.trim();
    const title = name || key || 'Event';

    // Update the tab title via global function if available
    const updateStateTitle = (window as any).updateStateTitle;
    if (updateStateTitle) {
      // Find current state - we need to get this from the tab manager
      const getActiveState = (window as any).getActiveState;
      if (getActiveState) {
        const state = getActiveState();
        if (state && state.kind === 'event') {
          updateStateTitle(state, title);
        }
      }
    }
  }

  private addField() {
    const field: InternalField = {
      id: `field_${this.nextFieldId++}`,
      name: '',
      type: 'string',
      isCorrelation: false,
      ui: {}
    };

    this.fields.push(field);
    this.renderTable();
    this.validateAndNotifyChange();

    // Focus on the new field's name input
    setTimeout(() => {
      const nameInput = this.container.querySelector(`[data-field-id="${field.id}"] input[name="name"]`) as HTMLInputElement;
      nameInput?.focus();
    }, 0);
  }

  private removeField(fieldId: string) {
    const index = this.fields.findIndex(f => f.id === fieldId);
    if (index >= 0) {
      this.fields.splice(index, 1);
      this.renderTable();
      this.validateAndNotifyChange();
    }
  }

  private moveField(fieldId: string, direction: 'up' | 'down') {
    const index = this.fields.findIndex(f => f.id === fieldId);
    if (index < 0) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.fields.length) return;

    [this.fields[index], this.fields[newIndex]] = [this.fields[newIndex], this.fields[index]];
    this.renderTable();
    this.validateAndNotifyChange();
  }

  private renderTable() {
    this.tableBody.innerHTML = '';

    this.fields.forEach((field, index) => {
      const row = document.createElement('tr');
      row.setAttribute('data-field-id', field.id);
      row.setAttribute('draggable', 'true');
      row.className = 'field-row';

      const hasError = this.getFieldErrors(field, index).length > 0;
      if (hasError) {
        row.classList.add('error');
      }

      row.innerHTML = `
        <td>
          <input type="text" name="name" value="${this.escapeHtml(field.name)}"
                 placeholder="fieldName" ${this.readOnly ? 'readonly' : ''}
                 class="${hasError ? 'error' : ''}" />
        </td>
        <td>
          <select name="type" ${this.readOnly ? 'disabled' : ''}>
            <option value="string" ${field.type === 'string' ? 'selected' : ''}>string</option>
            <option value="integer" ${field.type === 'integer' ? 'selected' : ''}>integer</option>
            <option value="double" ${field.type === 'double' ? 'selected' : ''}>double</option>
            <option value="boolean" ${field.type === 'boolean' ? 'selected' : ''}>boolean</option>
            <option value="json" ${field.type === 'json' ? 'selected' : ''}>json</option>
          </select>
        </td>
        <td>
          <input type="checkbox" name="correlation" ${field.isCorrelation ? 'checked' : ''}
                 ${this.readOnly ? 'disabled' : ''} />
        </td>
        <td class="actions">
          <button type="button" class="btn-icon" title="Nach oben" data-action="move-up" ${this.readOnly ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn-icon" title="Nach unten" data-action="move-down" ${this.readOnly ? 'disabled' : ''}>↓</button>
          <button type="button" class="btn-icon btn-danger" title="Löschen" data-action="delete" ${this.readOnly ? 'disabled' : ''}>🗑</button>
          <span class="drag-handle" title="Ziehen zum Sortieren">⋮⋮</span>
        </td>
      `;

      this.tableBody.appendChild(row);
    });
  }

  private handleTableClick(e: Event) {
    const target = e.target as HTMLElement;
    const row = target.closest('.field-row') as HTMLTableRowElement;
    if (!row) return;

    const fieldId = row.getAttribute('data-field-id');
    if (!fieldId) return;

    const action = target.getAttribute('data-action');
    if (!action) return;

    e.preventDefault();

    switch (action) {
      case 'delete':
        this.removeField(fieldId);
        break;
      case 'move-up':
        this.moveField(fieldId, 'up');
        break;
      case 'move-down':
        this.moveField(fieldId, 'down');
        break;
    }
  }

  private handleTableChange(e: Event) {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    const row = target.closest('.field-row') as HTMLTableRowElement;
    if (!row) return;

    const fieldId = row.getAttribute('data-field-id');
    const field = this.fields.find(f => f.id === fieldId);
    if (!field) return;

    const name = target.getAttribute('name');

    switch (name) {
      case 'name':
        field.name = (target as HTMLInputElement).value.trim();
        break;
      case 'type':
        field.type = (target as HTMLSelectElement).value as FieldType;
        break;
      case 'correlation':
        field.isCorrelation = (target as HTMLInputElement).checked;
        break;
    }

    this.validateAndNotifyChange();
  }

  private handleDragStart(e: DragEvent) {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('field-row')) return;

    const fieldId = target.getAttribute('data-field-id');
    if (fieldId && e.dataTransfer) {
      e.dataTransfer.setData('text/plain', fieldId);
    }
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();

    const draggedFieldId = e.dataTransfer?.getData('text/plain');
    if (!draggedFieldId) return;

    const target = (e.target as HTMLElement).closest('.field-row') as HTMLTableRowElement;
    if (!target) return;

    const targetFieldId = target.getAttribute('data-field-id');
    if (!targetFieldId || draggedFieldId === targetFieldId) return;

    const draggedIndex = this.fields.findIndex(f => f.id === draggedFieldId);
    const targetIndex = this.fields.findIndex(f => f.id === targetFieldId);

    if (draggedIndex < 0 || targetIndex < 0) return;

    // Move dragged field to target position
    const [draggedField] = this.fields.splice(draggedIndex, 1);
    this.fields.splice(targetIndex, 0, draggedField);

    this.renderTable();
    this.validateAndNotifyChange();
  }


  private getFieldErrors(field: InternalField, index: number): string[] {
    const errors: string[] = [];

    if (!field.name.trim()) {
      errors.push('Feldname darf nicht leer sein');
    }

    // Check for duplicates
    const duplicateIndex = this.fields.findIndex((f, i) =>
      i !== index && f.name.trim() === field.name.trim() && field.name.trim()
    );
    if (duplicateIndex >= 0) {
      errors.push('Feldname bereits vorhanden');
    }

    return errors;
  }

  private isModelValid(): boolean {
    const key = this.keyInput.value.trim();

    if (!key) return false;

    return this.fields.every((field, index) =>
      this.getFieldErrors(field, index).length === 0
    );
  }

  private validateAndNotifyChange() {
    // Update visual validation state
    this.renderTable();

    // Check dirty state
    const wasDirty = this.isDirty;
    this.isDirty = this.hasChanges();

    if (wasDirty !== this.isDirty && this.options.onDirtyChange) {
      this.options.onDirtyChange(this.isDirty);
    }

    if (this.options.onChange) {
      this.options.onChange(this.getModel());
    }
  }

  private hasChanges(): boolean {
    if (!this.originalModel) return true;

    const current = this.getModel();
    return JSON.stringify(this.originalModel) !== JSON.stringify(current);
  }


  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateBaseline() {
    // Set current model as the baseline for change detection
    this.originalModel = JSON.parse(JSON.stringify(this.getModel()));
    this.isDirty = false;
    if (this.options.onDirtyChange) {
      this.options.onDirtyChange(false);
    }
  }

  // Public API
  getModel(): EventModel {
    const correlationParameters = this.fields
      .filter(f => f.isCorrelation && f.name.trim())
      .map(f => ({ name: f.name.trim(), type: f.type }));

    const payload = this.fields
      .filter(f => !f.isCorrelation && f.name.trim())
      .map(f => ({ name: f.name.trim(), type: f.type }));

    return {
      key: this.keyInput.value.trim() || 'event',
      name: this.nameInput.value.trim() || this.keyInput.value.trim() || 'Event',
      correlationParameters,
      payload
    };
  }

  setModel(model: EventModel) {
    this.originalModel = JSON.parse(JSON.stringify(model)); // Deep copy

    // Set key as primary input
    this.keyInput.value = model.key || '';
    // Generate name from key initially, then use provided name if different
    this.generateNameFromKey();
    if (model.name && model.name !== this.nameInput.value) {
      this.nameInput.value = model.name;
    }

    this.fields = [];
    this.nextFieldId = 1;

    // Add correlation parameters
    model.correlationParameters?.forEach(param => {
      this.fields.push({
        id: `field_${this.nextFieldId++}`,
        name: param.name,
        type: param.type,
        isCorrelation: true,
        ui: {}
      });
    });

    // Add payload parameters
    model.payload?.forEach(param => {
      this.fields.push({
        id: `field_${this.nextFieldId++}`,
        name: param.name,
        type: param.type,
        isCorrelation: false,
        ui: {}
      });
    });

    this.renderTable();

    // Reset baseline to current state after rendering
    this.originalModel = JSON.parse(JSON.stringify(this.getModel()));
    this.isDirty = false;

    // Notify without triggering change detection
    if (this.options.onDirtyChange) {
      this.options.onDirtyChange(false);
    }
  }

  setReadOnly(readOnly: boolean) {
    this.readOnly = readOnly;

    this.keyInput.readOnly = readOnly;
    // Name field is always readonly as it's auto-generated
    this.nameInput.readOnly = true;
    this.addButton.disabled = readOnly;

    this.renderTable();
  }

  dispose() {
    // Clean up any resources
    this.container.innerHTML = '';
  }
}

export function createEventEditor(
  container: HTMLElement,
  options: EventEditorOptions = {}
): EventEditor {
  return new EventEditorImpl(container, options);
}