import * as React from "react";
import { render, waitFor, screen } from "@testing-library/react";
import { act } from "react-dom/test-utils";

import { useFragment } from "../useFragment";
import { ApolloProvider } from "../../context";
import {
  InMemoryCache,
  gql,
  TypedDocumentNode,
  ApolloClient,
  ApolloLink,
} from "../../../core";
import { useQuery } from "../useQuery";
import { concatPagination } from "../../../utilities";

describe("useFragment", () => {
  it("is importable and callable", () => {
    expect(typeof useFragment).toBe("function");
  });

  type SubItem = {
    __typename: string;
    id: number;
    text?: string;
  };

  type Item = {
    __typename: string;
    id: number;
    text?: string;
    subItem: SubItem;
  };

  const SubItemFragment: TypedDocumentNode<SubItem> = gql`
    fragment SubItemFragment on SubItem {
      text
    }
  `;

  const ItemFragment: TypedDocumentNode<Item> = gql`
    fragment ItemFragment on Item {
      text
      subItem {
        id
        ...SubItemFragment @mask
      }
    }
    ${SubItemFragment}
  `;

  it.each<TypedDocumentNode<{ list: Item[] }>>([
    // This query uses a basic field-level  directive.
    gql`
      query GetItems {
        list {
          id
          text @mask 
          subItem {
            id
            text @mask 
          }
        }
      }
    `,
    // // This query uses  on an anonymous/inline ...spread directive.
    gql`
      query GetItems {
        list {
          id
          ... @mask {
            text
            subItem {
              id
              ... @mask {
                text
              }
            }
          }
        }
      }
    `,
    // This query uses  on a ...spread with a type condition.
    gql`
      query GetItems {
        list {
          id
          ... on Item @mask {
            text
            subItem {
              id
              ... on SubItem @mask {
                text
              }
            }
          }
        }
      }
    `,
    // This query uses  directive on a named fragment ...spread.
    gql`
      query GetItems {
        list {
          id
          ...ItemFragment @mask
        }
      }

      ${ItemFragment}
    `,
  ])(
    "Parent list component can use  to avoid rerendering",
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
            // keys like text, but it's not the only way. Since
            //  is now in the KNOWN_DIRECTIVES array defined in
            // utilities/graphql/storeUtils.ts, the '' suffix won't be
            // automatically appended to field keys by default.
            // fields: {
            //   text: {
            //     keyArgs: false,
            //   },
            // },
          },
          SubItem: {
            keyFields: ["id"],
          },
        },
      });

      const client = new ApolloClient({
        cache,
        link: ApolloLink.empty(),
      });

      const renders: string[] = [];

      function List() {
        const response = useQuery(query);

        const { data } = response;
        renders.push("list");

        return (
          <ul>
            {data?.list.map((item) => (
              <Item key={item.id} itemId={item.id} />
            ))}
          </ul>
        );
      }

      function Item({ itemId }: { itemId: number }) {
        const { data } = useFragment({
          fragment: ItemFragment,
          fragmentName: "ItemFragment",
          from: {
            __typename: "Item",
            id: itemId,
          },
        });

        renders.push(`item ${itemId}`);

        if (!data || !data.subItem?.id) return null;
        return (
          <li>
            {`Item #${itemId}: ${data.text}`}
            <SubItem key={data.subItem.id} subItemId={data.subItem.id} />
          </li>
        );
      }

      function SubItem({ subItemId }: { subItemId: number }) {
        const { data } = useFragment({
          fragment: SubItemFragment,
          fragmentName: "SubItemFragment",
          from: {
            __typename: "SubItem",
            id: subItemId,
          },
        });

        renders.push(`subItem ${subItemId}`);

        if (!data) return null;

        return <span>{` Sub #${subItemId}: ${data.text}`}</span>;
      }

      act(() => {
        cache.writeQuery({
          query,
          data: {
            list: [
              {
                __typename: "Item",
                id: 1,
                text: "first",
                subItem: { __typename: "SubItem", id: 1, text: "first Sub" },
              },
              {
                __typename: "Item",
                id: 2,
                text: "second",
                subItem: { __typename: "SubItem", id: 2, text: "second Sub" },
              },
              {
                __typename: "Item",
                id: 3,
                text: "third",
                subItem: { __typename: "SubItem", id: 3, text: "third Sub" },
              },
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
          subItem: {
            __ref: 'SubItem:{"id":1}',
          },
        },
        'Item:{"id":2}': {
          __typename: "Item",
          id: 2,
          text: "second",
          subItem: {
            __ref: 'SubItem:{"id":2}',
          },
        },
        'Item:{"id":3}': {
          __typename: "Item",
          id: 3,
          text: "third",
          subItem: {
            __ref: 'SubItem:{"id":3}',
          },
        },
        'SubItem:{"id":1}': {
          __typename: "SubItem",
          id: 1,
          text: "first Sub",
        },
        'SubItem:{"id":2}': {
          __typename: "SubItem",
          id: 2,
          text: "second Sub",
        },
        'SubItem:{"id":3}': {
          __typename: "SubItem",
          id: 3,
          text: "third Sub",
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
          "Item #1: first Sub #1: first Sub",
          "Item #2: second Sub #2: second Sub",
          "Item #3: third Sub #3: third Sub",
        ]);
      });

      expect(renders).toEqual([
        "list",
        "item 1",
        "subItem 1",
        "item 2",
        "subItem 2",
        "item 3",
        "subItem 3",
      ]);

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

      function appendLyToSubText(id: number) {
        act(() => {
          cache.modify({
            id: cache.identify({ __typename: "SubItem", id })!,
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
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 2",
          "subItem 2",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: first Sub #1: first Sub",
          "Item #2: secondly Sub #2: second Sub",
          "Item #3: third Sub #3: third Sub",
        ]);
      });

      appendLyToText(1);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 2",
          "subItem 2",
          "item 1",
          "subItem 1",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly Sub #1: first Sub",
          "Item #2: secondly Sub #2: second Sub",
          "Item #3: third Sub #3: third Sub",
        ]);
      });

      appendLyToText(3);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 2",
          "subItem 2",
          "item 1",
          "subItem 1",
          "item 3",
          "subItem 3",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly Sub #1: first Sub",
          "Item #2: secondly Sub #2: second Sub",
          "Item #3: thirdly Sub #3: third Sub",
        ]);
      });

      act(() => {
        cache.writeQuery({
          query,
          data: {
            list: [
              {
                __typename: "Item",
                id: 4,
                text: "fourth",
                subItem: { __typename: "SubItem", id: 4, text: "fourthSub" },
              },
              {
                __typename: "Item",
                id: 5,
                text: "fifth",
                subItem: { __typename: "SubItem", id: 5, text: "fifthSub" },
              },
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
          subItem: {
            __ref: 'SubItem:{"id":1}',
          },
        },
        'Item:{"id":2}': {
          __typename: "Item",
          id: 2,
          text: "secondly",
          subItem: {
            __ref: 'SubItem:{"id":2}',
          },
        },
        'Item:{"id":3}': {
          __typename: "Item",
          id: 3,
          text: "thirdly",
          subItem: {
            __ref: 'SubItem:{"id":3}',
          },
        },
        'Item:{"id":4}': {
          __typename: "Item",
          id: 4,
          text: "fourth",
          subItem: {
            __ref: 'SubItem:{"id":4}',
          },
        },
        'Item:{"id":5}': {
          __typename: "Item",
          id: 5,
          text: "fifth",
          subItem: {
            __ref: 'SubItem:{"id":5}',
          },
        },
        'SubItem:{"id":1}': {
          __typename: "SubItem",
          id: 1,
          text: "first Sub",
        },
        'SubItem:{"id":2}': {
          __typename: "SubItem",
          id: 2,
          text: "second Sub",
        },
        'SubItem:{"id":3}': {
          __typename: "SubItem",
          id: 3,
          text: "third Sub",
        },
        'SubItem:{"id":4}': {
          __typename: "SubItem",
          id: 4,
          text: "fourthSub",
        },
        'SubItem:{"id":5}': {
          __typename: "SubItem",
          id: 5,
          text: "fifthSub",
        },
      });

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 2",
          "subItem 2",
          "item 1",
          "subItem 1",
          "item 3",
          "subItem 3",
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 4",
          "subItem 4",
          "item 5",
          "subItem 5",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly Sub #1: first Sub",
          "Item #2: secondly Sub #2: second Sub",
          "Item #3: thirdly Sub #3: third Sub",
          "Item #4: fourth Sub #4: fourthSub",
          "Item #5: fifth Sub #5: fifthSub",
        ]);
      });

      appendLyToText(5);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 2",
          "subItem 2",
          "item 1",
          "subItem 1",
          "item 3",
          "subItem 3",
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 4",
          "subItem 4",
          "item 5",
          "subItem 5",
          // A single new render:
          "item 5",
          "subItem 5",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly Sub #1: first Sub",
          "Item #2: secondly Sub #2: second Sub",
          "Item #3: thirdly Sub #3: third Sub",
          "Item #4: fourth Sub #4: fourthSub",
          "Item #5: fifthly Sub #5: fifthSub",
        ]);
      });

      appendLyToText(4);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 2",
          "subItem 2",
          "item 1",
          "subItem 1",
          "item 3",
          "subItem 3",
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 4",
          "subItem 4",
          "item 5",
          "subItem 5",
          "item 5",
          "subItem 5",
          // A single new render:
          "item 4",
          "subItem 4",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly Sub #1: first Sub",
          "Item #2: secondly Sub #2: second Sub",
          "Item #3: thirdly Sub #3: third Sub",
          "Item #4: fourthly Sub #4: fourthSub",
          "Item #5: fifthly Sub #5: fifthSub",
        ]);
      });

      appendLyToSubText(1);

      await waitFor(() => {
        expect(renders).toEqual([
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 2",
          "subItem 2",
          "item 1",
          "subItem 1",
          "item 3",
          "subItem 3",
          "list",
          "item 1",
          "subItem 1",
          "item 2",
          "subItem 2",
          "item 3",
          "subItem 3",
          "item 4",
          "subItem 4",
          "item 5",
          "subItem 5",
          "item 5",
          "subItem 5",
          "item 4",
          "subItem 4",
          // A single new render:
          "subItem 1",
        ]);

        expect(getItemTexts()).toEqual([
          "Item #1: firstly Sub #1: first Subly",
          "Item #2: secondly Sub #2: second Sub",
          "Item #3: thirdly Sub #3: third Sub",
          "Item #4: fourthly Sub #4: fourthSub",
          "Item #5: fifthly Sub #5: fifthSub",
        ]);
      });
    }
  );
});
