import type BpmnFactory from 'bpmn-js/lib/features/modeling/BpmnFactory';

import {
  FLOWABLE,
  type CommandDescriptor,
  type CorrelationItem,
  type MergeOptions,
  type ModdleElementLike,
  type PayloadItem
} from './merge';

interface MergeBuildOptions {
  element: ModdleElementLike;
  bo: ModdleElementLike;
  eventKey: string;
  payload: PayloadItem[];
  correlations?: CorrelationItem[];
  bpmnFactory: BpmnFactory;
  options?: MergeOptions;
}

const DEFAULTS: Required<Omit<MergeOptions, 'pruneStale'>> & { pruneStale: boolean } = {
  pruneStale: false,
  defaultSourceExpr: (name: string) => name,
  updateTypeIfDifferent: true,
  setSourceIfEmpty: true
};

const CORRELATION_DEFAULT_VALUE = '${execution.getProcessInstanceBusinessKey()}';

export function buildInboundMergeCommands(opts: MergeBuildOptions): CommandDescriptor[] {
  const { element, bo, payload, eventKey } = opts;

  const commands: CommandDescriptor[] = [];
  const options = {
    pruneStale: opts.options?.pruneStale ?? DEFAULTS.pruneStale,
    defaultSourceExpr: opts.options?.defaultSourceExpr || DEFAULTS.defaultSourceExpr,
    updateTypeIfDifferent: opts.options?.updateTypeIfDifferent ?? DEFAULTS.updateTypeIfDifferent,
    setSourceIfEmpty: opts.options?.setSourceIfEmpty ?? DEFAULTS.setSourceIfEmpty
  } as Required<MergeOptions>;

  const trimmedKey = (eventKey || '').trim();
  if (!trimmedKey) {
    return [];
  }

  const extensionElements = ensureExtensionElements(commands, opts);
  let values = readValues(extensionElements);

  const eventTypeElement = findByType(values, FLOWABLE.EVENT_TYPE_ELEMENT);
  if (!eventTypeElement) {
    const created = opts.bpmnFactory.create(FLOWABLE.EVENT_TYPE_ELEMENT, {
      [FLOWABLE.EVENT_TYPE_VALUE_PROP]: trimmedKey
    });
    values = values.concat([ created ]);
    pushExtensionUpdate(commands, element, extensionElements, values);
  } else {
    const current = (readAttr(eventTypeElement, FLOWABLE.EVENT_TYPE_VALUE_PROP) || '').trim();
    if (current !== trimmedKey) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: eventTypeElement,
          properties: { [FLOWABLE.EVENT_TYPE_VALUE_PROP]: trimmedKey }
        }
      });
    }
  }

  const dedupedPayload = dedupeList(payload);
  const dedupedCorrelations = dedupeList(opts.correlations || []);

  const mappings = values.filter((value) => value && value.$type === FLOWABLE.EVENT_OUT_PARAMETER) as ModdleElementLike[];
  const byTarget = new Map<string, ModdleElementLike>();
  mappings.forEach((mapping) => {
    const target = (readAttr(mapping, FLOWABLE.MAPPING_PROPS.target) || '').trim();
    if (target && !byTarget.has(target)) {
      byTarget.set(target, mapping);
    }
  });

  let valuesChanged = false;
  let nextValues = values.slice();

  dedupedPayload.forEach((item) => {
    const target = item.name;
    const existing = byTarget.get(target);
    const defaultSource = options.defaultSourceExpr(target);

    if (existing) {
      const updates: Record<string, unknown> = {};
      const currentSource = readAttr(existing, FLOWABLE.MAPPING_PROPS.source);
      const currentType = readAttr(existing, FLOWABLE.MAPPING_PROPS.type);

      if (options.setSourceIfEmpty && !(currentSource || '').trim() && defaultSource) {
        updates[FLOWABLE.MAPPING_PROPS.source] = defaultSource;
      }

      if (options.updateTypeIfDifferent) {
        const trimmedType = (currentType || '').trim();
        const nextType = (item.type || '').trim();
        if (nextType && trimmedType !== nextType) {
          updates[FLOWABLE.MAPPING_PROPS.type] = nextType;
        }
      }

      if (Object.keys(updates).length) {
        commands.push({
          cmd: 'element.updateModdleProperties',
          context: {
            element,
            moddleElement: existing,
            properties: updates
          }
        });
      }

      return;
    }

    const mapping = opts.bpmnFactory.create(FLOWABLE.EVENT_OUT_PARAMETER, {
      [FLOWABLE.MAPPING_PROPS.target]: target,
      [FLOWABLE.MAPPING_PROPS.source]: defaultSource,
      [FLOWABLE.MAPPING_PROPS.type]: item.type
    });
    nextValues = nextValues.concat([ mapping ]);
    valuesChanged = true;
    mappings.push(mapping);
    byTarget.set(target, mapping);
  });

  if (options.pruneStale) {
    const allowedTargets = new Set(dedupedPayload.map((item) => item.name));
    const filtered = nextValues.filter((value) => {
      if (!value || value.$type !== FLOWABLE.EVENT_OUT_PARAMETER) return true;
      const target = (readAttr(value, FLOWABLE.MAPPING_PROPS.target) || '').trim();
      return !target || allowedTargets.has(target);
    });
    if (filtered.length !== nextValues.length) {
      nextValues = filtered;
      valuesChanged = true;
    }
  }

  if (valuesChanged) {
    pushExtensionUpdate(commands, element, extensionElements, nextValues);
    values = nextValues;
  }

  if (dedupedCorrelations.length) {
    const first = dedupedCorrelations[0];
    let correlation = findByType(values, FLOWABLE.EVENT_CORRELATION) as ModdleElementLike | null;

    if (!correlation) {
      correlation = opts.bpmnFactory.create(FLOWABLE.EVENT_CORRELATION, {
        name: first.name,
        value: CORRELATION_DEFAULT_VALUE
      });
      values = values.concat([ correlation ]);
      pushExtensionUpdate(commands, element, extensionElements, values);
    }

    if (!correlation) {
      return commands;
    }

    const currentName = (readAttr(correlation, 'name') || '').trim();
    if (currentName !== first.name) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: correlation,
          properties: { name: first.name }
        }
      });
    }

    const currentValue = readAttr(correlation, 'value');
    if (!(currentValue || '').trim()) {
      commands.push({
        cmd: 'element.updateModdleProperties',
        context: {
          element,
          moddleElement: correlation,
          properties: { value: CORRELATION_DEFAULT_VALUE }
        }
      });
    }
  }

  return commands;
}

function ensureExtensionElements(commands: CommandDescriptor[], opts: MergeBuildOptions): ModdleElementLike {
  const { element, bo, bpmnFactory } = opts;
  let extensionElements = readAttr(bo, 'extensionElements') as ModdleElementLike | null;

  if (!extensionElements) {
    extensionElements = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
    commands.push({
      cmd: 'element.updateModdleProperties',
      context: {
        element,
        moddleElement: bo,
        properties: { extensionElements }
      }
    });
  }

  return extensionElements;
}

function dedupeList<T extends { name: string; type?: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  items.forEach((item) => {
    const name = (item?.name || '').trim();
    if (!name) return;
    map.set(name, { name, type: item?.type ? item.type : undefined } as T);
  });
  return Array.from(map.values());
}

function pushExtensionUpdate(
  commands: CommandDescriptor[],
  element: ModdleElementLike,
  extensionElements: ModdleElementLike,
  values: any[]
) {
  commands.push({
    cmd: 'element.updateModdleProperties',
    context: {
      element,
      moddleElement: extensionElements,
      properties: { values }
    }
  });
}

function readAttr(element: ModdleElementLike | null | undefined, prop: string): any {
  if (!element) return undefined;
  if (typeof element.get === 'function') {
    return element.get(prop);
  }
  return (element as any)[prop];
}

function readValues(container: ModdleElementLike | null | undefined): any[] {
  if (!container) return [];
  const values = typeof container.get === 'function' ? container.get('values') : (container as any).values;
  return Array.isArray(values) ? values.slice() : [];
}

function findByType(list: any[], type: string): any | null {
  return list.find((item) => item && item.$type === type) || null;
}
