import type { TypedDocumentNode } from '@apollo/client';
import { useQuery, gql } from '@apollo/client';

import { InMemoryCache, ApolloClient, ApolloProvider } from '@apollo/client';
const client = new ApolloClient({
  cache: new InMemoryCache(),
  uri: 'https://main--hack-the-e-commerce.apollographos.net/graphql',
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

  return data ? (
    <ul>
      {data?.products.map(({ id, title }) => (
        <li key={id}>{title}</li>
      ))}
    </ul>
  ) : (
    <>loading</>
  );
}
