import type { DocumentNode, FragmentSpreadNode } from "graphql";
import { BREAK, visit } from "graphql";
import { gql } from "graphql-tag";
import { cloneDeep } from "lodash";

import { spyOnConsole } from "../../../testing/internal/index.js";
import {
  getFragmentMaskMode,
  hasAllDirectives,
  hasAnyDirectives,
  hasDirectives,
  shouldInclude,
} from "../directives.js";
import { getQueryDefinition } from "../getFromAST.js";

describe("hasDirectives", () => {
  it("should allow searching the ast for a directive", () => {
    const query = gql`
      query Simple {
        field @live
      }
    `;
    expect(hasDirectives(["live"], query)).toBe(true);
    expect(hasDirectives(["defer"], query)).toBe(false);
  });
  it("works for all operation types", () => {
    const query = gql`
      {
        field @live {
          subField {
            hello @live
          }
        }
      }
    `;

    const mutation = gql`
      mutation Directive {
        mutate {
          field {
            subField {
              hello @live
            }
          }
        }
      }
    `;

    const subscription = gql`
      subscription LiveDirective {
        sub {
          field {
            subField {
              hello @live
            }
          }
        }
      }
    `;

    [query, mutation, subscription].forEach((x) => {
      expect(hasDirectives(["live"], x)).toBe(true);
      expect(hasDirectives(["defer"], x)).toBe(false);
    });
  });
  it("works for simple fragments", () => {
    const query = gql`
      query Simple {
        ...fieldFragment
      }

      fragment fieldFragment on Field {
        foo @live
      }
    `;
    expect(hasDirectives(["live"], query)).toBe(true);
    expect(hasDirectives(["defer"], query)).toBe(false);
  });
  it("works for nested fragments", () => {
    const query = gql`
      query Simple {
        ...fieldFragment1
      }

      fragment fieldFragment1 on Field {
        bar {
          baz {
            ...nestedFragment
          }
        }
      }

      fragment nestedFragment on Field {
        foo @live
      }
    `;
    expect(hasDirectives(["live"], query)).toBe(true);
    expect(hasDirectives(["defer"], query)).toBe(false);
  });

  it("works with both any and all semantics", () => {
    expect(
      hasAnyDirectives(
        ["client", "defer"],
        gql`
          query {
            meetings {
              id
              ... on Meeting @defer {
                room {
                  size
                }
              }
            }
          }
        `
      )
    ).toBe(true);

    expect(
      hasAnyDirectives(
        ["client", "defer"],
        gql`
          query {
            meetings {
              id
              room {
                size
              }
            }
          }
        `
      )
    ).toBe(false);

    expect(
      hasAnyDirectives(
        ["client", "defer"],
        gql`
          query {
            meetings {
              id
              room {
                size
                iAmPresent @client
              }
            }
          }
        `
      )
    ).toBe(true);

    expect(
      hasAllDirectives(
        ["client", "defer"],
        gql`
          query {
            meetings {
              id
              ... on Meeting @defer {
                room {
                  size
                }
              }
            }
          }
        `
      )
    ).toBe(false);

    expect(
      hasAllDirectives(
        ["client", "defer"],
        gql`
          query {
            meetings {
              id
              room {
                size
              }
            }
          }
        `
      )
    ).toBe(false);

    expect(
      hasAllDirectives(
        ["client", "defer"],
        gql`
          query {
            meetings {
              id
              room {
                size
                iAmPresent @client
              }
            }
          }
        `
      )
    ).toBe(false);

    expect(
      hasAllDirectives(
        ["client", "defer"],
        gql`
          query {
            meetings {
              id
              room {
                iAmPresent @client
                ... on Room @defer {
                  size
                }
              }
            }
          }
        `
      )
    ).toBe(true);

    expect(
      hasAllDirectives(
        ["live", "client", "defer"],
        gql`
          query {
            meetings {
              id
              room {
                iAmPresent @client
                ... @defer {
                  size
                }
              }
            }
          }
        `
      )
    ).toBe(false);

    expect(
      hasAllDirectives(
        ["live", "client", "defer"],
        gql`
          query @live {
            meetings {
              room {
                iAmPresent @client
                ... on Room @defer {
                  size
                }
              }
              id
            }
          }
        `
      )
    ).toBe(true);
  });

  it("works when names are duplicated", () => {
    expect(
      hasAnyDirectives(
        ["client", "client", "client"],
        gql`
          query {
            fromClient @client {
              asdf
              foo
            }
          }
        `
      )
    ).toBe(true);

    expect(
      hasAllDirectives(
        ["client", "client", "client"],
        gql`
          query {
            fromClient @client {
              asdf
              foo
            }
          }
        `
      )
    ).toBe(true);

    expect(
      hasAnyDirectives(
        ["live", "live", "defer"],
        gql`
          query {
            fromClient @client {
              asdf
              foo @include(if: true)
            }
          }
        `
      )
    ).toBe(false);

    expect(
      hasAllDirectives(
        ["live", "live", "defer"],
        gql`
          query {
            fromClient @client {
              asdf
              foo @include(if: true)
            }
          }
        `
      )
    ).toBe(false);

    expect(
      hasAllDirectives(
        ["live", "live", "defer"],
        gql`
          query @live {
            fromClient @client {
              ... @defer {
                asdf
                foo @include(if: true)
              }
            }
          }
        `
      )
    ).toBe(true);
  });
});

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
