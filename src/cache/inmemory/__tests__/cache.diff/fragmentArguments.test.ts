import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import { InMemoryCache, MissingFieldError } from "@apollo/client/cache";
import { markAsStreaming, spyOnConsole } from "@apollo/client/testing/internal";
import {
  fragmentInfoSymbol,
  handleIncrementalSymbol,
} from "@apollo/client/utilities/internal";

enableExperimentalFragmentVariables();

test("evaluates @defer on a fragment spread with the parent fragment scope", () => {
  const query = gql`
    query Team {
      lead {
        ...UserCard(deferDetails: false)
      }
    }

    fragment UserCard($deferDetails: Boolean!) on User {
      id
      ...UserDetails(deferDetails: true) @defer(if: $deferDetails)
    }

    fragment UserDetails($deferDetails: Boolean!) on User {
      name
      nickname @include(if: $deferDetails)
    }
  `;

  const cache = new InMemoryCache();

  cache.restore({
    ROOT_QUERY: {
      __typename: "Query",
      lead: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      "Can't find field 'name' on User:1 object",
      {
        lead: {
          name: "Can't find field 'name' on User:1 object",
          nickname: "Can't find field 'nickname' on User:1 object",
        },
      },
      query,
      {}
    ),
  });
});

test("evaluates @include with operation variables inside a fragment with arguments when pruning a pending @defer boundary", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query ($show: Boolean!) {
      greeting {
        ...GreetingFields(punctuation: "!")
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }

    fragment GreetingFields($punctuation: String) on Greeting {
      message(punctuation: $punctuation)
      sender @include(if: $show)
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      variables: { show: true },
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world!",
          sender: "Alice",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
          },
        },
      },
    });
  }

  expect(
    cache.diff({
      query,
      variables: { show: true },
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world!",
        sender: "Alice",
        [fragmentInfoSymbol]: {
          operationVariables: { show: true },
          fragments: {
            GreetingFields: { variables: { punctuation: "!" } },
          },
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("resolves fragment arguments set from operation variables when pruning a pending @defer boundary", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query ($show: Boolean!) {
      greeting {
        ...GreetingFields(showSender: $show)
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }

    fragment GreetingFields($showSender: Boolean!) on Greeting {
      message
      sender @include(if: $showSender)
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      variables: { show: true },
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          sender: "Alice",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
          },
        },
      },
    });
  }

  expect(
    cache.diff({
      query,
      variables: { show: true },
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        sender: "Alice",
        [fragmentInfoSymbol]: {
          operationVariables: { show: true },
          fragments: {
            GreetingFields: { variables: { showSender: true } },
          },
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("resolves nested fragment arguments set from the parent fragment scope when pruning a pending @defer boundary", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query ($show: Boolean!) {
      greeting {
        ...GreetingFields(showSender: $show)
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }

    fragment GreetingFields($showSender: Boolean!) on Greeting {
      message
      ...SenderFields(include: $showSender)
    }

    fragment SenderFields($include: Boolean!) on Greeting {
      sender @include(if: $include)
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      variables: { show: true },
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          sender: "Alice",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
          },
        },
      },
    });
  }

  expect(
    cache.diff({
      query,
      variables: { show: true },
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        sender: "Alice",
        [fragmentInfoSymbol]: {
          operationVariables: { show: true },
          fragments: {
            GreetingFields: { variables: { showSender: true } },
            SenderFields: { variables: { include: true } },
          },
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("prunes a pending @defer boundary with the current operation variables inside a fragment whose argument shadows the operation variable", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query Team($x: Boolean!) {
      user {
        ...Foo(x: false)
      }
    }

    fragment Foo($x: Boolean!) on User {
      id
      nickname @include(if: $x)
      friend {
        id
        ...Bar
        ... @defer {
          details {
            a
            b
          }
        }
      }
    }

    fragment Bar on User {
      name @include(if: $x)
    }
  `;

  cache.restore({
    ROOT_QUERY: {
      __typename: "Query",
      user: { __ref: "User:1" },
    },
    "User:1": {
      __typename: "User",
      id: "1",
      friend: { __ref: "User:2" },
    },
    "User:2": {
      __typename: "User",
      id: "2",
      name: "Friend",
      details: { __typename: "Details", a: "A" },
    },
  });

  expect(
    cache.diff({
      query,
      variables: { x: true },
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    result: markAsStreaming({
      user: {
        __typename: "User",
        id: "1",
        friend: {
          __typename: "User",
          id: "2",
          name: "Friend",
          [fragmentInfoSymbol]: {
            operationVariables: { x: true },
            fragments: {},
          },
        },
        [fragmentInfoSymbol]: {
          operationVariables: { x: true },
          fragments: { Foo: { variables: { x: false } } },
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });

  expect(
    cache.diff({
      query,
      variables: { x: false },
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: undefined,
    })
  ).toStrictEqualTyped({
    result: markAsStreaming({
      user: {
        __typename: "User",
        id: "1",
        friend: {
          __typename: "User",
          id: "2",
          [fragmentInfoSymbol]: {
            operationVariables: { x: false },
            fragments: {},
          },
        },
        [fragmentInfoSymbol]: {
          operationVariables: { x: false },
          fragments: { Foo: { variables: { x: false } } },
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});
