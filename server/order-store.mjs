import { mkdir, open, readFile, link, rename, unlink, lstat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RECORD_BYTES = 512 * 1024;

export class OrderStoreError extends Error {
  constructor() {
    super('Не удалось сохранить или прочитать заявку.');
    this.name = 'OrderStoreError';
    this.code = 'ORDER_STORAGE_UNAVAILABLE';
  }
}

function identifier(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw new OrderStoreError();
  return value.toLowerCase();
}

function recordCopy(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new OrderStoreError();
  const id = identifier(record.id);
  const copy = structuredClone(record);
  copy.id = id;
  return copy;
}

// create is an insert-if-absent operation. A persisted request is never submitted
// again, including after a process restart or an uncertain network response.
export function createMemoryOrderStore() {
  const records = new Map();
  return Object.freeze({
    async get(id) { return structuredClone(records.get(identifier(id)) ?? null); },
    async create(record) {
      const copy = recordCopy(record);
      if (records.has(copy.id)) return false;
      records.set(copy.id, copy);
      return true;
    },
    async save(record) {
      const copy = recordCopy(record);
      if (!records.has(copy.id)) throw new OrderStoreError();
      records.set(copy.id, copy);
    },
  });
}

export function createFileOrderStore({ directory } = {}) {
  if (typeof directory !== 'string' || !directory.trim()) throw new OrderStoreError();
  const root = resolve(directory);
  const pathOf = id => join(root, `${identifier(id)}.json`);

  async function get(id) {
    const path = pathOf(id);
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_RECORD_BYTES) throw new OrderStoreError();
      const record = JSON.parse(await readFile(path, 'utf8'));
      if (identifier(record?.id) !== identifier(id)) throw new OrderStoreError();
      return recordCopy(record);
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw new OrderStoreError();
    }
  }

  async function write(record, insert) {
    const copy = recordCopy(record);
    const destination = pathOf(copy.id);
    const temporary = join(root, `.${copy.id}.${randomUUID()}.tmp`);
    let handle;
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      if (!insert && !(await get(copy.id))) throw new OrderStoreError();
      const serialized = JSON.stringify(copy);
      if (Buffer.byteLength(serialized) > MAX_RECORD_BYTES) throw new OrderStoreError();
      handle = await open(temporary, 'wx', 0o600);
      await handle.writeFile(serialized, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      if (insert) {
        // A hard link publishes a complete file atomically without overwriting
        // an existing request, even if another process won the same ID.
        try { await link(temporary, destination); }
        catch (error) { if (error?.code === 'EEXIST') return false; throw error; }
      } else await rename(temporary, destination);
      return true;
    } catch {
      throw new OrderStoreError();
    } finally {
      if (handle) await handle.close().catch(() => {});
      await unlink(temporary).catch(() => {});
    }
  }

  return Object.freeze({ get, create: record => write(record, true), save: record => write(record, false) });
}
