import {
  ApolloClient,
  ApolloLink,
  enableExperimentalFragmentVariables,
  gql,
} from "@apollo/client";
import { InMemoryCache } from "@apollo/client/cache";
import { ObservableStream } from "@apollo/client/testing/internal";

enableExperimentalFragmentVariables();

const fragment = gql`
  fragment UserCard($size: Int) on User {
    id
    avatar(size: $size)
  }
`;

test("binds variables to the fragment arguments of the root fragment", async () => {
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
    data: { __typename: "User", id: "1", avatar: "large.png" },
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
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});

test("binds root fragment arguments for each item when from is an array", async () => {
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
    data: { __typename: "User", id: "1", avatar: "large.png" },
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
    data: { __typename: "User", id: "1", avatar: "large-updated.png" },
    dataState: "complete",
    complete: true,
  });

  await expect(stream).not.toEmitAnything();
});
