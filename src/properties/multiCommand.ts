import type CommandStack from 'diagram-js/lib/command/CommandStack';

import type { CommandDescriptor } from './merge';

const FALLBACK_HANDLER = 'flowable.multi-command-executor';
const PANEL_HANDLER = 'properties-panel.multi-command-executor';

interface MultiCommandContext {
  commands: CommandDescriptor[];
}

class MultiCommandHandler {
  static $inject = ['commandStack'];

  private readonly commandStack: CommandStack;

  constructor(commandStack: CommandStack) {
    this.commandStack = commandStack;
  }

  preExecute(context: MultiCommandContext) {
    const { commands } = context;

    for (const descriptor of commands) {
      this.commandStack.execute(descriptor.cmd, descriptor.context);
    }
  }

  execute() {}
}

export function executeMulti(commandStack: CommandStack, commands: CommandDescriptor[]) {
  if (!commands.length) return;

  const handler = hasPanelMulti(commandStack) ? PANEL_HANDLER : FALLBACK_HANDLER;

  if (handler === FALLBACK_HANDLER) {
    ensureFallback(commandStack);
  }

  commandStack.execute(handler, { commands } as MultiCommandContext);
}

function ensureFallback(commandStack: CommandStack) {
  const markerKey = '__flowableMultiCommandRegistered';
  const anyStack = commandStack as unknown as Record<string, unknown>;
  if (anyStack[markerKey]) {
    return;
  }

  commandStack.registerHandler(FALLBACK_HANDLER, MultiCommandHandler as any);
  anyStack[markerKey] = true;
}

function hasPanelMulti(commandStack: CommandStack): boolean {
  // @ts-expect-error inspect internals – safe for feature detection
  const handlers = commandStack._handlers as Record<string, unknown> | undefined;
  return !!(handlers && handlers[PANEL_HANDLER]);
}
