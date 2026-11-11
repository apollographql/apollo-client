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

test("uses operation variables for variables declared by the fragment", () => {
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
      scope: { size: 96 },
    })
  ).toStrictEqual({ size: 96 });
});

test("ignores default values of variables declared by the fragment", () => {
  const document = gql`
    query {
      ...UserCard
    }

    fragment UserCard($size: Int = 32) on User {
      avatar(size: $size)
    }
  `;

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables: {},
      scope: {},
    })
  ).toStrictEqual({});
});

test("passes through operation variables not declared by the fragment", () => {
  const document = gql`
    query ($size: Int, $locale: String) {
      ...UserCard
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
      bio(locale: $locale)
    }
  `;

  const variables = { size: 96, locale: "en" };

  expect(
    getFragmentScope(getFragmentSpread(document, "UserCard"), {
      fragment: getFragment(document, "UserCard"),
      variables,
      scope: variables,
    })
  ).toStrictEqual({ size: 96, locale: "en" });
});
