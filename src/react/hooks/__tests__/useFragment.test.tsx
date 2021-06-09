import * as React from "react";
import { render, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import { useFragment } from "../useFragment";
import { MockedProvider } from "../../../testing";
import { InMemoryCache, gql, TypedDocumentNode, Reference } from "../../../core";
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

    const { getAllByText } = render(
      <MockedProvider cache={cache}>
        <List />
      </MockedProvider>
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

    const listQuery: TypedDocumentNode<QueryData> = gql`
      query {
        list {
          ...ListFragment
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

    const { getAllByText } = render(
      <MockedProvider cache={cache}>
        <List />
      </MockedProvider>
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
});
