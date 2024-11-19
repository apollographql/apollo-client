/* eslint-disable testing-library/render-result-naming-convention */
import * as React from "react";
import {
  render,
  waitFor,
  screen,
  renderHook,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";

import { UseFragmentOptions, useFragment } from "../useFragment";
import { MockedProvider } from "../../../testing";
import { ApolloProvider } from "../../context";
import {
  InMemoryCache,
  gql,
  TypedDocumentNode,
  Reference,
  ApolloClient,
  Observable,
  ApolloLink,
  StoreObject,
  DocumentNode,
  FetchResult,
} from "../../../core";
import { useQuery } from "../useQuery";
import { concatPagination } from "../../../utilities";
import assert from "assert";
import { expectTypeOf } from "expect-type";
import { SubscriptionObserver } from "zen-observable-ts";
import {
  renderHookToSnapshotStream,
  renderToRenderStream,
} from "@testing-library/react-render-stream";
import { spyOnConsole } from "../../../testing/internal";

describe("useFragment", () => {
  it("is importable and callable", () => {
    expect(typeof useFragment).toBe("function");
  });

  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ListFragment: TypedDocumentNode<QueryDataWithExtra> = gql`
    fragment ListFragment on Query {
      list {
        id
      }
      # Used to make sure ListFragment got used, even if the id field of the
      # nested list items is provided by other means.
      extra
    }
  `;

  const ItemFragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      text
    }
  `;

  interface QueryData {
    list: Item[];
  }

  interface QueryDataWithExtra extends QueryData {
    extra: string;
  }

  it("can rerender individual list elements", async () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Item: {
          fields: {
            text(existing, { readField }) {
              return existing || `Item #${readField("id")}`;
            },
          },
        },
      },
    });

    const listQuery: TypedDocumentNode<QueryData> = gql`
      query {
        list {
          id
        }
      }
    `;

    cache.writeQuery({
      query: listQuery,
      data: {
        list: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
      },
    });

    const renders: string[] = [];

    function List() {
      renders.push("list");
      const { loading, data } = useQuery(listQuery);
      expect(loading).toBe(false);
      return (
        <ol>{data?.list.map((item) => <Item key={item.id} id={item.id} />)}</ol>
      );
    }

    function Item(props: { id: number }) {
      renders.push("item " + props.id);
      const { complete, data } = useFragment({
        fragment: ItemFragment,
        fragmentName: "ItemFragment",
        from: {
          __typename: "Item",
          id: props.id,
        },
      });
      return <li>{complete ? data.text : "incomplete"}</li>;
    }

    render(
      <MockedProvider cache={cache}>
        <List />
      </MockedProvider>
    );

    function getItemTexts() {
      return screen.getAllByText(/^Item/).map(
        // eslint-disable-next-line testing-library/no-node-access
        (li) => li.firstChild!.textContent
      );
    }

    await waitFor(() => {
      expect(getItemTexts()).toEqual(["Item #1", "Item #2", "Item #5"]);
    });

    expect(renders).toEqual(["list", "item 1", "item 2", "item 5"]);

    act(() => {
      cache.writeFragment({
        fragment: ItemFragment,
        data: {
          __typename: "Item",
          id: 2,
          text: "Item #2 updated",
        },
      });
    });

    await waitFor(() => {
      expect(getItemTexts()).toEqual(["Item #1", "Item #2 updated", "Item #5"]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
      // Only the second item should have re-rendered.
      "item 2",
    ]);

    act(() => {
      cache.modify({
        fields: {
          list(list: readonly Reference[], { readField }) {
            return [
              ...list,
              cache.writeFragment({
                fragment: ItemFragment,
                data: {
                  __typename: "Item",
                  id: 3,
                  text: "Item #3 from cache.modify",
                },
              })!,
              cache.writeFragment({
                fragment: ItemFragment,
                data: {
                  __typename: "Item",
                  id: 4,
                  text: "Item #4 from cache.modify",
                },
              })!,
            ].sort(
              (ref1, ref2) =>
                readField<Item["id"]>("id", ref1)! -
                readField<Item["id"]>("id", ref2)!
            );
          },
        },
      });
    });

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2 updated",
        "Item #3 from cache.modify",
        "Item #4 from cache.modify",
        "Item #5",
      ]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
      "item 2",
      // This is what's new:
      "list",
      "item 1",
      "item 2",
      "item 3",
      "item 4",
      "item 5",
    ]);

    act(() => {
      cache.writeFragment({
        fragment: ItemFragment,
        data: {
          __typename: "Item",
          id: 4,
          text: "Item #4 updated",
        },
      });
    });

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2 updated",
        "Item #3 from cache.modify",
        "Item #4 updated",
        "Item #5",
      ]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
      "item 2",
      "list",
      "item 1",
      "item 2",
      "item 3",
      "item 4",
      "item 5",
      // Only the fourth item should have re-rendered.
      "item 4",
    ]);

    // set Item #2 back to its original value
    act(() => {
      cache.writeFragment({
        fragment: ItemFragment,
        data: {
          __typename: "Item",
          id: 2,
          text: "Item #2",
        },
      });
    });

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2",
        "Item #3 from cache.modify",
        "Item #4 updated",
        "Item #5",
      ]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
      "item 2",
      "list",
      "item 1",
      "item 2",
      "item 3",
      "item 4",
      "item 5",
      "item 4",
      // Only the second item should have re-rendered.
      "item 2",
    ]);

    expect(cache.extract()).toEqual({
      "Item:1": {
        __typename: "Item",
        id: 1,
      },
      "Item:2": {
        __typename: "Item",
        id: 2,
        text: "Item #2",
      },
      "Item:3": {
        __typename: "Item",
        id: 3,
        text: "Item #3 from cache.modify",
      },
      "Item:4": {
        __typename: "Item",
        id: 4,
        text: "Item #4 updated",
      },
      "Item:5": {
        __typename: "Item",
        id: 5,
      },
      ROOT_QUERY: {
        __typename: "Query",
        list: [
          { __ref: "Item:1" },
          { __ref: "Item:2" },
          { __ref: "Item:3" },
          { __ref: "Item:4" },
          { __ref: "Item:5" },
        ],
      },
      __META: {
        extraRootIds: ["Item:2", "Item:3", "Item:4"],
      },
    });
  });

  it("returns data on first render", () => {
    const ItemFragment: TypedDocumentNode<Item> = gql`
      fragment ItemFragment on Item {
        id
        text
      }
    `;
    const cache = new InMemoryCache();
    const item = { __typename: "Item", id: 1, text: "Item #1" };
    cache.writeFragment({
      fragment: ItemFragment,
      data: item,
    });
    const client = new ApolloClient({
      cache,
    });
    function Component() {
      const { data } = useFragment({
        fragment: ItemFragment,
        from: { __typename: "Item", id: 1 },
      });
      return <>{data.text}</>;
    }
    render(
      <ApolloProvider client={client}>
        <Component />
      </ApolloProvider>
    );

    // would throw if not present synchronously
    screen.getByText(/Item #1/);
  });

  it("allows the client to be overriden", () => {
    const ItemFragment: TypedDocumentNode<Item> = gql`
      fragment ItemFragment on Item {
        id
        text
      }
    `;
    const cache = new InMemoryCache();
    const item = { __typename: "Item", id: 1, text: "Item #1" };
    cache.writeFragment({
      fragment: ItemFragment,
      data: item,
    });
    const client = new ApolloClient({
      cache,
    });
    function Component() {
      const { data } = useFragment({
        fragment: ItemFragment,
        from: { __typename: "Item", id: 1 },
        client,
      });
      return <>{data.text}</>;
    }

    // Without a MockedProvider supplying the client via context,
    // the client must be passed directly to the hook or an error is thrown
    expect(() => render(<Component />)).not.toThrow(/pass an ApolloClient/);

    // Item #1 is rendered
    screen.getByText(/Item #1/);
  });

  it("throws if no client is provided", () => {
    function Component() {
      const { data } = useFragment({
        fragment: ItemFragment,
        from: { __typename: "Item", id: 1 },
      });
      return <>{data.text}</>;
    }

    // silence the console error
    {
      using _spy = spyOnConsole("error");
      expect(() => render(<Component />)).toThrow(/pass an ApolloClient/);
    }
  });

  it.each<TypedDocumentNode<{ list: Item[] }>>([
    // This query uses a basic field-level @nonreactive directive.
    gql`
      query GetItems {
        list {
          id
          text @nonreactive
        }
      }
    `,
    // This query uses @nonreactive on an anonymous/inline ...spread directive.
    gql`
      query GetItems {
        list {
          id
          ... @nonreactive {
            text
          }
        }
      }
    `,
    // This query uses @nonreactive on a ...spread with a type condition.
    gql`
      query GetItems {
        list {
          id
          ... on Item @nonreactive {
            text
          }
        }
      }
    `,
    // This query uses @nonreactive directive on a named fragment ...spread.
    gql`
      query GetItems {
        list {
          id
          ...ItemText @nonreactive
        }
      }
      fragment ItemText on Item {
        text
      }
    `,
  ])(
    "Parent list component can use @nonreactive to avoid rerendering",
    async (query) => {
      const cache = new InMemoryCache({
        typePolicies: {
          Query: {
            fields: {
              list: concatPagination(),
            },
          },
          Item: {
            keyFields: ["id"],
            // Configuring keyArgs:false for Item.text is one way to prevent field
            // keys like text@nonreactive, but it's not the only way. Since
            // @nonreactive is now in the KNOWN_DIRECTIVES array defined in
            // utilities/graphql/storeUtils.ts, the '@nonreactive' suffix won't be
            // automatically appended to field keys by default.
            // fields: {
            //   text: {
            //     keyArgs: false,
            //   },
            // },
          },
        },
      });

      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      const renders: string[] = [];

      function List() {
        const { data } = useQuery(query);

        renders.push("list");

        return (
          <ul>
            {data?.list.map((item) => <Item key={item.id} item={item} />)}
          </ul>
        );
      }

      function Item({ item }: { item: Item }) {
        const { data } = useFragment({
          fragment: ItemFragment,
          fragmentName: "ItemFragment",
          from: item,
        });

        renders.push(`item ${item.id}`);

        if (!data) return null;

        return <li>{`Item #${item.id}: ${data.text}`}</li>;
      }

      act(() => {
        cache.writeQuery({
          query,
          data: {
            list: [
              { __typename: "Item", id: 1, text: "first" },
              { __typename: "Item", id: 2, text: "second" },
              { __typename: "Item", id: 3, text: "third" },
            ],
          },
        });
      });

      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          list: [
            { __ref: 'Item:{"id":1}' },
            { __ref: 'Item:{"id":2}' },
            { __ref: 'Item:{"id":3}' },
          ],
        },
        'Item:{"id":1}': {
          __typename: "Item",
          id: 1,
          text: "first",
        },
        'Item:{"id":2}': {
          __typename: "Item",
          id: 2,
          text: "second",
        },
        'Item:{"id":3}': {
          __typename: "Item",
          id: 3,
          text: "third",
        },
      });

      render(
        <ApolloProvider client={client}>
          <List />
        </ApolloProvider>
      );

      function getItemTexts() {
        return screen.getAllByText(/Item #\d+/).map((el) => el.textContent);
      }

      await waitFor(() => {
        expect(getItemTexts()).toEqual([
          "Item #1: first",
          "Item #2: second",
          "Item #3: third",
        ]);
      });

      expect(renders).toEqual(["list", "item 1", "item 2", "item 3"]);

      function appendLyToText(id: number) {
        act(() => {
          cache.modify({
            id: cache.identify({ __typename: "Item", id })!,
            fields: {
              text(existing) {
                return existing + "ly";
              },
            },
          });
        });
      }

      appendLyToText(2);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 2",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: first",
          "Item #2: secondly",
          "Item #3: third",
        ]);
      });

      appendLyToText(1);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 2",
          "item 1",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly",
          "Item #2: secondly",
          "Item #3: third",
        ]);
      });

      appendLyToText(3);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 2",
          "item 1",
          "item 3",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly",
          "Item #2: secondly",
          "Item #3: thirdly",
        ]);
      });

      act(() => {
        cache.writeQuery({
          query,
          data: {
            list: [
              { __typename: "Item", id: 4, text: "fourth" },
              { __typename: "Item", id: 5, text: "fifth" },
            ],
          },
        });
      });

      expect(cache.extract()).toEqual({
        ROOT_QUERY: {
          __typename: "Query",
          list: [
            { __ref: 'Item:{"id":1}' },
            { __ref: 'Item:{"id":2}' },
            { __ref: 'Item:{"id":3}' },
            { __ref: 'Item:{"id":4}' },
            { __ref: 'Item:{"id":5}' },
          ],
        },
        'Item:{"id":1}': {
          __typename: "Item",
          id: 1,
          text: "firstly",
        },
        'Item:{"id":2}': {
          __typename: "Item",
          id: 2,
          text: "secondly",
        },
        'Item:{"id":3}': {
          __typename: "Item",
          id: 3,
          text: "thirdly",
        },
        'Item:{"id":4}': {
          __typename: "Item",
          id: 4,
          text: "fourth",
        },
        'Item:{"id":5}': {
          __typename: "Item",
          id: 5,
          text: "fifth",
        },
      });

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 2",
          "item 1",
          "item 3",
          // The whole list had to be rendered again to append 4 and 5
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 4",
          "item 5",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly",
          "Item #2: secondly",
          "Item #3: thirdly",
          "Item #4: fourth",
          "Item #5: fifth",
        ]);
      });

      appendLyToText(5);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 2",
          "item 1",
          "item 3",
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 4",
          "item 5",
          // A single new render:
          "item 5",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly",
          "Item #2: secondly",
          "Item #3: thirdly",
          "Item #4: fourth",
          "Item #5: fifthly",
        ]);
      });

      appendLyToText(4);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 2",
          "item 1",
          "item 3",
          "list",
          "item 1",
          "item 2",
          "item 3",
          "item 4",
          "item 5",
          "item 5",
          // A single new render:
          "item 4",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly",
          "Item #2: secondly",
          "Item #3: thirdly",
          "Item #4: fourthly",
          "Item #5: fifthly",
        ]);
      });
    }
  );

  it("List can use useFragment with ListFragment", async () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Item: {
          fields: {
            text(existing, { readField }) {
              return existing || `Item #${readField("id")}`;
            },
          },
        },
      },
    });

    const listQuery: TypedDocumentNode<QueryDataWithExtra> = gql`
      query {
        ...ListFragment
        list {
          ...ItemFragment
        }
      }
      ${ListFragment}
      ${ItemFragment}
    `;

    cache.writeQuery({
      query: listQuery,
      data: {
        list: [
          { __typename: "Item", id: 1 },
          { __typename: "Item", id: 2 },
          { __typename: "Item", id: 5 },
        ],
        extra: "from ListFragment",
      },
    });

    const renders: string[] = [];

    function List() {
      renders.push("list");
      const { complete, data } = useFragment({
        fragment: ListFragment,
        from: { __typename: "Query" },
      });
      expect(complete).toBe(true);
      assert(!!complete);
      return (
        <ol>
          {data.list.map((item) => (
            <Item key={item.id} id={item.id} />
          ))}
        </ol>
      );
    }

    function Item(props: { id: number }) {
      renders.push("item " + props.id);
      const { complete, data } = useFragment({
        fragment: ItemFragment,
        from: {
          __typename: "Item",
          id: props.id,
        },
      });
      return <li>{complete ? data.text : "incomplete"}</li>;
    }

    render(
      <MockedProvider cache={cache}>
        <List />
      </MockedProvider>
    );

    function getItemTexts() {
      return screen.getAllByText(/^Item/).map(
        // eslint-disable-next-line testing-library/no-node-access
        (li) => li.firstChild!.textContent
      );
    }

    await waitFor(() => {
      expect(getItemTexts()).toEqual(["Item #1", "Item #2", "Item #5"]);
    });

    expect(renders).toEqual(["list", "item 1", "item 2", "item 5"]);

    act(() => {
      cache.writeFragment({
        fragment: ItemFragment,
        data: {
          __typename: "Item",
          id: 2,
          text: "Item #2 updated",
        },
      });
    });

    await waitFor(() => {
      expect(getItemTexts()).toEqual(["Item #1", "Item #2 updated", "Item #5"]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
      // Only the second item should have re-rendered.
      "item 2",
    ]);

    act(() => {
      cache.modify({
        fields: {
          list(list: readonly Reference[], { readField }) {
            return [
              ...list,
              cache.writeFragment({
                fragment: ItemFragment,
                data: {
                  __typename: "Item",
                  id: 3,
                },
              })!,
              cache.writeFragment({
                fragment: ItemFragment,
                data: {
                  __typename: "Item",
                  id: 4,
                },
              })!,
            ].sort(
              (ref1, ref2) =>
                readField<Item["id"]>("id", ref1)! -
                readField<Item["id"]>("id", ref2)!
            );
          },
        },
      });
    });

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2 updated",
        "Item #3",
        "Item #4",
        "Item #5",
      ]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
      "item 2",
      // This is what's new:
      "list",
      "item 1",
      "item 2",
      "item 3",
      "item 4",
      "item 5",
    ]);

    act(() => {
      cache.writeFragment({
        fragment: ItemFragment,
        data: {
          __typename: "Item",
          id: 4,
          text: "Item #4 updated",
        },
      });
    });

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2 updated",
        "Item #3",
        "Item #4 updated",
        "Item #5",
      ]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
      "item 2",
      "list",
      "item 1",
      "item 2",
      "item 3",
      "item 4",
      "item 5",
      // Only the fourth item should have re-rendered.
      "item 4",
    ]);

    expect(cache.extract()).toEqual({
      "Item:1": {
        __typename: "Item",
        id: 1,
      },
      "Item:2": {
        __typename: "Item",
        id: 2,
        text: "Item #2 updated",
      },
      "Item:3": {
        __typename: "Item",
        id: 3,
      },
      "Item:4": {
        __typename: "Item",
        id: 4,
        text: "Item #4 updated",
      },
      "Item:5": {
        __typename: "Item",
        id: 5,
      },
      ROOT_QUERY: {
        __typename: "Query",
        list: [
          { __ref: "Item:1" },
          { __ref: "Item:2" },
          { __ref: "Item:3" },
          { __ref: "Item:4" },
          { __ref: "Item:5" },
        ],
        extra: "from ListFragment",
      },
      __META: {
        extraRootIds: ["Item:2", "Item:3", "Item:4"],
      },
    });
  });

  it("useFragment(...).missing is a tree describing missing fields", async () => {
    const cache = new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            list(items: Reference[] | undefined, { canRead }) {
              // This filtering happens by default currently in the StoreReader
              // execSubSelectedArrayImpl method, but I am beginning to question
              // the wisdom of that automatic filtering. In case we end up
              // changing the default behavior in the future, I've encoded the
              // filtering explicitly here, so this test won't be broken.
              return items && items.filter(canRead);
            },
          },
        },
      },
    });

    const wrapper = ({ children }: any) => (
      <MockedProvider cache={cache}>{children}</MockedProvider>
    );

    const ListAndItemFragments: TypedDocumentNode<QueryData> = gql`
      fragment ListFragment on Query {
        list {
          id
          ...ItemFragment
        }
      }
      ${ItemFragment}
    `;

    const ListQuery: TypedDocumentNode<QueryData> = gql`
      query ListQuery {
        list {
          id
        }
      }
    `;

    const ListQueryWithText: TypedDocumentNode<QueryData> = gql`
      query ListQuery {
        list {
          id
          text
        }
      }
    `;

    const { result: renderResult } = renderHook(
      () =>
        useFragment({
          fragment: ListAndItemFragments,
          fragmentName: "ListFragment",
          from: { __typename: "Query" },
        }),
      { wrapper }
    );

    function checkHistory(expectedResultCount: number) {
      // Temporarily disabling this check until we can come up with a better
      // (more opt-in) system than result.previousResult.previousResult...
      // function historyToArray(
      //   result: UseFragmentResult<QueryData>,
      // ): UseFragmentResult<QueryData>[] {
      //   const array = result.previousResult
      //     ? historyToArray(result.previousResult)
      //     : [];
      //   array.push(result);
      //   return array;
      // }
      // const all = historyToArray(renderResult.current);
      // expect(all.length).toBe(expectedResultCount);
      // expect(all).toEqual(renderResult.all);
      // if (renderResult.current.complete) {
      //   expect(renderResult.current).toBe(
      //     renderResult.current.lastCompleteResult
      //   );
      // } else {
      //   expect(renderResult.current).not.toBe(
      //     renderResult.current.lastCompleteResult
      //   );
      // }
    }

    expect(renderResult.current.complete).toBe(false);
    expect(renderResult.current.data).toEqual({}); // TODO Should be undefined?
    expect(renderResult.current.missing).toEqual({
      list: "Can't find field 'list' on ROOT_QUERY object",
    });

    checkHistory(1);

    const data125 = {
      list: [
        { __typename: "Item", id: 1 },
        { __typename: "Item", id: 2 },
        { __typename: "Item", id: 5 },
      ],
    };

    await act(async () => {
      cache.writeQuery({
        query: ListQuery,
        data: data125,
      });
    });

    await waitFor(() => expect(renderResult.current.data).toEqual(data125));
    expect(renderResult.current.complete).toBe(false);
    expect(renderResult.current.missing).toEqual({
      list: {
        // Even though Query.list is actually an array in the data, data paths
        // through this array leading to missing fields potentially involve only
        // a small/sparse subset of the array's indexes, so we use objects for
        // the entire MissingTree, to avoid having to worry about sparse arrays.
        // This also means there's no missing.list.length property, which is
        // good because "length" could be a name of an actual field that's
        // missing, and it's somewhat unclear what the length of a sparse array
        // should be, whereas object keys have a less ambiguous interpretation.
        0: { text: "Can't find field 'text' on Item:1 object" },
        1: { text: "Can't find field 'text' on Item:2 object" },
        2: { text: "Can't find field 'text' on Item:5 object" },
      },
    });

    checkHistory(2);

    const data182WithText = {
      list: [
        { __typename: "Item", id: 1, text: "oyez1" },
        { __typename: "Item", id: 8, text: "oyez8" },
        { __typename: "Item", id: 2, text: "oyez2" },
      ],
    };

    await act(async () => {
      cache.writeQuery({
        query: ListQueryWithText,
        data: data182WithText,
      });
    });

    await waitFor(() =>
      expect(renderResult.current.data).toEqual(data182WithText)
    );
    expect(renderResult.current.complete).toBe(true);
    expect(renderResult.current.missing).toBeUndefined();

    checkHistory(3);

    await act(async () =>
      cache.batch({
        update(cache) {
          cache.evict({
            id: cache.identify({
              __typename: "Item",
              id: 8,
            }),
          });

          cache.evict({
            id: cache.identify({
              __typename: "Item",
              id: 2,
            }),
            fieldName: "text",
          });
        },
      })
    );

    await waitFor(() =>
      expect(renderResult.current.data).toEqual({
        list: [
          { __typename: "Item", id: 1, text: "oyez1" },
          { __typename: "Item", id: 2 },
        ],
      })
    );
    expect(renderResult.current.complete).toBe(false);
    expect(renderResult.current.missing).toEqual({
      // TODO Figure out why Item:8 is not represented here. Likely because of
      // auto-filtering of dangling references from arrays, but that should
      // still be reflected here, if possible.
      list: {
        1: {
          text: "Can't find field 'text' on Item:2 object",
        },
      },
    });

    checkHistory(4);

    expect(cache.extract()).toEqual({
      "Item:1": {
        __typename: "Item",
        id: 1,
        text: "oyez1",
      },
      "Item:2": {
        __typename: "Item",
        id: 2,
      },
      "Item:5": {
        __typename: "Item",
        id: 5,
      },
      ROOT_QUERY: {
        __typename: "Query",
        list: [{ __ref: "Item:1" }, { __ref: "Item:8" }, { __ref: "Item:2" }],
      },
    });

    expect(cache.gc().sort()).toEqual(["Item:5"]);
  });

  it("returns new diff when UseFragmentOptions change", async () => {
    const ListFragment: TypedDocumentNode<QueryData> = gql`
      fragment ListFragment on Query {
        list {
          id
        }
      }
    `;

    const cache = new InMemoryCache({
      typePolicies: {
        Item: {
          fields: {
            text(existing, { readField }) {
              return existing || `Item #${readField("id")}`;
            },
          },
        },
      },
    });

    const client = new ApolloClient({
      cache,
      link: new ApolloLink(
        (operation) =>
          new Observable((observer) => {
            if (operation.operationName === "ListQueryWithItemFragment") {
              setTimeout(() => {
                observer.next({
                  data: {
                    list: [
                      { __typename: "Item", id: 1 },
                      { __typename: "Item", id: 2 },
                      { __typename: "Item", id: 5 },
                    ],
                  },
                });
                observer.complete();
              }, 10);
            } else {
              observer.error(
                `unexpected query ${operation.operationName || operation.query}`
              );
            }
          })
      ),
    });

    const listQuery: TypedDocumentNode<QueryData> = gql`
      query ListQueryWithItemFragment {
        list {
          id
          ...ItemFragment
        }
      }
      ${ItemFragment}
    `;

    function List() {
      const [currentItem, setCurrentItem] = React.useState(1);
      useQuery(listQuery);

      const { complete, data } = useFragment({
        fragment: ListFragment,
        from: { __typename: "Query" },
      });

      return complete ?
          <>
            <select
              onChange={(e) => {
                setCurrentItem(parseInt(e.currentTarget.value));
              }}
            >
              {data.list.map((item) => (
                <option key={item.id} value={item.id}>
                  Select item {item.id}
                </option>
              ))}
            </select>
            <div>
              <Item id={currentItem} />
            </div>
            <ol>
              {data.list.map((item) => (
                <Item key={item.id} id={item.id} />
              ))}
            </ol>
          </>
        : null;
    }

    function Item({ id }: { id: number }) {
      const { complete, data } = useFragment({
        fragment: ItemFragment,
        from: {
          __typename: "Item",
          id,
        },
      });
      return <li>{complete ? data.text : "incomplete"}</li>;
    }

    render(
      <ApolloProvider client={client}>
        <List />
      </ApolloProvider>
    );

    function getItemTexts() {
      return screen.getAllByText(/^Item/).map(
        // eslint-disable-next-line testing-library/no-node-access
        (li) => li.firstChild!.textContent
      );
    }

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        // On initial render, Item #1 is selected
        // and renders above the list
        "Item #1",
        "Item #1",
        "Item #2",
        "Item #5",
      ]);
    });

    // Select "Item #2" via <select />
    const user = userEvent.setup();
    await user.selectOptions(
      screen.getByRole("combobox"),
      screen.getByRole("option", { name: "Select item 2" })
    );

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        // Now the selected item at the top should render
        // "Item #2" + the list of items below
        "Item #2",
        "Item #1",
        "Item #2",
        "Item #5",
      ]);
    });
  });

  it("returns correct data when options change", async () => {
    const client = new ApolloClient({
      cache: new InMemoryCache(),
    });
    type User = { __typename: "User"; id: number; name: string };
    const fragment: TypedDocumentNode<User> = gql`
      fragment UserFragment on User {
        id
        name
      }
    `;

    client.writeFragment({
      fragment,
      data: { __typename: "User", id: 1, name: "Alice" },
    });

    client.writeFragment({
      fragment,
      data: { __typename: "User", id: 2, name: "Charlie" },
    });

    const { takeSnapshot, rerender } = renderHookToSnapshotStream(
      ({ id }: { id: number }) =>
        useFragment({ fragment, from: { __typename: "User", id } }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
        initialProps: { id: 1 },
      }
    );

    {
      const snapshot = await takeSnapshot();

      expect(snapshot).toEqual({
        complete: true,
        data: { __typename: "User", id: 1, name: "Alice" },
      });
    }

    rerender({ id: 2 });

    {
      const snapshot = await takeSnapshot();

      expect(snapshot).toEqual({
        complete: true,
        data: { __typename: "User", id: 2, name: "Charlie" },
      });
    }

    await expect(takeSnapshot).not.toRerender();
  });

  it("does not rerender when fields with @nonreactive change", async () => {
    type Post = {
      __typename: "User";
      id: number;
      title: string;
      updatedAt: string;
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
    });

    const fragment: TypedDocumentNode<Post> = gql`
      fragment PostFragment on Post {
        id
        title
        updatedAt @nonreactive
      }
    `;

    client.writeFragment({
      fragment,
      data: {
        __typename: "Post",
        id: 1,
        title: "Blog post",
        updatedAt: "2024-01-01",
      },
    });

    const { takeSnapshot } = renderHookToSnapshotStream(
      () => useFragment({ fragment, from: { __typename: "Post", id: 1 } }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    {
      const snapshot = await takeSnapshot();

      expect(snapshot).toEqual({
        complete: true,
        data: {
          __typename: "Post",
          id: 1,
          title: "Blog post",
          updatedAt: "2024-01-01",
        },
      });
    }

    client.writeFragment({
      fragment,
      data: {
        __typename: "Post",
        id: 1,
        title: "Blog post",
        updatedAt: "2024-02-01",
      },
    });

    await expect(takeSnapshot).not.toRerender();
  });

  it("does not rerender when fields with @nonreactive on nested fragment change", async () => {
    type Post = {
      __typename: "User";
      id: number;
      title: string;
      updatedAt: string;
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
    });

    const fragment: TypedDocumentNode<Post> = gql`
      fragment PostFragment on Post {
        id
        title
        ...PostFields @nonreactive
      }

      fragment PostFields on Post {
        updatedAt
      }
    `;

    client.writeFragment({
      fragment,
      fragmentName: "PostFragment",
      data: {
        __typename: "Post",
        id: 1,
        title: "Blog post",
        updatedAt: "2024-01-01",
      },
    });

    const { takeSnapshot } = renderHookToSnapshotStream(
      () =>
        useFragment({
          fragment,
          fragmentName: "PostFragment",
          from: { __typename: "Post", id: 1 },
        }),
      {
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    {
      const snapshot = await takeSnapshot();

      expect(snapshot).toEqual({
        complete: true,
        data: {
          __typename: "Post",
          id: 1,
          title: "Blog post",
          updatedAt: "2024-01-01",
        },
      });
    }

    client.writeFragment({
      fragment,
      fragmentName: "PostFragment",
      data: {
        __typename: "Post",
        id: 1,
        title: "Blog post",
        updatedAt: "2024-02-01",
      },
    });

    await expect(takeSnapshot).not.toRerender();
  });

  describe("tests with incomplete data", () => {
    let cache: InMemoryCache, wrapper: React.FunctionComponent;
    const ItemFragment = gql`
      fragment ItemFragment on Item {
        id
        text
      }
    `;

    beforeEach(() => {
      cache = new InMemoryCache();
      wrapper = ({ children }: any) => (
        <MockedProvider cache={cache}>{children}</MockedProvider>
      );

      // silence the console for the incomplete fragment write
      {
        using _spy = spyOnConsole("error");
        cache.writeFragment({
          fragment: ItemFragment,
          data: {
            __typename: "Item",
            id: 5,
          },
        });
      }
    });

    it("assumes `returnPartialData: true` per default", () => {
      const { result } = renderHook(
        () =>
          useFragment({
            fragment: ItemFragment,
            from: { __typename: "Item", id: 5 },
          }),
        { wrapper }
      );

      expect(result.current.data).toEqual({ __typename: "Item", id: 5 });
      expect(result.current.complete).toBe(false);
    });
  });

  describe("return value `complete` property", () => {
    let cache: InMemoryCache, wrapper: React.FunctionComponent;
    const ItemFragment = gql`
      fragment ItemFragment on Item {
        id
        text
      }
    `;

    beforeEach(() => {
      cache = new InMemoryCache();
      wrapper = ({ children }: any) => (
        <MockedProvider cache={cache}>{children}</MockedProvider>
      );
    });

    test("if all data is available, `complete` is `true`", () => {
      cache.writeFragment({
        fragment: ItemFragment,
        data: {
          __typename: "Item",
          id: 5,
          text: "Item #5",
        },
      });

      const { result } = renderHook(
        () =>
          useFragment({
            fragment: ItemFragment,
            from: { __typename: "Item", id: 5 },
          }),
        { wrapper }
      );

      expect(result.current).toStrictEqual({
        data: { __typename: "Item", id: 5, text: "Item #5" },
        complete: true,
      });
    });

    test("if only partial data is available, `complete` is `false`", () => {
      cache.writeFragment({
        fragment: ItemFragment,
        data: {
          __typename: "Item",
          id: 5,
        },
      });

      const { result } = renderHook(
        () =>
          useFragment({
            fragment: ItemFragment,
            from: { __typename: "Item", id: 5 },
          }),
        { wrapper }
      );

      expect(result.current).toStrictEqual({
        data: { __typename: "Item", id: 5 },
        complete: false,
        missing: {
          text: "Can't find field 'text' on Item:5 object",
        },
      });
    });

    test("if no data is available, `complete` is `false`", () => {
      const { result } = renderHook(
        () =>
          useFragment({
            fragment: ItemFragment,
            from: { __typename: "Item", id: 5 },
          }),
        { wrapper }
      );

      expect(result.current).toStrictEqual({
        data: {},
        complete: false,
        missing: "Dangling reference to missing Item:5 object",
      });
    });
  });

  // https://github.com/apollographql/apollo-client/issues/12051
  it("does not warn when the cache identifier is invalid", async () => {
    using _ = spyOnConsole("warn");
    const cache = new InMemoryCache();

    const { takeSnapshot } = renderHookToSnapshotStream(
      () =>
        useFragment({
          fragment: ItemFragment,
          // Force a value that results in cache.identify === undefined
          from: { __typename: "Item" },
        }),
      {
        wrapper: ({ children }) => (
          <MockedProvider cache={cache}>{children}</MockedProvider>
        ),
      }
    );

    expect(console.warn).not.toHaveBeenCalled();

    const { data, complete } = await takeSnapshot();

    // TODO: Update when https://github.com/apollographql/apollo-client/issues/12003 is fixed
    expect(complete).toBe(true);
    expect(data).toEqual({});
  });
});

describe("has the same timing as `useQuery`", () => {
  const itemFragment = gql`
    fragment ItemFragment on Item {
      id
      title
    }
  `;

  it("both in same component", async () => {
    const initialItem = { __typename: "Item", id: 1, title: "Item #initial" };
    const updatedItem = { __typename: "Item", id: 1, title: "Item #updated" };

    const query = gql`
      query {
        item {
          ...ItemFragment
        }
      }
      ${itemFragment}
    `;
    let observer: SubscriptionObserver<FetchResult>;
    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
      link: new ApolloLink(
        (operation) => new Observable((o) => void (observer = o))
      ),
    });

    function Component() {
      const { data: queryData } = useQuery(query, { returnPartialData: true });
      const { data: fragmentData, complete } = useFragment({
        fragment: itemFragment,
        from: initialItem,
      });

      replaceSnapshot({ queryData, fragmentData });

      return complete ? JSON.stringify(fragmentData) : "loading";
    }

    const { takeRender, replaceSnapshot } = renderToRenderStream(
      <Component />,
      {
        initialSnapshot: {
          queryData: undefined as any,
          fragmentData: undefined as any,
        },
        wrapper: ({ children }) => (
          <ApolloProvider client={client}>{children}</ApolloProvider>
        ),
      }
    );

    {
      const { snapshot } = await takeRender();
      expect(snapshot.queryData).toBe(undefined);
      expect(snapshot.fragmentData).toStrictEqual({});
    }

    assert(observer!);
    observer.next({ data: { item: initialItem } });
    observer.complete();

    {
      const { snapshot } = await takeRender();
      expect(snapshot.queryData).toStrictEqual({ item: initialItem });
      expect(snapshot.fragmentData).toStrictEqual(initialItem);
    }

    cache.writeQuery({ query, data: { item: updatedItem } });

    {
      const { snapshot } = await takeRender();
      expect(snapshot.queryData).toStrictEqual({ item: updatedItem });
      expect(snapshot.fragmentData).toStrictEqual(updatedItem);
    }
  });

  it("`useQuery` in parent, `useFragment` in child", async () => {
    const item1 = { __typename: "Item", id: 1, title: "Item #1" };
    const item2 = { __typename: "Item", id: 2, title: "Item #2" };
    const query: TypedDocumentNode<{ items: Array<typeof item1> }> = gql`
      query {
        items {
          ...ItemFragment
        }
      }
      ${itemFragment}
    `;
    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
    });
    cache.writeQuery({ query, data: { items: [item1, item2] } });

    function Parent() {
      const { data } = useQuery(query);
      if (!data) throw new Error("should never happen");
      return (
        <>
          <div data-testid="parent">
            <p>{JSON.stringify(data)}</p>
          </div>
          <div data-testid="children">
            {data.items.map((item, i) => (
              <p key={i}>
                <Child id={item.id} />
              </p>
            ))}
          </div>
        </>
      );
    }
    function Child({ id }: { id: number }) {
      const { data } = useFragment({
        fragment: itemFragment,
        from: { __typename: "Item", id },
      });
      return <>{JSON.stringify({ item: data })}</>;
    }

    const { takeRender } = renderToRenderStream(<Parent />, {
      snapshotDOM: true,
      onRender() {
        const parent = screen.getByTestId("parent");
        const children = screen.getByTestId("children");
        expect(within(parent).queryAllByText(/Item #1/).length).toBe(
          within(children).queryAllByText(/Item #1/).length
        );
        expect(within(parent).queryAllByText(/Item #2/).length).toBe(
          within(children).queryAllByText(/Item #2/).length
        );
      },
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    {
      const { withinDOM } = await takeRender();
      expect(withinDOM().queryAllByText(/Item #2/).length).toBe(2);
    }

    cache.evict({
      id: cache.identify(item2),
    });

    {
      const { withinDOM } = await takeRender();
      expect(withinDOM().queryAllByText(/Item #2/).length).toBe(0);
    }

    await expect(takeRender).toRenderExactlyTimes(2);
  });

  /**
   * This would be optimal, but would only work if `useFragment` and
   * `useQuery` had exactly the same timing, which is not the case with
   * the current implementation.
   * The best we can do is to make sure that `useFragment` is not
   * faster than `useQuery` in reasonable cases (of course, `useQuery`
   * could trigger a network request on cache update, which would be slower
   * than `useFragment`, no matter how much we delay it).
   * If we change the core implementation into a more synchronous one,
   * we should try to get this test to work, too.
   */
  it.failing("`useFragment` in parent, `useQuery` in child", async () => {
    const item1 = { __typename: "Item", id: 1, title: "Item #1" };
    const item2 = { __typename: "Item", id: 2, title: "Item #2" };
    const query: TypedDocumentNode<{ items: Array<typeof item1> }> = gql`
      query {
        items {
          ...ItemFragment
        }
      }
      ${itemFragment}
    `;
    const cache = new InMemoryCache();
    const client = new ApolloClient({
      cache,
    });
    cache.writeQuery({ query, data: { items: [item1, item2] } });

    function Parent() {
      const { data: data1 } = useFragment({
        fragment: itemFragment,
        from: { __typename: "Item", id: 1 },
      });
      const { data: data2 } = useFragment({
        fragment: itemFragment,
        from: { __typename: "Item", id: 2 },
      });
      return (
        <>
          <div data-testid="parent">
            <p>{JSON.stringify(data1)}</p>
            <p>{JSON.stringify(data2)}</p>
          </div>
          <div data-testid="children">
            <p>
              <Child />
            </p>
          </div>
        </>
      );
    }
    function Child() {
      const { data } = useQuery(query);
      if (!data) throw new Error("should never happen");
      return <>{JSON.stringify(data)}</>;
    }

    const { takeRender } = renderToRenderStream(<Parent />, {
      onRender() {
        const parent = screen.getByTestId("parent");
        const children = screen.getByTestId("children");
        expect(within(parent).queryAllByText(/Item #1/).length).toBe(
          within(children).queryAllByText(/Item #1/).length
        );
        expect(within(parent).queryAllByText(/Item #2/).length).toBe(
          within(children).queryAllByText(/Item #2/).length
        );
      },
      wrapper: ({ children }) => (
        <ApolloProvider client={client}>{children}</ApolloProvider>
      ),
    });

    {
      const { withinDOM } = await takeRender();
      expect(withinDOM().queryAllByText(/Item #2/).length).toBe(2);
    }

    act(
      () =>
        void cache.evict({
          id: cache.identify(item2),
        })
    );

    {
      const { withinDOM } = await takeRender();
      expect(withinDOM().queryAllByText(/Item #2/).length).toBe(0);
    }

    await expect(takeRender).toRenderExactlyTimes(3);
  });
});

describe.skip("Type Tests", () => {
  test("NoInfer prevents adding arbitrary additional variables", () => {
    const typedNode = {} as TypedDocumentNode<{ foo: string }, { bar: number }>;
    useFragment({
      fragment: typedNode,
      from: { __typename: "Query" },
      variables: {
        bar: 4,
        // @ts-expect-error
        nonExistingVariable: "string",
      },
    });
  });

  test("UseFragmentOptions interface shape", <TData, TVars>() => {
    expectTypeOf<UseFragmentOptions<TData, TVars>>().branded.toEqualTypeOf<{
      from: string | StoreObject | Reference;
      fragment: DocumentNode | TypedDocumentNode<TData, TVars>;
      fragmentName?: string;
      optimistic?: boolean;
      variables?: TVars;
      canonizeResults?: boolean;
      client?: ApolloClient<any>;
    }>();
  });
});
