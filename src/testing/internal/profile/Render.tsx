/* istanbul ignore file */

/*
Something in this file does not compile correctly while measuring code coverage
and will lead to a
  Uncaught [ReferenceError: cov_1zb8w312au is not defined]
if we do not ignore this file in code coverage.

As we only use this file in our internal tests, we can safely ignore it.
*/

import { within, screen } from "@testing-library/dom";
import { JSDOM, VirtualConsole } from "jsdom";
import { applyStackTrace, captureStackTrace } from "./traces.js";

/** @internal */
export interface BaseRender {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  /**
   * The number of renders that have happened so far (including this render).
   */
  count: number;
}

type Screen = typeof screen;
/** @internal */
export type SyncScreen = {
  [K in keyof Screen]: K extends `find${string}` ?
    {
      /** @deprecated A snapshot is static, so avoid async queries! */
      (...args: Parameters<Screen[K]>): ReturnType<Screen[K]>;
    }
  : Screen[K];
};

/** @internal */
export interface Render<Snapshot> extends BaseRender {
  /**
   * The snapshot, as returned by the `takeSnapshot` option of `profile`.
   * (If using `profileHook`, this is the return value of the hook.)
   */
  snapshot: Snapshot;
  /**
   * A DOM snapshot of the rendered component, if the `snapshotDOM`
   * option of `profile` was enabled.
   */
  readonly domSnapshot: HTMLElement;
  /**
   * Returns a callback to receive a `screen` instance that is scoped to the
   * DOM snapshot of this `Render` instance.
   * Note: this is used as a callback to prevent linter errors.
   * @example
   * ```diff
   * const { withinDOM } = RenderedComponent.takeRender();
   * -expect(screen.getByText("foo")).toBeInTheDocument();
   * +expect(withinDOM().getByText("foo")).toBeInTheDocument();
   * ```
   */
  withinDOM: () => SyncScreen;

  renderedComponents: Array<string | React.ComponentType>;
}

/** @internal */
export class RenderInstance<Snapshot> implements Render<Snapshot> {
  id: string;
  phase: "mount" | "update" | "nested-update";
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  count: number;

  constructor(
    baseRender: BaseRender,
    public snapshot: Snapshot,
    private stringifiedDOM: string | undefined,
    public renderedComponents: Array<string | React.ComponentType>
  ) {
    this.id = baseRender.id;
    this.phase = baseRender.phase;
    this.actualDuration = baseRender.actualDuration;
    this.baseDuration = baseRender.baseDuration;
    this.startTime = baseRender.startTime;
    this.commitTime = baseRender.commitTime;
    this.count = baseRender.count;
  }

  private _domSnapshot: HTMLElement | undefined;
  get domSnapshot() {
    if (this._domSnapshot) return this._domSnapshot;
    if (!this.stringifiedDOM) {
      throw new Error(
        "DOM snapshot is not available - please set the `snapshotDOM` option"
      );
    }

    const virtualConsole = new VirtualConsole();
    const stackTrace = captureStackTrace("RenderInstance.get");
    virtualConsole.on("jsdomError", (error) => {
      throw applyStackTrace(error, stackTrace);
    });

    const snapDOM = new JSDOM(this.stringifiedDOM, {
      runScripts: "dangerously",
      virtualConsole,
    });
    const document = snapDOM.window.document;
    const body = document.body;
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.text = `
        ${errorOnDomInteraction.toString()};
        ${errorOnDomInteraction.name}();
      `;
    body.appendChild(script);
    body.removeChild(script);

    return (this._domSnapshot = body);
  }

  get withinDOM(): () => SyncScreen {
    const snapScreen = Object.assign(within(this.domSnapshot), {
      debug: (
        ...[dom = this.domSnapshot, ...rest]: Parameters<typeof screen.debug>
      ) => screen.debug(dom, ...rest),
      logTestingPlaygroundURL: (
        ...[dom = this.domSnapshot, ...rest]: Parameters<
          typeof screen.logTestingPlaygroundURL
        >
      ) => screen.logTestingPlaygroundURL(dom, ...rest),
    });
    return () => snapScreen;
  }
}
/** @internal */
export function errorOnDomInteraction() {
  const events: Array<keyof DocumentEventMap> = [
    "auxclick",
    "blur",
    "change",
    "click",
    "copy",
    "cut",
    "dblclick",
    "drag",
    "dragend",
    "dragenter",
    "dragleave",
    "dragover",
    "dragstart",
    "drop",
    "focus",
    "focusin",
    "focusout",
    "input",
    "keydown",
    "keypress",
    "keyup",
    "mousedown",
    "mouseenter",
    "mouseleave",
    "mousemove",
    "mouseout",
    "mouseover",
    "mouseup",
    "paste",
    "pointercancel",
    "pointerdown",
    "pointerenter",
    "pointerleave",
    "pointermove",
    "pointerout",
    "pointerover",
    "pointerup",
    "scroll",
    "select",
    "selectionchange",
    "selectstart",
    "submit",
    "toggle",
    "touchcancel",
    "touchend",
    "touchmove",
    "touchstart",
    "wheel",
  ];
  function warnOnDomInteraction() {
    throw new Error(`
    DOM interaction with a snapshot detected in test.
    Please don't interact with the DOM you get from \`withinDOM\`,
    but still use \`screen\' to get elements for simulating user interaction.
    `);
  }
  events.forEach((event) => {
    document.addEventListener(event, warnOnDomInteraction);
  });
}
