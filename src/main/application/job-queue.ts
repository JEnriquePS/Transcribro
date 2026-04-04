/**
 * Sequential job queue — replaces Python's asyncio.Queue with a single worker.
 *
 * Node.js is single-threaded, so a simple array + processing lock is enough
 * to guarantee jobs are processed one at a time without races.
 */
export class JobQueue {
  private readonly queue: string[] = []
  private processing = false

  constructor(
    private readonly processJob: (jobId: string) => Promise<void>,
  ) {}

  enqueue(jobId: string): void {
    this.queue.push(jobId)
    void this.processNext()
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return
    this.processing = true

    const jobId = this.queue.shift()!
    try {
      await this.processJob(jobId)
    } catch {
      // ProcessJobUseCase marks the job as FAILED and logs the error.
      // Nothing to do here.
    } finally {
      this.processing = false
      void this.processNext()
    }
  }
}
