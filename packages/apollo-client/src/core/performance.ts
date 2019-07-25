// Inspired by https://github.com/facebook/react/blob/e0472709c81f53b333feafb5442319d6d25dda4b/packages/react-reconciler/src/ReactDebugFiberPerf.js
import { invariant } from 'ts-invariant';

type MarkType = string;
type MeasureType = string;

type OperationIdentifier = { operationId?: string };
type QueryIdentifier = { queryId?: string };
type MutationIdentifier = { mutationId?: string };

type Identifier = OperationIdentifier | QueryIdentifier | MutationIdentifier;

type MarkOptions = Identifier & {
  name: MarkType;
};

type MeasureOptions = Identifier & {
  name: MeasureType;
  startName: MarkType;
  endName: MarkType;
};

const pendingPerformanceEntries = new Map<string, PerformanceEntry[]>();

const isProd = false; // Always prod for now
// TODO some performance methods are not widely supported, needs more feature detection
const supportsUserTiming =
  typeof performance !== 'undefined' &&
  typeof performance.mark === 'function' &&
  typeof performance.clearMarks === 'function' &&
  typeof performance.measure === 'function' &&
  typeof performance.clearMeasures === 'function';

const shouldLogPerformance = supportsUserTiming && !isProd;

const getId = (options: Identifier) => {
  return 'operationId' in options
    ? options.operationId
    : 'queryId' in options
    ? options.queryId
    : 'mutationId' in options
    ? options.mutationId
    : undefined;
};

const apolloEmoji = 'Ⓐ'; // ish
const formattedLabel = ({ name, ...options }: MarkOptions | MeasureOptions) => {
  return `${apolloEmoji} ${name} ` + `(${getId(options)})`;
};

const startFor = (name: string) => `${name} start`;
const endFor = (name: string) => `${name} end`;

function mark(options: MarkOptions) {
  performance.mark(formattedLabel(options));
}

function measure({
  name,
  startName,
  endName,
  ...identifier
}: MeasureOptions): PerformanceEntry[] {
  const startMarkLabel = formattedLabel({
    name: startName,
    ...identifier,
  });
  const endMarkLabel = formattedLabel({
    name: endName,
    ...identifier,
  });

  const measureLabel = formattedLabel({
    name,
    ...identifier,
  });

  const startEntries = performance.getEntriesByName(startMarkLabel);
  const endEntries = performance.getEntriesByName(endMarkLabel);

  invariant(
    startEntries.length > 0,
    `No start entries found when trying to measure ${measureLabel}`,
  );
  invariant(
    startEntries.length < 2,
    `Multiple start entries found when trying to measure ${measureLabel}`,
  );
  invariant(
    endEntries.length > 0,
    `No end entries found when trying to measure ${measureLabel}`,
  );
  invariant(
    endEntries.length < 2,
    `Multiple end entries found when trying to measure ${measureLabel}`,
  );
  invariant(
    performance.getEntriesByName(measureLabel).length === 0,
    `Preexisting entries for measure ${measureLabel} when trying to measure`,
  );

  performance.measure(measureLabel, startMarkLabel, endMarkLabel);
  const measureEntries = performance.getEntriesByName(measureLabel);

  // Cleanup
  // See https://github.com/airbnb/react-with-styles/pull/214
  performance.clearMarks(startMarkLabel);
  performance.clearMarks(endMarkLabel);
  performance.clearMeasures(measureLabel);

  // Should be only one but returned as an array
  return measureEntries;
}

export function isPerformanceSupported() {
  return supportsUserTiming;
}

/**
 * Start measuring an operation/a step.
 * Returns a `done` callback than can be called without arguments instead of perfEnd(options) to end the measure.
 */
export function perfStart({ name, ...identifier }: MarkOptions) {
  if (!shouldLogPerformance) return () => {};

  const operationId = getId(identifier);

  if (!operationId) return () => {};

  mark({
    name: startFor(name),
    ...identifier,
  });

  return () => perfEnd({ name, ...identifier });
}

/**
 * End the measure for an operation/a step
 */
export function perfEnd({ name, ...identifier }: MarkOptions): void {
  if (shouldLogPerformance) return;

  const operationId = getId(identifier);
  if (!operationId) return;

  mark({
    name: endFor(name),
    ...identifier,
  });

  const performanceEntries = measure({
    name,
    startName: startFor(name),
    endName: endFor(name),
    ...identifier,
  });

  if (!pendingPerformanceEntries.has(operationId))
    pendingPerformanceEntries.set(operationId, []);

  pendingPerformanceEntries.get(operationId)!.push(...performanceEntries);
}

export function extractPerfEntriesFor(operationId: string): PerformanceEntry[] {
  const performanceEntries = pendingPerformanceEntries.get(operationId) || [];
  pendingPerformanceEntries.delete(operationId);
  return performanceEntries;
}
