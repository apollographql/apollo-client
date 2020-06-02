import { DataProxy } from './DataProxy';
import { Modifier, Modifiers } from './common';

export namespace Cache {
  export type WatchCallback = (diff: Cache.DiffResult<any>) => void;

  export interface ReadOptions<TVariables = any>
    extends DataProxy.Query<TVariables> {
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
  }

  export interface WriteOptions<TResult = any, TVariables = any>
    extends DataProxy.Query<TVariables> {
    dataId?: string;
    result: TResult;
    broadcast?: boolean;
  }

  export interface DiffOptions extends ReadOptions {
    returnPartialData?: boolean;
  }

  export interface WatchOptions extends ReadOptions {
    immediate?: boolean;
    callback: WatchCallback;
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
  export import WriteQueryOptions = DataProxy.WriteQueryOptions;
  export import WriteFragmentOptions = DataProxy.WriteFragmentOptions;
  export import Fragment = DataProxy.Fragment;
}
