import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import { useFragment } from "../useFragment";
import { useObservableQuery } from "../useObservableQuery";
import { itAsync } from "../../../testing";
import { ApolloProvider } from "../../context";
import {
  InMemoryCache,
  gql,
  TypedDocumentNode,
  Reference,
  ApolloLink,
  Observable,
  ApolloClient,
  NetworkStatus,
} from "../../../core";

describe("useObservableQuery", () => {
  type Item = {
    __typename: string;
    id: number;
    text?: string;
  };

  const ListFragment: TypedDocumentNode<QueryData> = gql`
    fragment ListFragment on Query {
      list {
        id
      }
    }
  `;

  const ItemFragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      text
    }
  `;

  type QueryData = {
    list: Item[];
  };

  itAsync("useObservableQuery avoids depending on whole query response", async (resolve, reject) => {
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
          # The inclusion of this fragment is the key difference between this
          # test and the previous one.
          ...ItemFragment
        }
      }
      ${ItemFragment}
    `;

    const renders: string[] = [];

    function List() {
      renders.push("list");

      const oq = useObservableQuery({
        query: listQuery,
      }, {
        error: reject,
      });

      const { complete, data } = useFragment({
        fragment: ListFragment,
        from: { __typename: "Query" },
      });

      // Test that we can force a specific ObservableQuery by passing it instead
      // of WatchQueryOptions.
      expect(useObservableQuery(oq)).toBe(oq);

      expect(
        oq.getLoading() ? NetworkStatus.loading : NetworkStatus.ready
      ).toBe(oq.getNetworkStatus());

      return complete ? (
        <ol>
          {data!.list.map(item => <Item key={item.id} id={item.id}/>)}
        </ol>
      ) : null;
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

    const { getAllByText } = render(
      <ApolloProvider client={client}>
        <List />
      </ApolloProvider>
    );

    function getItemTexts() {
      return getAllByText(/^Item/).map(
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

    expect(cache.extract()).toMatchSnapshot();

    resolve();
  });
});
