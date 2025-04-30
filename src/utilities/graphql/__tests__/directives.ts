import type { DocumentNode, FragmentSpreadNode } from "graphql";
import { BREAK, visit } from "graphql";
import { gql } from "graphql-tag";
import { cloneDeep } from "lodash";

import { spyOnConsole } from "@apollo/client/testing/internal";
import {
  getFragmentMaskMode,
  getQueryDefinition,
  shouldInclude,
} from "@apollo/client/utilities";

describe("shouldInclude", () => {
  it("should should not include a skipped field", () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: true)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(!shouldInclude(field, {})).toBe(true);
  });

  it("should include an included field", () => {
    const query = gql`
      query {
        fortuneCookie @include(if: true)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(shouldInclude(field, {})).toBe(true);
  });

  it("should not include a not include: false field", () => {
    const query = gql`
      query {
        fortuneCookie @include(if: false)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(!shouldInclude(field, {})).toBe(true);
  });

  it("should include a skip: false field", () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: false)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(shouldInclude(field, {})).toBe(true);
  });

  it("should not include a field if skip: true and include: true", () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: true) @include(if: true)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(!shouldInclude(field, {})).toBe(true);
  });

  it("should not include a field if skip: true and include: false", () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: true) @include(if: false)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(!shouldInclude(field, {})).toBe(true);
  });

  it("should include a field if skip: false and include: true", () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: false) @include(if: true)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(shouldInclude(field, {})).toBe(true);
  });

  it("should not include a field if skip: false and include: false", () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: false) @include(if: false)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(!shouldInclude(field, {})).toBe(true);
  });

  it("should leave the original query unmodified", () => {
    const query = gql`
      query {
        fortuneCookie @skip(if: false) @include(if: false)
      }
    `;
    const queryClone = cloneDeep(query);
    const field = getQueryDefinition(query).selectionSet.selections[0];
    shouldInclude(field, {});
    expect(query).toEqual(queryClone);
  });

  it("does not throw an error on an unsupported directive", () => {
    const query = gql`
      query {
        fortuneCookie @dosomething(if: true)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];

    expect(() => {
      shouldInclude(field, {});
    }).not.toThrow();
  });

  it("throws an error on an invalid argument for the skip directive", () => {
    const query = gql`
      query {
        fortuneCookie @skip(nothing: true)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];

    expect(() => {
      shouldInclude(field, {});
    }).toThrow();
  });

  it("throws an error on an invalid argument for the include directive", () => {
    const query = gql`
      query {
        fortuneCookie @include(nothing: true)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];

    expect(() => {
      shouldInclude(field, {});
    }).toThrow();
  });

  it("throws an error on an invalid variable name within a directive argument", () => {
    const query = gql`
      query {
        fortuneCookie @include(if: $neverDefined)
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(() => {
      shouldInclude(field, {});
    }).toThrow();
  });

  it("evaluates variables on skip fields", () => {
    const query = gql`
      query ($shouldSkip: Boolean) {
        fortuneCookie @skip(if: $shouldSkip)
      }
    `;
    const variables = {
      shouldSkip: true,
    };
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(!shouldInclude(field, variables)).toBe(true);
  });

  it("evaluates variables on include fields", () => {
    const query = gql`
      query ($shouldSkip: Boolean) {
        fortuneCookie @include(if: $shouldInclude)
      }
    `;
    const variables = {
      shouldInclude: false,
    };
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(!shouldInclude(field, variables)).toBe(true);
  });

  it("throws an error if the value of the argument is not a variable or boolean", () => {
    const query = gql`
      query {
        fortuneCookie @include(if: "string")
      }
    `;
    const field = getQueryDefinition(query).selectionSet.selections[0];
    expect(() => {
      shouldInclude(field, {});
    }).toThrow();
  });
});

describe("getFragmentMaskMode", () => {
  it("returns 'unmask' when @unmask used on fragment node", () => {
    const fragmentNode = getFragmentSpreadNode(gql`
      query {
        ...MyFragment @unmask
      }
    `);

    const mode = getFragmentMaskMode(fragmentNode);

    expect(mode).toBe("unmask");
  });

  it("returns 'mask' when no directives are present", () => {
    const fragmentNode = getFragmentSpreadNode(gql`
      query {
        ...MyFragment
      }
    `);

    const mode = getFragmentMaskMode(fragmentNode);

    expect(mode).toBe("mask");
  });

  it("returns 'mask' when a different directive is used", () => {
    const fragmentNode = getFragmentSpreadNode(gql`
      query {
        ...MyFragment @myDirective
      }
    `);

    const mode = getFragmentMaskMode(fragmentNode);

    expect(mode).toBe("mask");
  });

  it("returns 'unmask' when used with other directives", () => {
    const fragmentNode = getFragmentSpreadNode(gql`
      query {
        ...MyFragment @myDirective @unmask
      }
    `);

    const mode = getFragmentMaskMode(fragmentNode);

    expect(mode).toBe("unmask");
  });

  it("returns 'migrate' when passing mode: 'migrate' as argument", () => {
    const fragmentNode = getFragmentSpreadNode(gql`
      query {
        ...MyFragment @unmask(mode: "migrate")
      }
    `);

    const mode = getFragmentMaskMode(fragmentNode);

    expect(mode).toBe("migrate");
  });

  it("warns and returns 'unmask' when using variable for mode argument", () => {
    using _ = spyOnConsole("warn");
    const fragmentNode = getFragmentSpreadNode(gql`
      query ($mode: String!) {
        ...MyFragment @unmask(mode: $mode)
      }
    `);

    const mode = getFragmentMaskMode(fragmentNode);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "@unmask 'mode' argument does not support variables."
    );
    expect(mode).toBe("unmask");
  });

  it("warns and returns 'unmask' when passing a non-string argument to mode", () => {
    using _ = spyOnConsole("warn");
    const fragmentNode = getFragmentSpreadNode(gql`
      query {
        ...MyFragment @unmask(mode: true)
      }
    `);

    const mode = getFragmentMaskMode(fragmentNode);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "@unmask 'mode' argument must be of type string."
    );
    expect(mode).toBe("unmask");
  });

  it("warns and returns 'unmask' when passing a value other than 'migrate' to mode", () => {
    using _ = spyOnConsole("warn");
    const fragmentNode = getFragmentSpreadNode(gql`
      query {
        ...MyFragment @unmask(mode: "invalid")
      }
    `);

    const mode = getFragmentMaskMode(fragmentNode);

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "@unmask 'mode' argument does not recognize value '%s'.",
      "invalid"
    );
    expect(mode).toBe("unmask");
  });
});

function getFragmentSpreadNode(document: DocumentNode): FragmentSpreadNode {
  let fragmentSpreadNode: FragmentSpreadNode | undefined = undefined;

  visit(document, {
    FragmentSpread: (node) => {
      fragmentSpreadNode = node;
      return BREAK;
    },
  });

  if (!fragmentSpreadNode) {
    throw new Error("Must give a document with a fragment spread");
  }

  return fragmentSpreadNode;
}
