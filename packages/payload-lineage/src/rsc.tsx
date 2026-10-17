// Server components, loaded through Payload's import map.
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps } from 'payload';
import { formatAdminURL } from 'payload/shared';
import React from 'react';

// Through the client entry, so the canvas stays behind its 'use client' boundary in the build
import { LineageCanvas } from './client.js';
import { buildContentGraph, type PayloadConfigLike } from './graph';
import type { ContentGraphOptions } from './types';
import { adminPath, forViewer } from './view/model';

export type LineageViewProps = AdminViewServerProps & {
  /** Passed by the plugin as `serverProps`. */
  graphOptions?: ContentGraphOptions;
};

/**
 * The admin page at `/admin/lineage`: the content graph of the running config, built on each visit
 * (a fraction of a millisecond), so it is never out of date. Logged-in users only, and only the
 * collections and globals they can read.
 */
export function LineageView({
  initPageResult,
  params,
  searchParams,
  graphOptions,
}: LineageViewProps) {
  const { req, locale, permissions, visibleEntities } = initPageResult;
  const { payload, user } = req;
  const adminRoute = payload.config.routes.admin;

  if (!user) {
    const here = formatAdminURL({ adminRoute, path: '/lineage' });
    redirect(
      `${formatAdminURL({ adminRoute, path: '/login' })}?redirect=${encodeURIComponent(here)}`,
    );
  }

  const graph = forViewer(
    buildContentGraph(payload.config as PayloadConfigLike, graphOptions),
    (node) =>
      Boolean(
        node.kind === 'collection'
          ? permissions.collections?.[node.slug]?.read
          : permissions.globals?.[node.slug]?.read,
      ),
  );
  const adminURLs = Object.fromEntries(
    graph.nodes.flatMap((n) => {
      const path = adminPath(n);
      return path ? [[n.id, formatAdminURL({ adminRoute, path })]] : [];
    }),
  );

  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter className="rs-lineage-page">
        <header className="rs-lineage-page__header">
          <h1>Content lineage</h1>
          <p>
            Collections, globals and blocks, and the fields that link them. Read left to right: what
            each is built from, then where it is used.
          </p>
        </header>
        <LineageCanvas graph={graph} adminURLs={adminURLs} />
      </Gutter>
    </DefaultTemplate>
  );
}
