import { disableFragmentWarnings, gql } from "graphql-tag";

import type { FragmentMap } from "@apollo/client/utilities/internal";
import {
  createFragmentMap,
  getFragmentDefinitions,
} from "@apollo/client/utilities/internal";

// Turn off warnings for repeated fragment names
disableFragmentWarnings();

it("should create the fragment map correctly", () => {
  const fragments = getFragmentDefinitions(gql`
    fragment authorDetails on Author {
      firstName
      lastName
    }

    fragment moreAuthorDetails on Author {
      address
    }
  `);
  const fragmentMap = createFragmentMap(fragments);
  const expectedTable: FragmentMap = {
    authorDetails: fragments[0],
    moreAuthorDetails: fragments[1],
  };
  expect(fragmentMap).toEqual(expectedTable);
});

it("should return an empty fragment map if passed undefined argument", () => {
  expect(createFragmentMap(undefined)).toEqual({});
});
