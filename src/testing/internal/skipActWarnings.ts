export function skipActWarnings(mockCalls: any[][]) {
  return mockCalls.filter(
    (call) =>
      !call[0].startsWith(
        "Warning: An update to %s inside a test was not wrapped in act(...).\n"
      )
  );
}
