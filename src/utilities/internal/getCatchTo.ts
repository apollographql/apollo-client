import type { FieldNode } from "graphql";
import { Kind } from "graphql";

import type { CatchTo } from "@apollo/client";
import { __DEV__ } from "@apollo/client/utilities/environment";
import { invariant } from "@apollo/client/utilities/invariant";

import { cacheSizes, defaultCacheSizes } from "../caching/sizes.js";

import { memoize } from "./memoize.js";

export const getCatchTo = memoize(
  function getCatchTo(
    field: FieldNode,
    defaultCatchTo: CatchTo = "NULL"
  ): CatchTo {
    const directive = field.directives?.find((d) => d.name.value === "catch");
    if (!directive) return defaultCatchTo;

    const arg = directive.arguments?.find((a) => a.name.value === "to");
    if (!arg) return defaultCatchTo;

    invariant(
      arg.value.kind === Kind.ENUM,
      "@catch(to:) must be an enum value"
    );
    const catchTo = arg.value.value;

    if (__DEV__) {
      invariant(
        catchTo === "NULL" || catchTo === "THROW" || catchTo === "RESULT",
        "Unsupported @catch(to:) type: '%s'",
        catchTo
      );
    }

    return catchTo as CatchTo;
  },
  { max: cacheSizes["getCatchTo"] || defaultCacheSizes["getCatchTo"] }
);
