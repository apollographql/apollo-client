---
"@apollo/client": minor
---

Support GraphQL 17 experimental fragment arguments. Fragment definitions can now include variable definitions, and fragment spreads can pass arguments for them.

```graphql
fragment UserFragment($avatarSize: Int!) on User {
  id
  avatar(size: $avatarSize)
}
```

Arguments can be passed to the fragment where it's used:

```graphql
query CurrentUserQuery($friendAvatarSize: Int!) {
  currentUser {
    id
    ...UserFragment(avatarSize: 32)

    friends {
      id
      ...UserFragment(avatarSize: $friendAvatarSize)
    }
  }
}
```

You must enable experimental fragment arguments to use this feature:

```ts
import { enableExperimentalFragmentVariables } from "@apollo/client";

enableExperimentalFragmentVariables();
```

> [!NOTE]
> This MUST be called before any GraphQL documents are parsed. We recommend calling this in your application's entry file.
