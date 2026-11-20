export function assertMagic(
  buffer: Buffer,
  signatures: Buffer[],
  label: string
): void {
  const matches = signatures.some(
    (sig) =>
      buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig)
  );
  if (!matches) {
    throw new Error(
      `File does not look like a valid ${label} (magic bytes mismatch)`
    );
  }
}
