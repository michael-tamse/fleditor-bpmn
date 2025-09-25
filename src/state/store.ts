export type Unsubscribe = () => void;

type Listener = () => void;

export interface Store<S, A> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: Listener): Unsubscribe;
}

export function createStore<S, A>(initial: S, reducer: (state: S, action: A) => S): Store<S, A> {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    getState: () => state,
    dispatch: (action: A) => {
      state = reducer(state, action);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: Listener): Unsubscribe => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
