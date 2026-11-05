import type { AtomCommandResult } from "@t3tools/client-runtime/state/runtime";

export interface FileSaveCoordinatorOptions<A, E> {
  readonly debounceMs: number;
  readonly canPersist?: () => boolean;
  readonly persist: (contents: string) => Promise<AtomCommandResult<A, E>>;
  readonly onPendingChange: (pending: boolean) => void;
  /** Return false when another editor has newer unsaved contents. */
  // Fork: `value` carries the persist result (the new file version).
  readonly onConfirmed: (contents: string, value: A) => boolean | void;
  /** Fork: lets the owner pause autosave after a failed persist, such as a version conflict. */
  readonly onFailed?: (result: Extract<AtomCommandResult<A, E>, { readonly _tag: "Failure" }>) => {
    readonly pause: boolean;
  };
  /** Called when a write pass ends with nothing further scheduled. */
  readonly onSettled?: () => void;
}

export class FileSaveCoordinator<A = unknown, E = unknown> {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private latestContents = "";
  private latestRevision = 0;
  private confirmedRevision = 0;
  private lastChangeAt = 0;
  private saving = false;
  private disposed = false;
  private paused = false;
  private flushing = false;

  constructor(private readonly options: FileSaveCoordinatorOptions<A, E>) {}

  change(contents: string): void {
    if (this.disposed) return;
    this.latestContents = contents;
    this.latestRevision += 1;
    this.lastChangeAt = Date.now();
    this.options.onPendingChange(true);
    if (!this.paused) this.schedule(this.options.debounceMs);
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.latestRevision > 0) this.schedule(0);
  }

  reset(): void {
    this.clearTimer();
    this.latestRevision = 0;
    this.confirmedRevision = 0;
    this.paused = false;
    this.options.onPendingChange(false);
  }

  /** The newest contents not yet written, which is the last write this coordinator will make. */
  get unconfirmedContents(): string | null {
    return this.latestRevision === this.confirmedRevision ? null : this.latestContents;
  }

  /** Writes the newest draft now instead of after the debounce, then any draft queued behind it. */
  flush(): void {
    this.clearTimer();
    this.flushing = true;
    void this.persistLatest();
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
    if (this.latestRevision > 0) void this.persistLatest();
  }

  private schedule(delay: number): void {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.persistLatest();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  private async persistLatest(): Promise<void> {
    if (this.saving) return;
    if (
      this.paused ||
      this.latestRevision === this.confirmedRevision ||
      this.options.canPersist?.() === false
    ) {
      this.settle();
      return;
    }

    this.saving = true;
    const contents = this.latestContents;
    const revision = this.latestRevision;
    const result = await this.options.persist(contents);
    let confirmed = false;
    if (result._tag === "Success") {
      this.confirmedRevision = revision;
      // Fork: surface the persist result value (e.g. the new file version).
      confirmed = this.options.onConfirmed(contents, result.value) !== false;
    } else if (result._tag === "Failure") {
      // Fork: let the owner pause autosave after a failed persist.
      this.paused = this.options.onFailed?.(result).pause ?? false;
    }

    this.saving = false;
    if (revision === this.latestRevision || this.paused) {
      if (confirmed) this.options.onPendingChange(false);
      this.settle();
      return;
    }

    const remainingDebounce = Math.max(
      0,
      this.options.debounceMs - (Date.now() - this.lastChangeAt),
    );
    if (this.disposed || this.flushing) {
      void this.persistLatest();
    } else {
      this.schedule(remainingDebounce);
    }
  }

  private settle(): void {
    this.flushing = false;
    this.options.onSettled?.();
  }
}
