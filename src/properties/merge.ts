/**
 * Flowable outbound event merge helpers.
 *
 * Adjust the constants below when Flowable moddle names change.
 */
import type BpmnFactory from 'bpmn-js/lib/features/modeling/BpmnFactory';

export const FLOWABLE = {
  EVENT_TYPE_ELEMENT: 'flowable:EventType',
  EVENT_TYPE_VALUE_PROP: 'value',
  EVENT_IN_PARAMETER: 'flowable:EventInParameter',
  MAPPING_PROPS: {
    target: 'target',
    source: 'source',
    type: 'type'
  }
} as const;

export interface PayloadItem {
  name: string;
  type?: string;
}

export interface MergeOptions {
  pruneStale?: boolean;
  defaultSourceExpr?: (name: string) => string;
  updateTypeIfDifferent?: boolean;
  setSourceIfEmpty?: boolean;
}

export interface CommandDescriptor {
  cmd: string;
  context: Record<string, unknown>;
}

export interface ModdleElementLike {
  $type: string;
  get?<T = unknown>(prop: string): T;
  set?<T = unknown>(prop: string, value: T): void;
  [key: string]: unknown;
}

export interface CorrelationItem {
  name: string;
  type?: string;
}

interface MergeBuildOptions {
  element: ModdleElementLike;
  bo: ModdleElementLike;
  eventKey: string;
  payload: PayloadItem[];
  bpmnFactory: BpmnFactory;
  correlations?: CorrelationItem[];
  options?: MergeOptions;
}

const DEFAULTS: Required<Omit<MergeOptions, 'pruneStale'>> & { pruneStale: boolean } = {
  pruneStale: false,
  defaultSourceExpr: (name: string) => '${' + name + '}',
  updateTypeIfDifferent: true,
  setSourceIfEmpty: true
};

const CORRELATION_SOURCE_DEFAULT = '${execution.getProcessInstanceBusinessKey()}';

export function buildMergeCommands(opts: MergeBuildOptions): CommandDescriptor[] {
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

  const dedupedPayload = dedupePayload(payload);
  const dedupedCorrelations = dedupeCorrelations(opts.correlations || []);

  if (!dedupedPayload.length && !dedupedCorrelations.length) {
    return commands;
  }

  const mappings = values.filter((value) => value && value.$type === FLOWABLE.EVENT_IN_PARAMETER) as ModdleElementLike[];
  const byTarget = new Map<string, ModdleElementLike>();

  mappings.forEach((mapping) => {
    const target = (readAttr(mapping, FLOWABLE.MAPPING_PROPS.target) || '').trim();
    if (target && !byTarget.has(target)) {
      byTarget.set(target, mapping);
    }
  });

  let valuesChanged = false;
  let nextValues = values.slice();

  dedupedCorrelations.forEach((item) => {
    const target = item.name;
    const existing = byTarget.get(target);

    if (existing) {
      const updates: Record<string, unknown> = {};
      const currentSource = readAttr(existing, FLOWABLE.MAPPING_PROPS.source);
      const currentType = readAttr(existing, FLOWABLE.MAPPING_PROPS.type);

      if ((currentSource || '').trim() !== CORRELATION_SOURCE_DEFAULT) {
        updates[FLOWABLE.MAPPING_PROPS.source] = CORRELATION_SOURCE_DEFAULT;
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

    const mapping = opts.bpmnFactory.create(FLOWABLE.EVENT_IN_PARAMETER, {
      [FLOWABLE.MAPPING_PROPS.target]: target,
      [FLOWABLE.MAPPING_PROPS.source]: CORRELATION_SOURCE_DEFAULT,
      [FLOWABLE.MAPPING_PROPS.type]: item.type
    });

    nextValues = nextValues.concat([ mapping ]);
    valuesChanged = true;
    mappings.push(mapping);
    byTarget.set(target, mapping);
  });

  dedupedPayload.forEach((item) => {
    const target = item.name;
    const existing = byTarget.get(target);

    if (existing) {
      const updates: Record<string, unknown> = {};
      const currentSource = readAttr(existing, FLOWABLE.MAPPING_PROPS.source);
      const currentType = readAttr(existing, FLOWABLE.MAPPING_PROPS.type);
      const defaultSource = options.defaultSourceExpr(target);

      if (options.setSourceIfEmpty) {
        const trimmedSource = (currentSource || '').trim();
        if (!trimmedSource) {
          updates[FLOWABLE.MAPPING_PROPS.source] = defaultSource;
        }
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

    const mapping = opts.bpmnFactory.create(FLOWABLE.EVENT_IN_PARAMETER, {
      [FLOWABLE.MAPPING_PROPS.target]: target,
      [FLOWABLE.MAPPING_PROPS.source]: options.defaultSourceExpr(target),
      [FLOWABLE.MAPPING_PROPS.type]: item.type
    });
    nextValues = nextValues.concat([ mapping ]);
    valuesChanged = true;
    mappings.push(mapping);
    byTarget.set(target, mapping);
  });

  if (options.pruneStale) {
    const allowed = new Set(dedupedPayload.map((item) => item.name));
    const filtered = nextValues.filter((value) => {
      if (!value || value.$type !== FLOWABLE.EVENT_IN_PARAMETER) return true;
      const target = (readAttr(value, FLOWABLE.MAPPING_PROPS.target) || '').trim();
      return !target || allowed.has(target);
    });
    if (filtered.length !== nextValues.length) {
      nextValues = filtered;
      valuesChanged = true;
    }
  }

  if (valuesChanged) {
    pushExtensionUpdate(commands, element, extensionElements, nextValues);
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

function dedupePayload(payload: PayloadItem[]): PayloadItem[] {
  const map = new Map<string, PayloadItem>();
  payload.forEach((item) => {
    const name = (item?.name || '').trim();
    if (!name) return;
    map.set(name, { name, type: item?.type ? item.type : undefined });
  });
  return Array.from(map.values());
}

function dedupeCorrelations(correlations: CorrelationItem[]): CorrelationItem[] {
  const map = new Map<string, CorrelationItem>();
  correlations.forEach((item) => {
    const name = (item?.name || '').trim();
    if (!name) return;
    map.set(name, { name, type: item?.type ? item.type : undefined });
  });
  return Array.from(map.values());
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
