import type { Payload, SanitizedPermissions, TypedUser } from 'payload';
import { describe, expect, it, vi } from 'vitest';

import { canOpen } from './access';
import type { LineageAccess } from './types';

const payloadWith = (access?: LineageAccess) =>
  ({ config: { custom: { lineage: { graphOptions: {}, access } } } }) as unknown as Payload;
const admin = { canAccessAdmin: true } as SanitizedPermissions;
const noAdmin = { canAccessAdmin: false } as SanitizedPermissions;
const user = { id: 1, role: 'editor' } as unknown as TypedUser;

describe('canOpen', () => {
  it('lets in a logged-in user who can use the admin', async () => {
    expect(await canOpen(payloadWith(), admin, user)).toBe(true);
  });

  it('keeps out a logged-out visitor and a user the admin keeps out', async () => {
    expect(await canOpen(payloadWith(), admin, null)).toBe(false);
    expect(await canOpen(payloadWith(), noAdmin, user)).toBe(false);
    expect(await canOpen(payloadWith(), undefined, user)).toBe(false);
  });

  it('applies the plugin’s access on top, sync or async, with the payload and user', async () => {
    const editorsOnly = vi.fn(({ user }) => (user as { role: string }).role === 'editor');
    const payload = payloadWith(editorsOnly);
    expect(await canOpen(payload, admin, user)).toBe(true);
    expect(editorsOnly).toHaveBeenCalledWith({ payload, user });
    expect(
      await canOpen(
        payloadWith(async () => false),
        admin,
        user,
      ),
    ).toBe(false);
  });

  it('never calls access for a user the admin already keeps out', async () => {
    const access = vi.fn(() => true);
    expect(await canOpen(payloadWith(access), noAdmin, user)).toBe(false);
    expect(access).not.toHaveBeenCalled();
  });

  it('works without the plugin’s config, e.g. a page registered by hand', async () => {
    const bare = { config: {} } as unknown as Payload;
    expect(await canOpen(bare, admin, user)).toBe(true);
  });
});
