import {
  DocumentNode,
  ASTNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  visit,
} from "graphql";

import { wrap } from "optimism";

import { FragmentMap, getFragmentDefinitions } from "../../utilities";

export class FragmentRegistry {
  private registry: FragmentMap = Object.create(null);

  static from(...fragments: DocumentNode[]): FragmentRegistry {
    const registry = new this();
    return registry.register.apply(registry, fragments);
  }

  // Call static method FragmentRegistry.from(...) instead of invoking the
  // FragmentRegistry constructor directly. This reserves the constructor for
  // future configuration of the FragmentRegistry.
  protected constructor() {
    this.resetCaches();
  }

  public register(...fragments: DocumentNode[]): this {
    const definitions = new Map<string, FragmentDefinitionNode>();
    fragments.forEach(doc => {
      getFragmentDefinitions(doc).forEach(node => {
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
    this.invalidate = (
      this.lookup = this.cacheUnaryMethod("lookup")
    ).dirty; // This dirty function is bound to the wrapped lookup method.
    this.transform = this.cacheUnaryMethod("transform");
    this.findFragmentSpreads = this.cacheUnaryMethod("findFragmentSpreads");
  }

  private cacheUnaryMethod<TName extends keyof Pick<FragmentRegistry,
    | "lookup"
    | "transform"
    | "findFragmentSpreads"
  >>(name: TName) {
    const registry = this;
    const originalMethod = FragmentRegistry.prototype[name];
    return wrap(function () {
      return originalMethod.apply(registry, arguments);
    }, {
      makeCacheKey: arg => arg,
    });
  }

  public lookup(fragmentName: string) {
    return this.registry[fragmentName] || null;
  }

  public transform<D extends DocumentNode>(document: D): D {
    const defined = new Map<string, FragmentDefinitionNode>();
    getFragmentDefinitions(document).forEach(def => {
      defined.set(def.name.value, def);
    });

    const unbound = new Set<string>();
    const enqueue = (spreadName: string) => {
      if (!defined.has(spreadName)) {
        unbound.add(spreadName);
      }
    };

    const enqueueChildSpreads = (node: ASTNode) => Object.keys(
      this.findFragmentSpreads(node)
    ).forEach(enqueue);

    enqueueChildSpreads(document);

    const missing: string[] = [];
    const map: FragmentMap = Object.create(null);

    // This Set forEach loop can be extended during iteration by adding
    // additional strings to the unbound set.
    unbound.forEach(fragmentName => {
      const knownFragmentDef = defined.get(fragmentName);
      if (knownFragmentDef) {
        enqueueChildSpreads(map[fragmentName] = knownFragmentDef);
      } else {
        missing.push(fragmentName);
        const def = this.lookup(fragmentName);
        if (def) {
          enqueueChildSpreads(map[fragmentName] = def);
        }
      }
    });

    if (missing.length) {
      const defsToAppend: FragmentDefinitionNode[] = [];
      missing.forEach(name => {
        const def = map[name];
        if (def) {
          defsToAppend.push(def);
        } else {
          // TODO Warn? Error?
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
