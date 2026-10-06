import { ApolloClient, ApolloLink, gql } from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { dateScalar } from "@apollo/client/testing/internal";

test("returns parsed custom scalar fields", () => {
  const fragment = gql`
    fragment EventFields on Event {
      id
      startDate
    }
  `;
  const client = new ApolloClient({
    cache: new InMemoryCache({
      scalars: { Date: dateScalar },
      typePolicies: {
        Event: {
          fields: {
            startDate: { scalar: "Date" },
          },
        },
      },
    }),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    data: {
      __typename: "Event",
      id: "1",
      startDate: "2026-01-01",
    },
  });

  expect(
    client.readFragment({
      fragment,
      id: "Event:1",
    })
  ).toStrictEqualTyped({
    __typename: "Event",
    id: "1",
    startDate: new Date(2026, 0, 1),
  });
});
