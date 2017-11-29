import { DataProxy } from './DataProxy';

export namespace Cache {
  export type WatchCallback = (newData: any) => void;
  export interface EvictionResult {
    success: Boolean;
  }

  export interface ReadOptions extends DataProxy.Query {
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
  }

  export interface WriteOptions extends DataProxy.Query {
    dataId: string;
    result: any;
  }

  export interface DiffOptions extends ReadOptions {
    returnPartialData?: boolean;
  }

  export interface WatchOptions extends ReadOptions {
    callback: WatchCallback;
  }

  export interface EvictOptions extends DataProxy.Query {
    rootId?: string;
  }

  export import DiffResult = DataProxy.DiffResult;
  export import WriteQueryOptions = DataProxy.WriteQueryOptions;
  export import WriteFragmentOptions = DataProxy.WriteFragmentOptions;
  export import Fragment = DataProxy.Fragment;
}
