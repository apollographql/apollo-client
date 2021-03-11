import { DataProxy } from './DataProxy';
import { Modifier, Modifiers } from './common';

export namespace Cache {
  export type WatchCallback = (diff: Cache.DiffResult<any>) => void;

  export interface ReadOptions<TVariables = any, TData = any>
    extends DataProxy.Query<TVariables, TData> {
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
    returnPartialData?: boolean;
  }

  export interface WriteOptions<TResult = any, TVariables = any>
    extends Omit<DataProxy.Query<TVariables, TResult>, "id">,
            Omit<DataProxy.WriteOptions<TResult>, "data">
  {
    dataId?: string;
    result: TResult;
  }

  export interface DiffOptions extends ReadOptions {
    // The DiffOptions interface is currently just an alias for
    // ReadOptions, though DiffOptions used to be responsible for
    // declaring the returnPartialData option.
  }

  export interface WatchOptions<
    Watcher extends object = Record<string, any>
  > extends ReadOptions {
    watcher?: Watcher;
    immediate?: boolean;
    callback: WatchCallback;
    lastDiff?: DiffResult<any>;
  }

  export interface EvictOptions {
    id?: string;
    fieldName?: string;
    args?: Record<string, any>;
    broadcast?: boolean;
  }

  export interface ModifyOptions {
    id?: string;
    fields: Modifiers | Modifier<any>;
    optimistic?: boolean;
    broadcast?: boolean;
  }

  export import DiffResult = DataProxy.DiffResult;
  export import ReadQueryOptions = DataProxy.ReadQueryOptions;
  export import ReadFragmentOptions = DataProxy.ReadFragmentOptions;
  export import WriteQueryOptions = DataProxy.WriteQueryOptions;
  export import WriteFragmentOptions = DataProxy.WriteFragmentOptions;
  export import Fragment = DataProxy.Fragment;
}
