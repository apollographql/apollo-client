"use client";

import type { TypedDocumentNode } from "@apollo/client";
import { gql, useQuery } from "@apollo/client";

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
  const { data } = useQuery(QUERY);

  if (!data) {
    return <p>loading</p>;
  }

  return (
    <ul>
      {data.products.map(({ id, title }) => (
        <li key={id}>{title}</li>
      ))}
    </ul>
  );
}
