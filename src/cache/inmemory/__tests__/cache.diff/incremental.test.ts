import { Trie } from "@wry/trie";

import { gql } from "@apollo/client";
import {
  createFragmentRegistry,
  InMemoryCache,
  isReference,
  MissingFieldError,
} from "@apollo/client/cache";
import { markAsStreaming, spyOnConsole } from "@apollo/client/testing/internal";
import { addTypenameToDocument } from "@apollo/client/utilities";
import {
  handleIncrementalSymbol,
  type StreamInfoTrie,
} from "@apollo/client/utilities/internal";

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

test('returns dataState "streaming" for a typename-added document when only deferred fields are missing with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = addTypenameToDocument(gql`
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
  `);

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

test('returns dataState "streaming" and strips a dangling referenced object inside a defer boundary with returnPartialData: false', () => {
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
      }
    }
  `;

  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
          recipient {
            __typename
            id
            name
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", id: "1", name: "Alice" },
      },
    },
  });

  // Cause a dangling reference on the recipient field
  cache.evict({ id: "Person:1" });

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

test('returns dataState "partial" for a dangling referenced object inside a defer boundary with returnPartialData: true', () => {
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
      }
    }
  `;

  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
          recipient {
            __typename
            id
            name
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", id: "1", name: "Alice" },
      },
    },
  });

  cache.evict({ id: "Person:1" });

  const danglingMessage = "Dangling reference to missing Person:1 object";

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
        recipient: {},
      },
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      danglingMessage,
      {
        greeting: {
          recipient: danglingMessage,
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "partial" with a __typename-only deferred object when selected fields are missing with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
          recipient {
            phone
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          phone: "555-0100",
        },
      },
    },
  });

  const missingObject = {
    __typename: "Person",
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

test("strips a __typename-only deferred object when selected fields are missing with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
          recipient {
            phone
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          phone: "555-0100",
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
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" when all selected fields under a deferred object are missing but __typename is present with returnPartialData: true', () => {
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
    query: gql`
      query {
        greeting {
          message
          recipient {
            phone
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          phone: "555-0100",
        },
      },
    },
  });

  const missingObject = {
    __typename: "Person",
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
        },
      },
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingObject),
      {
        greeting: {
          recipient: {
            name: getMissingMessage("name", missingObject),
            email: getMissingMessage("email", missingObject),
          },
        },
      },
      query,
      {}
    ),
  });
});

test("strips a deferred object whose own nested object is present but incomplete with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          author {
            profile {
              bio
            }
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query: gql`
        query {
          greeting {
            message
            author {
              id
              profile {
                __typename
              }
            }
          }
        }
      `,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          author: {
            __typename: "Person",
            id: "100",
            profile: { __typename: "Profile" },
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

test('returns dataState "partial" for a deferred object whose own nested object is present but incomplete with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          author {
            profile {
              bio
            }
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query: gql`
        query {
          greeting {
            message
            author {
              id
              profile {
                __typename
              }
            }
          }
        }
      `,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          author: {
            __typename: "Person",
            id: "100",
            profile: { __typename: "Profile" },
          },
        },
      },
    });
  }

  const missingObject = { __typename: "Profile" };

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
        author: {
          __typename: "Person",
          profile: { __typename: "Profile" },
        },
      },
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("bio", missingObject),
      {
        greeting: {
          author: {
            profile: {
              bio: getMissingMessage("bio", missingObject),
            },
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

test("returns a referentially stable result across reads, rebuilding only the paths changed by a write, when partial @defer boundaries are stripped with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        author {
          id
          name
          profile {
            bio
          }
        }
        friends {
          id
          name
        }
        streamedFriends @stream(initialCount: 1) {
          id
          name
        }
        colleagues {
          id
          name
          ... on Person @defer {
            email
            phone
          }
        }
        friendGroups {
          id
          name
          ... on Person @defer {
            email
            phone
          }
        }
        manager {
          id
          name
          ... on Person @defer {
            salary
          }
        }
        ... on Greeting @defer {
          recipient {
            name
            email
          }
        }
        ... on Greeting @defer {
          sender {
            name
            location {
              city
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
            id: "100",
            name: "Bob",
            profile: { __typename: "Profile", bio: "Author bio" },
          },
          // Complete non-deferred list
          friends: [
            { __typename: "Person", id: "1", name: "Leia" },
            { __typename: "Person", id: "2", name: "Han" },
          ],
          // A partial stream with a visible complete prefix. The prefix must
          // be rebuilt when its data changes while the stream stays partial.
          streamedFriends: [
            { __typename: "Person", id: "30", name: "Luke" },
            { __typename: "Person", id: "31" },
          ],
          // List with a nested @defer with mixed partial + complete items.
          // complete items remain unchanged,but partial items lose partial
          // defer fields.
          colleagues: [
            {
              __typename: "Person",
              id: "10",
              name: "Ada",
              email: "ada@example.com",
              phone: "555-0010",
            },
            {
              __typename: "Person",
              id: "11",
              name: "Grace",
              email: "grace@example.com",
            },
            // No deferred fields written at all, so this item's defer boundary is
            // empty (streaming) with nothing to strip
            {
              __typename: "Person",
              id: "12",
              name: "Turing",
            },
          ],
          // Nested list with mixed partial + complete items. This ensures
          // partial deferred fields are stripped without rebuilding untouched
          // nested list branches.
          friendGroups: [
            [
              {
                __typename: "Person",
                id: "20",
                name: "Mara",
                email: "mara@example.com",
              },
              {
                __typename: "Person",
                id: "21",
                name: "Wedge",
                email: "wedge@example.com",
                phone: "555-0021",
              },
            ],
            [
              {
                __typename: "Person",
                id: "22",
                name: "Rose",
                email: "rose@example.com",
              },
            ],
          ],
          // Non-deferred fields present but its nested defer boundary is empty
          // (streaming) so it has nothing to strip
          manager: { __typename: "Person", id: "200", name: "Katherine" },
          // email is missing, so this deferred fragment is partial and stripped.
          recipient: { __typename: "Person", name: "Alice" },
          // Fully present, so this deferred fragment is complete and retained.
          sender: {
            __typename: "Person",
            name: "Sam",
            location: { __typename: "Location", city: "Portland" },
          },
        },
      },
    });
  }

  const options = {
    query,
    optimistic: true,
    returnPartialData: false,
    [handleIncrementalSymbol]: true,
  } as const;

  const diff1 = cache.diff(options);
  const diff2 = cache.diff(options);

  expect(diff1).toStrictEqualTyped({
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        author: {
          __typename: "Person",
          id: "100",
          name: "Bob",
          profile: { __typename: "Profile", bio: "Author bio" },
        },
        friends: [
          { __typename: "Person", id: "1", name: "Leia" },
          { __typename: "Person", id: "2", name: "Han" },
        ],
        streamedFriends: [{ __typename: "Person", id: "30", name: "Luke" }],
        colleagues: [
          {
            __typename: "Person",
            id: "10",
            name: "Ada",
            email: "ada@example.com",
            phone: "555-0010",
          },
          { __typename: "Person", id: "11", name: "Grace" },
          { __typename: "Person", id: "12", name: "Turing" },
        ],
        friendGroups: [
          [
            { __typename: "Person", id: "20", name: "Mara" },
            {
              __typename: "Person",
              id: "21",
              name: "Wedge",
              email: "wedge@example.com",
              phone: "555-0021",
            },
          ],
          [{ __typename: "Person", id: "22", name: "Rose" }],
        ],
        manager: { __typename: "Person", id: "200", name: "Katherine" },
        sender: {
          __typename: "Person",
          name: "Sam",
          location: { __typename: "Location", city: "Portland" },
        },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });

  expect(diff2.result).toBe(diff1.result);

  // Update a nested object. The nested object and all parent objects
  cache.writeFragment({
    id: cache.identify({ __typename: "Person", id: "100" })!,
    fragment: gql`
      fragment UpdatedAuthor on Person {
        profile {
          bio
        }
      }
    `,
    data: {
      __typename: "Person",
      profile: { __typename: "Profile", bio: "Updated bio" },
    },
  });

  const diff3 = cache.diff(options);

  const greeting1 = (diff1.result as any).greeting;
  const greeting3 = (diff3.result as any).greeting;

  expect(diff3.result).not.toBe(diff1.result);
  expect(greeting1).not.toBe(greeting3);
  expect(greeting3.author).not.toBe(greeting1.author);
  expect(greeting3.author.profile).not.toBe(greeting1.author.profile);
  expect(greeting3.author.profile.bio).toBe("Updated bio");

  expect(greeting3.friends).toBe(greeting1.friends);
  expect(greeting3.friends[0]).toBe(greeting1.friends[0]);
  expect(greeting3.streamedFriends).toBe(greeting1.streamedFriends);
  expect(greeting3.colleagues).toBe(greeting1.colleagues);
  expect(greeting3.colleagues[0]).toBe(greeting1.colleagues[0]);
  expect(greeting3.colleagues[2]).toBe(greeting1.colleagues[2]);
  expect(greeting3.friendGroups).toBe(greeting1.friendGroups);
  expect(greeting3.friendGroups[0]).toBe(greeting1.friendGroups[0]);
  expect(greeting3.friendGroups[1]).toBe(greeting1.friendGroups[1]);
  expect(greeting3.manager).toBe(greeting1.manager);
  expect(greeting3.sender).toBe(greeting1.sender);
  expect(greeting3.sender.location).toBe(greeting1.sender.location);

  // Update a list item to ensure it changes identity along with the parent
  // array, but other list items do not.
  cache.writeFragment({
    id: cache.identify({ __typename: "Person", id: "1" })!,
    fragment: gql`
      fragment UpdatedFriend on Person {
        name
      }
    `,
    data: { __typename: "Person", name: "Leia Organa" },
  });

  const diff4 = cache.diff(options);
  const greeting4 = (diff4.result as any).greeting;

  expect(diff4.result).not.toBe(diff3.result);
  expect(greeting4.friends).not.toBe(greeting3.friends);
  expect(greeting4.friends[0]).not.toBe(greeting3.friends[0]);

  expect(greeting4.friends[0].name).toBe("Leia Organa");
  expect(greeting4.friends[1]).toBe(greeting3.friends[1]);
  expect(greeting4.streamedFriends).toBe(greeting3.streamedFriends);
  expect(greeting4.author).toBe(greeting3.author);
  expect(greeting4.colleagues[0]).toBe(greeting3.colleagues[0]);
  expect(greeting4.colleagues[2]).toBe(greeting3.colleagues[2]);
  expect(greeting4.friendGroups).toBe(greeting3.friendGroups);
  expect(greeting4.manager).toBe(greeting3.manager);
  expect(greeting4.sender).toBe(greeting3.sender);

  // Update a field in a partial deferred fragment that is stripped. Object
  // identity changes, but the field should remain absent
  cache.writeFragment({
    id: cache.identify({ __typename: "Person", id: "11" })!,
    fragment: gql`
      fragment UpdatedColleagueEmail on Person {
        email
      }
    `,
    data: { __typename: "Person", email: "grace.hopper@example.com" },
  });

  const diff5 = cache.diff(options);
  const greeting5 = (diff5.result as any).greeting;

  expect(greeting5.colleagues[1]).toStrictEqual({
    __typename: "Person",
    id: "11",
    name: "Grace",
  });
  expect(greeting5.colleagues[1]).not.toBe(greeting4.colleagues[1]);

  expect(greeting5.colleagues[0]).toBe(greeting4.colleagues[0]);
  expect(greeting5.colleagues[2]).toBe(greeting4.colleagues[2]);
  expect(greeting5.friendGroups).toBe(greeting4.friendGroups);
  expect(greeting5.manager).toBe(greeting4.manager);
  expect(greeting5.friends).toBe(greeting4.friends);
  expect(greeting5.streamedFriends).toBe(greeting4.streamedFriends);
  expect(greeting5.author).toBe(greeting4.author);
  expect(greeting5.sender).toBe(greeting4.sender);

  // Update a field in a partial deferred item nested in a 2d list. The item
  // and its ancestor arrays change identity, while untouched sibling branches
  // retain their identities.
  cache.writeFragment({
    id: cache.identify({ __typename: "Person", id: "20" })!,
    fragment: gql`
      fragment UpdatedFriendGroupEmail on Person {
        email
      }
    `,
    data: { __typename: "Person", email: "mara.jade@example.com" },
  });

  const diff6 = cache.diff(options);
  const greeting6 = (diff6.result as any).greeting;

  expect(greeting6.friendGroups).not.toBe(greeting5.friendGroups);
  expect(greeting6.friendGroups[0]).not.toBe(greeting5.friendGroups[0]);
  expect(greeting6.friendGroups[0][0]).not.toBe(greeting5.friendGroups[0][0]);
  expect(greeting6.friendGroups[0][0]).toStrictEqual({
    __typename: "Person",
    id: "20",
    name: "Mara",
  });
  expect(greeting6.friendGroups[0][1]).toBe(greeting5.friendGroups[0][1]);
  expect(greeting6.friendGroups[1]).toBe(greeting5.friendGroups[1]);
  expect(greeting6.friendGroups[1][0]).toBe(greeting5.friendGroups[1][0]);

  // Updating a visible item in a still-partial stream must invalidate the
  // pruned array even though its partial boundary has not changed.
  cache.writeFragment({
    id: cache.identify({ __typename: "Person", id: "30" })!,
    fragment: gql`
      fragment UpdatedStreamedFriend on Person {
        name
      }
    `,
    data: { __typename: "Person", name: "Luke Skywalker" },
  });

  const diff7 = cache.diff(options);
  const greeting7 = (diff7.result as any).greeting;

  expect(greeting7.streamedFriends).not.toBe(greeting6.streamedFriends);
  expect(greeting7.streamedFriends).toStrictEqual([
    { __typename: "Person", id: "30", name: "Luke Skywalker" },
  ]);
  expect(greeting7.friends).toBe(greeting6.friends);
  expect(greeting7.friendGroups).toBe(greeting6.friendGroups);
});

test("preserves shared object identity for repeated list entities after stripping partial @defer fields with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friends {
        id
        ... on Person @defer {
          name
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
        friends: [
          { __typename: "Person", id: "1", name: "Alice" },
          { __typename: "Person", id: "1", name: "Alice" },
          {
            __typename: "Person",
            id: "2",
            name: "Bob",
            email: "bob@example.com",
          },
        ],
      },
    });
  }

  const partialDiff = cache.diff({
    query,
    optimistic: true,
    returnPartialData: true,
    [handleIncrementalSymbol]: true,
  });

  const missingPerson1 = { __ref: "Person:1" };

  expect(partialDiff).toStrictEqualTyped({
    result: {
      friends: [
        { __typename: "Person", id: "1", name: "Alice" },
        { __typename: "Person", id: "1", name: "Alice" },
        {
          __typename: "Person",
          id: "2",
          name: "Bob",
          email: "bob@example.com",
        },
      ],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("email", missingPerson1),
      {
        friends: {
          0: { email: getMissingMessage("email", missingPerson1) },
          1: { email: getMissingMessage("email", missingPerson1) },
        },
      },
      query,
      {}
    ),
  });

  const partialFriends = (partialDiff.result as any).friends;

  // Precondition: memoized read shares identity for the duplicate entity.
  expect(partialFriends[0]).toBe(partialFriends[1]);
  expect(partialFriends[0]).not.toBe(partialFriends[2]);

  const strippedDiff = cache.diff({
    query,
    optimistic: true,
    returnPartialData: false,
    [handleIncrementalSymbol]: true,
  });

  expect(strippedDiff).toStrictEqualTyped({
    result: markAsStreaming({
      friends: [
        { __typename: "Person", id: "1" },
        { __typename: "Person", id: "1" },
        {
          __typename: "Person",
          id: "2",
          name: "Bob",
          email: "bob@example.com",
        },
      ],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });

  const strippedFriends = (strippedDiff.result as any).friends;

  // Same entity at two indexes must still be the same object after strip.
  expect(strippedFriends[0]).toBe(strippedFriends[1]);
  expect(strippedFriends[0]).not.toBe(strippedFriends[2]);
});

test("returns a referentially stable streaming result when a __typename-only deferred object is stripped, rebuilding only written paths with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        author {
          id
          name
        }
        ... on Greeting @defer {
          recipient {
            email
          }
        }
        ... on Greeting @defer {
          sender {
            id
            name
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query: gql`
        query {
          greeting {
            message
            author {
              id
              name
            }
            recipient {
              __typename
              name
            }
            sender {
              id
              name
            }
          }
        }
      `,
      data: {
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          author: { __typename: "Person", id: "100", name: "Bob" },
          recipient: { __typename: "Person", name: "Alice" },
          sender: { __typename: "Person", id: "200", name: "Sam" },
        },
      },
    });
  }

  const options = {
    query,
    optimistic: true,
    returnPartialData: false,
    [handleIncrementalSymbol]: true,
  } as const;

  const diff1 = cache.diff(options);
  const diff2 = cache.diff(options);

  expect(diff1).toStrictEqualTyped({
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        author: { __typename: "Person", id: "100", name: "Bob" },
        sender: { __typename: "Person", id: "200", name: "Sam" },
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });

  expect(diff2.result).toBe(diff1.result);

  const greeting1 = (diff1.result as any).greeting;

  cache.writeFragment({
    id: cache.identify({ __typename: "Person", id: "100" })!,
    fragment: gql`
      fragment UpdatedAuthor on Person {
        name
      }
    `,
    data: { __typename: "Person", id: "100", name: "Robert" },
  });

  const diff3 = cache.diff(options);
  const greeting3 = (diff3.result as any).greeting;

  expect(diff3.result).not.toBe(diff1.result);
  expect(greeting3).not.toBe(greeting1);
  expect(greeting3.author).not.toBe(greeting1.author);
  expect(greeting3.author.name).toBe("Robert");
  expect(greeting3.sender).toBe(greeting1.sender);
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

test('returns dataState "streaming" when non-deferred named fragments contribute different subfields under the same response key with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ...RecipientName
        ...RecipientId
        ... on Greeting @defer {
          recipient {
            id
            name
            email
          }
        }
      }
    }

    fragment RecipientName on Greeting {
      recipient {
        name
      }
    }

    fragment RecipientId on Greeting {
      recipient {
        id
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
            id: "1",
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
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: markAsStreaming({
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          id: "1",
          name: "Alice",
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

test("strips incomplete fields inside a defer boundary contributed by a registered named fragment with returnPartialData: false", () => {
  const cache = new InMemoryCache({
    fragments: createFragmentRegistry(gql`
      fragment GreetingRecipient on Greeting {
        recipient {
          name
          email
        }
      }
    `),
  });
  const query = gql`
    query {
      greeting {
        message
        ...GreetingRecipient @defer
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query: gql`
        query {
          greeting {
            message
            recipient {
              __typename
              name
            }
          }
        }
      `,
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

test("does not reuse a cached fragment-resolution error across queries when a registered deferred fragment's spread is later defined", () => {
  const cache = new InMemoryCache({
    fragments: createFragmentRegistry(gql`
      fragment GreetingWithDeferredRecipient on Greeting {
        message
        ... @defer {
          ...DeferredRecipientFields
        }
      }
    `),
  });

  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
          recipient {
            __typename
            name
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
  });

  const queryMissingFragment = gql`
    query MissingFragment {
      greeting {
        ...GreetingWithDeferredRecipient
      }
    }
  `;

  const queryProvidingFragment = gql`
    query ProvidingFragment {
      greeting {
        ...GreetingWithDeferredRecipient
      }
    }

    fragment DeferredRecipientFields on Greeting {
      recipient {
        name
      }
    }
  `;

  // Reading the registered deferred fragment without a definition for its
  // `...DeferredRecipientFields` spread throws. This must not poison the cache
  // entry for the shared registry fragment node.
  expect(() => {
    cache.diff({
      query: queryMissingFragment,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    });
  }).toThrow(/No fragment named DeferredRecipientFields/);

  // Reading the same registered deferred fragment from a query that defines
  // `DeferredRecipientFields` must succeed rather than re-throwing the error
  // cached from the previous read.
  expect(
    cache.diff({
      query: queryProvidingFragment,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: { __typename: "Person", name: "Alice" },
      },
    },
    dataState: "complete",
    complete: true,
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

test('returns dataState "complete" with empty array with incomplete item with returnPartialData: false', () => {
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
          { __typename: "Friend", id: "4", name: "Chewbacca" },
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
    result: {
      friendList: [],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test("returns truncated list before a partial item when streamInfo is provided before truncation is set", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;
  const streamInfo = new Trie() as StreamInfoTrie;
  streamInfo.lookupArray(["friendList"]).cache = { streamPosition: 1 };

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3" },
          { __typename: "Friend", id: "4", name: "Chewbacca" },
        ],
      },
    });
  }

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: { streamInfo },
    })
  ).toStrictEqualTyped({
    result: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test("does not reuse a streamInfo-truncated result when streamInfo is later omitted", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;
  const streamInfo = new Trie() as StreamInfoTrie;
  streamInfo.lookupArray(["friendList"]).cache = { streamPosition: 1 };

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
      [handleIncrementalSymbol]: { streamInfo },
    })
  ).toStrictEqualTyped({
    result: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
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

test("does not truncate a partial stream array when returnPartialData is true", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;
  const streamInfo = new Trie() as StreamInfoTrie;
  streamInfo.lookupArray(["friendList"]).cache = { streamPosition: 1 };

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3" },
          { __typename: "Friend", id: "4", name: "Chewbacca" },
        ],
      },
    });
  }

  const missingRef = { __ref: "Friend:3" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: { streamInfo },
    })
  ).toStrictEqualTyped({
    result: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3" },
        { __typename: "Friend", id: "4", name: "Chewbacca" },
      ],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRef),
      {
        friendList: {
          2: {
            name: getMissingMessage("name", missingRef),
          },
        },
      },
      query,
      {}
    ),
  });
});

test("returns only the complete prefix when streamInfo includes a partial stream item", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;
  const streamInfo = new Trie() as StreamInfoTrie;
  streamInfo.lookupArray(["friendList"]).cache = { streamPosition: 4 };

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friendList: [
          { __typename: "Friend", id: "1", name: "Luke" },
          { __typename: "Friend", id: "2", name: "Han" },
          { __typename: "Friend", id: "3" },
          { __typename: "Friend", id: "4", name: "Chewbacca" },
        ],
      },
    });
  }

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: { streamInfo },
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

test("returns the full stream array when every item is complete", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;
  const streamInfo = new Trie() as StreamInfoTrie;
  streamInfo.lookupArray(["friendList"]).cache = { streamPosition: 1 };

  cache.writeQuery({
    query,
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
        { __typename: "Friend", id: "4", name: "Chewbacca" },
      ],
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: { streamInfo },
    })
  ).toStrictEqualTyped({
    result: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
        { __typename: "Friend", id: "4", name: "Chewbacca" },
      ],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test("returns the truncated stream array with complete items when truncation is set", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;
  const streamInfo = new Trie() as StreamInfoTrie;
  streamInfo.lookupArray(["friendList"]).cache = {
    truncate: true,
    streamPosition: 1,
  };

  cache.writeQuery({
    query,
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
        { __typename: "Friend", id: "4", name: "Chewbacca" },
      ],
    },
  });

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: { streamInfo },
    })
  ).toStrictEqualTyped({
    result: {
      friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test("invalidates a pruned stream array when truncation state changes", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendList @stream(initialCount: 1) {
        id
        name
      }
    }
  `;
  const streamInfo = new Trie() as StreamInfoTrie;
  const streamEntry = streamInfo.lookupArray(["friendList"]);
  streamEntry.cache = { streamPosition: 1 };

  cache.writeQuery({
    query,
    data: {
      friendList: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Han" },
        { __typename: "Friend", id: "3", name: "Leia" },
      ],
    },
  });

  const diff = () =>
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: false,
      [handleIncrementalSymbol]: { streamInfo },
    });

  expect(diff().result).toStrictEqualTyped({
    friendList: [
      { __typename: "Friend", id: "1", name: "Luke" },
      { __typename: "Friend", id: "2", name: "Han" },
      { __typename: "Friend", id: "3", name: "Leia" },
    ],
  });

  streamEntry.cache.truncate = true;

  expect(diff().result).toStrictEqualTyped({
    friendList: [{ __typename: "Friend", id: "1", name: "Luke" }],
  });

  streamEntry.cache.streamPosition = 2;

  expect(diff().result).toStrictEqualTyped({
    friendList: [
      { __typename: "Friend", id: "1", name: "Luke" },
      { __typename: "Friend", id: "2", name: "Han" },
    ],
  });
});

test('returns dataState "complete" with an empty list when every stream list item is incomplete with returnPartialData: false', () => {
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
    result: {
      friendList: [],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
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

test('returns dataState "complete" with empty array with partial array item under a combined @stream and @defer selection with returnPartialData: false', () => {
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
    result: {
      friendList: [],
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
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

test('returns dataState "complete" for sibling @stream and a complete @defer with returnPartialData: false', () => {
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
      }
      friendList @stream(initialCount: 1) {
        id
        name
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
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
      },
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

test('returns dataState "complete" with an empty stream array when an item is incomplete alongside a complete @defer with returnPartialData: false', () => {
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
      }
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
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          recipient: {
            __typename: "Person",
            name: "Alice",
          },
        },
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
    result: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
      },
      friendList: [],
    },
    dataState: "complete",
    complete: true,
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

test('returns dataState "partial" when an empty list is present and a sibling field is missing with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      name
      friends {
        id
      }
    }
  `;

  cache.writeQuery({
    query: gql`
      query {
        friends {
          id
        }
      }
    `,
    data: {
      friends: [],
    },
  });

  const missingRoot = { __ref: "ROOT_QUERY" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      friends: [],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("name", missingRoot),
      { name: getMissingMessage("name", missingRoot) },
      query,
      {}
    ),
  });
});

test('returns dataState "empty" when an empty list is present and a sibling field is missing with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      name
      friends {
        id
      }
    }
  `;

  cache.writeQuery({
    query: gql`
      query {
        friends {
          id
        }
      }
    `,
    data: {
      friends: [],
    },
  });

  const missingRoot = { __ref: "ROOT_QUERY" };

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
      getMissingMessage("name", missingRoot),
      { name: getMissingMessage("name", missingRoot) },
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

test('returns dataState "empty" when a root defer boundary has nothing written with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      ... @defer {
        greeting {
          message
          author
        }
      }
    }
  `;

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: null,
    dataState: "empty",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" when a root defer boundary is only partially written with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      ... @defer {
        greeting {
          message
          author
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
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "empty" without missing when a root defer boundary is only partially written with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      ... @defer {
        greeting {
          message
          author
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

test("does not reuse a stripped deferred result when the same query is later read with returnPartialData: true", () => {
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

test.each([
  [
    "@skip(if: true)",
    gql`
      query {
        greeting {
          recipient @skip(if: true) {
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
    `,
    {},
  ],
  [
    "@include(if: false)",
    gql`
      query {
        greeting {
          recipient @include(if: false) {
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
    `,
    {},
  ],
  [
    "@skip(if: $skipRecipient) with $skipRecipient: true",
    gql`
      query ($skipRecipient: Boolean!) {
        greeting {
          recipient @skip(if: $skipRecipient) {
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
    `,
    { skipRecipient: true },
  ],
  [
    "@include(if: $includeRecipient) with $includeRecipient: false",
    gql`
      query ($includeRecipient: Boolean!) {
        greeting {
          recipient @include(if: $includeRecipient) {
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
    `,
    { includeRecipient: false },
  ],
])(
  "does not reintroduce partial deferred data through an overlapping %s selection",
  (_, query, variables) => {
    const cache = new InMemoryCache();

    {
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        variables,
        data: {
          greeting: {
            __typename: "Greeting",
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
        variables,
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
  }
);

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

test("keeps overlapping recipient fields selected by a complete sibling @defer when another sibling @defer is partial with returnPartialData: false", () => {
  const queries = [
    // complete boundary first
    gql`
      query {
        ... @defer {
          recipient {
            name
          }
        }
        ... @defer {
          recipient {
            name
            email
          }
        }
      }
    `,
    // partial boundary first
    gql`
      query {
        ... @defer {
          recipient {
            name
            email
          }
        }
        ... @defer {
          recipient {
            name
          }
        }
      }
    `,
  ];

  for (const query of queries) {
    const cache = new InMemoryCache();

    {
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        data: {
          recipient: {
            __typename: "Person",
            name: "Alice",
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
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
      }),
      dataState: "streaming",
      complete: false,
      missing: undefined,
    });
  }
});

test('returns dataState "streaming" when two sibling @defer fragments overlap and only exclusive fields are missing with returnPartialData: true', () => {
  const queries = [
    // complete boundary first
    gql`
      query {
        ... @defer {
          recipient {
            name
          }
        }
        ... @defer {
          recipient {
            name
            email
          }
        }
      }
    `,
    // incomplete boundary first
    gql`
      query {
        ... @defer {
          recipient {
            name
            email
          }
        }
        ... @defer {
          recipient {
            name
          }
        }
      }
    `,
  ];

  for (const query of queries) {
    const cache = new InMemoryCache();

    {
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        data: {
          recipient: {
            __typename: "Person",
            name: "Alice",
          },
        },
      });
    }

    expect(
      cache.diff({
        query,
        optimistic: true,
        returnPartialData: true,
        [handleIncrementalSymbol]: true,
      })
    ).toStrictEqualTyped({
      result: markAsStreaming({
        recipient: {
          __typename: "Person",
          name: "Alice",
        },
      }),
      dataState: "streaming",
      complete: false,
      missing: undefined,
    });
  }
});

test("strips fields from a partial sibling @defer with disjoint selections from a complete sibling @defer regardless of selection order when returnPartialData is false", () => {
  const queries = [
    // partial boundary first
    gql`
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
            }
          }
        }
      }
    `,
    // complete boundary first
    gql`
      query {
        greeting {
          message
          ... on Greeting @defer {
            author {
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
    `,
  ];

  for (const query of queries) {
    const cache = new InMemoryCache();

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
  }
});

test("strips overlapping recipient fields when both sibling @defer boundaries selecting them are partial with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      ... @defer {
        recipient {
          name
          email
        }
      }
      ... @defer {
        recipient {
          name
          phone
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        recipient: {
          __typename: "Person",
          name: "Alice",
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
    result: null,
    dataState: "empty",
    complete: false,
    missing: undefined,
  });
});

test("strips nested partial @defer fields contributed under the same response key by sibling fragments with returnPartialData: false", () => {
  const queries = [
    // email/bio fragment first
    gql`
      query {
        greeting {
          message
          ... on Greeting {
            recipient {
              name
              ... on Person @defer {
                email
                bio
              }
            }
          }
          ... on Greeting {
            recipient {
              name
              ... on Person @defer {
                phone
                age
              }
            }
          }
        }
      }
    `,
    // phone/age fragment first
    gql`
      query {
        greeting {
          message
          ... on Greeting {
            recipient {
              name
              ... on Person @defer {
                phone
                age
              }
            }
          }
          ... on Greeting {
            recipient {
              name
              ... on Person @defer {
                email
                bio
              }
            }
          }
        }
      }
    `,
  ];

  for (const query of queries) {
    const cache = new InMemoryCache();

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
          },
        },
      }),
      dataState: "streaming",
      complete: false,
      missing: undefined,
    });
  }
});

test("strips nested partial @defer fields under the same list field contributed by sibling fragments with returnPartialData: false", () => {
  const queries = [
    gql`
      query {
        greeting {
          message
          ... on Greeting {
            friends {
              id
              name
              ... on Friend @defer {
                email
                bio
              }
            }
          }
          ... on Greeting {
            friends {
              id
              name
              ... on Friend @defer {
                phone
                age
              }
            }
          }
        }
      }
    `,
    gql`
      query {
        greeting {
          message
          ... on Greeting {
            friends {
              id
              name
              ... on Friend @defer {
                phone
                age
              }
            }
          }
          ... on Greeting {
            friends {
              id
              name
              ... on Friend @defer {
                email
                bio
              }
            }
          }
        }
      }
    `,
  ];

  for (const query of queries) {
    const cache = new InMemoryCache();

    {
      using _ = spyOnConsole("error");
      cache.writeQuery({
        query,
        data: {
          greeting: {
            __typename: "Greeting",
            message: "Hello world",
            friends: [
              {
                __typename: "Friend",
                id: "1",
                name: "Luke",
                email: "luke@example.com",
                phone: "555-0001",
              },
              {
                __typename: "Friend",
                id: "2",
                name: "Leia",
                email: "leia@example.com",
                phone: "555-0002",
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
        greeting: {
          __typename: "Greeting",
          message: "Hello world",
          friends: [
            {
              __typename: "Friend",
              id: "1",
              name: "Luke",
            },
            {
              __typename: "Friend",
              id: "2",
              name: "Leia",
            },
          ],
        },
      }),
      dataState: "streaming",
      complete: false,
      missing: undefined,
    });
  }
});

test("does not reintroduce nested stripped @defer fields when a later sibling outer @defer is partial with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        recipient {
          name
          ... on Person @defer {
            email
            phone
          }
        }
        ... on Greeting @defer {
          author {
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
            email: "alice@example.com",
          },
          author: {
            __typename: "Person",
            name: "Bob",
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

test("strips a partial @defer nested under an interface fragment that matches a concrete typename via possibleTypes when returnPartialData is false", () => {
  const cache = new InMemoryCache({
    possibleTypes: {
      Character: ["Human", "Droid"],
    },
  });
  const query = gql`
    query {
      hero {
        id
        ... on Character {
          name
          ... on Character @defer {
            homePlanet
            friendsCount
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
        hero: {
          __typename: "Human",
          id: "1",
          name: "Luke",
          homePlanet: "Tatooine",
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
      hero: {
        __typename: "Human",
        id: "1",
        name: "Luke",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("strips a partial @defer on an interface type condition that matches a concrete typename via possibleTypes when returnPartialData is false", () => {
  const cache = new InMemoryCache({
    possibleTypes: {
      Character: ["Human", "Droid"],
    },
  });
  const query = gql`
    query {
      hero {
        id
        ... on Character @defer {
          name
          homePlanet
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        hero: {
          __typename: "Human",
          id: "1",
          name: "Luke",
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
      hero: {
        __typename: "Human",
        id: "1",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("strips a partial @defer nested under a named fragment on an interface that matches via possibleTypes when returnPartialData is false", () => {
  const cache = new InMemoryCache({
    possibleTypes: {
      Character: ["Human", "Droid"],
    },
  });
  const query = gql`
    query {
      hero {
        id
        ...CharacterFields
      }
    }

    fragment CharacterFields on Character {
      name
      ... on Character @defer {
        homePlanet
        friendsCount
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        hero: {
          __typename: "Human",
          id: "1",
          name: "Luke",
          homePlanet: "Tatooine",
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
      hero: {
        __typename: "Human",
        id: "1",
        name: "Luke",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("does not reintroduce fields from a partial @defer via a non-matching sibling type condition when returnPartialData is false", () => {
  const cache = new InMemoryCache({
    possibleTypes: {
      Character: ["Human", "Droid"],
    },
  });
  const query = gql`
    query {
      hero {
        id
        ... on Human @defer {
          name
          homePlanet
        }
        ... on Droid {
          name
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        hero: {
          __typename: "Human",
          id: "1",
          name: "Luke",
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
      hero: {
        __typename: "Human",
        id: "1",
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "complete" when a deferred object field is explicitly null', () => {
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

test('returns dataState "complete" when a deferred scalar field is explicitly null', () => {
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
          email: null,
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
          email: null,
        },
      },
    },
    dataState: "complete",
    complete: true,
    missing: undefined,
  });
});

test("preserves an explicitly null list item while stripping partial deferred fields on sibling items when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friends {
        id
        name
        ... on Friend @defer {
          email
          phone
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friends: [
          null,
          {
            __typename: "Friend",
            id: "1",
            name: "Alice",
            email: "alice@example.com",
            phone: "555-0100",
          },
          {
            __typename: "Friend",
            id: "2",
            name: "Bob",
            email: "bob@example.com",
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
    result: markAsStreaming({
      friends: [
        null,
        {
          __typename: "Friend",
          id: "1",
          name: "Alice",
          email: "alice@example.com",
          phone: "555-0100",
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Bob",
        },
      ],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("preserves a null list field under a parent that also has a partial sibling @defer when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        recipients
        ... on Greeting @defer {
          author {
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
          recipients: null,
          author: {
            __typename: "Person",
            name: "Bob",
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
        recipients: null,
      },
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test("preserves an explicitly null nested object while stripping a partial sibling nested @defer when returnPartialData is false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            name
          }
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
          recipient: null,
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
        recipient: null,
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

test("honors field aliases when stripping a partial @defer boundary with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        text: message
        primary: recipient {
          fullName: name
        }
        ... on Greeting @defer {
          contact: recipient {
            fullName: name
            emailAddress: email
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
          text: "Hello world",
          primary: {
            __typename: "Person",
            fullName: "Alice",
          },
          contact: {
            __typename: "Person",
            fullName: "Alice",
            // emailAddress missing → partial deferred boundary
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
        text: "Hello world",
        primary: {
          __typename: "Person",
          fullName: "Alice",
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

test("strips partial deferred fields from nested items in a 2d object array while retaining complete siblings with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friendGroups {
        id
        name
        ... on Friend @defer {
          email
          phone
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
          [
            {
              __typename: "Friend",
              id: "1",
              name: "Luke",
              email: "luke@example.com",
            },
            {
              __typename: "Friend",
              id: "2",
              name: "Han",
              email: "han@example.com",
              phone: "555-0102",
            },
          ],
          [
            {
              __typename: "Friend",
              id: "3",
              name: "Leia",
              email: "leia@example.com",
            },
          ],
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
    result: markAsStreaming({
      friendGroups: [
        [
          { __typename: "Friend", id: "1", name: "Luke" },
          {
            __typename: "Friend",
            id: "2",
            name: "Han",
            email: "han@example.com",
            phone: "555-0102",
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

test('returns dataState "streaming" when a partial @defer inside every list item is stripped with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friends {
        id
        name
        ... on Friend @defer {
          email
          phone
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friends: [
          {
            __typename: "Friend",
            id: "1",
            name: "Luke",
            email: "luke@example.com",
          },
          {
            __typename: "Friend",
            id: "2",
            name: "Leia",
            email: "leia@example.com",
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
    result: markAsStreaming({
      friends: [
        { __typename: "Friend", id: "1", name: "Luke" },
        { __typename: "Friend", id: "2", name: "Leia" },
      ],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" when a partial @defer inside a list item is present with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friends {
        id
        name
        ... on Friend @defer {
          email
          phone
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friends: [
          {
            __typename: "Friend",
            id: "1",
            name: "Luke",
            email: "luke@example.com",
          },
          {
            __typename: "Friend",
            id: "2",
            name: "Leia",
            email: "leia@example.com",
          },
        ],
      },
    });
  }

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      friends: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
        },
        {
          __typename: "Friend",
          id: "2",
          name: "Leia",
          email: "leia@example.com",
        },
      ],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("phone", { __ref: "Friend:1" }),
      {
        friends: {
          0: { phone: getMissingMessage("phone", { __ref: "Friend:1" }) },
          1: { phone: getMissingMessage("phone", { __ref: "Friend:2" }) },
        },
      },
      query,
      {}
    ),
  });
});

test('returns dataState "streaming" keeping complete per-item @defer data while stripping a partial sibling item with returnPartialData: false', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      friends {
        id
        name
        ... on Friend @defer {
          email
          phone
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query,
      data: {
        friends: [
          {
            __typename: "Friend",
            id: "1",
            name: "Luke",
            email: "luke@example.com",
            phone: "555-0001",
          },
          {
            __typename: "Friend",
            id: "2",
            name: "Leia",
            email: "leia@example.com",
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
    result: markAsStreaming({
      friends: [
        {
          __typename: "Friend",
          id: "1",
          name: "Luke",
          email: "luke@example.com",
          phone: "555-0001",
        },
        { __typename: "Friend", id: "2", name: "Leia" },
      ],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
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

test("strips a __typename-only deferred object nested inside a list item with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      colleagues {
        id
        name
        ... on Person @defer {
          profile {
            bio
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query: gql`
        query {
          colleagues {
            __typename
            id
            name
            profile {
              __typename
            }
          }
        }
      `,
      data: {
        colleagues: [
          {
            __typename: "Person",
            id: "1",
            name: "Grace",
            profile: { __typename: "Profile" },
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
    result: markAsStreaming({
      colleagues: [{ __typename: "Person", id: "1", name: "Grace" }],
    }),
    dataState: "streaming",
    complete: false,
    missing: undefined,
  });
});

test('returns dataState "partial" for a __typename-only deferred object nested inside a list item with returnPartialData: true', () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      colleagues {
        id
        name
        ... on Person @defer {
          profile {
            bio
          }
        }
      }
    }
  `;

  {
    using _ = spyOnConsole("error");
    cache.writeQuery({
      query: gql`
        query {
          colleagues {
            __typename
            id
            name
            profile {
              __typename
            }
          }
        }
      `,
      data: {
        colleagues: [
          {
            __typename: "Person",
            id: "1",
            name: "Grace",
            profile: { __typename: "Profile" },
          },
        ],
      },
    });
  }

  const missingObject = { __typename: "Profile" };

  expect(
    cache.diff({
      query,
      optimistic: true,
      returnPartialData: true,
      [handleIncrementalSymbol]: true,
    })
  ).toStrictEqualTyped({
    result: {
      colleagues: [
        {
          __typename: "Person",
          id: "1",
          name: "Grace",
          profile: { __typename: "Profile" },
        },
      ],
    },
    dataState: "partial",
    complete: false,
    missing: new MissingFieldError(
      getMissingMessage("bio", missingObject),
      {
        colleagues: {
          0: {
            profile: {
              bio: getMissingMessage("bio", missingObject),
            },
          },
        },
      },
      query,
      {}
    ),
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

test("without handleIncrementalSymbol, retains a __typename-only deferred object when selected fields are missing with returnPartialData: true", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
          recipient {
            phone
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          phone: "555-0100",
        },
      },
    },
  });

  const missingObject = {
    __typename: "Person",
    phone: "555-0100",
  };

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
        recipient: {
          __typename: "Person",
        },
      },
    },
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

test("without handleIncrementalSymbol, a __typename-only deferred object yields null when selected fields are missing with returnPartialData: false", () => {
  const cache = new InMemoryCache();
  const query = gql`
    query {
      greeting {
        message
        ... on Greeting @defer {
          recipient {
            email
          }
        }
      }
    }
  `;

  cache.writeQuery({
    query: gql`
      query {
        greeting {
          message
          recipient {
            phone
          }
        }
      }
    `,
    data: {
      greeting: {
        __typename: "Greeting",
        message: "Hello world",
        recipient: {
          __typename: "Person",
          phone: "555-0100",
        },
      },
    },
  });

  const missingObject = {
    __typename: "Person",
    phone: "555-0100",
  };

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
