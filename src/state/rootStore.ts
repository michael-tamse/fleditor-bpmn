import { createStore } from './store';
import { initialState, reducer } from './reducer';
import type { Action, AppState } from './types';
import { attachEffects } from '../effects/effects';

export const store = createStore<AppState, Action>(initialState, reducer);

attachEffects(store);
