import type {
  DocumentNode,
  ASTNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
} from "graphql";
import { visit } from "graphql";

import { wrap } from "optimism";

import type { FragmentMap } from "../../utilities/index.js";
import {
  cacheSizes,
  defaultCacheSizes,
  getFragmentDefinitions,
} from "../../utilities/index.js";
import { WeakCache } from "@wry/caches";

export interface FragmentRegistryAPI {
  register(...fragments: DocumentNode[]): this;
  lookup(fragmentName: string): FragmentDefinitionNode | null;
  transform<D extends DocumentNode>(document: D): D;
  resetCaches(): void;
}

// As long as createFragmentRegistry is not imported or used, the
// FragmentRegistry example implementation provided below should not be bundled
// (by tree-shaking bundlers like Rollup), because the implementation of
// InMemoryCache refers only to the TypeScript interface FragmentRegistryAPI,
// never the concrete implementation FragmentRegistry (which is deliberately not
// exported from this module).
export function createFragmentRegistry(
  ...fragments: DocumentNode[]
): FragmentRegistryAPI {
  return new FragmentRegistry(...fragments);
}

class FragmentRegistry implements FragmentRegistryAPI {
  private registry: FragmentMap = Object.create(null);

  // Call `createFragmentRegistry` instead of invoking the
  // FragmentRegistry constructor directly. This reserves the constructor for
  // future configuration of the FragmentRegistry.
  constructor(...fragments: DocumentNode[]) {
    this.resetCaches();
    if (fragments.length) {
      this.register(...fragments);
    }
  }

  public register(...fragments: DocumentNode[]): this {
    const definitions = new Map<string, FragmentDefinitionNode>();
    fragments.forEach((doc: DocumentNode) => {
      getFragmentDefinitions(doc).forEach((node) => {
        definitions.set(node.name.value, node);
      });
    });

    definitions.forEach((node, name) => {
      if (node !== this.registry[name]) {
        this.registry[name] = node;
        this.invalidate(name);
      }
    });

    return this;
  }

  // Overridden in the resetCaches method below.
  private invalidate(name: string) {}

  public resetCaches() {
    const proto = FragmentRegistry.prototype;
    this.invalidate = (this.lookup = wrap(proto.lookup.bind(this), {
      makeCacheKey: (arg) => arg,
      max:
        cacheSizes["fragmentRegistry.lookup"] ||
        defaultCacheSizes["fragmentRegistry.lookup"],
    })).dirty; // This dirty function is bound to the wrapped lookup method.
    this.transform = wrap(proto.transform.bind(this), {
      cache: WeakCache,
      max:
        cacheSizes["fragmentRegistry.transform"] ||
        defaultCacheSizes["fragmentRegistry.transform"],
    });
    this.findFragmentSpreads = wrap(proto.findFragmentSpreads.bind(this), {
      cache: WeakCache,
      max:
        cacheSizes["fragmentRegistry.findFragmentSpreads"] ||
        defaultCacheSizes["fragmentRegistry.findFragmentSpreads"],
    });
  }

  /*
   * Note:
   * This method is only memoized so it can serve as a dependency to `tranform`,
   * so calling `invalidate` will invalidate cache entries for `transform`.
   */
  public lookup(fragmentName: string): FragmentDefinitionNode | null {
    return this.registry[fragmentName] || null;
  }

  public transform<D extends DocumentNode>(document: D): D {
    const defined = new Map<string, FragmentDefinitionNode>();
    getFragmentDefinitions(document).forEach((def) => {
      defined.set(def.name.value, def);
    });

    const unbound = new Set<string>();
    const enqueue = (spreadName: string) => {
      if (!defined.has(spreadName)) {
        unbound.add(spreadName);
      }
    };

    const enqueueChildSpreads = (node: ASTNode) =>
      Object.keys(this.findFragmentSpreads(node)).forEach(enqueue);

    enqueueChildSpreads(document);

    const missing: string[] = [];
    const map: FragmentMap = Object.create(null);

    // This Set forEach loop can be extended during iteration by adding
    // additional strings to the unbound set.
    unbound.forEach((fragmentName) => {
      const knownFragmentDef = defined.get(fragmentName);
      if (knownFragmentDef) {
        enqueueChildSpreads((map[fragmentName] = knownFragmentDef));
      } else {
        missing.push(fragmentName);
        const def = this.lookup(fragmentName);
        if (def) {
          enqueueChildSpreads((map[fragmentName] = def));
        }
      }
    });

    if (missing.length) {
      const defsToAppend: FragmentDefinitionNode[] = [];
      missing.forEach((name) => {
        const def = map[name];
        if (def) {
          defsToAppend.push(def);
        }
      });

      if (defsToAppend.length) {
        document = {
          ...document,
          definitions: document.definitions.concat(defsToAppend),
        };
      }
    }

    return document;
  }

  public findFragmentSpreads(root: ASTNode): FragmentSpreadMap {
    const spreads: FragmentSpreadMap = Object.create(null);

    visit(root, {
      FragmentSpread(node) {
        spreads[node.name.value] = node;
      },
    });

    return spreads;
  }
}

interface FragmentSpreadMap {
  [fragmentSpreadName: string]: FragmentSpreadNode;
}
