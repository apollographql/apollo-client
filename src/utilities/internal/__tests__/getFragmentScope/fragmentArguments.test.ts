import type { DocumentNode } from "graphql";

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

test("adds fragment variables to the scope", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int) on User {
        avatar(size: $size)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: {},
      fragmentVariables: { size: 32 },
    })
  ).toStrictEqual({ size: 32 });
});

test("keeps operation variables that the fragment does not declare", () => {
  const fragment = getFragment(
    gql`
      fragment Test($one: Int) on User {
        a(one: $one)
        b(two: $two)
      }
    `,
    "Test"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { two: 2 },
      fragmentVariables: { one: 1 },
    })
  ).toStrictEqual({ one: 1, two: 2 });
});

test("returns the operation variables when the fragment declares no variables", () => {
  const fragment = getFragment(
    gql`
      fragment Test on User {
        b(two: $two)
      }
    `,
    "Test"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { two: 2 },
      fragmentVariables: {},
    })
  ).toStrictEqual({ two: 2 });
});

test("returns the same operation variables object when the fragment declares no variables", () => {
  const fragment = getFragment(
    gql`
      fragment Test on User {
        b(two: $two)
      }
    `,
    "Test"
  );
  const operationVariables = { two: 2 };

  expect(
    getFragmentScope(fragment, { operationVariables, fragmentVariables: {} })
  ).toBe(operationVariables);
});

test("returns an empty object when the operation variables are undefined and the fragment declares no variables", () => {
  const fragment = getFragment(
    gql`
      fragment Test on User {
        id
      }
    `,
    "Test"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: undefined,
      fragmentVariables: {},
    })
  ).toStrictEqual({});
});

test("adds fragment variables when the operation variables are undefined", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int) on User {
        avatar(size: $size)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: undefined,
      fragmentVariables: { size: 32 },
    })
  ).toStrictEqual({ size: 32 });
});

test("fragment variables shadow operation variables with the same name", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int) on User {
        avatar(size: $size)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { size: 96 },
      fragmentVariables: { size: 32 },
    })
  ).toStrictEqual({ size: 32 });
});

test("hides an operation variable that the fragment declares without a value", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int) on User {
        avatar(size: $size)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { size: 96 },
      fragmentVariables: {},
    })
  ).toStrictEqual({});
});

test("hides only the operation variables that the fragment declares", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int, $format: String) on User {
        avatar(size: $size, format: $format)
        bio(locale: $locale)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { size: 96, format: "jpg", locale: "en" },
      fragmentVariables: { format: "png" },
    })
  ).toStrictEqual({ format: "png", locale: "en" });
});

test("object fragment variables replace operation variables with the same name", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($input: Input) on User {
        avatar(input: $input)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { input: { a: 1, b: 2 } },
      fragmentVariables: { input: { a: 3 } },
    })
  ).toStrictEqual({ input: { a: 3 } });
});

test("list fragment variables replace operation variables with the same name", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($tags: [String]) on User {
        avatar(tags: $tags)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { tags: ["a", "b"] },
      fragmentVariables: { tags: ["c"] },
    })
  ).toStrictEqual({ tags: ["c"] });
});

test("keeps null fragment variables and null operation variables", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int) on User {
        avatar(size: $size)
        photo(size: $n)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { n: null },
      fragmentVariables: { size: null },
    })
  ).toStrictEqual({ n: null, size: null });
});

test("does not add parent fragment variables to a nested fragment scope", () => {
  const document = gql`
    fragment Foo($x: Int) on User {
      fooValue: value(x: $x)
      ...Bar
    }

    fragment Bar on User {
      value(x: $x)
    }
  `;

  const operationVariables = { x: 99 };

  expect(
    getFragmentScope(getFragment(document, "Foo"), {
      operationVariables,
      fragmentVariables: { x: 1 },
    })
  ).toStrictEqual({ x: 1 });
  expect(
    getFragmentScope(getFragment(document, "Bar"), {
      operationVariables,
      fragmentVariables: {},
    })
  ).toStrictEqual({ x: 99 });
});

test("uses operation variables in a nested fragment scope that the parent fragment declares", () => {
  const document = gql`
    fragment Outer($size: Int) on User {
      ...Inner(innerSize: $size)
    }

    fragment Inner($innerSize: Int) on User {
      avatar(size: $innerSize)
      photo(size: $size)
    }
  `;

  const operationVariables = { size: 96 };

  expect(
    getFragmentScope(getFragment(document, "Outer"), {
      operationVariables,
      fragmentVariables: { size: 32 },
    })
  ).toStrictEqual({ size: 32 });
  expect(
    getFragmentScope(getFragment(document, "Inner"), {
      operationVariables,
      fragmentVariables: { innerSize: 32 },
    })
  ).toStrictEqual({ size: 96, innerSize: 32 });
});

test("does not read fragment variables from the object prototype", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($constructor: Int, $toString: Int = 5) on User {
        first: value(x: $constructor)
        second: value(x: $toString)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: {},
      fragmentVariables: { toString: 5 },
    })
  ).toStrictEqual({ toString: 5 });
});

test("does not modify the given operation variables or fragment variables", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int) on User {
        avatar(size: $size)
        bio(locale: $locale)
      }
    `,
    "UserCard"
  );

  const operationVariables = { size: 96, locale: "en" };
  const fragmentVariables = { size: 32 };

  getFragmentScope(fragment, { operationVariables, fragmentVariables });

  expect(operationVariables).toStrictEqual({ size: 96, locale: "en" });
  expect(fragmentVariables).toStrictEqual({ size: 32 });
});
