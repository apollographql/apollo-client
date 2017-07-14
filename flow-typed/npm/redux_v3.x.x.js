// flow-typed signature: 76c3dfb5a40ce169d5c08fe80dbd029a
// flow-typed version: 37b1c6d953/redux_v3.x.x/flow_>=v0.33.x

declare module 'redux' {

  /*

    S = State
    A = Action

  */

  declare type Dispatch<A: { type: $Subtype<string> }> = (action: A) => A;

  declare type MiddlewareAPI<S, A> = {
    dispatch: Dispatch<A>;
    getState(): S;
  };

  declare type Store<S, A> = {
    // rewrite MiddlewareAPI members in order to get nicer error messages (intersections produce long messages)
    dispatch: Dispatch<A>;
    getState(): S;
    subscribe(listener: () => void): () => void;
    replaceReducer(nextReducer: Reducer<S, A>): void
  };

  declare type Reducer<S, A> = (state: S, action: A) => S;

  declare type CombinedReducer<S, A> = (state: $Shape<S> & {} | void, action: A) => S;

  declare type Middleware<S, A> =
    (api: MiddlewareAPI<S, A>) =>
      (next: Dispatch<A>) => Dispatch<A>;

  declare type StoreCreator<S, A> = {
    (reducer: Reducer<S, A>, enhancer?: StoreEnhancer<S, A>): Store<S, A>;
    (reducer: Reducer<S, A>, preloadedState: S, enhancer?: StoreEnhancer<S, A>): Store<S, A>;
  };

  declare type StoreEnhancer<S, A> = (next: StoreCreator<S, A>) => StoreCreator<S, A>;

  declare function createStore<S, A>(reducer: Reducer<S, A>, enhancer?: StoreEnhancer<S, A>): Store<S, A>;
  declare function createStore<S, A>(reducer: Reducer<S, A>, preloadedState: S, enhancer?: StoreEnhancer<S, A>): Store<S, A>;

  declare function applyMiddleware<S, A>(...middlewares: Array<Middleware<S, A>>): StoreEnhancer<S, A>;

  declare type ActionCreator<A, B> = (...args: Array<B>) => A;
  declare type ActionCreators<K, A> = { [key: K]: ActionCreator<A, any> };

  declare function bindActionCreators<A, C: ActionCreator<A, any>>(actionCreator: C, dispatch: Dispatch<A>): C;
  declare function bindActionCreators<A, K, C: ActionCreators<K, A>>(actionCreators: C, dispatch: Dispatch<A>): C;

  declare function combineReducers<O: Object, A>(reducers: O): CombinedReducer<$ObjMap<O, <S>(r: Reducer<S, any>) => S>, A>;

  declare function compose<A, B>(ab: (a: A) => B): (a: A) => B
  declare function compose<A, B, C>(
    bc: (b: B) => C,
    ab: (a: A) => B
  ): (a: A) => C
  declare function compose<A, B, C, D>(
    cd: (c: C) => D,
    bc: (b: B) => C,
    ab: (a: A) => B
  ): (a: A) => D
  declare function compose<A, B, C, D, E>(
    de: (d: D) => E,
    cd: (c: C) => D,
    bc: (b: B) => C,
    ab: (a: A) => B
  ): (a: A) => E
  declare function compose<A, B, C, D, E, F>(
    ef: (e: E) => F,
    de: (d: D) => E,
    cd: (c: C) => D,
    bc: (b: B) => C,
    ab: (a: A) => B
  ): (a: A) => F
  declare function compose<A, B, C, D, E, F, G>(
    fg: (f: F) => G,
    ef: (e: E) => F,
    de: (d: D) => E,
    cd: (c: C) => D,
    bc: (b: B) => C,
    ab: (a: A) => B
  ): (a: A) => G
  declare function compose<A, B, C, D, E, F, G, H>(
    gh: (g: G) => H,
    fg: (f: F) => G,
    ef: (e: E) => F,
    de: (d: D) => E,
    cd: (c: C) => D,
    bc: (b: B) => C,
    ab: (a: A) => B
  ): (a: A) => H
  declare function compose<A, B, C, D, E, F, G, H, I>(
    hi: (h: H) => I,
    gh: (g: G) => H,
    fg: (f: F) => G,
    ef: (e: E) => F,
    de: (d: D) => E,
    cd: (c: C) => D,
    bc: (b: B) => C,
    ab: (a: A) => B
  ): (a: A) => I

}
