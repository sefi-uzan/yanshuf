import fs from 'node:fs/promises';
import path from 'node:path';

export class JsonFileStore {
  private baseDir: string;

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
    await fs.writeFile(this.filePath(name), JSON.stringify(data, null, 2), 'utf8');
  }

  getPath(name: string): string {
    return this.filePath(name);
  }

  getCertsDir(): string {
    return path.join(this.baseDir, 'certs');
  }
}
