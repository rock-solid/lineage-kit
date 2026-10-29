import type { Payload } from 'payload';

import type { ChangesStatus } from './diff';
import { buildContentGraph, type PayloadConfigLike } from './graph';
import { buildSchema } from './schema';
import {
  readBaseSnapshot,
  writeSnapshot,
  type SnapshotContents,
  type SnapshotKind,
} from './snapshot';
import type { LineageCustomConfig } from './types';

/**
 * The base branch's snapshot to compare with, if the plugin's `snapshot` is on (it's off in
 * production). Also brings both of the working copy's snapshot files up to date, whichever page
 * this is: Payload's hot reload in `next dev` doesn't run `onInit` again, so a config edit would
 * otherwise wait for a restart, or leave the other page's file stale until someone opens it.
 */
export async function compare<K extends SnapshotKind>(
  payload: Payload,
  { snapshot, graphOptions }: LineageCustomConfig,
  kind: K,
): Promise<{ changes?: ChangesStatus; base?: SnapshotContents[K] }> {
  if (!snapshot) return {};
  const config = payload.config as PayloadConfigLike;
  try {
    await writeSnapshot(snapshot.dir, 'graph', buildContentGraph(config, graphOptions));
    await writeSnapshot(snapshot.dir, 'schema', buildSchema(config, graphOptions));
  } catch (err) {
    payload.logger.warn({ err, msg: `Lineage: couldn't write the snapshot in ${snapshot.dir}` });
  }
  const found = await readBaseSnapshot(snapshot, kind);
  if (found.state !== 'ready') return { changes: found };
  return { changes: { state: 'ready', base: found.base }, base: found.value };
}
