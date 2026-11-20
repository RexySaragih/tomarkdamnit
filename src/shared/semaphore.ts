import { getMaxConcurrent } from "./constants.js";

export class Semaphore {
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active += 1;
      return () => this.release();
    }

    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    this.active += 1;
    return () => this.release();
  }

  private release(): void {
    this.active -= 1;
    const next = this.waiters.shift();
    if (next) next();
  }
}

let toolSemaphore: Semaphore | undefined;
let configuredMax: number | undefined;

export function getToolSemaphore(): Semaphore {
  const max = getMaxConcurrent();
  if (!toolSemaphore || configuredMax !== max) {
    toolSemaphore = new Semaphore(max);
    configuredMax = max;
  }
  return toolSemaphore;
}

/** Test helper — reset singleton between tests. */
export function resetToolSemaphore(): void {
  toolSemaphore = undefined;
  configuredMax = undefined;
}
