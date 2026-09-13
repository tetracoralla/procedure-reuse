export function checkRecord({ id, slot, path, expected, observed, passed, error }) {
  const record = { id, passed, expected, observed };
  if (slot) {
    record.slot = slot;
  }
  if (path) {
    record.path = path;
  }
  if (error) {
    record.error = error;
  }
  return record;
}
