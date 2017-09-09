import { DocumentNode } from 'graphql'; // eslint-disable-line import/no-extraneous-dependencies, import/no-unresolved

import { DataProxy } from './DataProxy';

export namespace Cache {
  export interface DiffQueryOptions {
    query: DocumentNode;
    variables: any;
    returnPartialData?: boolean;
    previousResult?: any;
    optimistic: boolean;
  }

  export import DiffResult = DataProxy.DiffResult;

  export interface ReadOptions {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
  }

  export import ReadQueryOptions = DataProxy.ReadQueryOptions;

  export import ReadFragmentOptions = DataProxy.ReadFragmentOptions;

  export interface WriteResult {
    dataId: string;
    result: any;
    document: DocumentNode;
    variables?: Object;
  }

  export import WriteQueryOptions = DataProxy.WriteQueryOptions;

  export import WriteFragmentOptions = DataProxy.WriteFragmentOptions;

  export interface WatchOptions {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
    callback: (newData: any) => void;
  }
}
