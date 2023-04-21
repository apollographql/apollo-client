import { gql, InMemoryCache } from "../../../index";

test("a crafted query can overwrite Post:1 with what should be User:5", () => {
  const postFragment = gql`
    fragment PostFragment on Post {
      id
      title
    }
  `;

  const cache = new InMemoryCache();
  cache.writeFragment({
    fragment: postFragment,
    data: {
      __typename: "Post",
      id: "1",
      title: "Hello",
    },
  });

  expect(cache.extract()["Post:1"]).toMatchInlineSnapshot(`
    Object {
      "__typename": "Post",
      "id": "1",
      "title": "Hello",
    }
  `);

  const injectingQuery = gql`
    query ($id: String) {
      user(id: $id) {
        __typename: firstName
        id: lastName
        title
        ignore: __typename
        ignore2: id
      }
    }
  `;
  cache.write({
    query: injectingQuery,
    variables: { id: 5 },
    dataId: "ROOT_QUERY",
    result: {
      user: {
        __typename: "Post",
        id: "1",
        title: "Poisoned!", // only fields with the same name will actually be overwritten during this cache-posioning attack
        ignore: "User",
        ignore2: "5",
      },
    },
  });

  /** should be:
    Object {
      "__typename": "Post",
      "id": "1",
      "title": "Hello",
    }
   */
  expect(cache.extract()["Post:1"]).toMatchInlineSnapshot(`
    Object {
      "__typename": "User",
      "firstName": "Post",
      "id": "1",
      "lastName": "1",
      "title": "Poisoned!",
    }
  `);

  /** should be
    Object {
      "__typename": "User",
      "id": "5",
      "title": "Poisoned!",
      "firstName": "Post",
      "lastName": "1",
    }
   */
  expect(cache.extract()["User:5"]).toMatchInlineSnapshot(`undefined`);
});
