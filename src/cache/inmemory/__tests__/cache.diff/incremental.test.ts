import { gql } from "graphql-tag";

import {
  InMemoryCache,
  isReference,
  MissingFieldError,
} from "@apollo/client/cache";
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
    dataState: "complete",
    complete: true,
    missing: undefined,
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    dataState: "partial",
    complete: false,
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
    result: null,
    dataState: "empty",
    complete: false,
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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
    dataState: "partial",
    complete: false,
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
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("does not surface incomplete cached defer-only fields under an overlapping parent with returnPartialData: false", () => {
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
            phone
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
            email: "cached@example.com",
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
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" under an overlapping parent when a defer-only field is present and another is still missing with returnPartialData: true', () => {
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
            phone
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
            email: "cached@example.com",
          },
        },
      },
    });
  }

  const missingObject = {
    __typename: "Person",
    name: "Alice",
    email: "cached@example.com",
  };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "cached@example.com",
        },
      },
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("phone", missingObject),
      {
        greeting: {
          recipient: {
            phone: getMissingMessage("phone", missingObject),
          },
        },
      },
      query,
      {}
    ),
  });
});

test("does not surface incomplete cached deep defer-only fields under an overlapped path with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        recipient {
          address {
            city
          }
        }
        ... on Greeting @defer {
          recipient {
            address {
              city
              postalCode
              line2
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
            address: {
              __typename: "Address",
              city: "New York",
              postalCode: "00000",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          address: {
            __typename: "Address",
            city: "New York",
          },
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" when overlapping non-deferred fields are contributed by a fragment spread', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ...GreetingRecipient
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
      }
    }

    fragment GreetingRecipient on Greeting {
      recipient {
        name
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
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" when overlapping non-deferred fields are contributed by an inline fragment', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting {
          recipient {
            name
          }
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
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" when non-deferred fields for the same response key are split across sibling selection sets', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
        }
        recipient {
          id
        }
        ... on Greeting @defer {
          recipient {
            name
            id
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
            id: "1",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          id: "1",
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" when overlapping non-deferred list fields are complete and only defer-only item fields are missing', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      person {
        id
        friends {
          id
          name
        }
        ... on Person @defer {
          friends {
            id
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
        person: {
          __typename: "Person",
          id: "1",
          friends: [
            { __typename: "Person", id: "2", name: "Leia" },
            { __typename: "Person", id: "3", name: "Han" },
          ],
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
    result: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", name: "Han" },
        ],
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("does not surface incomplete cached defer-only list item fields under an overlapping list parent with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      person {
        id
        friends {
          id
          name
        }
        ... on Person @defer {
          friends {
            id
            name
            email
            phone
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
        person: {
          __typename: "Person",
          id: "1",
          friends: [
            {
              __typename: "Person",
              id: "2",
              name: "Leia",
              email: "cached-leia@example.com",
            },
            {
              __typename: "Person",
              id: "3",
              name: "Han",
            },
          ],
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
    result: markAsStreaming({
      person: {
        __typename: "Person",
        id: "1",
        friends: [
          { __typename: "Person", id: "2", name: "Leia" },
          { __typename: "Person", id: "3", name: "Han" },
        ],
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "empty" when an overlapping non-deferred field is missing even if deferred siblings are present with returnPartialData: false', () => {
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
            email: "alice@example.com",
          },
        },
      },
    });
  }

  const missingObject = {
    __typename: "Person",
    email: "alice@example.com",
  };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingObject),
      {
        greeting: {
          recipient: {
            name: getMissingMessage("name", missingObject),
          },
        },
      },
      query,
      {}
    ),
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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
    result: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "empty" with incomplete stream list items when returnPartialData is false', () => {
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

  const missingRef = { __ref: "Friend:3" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendList: {
          2: { name: getMissingMessage("name", missingRef) },
        },
      },
      query,
      {}
    ),
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
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", { __ref: "Friend:1" }),
      {
        friendList: {
          0: { name: getMissingMessage("name", { __ref: "Friend:1" }) },
          1: { name: getMissingMessage("name", { __ref: "Friend:2" }) },
        },
      },
      query,
      {}
    ),
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

  const missingRef = { __ref: "Friend:2" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2" },
      ],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendList: {
          1: {
            name: getMissingMessage("name", missingRef),
          },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "empty" with incomplete stream items outside defer boundaries under a combined @stream and @defer selection', () => {
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
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("email", { __ref: "Friend:1" }),
      {
        friendList: {
          0: {
            email: getMissingMessage("email", { __ref: "Friend:1" }),
          },
          1: {
            name: getMissingMessage("name", { __ref: "Friend:2" }),
            email: getMissingMessage("email", { __ref: "Friend:2" }),
          },
        },
      },
      query,
      {}
    ),
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
    result: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
        },
      ],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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
    dataState: "partial",
    complete: false,
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
    dataState: "complete",
    complete: true,
    missing: undefined,
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
    result: null,
    dataState: "empty",
    complete: false,
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
    result: null,
    dataState: "empty",
    complete: false,
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "empty" when an incomplete list item appears before complete items with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList {
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
          { __typename: "Friend", id: "2", name: "Han" },
        ],
      },
    });
  }

  const missingRef = { __ref: "Friend:1" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendList: {
          0: { name: getMissingMessage("name", missingRef) },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "partial" when an incomplete list item appears before complete items with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList {
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
          { __typename: "Friend", id: "2", name: "Han" },
        ],
      },
    });
  }

  const missingRef = { __ref: "Friend:1" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      friendList: [
        { __typename: "Friend", id: "1" },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendList: {
          0: { name: getMissingMessage("name", missingRef) },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "streaming" when an earlier list item is still streaming and a later item is complete', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList {
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
        { __typename: "Friend", id: "1", name: "Luke" },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          email: "han@example.com",
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
    result: markAsStreaming({
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        {
          __typename: "Friend",
          id: "2",
          name: "Han",
          email: "han@example.com",
        },
      ],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" when an earlier list item is complete and a later item is still streaming', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList {
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
          email: "luke@example.com",
        },
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
    result: markAsStreaming({
      friendList: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
        },
        { __typename: "Friend", id: "2", name: "Han" },
      ],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" when a complete scalar sibling precedes a partial list with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      meta
      friendList {
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
        meta: "ok",
        friendList: [{ __typename: "Friend", id: "1" }],
      },
    });
  }

  const missingRef = { __ref: "Friend:1" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      meta: "ok",
      friendList: [{ __typename: "Friend", id: "1" }],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendList: {
          0: { name: getMissingMessage("name", missingRef) },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "empty" when a complete scalar sibling precedes a partial list with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      meta
      friendList {
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
        meta: "ok",
        friendList: [{ __typename: "Friend", id: "1" }],
      },
    });
  }

  const missingRef = { __ref: "Friend:1" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendList: {
          0: { name: getMissingMessage("name", missingRef) },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "streaming" when a complete scalar sibling precedes a streaming list', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      meta
      friendList {
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
      meta: "ok",
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
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
    result: markAsStreaming({
      meta: "ok",
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" when a complete object field precedes a streaming sibling object field', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      a {
        x
      }
      b {
        y
        ... on B @defer {
          z
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      a: { __typename: "A", x: 1 },
      b: { __typename: "B", y: 2 },
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
    result: markAsStreaming({
      a: { __typename: "A", x: 1 },
      b: { __typename: "B", y: 2 },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" when a streaming object field precedes a complete sibling object field', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      b {
        y
        ... on B @defer {
          z
        }
      }
      a {
        x
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      a: { __typename: "A", x: 1 },
      b: { __typename: "B", y: 2 },
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
    result: markAsStreaming({
      b: { __typename: "B", y: 2 },
      a: { __typename: "A", x: 1 },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "complete" for a fragment-only root selection set when the cache is fully populated', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      ... on Query {
        hello
      }
    }
  `;

  cache.writeQuery({
    query,
    data: { hello: "world" },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      hello: "world",
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "complete" when an object selection set is only a deferred fragment and that data is fully present', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        ... on Greeting @defer {
          message
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
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "streaming" when an object selection set is only a deferred fragment and that data is absent', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        ... on Greeting @defer {
          message
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" when an object selection set is only a deferred fragment, that data is absent, and __typename is selected', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        __typename
        ... on Greeting @defer {
          message
        }
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      greeting: {
        __typename: "Greeting",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "complete" for an empty list', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList {
        id
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      friendList: [],
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
    result: {
      friendList: [],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "complete" when a nullable object field is explicitly null', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
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
        recipient: null,
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
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: null,
      },
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test("does not reuse a returnPartialData: false empty result when the same query is later read with returnPartialData: true", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        author
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
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("author", missingObject),
      {
        greeting: {
          author: getMissingMessage("author", missingObject),
        },
      },
      query,
      {}
    ),
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("author", missingObject),
      {
        greeting: {
          author: getMissingMessage("author", missingObject),
        },
      },
      query,
      {}
    ),
  });
});

test("does not reuse a returnPartialData: true partial result when the same query is later read with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        author
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
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("author", missingObject),
      {
        greeting: {
          author: getMissingMessage("author", missingObject),
        },
      },
      query,
      {}
    ),
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("author", missingObject),
      {
        greeting: {
          author: getMissingMessage("author", missingObject),
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "streaming" when one of two sibling defer boundaries is still empty', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          author
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
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "complete" when both sibling defer boundaries are fully present', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          author
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
        },
        author: "Jerel",
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
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
        author: "Jerel",
      },
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "empty" when a deferred fragment is excluded via @skip and a non-deferred field is missing', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query ($skipDefer: Boolean!) {
      greeting {
        message
        author
        ... on Greeting @defer @skip(if: $skipDefer) {
          recipient {
            name
          }
        }
      }
    }
  `;
  const variables = { skipDefer: true };

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      variables,
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
      variables,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("author", missingObject),
      {
        greeting: {
          author: getMissingMessage("author", missingObject),
        },
      },
      query,
      variables
    ),
  });
});

test('returns dataState "streaming" when a deferred fragment is included via @include and only deferred fields are missing', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query ($includeDefer: Boolean!) {
      greeting {
        message
        ... on Greeting @defer @include(if: $includeDefer) {
          recipient {
            name
          }
        }
      }
    }
  `;
  const variables = { includeDefer: true };

  cache.writeQuery({
    query,
    variables,
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
      variables,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "complete" when a deferred fragment is excluded via @include(if: false) even if deferred fields are absent', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query ($includeDefer: Boolean!) {
      greeting {
        message
        ... on Greeting @defer @include(if: $includeDefer) {
          recipient {
            name
          }
        }
      }
    }
  `;
  const variables = { includeDefer: false };

  cache.writeQuery({
    query,
    variables,
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
      variables,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "streaming" for nested @defer when the outer boundary is complete and the inner boundary is still empty', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
            }
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
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" for nested @defer when both defer boundaries are still empty', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
            }
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "complete" for nested @defer when both defer boundaries are fully present', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
            }
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
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "partial" for nested @defer when the outer boundary is complete and the inner boundary is incomplete with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
              phone
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
            email: "alice@example.com",
          },
        },
      },
    });
  }

  const missingObject = {
    __typename: "Person",
    name: "Alice",
    email: "alice@example.com",
  };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
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
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("phone", missingObject),
      {
        greeting: {
          recipient: {
            phone: getMissingMessage("phone", missingObject),
          },
        },
      },
      query,
      {}
    ),
  });
});

test("strips an incomplete nested inner @defer while keeping a complete outer @defer result as streaming when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
              phone
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
            email: "alice@example.com",
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
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" for nested @defer when the outer boundary has incomplete non-deferred fields with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            phone
            ... on Person @defer {
              email
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
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("phone", missingObject),
      {
        greeting: {
          recipient: {
            phone: getMissingMessage("phone", missingObject),
            email: getMissingMessage("email", missingObject),
          },
        },
      },
      query,
      {}
    ),
  });
});

test("strips an incomplete outer @defer boundary that contains a nested @defer when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            phone
            ... on Person @defer {
              email
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "streaming" for nested @defer when only the outer boundary is empty and the inner selection would otherwise be complete', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
            }
          }
        }
      }
    }
  `;

  // recipient exists in the cache from another write path, but the outer
  // deferred field path is not linked from greeting yet.
  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
        }
      }
    `,
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("strips an incomplete outer @defer even when the nested inner @defer is complete with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            phone
            ... on Person @defer {
              email
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
            email: "alice@example.com",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" for nested @defer when the outer boundary is incomplete and the inner boundary is complete with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            phone
            ... on Person @defer {
              email
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
            email: "alice@example.com",
          },
        },
      },
    });
  }

  const missingObject = {
    __typename: "Person",
    name: "Alice",
    email: "alice@example.com",
  };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
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
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("phone", missingObject),
      {
        greeting: {
          recipient: {
            phone: getMissingMessage("phone", missingObject),
          },
        },
      },
      query,
      {}
    ),
  });
});

test("strips an incomplete outer @defer when the nested inner @defer is also incomplete with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            phone
            ... on Person @defer {
              email
              age
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
            email: "alice@example.com",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" for nested @defer when both outer non-deferred and inner deferred fields are incomplete with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            phone
            ... on Person @defer {
              email
              age
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
            email: "alice@example.com",
          },
        },
      },
    });
  }

  const missingObject = {
    __typename: "Person",
    name: "Alice",
    email: "alice@example.com",
  };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
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
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("phone", missingObject),
      {
        greeting: {
          recipient: {
            phone: getMissingMessage("phone", missingObject),
            age: getMissingMessage("age", missingObject),
          },
        },
      },
      query,
      {}
    ),
  });
});

test("strips only the incomplete nested inner @defer among sibling inners while keeping complete sibling deferred fields when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
            }
            ... on Person @defer {
              phone
              age
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
            email: "alice@example.com",
            phone: "555-0100",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" for nested sibling @defer inners when one is incomplete and one is complete with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
            }
            ... on Person @defer {
              phone
              age
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
            email: "alice@example.com",
            phone: "555-0100",
          },
        },
      },
    });
  }

  const missingObject = {
    __typename: "Person",
    name: "Alice",
    email: "alice@example.com",
    phone: "555-0100",
  };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
          phone: "555-0100",
        },
      },
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("age", missingObject),
      {
        greeting: {
          recipient: {
            age: getMissingMessage("age", missingObject),
          },
        },
      },
      query,
      {}
    ),
  });
});

test("strips an incomplete nested inner @defer while keeping a streaming sibling inner empty when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
            }
            ... on Person @defer {
              phone
              age
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
            phone: "555-0100",
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
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("strips only the incomplete branch in a 3-level nested @defer chain when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
            ... on Person @defer {
              email
              ... on Person @defer {
                phone
                age
              }
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
            email: "alice@example.com",
            phone: "555-0100",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
          email: "alice@example.com",
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("strips nested partial data from one sibling outer @defer while keeping another complete outer @defer when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          author {
            name
            ... on Person @defer {
              email
              phone
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
          },
          author: {
            __typename: "Person",
            name: "Bob",
            email: "bob@example.com",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
        author: {
          __typename: "Person",
          name: "Bob",
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("strips nested partial data from one sibling outer @defer while ignoring another streaming outer @defer when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
          }
        }
        ... on Greeting @defer {
          author {
            name
            ... on Person @defer {
              email
              phone
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
          author: {
            __typename: "Person",
            name: "Bob",
            email: "bob@example.com",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        author: {
          __typename: "Person",
          name: "Bob",
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("strips nested partial data from one sibling outer @defer while stripping another partial outer @defer when returnPartialData is false", () => {
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
        ... on Greeting @defer {
          author {
            name
            ... on Person @defer {
              email
              phone
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
          },
          author: {
            __typename: "Person",
            name: "Bob",
            email: "bob@example.com",
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
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        author: {
          __typename: "Person",
          name: "Bob",
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "complete" for a fully populated 2d scalar array', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      matrix
    }
  `;

  cache.writeQuery({
    query,
    data: {
      matrix: [
        [1, 2],
        [3, 4],
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
    result: {
      matrix: [
        [1, 2],
        [3, 4],
      ],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "complete" for a fully populated 2d object array', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendGroups {
        id
        name
      }
    }
  `;

  cache.writeQuery({
    query,
    data: {
      friendGroups: [
        [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
        ],
        [{ __typename: "Friend", id: "3", name: "Leia" }],
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
    result: {
      friendGroups: [
        [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
        ],
        [{ __typename: "Friend", id: "3", name: "Leia" }],
      ],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test('returns dataState "empty" for a 2d object array with an incomplete nested item when returnPartialData is false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendGroups {
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
        friendGroups: [
          [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2" },
          ],
          [{ __typename: "Friend", id: "3", name: "Leia" }],
        ],
      },
    });
  }

  const missingRef = { __ref: "Friend:2" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendGroups: {
          0: {
            1: { name: getMissingMessage("name", missingRef) },
          },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "partial" for a 2d object array with an incomplete nested item when returnPartialData is true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendGroups {
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
        friendGroups: [
          [
            { __typename: "Friend", id: "1", name: "Luke" },
            { __typename: "Friend", id: "2" },
          ],
          [{ __typename: "Friend", id: "3", name: "Leia" }],
        ],
      },
    });
  }

  const missingRef = { __ref: "Friend:2" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      friendGroups: [
        [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2" },
        ],
        [{ __typename: "Friend", id: "3", name: "Leia" }],
      ],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendGroups: {
          0: {
            1: { name: getMissingMessage("name", missingRef) },
          },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "streaming" for a 2d object array when only deferred fields are missing on a nested item', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendGroups {
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
      friendGroups: [
        [
          { __typename: "Friend", id: "1", name: "Luke" },
          {
            __typename: "Friend",
            id: "2",
            name: "Han",
            email: "han@example.com",
          },
        ],
        [{ __typename: "Friend", id: "3", name: "Leia" }],
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
    result: markAsStreaming({
      friendGroups: [
        [
          { __typename: "Friend", id: "1", name: "Luke" },
          {
            __typename: "Friend",
            id: "2",
            name: "Han",
            email: "han@example.com",
          },
        ],
        [{ __typename: "Friend", id: "3", name: "Leia" }],
      ],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" for a 2d object array when a nested item has incomplete non-deferred fields with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendGroups {
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
        friendGroups: [
          [{ __typename: "Friend", id: "1" }],
          [{ __typename: "Friend", id: "2", name: "Leia" }],
        ],
      },
    });
  }

  const missingRef = { __ref: "Friend:1" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      friendGroups: [
        [{ __typename: "Friend", id: "1" }],
        [{ __typename: "Friend", id: "2", name: "Leia" }],
      ],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendGroups: {
          0: {
            0: {
              name: getMissingMessage("name", missingRef),
              email: getMissingMessage("email", missingRef),
            },
          },
          1: {
            0: {
              email: getMissingMessage("email", { __ref: "Friend:2" }),
            },
          },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "complete" with an empty object when all fields are skipped', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      firstName @include(if: false)
      lastName @skip(if: true)
    }
  `;

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {},
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

// --- Backwards compatibility tests ---
// We want to make the cache fully incremental aware in v5 without the symbol
// workaround to maintain the backwards compatibility that we have in 4.x. Once
// v5 is in place, we can delete the following tests since the standard behavior
// should be tested by everything above.

test("without handleIncrementalSymbol, missing deferred fields yield null when returnPartialData is false", () => {
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

  const missingObject = { __typename: "Greeting", message: "Hello world" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
    })
  ).toStrictEqualTyped({
    result: null,
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("recipient", missingObject),
      {
        greeting: {
          recipient: getMissingMessage("recipient", missingObject),
        },
      },
      query,
      {}
    ),
  });
});

test("without handleIncrementalSymbol, missing deferred fields return partial data when returnPartialData is true", () => {
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

  const missingObject = { __typename: "Greeting", message: "Hello world" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
    })
  ).toStrictEqualTyped({
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
      },
    },
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("recipient", missingObject),
      {
        greeting: {
          recipient: getMissingMessage("recipient", missingObject),
        },
      },
      query,
      {}
    ),
  });
});

test("without handleIncrementalSymbol, incomplete fields inside a defer boundary yield null when returnPartialData is false", () => {
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
      returnPartialData: false,
    })
  ).toStrictEqualTyped({
    result: null,
    complete: false,
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
  });
});

test("without handleIncrementalSymbol, a fully satisfied deferred query is complete and omits dataState", () => {
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
    })
  ).toStrictEqualTyped({
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
    complete: true,
    missing: undefined,
  });
});

function getMissingMessage(fieldName: string, obj: Record<string, unknown>) {
  return `Can't find field '${fieldName}' on ${
    isReference(obj) ?
      obj.__ref + " object"
    : "object " + JSON.stringify(obj, null, 2)
  }`;
}
