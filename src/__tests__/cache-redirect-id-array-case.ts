import gql from "graphql-tag";
import { ApolloClient, ApolloLink } from "../core";
import { InMemoryCache } from "../cache";
import { itAsync } from "../testing";

const query = gql`
  query GetProductsByIds($ids: [String]!) {
    getProductsByIds(ids: $ids) {
      id
      name
    }
  }
`;

const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        getProductsByIds: {
          read(_, { args, toReference }) {
            // ℹ️ uncommenting the following line will make it work
            // return false;

            return args?.ids.map((id: string) => toReference(`Product:${id}`));
          },
        },
      },
    },
  },
});

itAsync(
  "does network request when ids are not found in cache",
  (resolve, reject) =>
    new ApolloClient({
      link: ApolloLink.from([
        (operation, forward) => {
          // indicates, that an outgoing query attempted is being done
          expect(operation.operationName).toBe("GetProductsByIds");
          expect(operation.variables).toEqual({ ids: ["1", "2", "3"] });

          resolve();

          return forward(operation);
        },
      ]),
      cache,
    })
      .watchQuery({
        query,
        fetchPolicy: "cache-first",
        variables: {
          ids: ["1", "2", "3"],
        },
      })
      .subscribe({ error: reject })
);
