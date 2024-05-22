import type { TypedDocumentNode } from "@apollo/client";

import {
  useQuery,
  gql,
  InMemoryCache,
  ApolloClient,
  ApolloProvider,
  ApolloLink,
  Observable,
  HttpLink,
} from "@apollo/client";

const delayLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    const handle = setTimeout(() => {
      forward(operation).subscribe(observer);
    }, 1000);

    return () => clearTimeout(handle);
  });
});

const httpLink = new HttpLink({
  uri: "https://main--hack-the-e-commerce.apollographos.net/graphql",
});

const client = new ApolloClient({
  cache: new InMemoryCache(),
  link: ApolloLink.from([delayLink, httpLink]),
});

const QUERY: TypedDocumentNode<{
  products: {
    id: string;
    title: string;
  }[];
}> = gql`
  query {
    products {
      id
      title
    }
  }
`;

export default function App() {
  return (
    <ApolloProvider client={client}>
      <Main />
    </ApolloProvider>
  );
}

function Main() {
  const { data } = useQuery(QUERY);

  return data ?
      <ul>
        {data?.products.map(({ id, title }) => <li key={id}>{title}</li>)}
      </ul>
    : <>loading</>;
}
