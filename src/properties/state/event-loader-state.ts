const correlationOptions = new WeakMap<any, string[]>();

export function setCorrelationOptions(target: any, options: string[] | undefined | null) {
  if (!target) return;
  if (Array.isArray(options) && options.length) {
    correlationOptions.set(target, Array.from(new Set(options.map((opt) => (opt || '').trim()).filter(Boolean))));
  } else {
    correlationOptions.delete(target);
  }
}

export function getCorrelationOptions(target: any): string[] {
  if (!target) return [];
  return correlationOptions.get(target) || [];
}
