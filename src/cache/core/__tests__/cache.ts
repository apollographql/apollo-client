import gql from "graphql-tag";
import { ApolloCache } from "../cache";
import { Cache, DataProxy } from "../..";
import { Reference } from "../../../utilities/graphql/storeUtils";
import { expectTypeOf } from "expect-type";
class TestCache extends ApolloCache<unknown> {
  constructor() {
    super();
  }

  public diff<T>(query: Cache.DiffOptions): DataProxy.DiffResult<T> {
    return {};
  }

  public evict(): boolean {
    return false;
  }

  public extract(optimistic?: boolean): unknown {
    return undefined;
  }

  public performTransaction(
    transaction: <TSerialized>(c: ApolloCache<TSerialized>) => void
  ): void {
    transaction(this);
  }

  public read<T, TVariables = any>(
    query: Cache.ReadOptions<TVariables>
  ): T | null {
    return null;
  }

  public recordOptimisticTransaction(
    transaction: <TSerialized>(c: ApolloCache<TSerialized>) => void,
    id: string
  ): void {}

  public removeOptimistic(id: string): void {}

  public reset(): Promise<void> {
    return new Promise<void>(() => null);
  }

  public restore(serializedState: unknown): ApolloCache<unknown> {
    return this;
  }

  public watch(watch: Cache.WatchOptions): () => void {
    return function () {};
  }

  public write<TResult = any, TVariables = any>(
    _: Cache.WriteOptions<TResult, TVariables>
  ): Reference | undefined {
    return;
  }
}
const query = gql`
  {
    a
  }
`;
describe("abstract cache", () => {
  describe("transformDocument", () => {
    it("returns the document", () => {
      const test = new TestCache();
      expect(test.transformDocument(query)).toBe(query);
    });
  });

  describe("transformForLink", () => {
    it("returns the document", () => {
      const test = new TestCache();
      expect(test.transformForLink(query)).toBe(query);
    });
  });

  describe("readQuery", () => {
    it("runs the read method", () => {
      const test = new TestCache();
      test.read = jest.fn();

      test.readQuery({ query });
      expect(test.read).toBeCalled();
    });

    it("defaults optimistic to false", () => {
      const test = new TestCache();
      test.read = ({ optimistic }) => optimistic as any;

      expect(test.readQuery({ query })).toBe(false);
      expect(test.readQuery({ query }, true)).toBe(true);
    });
  });

  describe("readFragment", () => {
    it("runs the read method", () => {
      const test = new TestCache();
      test.read = jest.fn();
      const fragment = {
        id: "frag",
        fragment: gql`
          fragment a on b {
            name
          }
        `,
      };

      test.readFragment(fragment);
      expect(test.read).toBeCalled();
    });

    it("defaults optimistic to false", () => {
      const test = new TestCache();
      test.read = ({ optimistic }) => optimistic as any;
      const fragment = {
        id: "frag",
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

  describe("writeQuery", () => {
    it("runs the write method", () => {
      const test = new TestCache();
      test.write = jest.fn();

      test.writeQuery({
        query: query,
        data: "foo",
      });
      expect(test.write).toBeCalled();
    });
  });

  describe("writeFragment", () => {
    it("runs the write method", () => {
      const test = new TestCache();
      test.write = jest.fn();
      const fragment = {
        id: "frag",
        fragment: gql`
          fragment a on b {
            name
          }
        `,
        data: "foo",
      };

      test.writeFragment(fragment);
      expect(test.write).toBeCalled();
    });
  });

  describe("updateQuery", () => {
    it("runs the readQuery & writeQuery methods", () => {
      const test = new TestCache();
      test.readQuery = jest.fn();
      test.writeQuery = jest.fn();

      test.updateQuery({ query }, (data) => "foo");

      expect(test.readQuery).toBeCalled();
      expect(test.writeQuery).toBeCalled();
    });

    it("does not call writeQuery method if data is null", () => {
      const test = new TestCache();
      test.readQuery = jest.fn();
      test.writeQuery = jest.fn();

      test.updateQuery({ query }, (data) => null);

      expect(test.readQuery).toBeCalled();
      expect(test.writeQuery).not.toBeCalled();
    });

    it("does not call writeQuery method if data is undefined", () => {
      const test = new TestCache();
      test.readQuery = jest.fn();
      test.writeQuery = jest.fn();

      test.updateQuery({ query }, (data) => {
        return;
      });

      expect(test.readQuery).toBeCalled();
      expect(test.writeQuery).not.toBeCalled();
    });

    it("calls the readQuery & writeQuery methods with the options object", () => {
      const test = new TestCache();
      const options: Cache.UpdateQueryOptions<string, any> = {
        query,
        broadcast: true,
        variables: { test: 1 },
        optimistic: true,
        returnPartialData: true,
      };
      test.readQuery = jest.fn();
      test.writeQuery = jest.fn();

      test.updateQuery(options, (data) => "foo");

      expect(test.readQuery).toBeCalledWith(expect.objectContaining(options));

      expect(test.writeQuery).toBeCalledWith(
        expect.objectContaining({ ...options, data: "foo" })
      );
    });

    it("returns current value in memory if no update was made", () => {
      const test = new TestCache();
      test.readQuery = jest.fn().mockReturnValue("foo");
      expect(test.updateQuery({ query }, (data) => null)).toBe("foo");
    });

    it("returns the updated value in memory if an update was made", () => {
      const test = new TestCache();
      let currentValue = "foo";
      test.readQuery = jest.fn().mockImplementation(() => currentValue);
      test.writeQuery = jest
        .fn()
        .mockImplementation(({ data }) => (currentValue = data));
      expect(test.updateQuery({ query }, (data) => "bar")).toBe("bar");
    });

    it("calls update function with the current value in memory", () => {
      const test = new TestCache();
      test.readQuery = jest.fn().mockReturnValue("foo");
      test.updateQuery({ query }, (data) => {
        expect(data).toBe("foo");
      });
    });
  });

  describe("updateFragment", () => {
    const fragmentId = "frag";
    const fragment = gql`
      fragment a on b {
        name
      }
    `;

    it("runs the readFragment & writeFragment methods", () => {
      const test = new TestCache();
      test.readFragment = jest.fn();
      test.writeFragment = jest.fn();

      test.updateFragment({ id: fragmentId, fragment }, (data) => "foo");

      expect(test.readFragment).toBeCalled();
      expect(test.writeFragment).toBeCalled();
    });

    it("does not call writeFragment method if data is null", () => {
      const test = new TestCache();
      test.readFragment = jest.fn();
      test.writeFragment = jest.fn();

      test.updateFragment({ id: fragmentId, fragment }, (data) => null);

      expect(test.readFragment).toBeCalled();
      expect(test.writeFragment).not.toBeCalled();
    });

    it("does not call writeFragment method if data is undefined", () => {
      const test = new TestCache();
      test.readFragment = jest.fn();
      test.writeFragment = jest.fn();

      test.updateFragment({ id: fragmentId, fragment }, (data) => {
        return;
      });

      expect(test.readFragment).toBeCalled();
      expect(test.writeFragment).not.toBeCalled();
    });

    it("calls the readFragment & writeFragment methods with the options object", () => {
      const test = new TestCache();
      const options: Cache.UpdateFragmentOptions<string, any> = {
        id: fragmentId,
        fragment,
        fragmentName: "a",
        broadcast: true,
        variables: { test: 1 },
        optimistic: true,
        returnPartialData: true,
      };
      test.readFragment = jest.fn();
      test.writeFragment = jest.fn();

      test.updateFragment(options, (data) => "foo");

      expect(test.readFragment).toBeCalledWith(
        expect.objectContaining(options)
      );

      expect(test.writeFragment).toBeCalledWith(
        expect.objectContaining({ ...options, data: "foo" })
      );
    });

    it("returns current value in memory if no update was made", () => {
      const test = new TestCache();
      test.readFragment = jest.fn().mockReturnValue("foo");
      expect(
        test.updateFragment({ id: fragmentId, fragment }, (data) => {
          return;
        })
      ).toBe("foo");
    });

    it("returns the updated value in memory if an update was made", () => {
      const test = new TestCache();
      let currentValue = "foo";
      test.readFragment = jest.fn().mockImplementation(() => currentValue);
      test.writeFragment = jest
        .fn()
        .mockImplementation(({ data }) => (currentValue = data));
      expect(
        test.updateFragment({ id: fragmentId, fragment }, (data) => "bar")
      ).toBe("bar");
    });

    it("calls update function with the current value in memory", () => {
      const test = new TestCache();
      test.readFragment = jest.fn().mockReturnValue("foo");
      test.updateFragment({ id: fragmentId, fragment }, (data) => {
        expect(data).toBe("foo");
      });
    });
  });
});

describe.skip("Cache type tests", () => {
  describe("modify", () => {
    test("field types are inferred correctly from passed entity type", () => {
      const cache = new TestCache();
      cache.modify<{
        prop1: string;
        prop2: number;
        child: {
          someObject: true;
        };
        children: {
          anotherObject: false;
        }[];
      }>({
        fields: {
          prop1(field) {
            expectTypeOf(field).toEqualTypeOf<string>();
            return field;
          },
          prop2(field) {
            expectTypeOf(field).toEqualTypeOf<number>();
            return field;
          },
          child(field) {
            expectTypeOf(field).toEqualTypeOf<
              { someObject: true } | Reference
            >();
            return field;
          },
          children(field) {
            expectTypeOf(field).toEqualTypeOf<
              ReadonlyArray<{ anotherObject: false } | Reference>
            >();
            return field;
          },
        },
      });
    });
    test("field method needs to return a value of the correct type", () => {
      const cache = new TestCache();
      cache.modify<{
        p1: string;
        p2: string;
        p3: string;
        p4: string;
        p5: string;
      }>({
        fields: {
          p1() {
            return "";
          },
          // @ts-expect-error returns wrong type
          p2() {
            return 1;
          },
          // @ts-expect-error needs return statement
          p3() {},
          p4(_, { DELETE }) {
            return DELETE;
          },
          p5(_, { INVALIDATE }) {
            return INVALIDATE;
          },
        },
      });
    });
    test("passing a function as `field` should infer all entity properties as possible input (interfaces)", () => {
      interface ParentEntity {
        prop1: string;
        prop2: number;
        child: ChildEntity;
      }
      interface ChildEntity {
        prop1: boolean;
        prop2: symbol;
        children: OtherChildEntry[];
      }
      interface OtherChildEntry {
        foo: false;
      }

      const cache = new TestCache();
      // with reference
      cache.modify<ParentEntity>({
        id: "foo",
        fields(field) {
          expectTypeOf(field).toEqualTypeOf<
            string | number | ChildEntity | Reference
          >();
          return field;
        },
      });
      // without reference
      cache.modify<ChildEntity>({
        id: "foo",
        fields(field) {
          expectTypeOf(field).toEqualTypeOf<
            boolean | symbol | ReadonlyArray<OtherChildEntry | Reference>
          >();
          return field;
        },
      });
    });
    test("passing a function as `field` should infer all entity properties as possible input (types)", () => {
      type ParentEntity = {
        prop1: string;
        prop2: number;
        child: ChildEntity;
      };
      type ChildEntity = {
        prop1: boolean;
        prop2: symbol;
        children: OtherChildEntry[];
      };
      type OtherChildEntry = {
        foo: false;
      };

      const cache = new TestCache();
      // with reference
      cache.modify<ParentEntity>({
        id: "foo",
        fields(field) {
          expectTypeOf(field).toEqualTypeOf<
            string | number | ChildEntity | Reference
          >();
          return field;
        },
      });
      // without reference
      cache.modify<ChildEntity>({
        id: "foo",
        fields(field) {
          expectTypeOf(field).toEqualTypeOf<
            boolean | symbol | ReadonlyArray<OtherChildEntry | Reference>
          >();
          return field;
        },
      });
    });
    test("passing a function as `field` w/o specifying an entity type", () => {
      const cache = new TestCache();
      cache.modify({
        id: "foo",
        fields(field) {
          expectTypeOf(field).toEqualTypeOf<any>();
          return field;
        },
      });
    });
    test("passing a function as `field` property w/o specifying an entity type", () => {
      const cache = new TestCache();
      cache.modify({
        id: "foo",
        fields: {
          p1(field) {
            expectTypeOf(field).toEqualTypeOf<any>();
            return field;
          },
        },
      });
    });

    test("allows undefined as return value", () => {
      const cache = new TestCache();
      cache.modify<{ foo: string }>({
        id: "foo",
        fields: {
          foo: () => undefined,
          // @ts-expect-error needs return statement
          bar: () => {},
        },
      });
    });

    test("Allow for mixed arrays on union fields", () => {
      const cache = new TestCache();
      cache.modify<{
        union: Array<
          | { __typename: "Type1"; a: string }
          | { __typename: "Type2"; b: string }
        >;
      }>({
        fields: {
          union(field) {
            expectTypeOf(field).toEqualTypeOf<
              ReadonlyArray<
                | Reference
                | { __typename: "Type1"; a: string }
                | { __typename: "Type2"; b: string }
              >
            >();
            return field;
          },
        },
      });
    });

    test("Allows partial return data", () => {
      const cache = new TestCache();
      cache.modify<{
        union: Array<
          | { __typename: "Type1"; a: string; c: { foo: string } }
          | { __typename: "Type2"; b: string; d: { bar: number } }
        >;
      }>({
        fields: {
          union(field) {
            expectTypeOf(field).toEqualTypeOf<
              ReadonlyArray<
                | Reference
                | {
                    __typename: "Type1";
                    a: string;
                    c: { foo: string };
                  }
                | {
                    __typename: "Type2";
                    b: string;
                    d: { bar: number };
                  }
              >
            >();
            return [{ __typename: "Type1", a: "foo" }];
          },
        },
      });
    });
  });
});
