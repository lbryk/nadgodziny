import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  DEFAULT_CUSTOM_DAYS,
  DEFAULT_SETTINGS,
  customDaysSchema,
  settingsSchema,
  type CustomDay,
  type Settings,
} from '@nadgodziny/core';
import { z } from 'zod';

const stateSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().min(0),
  updatedAt: z.string(),
  settings: settingsSchema,
  customDays: customDaysSchema,
  admin: z
    .object({
      user: z.string(),
      passwordHash: z.string(),
      /** `env` while the password still comes from ADMIN_PASSWORD, `ui` once the admin changed it. */
      source: z.enum(['env', 'ui']),
    })
    .nullable(),
  jwtSecret: z.string().nullable(),
});

export type StoreState = z.infer<typeof stateSchema>;

export interface PublicConfig {
  settings: Settings;
  customDays: CustomDay[];
  revision: number;
  updatedAt: string;
}

function initialState(): StoreState {
  return {
    version: 1,
    revision: 0,
    updatedAt: new Date().toISOString(),
    settings: structuredClone(DEFAULT_SETTINGS),
    customDays: structuredClone(DEFAULT_CUSTOM_DAYS),
    admin: null,
    jwtSecret: null,
  };
}

/**
 * Tiny JSON-file store. The data set is a handful of kilobytes, so a document file written
 * atomically (temp file + rename) and serialised through a promise chain is enough —
 * no native modules, trivial to back up, works on any host with a writable directory.
 */
export class Store {
  private state: StoreState = initialState();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  static async open(dataDir: string): Promise<Store> {
    await mkdir(dataDir, { recursive: true });
    const store = new Store(path.join(dataDir, 'store.json'));
    await store.load();
    return store;
  }

  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.file, 'utf8');
      this.state = stateSchema.parse(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.state = initialState();
        await this.persist();
        return;
      }
      throw new Error(`Cannot read ${this.file}: ${(error as Error).message}`, { cause: error });
    }
  }

  private async persist(): Promise<void> {
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(this.state, null, 2), 'utf8');
    await rename(tmp, this.file);
  }

  get snapshot(): Readonly<StoreState> {
    return this.state;
  }

  get publicConfig(): PublicConfig {
    const { settings, customDays, revision, updatedAt } = this.state;
    return { settings, customDays, revision, updatedAt };
  }

  /** Serialised read-modify-write; `bump` increments the public revision (ETag). */
  update(
    mutator: (draft: StoreState) => void,
    options: { bump?: boolean } = {},
  ): Promise<StoreState> {
    const run = async () => {
      const draft = structuredClone(this.state);
      mutator(draft);
      if (options.bump !== false) draft.revision += 1;
      draft.updatedAt = new Date().toISOString();
      this.state = stateSchema.parse(draft);
      await this.persist();
      return this.state;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
