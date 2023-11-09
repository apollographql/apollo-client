import type { MatcherFunction } from "expect";
import { WaitForRenderTimeoutError } from "../internal/index.js";
import type {
  NextRenderOptions,
  ProfiledComponent,
  ProfiledHook,
} from "../internal/index.js";

export const toHaveRendered: MatcherFunction = function (
  profiled: ProfiledComponent<any, any>
) {
  const hint = this.utils.matcherHint(
    "toHaveRendered",
    "ProfiledComponent",
    ""
  );
  const pass = profiled.currentRenderCount() > 0;

  return {
    pass,
    message() {
      return (
        hint +
        `\n\nExpected profiled component to${pass ? " not" : ""} have rendered.`
      );
    },
  };
};

export const toHaveRenderedTimes: MatcherFunction<[count: number]> = function (
  profiled: ProfiledComponent<any, any>,
  count: number
) {
  const hint = this.utils.matcherHint(
    "toHaveRenderedTimes",
    "ProfiledComponent",
    "renderCount"
  );
  const actualRenderCount = profiled.currentRenderCount();
  const pass = actualRenderCount === count;

  return {
    pass,
    message: () => {
      return (
        hint +
        `\n\nExpected profiled component to${
          pass ? " not" : ""
        } have rendered times ${this.utils.printExpected(
          count
        )}, but it rendered times ${this.utils.printReceived(
          actualRenderCount
        )}.`
      );
    },
  };
};

export const toRerender: MatcherFunction<[options?: NextRenderOptions]> =
  async function (actual, options) {
    const _profiled = actual as
      | ProfiledComponent<any, any>
      | ProfiledHook<any, any>;
    const profiled =
      "ProfiledComponent" in _profiled
        ? _profiled.ProfiledComponent
        : _profiled;
    const hint = this.utils.matcherHint("toRerender", "ProfiledComponent", "");
    let pass = true;
    try {
      await profiled.peekRender({ timeout: 100, ...options });
    } catch (e) {
      if (e instanceof WaitForRenderTimeoutError) {
        pass = false;
      } else {
        throw e;
      }
    }
    return {
      pass,
      message() {
        return (
          hint +
          ` Expected component to${pass ? " not" : ""} rerender, ` +
          `but it did${pass ? "" : " not"}.`
        );
      },
    };
  };

/** to be thrown to "break" test execution and fail it */
const failed = {};

export const toRenderExactlyTimes: MatcherFunction<
  [times: number, options?: NextRenderOptions]
> = async function (actual, times, optionsPerRender) {
  const _profiled = actual as
    | ProfiledComponent<any, any>
    | ProfiledHook<any, any>;
  const profiled =
    "ProfiledComponent" in _profiled ? _profiled.ProfiledComponent : _profiled;
  const options = { timeout: 100, ...optionsPerRender };
  const hint = this.utils.matcherHint("toRenderExactlyTimes");
  let pass = true;
  try {
    if (profiled.totalRenderCount() > times) {
      throw failed;
    }
    try {
      while (profiled.totalRenderCount() < times) {
        await profiled.waitForNextRender(options);
      }
    } catch (e) {
      // timeouts here should just fail the test, rethrow other errors
      throw e instanceof WaitForRenderTimeoutError ? failed : e;
    }
    try {
      await profiled.waitForNextRender(options);
    } catch (e) {
      // we are expecting a timeout here, so swallow that error, rethrow others
      if (!(e instanceof WaitForRenderTimeoutError)) {
        throw e;
      }
    }
  } catch (e) {
    if (e === failed) {
      pass = false;
    } else {
      throw e;
    }
  }
  return {
    pass,
    message() {
      return (
        hint +
        ` Expected component to${pass ? " not" : ""} render exactly ${times}.` +
        ` It rendered ${profiled.totalRenderCount()} times.`
      );
    },
  };
};
