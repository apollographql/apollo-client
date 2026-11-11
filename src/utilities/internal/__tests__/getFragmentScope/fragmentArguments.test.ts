import type { DocumentNode, FragmentSpreadNode } from "graphql";
import { visit } from "graphql";

import { enableExperimentalFragmentVariables, gql } from "@apollo/client";
import {
  getFragmentDefinitions,
  getFragmentScope,
} from "@apollo/client/utilities/internal";
import { invariant } from "@apollo/client/utilities/invariant";

enableExperimentalFragmentVariables();

function getFragment(document: DocumentNode, name: string) {
  const fragment = getFragmentDefinitions(document).find(
    (definition) => definition.name.value === name
  );

  invariant(fragment, `Could not find fragment "${name}"`);

  return fragment;
}

function getFragmentSpread(document: DocumentNode, name: string) {
  let fragmentSpread: FragmentSpreadNode | undefined;

  visit(document, {
    FragmentSpread(node) {
      if (node.name.value === name) {
        fragmentSpread ??= node;
      }
    },
  });

  invariant(fragmentSpread, `Could not find fragment spread "${name}"`);

  return fragmentSpread;
}

test("adds fragment arguments to the scope", () => {
  const document = gql`
    query {
      ...UserCard(size: 32)
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables: {},
      parentScope: {},
    })
  ).toStrictEqual({ size: 32 });
});

test("keeps operation variables that the fragment does not declare", () => {
  const document = gql`
    query ($two: Int) {
      ...Test(one: 1)
    }

    fragment Test($one: Int) on User {
      a(one: $one)
      b(two: $two)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "Test"), {
      fragment: getFragment(document, "Test"),
      variables: { two: 2 },
      parentScope: { two: 2 },
    })
  ).toStrictEqual({ one: 1, two: 2 });
});

test("returns the operation variables when the fragment declares no variables", () => {
  const document = gql`
    query ($two: Int) {
      ...Test
    }

    fragment Test on User {
      b(two: $two)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "Test"), {
      fragment: getFragment(document, "Test"),
      variables: { two: 2 },
      parentScope: { two: 2 },
    })
  ).toStrictEqual({ two: 2 });
});

test("returns the same operation variables object when the fragment declares no variables", () => {
  const document = gql`
    query ($two: Int) {
      ...Test
    }

    fragment Test on User {
      b(two: $two)
    }
  `;
  const variables = { two: 2 };

  expect(
    getFragmentScope(getFragmentSpread(document, "Test"), {
      fragment: getFragment(document, "Test"),
      variables,
      parentScope: variables,
    })
  ).toBe(variables);
});

test("returns an empty object when the operation variables are undefined and the fragment declares no variables", () => {
  const document = gql`
    query {
      ...Test
    }

    fragment Test on User {
      id
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "Test"), {
      fragment: getFragment(document, "Test"),
      variables: undefined,
      parentScope: undefined,
    })
  ).toStrictEqual({});
});

test("adds fragment arguments when the operation variables are undefined", () => {
  const document = gql`
    query {
      ...UserCard(size: 32)
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables: undefined,
      parentScope: undefined,
    })
  ).toStrictEqual({ size: 32 });
});

test("resolves variable arguments against the scope", () => {
  const document = gql`
    query ($avatarSize: Int) {
      ...UserCard(size: $avatarSize)
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables: { avatarSize: 96 },
      parentScope: { avatarSize: 64 },
    })
  ).toStrictEqual({ avatarSize: 96, size: 64 });
});

test("uses the default value of a fragment variable without an argument", () => {
  const document = gql`
    query {
      ...UserCard
    }

    fragment UserCard($size: Int = 48) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables: {},
      parentScope: {},
    })
  ).toStrictEqual({ size: 48 });
});

test("fragment arguments shadow operation variables with the same name", () => {
  const document = gql`
    query ($size: Int) {
      ...UserCard(size: 32)
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables: { size: 96 },
      parentScope: { size: 96 },
    })
  ).toStrictEqual({ size: 32 });
});

test("hides an operation variable that the fragment declares without an argument", () => {
  const document = gql`
    query ($size: Int) {
      ...UserCard
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables: { size: 96 },
      parentScope: { size: 96 },
    })
  ).toStrictEqual({});
});

test("hides only the operation variables that the fragment declares", () => {
  const document = gql`
    query ($size: Int, $format: String, $locale: String) {
      ...UserCard(format: "png")
    }

    fragment UserCard($size: Int, $format: String) on User {
      avatar(size: $size, format: $format)
      bio(locale: $locale)
    }
  `;

  const variables = { size: 96, format: "jpg", locale: "en" };

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables,
      parentScope: variables,
    })
  ).toStrictEqual({ format: "png", locale: "en" });
});

test("object fragment arguments replace operation variables with the same name", () => {
  const document = gql`
    query ($input: Input) {
      ...UserCard(input: { a: 3 })
    }

    fragment UserCard($input: Input) on User {
      avatar(input: $input)
    }
  `;

  const variables = { input: { a: 1, b: 2 } };

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables,
      parentScope: variables,
    })
  ).toStrictEqual({ input: { a: 3 } });
});

test("list fragment arguments replace operation variables with the same name", () => {
  const document = gql`
    query ($tags: [String]) {
      ...UserCard(tags: ["c"])
    }

    fragment UserCard($tags: [String]) on User {
      avatar(tags: $tags)
    }
  `;

  const variables = { tags: ["a", "b"] };

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables,
      parentScope: variables,
    })
  ).toStrictEqual({ tags: ["c"] });
});

test("keeps null fragment arguments and null operation variables", () => {
  const document = gql`
    query ($n: Int) {
      ...UserCard(size: null)
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
      photo(size: $n)
    }
  `;

  const variables = { n: null };

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables,
      parentScope: variables,
    })
  ).toStrictEqual({ n: null, size: null });
});

test("does not add parent fragment arguments to a nested fragment scope", () => {
  const document = gql`
    query ($x: Int) {
      ...Foo(x: 1)
    }

    fragment Foo($x: Int) on User {
      fooValue: value(x: $x)
      ...Bar
    }

    fragment Bar on User {
      value(x: $x)
    }
  `;

  const variables = { x: 99 };

  const fooScope = getFragmentScope(getFragmentSpread(document, "Foo"), {
    fragment: getFragment(document, "Foo"),
    variables,
    parentScope: variables,
  });

  expect(fooScope).toStrictEqual({ x: 1 });
  expect(
    getFragmentScope(getFragmentSpread(document, "Bar"), {
      fragment: getFragment(document, "Bar"),
      variables,
      parentScope: fooScope,
    })
  ).toStrictEqual({ x: 99 });
});

test("resolves nested fragment arguments against the parent fragment scope", () => {
  const document = gql`
    query ($size: Int) {
      ...Outer(size: 32)
    }

    fragment Outer($size: Int) on User {
      ...Inner(innerSize: $size)
    }

    fragment Inner($innerSize: Int) on User {
      avatar(size: $innerSize)
      photo(size: $size)
    }
  `;

  const variables = { size: 96 };

  const outerScope = getFragmentScope(getFragmentSpread(document, "Outer"), {
    fragment: getFragment(document, "Outer"),
    variables,
    parentScope: variables,
  });

  expect(outerScope).toStrictEqual({ size: 32 });
  expect(
    getFragmentScope(getFragmentSpread(document, "Inner"), {
      fragment: getFragment(document, "Inner"),
      variables,
      parentScope: outerScope,
    })
  ).toStrictEqual({ size: 96, innerSize: 32 });
});

test("does not read fragment variables from the object prototype", () => {
  const document = gql`
    query {
      ...UserCard
    }

    fragment UserCard($constructor: Int, $toString: Int = 5) on User {
      first: value(x: $constructor)
      second: value(x: $toString)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables: {},
      parentScope: {},
    })
  ).toStrictEqual({ toString: 5 });
});

test("does not modify the given operation variables or parent scope", () => {
  const document = gql`
    query ($size: Int, $locale: String) {
      ...UserCard(size: 32)
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
      bio(locale: $locale)
    }
  `;

  const variables = { size: 96, locale: "en" };
  const parentScope = { size: 64, locale: "fr" };

  getFragmentScope(getFragmentSpread(document, "UserCard"), {
    fragment: getFragment(document, "UserCard"),
    variables,
    parentScope,
  });

  expect(variables).toStrictEqual({ size: 96, locale: "en" });
  expect(parentScope).toStrictEqual({ size: 64, locale: "fr" });
});
