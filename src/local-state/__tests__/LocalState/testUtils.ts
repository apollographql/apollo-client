import { gql as origGql } from "graphql-tag";

import { addTypenameToDocument } from "@apollo/client/utilities";

export const gql = (...args: Parameters<typeof origGql>) =>
  addTypenameToDocument(origGql(...args));
