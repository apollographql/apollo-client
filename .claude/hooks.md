# React Hooks

React Hooks can be found in the `src/react/hooks` directory.
This folder contains React Hooks and their associated types, as well as documentation for each hook in DocBlocks, always colocated in one file per hook.

## Hooks Type Structure

Types for the React Hooks are held in the same file as the hook itself. They follow this structure:
In this example, single-line comments (with `//`) are used to annotate and explain the example
while DocBlocks (with `/** ... */`) are part of the actual structure that is present in the files.

```ts
// A namespace with the hook's name that contains all types related to the hook
export declare namespace useMyHook {
  // an `Options` interface
  export interface Options {
    // ...
  }

  // a `Result` interface
  export interface Result {
    // ...
  }

  // A namespace for documentation types, which are simplified versions of the hook's types.
  // This is necessary because we can only reference interfaces and function signatures in the Documentation, not complex types.
  export namespace DocumentationTypes {
    // The `DocumentationTypes` namespace always contains a simplified version of the hook for documentation purposes.

    // The function signature for documentation, which inherits documentation from the first signature of the actual hook
    /** {@inheritDoc @apollo/client!useMyHook:function(1)} */
    export function useMyHook(options: useMyHook.Options): useMyHook.Result;
  }
}

// All overload signatures for the hook

// The first hook signature contains the documentation
/**
 * Documentation for the hook.
 */
function useMyHook(
  options: useMyHook.Options & SomeSpecifyingType
): useMyHook.Result & SomeRestrictingType;

// The second and all subsequent signatures don't contain the full documentation, but only a DocBlock with a `@inheritDoc` tag.
/** {@inheritDoc @apollo/client!useMyHook:function(1)} */
function useMyHook(
  options: useMyHook.Options & SomeOtherSpecifyingType
): useMyHook.Result & SomeOtherRestrictingType;

// The hook implementation at the bottom. This one doesn't have a DocBlock.
export function useMyHook(options: useMyHook.Options): useMyHook.Result {
  // Implementation here
}
```

If the `Options`, `Result` or any other documented type is not an interface, but a more complex type,
common properties are extracted into a `useMyHook.Base` namespace.
Then, another interface with a simplified version of the non-common properties is created in the `DocumentationTypes`
namespace, in a sub-namespace that shares the hook name.
Both the "real" type in the `useMyHook` namespace and the simplified interface version in the `DocumentationTypes.useMyHook`
namespace inherit from the common properties interface in the `useMyHook.Base` namespace.

If the `Options` type would be more complicated, e.g.

```ts
export namespace useMyHook {
  export type Options<T> = {
    commonProperty: string;
  } & (T extends SomeType ? { someProperty: string }
  : { someProperty?: never });
}
```

the result would look like this:

```ts
export namespace useMyHook {
  export namespace Base {
    export interface Options<T> {
      commonProperty: string;
    }
  }

  export type Options<T> = useMyHook.Base.Options<T> & SomeComplexType<T>;

  export namespace DocumentationTypes {
    namespace useMyHook {
      export interface Options<T> extends Base.Options<T> {
        someProperty?: string;
      }
    }
  }

  // the rest of the structure continues as before
  export interface Result {
    // ...
  }
}
```

When types are simple interfaces, the nested namespace structure may not be necessary, and the types can be referenced directly in the function signature by `useMyHook.InterfaceName`. However, when dealing with complex types, the nested namespace pattern as shown above is commonly used.

Note that if this is necessary for multiple types, the nested namespace definition
should not be merged in one place, but just repeated for each type.
So it could look like this in the end:

```ts
export namespace useMyHook {
  export namespace Base {
    export interface Options<T> {
      // ...
    }
  }

  export type Options<T> = useMyHook.Base.Options<T> & SomeComplexType<T>;

  export namespace DocumentationTypes {
    namespace useMyHook {
      export interface Options<T> extends Base.Options<T> {
        // ...
      }
    }
  }

  export namespace Base {
    export interface Result<T> {
      // ...
    }
  }

  export type Result<T> = useMyHook.Base.Result<T> & SomeOtherComplexType<T>;

  export namespace DocumentationTypes {
    namespace useMyHook {
      export interface Result<T> extends Base.Result<T> {
        // ...
      }
    }
  }

  // other types

  export namespace DocumentationTypes {
    export function useMyHook(options: useMyHook.Options): useMyHook.Result;
  }
}
```

## Additional Implementation Details

Some hooks may have more complex implementations with multiple function overloads that use specific type constraints. For example, a hook might have several overloads with different combinations of options that affect the resulting types. These overloads allow TypeScript to narrow the return type based on the specific options passed. The number and complexity of these overloads varies by hook based on its specific requirements.

## Internal Function Implementation Pattern

Some hooks use a pattern where the exported function is a wrapper around an internal implementation function. For example:

```ts
export function useMyHook(...args) {
  return wrapHook(
    "useMyHook",
    useMyHook_ // Internal implementation function
    // ... other setup
  )(...args);
}

function useMyHook_(...args) {
  // Actual implementation
}
```

This pattern allows for hook implementations to be overwritten by the `ApolloClient` instance of the `ApolloProvider`, which allows for custom behaviour e.g. during SSR.
Every hook using this pattern needs to be added to the `WrappableHooks` interface in `src/react/hooks/internal/wrapHook.ts`.

## Simple Hooks

Not all hooks follow the complex namespace pattern. Simple hooks that take minimal parameters and return straightforward values (like `useApolloClient` or `useReactiveVar`) are implemented as plain functions without namespaces or complex type structures. This is appropriate when:

- The hook has no or minimal configuration options
- The return type is simple and can be described as a single interface or primitive type
- There's no need for documentation type simplification

## Additional Type Patterns

### Self-import Pattern

In some cases, a self-import pattern is allowed to access the outer `useMyHook` namespace within the `DocumentationTypes.useMyHook` namespace. This might be necessary to avoid shadowing of the `useMyHook` identifier.

```ts
export declare namespace useMyHook {
  import _self = useMyHook;

  // Now can use _self.Options instead of useMyHook.Options
}
```

### Conditional Parameters

Hooks may use conditional types in their parameters to make options required or optional based on generic types:

```ts
export function useMyHook<TVariables>(
  query: DocumentNode,
  ...[options]: {} extends TVariables ?
    [options?: useMyHook.Options<TVariables>]
  : [options: useMyHook.Options<TVariables>]
): useMyHook.Result;
```

### Result Tuples

Some hooks (like `useLazyQuery` and `useMutation`) return tuples instead of single objects:

```ts
export declare namespace useMyHook {
  export type Result<TData, TVariables> = [
    executeFunction: (options?: Options) => Promise<TData>,
    result: QueryResult<TData, TVariables>,
  ];
}
```

### "use no memo" Directive

Some hook implementations include a `"use no memo";` directive at the beginning of the function body to indicate React Compiler optimization hints.

### Utility Documentation Types

When hooks need to extend or compose with common utility types in their documentation interfaces, they import and use `UtilityDocumentationTypes` from the utilities package:

```ts
import type {
  DocumentationTypes as UtilityDocumentationTypes,
  // ... other imports
} from "@apollo/client/utilities/internal";

export namespace useMyHook {
  // ... types ...

  export namespace DocumentationTypes {
    namespace useMyHook {
      export interface Options<TVariables>
        extends Base.Options<TVariables>,
          UtilityDocumentationTypes.VariableOptions<TVariables> {}

      export interface Result<TData, TVariables>
        extends Base.Result<TData, TVariables>,
          UtilityDocumentationTypes.DataState<TData> {}
    }
  }
}
```

Common utility documentation types include:

- `VariableOptions<TVariables>` - For GraphQL variables options
- `DataState<TData>` - For data state properties in query results
- `ApolloQueryResult<TData>` - For complete query result types including loading, error, and data states
