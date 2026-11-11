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

test("uses operation variables for variables declared by the fragment", () => {
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
  ).toStrictEqual({ size: 96 });
});

test("ignores default values of variables declared by the fragment", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int = 32) on User {
        avatar(size: $size)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: {},
      fragmentVariables: {},
    })
  ).toStrictEqual({});
});

test("passes through operation variables not declared by the fragment", () => {
  const fragment = getFragment(
    gql`
      fragment UserCard($size: Int) on User {
        avatar(size: $size)
        bio(locale: $locale)
      }
    `,
    "UserCard"
  );

  expect(
    getFragmentScope(fragment, {
      operationVariables: { size: 96, locale: "en" },
      fragmentVariables: {},
    })
  ).toStrictEqual({ size: 96, locale: "en" });
});
