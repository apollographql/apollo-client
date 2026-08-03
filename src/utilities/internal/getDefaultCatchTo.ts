import { Kind } from "graphql";

import type { CatchTo, DocumentNode } from "@apollo/client";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import { cacheSizes, defaultCacheSizes } from "../caching/sizes.js";

import { getMainDefinition } from "./getMainDefinition.js";
import { memoize } from "./memoize.js";

export const getDefaultCatchTo = memoize(
  function getDefaultCatchTo(
    document: DocumentNode,
    fallbackCatchTo: CatchTo = "NULL"
  ): CatchTo {
    const directive = getMainDefinition(document)?.directives?.find(
      (d) => d.name.value === "catchByDefault"
    );
    if (!directive) return fallbackCatchTo;

    const arg = directive.arguments?.find((arg) => arg.name.value === "to");
    if (!arg) return fallbackCatchTo;

    invariant(
      arg.value.kind === Kind.ENUM,
      "@catchByDefault(to:) must be an enum"
    );

    const catchTo = arg.value.value;

    if (__DEV__) {
      invariant(
        catchTo === "NULL" || catchTo === "THROW" || catchTo === "RESULT",
        "Unsupported @catchByDefault(to:) value: '%s'",
        catchTo
      );
    }

    return catchTo as CatchTo;
  },
  {
    max: cacheSizes["getCatchTo"] || defaultCacheSizes["getCatchTo"],
  }
);
