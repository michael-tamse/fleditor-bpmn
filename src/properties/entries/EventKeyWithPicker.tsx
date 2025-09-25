import { h } from '@bpmn-io/properties-panel/preact';
import { useService } from 'bpmn-js-properties-panel';
import { useRef } from '@bpmn-io/properties-panel/preact/hooks';

import type { BPMNElement } from '../types';
import {
  buildMergeCommands,
  type CorrelationItem,
  type ModdleElementLike,
  type PayloadItem
} from '../merge';
import { executeMulti } from '../multiCommand';
import { EventTypeEntry } from './event-registry';

import '../styles/properties-panel-ext.css';

type SidecarPayload = {
  key: string;
  payload?: PayloadItem[] | null;
  correlationParameters?: CorrelationItem[] | null;
};

type NormalizedEventData = {
  key: string;
  payload: PayloadItem[];
  correlations: CorrelationItem[];
};

declare global {
  interface Window {
    sidecar?: {
      pickEvent?: () => Promise<SidecarPayload | null | undefined>;
    };
  }
}

interface EventKeyWithPickerProps {
  element: BPMNElement;
}

export function EventKeyWithPicker(props: EventKeyWithPickerProps) {
  const { element } = props;
  const commandStack = useService('commandStack');
  const bpmnFactory = useService('bpmnFactory');
  const translate = useService('translate');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const bo = element.businessObject as ModdleElementLike;

  const label = translate ? translate('Event key (type)') : 'Event key (type)';
  const buttonLabel = translate ? translate('Load…') : 'Laden…';

  const triggerLocalPicker = () => {
    const input = fileInputRef.current;
    if (input) {
      input.click();
    }
  };

  const onLocalFile = async (event: Event) => {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files && input.files[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = normalizeEventFile(parsed);
      if (!normalized) {
        console.debug?.('[FlowableEvent] parsed file did not contain a usable event payload');
        return;
      }
      applyNormalized(normalized);
    } catch (err) {
      console.debug?.('[FlowableEvent] local event load failed', err);
    } finally {
      try {
        if (input) {
          input.value = '';
        }
      } catch {}
    }
  };

  const onPick = async (event?: Event) => {
    try { event?.preventDefault(); } catch {}
    const picker = window?.sidecar?.pickEvent;

    if (typeof picker === 'function') {
      try {
        const picked = await picker();
        const normalized = normalizeSidecarPayload(picked);
        if (normalized) {
          applyNormalized(normalized);
          return;
        }
      } catch (err) {
        console.debug?.('[FlowableEvent] pickEvent failed', err);
      }
    }

    triggerLocalPicker();
  };

  function applyNormalized(normalized: NormalizedEventData): boolean {
    const { key, payload, correlations } = normalized;
    const commands = buildMergeCommands({
      element: element as unknown as ModdleElementLike,
      bo: bo as ModdleElementLike,
      eventKey: key,
      payload,
      correlations,
      bpmnFactory,
      options: {
        pruneStale: false,
        updateTypeIfDifferent: true,
        setSourceIfEmpty: true
      }
    });

    if (!commands.length) {
      return false;
    }

    executeMulti(commandStack, commands);
    return true;
  }

  return (
    <div className="flowable-event-key-entry">
      {EventTypeEntry({ element, label })}
      <button type="button" className="bio-pp-btn" onClick={onPick}>
        {buttonLabel}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".event,.json,application/json"
        onChange={onLocalFile}
      />
    </div>
  );
}

export default EventKeyWithPicker;

function normalizePayloadItem(item: any): PayloadItem | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const name = typeof item.name === 'string' && item.name.trim()
    ? item.name.trim()
    : typeof item.fieldName === 'string' && item.fieldName.trim()
      ? item.fieldName.trim()
      : typeof item.attribute === 'string' && item.attribute.trim()
        ? item.attribute.trim()
        : '';

  if (!name) {
    return null;
  }

  const type = typeof item.type === 'string' && item.type.trim()
    ? item.type.trim()
    : typeof item.fieldType === 'string' && item.fieldType.trim()
      ? item.fieldType.trim()
      : typeof item.valueType === 'string' && item.valueType.trim()
        ? item.valueType.trim()
        : undefined;

  return { name, type };
}

function normalizeSidecarPayload(raw: SidecarPayload | null | undefined): NormalizedEventData | null {
  if (!raw || typeof raw.key !== 'string') {
    return null;
  }

  const key = raw.key.trim();
  if (!key) {
    return null;
  }

  const payload = Array.isArray(raw.payload)
    ? raw.payload.map(normalizePayloadItem).filter((item): item is PayloadItem => !!item)
    : [];

  const correlations = Array.isArray(raw.correlationParameters)
    ? raw.correlationParameters.map(normalizePayloadItem).filter((item): item is CorrelationItem => !!item)
    : [];

  return { key, payload, correlations };
}

function normalizeEventFile(data: unknown): NormalizedEventData | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const candidates: any[] = [];
  const queue: any[] = [ data ];

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') {
      continue;
    }
    if (!candidates.includes(current)) {
      candidates.push(current);
    }

    Object.values(current).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach((item) => queue.push(item));
      } else if (value && typeof value === 'object') {
        queue.push(value);
      }
    });
  }

  let keyCandidate = '';

  for (const candidate of candidates) {
    if (typeof candidate?.key === 'string' && candidate.key.trim()) {
      keyCandidate = candidate.key.trim();
      break;
    }
    if (typeof candidate?.eventKey === 'string' && candidate.eventKey.trim()) {
      keyCandidate = candidate.eventKey.trim();
      break;
    }
  }

  if (!keyCandidate) {
    return null;
  }

  const payloadSource = findFirstArray(candidates, [
    'payload',
    'fields',
    'attributes',
    'entries'
  ]);

  const payload: PayloadItem[] = payloadSource
    ? payloadSource.map(normalizePayloadItem).filter((item): item is PayloadItem => !!item)
    : [];

  const correlationSource = findFirstArray(candidates, [
    'correlationParameters',
    'correlations',
    'correlation',
    'parameters'
  ]);

  const correlations: CorrelationItem[] = correlationSource
    ? correlationSource.map(normalizePayloadItem).filter((item): item is CorrelationItem => !!item)
    : [];

  return { key: keyCandidate, payload, correlations };
}

function findFirstArray(candidates: any[], keys: string[]): any[] | null {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate?.[key];
      if (Array.isArray(value)) {
        return value;
      }
      if (value && typeof value === 'object') {
        const nested = Array.isArray(value?.items) ? value.items : Array.isArray(value?.definitions) ? value.definitions : null;
        if (Array.isArray(nested)) {
          return nested;
        }
      }
    }
  }
  return null;
}
