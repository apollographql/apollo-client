import assert from "node:assert";

import type { TypedDocumentNode } from "@apollo/client";
import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { MockLink } from "@apollo/client/testing";
import {
  ObservableStream,
  withProdMode,
} from "@apollo/client/testing/internal";
import { fragmentVariablesSymbol } from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

type MaskedUser = {
  __typename: "User";
  id: string;
};

test("binds variables to the fragment arguments of the root fragment", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  using stream = new ObservableStream(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
      variables: { size: 96 },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("only emits when the data for its own root fragment arguments changes", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  using stream = new ObservableStream(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
      variables: { size: 96 },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small-updated.png" },
  });

  await expect(stream).not.toEmitAnything();

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("watches the same entity with different root fragment arguments", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  using largeStream = new ObservableStream(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
      variables: { size: 96 },
    })
  );

  using smallStream = new ObservableStream(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
      variables: { size: 32 },
    })
  );

  await expect(largeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(smallStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "small.png" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small-updated.png" },
  });

  await expect(smallStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "small-updated.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(largeStream).not.toEmitAnything();
  await expect(smallStream).not.toEmitAnything();
});

test("applies fragment argument defaults of the root fragment when variables omit them", async () => {
  const fragment = gql`
    fragment UserCard($size: Int = 48) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    variables: { size: 48 },
    data: { __typename: "User", id: "1", avatar: "medium.png" },
  });

  using stream = new ObservableStream(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "medium.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("emits partial data until data for the root fragment arguments is written", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  using stream = new ObservableStream(
    client.watchFragment({
      fragment,
      from: { __typename: "User", id: "1" },
      variables: { size: 32 },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1" },
    dataState: "partial",
    complete: false,
    missing: {
      avatar: "Can't find field 'avatar' on User:1 object",
    },
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "small.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("passes a root fragment argument through a nested fragment spread", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar(size: $size)
    }

    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    fragmentName: "UserCard",
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large.png" },
  });

  using stream = new ObservableStream(
    client.watchFragment({
      fragment,
      fragmentName: "UserCard",
      from: { __typename: "User", id: "1" },
      variables: { size: 96 },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      __typename: "User",
      id: "1",
      avatar: "large.png",
      [fragmentVariablesSymbol]: { UserAvatar: { size: 96 } },
    },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    fragmentName: "UserAvatar",
    id: "User:1",
    variables: { size: 96 },
    data: { __typename: "User", avatar: "large-updated.png" },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      __typename: "User",
      id: "1",
      avatar: "large-updated.png",
      [fragmentVariablesSymbol]: { UserAvatar: { size: 96 } },
    },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds root fragment arguments for each item when from is an array", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "user-1-large.png" },
  });

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "2", avatar: "user-2-large.png" },
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "2", avatar: "user-2-small.png" },
  });

  using stream = new ObservableStream(
    client.watchFragment({
      fragment,
      from: [
        { __typename: "User", id: "1" },
        { __typename: "User", id: "2" },
      ],
      variables: { size: 96 },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "User", id: "1", avatar: "user-1-large.png" },
      { __typename: "User", id: "2", avatar: "user-2-large.png" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "2", avatar: "user-2-small-updated.png" },
  });

  await expect(stream).not.toEmitAnything();

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "2", avatar: "user-2-large-updated.png" },
  });

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "User", id: "1", avatar: "user-1-large.png" },
      { __typename: "User", id: "2", avatar: "user-2-large-updated.png" },
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("masks nested fragment spreads with arguments when data masking is enabled", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
      ...UserAvatar(size: 32)
    }

    fragment UserAvatar($size: Int) on User {
      smallAvatar: avatar(size: $size)
    }
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: ApolloLink.empty(),
  });

  client.writeFragment({
    fragment,
    fragmentName: "UserCard",
    id: "User:1",
    variables: { size: 96 },
    data: {
      __typename: "User",
      id: "1",
      avatar: "large.png",
      smallAvatar: "small.png",
    },
  });

  using stream = new ObservableStream(
    client.watchFragment({
      fragment,
      fragmentName: "UserCard",
      from: { __typename: "User", id: "1" },
      variables: { size: 96 },
    })
  );

  await expect(stream).toEmitTypedValue({
    data: {
      __typename: "User",
      id: "1",
      avatar: "large.png",
      [fragmentVariablesSymbol]: { UserAvatar: { size: 32 } },
    },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    fragmentName: "UserAvatar",
    id: "User:1",
    variables: { size: 32 },
    data: { __typename: "User", smallAvatar: "small-updated.png" },
  });

  await expect(stream).not.toEmitAnything();

  client.writeFragment({
    fragment,
    fragmentName: "UserCard",
    id: "User:1",
    variables: { size: 96 },
    data: {
      __typename: "User",
      id: "1",
      avatar: "large-updated.png",
      smallAvatar: "small-updated.png",
    },
  });

  await expect(stream).toEmitTypedValue({
    data: {
      __typename: "User",
      id: "1",
      avatar: "large-updated.png",
      [fragmentVariablesSymbol]: { UserAvatar: { size: 32 } },
    },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
      query Team {
        lead {
          id
          ...UserCard(size: 96)
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();

  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  await expect(stream).not.toEmitAnything();

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments from a query result passed to from without data masking", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
      query Team {
        lead {
          id
          ...UserCard(size: 96)
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: false,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();

  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  await expect(stream).not.toEmitAnything();

  client.writeFragment({
    fragment,
    variables: { size: 96 },
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
  });

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments set from operation variables from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { avatarSize: number }> =
    gql`
    query Team($avatarSize: Int) {
      lead {
        id
        ...UserCard(size: $avatarSize)
      }
    }

    ${fragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { avatarSize: 96 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { avatarSize: 96 } })
  );

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds operation variables used by a fragment from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { size: number }> = gql`
    query Team($size: Int) {
      lead {
        id
        ...UserCard
      }
    }

    ${fragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { size: 96 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { size: 96 } })
  );

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("applies fragment argument defaults instead of operation variables with the same name from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard($size: Int = 48) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser & { largeAvatar: string } },
    { size: number }
  > = gql`
    query Team($size: Int) {
      lead {
        id
        largeAvatar: avatar(size: $size)
        ...UserCard
      }
    }

    ${fragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { size: 96 } },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              largeAvatar: "large.png",
              avatar: "medium.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { size: 96 } })
  );

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "medium.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments for each item from query results passed to from as an array", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser; member: MaskedUser },
    Record<string, never>
  > = gql`
      query Team {
        lead {
          id
          ...UserCard(size: 96)
        }
        member {
          id
          ...UserCard(size: 32)
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
            member: { __typename: "User", id: "1", avatar: "small.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: [data.lead, data.member] })
  );

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "User", id: "1", avatar: "large.png" },
      { __typename: "User", id: "1", avatar: "small.png" },
    ],
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small-updated.png" },
  });

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "User", id: "1", avatar: "large.png" },
      { __typename: "User", id: "1", avatar: "small-updated.png" },
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments for each list item from a query result passed to from as an array", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { members: MaskedUser[] },
    Record<string, never>
  > = gql`
      query Team {
        members {
          id
          ...UserCard(size: 32)
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            members: [
              { __typename: "User", id: "1", avatar: "user-1-small.png" },
              { __typename: "User", id: "2", avatar: "user-2-small.png" },
            ],
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.members })
  );

  await expect(stream).toEmitTypedValue({
    data: [
      { __typename: "User", id: "1", avatar: "user-1-small.png" },
      { __typename: "User", id: "2", avatar: "user-2-small.png" },
    ],
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments of a nested fragment from a fragment result passed to from", async () => {
  const avatarFragment = gql`
    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const cardFragment: TypedDocumentNode<MaskedUser> = gql`
    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar(size: $size)
    }

    ${avatarFragment}
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserCard(size: 96)
      }
    }

    ${cardFragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const queryResult = await queryStream.takeNext();
  assert(queryResult.dataState === "complete");
  const queryData = queryResult.data;

  using cardStream = new ObservableStream(
    client.watchFragment({
      fragment: cardFragment,
      fragmentName: "UserCard",
      from: queryData.lead,
    })
  );

  const cardResult = await cardStream.takeNext();

  assert(cardResult.dataState === "complete");

  const cardData = cardResult.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment: avatarFragment, from: cardData })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments of a nested fragment from a fragment result passed to from in production", async () => {
  using _ = withProdMode();

  const avatarFragment = gql`
    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const cardFragment: TypedDocumentNode<MaskedUser> = gql`
    fragment UserCard($size: Int) on User {
      id
      ...UserAvatar(size: $size)
    }

    ${avatarFragment}
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserCard(size: 96)
      }
    }

    ${cardFragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const queryResult = await queryStream.takeNext();
  assert(queryResult.dataState === "complete");
  const queryData = queryResult.data;

  using cardStream = new ObservableStream(
    client.watchFragment({
      fragment: cardFragment,
      fragmentName: "UserCard",
      from: queryData.lead,
    })
  );

  const cardResult = await cardStream.takeNext();
  assert(cardResult.dataState === "complete");
  const cardData = cardResult.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment: avatarFragment, from: cardData })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments of a nested fragment from a fragment result passed to from without data masking", async () => {
  const avatarFragment = gql`
    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const cardFragment: TypedDocumentNode<MaskedUser> = gql`
      fragment UserCard($size: Int) on User {
        id
        ...UserAvatar(size: $size)
      }

      ${avatarFragment}
    `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
      query Team {
        lead {
          id
          ...UserCard(size: 96)
        }
      }

      ${cardFragment}
    `;

  const client = new ApolloClient({
    dataMasking: false,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const queryResult = await queryStream.takeNext();
  assert(queryResult.dataState === "complete");
  const queryData = queryResult.data;

  using cardStream = new ObservableStream(
    client.watchFragment({
      fragment: cardFragment,
      fragmentName: "UserCard",
      from: queryData.lead,
    })
  );

  const cardResult = await cardStream.takeNext();

  assert(cardResult.dataState === "complete");

  const cardData = cardResult.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment: avatarFragment, from: cardData })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds new fragment arguments from a query result after refetch with new variables", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { avatarSize: number }> =
    gql`
      query Team($avatarSize: Int) {
        lead {
          id
          ...UserCard(size: $avatarSize)
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { avatarSize: 96 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
      {
        request: { query, variables: { avatarSize: 32 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "small.png" },
          },
        },
      },
    ]),
  });

  const observable = client.watchQuery({
    query,
    variables: { avatarSize: 96 },
  });
  using queryStream = new ObservableStream(observable);

  await queryStream.takeNext();
  const largeResult = await queryStream.takeNext();
  assert(largeResult.dataState === "complete");
  const largeData = largeResult.data;

  using largeStream = new ObservableStream(
    client.watchFragment({ fragment, from: largeData.lead })
  );

  await expect(largeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await observable.refetch({ avatarSize: 32 });

  await queryStream.takeNext();
  const smallResult = await queryStream.takeNext();
  assert(smallResult.dataState === "complete");
  const smallData = smallResult.data;

  using smallStream = new ObservableStream(
    client.watchFragment({ fragment, from: smallData.lead })
  );

  await expect(smallStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "small.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(largeStream).not.toEmitAnything();
  await expect(smallStream).not.toEmitAnything();
});

test("binds new fragment arguments from a query result after setVariables", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { avatarSize: number }> =
    gql`
      query Team($avatarSize: Int) {
        lead {
          id
          ...UserCard(size: $avatarSize)
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { avatarSize: 96 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
      {
        request: { query, variables: { avatarSize: 32 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "small.png" },
          },
        },
      },
    ]),
  });

  const observable = client.watchQuery({
    query,
    variables: { avatarSize: 96 },
  });
  using queryStream = new ObservableStream(observable);

  await queryStream.takeNext();
  const largeResult = await queryStream.takeNext();
  assert(largeResult.dataState === "complete");
  const largeData = largeResult.data;

  using largeStream = new ObservableStream(
    client.watchFragment({ fragment, from: largeData.lead })
  );

  await expect(largeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await observable.setVariables({ avatarSize: 32 });

  await queryStream.takeNext();
  const smallResult = await queryStream.takeNext();
  assert(smallResult.dataState === "complete");
  const smallData = smallResult.data;

  using smallStream = new ObservableStream(
    client.watchFragment({ fragment, from: smallData.lead })
  );

  await expect(smallStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "small.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(largeStream).not.toEmitAnything();
  await expect(smallStream).not.toEmitAnything();
});

test("binds new fragment arguments from a query result after reobserve with new variables", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { avatarSize: number }> =
    gql`
      query Team($avatarSize: Int) {
        lead {
          id
          ...UserCard(size: $avatarSize)
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { avatarSize: 96 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
      {
        request: { query, variables: { avatarSize: 32 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "small.png" },
          },
        },
      },
    ]),
  });

  const observable = client.watchQuery({
    query,
    variables: { avatarSize: 96 },
  });
  using queryStream = new ObservableStream(observable);

  await queryStream.takeNext();
  const largeResult = await queryStream.takeNext();
  assert(largeResult.dataState === "complete");
  const largeData = largeResult.data;

  using largeStream = new ObservableStream(
    client.watchFragment({ fragment, from: largeData.lead })
  );

  await expect(largeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await observable.reobserve({ variables: { avatarSize: 32 } });

  await queryStream.takeNext();
  const smallResult = await queryStream.takeNext();
  assert(smallResult.dataState === "complete");
  const smallData = smallResult.data;

  using smallStream = new ObservableStream(
    client.watchFragment({ fragment, from: smallData.lead })
  );

  await expect(smallStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "small.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(largeStream).not.toEmitAnything();
  await expect(smallStream).not.toEmitAnything();
});

test("binds fragment arguments for each sibling fragment from a query result passed to from", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const badgeFragment = gql`
    fragment UserBadge($size: Int) on User {
      id
      badge(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
      query Team {
        lead {
          id
          ...UserCard(size: 96)
          ...UserBadge(size: 32)
        }
      }

      ${cardFragment}
      ${badgeFragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              avatar: "large.png",
              badge: "small-badge.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using cardStream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  using badgeStream = new ObservableStream(
    client.watchFragment({ fragment: badgeFragment, from: data.lead })
  );

  await expect(cardStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(badgeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", badge: "small-badge.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(cardStream).not.toEmitAnything();
  await expect(badgeStream).not.toEmitAnything();
});

test("binds fragment arguments for each sibling fragment with different fragment variables from a query result passed to from", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const badgeFragment = gql`
    fragment UserBadge($color: String) on User {
      id
      badge(color: $color)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { badgeColor: string }> =
    gql`
      query Team($badgeColor: String) {
        lead {
          id
          ...UserCard(size: 96)
          ...UserBadge(color: $badgeColor)
        }
      }

      ${cardFragment}
      ${badgeFragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { badgeColor: "gold" } },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              avatar: "large.png",
              badge: "gold-badge.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { badgeColor: "gold" } })
  );

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using cardStream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  using badgeStream = new ObservableStream(
    client.watchFragment({ fragment: badgeFragment, from: data.lead })
  );

  await expect(cardStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(badgeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", badge: "gold-badge.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(cardStream).not.toEmitAnything();
  await expect(badgeStream).not.toEmitAnything();
});

test("binds fragment arguments for each sibling fragment with different fragment variables from a query result passed to from without data masking", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const badgeFragment = gql`
    fragment UserBadge($color: String) on User {
      id
      badge(color: $color)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { badgeColor: string }> =
    gql`
      query Team($badgeColor: String) {
        lead {
          id
          ...UserCard(size: 96)
          ...UserBadge(color: $badgeColor)
        }
      }

      ${cardFragment}
      ${badgeFragment}
    `;

  const client = new ApolloClient({
    dataMasking: false,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { badgeColor: "gold" } },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              avatar: "large.png",
              badge: "gold-badge.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { badgeColor: "gold" } })
  );

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using cardStream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  using badgeStream = new ObservableStream(
    client.watchFragment({ fragment: badgeFragment, from: data.lead })
  );

  await expect(cardStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(badgeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", badge: "gold-badge.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(cardStream).not.toEmitAnything();
  await expect(badgeStream).not.toEmitAnything();
});

test("binds operation variables for a fragment with a sibling fragment argument of the same name from a query result passed to from", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const badgeFragment = gql`
    fragment UserBadge on User {
      id
      badge(size: $size)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { size: number }> = gql`
        query Team($size: Int) {
          lead {
            id
            ...UserCard(size: 96)
            ...UserBadge
          }
        }

        ${cardFragment}
        ${badgeFragment}
      `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { size: 32 } },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              avatar: "large.png",
              badge: "small-badge.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { size: 32 } })
  );

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using cardStream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  using badgeStream = new ObservableStream(
    client.watchFragment({ fragment: badgeFragment, from: data.lead })
  );

  await expect(cardStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(badgeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", badge: "small-badge.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(cardStream).not.toEmitAnything();
  await expect(badgeStream).not.toEmitAnything();
});

test("binds fragment arguments for sibling fragments of a nested fragment from a fragment result passed to from", async () => {
  const avatarFragment = gql`
    fragment UserAvatar($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const badgeFragment = gql`
    fragment UserBadge($size: Int) on User {
      badge(size: $size)
    }
  `;

  const cardFragment: TypedDocumentNode<MaskedUser> = gql`
      fragment UserCard on User {
        id
        ...UserAvatar(size: 96)
        ...UserBadge(size: 32)
      }

      ${avatarFragment}
      ${badgeFragment}
    `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserCard
      }
    }

    ${cardFragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              avatar: "large.png",
              badge: "small-badge.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const queryResult = await queryStream.takeNext();
  assert(queryResult.dataState === "complete");
  const queryData = queryResult.data;

  using cardStream = new ObservableStream(
    client.watchFragment({
      fragment: cardFragment,
      fragmentName: "UserCard",
      from: queryData.lead,
    })
  );

  const cardResult = await cardStream.takeNext();
  assert(cardResult.dataState === "complete");
  const cardData = cardResult.data;

  using avatarStream = new ObservableStream(
    client.watchFragment({ fragment: avatarFragment, from: cardData })
  );

  using badgeStream = new ObservableStream(
    client.watchFragment({ fragment: badgeFragment, from: cardData })
  );

  await expect(avatarStream).toEmitTypedValue({
    data: { __typename: "User", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(badgeStream).toEmitTypedValue({
    data: { __typename: "User", badge: "small-badge.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(avatarStream).not.toEmitAnything();
  await expect(badgeStream).not.toEmitAnything();
});

test("binds fragment arguments for the same fragment at different depths from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser & { bestFriend: MaskedUser } },
    Record<string, never>
  > = gql`
      query Team {
        lead {
          id
          ...UserCard(size: 96)
          bestFriend {
            id
            ...UserCard(size: 32)
          }
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              avatar: "user-1-large.png",
              bestFriend: {
                __typename: "User",
                id: "2",
                avatar: "user-2-small.png",
              },
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using leadStream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  using bestFriendStream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead.bestFriend })
  );

  await expect(leadStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "user-1-large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(bestFriendStream).toEmitTypedValue({
    data: { __typename: "User", id: "2", avatar: "user-2-small.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(leadStream).not.toEmitAnything();
  await expect(bestFriendStream).not.toEmitAnything();
});

test("binds fragment arguments of a fragment spread inside an inline fragment from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
      query Team {
        lead {
          id
          ... on User {
            ...UserCard(size: 96)
          }
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments of an unmasked fragment from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser & { avatar: string } },
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserCard(size: 96) @unmask
      }
    }

    ${fragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  client.writeFragment({
    fragment,
    variables: { size: 32 },
    data: { __typename: "User", id: "1", avatar: "small.png" },
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments passed through an unmasked fragment from a query result passed to from", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const detailsFragment = gql`
    fragment UserDetails($size: Int) on User {
      id
      name
      ...UserCard(size: $size)
    }

    ${cardFragment}
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser & { name: string } },
    Record<string, never>
  > = gql`
      query Team {
        lead {
          ...UserDetails(size: 96) @unmask
        }
      }

      ${detailsFragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              name: "Alice",
              avatar: "large.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds input object fragment arguments that contain operation variables from a query result passed to from", async () => {
  const fragment = gql`
    fragment UserCard($options: AvatarOptions) on User {
      id
      avatar(options: $options)
    }
  `;

  const query: TypedDocumentNode<{ lead: MaskedUser }, { avatarSize: number }> =
    gql`
      query Team($avatarSize: Int) {
        lead {
          id
          ...UserCard(options: { size: $avatarSize, format: "png" })
        }
      }

      ${fragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query, variables: { avatarSize: 96 } },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(
    client.watchQuery({ query, variables: { avatarSize: 96 } })
  );

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds fragment arguments of a sibling fragment and a fragment nested in an unmasked fragment from a query result passed to from", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const badgeFragment = gql`
    fragment UserBadge($color: String) on User {
      id
      badge(color: $color)
    }
  `;

  const detailsFragment = gql`
    fragment UserDetails($size: Int) on User {
      id
      name
      ...UserCard(size: $size)
    }

    ${cardFragment}
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser & { name: string } },
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserDetails(size: 96) @unmask
        ...UserBadge(color: "gold")
      }
    }

    ${detailsFragment}
    ${badgeFragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              name: "Alice",
              avatar: "large.png",
              badge: "gold-badge.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using cardStream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  using badgeStream = new ObservableStream(
    client.watchFragment({ fragment: badgeFragment, from: data.lead })
  );

  await expect(cardStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(badgeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", badge: "gold-badge.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(cardStream).not.toEmitAnything();
  await expect(badgeStream).not.toEmitAnything();
});

test("binds fragment arguments of fragments nested in sibling unmasked fragments from a query result passed to from", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const badgeFragment = gql`
    fragment UserBadge($color: String) on User {
      id
      badge(color: $color)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser & { name: string; email: string } },
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserDetails @unmask
        ...UserContact @unmask
      }
    }

    fragment UserDetails on User {
      name
      ...UserCard(size: 96)
    }

    fragment UserContact on User {
      email
      ...UserBadge(color: "gold")
    }

    ${cardFragment}
    ${badgeFragment}
  `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              name: "Alice",
              email: "alice@example.com",
              avatar: "large.png",
              badge: "gold-badge.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using cardStream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  using badgeStream = new ObservableStream(
    client.watchFragment({ fragment: badgeFragment, from: data.lead })
  );

  await expect(cardStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(badgeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", badge: "gold-badge.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(cardStream).not.toEmitAnything();
  await expect(badgeStream).not.toEmitAnything();
});

test("binds fragment arguments of fragments nested in sibling fragments from a query result passed to from without data masking", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const badgeFragment = gql`
    fragment UserBadge($color: String) on User {
      id
      badge(color: $color)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser & { name: string; email: string } },
    Record<string, never>
  > = gql`
    query Team {
      lead {
        id
        ...UserDetails
        ...UserContact
      }
    }

    fragment UserDetails on User {
      name
      ...UserCard(size: 96)
    }

    fragment UserContact on User {
      email
      ...UserBadge(color: "gold")
    }

    ${cardFragment}
    ${badgeFragment}
  `;

  const client = new ApolloClient({
    dataMasking: false,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: {
              __typename: "User",
              id: "1",
              name: "Alice",
              email: "alice@example.com",
              avatar: "large.png",
              badge: "gold-badge.png",
            },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using cardStream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  using badgeStream = new ObservableStream(
    client.watchFragment({ fragment: badgeFragment, from: data.lead })
  );

  await expect(cardStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(badgeStream).toEmitTypedValue({
    data: { __typename: "User", id: "1", badge: "gold-badge.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(cardStream).not.toEmitAnything();
  await expect(badgeStream).not.toEmitAnything();
});

test("binds fragment arguments passed through an unmasked fragment spread on the root query from a query result passed to from", async () => {
  const cardFragment = gql`
    fragment UserCard($size: Int) on User {
      id
      avatar(size: $size)
    }
  `;

  const query: TypedDocumentNode<
    { lead: MaskedUser },
    Record<string, never>
  > = gql`
      query Team {
        ...TeamFields(size: 96) @unmask
      }

      fragment TeamFields($size: Int) on Query {
        lead {
          id
          ...UserCard(size: $size)
        }
      }

      ${cardFragment}
    `;

  const client = new ApolloClient({
    dataMasking: true,
    cache: new InMemoryCache(),
    link: new MockLink([
      {
        request: { query },
        result: {
          data: {
            lead: { __typename: "User", id: "1", avatar: "large.png" },
          },
        },
      },
    ]),
  });

  using queryStream = new ObservableStream(client.watchQuery({ query }));

  await queryStream.takeNext();
  const result = await queryStream.takeNext();
  assert(result.dataState === "complete");
  const data = result.data;

  using stream = new ObservableStream(
    client.watchFragment({ fragment: cardFragment, from: data.lead })
  );

  await expect(stream).toEmitTypedValue({
    data: { __typename: "User", id: "1", avatar: "large.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});
