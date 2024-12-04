import { gql } from "@apollo/client";
import type { TypedDocumentNode } from "@apollo/client";

export const ProfileFieldsFragment: TypedDocumentNode<{
  profile: { id: string; avatarUrl: string };
}> = gql`
  fragment ProfileFields on User {
    profile {
      id
      avatarUrl
    }
  }
`;

const CurrentUserFieldsFragment = gql`
  fragment CurrentUserFields on User {
    name
    ...ProfileFields
  }
`;

export const GetCurrentUser = gql`
  query GetCurrentUser {
    currentUser {
      id
      ...CurrentUserFields
    }
  }

  ${CurrentUserFieldsFragment}
`;

export const SKIP_TO_NEXT_MUTATION = gql`
  mutation SkipToNextMutation {
    skipToNext {
      playbackState {
        progressMs
        item {
          __typename
          ... on Track {
            id
            name
            album {
              id
              name
              images {
                url
              }
            }
            artists {
              id
              name
            }
          }

          ... on Episode {
            id
            name
            show {
              id
              name
              images {
                url
              }
            }
          }
        }
      }
    }
  }
`;

export const SKIP_TO_NEXT_MUTATION_WITH_FRAGMENT = gql`
  mutation SkipToNextMutation {
    skipToNext {
      playbackState {
        progressMs
        item {
          __typename
          ... on Track {
            id
            name
            album {
              id
              name
              images {
                url
              }
            }
            artists {
              id
              name
            }
            ...TrackItem_track
          }

          ... on Episode {
            id
            name
            show {
              id
              name
              images {
                url
              }
            }
          }
        }
      }
    }
  }
`;
