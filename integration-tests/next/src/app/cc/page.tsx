"use client";

import type { TypedDocumentNode } from "@apollo/client";
import { useSuspenseQuery, gql } from "@apollo/client";

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
  const { data } = useSuspenseQuery(QUERY);

  return (
    <ul>
      {data.products.map(({ id, title }) => (
        <li key={id}>{title}</li>
      ))}
    </ul>
  );
}
