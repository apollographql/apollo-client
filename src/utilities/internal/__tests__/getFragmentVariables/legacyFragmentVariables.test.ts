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

test("uses operation variables for variables declared by the fragment", () => {
  const query = gql`
    query ($size: Int) {
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
      variables: { size: 96 },
    })
  ).toStrictEqual({ size: 96 });
});

test("ignores default values of variables declared by the fragment", () => {
  const query = gql`
    query {
      user {
        ...UserCard
      }
    }

    fragment UserCard($size: Int = 32) on User {
      avatar(size: $size)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: {},
    })
  ).toStrictEqual({});
});

test("passes through operation variables not declared by the fragment", () => {
  const query = gql`
    query ($size: Int, $locale: String) {
      user {
        ...UserCard
      }
    }

    fragment UserCard($size: Int) on User {
      avatar(size: $size)
      bio(locale: $locale)
    }
  `;

  const { fragment, fragmentSpread } = getFragment(query, "UserCard");

  expect(
    getFragmentVariables(fragmentSpread, {
      fragment,
      variables: { size: 96, locale: "en" },
    })
  ).toStrictEqual({ size: 96, locale: "en" });
});
