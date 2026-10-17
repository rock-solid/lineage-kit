import type { Payload, SanitizedPermissions, ServerProps } from 'payload';

import type { LineageCustomConfig } from './types';

/**
 * Whether a user may open the admin pages and see their nav link: logged in, allowed into the admin
 * (`permissions.canAccessAdmin`, which Payload doesn't check for custom views), and passing the
 * plugin's `access`, if it has one.
 */
export async function canOpen(
  payload: Payload,
  permissions: SanitizedPermissions | undefined,
  user: ServerProps['user'] | null,
): Promise<boolean> {
  if (!user || !permissions?.canAccessAdmin) return false;
  const { access } = lineageConfig(payload);
  return access ? Boolean(await access({ payload, user })) : true;
}

export function lineageConfig(payload: Payload): LineageCustomConfig {
  return (
    (payload.config.custom?.lineage as LineageCustomConfig | undefined) ?? { graphOptions: {} }
  );
}
