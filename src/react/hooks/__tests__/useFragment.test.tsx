import * as React from "react";
import { render, waitFor, screen, renderHook } from "@testing-library/react";
import userEvent from '@testing-library/user-event';
import { act } from "react-dom/test-utils";

import { useFragment_experimental as useFragment } from "../useFragment";
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
} from "../../../core";
import { useQuery } from "../useQuery";

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
    })

    const renders: string[] = [];

    function List() {
      renders.push("list");
      const { loading, data } = useQuery(listQuery);
      expect(loading).toBe(false);
      return (
        <ol>
          {data!.list.map(item => <Item key={item.id} id={item.id}/>)}
        </ol>
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
      return <li>{complete ? data!.text : "incomplete"}</li>;
    }

    render(
      <MockedProvider cache={cache}>
        <List />
      </MockedProvider>
    );

    function getItemTexts() {
      return screen.getAllByText(/^Item/).map(
        // eslint-disable-next-line testing-library/no-node-access
        li => li.firstChild!.textContent
      );
    }

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2",
        "Item #5",
      ]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
    ]);

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
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2 updated",
        "Item #5",
      ]);
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
          list(list: Reference[], { readField }) {
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
            ].sort((ref1, ref2) => (
              readField<Item["id"]>("id", ref1)! -
              readField<Item["id"]>("id", ref2)!
            ));
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
        extraRootIds: [
          "Item:2",
          "Item:3",
          "Item:4",
        ],
      },
    });
  });

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
    })

    const renders: string[] = [];

    function List() {
      renders.push("list");
      const { complete, data } = useFragment({
        fragment: ListFragment,
        from: { __typename: "Query" },
      });
      expect(complete).toBe(true);
      return (
        <ol>
          {data!.list.map(item => <Item key={item.id} id={item.id}/>)}
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
      return <li>{complete ? data!.text : "incomplete"}</li>;
    }

    render(
      <MockedProvider cache={cache}>
        <List />
      </MockedProvider>
    );

    function getItemTexts() {
      return screen.getAllByText(/^Item/).map(
        // eslint-disable-next-line testing-library/no-node-access
        li => li.firstChild!.textContent
      );
    }

    await waitFor(() => {
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2",
        "Item #5",
      ]);
    });

    expect(renders).toEqual([
      "list",
      "item 1",
      "item 2",
      "item 5",
    ]);

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
      expect(getItemTexts()).toEqual([
        "Item #1",
        "Item #2 updated",
        "Item #5",
      ]);
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
          list(list: Reference[], { readField }) {
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
            ].sort((ref1, ref2) => (
              readField<Item["id"]>("id", ref1)! -
              readField<Item["id"]>("id", ref2)!
            ));
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
        extraRootIds: [
          "Item:2",
          "Item:3",
          "Item:4",
        ],
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
          }
        }
      }
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
      () => useFragment({
        fragment: ListAndItemFragments,
        fragmentName: "ListFragment",
        from: { __typename: "Query" },
        returnPartialData: true,
      }),
      { wrapper },
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

    expect(renderResult.current.complete).toBe(false);
    expect(renderResult.current.data).toEqual(data125);
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

    expect(renderResult.current.complete).toBe(true);
    expect(renderResult.current.data).toEqual(data182WithText);
    expect(renderResult.current.missing).toBeUndefined();

    checkHistory(3);

    await act(async () => cache.batch({
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
    }));

    expect(renderResult.current.complete).toBe(false);
    expect(renderResult.current.data).toEqual({
      list: [
        { __typename: "Item", id: 1, text: "oyez1" },
        { __typename: "Item", id: 2 },
      ],
    });
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
        list: [
          { __ref: "Item:1" },
          { __ref: "Item:8" },
          { __ref: "Item:2" },
        ],
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
      link: new ApolloLink(operation => new Observable(observer => {
        if (operation.operationName === "ListQueryWithItemFragment") {
          setTimeout(() => {
            observer.next({
              data: {
                list: [
                  { __typename: "Item", id: 1 },
                  { __typename: "Item", id: 2 },
                  { __typename: "Item", id: 5 },
                ],
              }
            });
            observer.complete();
          }, 10);
        } else {
          observer.error(`unexpected query ${
            operation.operationName ||
            operation.query
          }`);
        }
      })),
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

      return complete ? (
        <>
          <select onChange={(e) => {
            setCurrentItem(parseInt(e.currentTarget.value))
          }}>
            {data!.list.map(item => <option key={item.id} value={item.id}>Select item {item.id}</option>)}
          </select>
          <div>
            <Item id={currentItem} />
          </div>
          <ol>
          {data!.list.map(item => <Item key={item.id} id={item.id}/>)}
          </ol>
        </>
      ) : null;
    }

    function Item({ id }: { id: number }) {
      const { complete, data } = useFragment({
        fragment: ItemFragment,
        from: {
          __typename: "Item",
          id,
        },
      });
      return <li>{complete ? data!.text : "incomplete"}</li>;
    }

    render(
      <ApolloProvider client={client}>
        <List />
      </ApolloProvider>
    );

    function getItemTexts() {
      return screen.getAllByText(/^Item/).map(
        // eslint-disable-next-line testing-library/no-node-access
        li => li.firstChild!.textContent
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
      screen.getByRole('combobox'),
      screen.getByRole('option', { name: 'Select item 2' })
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
});
