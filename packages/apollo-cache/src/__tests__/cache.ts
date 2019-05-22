import gql from 'graphql-tag';
import { ApolloCache, Cache, DataProxy, Transaction } from '..';
import { FragmentDefinitionNode } from 'graphql';

class TestCache<TSerialized = any> extends ApolloCache<TSerialized> {
  public read<T, TVariables = any>(
    query: Cache.ReadOptions<TVariables>,
  ): T | null {
    throw new Error('Method not implemented.');
  }
  public write<TResult = any, TVariables = any>(
    write: Cache.WriteOptions<TResult, TVariables>,
  ): void {
    throw new Error('Method not implemented.');
  }
  public diff<T>(query: Cache.DiffOptions): DataProxy.DiffResult<T> {
    throw new Error('Method not implemented.');
  }
  public watch(watch: Cache.WatchOptions): () => void {
    throw new Error('Method not implemented.');
  }
  public evict<TVariables = any>(
    query: Cache.EvictOptions<TVariables>,
  ): Cache.EvictionResult {
    throw new Error('Method not implemented.');
  }
  public reset(): Promise<void> {
    throw new Error('Method not implemented.');
  }
  public restore(serializedState: TSerialized): ApolloCache<TSerialized> {
    throw new Error('Method not implemented.');
  }
  public extract(optimistic?: boolean): TSerialized {
    throw new Error('Method not implemented.');
  }
  public removeOptimistic(id: string): void {
    throw new Error('Method not implemented.');
  }
  public performTransaction(transaction: Transaction<any>): void {
    throw new Error('Method not implemented.');
  }
  public recordOptimisticTransaction(
    transaction: Transaction<any>,
    id: string,
  ): void {
    throw new Error('Method not implemented.');
  }
}

describe('abstract cache', () => {
  describe('transformDocument', () => {
    it('returns the document', () => {
      const test = new TestCache();
      expect(test.transformDocument('a' as any)).toBe('a');
    });
  });

  describe('transformForLink', () => {
    it('returns the document', () => {
      const test = new TestCache();
      expect(test.transformForLink('a' as any)).toBe('a');
    });
  });

  describe('readQuery', () => {
    it('runs the read method', () => {
      const test = new TestCache();
      test.read = jest.fn();

      test.readQuery({} as any);
      expect(test.read).toBeCalled();
    });

    it('defaults optimistic to false', () => {
      const test = new TestCache();
      test.read = ({ optimistic }) => optimistic;

      expect(test.readQuery({} as any)).toBe(false);
      expect(test.readQuery({} as any, true)).toBe(true);
    });
  });

  describe('readFragment', () => {
    it('runs the read method', () => {
      const test = new TestCache();
      test.read = jest.fn();
      const fragment = {
        id: 'frag',
        fragment: gql`
          fragment a on b {
            name
          }
        `,
      };

      test.readFragment(fragment);
      expect(test.read).toBeCalled();
    });

    it('defaults optimistic to false', () => {
      const test = new TestCache();
      test.read = ({ optimistic }) => optimistic;
      const fragment = {
        id: 'frag',
        fragment: gql`
          fragment a on b {
            name
          }
        `,
      };

      expect(test.readFragment(fragment)).toBe(false);
      expect(test.readFragment(fragment, true)).toBe(true);
    });
  });

  describe('writeQuery', () => {
    it('runs the write method', () => {
      const test = new TestCache();
      test.write = jest.fn();

      test.writeQuery({} as any);
      expect(test.write).toBeCalled();
    });
  });

  describe('writeFragment', () => {
    it('runs the write method', () => {
      const test = new TestCache();
      test.write = jest.fn();
      const fragment = {
        id: 'frag',
        fragment: gql`
          fragment a on b {
            name
          }
        `,
      };

      test.writeFragment(fragment as any);
      expect(test.write).toBeCalled();
    });
  });

  describe('writeData', () => {
    it('either writes a fragment or a query', () => {
      const test = new TestCache();
      test.read = jest.fn();
      test.writeFragment = jest.fn();
      test.writeQuery = jest.fn();

      test.writeData({} as any);
      expect(test.writeQuery).toBeCalled();

      test.writeData({ id: 1 } as any);
      expect(test.read).toBeCalled();
      expect(test.writeFragment).toBeCalled();

      // Edge case for falsey id
      test.writeData({ id: 0 } as any);
      expect(test.read).toHaveBeenCalledTimes(2);
      expect(test.writeFragment).toHaveBeenCalledTimes(2);
    });

    it('suppresses read errors', () => {
      const test = new TestCache();
      test.read = () => {
        throw new Error();
      };
      test.writeFragment = jest.fn();

      expect(() => test.writeData({ id: 1 } as any)).not.toThrow();
      expect(test.writeFragment).toBeCalled();
    });

    it('reads __typename from typenameResult or defaults to __ClientData', () => {
      const test = new TestCache();
      test.read = () => ({ __typename: 'a' } as any);
      let res;
      test.writeFragment = obj =>
        (res = (obj.fragment.definitions[0] as FragmentDefinitionNode)
          .typeCondition.name.value);

      test.writeData({ id: 1 } as any);
      expect(res).toBe('a');

      test.read = () => ({} as any);

      test.writeData({ id: 1 } as any);
      expect(res).toBe('__ClientData');
    });
  });
});
