import { addResolversToSchema } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";

import type { Resolvers } from "../../core/types.js";

interface ProxiedSchemaFns {
  addResolvers: (newResolvers: Resolvers) => GraphQLSchema;
  forkWithResolvers: (newResolvers: Resolvers) => GraphQLSchema;
  reset: () => void;
  fork: () => GraphQLSchema;
}

const proxiedSchema = (
  schemaWithMocks: GraphQLSchema,
  resolvers: Resolvers
): GraphQLSchema & ProxiedSchemaFns => {
  let targetSchema = addResolversToSchema({
    schema: schemaWithMocks,
    resolvers,
  });

  const fns: ProxiedSchemaFns = {
    addResolvers: (newResolvers: typeof resolvers) =>
      (targetSchema = addResolversToSchema({
        schema: targetSchema,
        resolvers: {
          ...resolvers,
          ...newResolvers,
        },
      })),
    forkWithResolvers: (newResolvers: typeof resolvers) => {
      return proxiedSchema(targetSchema, newResolvers);
    },
    fork: () => {
      return proxiedSchema(targetSchema, {});
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

  return schema as GraphQLSchema & ProxiedSchemaFns;
};

export { proxiedSchema };
