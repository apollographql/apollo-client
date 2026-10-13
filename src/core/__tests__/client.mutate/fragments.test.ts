import type { TypedDocumentNode } from "@apollo/client";
import { ApolloClient, gql, InMemoryCache } from "@apollo/client";
import { MockLink } from "@apollo/client/testing";

const ItemFieldsFragment = gql`
  fragment ItemFields on CartItem {
    key
    quantity
  }
`;
const mutation: TypedDocumentNode<{
  addToCart: {
    __typename: "AddToCartResponse";
    cart: {
      __typename: "Cart";
      items: Array<{
        __typename: "VerySpecificCartItem" | "OtherCartItemImplementor";
        key: string;
        quantity: number;
      }>;
    };
  };
}> = gql`
  mutation AddToCart {
    addToCart {
      cart {
        items {
          ...ItemFields
        }
      }
    }
  }
  ${ItemFieldsFragment}
`;

test("preserves interface/union type fragments in mutation results if `possibleTypes` is configured", async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache({
      possibleTypes: {
        CartItem: ["VerySpecificCartItem", "OtherCartItemImplementor"],
      },
    }),
    link: new MockLink([
      {
        request: { query: mutation },
        result: {
          data: {
            addToCart: {
              __typename: "AddToCartResponse",
              cart: {
                __typename: "Cart",
                items: [
                  {
                    __typename: "VerySpecificCartItem",
                    key: "item1",
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
      },
    ]),
  });

  await expect(
    client.mutate({
      mutation,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      addToCart: {
        __typename: "AddToCartResponse",
        cart: {
          __typename: "Cart",
          items: [
            {
              __typename: "VerySpecificCartItem",
              key: "item1",
              quantity: 1,
            },
          ],
        },
      },
    },
  });
});

test("drops interface/union type fragments in mutation results if `possibleTypes` is not configured", async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query: mutation },
        result: {
          data: {
            addToCart: {
              __typename: "AddToCartResponse",
              cart: {
                __typename: "Cart",
                items: [
                  {
                    __typename: "VerySpecificCartItem",
                    key: "item1",
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
      },
    ]),
  });

  await expect(
    client.mutate({
      mutation,
    })
  ).resolves.toStrictEqualTyped({
    data: {
      addToCart: {
        __typename: "AddToCartResponse",
        cart: {
          __typename: "Cart",
          items: [
            {
              __typename: "VerySpecificCartItem",
              key: "item1",
              quantity: 1,
            },
          ],
        },
      },
    },
  });
});

test("preserves interface/union type fragments in mutation results if `possibleTypes` is not configured (no-cache)", async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache({}),
    link: new MockLink([
      {
        request: { query: mutation },
        result: {
          data: {
            addToCart: {
              __typename: "AddToCartResponse",
              cart: {
                __typename: "Cart",
                items: [
                  {
                    __typename: "VerySpecificCartItem",
                    key: "item1",
                    quantity: 1,
                  },
                ],
              },
            },
          },
        },
      },
    ]),
  });

  await expect(
    client.mutate({
      mutation,
      fetchPolicy: "no-cache",
    })
  ).resolves.toStrictEqualTyped({
    data: {
      addToCart: {
        __typename: "AddToCartResponse",
        cart: {
          __typename: "Cart",
          items: [
            {
              __typename: "VerySpecificCartItem",
              key: "item1",
              quantity: 1,
            },
          ],
        },
      },
    },
  });
});
