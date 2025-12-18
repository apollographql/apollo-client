import { ApolloClient, ApolloLink, gql, InMemoryCache } from "@apollo/client";

test("extensions are available in merge functions", () => {
  const merge = jest.fn((_, incoming) => incoming);

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          book: {
            merge,
          },
        },
      },
    },
  });

  const client = new ApolloClient({
    cache,
    link: ApolloLink.empty(),
  });

  const extensions = {
    customField: "customValue",
    metadata: { version: 1 },
  };

  client.writeQuery({
    query: gql`
      query {
        book {
          title
        }
      }
    `,
    data: {
      book: {
        __typename: "Book",
        title: "Test Book",
      },
    },
    extensions,
  });

  expect(merge).toHaveBeenCalledTimes(1);
  expect(merge).toHaveBeenCalledWith(
    undefined,
    { __typename: "Book", title: "Test Book" },
    expect.objectContaining({ extensions })
  );
});

test("extensions are undefined when not provided", () => {
  const merge = jest.fn((_, incoming) => incoming);

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          book: {
            merge,
          },
        },
      },
    },
  });

  cache.writeQuery({
    query: gql`
      query {
        book {
          title
        }
      }
    `,
    data: {
      book: {
        __typename: "Book",
        title: "Test Book",
      },
    },
  });

  expect(merge).toHaveBeenCalledTimes(1);
  expect(merge).toHaveBeenCalledWith(
    undefined,
    { __typename: "Book", title: "Test Book" },
    expect.objectContaining({ extensions: undefined })
  );
});

test("extensions are available in nested merges", () => {
  const extensions = {
    depth: "nested",
  };

  const outerMerge = jest.fn((_, incoming) => incoming);
  const innerMerge = jest.fn((_, incoming) => incoming);

  const cache = new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          book: {
            merge: outerMerge,
          },
        },
      },
      Book: {
        fields: {
          chapters: {
            merge: innerMerge,
          },
        },
      },
    },
  });

  const client = new ApolloClient({ cache, link: ApolloLink.empty() });

  client.writeQuery({
    query: gql`
      query {
        book {
          title
          chapters {
            title
          }
        }
      }
    `,
    data: {
      book: {
        __typename: "Book",
        title: "Test Book",
        chapters: [
          {
            __typename: "Chapter",
            title: "Chapter 1",
          },
        ],
      },
    },
    extensions,
  });

  expect(outerMerge).toHaveBeenCalledTimes(1);
  expect(outerMerge).toHaveBeenCalledWith(
    undefined,
    {
      __typename: "Book",
      title: "Test Book",
      chapters: [{ __typename: "Chapter", title: "Chapter 1" }],
    },
    expect.objectContaining({ extensions })
  );
  expect(innerMerge).toHaveBeenCalledTimes(1);
  expect(innerMerge).toHaveBeenCalledWith(
    undefined,
    [{ __typename: "Chapter", title: "Chapter 1" }],
    expect.objectContaining({ extensions })
  );
});
