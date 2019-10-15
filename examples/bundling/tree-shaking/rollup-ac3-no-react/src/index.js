import { ApolloClient, InMemoryCache, gql } from "@apollo/client";

const ALL_COUNTRIES = gql`
  query AllCountries {
    countries @client {
      code
      name
      emoji
    }
  }
`;

const client = new ApolloClient({
  cache: new InMemoryCache(),
  resolvers: {
    Query: {
      countries() {
        return [
          {
            code: "AD",
            emoji: "🇦🇩",
            name: "Andorra",
            __typename: "Country"
          },
          {
            code: "AE",
            emoji: "🇦🇪",
            name: "United Arab Emirates",
            __typename: "Country"
          }
        ];
      }
    }
  }
});

client.query({ query: ALL_COUNTRIES }).then(response => {
  console.log(response);
});
