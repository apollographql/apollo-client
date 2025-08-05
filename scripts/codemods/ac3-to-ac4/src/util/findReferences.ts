import assert from "assert";

import type { namedTypes } from "ast-types";

import type { UtilContext } from "../types.js";

export function findReferences({
  context: { j },
  namespace,
  identifier,
  scope: rootScope,
}: {
  context: UtilContext;
  namespace?: string;
  identifier: string;
  scope: any;
}) {
  assert(rootScope && "bindings" in rootScope, "Expected a scope");
  const rootPath = rootScope.path;
  // code strongly inspired by https://github.com/facebook/jscodeshift/blob/656c20e2b5c9f59585c0485a0ab497ab703ec348/src/collections/VariableDeclarator.js#L76
  // original licensed MIT for Facebook, Inc. and its affiliates https://github.com/facebook/jscodeshift/blob/814683361502d1b641aeccce9462976a88246a35/LICENSE

  return j(rootPath)
    .find(j.Identifier, { name: namespace || identifier })
    .filter(function (path) {
      // ignore non-variables
      const parent = path.parent.node;

      if (
        j.MemberExpression.check(parent) &&
        parent.property === path.node &&
        !parent.computed
      ) {
        // obj.oldName
        return false;
      }

      if (
        j.Property.check(parent) &&
        parent.key === path.node &&
        !parent.computed
      ) {
        // { oldName: 3 }
        return false;
      }

      if (
        j.ObjectProperty.check(parent) &&
        parent.key === path.node &&
        !parent.computed
      ) {
        // { oldName: 3 }
        return false;
      }

      if (
        j.ObjectMethod.check(parent) &&
        parent.key === path.node &&
        !parent.computed
      ) {
        // { oldName() {} }
        return false;
      }

      if (
        j.MethodDefinition.check(parent) &&
        parent.key === path.node &&
        !parent.computed
      ) {
        // class A { oldName() {} }
        return false;
      }

      if (
        j.ClassMethod.check(parent) &&
        parent.key === path.node &&
        !parent.computed
      ) {
        // class A { oldName() {} }
        return false;
      }

      if (
        j.ClassProperty.check(parent) &&
        parent.key === path.node &&
        !parent.computed
      ) {
        // class A { oldName = 3 }
        return false;
      }

      if (
        j.JSXAttribute.check(parent) &&
        // @ts-ignore
        parent.name === path.node &&
        // @ts-ignore
        !parent.computed
      ) {
        // <Foo oldName={oldName} />
        return false;
      }

      if (
        (j.JSXOpeningElement.check(parent) ||
          j.JSXClosingElement.check(parent)) &&
        // @ts-ignore
        parent.name === path.node &&
        // @ts-ignore
        /^[a-z]/.test(path.node.name)
      ) {
        // <oldName></oldName>
        return false;
      }

      let scope = path.scope;
      while (scope && scope !== rootScope) {
        if (scope.declares(namespace || identifier)) {
          return false;
        }
        scope = scope.parent;
      }

      return true;
    })
    .map<namedTypes.Identifier>((path) => {
      if (!namespace) return path;
      const parent = path.parent;
      if (j.TSQualifiedName.check(parent.node)) {
        return parent.get("right");
      }
      if (j.MemberExpression.check(parent.node)) {
        return parent.get("property");
      }
    })
    .filter((path) => path.node.name === identifier);
}
