import { DocumentNode } from 'graphql';
import {
  DataProxy,
  DataProxyReadQueryOptions,
  DataProxyReadFragmentOptions,
  DataProxyWriteQueryOptions,
  DataProxyWriteFragmentOptions,
} from './proxy';
import { addTypenameToDocument } from '../queries/queryTransform';
import {
  getFragmentQueryDocument,
  getOperationName,
} from '../queries/getFromAST';

export type CacheWrite = {
  dataId: string;
  result: any;
  document: DocumentNode;
  variables?: Object;
};

export abstract class Cache implements DataProxy {
  private addTypename: boolean;
  constructor(addTypename: boolean) {
    this.addTypename = addTypename;
  }

  public abstract reset(): Promise<void>;

  public abstract diffQuery(query: {
    query: DocumentNode;
    variables: any;
    returnPartialData?: boolean;
    previousResult?: any;
    optimistic: boolean;
  }): any;

  public abstract read(query: {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
    optimistic: boolean;
  }): any;

  public readQuery<QueryType>(
    options: DataProxyReadQueryOptions,
    optimistic: boolean = false,
  ): QueryType {
    let query = options.query;
    if (this.addTypename) {
      query = addTypenameToDocument(query);
    }

    return this.read({
      query,
      variables: options.variables,
      optimistic,
    });
  }

  public readFragment<FragmentType>(
    options: DataProxyReadFragmentOptions,
    optimistic: boolean = false,
  ): FragmentType | null {
    let document = getFragmentQueryDocument(
      options.fragment,
      options.fragmentName,
    );
    if (this.addTypename) {
      document = addTypenameToDocument(document);
    }

    return this.read({
      query: document,
      variables: options.variables,
      rootId: options.id,
      optimistic,
    });
  }

  public abstract writeResult(write: CacheWrite): void;

  public writeQuery(options: DataProxyWriteQueryOptions): void {
    let query = options.query;
    if (this.addTypename) {
      query = addTypenameToDocument(query);
    }

    this.writeResult({
      dataId: 'ROOT_QUERY',
      result: options.data,
      document: query,
      variables: options.variables,
    });
  }

  public writeFragment(options: DataProxyWriteFragmentOptions): void {
    let document = getFragmentQueryDocument(
      options.fragment,
      options.fragmentName,
    );
    if (this.addTypename) {
      document = addTypenameToDocument(document);
    }

    this.writeResult({
      dataId: options.id,
      result: options.data,
      document,
      variables: options.variables,
    });
  }

  public abstract removeOptimistic(id: string): void;

  public abstract performTransaction(transaction: (c: Cache) => void): void;
  public abstract recordOptimisticTransaction(
    transaction: (c: Cache) => void,
    id: string,
  ): void;
}
