import { h } from '@bpmn-io/properties-panel/preact';
import { useService } from 'bpmn-js-properties-panel';
import { useMemo } from '@bpmn-io/properties-panel/preact/hooks';

import type { BPMNElement } from '../types';

import '../styles/properties-panel-ext.css';

interface CreateIdButtonProps {
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

export function CreateIdButton(props: CreateIdButtonProps) {
  const { element } = props;
  const modeling = useService('modeling');
  const elementRegistry = useService('elementRegistry');
  const translate = useService('translate');
  const bo = element.businessObject;

  const buttonLabel = translate ? translate('Create ID') : 'Create ID';

  const onGenerateId = (event?: Event) => {
    try {
      event?.preventDefault();
    } catch {}

    const name = bo.get ? bo.get('name') : bo.name;
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

  return (
    <div className="bio-properties-panel-entry create-id-entry">
      <div className="flowable-event-key-actions">
        <button
          type="button"
          className="bio-properties-panel-button flowable-event-key-button"
          onClick={onGenerateId}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default CreateIdButton;