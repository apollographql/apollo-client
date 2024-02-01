export function getInterfaceReference(type, item, getItem) {
  const baseType = type.replace(/\b(Partial|Omit|Promise)</g, "").split("<")[0];
  const reference = getItem(
    item.references?.find((r) => r.text === baseType)?.canonicalReference,
    false
  );
  return reference?.kind === "Interface" ? reference : null;
}
