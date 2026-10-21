import type { DocumentNode, FragmentSpreadNode } from "graphql";
import { BREAK, visit } from "graphql";

import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import {
  getFragmentDefinitions,
  getFragmentVariables,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

enableExperimentalFragmentVariables();

function getFragment(document: DocumentNode, name: string) {
  let fragmentSpread: FragmentSpreadNode | undefined;

  const fragment = getFragmentDefinitions(document).find(
    (definition) => definition.name.value === name
  );

  visit(document, {
    FragmentSpread(node) {
      if (node.name.value === name) {
        fragmentSpread = node;
        return BREAK;
      }
    },
  });

  invariant(fragment, `Could not find fragment "${name}"`);
  invariant(fragmentSpread, `Could not find fragment spread "${name}"`);

  return { fragment, fragmentSpread };
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

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
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

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
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

  const { fragment, fragmentSpread } = getFragment(query, "Test");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { two: 2 },
    })
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

  const { fragment, fragmentSpread } = getFragment(query, "Test");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { two: 2 },
    })
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

  const { fragment, fragmentSpread } = getFragment(query, "Test");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: undefined,
    })
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

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: undefined,
    })
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

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { size: 96 },
    })
  ).toStrictEqual({ size: 32 });
});

test("resolves variable arguments against the operation variables without a parent scope", () => {
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

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { avatarSize: 64 },
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

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { width: 5, tag: "a" },
    })
  ).toStrictEqual({
    width: 5,
    tag: "a",
    dimensions: { width: 5, height: 10 },
    tags: ["a", "b"],
  });
});

test("resolves nested spread arguments against the parent scope", () => {
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

  const outer = getFragment(query, "Outer");
  const inner = getFragment(query, "Inner");
  const variables = { size: 96 };
  const outerScope = getFragmentVariables(outer.fragmentSpread, {
    fragment: outer.fragment,
    variables,
  });

  expect(outerScope).toStrictEqual({ size: 32 });
  expect(
    getFragmentVariables(inner.fragmentSpread, {
      fragment: inner.fragment,
      variables,
      parentScope: outerScope,
    })
  ).toStrictEqual({ size: 96, innerSize: 32 });
});

test("resolves nested spread arguments to operation variables that the parent does not declare", () => {
  const query = gql`
    query ($n: Int) {
      user {
        ...Outer(size: 32)
      }
    }

    fragment Outer($size: Int) on User {
      avatar(size: $size)
      ...Inner(innerSize: $n)
    }

    fragment Inner($innerSize: Int) on User {
      photo(size: $innerSize)
    }
  `;

  const outer = getFragment(query, "Outer");
  const inner = getFragment(query, "Inner");
  const variables = { n: 5 };
  const outerScope = getFragmentVariables(outer.fragmentSpread, {
    fragment: outer.fragment,
    variables,
  });

  expect(outerScope).toStrictEqual({ n: 5, size: 32 });
  expect(
    getFragmentVariables(inner.fragmentSpread, {
      fragment: inner.fragment,
      variables,
      parentScope: outerScope,
    })
  ).toStrictEqual({ n: 5, innerSize: 5 });
});

test("does not add parent fragment arguments to a nested fragment scope", () => {
  const query = gql`
    query ($x: Int) {
      user {
        ...Foo(x: 1)
      }
    }

    fragment Foo($x: Int) on User {
      fooValue: value(x: $x)
      ...Bar
    }

    fragment Bar on User {
      value(x: $x)
    }
  `;

  const foo = getFragment(query, "Foo");
  const bar = getFragment(query, "Bar");
  const variables = { x: 99 };
  const fooScope = getFragmentVariables(foo.fragmentSpread, {
    fragment: foo.fragment,
    variables,
  });

  expect(fooScope).toStrictEqual({ x: 1 });
  expect(
    getFragmentVariables(bar.fragmentSpread, {
      fragment: bar.fragment,
      variables,
      parentScope: fooScope,
    })
  ).toStrictEqual({ x: 99 });
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

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { input: { a: 1, b: 2 } },
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

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { tags: ["a", "b"] },
    })
  ).toStrictEqual({ tags: ["c"] });
});

test("does not modify the given variables or parent scope", () => {
  const query = gql`
    query ($size: Int, $input: Input) {
      user {
        photo(size: $size, input: $input)
        ...Outer(size: 32)
      }
    }

    fragment Outer($size: Int) on User {
      avatar(size: $size)
      ...Inner(innerSize: $size, input: { a: 3 })
    }

    fragment Inner($innerSize: Int, $input: Input) on User {
      innerAvatar: avatar(size: $innerSize, input: $input)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "Inner");
  const variables = { size: 96, input: { a: 1, b: 2 } };
  const parentScope = { size: 32, input: { a: 1, b: 2 } };

  getFragmentVariables(fragmentSpread, {
    fragment,
    variables,
    parentScope,
  });

  expect(variables).toStrictEqual({ size: 96, input: { a: 1, b: 2 } });
  expect(parentScope).toStrictEqual({ size: 32, input: { a: 1, b: 2 } });
});

test("uses the fragment default when the spread omits the argument", () => {
  const query = gql`
    query {
      user {
        ...UserCard
      }
    }

    fragment UserCard($size: Int = 48) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
  ).toStrictEqual({ size: 48 });
});

test("uses the fragment default over an operation variable with the same name", () => {
  const query = gql`
    query ($size: Int) {
      user {
        photo(size: $size)
        ...UserCard
      }
    }

    fragment UserCard($size: Int = 48) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { size: 96 },
    })
  ).toStrictEqual({ size: 48 });
});

test("uses the spread argument over the fragment default", () => {
  const query = gql`
    query {
      user {
        ...UserCard(size: 32)
      }
    }

    fragment UserCard($size: Int = 48) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
  ).toStrictEqual({ size: 32 });
});

test("uses the fragment default when a variable argument has no value", () => {
  const query = gql`
    query ($n: Int) {
      user {
        ...UserCard(size: $n)
      }
    }

    fragment UserCard($size: Int = 48) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
  ).toStrictEqual({ size: 48 });
});

test("does not use the fragment default when a variable argument is null", () => {
  const query = gql`
    query ($n: Int) {
      user {
        ...UserCard(size: $n)
      }
    }

    fragment UserCard($size: Int = 48) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { n: null },
    })
  ).toStrictEqual({ n: null, size: null });
});

test("does not use the fragment default when the spread argument is null", () => {
  const query = gql`
    query {
      user {
        ...UserCard(size: null)
      }
    }

    fragment UserCard($size: Int = 48) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
  ).toStrictEqual({ size: null });
});

test("uses object and list fragment defaults", () => {
  const query = gql`
    query {
      user {
        ...UserCard
      }
    }

    fragment UserCard(
      $input: Input = { a: 1, b: 2 }
      $tags: [String] = ["a", "b"]
      $enum: Size = LARGE
    ) on User {
      avatar(input: $input, tags: $tags, enum: $enum)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
  ).toStrictEqual({
    input: { a: 1, b: 2 },
    tags: ["a", "b"],
    enum: "LARGE",
  });
});

test("hides an operation variable that the fragment declares without a default", () => {
  const query = gql`
    query ($size: Int) {
      user {
        photo(size: $size)
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { size: 96 },
    })
  ).toStrictEqual({ size: undefined });
});

test("adds a fragment variable that is declared without a default and has no value", () => {
  const query = gql`
    query {
      user {
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
  ).toStrictEqual({ size: undefined });
});

test("resolves a nested spread argument to the parent fragment default", () => {
  const query = gql`
    query ($size: Int) {
      user {
        photo(size: $size)
        ...Outer
      }
    }

    fragment Outer($size: Int = 10) on User {
      ...Inner(innerSize: $size)
    }

    fragment Inner($innerSize: Int) on User {
      avatar(size: $innerSize)
    }
  `;

  const outer = getFragment(query, "Outer");
  const inner = getFragment(query, "Inner");
  const variables = { size: 96 };
  const outerScope = getFragmentVariables(outer.fragmentSpread, {
    fragment: outer.fragment,
    variables,
  });

  expect(outerScope).toStrictEqual({ size: 10 });
  expect(
    getFragmentVariables(inner.fragmentSpread, {
      fragment: inner.fragment,
      variables,
      parentScope: outerScope,
    })
  ).toStrictEqual({ size: 96, innerSize: 10 });
});
