import { addResolversToSchema } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";

import type { Resolvers } from "../../core/types.js";

type ProxiedSchema = GraphQLSchema & ProxiedSchemaFns;

interface ProxiedSchemaFns {
  add: (addOptions: { resolvers: Resolvers }) => ProxiedSchema;
  fork: (forkOptions?: { resolvers?: Resolvers }) => ProxiedSchema;
  reset: () => void;
}

const proxiedSchema = (
  schemaWithMocks: GraphQLSchema,
  resolvers: Resolvers
): ProxiedSchema => {
  let targetResolvers = { ...resolvers };
  let targetSchema = addResolversToSchema({
    schema: schemaWithMocks,
    resolvers: targetResolvers,
  });

  const fns: ProxiedSchemaFns = {
    add: ({ resolvers: newResolvers }) => {
      targetResolvers = { ...targetResolvers, ...newResolvers };
      targetSchema = addResolversToSchema({
        schema: targetSchema,
        resolvers: targetResolvers,
      });

      return targetSchema as ProxiedSchema;
    },

    fork: ({ resolvers: newResolvers } = {}) => {
      return proxiedSchema(targetSchema, newResolvers ?? targetResolvers);
    },

    reset: () => {
      targetSchema = addResolversToSchema({
        schema: schemaWithMocks,
        resolvers,
      });
    },
  };

  const schema = new Proxy(targetSchema, {
    get(_target, p) {
      if (p in fns) {
        return Reflect.get(fns, p);
      }

      // An optimization that eliminates round-trips through the proxy
      // on class methods invoked via `this` on a base class instance wrapped by
      // the proxy.
      //
      // For example, consider the following class:
      //
      // class Base {
      //   foo(){
      //     this.bar()
      //   }
      //   bar(){
      //     ...
      //   }
      // }
      //
      // Calling `proxy.foo()` would call `foo` with `this` being the proxy.
      // This would result in calling `proxy.bar()` which would again invoke
      // the proxy to resolve `bar` and call that method.
      //
      // Instead, calls to `proxy.foo()` should result in a call to
      // `innerObject.foo()` with a `this` of `innerObject`, and that call
      // should directly call `innerObject.bar()`.

      const property = Reflect.get(targetSchema, p);
      if (typeof property === "function") {
        return property.bind(targetSchema);
      }
      return property;
    },
  });

  return schema as ProxiedSchema;
};

export { proxiedSchema };
