import { gql as origGql } from "graphql-tag";

import { addTypenameToDocument } from "@apollo/client/utilities";

export const gql = (...args: Parameters<typeof origGql>) =>
  addTypenameToDocument(origGql(...args));

export const WARNINGS = {
  MISSING_RESOLVER:
    "Could not find a resolver for the '%s' field nor does the cache resolve the field. The field value has been set to `null`. Either define a resolver for the field or ensure the cache can resolve the value, for example, by adding a 'read' function to a field policy in 'InMemoryCache'.",
  NO_CACHE:
    "The '%s' field resolves the value from the cache, for example from a 'read' function, but a 'no-cache' fetch policy was used. The field value has been set to `null`. Either define a local resolver or use a fetch policy that uses the cache to ensure the field is resolved correctly.",
};
