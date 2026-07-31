import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonFileStore {
  private baseDir: string;
  /** Serializes writes per file so concurrent saves land in call order. */
  private writeQueues = new Map<string, Promise<void>>();
  private tmpCounter = 0;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(path.join(this.baseDir, 'composer'), { recursive: true });
    await fs.mkdir(path.join(this.baseDir, 'certs'), { recursive: true });
  }

  private filePath(name: string): string {
    return path.join(this.baseDir, name);
  }

  async read<T>(name: string, fallback: T): Promise<T> {
    try {
      const raw = await fs.readFile(this.filePath(name), 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async write<T>(name: string, data: T): Promise<void> {
    // Settings now save as the user edits, so writes to one file can overlap.
    // Queue them per file: without this, two writers race and the loser's rename
    // fails with ENOENT because the winner already moved the temp file away.
    const previous = this.writeQueues.get(name) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.writeNow(name, data));

    this.writeQueues.set(name, next);
    try {
      await next;
    } finally {
      if (this.writeQueues.get(name) === next) this.writeQueues.delete(name);
    }
  }

  private async writeNow<T>(name: string, data: T): Promise<void> {
    // Write to a temp file then rename so a crash mid-write can't corrupt the file.
    const target = this.filePath(name);
    const tmp = `${target}.${process.pid}.${this.tmpCounter++}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    try {
      await fs.rename(tmp, target);
    } catch (error) {
      await fs.rm(tmp, { force: true });
      throw error;
    }
  }

  getPath(name: string): string {
    return this.filePath(name);
  }

  getCertsDir(): string {
    return path.join(this.baseDir, 'certs');
  }
}
