import { expectTypeOf } from "expect-type";

import type {
  DataValue,
  Reference,
  StoreObject,
  TypedDocumentNode,
} from "@apollo/client";
import { ApolloClient, ApolloLink, InMemoryCache } from "@apollo/client";
import type { MissingTree } from "@apollo/client/cache";

describe.skip("type tests", () => {
  interface Item {
    __typename: "Item";
    id: number;
    text: string;
  }

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  let fragment!: TypedDocumentNode<Item, Record<string, never>>;

  test("from: null -> null", () => {
    const observable = client.watchFragment({ fragment, from: null });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<null>
    >();
    expectTypeOf(result).toEqualTypeOf<{
      data: null;
      dataState: "complete";
      complete: true;
      missing?: never;
    }>();
  });

  test("from: StoreObject -> TData", () => {
    const observable = client.watchFragment({
      fragment,
      from: { __typename: "Item", id: 1 },
    });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Item>
    >();
    expectTypeOf(result).toEqualTypeOf<
      | {
          data: Item;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: DataValue.Partial<Item>;
          dataState: "partial";
          complete: false;
          missing?: MissingTree;
        }
    >();
  });

  test("from: string -> TData", () => {
    const observable = client.watchFragment({ fragment, from: "Item:1" });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Item>
    >();
    expectTypeOf(result).toEqualTypeOf<
      | {
          data: Item;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: DataValue.Partial<Item>;
          dataState: "partial";
          complete: false;
          missing?: MissingTree;
        }
    >();
  });

  test("from: Reference -> TData", () => {
    const observable = client.watchFragment({
      fragment,
      from: { __ref: "Item:1" },
    });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Item>
    >();
    expectTypeOf(result).toEqualTypeOf<
      | {
          data: Item;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: DataValue.Partial<Item>;
          dataState: "partial";
          complete: false;
          missing?: MissingTree;
        }
    >();
  });

  test("from: StoreObject | null -> TData | null", () => {
    const observable = client.watchFragment({
      fragment,
      from: { __typename: "Item", id: 1 } as StoreObject | null,
    });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Item | null>
    >();
    expectTypeOf(result).toEqualTypeOf<
      | {
          data: null;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: Item;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: DataValue.Partial<Item>;
          dataState: "partial";
          complete: false;
          missing?: MissingTree;
        }
    >();
  });

  test("from: string | null -> TData | null", () => {
    const observable = client.watchFragment({
      fragment,
      from: "Item:1" as string | null,
    });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Item | null>
    >();
    expectTypeOf(result).toEqualTypeOf<
      | {
          data: null;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: Item;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: DataValue.Partial<Item>;
          dataState: "partial";
          complete: false;
          missing?: MissingTree;
        }
    >();
  });

  test("from: Reference | null -> TData | null", () => {
    const observable = client.watchFragment({
      fragment,
      from: { __ref: "Item:1" } as Reference | null,
    });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Item | null>
    >();
    expectTypeOf(result).toEqualTypeOf<
      | {
          data: null;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: Item;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: DataValue.Partial<Item>;
          dataState: "partial";
          complete: false;
          missing?: MissingTree;
        }
    >();
  });

  test("from: Array<null> -> Array<null>", () => {
    const observable = client.watchFragment({
      fragment,
      from: [null],
    });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Array<null>>
    >();
    expectTypeOf(result).toEqualTypeOf<{
      data: Array<null>;
      dataState: "complete";
      complete: true;
      missing?: never;
    }>();
  });

  test("from: Array<FromValue> -> Array<TData>", () => {
    const observable = client.watchFragment({
      fragment,
      from: [{ __typename: "Item", id: 1 }, "Item:1", { __ref: "Item:1" }],
    });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Array<Item>>
    >();
    expectTypeOf(result).toEqualTypeOf<
      | {
          data: Array<Item>;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: Array<DataValue.Partial<Item> | null>;
          dataState: "partial";
          complete: false;
          missing?: MissingTree;
        }
    >();
  });

  test("from: Array<FromValue | null> -> Array<TData | null>", () => {
    const observable = client.watchFragment({
      fragment,
      from: [{ __typename: "Item", id: 1 }, null],
    });
    const result = observable.getCurrentResult();

    expectTypeOf(observable).toEqualTypeOf<
      ApolloClient.ObservableFragment<Array<Item | null>>
    >();
    expectTypeOf(result).toEqualTypeOf<
      | {
          data: Array<Item | null>;
          dataState: "complete";
          complete: true;
          missing?: never;
        }
      | {
          data: Array<DataValue.Partial<Item> | null>;
          dataState: "partial";
          complete: false;
          missing?: MissingTree;
        }
    >();
  });
});
