import type { Transform } from "jscodeshift";

import type { IdentifierRename } from "./renames.js";
import { callExpressionToNewExpression } from "./util/callExpressionToNewExpression.js";
import { handleIdentiferRename } from "./util/handleIdentiferRename.js";

const linkTransform: Transform = function transform(file, api) {
  const j = api.jscodeshift;
  const source = j(file.source);
  const context = { j, source };
  const changes = [
    {
      from: {
        module: "@apollo/client/link",
        alternativeModules: ["@apollo/client"],
        identifier: "concat",
      },
      to: { namespace: "ApolloLink" },
      importType: "value",
    },
    {
      from: {
        module: "@apollo/client/link",
        alternativeModules: ["@apollo/client"],
        identifier: "empty",
      },
      to: { namespace: "ApolloLink" },
      importType: "value",
    },
    {
      from: {
        module: "@apollo/client/link",
        alternativeModules: ["@apollo/client"],
        identifier: "from",
      },
      to: { namespace: "ApolloLink" },
      importType: "value",
    },
    {
      from: {
        module: "@apollo/client/link",
        alternativeModules: ["@apollo/client"],
        identifier: "split",
      },
      to: { namespace: "ApolloLink" },
      importType: "value",
    },
    {
      from: { module: "@apollo/client/link/error", identifier: "onError" },
      to: { identifier: "ErrorLink" },
      importType: "value",
      postProcess: callExpressionToNewExpression(),
    },
    // {
    //   from: { module: "@apollo/client/link/context", identifier: "setContext" },
    //   to: { identifier: "SetContextLink" },
    //   importType: "value",
    //   // Note: setContext arguments are flipped compared to SetContextLink
    //   // cannot codemod this reliably, so we leave it to the user
    //   postProcess: callExpressionToNewExpression(),
    // },
    {
      from: {
        module: "@apollo/client/link/persisted-queries",
        identifier: "createPersistedQueryLink",
      },
      to: { identifier: "PersistedQueryLink" },
      importType: "value",
      postProcess: callExpressionToNewExpression(),
    },
    {
      from: {
        module: "@apollo/client/link/http",
        identifier: "createHttpLink",
        alternativeModules: ["@apollo/client"],
      },
      to: { identifier: "HttpLink" },
      importType: "value",
      postProcess: callExpressionToNewExpression(),
    },
    {
      from: {
        module: "@apollo/client/link/remove-typename",
        identifier: "removeTypenameFromVariables",
      },
      to: { identifier: "RemoveTypenameFromVariablesLink" },
      importType: "value",
      postProcess: callExpressionToNewExpression(),
    },
  ] satisfies IdentifierRename[];

  let modified = false;
  for (const rename of changes) {
    handleIdentiferRename({
      rename,
      context,
      onModify: () => {
        modified = true;
      },
    });
  }
  return modified ? source.toSource() : undefined;
};
export default linkTransform;
