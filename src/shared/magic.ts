export function hasMagic(buffer: Buffer, signature: Buffer): boolean {
  return (
    buffer.length >= signature.length &&
    buffer.subarray(0, signature.length).equals(signature)
  );
}

export function assertMagic(
  buffer: Buffer,
  signatures: Buffer[],
  label: string
): void {
  if (!signatures.some((sig) => hasMagic(buffer, sig))) {
    throw new Error(
      `File does not look like a valid ${label} (magic bytes mismatch)`
    );
  }
}
