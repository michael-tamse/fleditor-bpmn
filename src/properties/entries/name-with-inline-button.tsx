import { h } from '@bpmn-io/properties-panel/preact';
import { useService } from 'bpmn-js-properties-panel';
import { useMemo } from '@bpmn-io/properties-panel/preact/hooks';

import type { BPMNElement } from '../types';

import '../styles/properties-panel-ext.css';

interface NameWithInlineButtonProps {
  element: BPMNElement;
}

function sanitizeToId(name: string): string {
  if (!name || typeof name !== 'string') return '';

  return name
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, index) => {
      if (!word) return '';
      if (index === 0) {
        return word.charAt(0).toLowerCase() + word.slice(1);
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

function generateUniqueId(baseId: string, elementRegistry: any): string {
  if (!baseId) return '';

  if (!elementRegistry.get(baseId)) {
    return baseId;
  }

  let counter = 1;
  let candidateId = `${baseId}${counter}`;

  while (elementRegistry.get(candidateId)) {
    counter++;
    candidateId = `${baseId}${counter}`;
  }

  return candidateId;
}

export function NameWithInlineButton(props: NameWithInlineButtonProps) {
  const { element } = props;
  const modeling = useService('modeling');
  const elementRegistry = useService('elementRegistry');
  const translate = useService('translate');
  const debounce = useService('debounceInput');
  const bo = element.businessObject;

  const labelId = useMemo(() => `bio-properties-panel-name-${element.id}`, [element.id]);
  const nameLabel = translate ? translate('Name') : 'Name';
  const buttonLabel = translate ? translate('Create ID') : 'Create ID';

  const getValue = () => {
    return bo.get ? bo.get('name') || '' : bo.name || '';
  };

  const setValue = (value: string) => {
    const cleanValue = value || '';
    modeling.updateProperties(element, { name: cleanValue || undefined });
  };

  const onInput = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target) return;
    setValue(target.value);
  };

  const onCreateId = (event?: Event) => {
    try {
      event?.preventDefault();
    } catch {}

    const name = getValue();
    if (!name || typeof name !== 'string' || !name.trim()) {
      return;
    }

    const sanitizedId = sanitizeToId(name);
    if (!sanitizedId) {
      return;
    }

    const uniqueId = generateUniqueId(sanitizedId, elementRegistry);
    if (!uniqueId) {
      return;
    }

    modeling.updateProperties(element, { id: uniqueId });
  };

  const inputValue = getValue();

  return (
    <div className="bio-properties-panel-entry name-with-inline-button-entry">
      <label className="bio-properties-panel-label" htmlFor={labelId}>
        {nameLabel}
      </label>
      <div className="bio-properties-panel-textfield name-with-button-textfield">
        <input
          id={labelId}
          name="name"
          type="text"
          spellCheck="false"
          autoComplete="off"
          className="bio-properties-panel-input name-input-with-button"
          value={inputValue}
          onInput={debounce(onInput)}
        />
        <button
          type="button"
          className="bio-properties-panel-button inline-create-id-button"
          onClick={onCreateId}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default NameWithInlineButton;