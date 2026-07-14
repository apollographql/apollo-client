import { gql } from "graphql-tag";

import { InMemoryCache, MissingFieldError } from "@apollo/client/cache";
import { markAsStreaming, spyOnConsole } from "@apollo/client/testing/internal";
import { handleIncrementalSymbol } from "@apollo/client/utilities/internal";

test('returns dataState "complete" when the cache fully satisfies the query', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: true,
    dataState: "complete",
    missing: undefined,
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
  });
});

test('returns dataState "streaming" when only deferred fields are missing with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
  });
});

test('returns dataState "streaming" when only deferred fields are missing with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
  });
});

test('returns dataState "partial" when non-deferred fields are missing with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        author
        ... on Greeting @defer {
          recipient {
            name
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
        },
      },
    });
  }

  const missingObject = { __typename: "Greeting", message: "Hello world" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "partial",
    missing: new MissingFieldError(
      getMissingMessage("author", missingObject),
      {
        greeting: {
          author: getMissingMessage("author", missingObject),
          recipient: getMissingMessage("recipient", missingObject),
        },
      },
      query,
      {}
    ),
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
  });
});

test('returns dataState "empty" when non-deferred fields are missing with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        author
        ... on Greeting @defer {
          recipient {
            name
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
        },
      },
    });
  }

  const missingObject = { __typename: "Greeting", message: "Hello world" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "empty",
    missing: new MissingFieldError(
      getMissingMessage("author", missingObject),
      {
        greeting: {
          author: getMissingMessage("author", missingObject),
          recipient: getMissingMessage("recipient", missingObject),
        },
      },
      query,
      {}
    ),
    result: null,
  });
});

test("strips incomplete fields inside a defer boundary when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
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
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
  });
});

test('keeps incomplete fields inside a defer boundary when returnPartialData is true and reports dataState "partial"', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
          },
        },
      },
    });
  }

  const missingObject = { __typename: "Person", name: "Cached Alice" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "partial",
    missing: new MissingFieldError(
      getMissingMessage("email", missingObject),
      {
        greeting: {
          recipient: {
            email: getMissingMessage("email", missingObject),
          },
        },
      },
      query,
      {}
    ),
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Cached Alice",
        },
      },
    },
  });
});

test("does not treat overlapping non-deferred fields as partial when only deferred siblings are missing", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
        }
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Alice",
          },
        },
      },
    });
  }

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
      },
    }),
  });
});

test("strips incomplete fields inside a deferred named fragment with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ...GreetingRecipient @defer
      }
    }

    fragment GreetingRecipient on Greeting {
      recipient {
        name
        email
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
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
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
  });
});

test("strips incomplete nested fields inside a nested defer boundary with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            profile {
              bio
              avatarUrl
            }
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Alice",
            profile: {
              __typename: "Profile",
              bio: "Hello",
            },
          },
        },
      },
    });
  }

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
  });
});

test("returns incomplete deferred data written only inside the boundary without non-deferred siblings as streaming when fully absent", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
  });
});

test('returns dataState "complete" for pure @stream when all selected fields on written items are present', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: true,
    dataState: "complete",
    missing: undefined,
    result: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
  });
});

test("keeps complete stream list items and drops incomplete ones when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3" },
        ],
      },
    });
  }

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: true,
    dataState: "complete",
    missing: undefined,
    result: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
  });
});

test('returns dataState "empty" when every stream list item is incomplete with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friendList: [
          { __typename: "Friend", id: "1" },
          { __typename: "Friend", id: "2" },
        ],
      },
    });
  }

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "empty",
    missing: undefined,
    result: null,
  });
});

test('keeps incomplete stream list items when returnPartialData is true and reports dataState "partial"', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2" },
        ],
      },
    });
  }

  const missingObject = { __typename: "Friend", id: "2" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "partial",
    missing: new MissingFieldError(
      getMissingMessage("name", missingObject),
      {
        friendList: {
          1: {
            name: getMissingMessage("name", missingObject),
          },
        },
      },
      query,
      {}
    ),
    result: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2" },
      ],
    },
  });
});

test("drops incomplete stream items and strips deferred holes under a combined @stream and @defer selection", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
        ... on Friend @defer {
          email
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friendList: [
          {
            __typename: "Friend",
            id: "1",
            name: "Luke",
          },
          {
            __typename: "Friend",
            id: "2",
          },
        ],
      },
    });
  }

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
        },
      ],
    }),
  });
});

test("returns streaming for complete non-deferred stream fields when only deferred fields are missing", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
        ... on Friend @defer {
          email
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
        },
      ],
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
        },
      ],
    }),
  });
});

test("complete is only true when dataState is complete", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
  });

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Alice",
          },
        },
      },
    });
  }

  const missingObject = { __typename: "Person", name: "Alice" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "partial",
    missing: new MissingFieldError(
      getMissingMessage("email", missingObject),
      {
        greeting: {
          recipient: {
            email: getMissingMessage("email", missingObject),
          },
        },
      },
      query,
      {}
    ),
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
      },
    },
  });

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: true,
    dataState: "complete",
    missing: undefined,
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    },
  });
});

test('returns dataState "empty" for incomplete fields under @defer(if: false) with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer(if: false) {
          recipient {
            name
            email
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
          },
        },
      },
    });
  }

  const missingObject = { __typename: "Person", name: "Cached Alice" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "empty",
    missing: new MissingFieldError(
      getMissingMessage("email", missingObject),
      {
        greeting: {
          recipient: {
            email: getMissingMessage("email", missingObject),
          },
        },
      },
      query,
      {}
    ),
    result: null,
  });
});

test('returns dataState "empty" for incomplete fields under @defer(if: $shouldDefer) when the variable disables defer with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query ($shouldDefer: Boolean!) {
      greeting {
        message
        ... on Greeting @defer(if: $shouldDefer) {
          recipient {
            name
            email
          }
        }
      }
    }
  `;
  const variables = { shouldDefer: false };

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      variables,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Cached Alice",
          },
        },
      },
    });
  }

  const missingObject = { __typename: "Person", name: "Cached Alice" };

  expect(
    cache.diff({
      query,
      variables,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "empty",
    missing: new MissingFieldError(
      getMissingMessage("email", missingObject),
      {
        greeting: {
          recipient: {
            email: getMissingMessage("email", missingObject),
          },
        },
      },
      query,
      variables
    ),
    result: null,
  });
});

test('returns dataState "streaming" for incomplete fields under @defer(if: $shouldDefer) when the variable enables defer with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query ($shouldDefer: Boolean!) {
      greeting {
        message
        ... on Greeting @defer(if: $shouldDefer) {
          recipient {
            name
            email
          }
        }
      }
    }
  `;
  const variables = { shouldDefer: true };

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      variables,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
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
      variables,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    complete: false,
    dataState: "streaming",
    missing: undefined,
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
  });
});

function getMissingMessage(fieldName: string, obj: Record<string, unknown>) {
  return `Can't find field '${fieldName}' on object ${JSON.stringify(
    obj,
    null,
    2
  )}`;
}
