"use client";

import type { TypedDocumentNode } from "@apollo/client";
import { gql, useQuery } from "@apollo/client";
import type { GetStaticProps } from "next";
import { addApolloState, initializeApollo } from "@/libs/apolloClient.ts";

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
    throw new Error("should not happen, we have getServerSideProps!");
  }

  return (
    <ul>
      {data.products.map(({ id, title }) => (
        <li key={id}>{title}</li>
      ))}
    </ul>
  );
}

export const getStaticProps: GetStaticProps = async function () {
  const apolloClient = initializeApollo();

  await apolloClient.query({
    query: QUERY,
  });
  return addApolloState(apolloClient, {
    props: {},
  });
};
