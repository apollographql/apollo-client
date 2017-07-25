import { DocumentNode } from 'graphql';

export type CacheWrite = {
  dataId: string;
  result: any;
  document: DocumentNode;
  variables?: Object;
};

export abstract class Cache {
  public abstract reset(): Promise<void>;

  public abstract diffQuery(query: {
    query: DocumentNode;
    variables: any;
    returnPartialData?: boolean;
    previousResult?: any;
  }): any;

  public abstract diffQueryOptimistic(query: {
    query: DocumentNode;
    variables: any;
    returnPartialData?: boolean;
    previousResult?: any;
  }): any;

  public abstract readQuery(query: {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
  }): any;

  public abstract readQueryOptimistic(query: {
    query: DocumentNode;
    variables: any;
    rootId?: string;
    previousResult?: any;
  }): any;

  public abstract writeResult(write: CacheWrite): void;

  public abstract removeOptimistic(id: string): void;

  public abstract performTransaction(transaction: (c: Cache) => void): void;
  public abstract performOptimisticTransaction(
    transaction: (c: Cache) => void,
    id: string,
  ): void;
}
