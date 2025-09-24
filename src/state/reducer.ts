import { Action, AppState, TabState } from './types';

export const initialState: AppState = {
  activeTabId: undefined,
  tabs: {}
};

export function reducer(state: AppState = initialState, action: Action): AppState {
  switch (action.type) {
    case 'TAB/OPENED': {
      const tab = action.tab;
      const tabs: Record<string, TabState> = {
        ...state.tabs,
        [tab.id]: { ...tab }
      };
      return {
        ...state,
        tabs,
        activeTabId: tab.id
      };
    }
    case 'TAB/ACTIVATED':
      return { ...state, activeTabId: action.id };
    case 'TAB/DEACTIVATED':
      return { ...state, activeTabId: undefined };
    case 'TAB/CLOSED': {
      if (!state.tabs[action.id]) return state;
      const { [action.id]: _removed, ...rest } = state.tabs;
      const remainingIds = Object.keys(rest);
      const activeTabId = state.activeTabId === action.id
        ? remainingIds[0]
        : state.activeTabId;
      return {
        ...state,
        tabs: rest,
        activeTabId
      };
    }
    case 'EDITOR/SELECTION_CHANGED': {
      const current = state.tabs[action.id];
      if (!current) return state;
      const updated: TabState = {
        ...current,
        selectionId: action.selectionId
      };
      return {
        ...state,
        tabs: { ...state.tabs, [action.id]: updated }
      };
    }
    case 'EDITOR/MODEL_CHANGED': {
      const current = state.tabs[action.id];
      if (!current) return state;
      const updated: TabState = {
        ...current,
        dirty: true,
        modelVersion: current.modelVersion + 1
      };
      return {
        ...state,
        tabs: { ...state.tabs, [action.id]: updated }
      };
    }
    case 'EDITOR/DIRTY_SET': {
      const current = state.tabs[action.id];
      if (!current || current.dirty === action.dirty) return state;
      const updated: TabState = {
        ...current,
        dirty: action.dirty
      };
      return {
        ...state,
        tabs: { ...state.tabs, [action.id]: updated }
      };
    }
    default:
      return state;
  }
}
