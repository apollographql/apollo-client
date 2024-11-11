import { graphql } from "./gql";

export const query = graphql(`
  query GetCurrentUser {
    currentUser {
      id
      ...CurrentUserFields
    }
  }
`);

export const currentUserFieldsFragment = graphql(`
  fragment CurrentUserFields on User {
    name
    ...ProfileFields
  }
`);

export const profileFieldsFragment = graphql(`
  fragment ProfileFields on User {
    profile {
      id
      avatarUrl
    }
  }
`);
