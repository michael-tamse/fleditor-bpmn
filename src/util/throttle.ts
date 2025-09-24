export function throttle<T extends (...args: any[]) => void>(fn: T, wait = 150): T {
  let lastInvocation = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: any[] | null = null;

  const invoke = (context: any) => {
    if (!pendingArgs) return;
    lastInvocation = Date.now();
    fn.apply(context, pendingArgs);
    pendingArgs = null;
    timeout = null;
  };

  return function throttled(this: any, ...args: any[]) {
    const now = Date.now();
    pendingArgs = args;

    if (now - lastInvocation >= wait) {
      invoke(this);
      return;
    }

    if (!timeout) {
      timeout = setTimeout(() => invoke(this), wait - (now - lastInvocation));
    }
  } as T;
}

export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 150): T {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function debounced(this: any, ...args: any[]) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      fn.apply(this, args);
    }, wait);
  } as T;
}
