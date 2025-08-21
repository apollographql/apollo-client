import type { UtilContext } from "../types.js";

export function renameGlobalIdentifier({
  identifierName,
  newName,
  context: { j, source },
}: {
  identifierName: string;
  newName: string;
  context: UtilContext;
}) {
  // create a temporary const definition with the original "local name" of the import
  const tempDeclaration = j.variableDeclaration("const", [
    j.variableDeclarator(j.identifier(identifierName)),
  ]);
  // insert the temporary declaration in the source
  source.find(j.Program).nodes()[0].body.unshift(tempDeclaration);
  // find the inserted variable declaration from the source (required to be able to rename it)
  const tempVariable = source
    .find(j.VariableDeclaration, tempDeclaration)
    .find(j.VariableDeclarator);
  // rename the temporary variable to a temporary unique identifier
  tempVariable.renameTo(newName);
  // and remove it
  tempVariable.remove();
}
