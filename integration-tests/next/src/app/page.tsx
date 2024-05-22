import type { TypedDocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";
import { getClient } from "./client.ts";

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

export default async function Home() {
  const { data } = await getClient().query({ query: QUERY });
  return (
    <ul>
      {data.products.map(({ id, title }) => (
        <li key={id}>{title}</li>
      ))}
    </ul>
  );
}
