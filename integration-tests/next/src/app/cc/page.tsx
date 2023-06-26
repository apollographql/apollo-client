'use client';

import { useSuspenseQuery } from '@apollo/experimental-nextjs-app-support/ssr';
import type { TypedDocumentNode } from '@apollo/client';
import { gql, useApolloClient } from '@apollo/client';

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

export default function Page() {
  const client = useApolloClient();
  console.log('lalala', client.extract());
  const { data } = useSuspenseQuery(QUERY);

  return (
    <ul>
      {data.products.map(({ id, title }) => (
        <li key={id}>{title}</li>
      ))}
    </ul>
  );
}
