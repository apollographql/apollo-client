import { BREAK, type FragmentSpreadNode, visit } from "graphql";

import type { DocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";
import { spyOnConsole } from "@apollo/client/testing/internal";

// eslint-disable-next-line local-rules/no-relative-imports
import { getFragmentMaskMode } from "../utils.js";

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
