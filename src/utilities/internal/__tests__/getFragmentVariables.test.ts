import type { DocumentNode, FragmentSpreadNode } from "graphql";
import { BREAK, visit } from "graphql";

import { enableExperimentalFragmentVariables, gql } from "@apollo/client";

import { getFragmentVariables } from "../getFragmentVariables.js";

enableExperimentalFragmentVariables();

function getFragmentSpread(document: DocumentNode, name: string) {
  let spread: FragmentSpreadNode | undefined;

  visit(document, {
    FragmentSpread(node) {
      if (node.name.value === name) {
        spread = node;
        return BREAK;
      }
    },
  });

  if (!spread) {
    throw new Error(`Could not find fragment spread "${name}"`);
  }

  return spread;
}

test("adds literal fragment arguments to the variables scope", () => {
  const query = gql`
    query {
      user {
        ...UserCard(size: 32)
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "UserCard"), {})
  ).toStrictEqual({ size: 32 });
});

test("adds fragment arguments of each literal kind", () => {
  const query = gql`
    query {
      user {
        ...UserCard(
          int: 1
          float: 1.5
          string: "hello"
          boolean: true
          enum: LARGE
          nullValue: null
        )
      }
    }

    fragment UserCard(
      $int: Int
      $float: Float
      $string: String
      $boolean: Boolean
      $enum: Size
      $nullValue: Int
    ) on User {
      avatar(
        int: $int
        float: $float
        string: $string
        boolean: $boolean
        enum: $enum
        nullValue: $nullValue
      )
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "UserCard"), {})
  ).toStrictEqual({
    int: 1,
    float: 1.5,
    string: "hello",
    boolean: true,
    enum: "LARGE",
    nullValue: null,
  });
});

test("keeps operation variables that the fragment does not declare", () => {
  const query = gql`
    query ($two: Int) {
      user {
        ...Test(one: 1)
      }
    }

    fragment Test($one: Int) on User {
      a(one: $one)
      b(two: $two)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "Test"), { two: 2 })
  ).toStrictEqual({ one: 1, two: 2 });
});

test("returns the operation variables when the spread has no arguments", () => {
  const query = gql`
    query ($two: Int) {
      user {
        ...Test
      }
    }

    fragment Test on User {
      b(two: $two)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "Test"), { two: 2 })
  ).toStrictEqual({ two: 2 });
});

test("returns an empty object when there are no variables and no arguments", () => {
  const query = gql`
    query {
      user {
        ...Test
      }
    }

    fragment Test on User {
      id
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "Test"), undefined)
  ).toStrictEqual({});
});

test("adds fragment arguments when the operation variables are undefined", () => {
  const query = gql`
    query {
      user {
        ...UserCard(size: 32)
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "UserCard"), undefined)
  ).toStrictEqual({ size: 32 });
});

test("fragment arguments shadow operation variables with the same name", () => {
  const query = gql`
    query ($size: Int) {
      user {
        photo(size: $size)
        ...UserCard(size: 32)
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "UserCard"), { size: 96 })
  ).toStrictEqual({ size: 32 });
});

test("resolves variable arguments against the given variables", () => {
  const query = gql`
    query ($avatarSize: Int) {
      user {
        ...UserCard(size: $avatarSize)
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "UserCard"), {
      avatarSize: 64,
    })
  ).toStrictEqual({ avatarSize: 64, size: 64 });
});

test("resolves variables nested in object and list arguments", () => {
  const query = gql`
    query ($width: Int, $tag: String) {
      user {
        ...UserCard(dimensions: { width: $width, height: 10 }, tags: [$tag, "b"])
      }
    }

    fragment UserCard($dimensions: Dimensions, $tags: [String]) on User {
      avatar(dimensions: $dimensions, tags: $tags)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "UserCard"), {
      width: 5,
      tag: "a",
    })
  ).toStrictEqual({
    width: 5,
    tag: "a",
    dimensions: { width: 5, height: 10 },
    tags: ["a", "b"],
  });
});

test("does not leak parent fragment arguments into a nested fragment scope", () => {
  const query = gql`
    query ($size: Int) {
      user {
        photo(size: $size)
        ...Outer(size: 32)
      }
    }

    fragment Outer($size: Int) on User {
      ...Inner(innerSize: $size)
    }

    fragment Inner($innerSize: Int) on User {
      avatar(size: $innerSize)
    }
  `;

  const outerVariables = getFragmentVariables(
    getFragmentSpread(query, "Outer"),
    { size: 96 }
  );

  expect(
    getFragmentVariables(getFragmentSpread(query, "Inner"), outerVariables)
  ).toStrictEqual({ size: 96, innerSize: 32 });
});

test("object arguments replace operation variables with the same name", () => {
  const query = gql`
    query ($input: Input) {
      user {
        photo(input: $input)
        ...UserCard(input: { a: 3 })
      }
    }

    fragment UserCard($input: Input) on User {
      avatar(input: $input)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "UserCard"), {
      input: { a: 1, b: 2 },
    })
  ).toStrictEqual({ input: { a: 3 } });
});

test("list arguments replace operation variables with the same name", () => {
  const query = gql`
    query ($tags: [String]) {
      user {
        photo(tags: $tags)
        ...UserCard(tags: ["c"])
      }
    }

    fragment UserCard($tags: [String]) on User {
      avatar(tags: $tags)
    }
  `;

  expect(
    getFragmentVariables(getFragmentSpread(query, "UserCard"), {
      tags: ["a", "b"],
    })
  ).toStrictEqual({ tags: ["c"] });
});

test("does not modify the given variables", () => {
  const query = gql`
    query ($size: Int, $input: Input) {
      user {
        photo(size: $size, input: $input)
        ...UserCard(size: 32, input: { a: 3 })
      }
    }

    fragment UserCard($size: Int, $input: Input) on User {
      avatar(size: $size, input: $input)
    }
  `;

  const variables = { size: 96, input: { a: 1, b: 2 } };

  getFragmentVariables(getFragmentSpread(query, "UserCard"), variables);

  expect(variables).toStrictEqual({ size: 96, input: { a: 1, b: 2 } });
});
