---
"@apollo/client": minor
---

Fragment APIs now read fragment arguments and operation variables from the object passed to `from`. When you pass an object from a query result, you no longer need to pass `variables` to read the fragment with the correct values.

```ts
const fragment = gql`
  fragment UserCard($avatarSize: Int) on User {
    id
    avatar(size: $avatarSize)
  }
`;

const query = gql`
  query GetUsers($friendAvatarSize: Int) {
    currentUser {
      ...UserCard(avatarSize: 96)
      friends {
        ...UserCard(avatarSize: $friendAvatarSize)
      }
    }
  }
`;

const { data } = useQuery(query, { variables: { friendAvatarSize: 32 } });

// Reads the avatar with `size: 96`
useFragment({ fragment, from: data.currentUser });

// Reads the avatars with `size: 32`
useFragment({ fragment, from: data.currentUser.friends });
```

This works with `useFragment`, `useSuspenseFragment`, `watchFragment`, `readFragment`, `writeFragment`, and `updateFragment`. The same applies to fragments that use operation variables without fragment arguments.
