export function captureStackTrace(callingFunction?: string | (() => {})) {
  let { stack = "" } = new Error("");

  const callerName =
    typeof callingFunction === "string"
      ? callingFunction
      : callingFunction
      ? callingFunction.name
      : undefined;

  if (callerName && stack.includes(callerName)) {
    const lines = stack.split("\n");

    stack = lines
      .slice(
        // @ts-expect-error this is too old of a TS target, but node has it
        lines.findLastIndex((line: string) => line.includes(callerName)) + 1
      )
      .join("\n");
  }

  return stack;
}

export function applyStackTrace(error: Error, stackTrace: string) {
  error.stack = error.message + "\n" + stackTrace;
  return error;
}
