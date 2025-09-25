import { AppState, TabState } from './types';

export const selectActiveTab = (state: AppState): TabState | undefined => {
  const id = state.activeTabId;
  return id ? state.tabs[id] : undefined;
};

export const selectTabById = (id: string) => (state: AppState): TabState | undefined => {
  return state.tabs[id];
};

export const selectDirtyTabs = (state: AppState): TabState[] => {
  return Object.values(state.tabs).filter((tab) => tab.dirty);
};

export const selectTabs = (state: AppState): TabState[] => Object.values(state.tabs);
