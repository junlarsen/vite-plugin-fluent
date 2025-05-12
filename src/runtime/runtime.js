/**
 * Format a message using the given bundle and message identifier.
 *
 * This supports augmented message IDs with attributes using dot notation.
 */
export function formatMessage(bundle, id, args, error) {
  const attrIndex = id.indexOf('.');
  const isAttribute = attrIndex > -1;
  const messageId = isAttribute ? id.slice(0, attrIndex) : id;
  const message = bundle.getMessage(messageId);
  const pattern = isAttribute
    ? message.attributes[id.slice(attrIndex + 1)]
    : message.value;
  if (args === null || Array.isArray(args))
    return bundle.formatPattern(pattern, {}, args);
  return bundle.formatPattern(pattern, args, error);
}
