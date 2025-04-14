import React from "react";
import { gql, useQuery } from "@apollo/client";

const ProfileFieldsFragment = gql`
  fragment ProfileFields on User {
    profile {
      id
      avatarUrl
    }
  }
`;

const fragment = gql`
  fragment CurrentUserFields on User {
    name
    ...ProfileFields
  }

  ${ProfileFieldsFragment}
`;

export function MyComponent() {
  const { data, loading } = useQuery(gql`
    query GetCurrentUser {
      currentUser {
        id
        ...CurrentUserFields
      }
    }

    ${fragment}
  `);

  if (loading) {
    return <div>Loading...</div>;
  }

  return <div>{JSON.stringify(data)}</div>;
}
