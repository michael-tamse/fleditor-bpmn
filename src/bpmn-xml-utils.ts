/**
 * BPMN XML manipulation utilities for reading and writing BPMN files
 * Extracted from main.ts to reduce file size and improve modularity
 */

// XML manipulation functions for import (reading)

export function deriveProcessId(xml: string): string | null {
  try {
    const m = /<([\w-]+:)?process\b[^>]*\bid\s*=\s*\"([^\"]+)\"/i.exec(xml);
    return m ? m[2] : null;
  } catch { return null; }
}

export function deriveDmnId(xml: string): string | null {
  try {
    if (!xml || typeof xml !== 'string') {
      console.log('[deriveDmnId] Invalid input:', typeof xml);
      return null;
    }

    console.log('[deriveDmnId] Analyzing XML (first 200 chars):', xml.substring(0, 200));

    // Try multiple patterns for decision ID
    const patterns = [
      // Standard DMN decision with id attribute (with optional namespace)
      /<([\w-]+:)?decision\b[^>]*\bid\s*=\s*\"([^\"]+)\"/i,
      /<([\w-]+:)?decision\b[^>]*\bid\s*=\s*'([^']+)'/i,
      // Decision without namespace prefix
      /<decision\b[^>]*\bid\s*=\s*\"([^\"]+)\"/i,
      // DMN namespace specific
      /<dmn:decision\b[^>]*\bid\s*=\s*\"([^\"]+)\"/i,
      // Try name attribute as fallback
      /<([\w-]+:)?decision\b[^>]*\bname\s*=\s*\"([^\"]+)\"/i,
      // Definitions fallback
      /<([\w-]+:)?definitions\b[^>]*\bid\s*=\s*\"([^\"]+)\"/i
    ];

    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = pattern.exec(xml);
      if (match) {
        const id = match[2] || match[1];
        console.log(`[deriveDmnId] Found ID via pattern ${i + 1}:`, id);
        return id;
      }
    }

    // If no decision found, try to extract any ID that looks like a decision
    const anyIdMatch = /\bid\s*=\s*\"([^\"]*[Dd]ecision[^\"]*)\"/i.exec(xml);
    if (anyIdMatch) {
      console.log('[deriveDmnId] Found decision-like ID:', anyIdMatch[1]);
      return anyIdMatch[1];
    }

    // Last resort: look for any element with "Decision" in the name or id
    const decisionElementMatch = /<[^>]*(?:name|id)\s*=\s*\"[^\"]*[Dd]ecision[^\"]*\"[^>]*>/i.exec(xml);
    if (decisionElementMatch) {
      const idMatch = /\bid\s*=\s*\"([^\"]+)\"/i.exec(decisionElementMatch[0]);
      if (idMatch) {
        console.log('[deriveDmnId] Found ID from decision element:', idMatch[1]);
        return idMatch[1];
      }
    }

    console.log('[deriveDmnId] No decision ID found in XML');
    return null;
  } catch (error) {
    console.error('[deriveDmnId] Error:', error);
    return null;
  }
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?\"<>|\n\r]+/g, '_');
}

export function syncDmnDecisionIdWithName(xml: string): string {
  try {
    if (!xml || typeof xml !== 'string') {
      return xml;
    }

    // Extract decision name and current ID
    const decisionMatch = /<([\w-]+:)?decision\b[^>]*>/i.exec(xml);
    if (!decisionMatch) {
      return xml;
    }

    const decisionTag = decisionMatch[0];
    const nameMatch = /\bname\s*=\s*\"([^\"]+)\"/i.exec(decisionTag);
    const idMatch = /\bid\s*=\s*\"([^\"]+)\"/i.exec(decisionTag);

    if (!nameMatch || !idMatch) {
      return xml;
    }

    const currentName = nameMatch[1];
    const currentId = idMatch[1];

    // Only sync if name is different from ID and name is not empty
    if (!currentName || currentName === currentId) {
      return xml;
    }

    // Create a sanitized ID from the name
    const sanitizedId = sanitizeFileName(currentName)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/^[^a-zA-Z_]/, '_')
      .substring(0, 50);

    if (!sanitizedId || sanitizedId === currentId) {
      return xml;
    }

    console.log(`Syncing DMN Decision ID in XML: "${currentId}" → "${sanitizedId}" (based on name: "${currentName}")`);

    // Replace the decision ID in the XML
    const updatedDecisionTag = decisionTag.replace(
      /\bid\s*=\s*\"[^\"]+\"/i,
      `id="${sanitizedId}"`
    );

    // Replace the decision tag in the XML
    let updatedXml = xml.replace(decisionMatch[0], updatedDecisionTag);

    // Also update any references to the old ID in the XML (like in BPMNShape)
    const idPattern = new RegExp(`\\b${escapeRegex(currentId)}\\b`, 'g');
    updatedXml = updatedXml.replace(idPattern, sanitizedId);

    return updatedXml;
  } catch (error) {
    console.error('Error syncing DMN decision ID in XML:', error);
    return xml;
  }
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function removeDMNDI(xml: string): string {
  try {
    if (!xml || typeof xml !== 'string') {
      return xml;
    }

    // Remove DMNDI section for better compatibility with Camunda
    return xml.replace(/<dmndi:DMNDI>[\s\S]*?<\/dmndi:DMNDI>/gi, '<dmndi:DMNDI></dmndi:DMNDI>');
  } catch (error) {
    console.error('Error removing DMNDI:', error);
    return xml;
  }
}

export function removeCDATAFromDmnTableValues(xml: string): string {
  try {
    if (!xml || typeof xml !== 'string') {
      return xml;
    }

    // Remove CDATA from text elements to ensure clean import
    return xml.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1');
  } catch (error) {
    console.error('Error removing CDATA from DMN table values:', error);
    return xml;
  }
}

export function standardizeDmnDefinitions(xml: string): string {
  try {
    if (!xml || typeof xml !== 'string') {
      return xml;
    }

    // Extract the current decision ID for use in definitions
    const decisionIdMatch = /<decision\b[^>]*\bid\s*=\s*"([^"]+)"/i.exec(xml);
    const decisionId = decisionIdMatch ? decisionIdMatch[1] : 'decision';

    // Standard DMN namespaces and attributes
    const standardDefinitions = `<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" xmlns:di="http://www.omg.org/spec/DMN/20180521/DI/" xmlns:flowable="http://flowable.org/dmn" xmlns:design="http://flowable.org/design" id="definition_${decisionId}" name="${decisionId}" namespace="http://www.flowable.org/dmn">`;

    // Replace the existing definitions element
    const definitionsPattern = /<definitions\b[^>]*>/i;

    return xml.replace(definitionsPattern, standardDefinitions);
  } catch (error) {
    console.error('Error standardizing DMN definitions:', error);
    return xml;
  }
}

export function wrapDmnTableValuesInCDATA(xml: string): string {
  try {
    if (!xml || typeof xml !== 'string') {
      return xml;
    }

    // Only wrap text elements that contain special characters that need CDATA
    const textPattern = /(<text[^>]*>)([^<]*?)(<\/text>)/gi;

    return xml.replace(textPattern, (match, openTag, content, closeTag) => {
      const trimmedContent = content.trim();

      // Skip if already has CDATA or is empty
      if (!trimmedContent || trimmedContent.includes('<![CDATA[')) {
        return match;
      }

      // Only wrap if content contains characters that benefit from CDATA
      const needsCDATA = /[<>&"'=]/.test(trimmedContent) ||
                         trimmedContent.includes('==') ||
                         trimmedContent.includes('!=') ||
                         trimmedContent.includes('<=') ||
                         trimmedContent.includes('>=');

      if (needsCDATA) {
        return `${openTag}<![CDATA[${trimmedContent}]]>${closeTag}`;
      }

      return match;
    });
  } catch (error) {
    console.error('Error wrapping DMN table values in CDATA:', error);
    return xml;
  }
}

export function createInitialXmlWithProcessId(pid: string, initialXml: string): string {
  try {
    // Replace process id and the BPMNPlane bpmnElement reference
    let xml = initialXml;
    xml = xml.replace(/(<bpmn:process\b[^>]*\bid=")Process_\d+("[^>]*>)/, `$1${pid}$2`);
    xml = xml.replace(/(bpmnElement=")Process_\d+(")/, `$1${pid}$2`);
    return xml;
  } catch {
    return initialXml;
  }
}

// Ensure all conditionExpression bodies are wrapped in CDATA
export function wrapConditionExpressionsInCDATA(xml: string): string {
  try {
    const re = /(<(?:[\w-]+:)?conditionExpression\b[^>]*>)([\s\S]*?)(<\/(?:[\w-]+:)?conditionExpression>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      const unescaped = trimmed
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
      return `${open}<![CDATA[${unescaped}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Prefix unqualified <variable> children inside <flowable:variableAggregation> for import,
// so the moddle maps them to flowable:Variable. We remove the prefix again on export.
export function prefixVariableChildrenForImport(xml: string): string {
  try {
    const re = /(\<flowable:variableAggregation\b[\s\S]*?\>)([\s\S]*?)(\<\/flowable:variableAggregation\>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const transformed = inner
        .replace(/<\s*variable\b/g, '<flowable:variable')
        .replace(/<\/(\s*)variable\s*>/g, '</flowable:variable>');
      return `${open}${transformed}${close}`;
    });
  } catch {
    return xml;
  }
}

// Normalize Flowable-style errorRef (holding errorCode) to proper BPMN references:
// - If errorEventDefinition@errorRef references a non-existent ID but matches an existing <error errorCode="...">,
//   replace it with that <error>'s id.
// - If no matching <error> exists, create one under <definitions> and point errorRef to it.
export function normalizeErrorRefOnImport(xml: string): string {
  try {
    // Collect existing <error id=... errorCode=...>
    const idToCode = new Map<string, string>();
    const codeToId = new Map<string, string>();
    const reError = /<([\w-]+:)?error\b([^>]*)>/gi;
    let m: RegExpExecArray | null;
    while ((m = reError.exec(xml))) {
      const attrs = m[2] || '';
      const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs);
      const codeMatch = /\berrorCode\s*=\s*"([^"]*)"/i.exec(attrs);
      if (idMatch) {
        const id = idMatch[1];
        const code = codeMatch ? codeMatch[1] : '';
        idToCode.set(id, code);
        if (code) codeToId.set(code, id);
      }
    }

    // Track new errors to inject
    const newErrors: Array<{ id: string, code: string, name: string } > = [];

    // Replace errorRef in errorEventDefinition if needed
    const reErrDefRef = /(<([\w-]+:)?errorEventDefinition\b[^>]*\berrorRef\s*=\s*")([^"]+)(")/gi;
    let changed = false;
    const replaced = xml.replace(reErrDefRef, (full, pre, _ns, ref, post) => {
      // already an existing error ID?
      if (idToCode.has(ref)) return full;
      // treat as code: find existing error by code or create one
      let targetId = codeToId.get(ref);
      if (!targetId) {
        // generate new unique id
        const base = 'Error_' + (ref || 'code').replace(/[^A-Za-z0-9_\-]/g, '_');
        let candidate = base;
        let i = 1;
        while (idToCode.has(candidate)) { candidate = base + '_' + (++i); }
        targetId = candidate;
        idToCode.set(targetId, ref);
        codeToId.set(ref, targetId);
        newErrors.push({ id: targetId, code: ref, name: ref });
      }
      changed = true;
      return `${pre}${targetId}${post}`;
    });

    if (!changed && !newErrors.length) return xml;

    // Inject any newly created <error> elements before </definitions>
    if (newErrors.length) {
      // detect prefix used for definitions and error elements
      const defMatch = /<([\w-]+:)?definitions\b[^>]*>/i.exec(replaced);
      const ns = defMatch && defMatch[1] ? defMatch[1] : 'bpmn:';
      const injection = newErrors.map(e => `  <${ns}error id="${e.id}" name="${escapeXml(e.name)}" errorCode="${escapeXml(e.code)}" />`).join('\n');
      const reClose = /(<\/(?:[\w-]+:)?definitions>)/i;
      if (reClose.test(replaced)) {
        return replaced.replace(reClose, `${injection}\n$1`);
      } else {
        // fallback: append at end
        return replaced + `\n${injection}\n`;
      }
    }
    return replaced;
  } catch {
    return xml;
  }
}

function escapeXml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// XML manipulation functions for export (writing)

// Ensure flowable:eventType body is wrapped in CDATA
export function wrapEventTypeInCDATA(xml: string): string {
  try {
    const re = /(<flowable:eventType\b[^>]*>)([\s\S]*?)(<\/flowable:eventType>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Ensure flowable:sendSynchronously body is wrapped in CDATA if present
export function wrapSendSynchronouslyInCDATA(xml: string): string {
  try {
    const re = /(<flowable:sendSynchronously\b[^>]*>)([\s\S]*?)(<\/flowable:sendSynchronously>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Ensure flowable:startEventCorrelationConfiguration body is wrapped in CDATA if present
export function wrapStartEventCorrelationConfigurationInCDATA(xml: string): string {
  try {
    const re = /(<flowable:startEventCorrelationConfiguration\b[^>]*>)([\s\S]*?)(<\/flowable:startEventCorrelationConfiguration>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Ensure flowable:string body is wrapped in CDATA
export function wrapFlowableStringInCDATA(xml: string): string {
  try {
    const re = /(<flowable:string\b[^>]*>)([\s\S]*?)(<\/flowable:string>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Ensure flowable:decisionReferenceType body is wrapped in CDATA
export function wrapDecisionReferenceTypeInCDATA(xml: string): string {
  try {
    const re = /(<flowable:decisionReferenceType\b[^>]*>)([\s\S]*?)(<\/flowable:decisionReferenceType>)/g;
    return xml.replace(re, (_m, open, inner, close) => {
      const already = /<!\[CDATA\[/.test(inner);
      if (already) return _m;
      const trimmed = String(inner).trim();
      if (!trimmed) return _m;
      return `${open}<![CDATA[${trimmed}]]>${close}`;
    });
  } catch {
    return xml;
  }
}

// Replace errorEventDefinition@errorRef with the actual errorCode of the referenced bpmn:Error, for Flowable compatibility
export function mapErrorRefToErrorCodeOnExport(xml: string): string {
  try {
    // Build map of Error element ID -> errorCode
    const idToCode = new Map<string, string>();
    const reError = /<([\w-]+:)?error\b([^>]*)>/gi;
    let m: RegExpExecArray | null;
    while ((m = reError.exec(xml))) {
      const attrs = m[2] || '';
      const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs);
      const codeMatch = /\berrorCode\s*=\s*"([^"]*)"/i.exec(attrs);
      if (idMatch && codeMatch) {
        idToCode.set(idMatch[1], codeMatch[1]);
      }
    }
    if (!idToCode.size) return xml;
    // Replace errorRef values on errorEventDefinition with code if we have a match
    const reErrDef = /(<([\w-]+:)?errorEventDefinition\b[^>]*\berrorRef\s*=\s*")([^"]+)(")/gi;
    return xml.replace(reErrDef, (full, pre, _ns, ref, post) => {
      const code = idToCode.get(ref);
      if (!code) return full;
      return `${pre}${code}${post}`;
    });
  } catch {
    return xml;
  }
}

// Ensure error definitions match errorRef usage:
// - Remove unreferenced <bpmn:error> elements
// - For each errorRef without a matching <bpmn:error id="..."> create one
//   with id=name=errorCode=errorRef value
export function reconcileErrorDefinitionsOnExport(xml: string): string {
  try {
    // 1) Collect referenced errorRef values (after we rewrote them to codes)
    const refs = new Set<string>();
    const reErrRef = /<([\w-]+:)?errorEventDefinition\b[^>]*\berrorRef\s*=\s*"([^"]+)"/gi;
    let m: RegExpExecArray | null;
    while ((m = reErrRef.exec(xml))) {
      const ref = (m[2] || '').trim();
      if (ref) refs.add(ref);
    }

    // 2) Collect existing error IDs
    const existing = new Set<string>();
    const collectId = (attrs: string) => {
      const idMatch = /\bid\s*=\s*"([^"]+)"/i.exec(attrs || '');
      return idMatch ? idMatch[1] : '';
    };
    const reErrSelf = /<([\w-]+:)?error\b([^>]*)\/>/gi;
    while ((m = reErrSelf.exec(xml))) {
      const id = collectId(m[2]);
      if (id) existing.add(id);
    }
    const reErrPair = /<([\w-]+:)?error\b([^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?error>/gi;
    while ((m = reErrPair.exec(xml))) {
      const id = collectId(m[2]);
      if (id) existing.add(id);
    }

    // 3) Remove unreferenced errors
    const shouldKeep = (attrs: string) => {
      const id = collectId(attrs);
      return id && refs.has(id);
    };
    let out = xml.replace(reErrSelf, (full, _ns, attrs) => (shouldKeep(attrs) ? full : ''));
    out = out.replace(reErrPair, (full, _ns, attrs) => (shouldKeep(attrs) ? full : ''));

    // 4) Inject missing errors before </definitions>
    const missing = Array.from(refs).filter((id) => !existing.has(id));
    if (missing.length) {
      const defMatch = /<([\w-]+:)?definitions\b[^>]*>/i.exec(out);
      const ns = defMatch && defMatch[1] ? defMatch[1] : 'bpmn:';
      const payload = missing
        .map((id) => `  <${ns}error id="${id}" name="${id}" errorCode="${id}" />`)
        .join('\n');
      const reClose = /(<\/(?:[\w-]+:)?definitions>)/i;
      if (reClose.test(out)) {
        out = out.replace(reClose, `${payload}\n$1`);
      } else {
        out += `\n${payload}\n`;
      }
    }

    return out;
  } catch {
    return xml;
  }
}

// For ServiceTasks with flowable:type="external-worker", ensure design stencils are written
// inside extensionElements as required by Flowable Design:
//   <extensionElements>
//     <design:stencilid><![CDATA[ExternalWorkerTask]]></design:stencilid>
//     <design:stencilsuperid><![CDATA[Task]]></design:stencilsuperid>
//   </extensionElements>
export function ensureExternalWorkerStencilsOnExport(xml: string): string {
  try {
    let out = xml;
    // pretty-printed block with stable indentation
    const OPEN_INDENT = '      ';
    const INNER_INDENT = '        ';
    const buildStencilBlock = (extPrefix: string) => (
      `<${extPrefix}extensionElements>\n` +
      `${INNER_INDENT}<design:stencilid><![CDATA[ExternalWorkerTask]]></design:stencilid>\n` +
      `${INNER_INDENT}<design:stencilsuperid><![CDATA[Task]]></design:stencilsuperid>\n` +
      `${OPEN_INDENT}</${extPrefix}extensionElements>`
    );

    // 1) Handle paired serviceTask with content
    const pairRe = /<(([\w-]+:)?serviceTask)\b([^>]*\bflowable:type\s*=\s*"external-worker"[^>]*)>([\s\S]*?)<\/(?:[\w-]+:)?serviceTask>/gi;
    out = out.replace(pairRe, (_m, qname, pfxMaybe, attrs, inner) => {
      const pfx = (pfxMaybe || '');
      // Find existing extensionElements (prefixed or not)
      const extRe = /<([\w-]+:)?extensionElements\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?extensionElements>/i;
      let newInner: string;
      const extMatch = inner.match(extRe);
      if (extMatch) {
        const extPrefix = extMatch[1] || pfx;
        const extContent = extMatch[2] || '';
        // Remove existing design stencil tags and trim trailing/leading whitespace
        const cleaned = extContent
          .replace(/<design:(stencilid|stencilsuperid)\b[\s\S]*?<\/design:\1>\s*/gi, '')
          .trim();
        // Rebuild pretty block and append remaining extension content on new line if present
        const base = buildStencilBlock(extPrefix);
        const extBlock = cleaned ? `${base}\n${cleaned}` : base;
        // Ensure we replace with a block that starts on its own line
        newInner = inner.replace(extRe, extBlock);
      } else {
        const extPrefix = pfx;
        const extBlock = buildStencilBlock(extPrefix);
        // place extensionElements as the first child with proper newlines
        newInner = `\n${OPEN_INDENT}${extBlock}${inner ? `\n${inner.trimStart()}` : ''}`;
      }
      return `<${pfx}serviceTask${attrs}>${newInner}</${pfx}serviceTask>`;
    });

    // 2) Handle self-closing serviceTask
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

// Remove messageEventDefinition only in the serialized XML for Start/IntermediateCatch/Boundary events
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

// Ensure all SubProcesses are expanded on the canvas by setting BPMNShape@isExpanded="true" for their DI shapes
export function expandSubProcessShapesInDI(xml: string): string {
  try {
    let out = xml;
    // collect all subprocess IDs (prefixed or unprefixed)
    const ids = new Set<string>();
    const reSub = /<([\w-]+:)?subProcess\b[^>]*\bid="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = reSub.exec(out))) {
      ids.add(m[2]);
    }
    if (!ids.size) return out;
    // for each id, force BPMNShape isExpanded="true"
    ids.forEach((id) => {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reShape = new RegExp(`(<([\\w-]+:)?BPMNShape\\b[^>]*\\bbpmnElement="${esc}"[^>]*)(/?>)`, 'g');
      out = out.replace(reShape, (full, open, _ns, end) => {
        if (/\bisExpanded\s*=\s*"true"/i.test(open)) return full; // already true
        if (/\bisExpanded\s*=\s*"(?:true|false)"/i.test(open)) {
          open = open.replace(/\bisExpanded\s*=\s*"(?:true|false)"/i, 'isExpanded="true"');
          return open + end;
        }
        // inject attribute before end
        return `${open} isExpanded="true"${end}`;
      });
    });
    return out;
  } catch {
    return xml;
  }
}

// Convert bpmn:sendTask to bpmn:serviceTask with flowable:type="send-event" in the serialized XML
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
    // Handle both prefixed and unprefixed forms
    replaceTriplet('bpmn:');
    replaceTriplet('');
    return out;
  } catch {
    return xml;
  }
}

// Convert bpmn:businessRuleTask to bpmn:serviceTask with flowable:type="dmn" in the serialized XML
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

// Convert the root <definitions> to Flowable Cloud-style header and normalize DI prefixes
export function toFlowableDefinitionHeader(xml: string): string {
  try {
    let out = xml;
    // Extract existing definitions id if present
    const idMatch = out.match(/<((?:[a-zA-Z_][\w-]*:)?)definitions\b[^>]*\bid="([^"]+)"/);
    const defId = idMatch ? idMatch[2] : 'Definitions_1';

    // Build Flowable-style opening tag. Keep xmlns:bpmn to satisfy xsi:type="bpmn:*" usages inside.
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
      `id="${defId}"`,
      'targetNamespace="http://flowable.org/test">'
    ].join(' ');

    // Replace definitions opening tag
    out = out.replace(/<((?:[a-zA-Z_][\w-]*:)?)definitions\b[^>]*>/i, openTag);

    // Normalize bpmndi prefixes to just "bpmndi:" throughout
    out = out.replace(/<(\w+):BPMNDiagram\b/gi, '<bpmndi:BPMNDiagram');
    out = out.replace(/<\/(\w+):BPMNDiagram>/gi, '</bpmndi:BPMNDiagram>');
    out = out.replace(/<(\w+):BPMNPlane\b/gi, '<bpmndi:BPMNPlane');
    out = out.replace(/<\/(\w+):BPMNPlane>/gi, '</bpmndi:BPMNPlane>');
    out = out.replace(/<(\w+):BPMNShape\b/gi, '<bpmndi:BPMNShape');
    out = out.replace(/<\/(\w+):BPMNShape>/gi, '</bpmndi:BPMNShape>');
    out = out.replace(/<(\w+):BPMNEdge\b/gi, '<bpmndi:BPMNEdge');
    out = out.replace(/<\/(\w+):BPMNEdge>/gi, '</bpmndi:BPMNEdge>');

    return out;
  } catch {
    return xml;
  }
}

// Apply all import transformations to XML
export function applyImportTransformations(xml: string): string {
  let result = xml;
  result = wrapConditionExpressionsInCDATA(result);
  result = prefixVariableChildrenForImport(result);
  result = normalizeErrorRefOnImport(result);
  result = expandSubProcessShapesInDI(result);
  return result;
}

// BPMN Element Configuration functions (moved from main.ts)
// These functions configure BPMN elements before export and require a modeler instance

// Ensure first default outbound event mapping exists for SendTask / ServiceTask(send-event)
export function ensureDefaultOutboundMappingForSendTasks(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    const isSendLike = (bo: any) => {
      const t = bo && bo.$type;
      if (t === 'bpmn:SendTask') return true;
      if (t === 'bpmn:ServiceTask') {
        const v = bo.get ? bo.get('flowable:type') : (bo as any)['flowable:type'];
        return v === 'send-event';
      }
      return false;
    };
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || !isSendLike(bo)) return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasEventIn = values.some((v: any) => String(v && v.$type).toLowerCase() === 'flowable:eventinparameter' || String(v && v.$type).toLowerCase() === 'flowable:eventinparameter');
      if (!hasEventIn) {
        const param = bpmnFactory.create('flowable:EventInParameter', {
          source: '${execution.getProcessInstanceBusinessKey()}',
          target: 'businessKey'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ param ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureDefaultOutboundMappingForSendTasks failed:', e);
  }
}

// Ensure a default correlation parameter exists for ReceiveTask
export function ensureCorrelationParameterForReceiveTasks(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:ReceiveTask') return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
      if (!hasCorr) {
        const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
          name: 'businessKey',
          value: '${execution.getProcessInstanceBusinessKey()}'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForReceiveTasks failed:', e);
  }
}

// Ensure default correlation parameter for IntermediateCatchEvent before export
export function ensureCorrelationParameterForIntermediateCatchEvents(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:IntermediateCatchEvent') return;

      // Skip timer events
      const eventDefinitions = bo && bo.eventDefinitions;
      const isTimer = Array.isArray(eventDefinitions) && eventDefinitions.some((ed: any) => ed && ed.$type === 'bpmn:TimerEventDefinition');
      if (isTimer) return;

      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
      if (!hasCorr) {
        const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
          name: 'businessKey',
          value: '${execution.getProcessInstanceBusinessKey()}'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForIntermediateCatchEvents failed:', e);
  }
}

// Remove auto-added MessageEventDefinition for Flowable event-registry style events (Start/ICE/Boundary) before export
export function stripMessageEventDefinitionsForFlowableEvents(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    if (!elementRegistry || !modeling) return;
    const events = elementRegistry.filter((el: any) => {
      const t = el?.businessObject?.$type;
      return t === 'bpmn:IntermediateCatchEvent' || t === 'bpmn:BoundaryEvent' || t === 'bpmn:StartEvent';
    });
    events.forEach((el: any) => {
      const bo: any = el.businessObject;
      const defs = Array.isArray(bo.eventDefinitions) ? bo.eventDefinitions : [];
      if (!defs.length) return;
      const hasTimer = defs.some((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');
      const hasMessage = defs.some((d: any) => d && d.$type === 'bpmn:MessageEventDefinition');
      if (hasTimer && hasMessage) {
        // keep only timer if both present
        const newDefs = defs.filter((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');
        try { modeling.updateModdleProperties(el, bo, { eventDefinitions: newDefs }); } catch {}
        return;
      }
      // If only message def(s) present and Flowable event-registry metadata exists, strip them (we added for icon only)
      const onlyMessage = hasMessage && defs.every((d: any) => d && d.$type === 'bpmn:MessageEventDefinition');
      if (!onlyMessage) return;
      const ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
      const hasFlowableMeta = values && values.some((v: any) => {
        const t = String(v && v.$type);
        return t === 'flowable:EventType' || t === 'flowable:EventCorrelationParameter' || /flowable:eventOutParameter/i.test(t);
      });
      if (hasFlowableMeta) {
        try { modeling.updateModdleProperties(el, bo, { eventDefinitions: [] }); } catch {}
      }
    });
  } catch (e) {
    console.warn('stripMessageEventDefinitionsForFlowableEvents failed:', e);
  }
}

// Ensure default correlation parameter for StartEvent before export
export function ensureCorrelationParameterForStartEvents(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:StartEvent') return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasEventType = values.some((v: any) => String(v && v.$type) === 'flowable:EventType');
      const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
      if (!hasCorr && hasEventType) {
        const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
          name: 'businessKey',
          value: '${execution.getProcessInstanceBusinessKey()}'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForStartEvents failed:', e);
  }
}

// Ensure a startEventCorrelationConfiguration exists for StartEvent (message) before export
export function ensureStartEventCorrelationConfigurationForStartEvents(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:StartEvent') return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasEventMeta = values.some((v: any) => {
        const t = String(v && v.$type);
        return t === 'flowable:EventType' || t === 'flowable:EventCorrelationParameter';
      });
      const hasCfg = values.some((v: any) => String(v && v.$type) === 'flowable:StartEventCorrelationConfiguration');
      if (hasEventMeta && !hasCfg) {
        const cfg = bpmnFactory.create('flowable:StartEventCorrelationConfiguration', { value: 'startNewInstance' });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ cfg ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureStartEventCorrelationConfigurationForStartEvents failed:', e);
  }
}

// Ensure default correlation parameter for BoundaryEvent before export
export function ensureCorrelationParameterForBoundaryEvents(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:BoundaryEvent') return;
      const defs = Array.isArray((bo as any).eventDefinitions) ? (bo as any).eventDefinitions : [];
      const hasTimer = defs.some((d: any) => d && d.$type === 'bpmn:TimerEventDefinition');
      const hasError = defs.some((d: any) => d && d.$type === 'bpmn:ErrorEventDefinition');
      if (hasTimer || hasError) return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const hasCorr = values.some((v: any) => String(v && v.$type) === 'flowable:EventCorrelationParameter');
      if (!hasCorr) {
        const corr = bpmnFactory.create('flowable:EventCorrelationParameter', {
          name: 'businessKey',
          value: '${execution.getProcessInstanceBusinessKey()}'
        });
        try { modeling.updateModdleProperties(el, ext, { values: values.concat([ corr ]) }); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCorrelationParameterForBoundaryEvents failed:', e);
  }
}

// Ensure a <flowable:systemChannel/> exists on SendTask and on ServiceTask with flowable:type="send-event"
export function ensureSystemChannelForSendTasks(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    const needsSystemChannel = (bo: any) => {
      const t = bo && bo.$type;
      if (t === 'bpmn:SendTask') return true;
      if (t === 'bpmn:ServiceTask') {
        const v = bo.get ? bo.get('flowable:type') : (bo as any)['flowable:type'];
        return v === 'send-event';
      }
      return false;
    };
    const hasSystemChannel = (bo: any) => {
      const ext = bo && (bo.get ? bo.get('extensionElements') : bo.extensionElements);
      const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
      return values.some((v: any) => v && String(v.$type) === 'flowable:SystemChannel' || String(v.$type) === 'flowable:systemChannel');
    };
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || !needsSystemChannel(bo) || hasSystemChannel(bo)) return;
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      const sys = bpmnFactory.create('flowable:SystemChannel', {});
      try { modeling.updateModdleProperties(el, ext, { values: values.concat([ sys ]) }); } catch {}
    });
  } catch (e) {
    console.warn('ensureSystemChannelForSendTasks failed:', e);
  }
}

// Ensure DMN defaults exist on BusinessRuleTask or ServiceTask(flowable:type="dmn")
export function ensureDmnDefaultsForDecisionTasks(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    const isDmnLike = (bo: any) => {
      if (!bo) return false;
      if (bo.$type === 'bpmn:BusinessRuleTask') return true;
      if (bo.$type === 'bpmn:ServiceTask') {
        const t = bo.get ? bo.get('flowable:type') : (bo as any)['flowable:type'];
        return t === 'dmn';
      }
      return false;
    };
    const ensureExt = (el: any, bo: any) => {
      let ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) {
        ext = bpmnFactory.create('bpmn:ExtensionElements', { values: [] });
        try { modeling.updateModdleProperties(el, bo, { extensionElements: ext }); } catch {}
      }
      return ext;
    };
    const getValues = (ext: any) => (ext.get ? ext.get('values') : ext.values) || [];
    const findField = (values: any[], name: string) => values.find((v: any) => v && v.$type && /flowable:field/i.test(v.$type) && ((v.get ? v.get('name') : v.name) === name));
    const setField = (el: any, ext: any, values: any[], name: string, val: string) => {
      let fld = findField(values, name);
      if (!fld) {
        fld = bpmnFactory.create('flowable:Field', { name });
        values = values.concat([ fld ]);
        try { modeling.updateModdleProperties(el, ext, { values }); } catch {}
      }
      let node = fld.get ? fld.get('string') : (fld as any).string;
      if (!node) {
        node = bpmnFactory.create('flowable:String', { value: val });
        try { modeling.updateModdleProperties(el, fld, { string: node }); } catch {}
      } else {
        try { modeling.updateModdleProperties(el, node, { value: val }); } catch {}
      }
    };
    const ensureDecisionRefType = (el: any, ext: any, values: any[]) => {
      let node = values.find((v: any) => v && v.$type && /flowable:decisionReferenceType/i.test(v.$type));
      if (!node) {
        node = bpmnFactory.create('flowable:DecisionReferenceType', { value: 'decisionTable' });
        values = values.concat([ node ]);
        try { modeling.updateModdleProperties(el, ext, { values }); } catch {}
      } else {
        try { modeling.updateModdleProperties(el, node, { value: 'decisionTable' }); } catch {}
      }
    };
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!isDmnLike(bo)) return;
      const ext = ensureExt(el, bo);
      let values = getValues(ext);
      setField(el, ext, values, 'fallbackToDefaultTenant', 'true');
      values = getValues(ext);
      setField(el, ext, values, 'sameDeployment', 'true');
      values = getValues(ext);
      ensureDecisionRefType(el, ext, values);
    });
  } catch (e) {
    console.warn('ensureDmnDefaultsForDecisionTasks failed:', e);
  }
}

// Persist default flowable:inheritBusinessKey="true" on CallActivity if missing
export function ensureCallActivityDefaults(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    if (!elementRegistry || !modeling) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:CallActivity' || !bo.get) return;
      const updates: any = {};
      if (typeof bo.get('flowable:inheritBusinessKey') === 'undefined' && !bo.get('flowable:businessKey')) updates['flowable:inheritBusinessKey'] = true;
      if (typeof bo.get('flowable:inheritVariables') === 'undefined') updates['flowable:inheritVariables'] = true;
      if (Object.keys(updates).length) {
        try { modeling.updateProperties(el, updates); } catch {}
      }
    });
  } catch (e) {
    console.warn('ensureCallActivityDefaults failed:', e);
  }
}

// Remove incomplete Flowable In/Out mappings (no target or no source & no expression)
export function pruneInvalidCallActivityMappings(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    const bpmnFactory = modeler.get('bpmnFactory');
    if (!elementRegistry || !modeling || !bpmnFactory) return;

    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);

    const isFlowableMapping = (v: any) => {
      const t = String(v && v.$type || '');
      return /^flowable:(in|out)$/i.test(t);
    };
    const get = (o: any, key: string) => (o && (o.get ? o.get(key) : o[key]));
    const hasText = (val: any) => !!String(val || '').trim();

    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || bo.$type !== 'bpmn:CallActivity') return;
      const ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
      if (!ext) return;
      const values = (ext.get ? ext.get('values') : ext.values) || [];
      if (!Array.isArray(values) || !values.length) return;

      const newValues = values.filter((v: any) => {
        if (!isFlowableMapping(v)) return true;
        const target = get(v, 'target');
        const source = get(v, 'source');
        const expr = get(v, 'sourceExpression');
        // keep only complete mappings: target AND (source XOR expression OR at least one present)
        return hasText(target) && (hasText(source) || hasText(expr));
      });

      if (newValues.length !== values.length) {
        try { modeling.updateModdleProperties(el, ext, { values: newValues }); } catch {}
      }
    });
  } catch (e) {
    console.warn('pruneInvalidCallActivityMappings failed:', e);
  }
}

// BPMN Model Utility functions (for import processing)

// Sanitize ScriptTask -> Task and handle ServiceTask mappings for display
export function sanitizeModel(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const bpmnReplace = modeler.get('bpmnReplace');
    if (!elementRegistry || !bpmnReplace) return;

    // Map ServiceTask with flowable:type="send-event" -> SendTask for display
    try {
      const serviceSend = elementRegistry.filter((el: any) => el?.businessObject?.$type === 'bpmn:ServiceTask' && (el.businessObject.get ? el.businessObject.get('flowable:type') === 'send-event' : (el.businessObject as any)['flowable:type'] === 'send-event'));
      serviceSend.forEach((el: any) => {
        try { bpmnReplace.replaceElement(el, { type: 'bpmn:SendTask' }); } catch {}
      });
    } catch (e) {
      console.warn('Send-event ServiceTask view mapping failed:', e);
    }

    // Map ServiceTask with flowable:type="dmn" -> BusinessRuleTask for display
    try {
      const serviceDmn = elementRegistry.filter((el: any) => el?.businessObject?.$type === 'bpmn:ServiceTask' && (el.businessObject.get ? el.businessObject.get('flowable:type') === 'dmn' : (el.businessObject as any)['flowable:type'] === 'dmn'));
      serviceDmn.forEach((el: any) => {
        try { bpmnReplace.replaceElement(el, { type: 'bpmn:BusinessRuleTask' }); } catch {}
      });
    } catch (e) {
      console.warn('DMN ServiceTask view mapping failed:', e);
    }

    const scriptTasks = elementRegistry.filter((el: any) => el?.businessObject?.$type === 'bpmn:ScriptTask');
    scriptTasks.forEach((el: any) => {
      try {
        bpmnReplace.replaceElement(el, { type: 'bpmn:Task' });
      } catch (e) {
        console.warn('Konnte ScriptTask nicht ersetzen:', e);
      }
    });

    // Ensure icon rendering for StartEvent / IntermediateCatchEvent / BoundaryEvent by adding MessageEventDefinition
    try {
      const modeling = modeler.get('modeling');
      const bpmnFactory = modeler.get('bpmnFactory');
      if (modeling && bpmnFactory) {
        const events = elementRegistry.filter((el: any) => {
          const t = el?.businessObject?.$type;
          return t === 'bpmn:IntermediateCatchEvent' || t === 'bpmn:BoundaryEvent' || t === 'bpmn:StartEvent';
        });
        events.forEach((el: any) => {
          const bo: any = el.businessObject;
          const defs = Array.isArray(bo.eventDefinitions) ? bo.eventDefinitions : [];
          if (defs.length) return;
          const ext = bo.get ? bo.get('extensionElements') : bo.extensionElements;
          const values = (ext && (ext.get ? ext.get('values') : ext.values)) || [];
          const hasFlowableMeta = values && values.some((v: any) => {
            const t = String(v && v.$type);
            return t === 'flowable:EventType' || t === 'flowable:EventCorrelationParameter' || /flowable:eventOutParameter/i.test(t);
          });
          if (hasFlowableMeta) {
            const med = bpmnFactory.create('bpmn:MessageEventDefinition', {});
            try { modeling.updateModdleProperties(el, bo, { eventDefinitions: [ med ] }); } catch {}
          }
        });
      }
    } catch (e) {
      console.warn('Ensure MessageEventDefinition failed:', e);
    }
  } catch (e) {
    console.warn('Sanitize fehlgeschlagen:', e);
  }
}

// Migrate legacy asyncBefore/asyncAfter to Flowable async/asyncLeave
export function migrateAsyncFlags(modeler: any) {
  try {
    const elementRegistry = modeler.get('elementRegistry');
    const modeling = modeler.get('modeling');
    if (!elementRegistry || !modeling) return;
    const all = (elementRegistry.getAll && elementRegistry.getAll())
      || (elementRegistry._elements && Object.values(elementRegistry._elements).map((e: any) => e.element))
      || elementRegistry.filter((el: any) => !!el);
    all.forEach((el: any) => {
      const bo = el && el.businessObject;
      if (!bo || !bo.get) return;
      const hasBefore = typeof bo.get('flowable:asyncBefore') !== 'undefined';
      const hasAfter = typeof bo.get('flowable:asyncAfter') !== 'undefined';
      const vBefore = !!bo.get('flowable:asyncBefore');
      const vAfter = !!bo.get('flowable:asyncAfter');
      const updates: any = {};
      let dirty = false;
      if (hasBefore) {
        if (vBefore && !bo.get('flowable:async')) { updates['flowable:async'] = true; dirty = true; }
        updates['flowable:asyncBefore'] = undefined; dirty = true;
      }
      if (hasAfter) {
        if (vAfter && !bo.get('flowable:asyncLeave')) { updates['flowable:asyncLeave'] = true; dirty = true; }
        updates['flowable:asyncAfter'] = undefined; dirty = true;
      }
      if (dirty) {
        try { modeling.updateProperties(el, updates); } catch (e) { /* ignore */ }
      }
    });
  } catch (e) {
    console.warn('Migration async flags failed:', e);
  }
}

// Composite function that applies all import-time model transformations
export function applyImportModelTransformations(modeler: any) {
  sanitizeModel(modeler);
  migrateAsyncFlags(modeler);
  ensureCallActivityDefaults(modeler);
}

// Composite function that applies all pre-export configurations
export function applyPreExportConfigurations(modeler: any) {
  ensureDefaultOutboundMappingForSendTasks(modeler);
  ensureCorrelationParameterForReceiveTasks(modeler);
  ensureCorrelationParameterForIntermediateCatchEvents(modeler);
  stripMessageEventDefinitionsForFlowableEvents(modeler);
  ensureCorrelationParameterForStartEvents(modeler);
  ensureStartEventCorrelationConfigurationForStartEvents(modeler);
  ensureCorrelationParameterForBoundaryEvents(modeler);
  ensureSystemChannelForSendTasks(modeler);
  ensureDmnDefaultsForDecisionTasks(modeler);
  ensureCallActivityDefaults(modeler);
  pruneInvalidCallActivityMappings(modeler);
}

// Apply all export transformations to XML
export function applyExportTransformations(xml: string): string {
  let result = xml;
  result = wrapEventTypeInCDATA(result);
  result = wrapSendSynchronouslyInCDATA(result);
  result = wrapStartEventCorrelationConfigurationInCDATA(result);
  result = wrapFlowableStringInCDATA(result);
  result = wrapDecisionReferenceTypeInCDATA(result);
  result = mapErrorRefToErrorCodeOnExport(result);
  result = reconcileErrorDefinitionsOnExport(result);
  result = ensureExternalWorkerStencilsOnExport(result);
  result = stripMessageEventDefinitionsInXML(result);
  result = expandSubProcessShapesInDI(result);
  result = mapSendTaskToServiceOnExport(result);
  result = mapBusinessRuleToServiceDmnOnExport(result);
  result = toFlowableDefinitionHeader(result);
  return result;
}