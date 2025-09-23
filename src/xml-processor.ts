export function ensureExternalWorkerStencilsOnExport(xml: string): string {
  try {
    let out = xml;
    const OPEN_INDENT = '      ';
    const INNER_INDENT = '        ';
    const buildStencilBlock = (extPrefix: string) => (
      `<${extPrefix}extensionElements>\n` +
      `${INNER_INDENT}<design:stencilid><![CDATA[ExternalWorkerTask]]></design:stencilid>\n` +
      `${INNER_INDENT}<design:stencilsuperid><![CDATA[Task]]></design:stencilsuperid>\n` +
      `${OPEN_INDENT}</${extPrefix}extensionElements>`
    );

    const pairRe = /<(([\w-]+:)?serviceTask)\b([^>]*\bflowable:type\s*=\s*"external-worker"[^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?serviceTask>/gi;
    out = out.replace(pairRe, (_m, qname, pfxMaybe, attrs, inner) => {
      const pfx = (pfxMaybe || '');
      const extRe = /<([\w-]+:)?extensionElements\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?extensionElements>/i;
      let newInner: string;
      const extMatch = inner.match(extRe);
      if (extMatch) {
        const extPrefix = extMatch[1] || pfx;
        const extContent = extMatch[2] || '';
        const cleaned = extContent
          .replace(/<design:(stencilid|stencilsuperid)\b[\s\S]*?<\/design:\1>\s*/gi, '')
          .trim();
        const base = buildStencilBlock(extPrefix);
        const extBlock = cleaned ? `${base}\n${cleaned}` : base;
        newInner = inner.replace(extRe, extBlock);
      } else {
        const extPrefix = pfx;
        const extBlock = buildStencilBlock(extPrefix);
        newInner = `\n${OPEN_INDENT}${extBlock}${inner ? `\n${inner.trimStart()}` : ''}`;
      }
      return `<${pfx}serviceTask${attrs}>${newInner}</${pfx}serviceTask>`;
    });

    const selfRe = /<(([\w-]+:)?serviceTask)\b([^>]*\bflowable:type\s*=\s*"external-worker"[^>]*)\/>/gi;
    out = out.replace(selfRe, (_m, _qname, pfxMaybe, attrs) => {
      const pfx = (pfxMaybe || '');
      const extBlock = buildStencilBlock(pfx);
      return `<${pfx}serviceTask${attrs}>\n${OPEN_INDENT}${extBlock}\n    </${pfx}serviceTask>`;
    });

    return out;
  } catch {
    return xml;
  }
}

export function stripMessageEventDefinitionsInXML(xml: string): string {
  try {
    const stripFor = (input: string, tag: string) => {
      const re = new RegExp(`(<([\\\w-]+:)?${tag}\\b[^>]*>)([\\s\\S]*?)(<\\/([\\\w-]+:)?${tag}>)`, 'g');
      return input.replace(re, (_m, open, _ns, inner, close) => {
        const hasFlowable = /<flowable:(eventType|eventCorrelationParameter)\b/i.test(inner);
        const hasTimer = /<([\w-]+:)?timerEventDefinition\b/i.test(inner);
        if (!hasFlowable && !hasTimer) return _m;
        let stripped = inner
          .replace(/<([\w-]+:)?messageEventDefinition\b[^>]*\/>/gi, '')
          .replace(/<([\w-]+:)?messageEventDefinition\b[^>]*>[\s\S]*?<\/([\w-]+:)?messageEventDefinition>/gi, '');
        return `${open}${stripped}${close}`;
      });
    };
    let out = xml;
    out = stripFor(out, 'startEvent');
    out = stripFor(out, 'intermediateCatchEvent');
    out = stripFor(out, 'boundaryEvent');
    return out;
  } catch {
    return xml;
  }
}

export function expandSubProcessShapesInDI(xml: string): string {
  try {
    let out = xml;
    const ids = new Set<string>();
    const reSub = /<([\w-]+:)?subProcess\b[^>]*\bid="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = reSub.exec(out))) {
      ids.add(m[2]);
    }
    if (!ids.size) return out;
    ids.forEach((id) => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reShape = new RegExp(`(<([\\w-]+:)?BPMNShape\\b[^>]*\\bbpmnElement="${esc}"[^>]*)(/?>)`, 'g');
      out = out.replace(reShape, (full, open, _ns, end) => {
        if (/\bisExpanded\s*=\s*"true"/i.test(open)) return full;
        if (/\bisExpanded\s*=\s*"(?:true|false)"/i.test(open)) {
          open = open.replace(/\bisExpanded\s*=\s*"(?:true|false)"/i, 'isExpanded="true"');
          return open + end;
        }
        return `${open} isExpanded="true"${end}`;
      });
    });
    return out;
  } catch {
    return xml;
  }
}

export function mapSendTaskToServiceOnExport(xml: string): string {
  try {
    let out = xml;
    const ensureType = (attrs: string) => (/\bflowable:type\s*=/.test(attrs) ? attrs : `${attrs} flowable:type="send-event"`);
    const replaceTriplet = (prefix: string) => {
      const openSelf = new RegExp(`<${prefix}sendTask\\b([^>]*?)\\/>`, 'g');
      const open = new RegExp(`<${prefix}sendTask\\b([^>]*?)>`, 'g');
      const close = new RegExp(`</${prefix}sendTask>`, 'g');
      out = out.replace(openSelf, (_m, attrs) => `<${prefix}serviceTask${ensureType(attrs)} />`);
      out = out.replace(open, (_m, attrs) => `<${prefix}serviceTask${ensureType(attrs)}>`);
      out = out.replace(close, `</${prefix}serviceTask>`);
    };
    replaceTriplet('bpmn:');
    replaceTriplet('');
    return out;
  } catch {
    return xml;
  }
}

export function mapBusinessRuleToServiceDmnOnExport(xml: string): string {
  try {
    let out = xml;
    const ensureType = (attrs: string) => (/\bflowable:type\s*=/.test(attrs) ? attrs : `${attrs} flowable:type="dmn"`);
    const replaceTriplet = (prefix: string) => {
      const openSelf = new RegExp(`<${prefix}businessRuleTask\\b([^>]*?)\\/>`, 'g');
      const open = new RegExp(`<${prefix}businessRuleTask\\b([^>]*?)>`, 'g');
      const close = new RegExp(`</${prefix}businessRuleTask>`, 'g');
      out = out.replace(openSelf, (_m, attrs) => `<${prefix}serviceTask${ensureType(attrs)} />`);
      out = out.replace(open, (_m, attrs) => `<${prefix}serviceTask${ensureType(attrs)}>`);
      out = out.replace(close, `</${prefix}serviceTask>`);
    };
    replaceTriplet('bpmn:');
    replaceTriplet('');
    return out;
  } catch {
    return xml;
  }
}

export function toFlowableDefinitionHeader(xml: string): string {
  try {
    let out = xml;
    const idMatch = out.match(/<((?:[a-zA-Z_][\w-]*:)?)definitions\b[^>]*\bid="([^"]+)"/);
    const defId = idMatch ? idMatch[2] : 'Definitions_1';

    const openTag = [
      '<definitions',
      'xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"',
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      'xmlns:xsd="http://www.w3.org/2001/XMLSchema"',
      'xmlns:flowable="http://flowable.org/bpmn"',
      'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"',
      'xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC"',
      'xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI"',
      'xmlns:design="http://flowable.org/design"',
      'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
      'typeLanguage="http://www.w3.org/2001/XMLSchema"',
      'expressionLanguage="http://www.w3.org/1999/XPath"',
      'targetNamespace="http://flowable.org/test"',
      'exporter="Flowable Design"',
      'exporterVersion="2025.1.02"',
      'design:palette="flowable-work-process-palette"',
      `id="${defId}">`
    ].join(' ');

    out = out.replace(/<((?:[a-zA-Z_][\w-]*:)?)definitions\b[^>]*>/, openTag);
    out = out.replace(/<\/((?:[a-zA-Z_][\w-]*:)?)definitions>/, '</definitions>');

    out = out.replace(/<\/?dc:/g, (m) => m.replace('dc:', 'omgdc:'))
             .replace(/<\/?di:/g, (m) => m.replace('di:', 'omgdi:'));

    out = out.replace(/<\/?bpmn:([A-Za-z_][\w.-]*)/g, (m, name) => `${m.startsWith('</') ? '</' : '<'}${name}`);
    out = out.replace(/<\/?flowable:variable\b/g, (m) => m.replace('flowable:variable', 'variable'));

    return out;
  } catch {
    return xml;
  }
}