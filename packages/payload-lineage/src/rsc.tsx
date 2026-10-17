// Server components, loaded through Payload's import map.
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { redirect } from 'next/navigation';
import type { AdminViewServerProps, SanitizedPermissions, ServerProps } from 'payload';
import { formatAdminURL } from 'payload/shared';
import React from 'react';

// Through the client entry, so the canvases stay behind its 'use client' boundary in the build
import { ErdCanvas, LineageCanvas, LineageNavLinkClient } from './client.js';
import { buildContentGraph, type PayloadConfigLike } from './graph';
import { canOpen, lineageConfig } from './access';
import { buildSchema } from './schema';
import { schemaForViewer } from './view/erdModel';
import { adminPath, forViewer } from './view/model';

export type LineageViewProps = AdminViewServerProps;

const TABS = [
  { path: '/lineage', label: 'Lineage' },
  { path: '/lineage/schema', label: 'Data model' },
] as const;

/**
 * The admin page at `/admin/lineage`: the content graph of the running config, built on each visit
 * (a fraction of a millisecond), so it is never out of date. For users who can use the admin and
 * pass the plugin's `access`, showing only the collections and globals they can read.
 */
export async function LineageView(props: LineageViewProps) {
  const { payload, permissions, graphOptions } = await authorize(props, '/lineage');
  const graph = forViewer(
    buildContentGraph(payload.config as PayloadConfigLike, graphOptions),
    (node) => canRead(permissions, node),
  );
  return (
    <Page
      {...props}
      current="/lineage"
      title="Content lineage"
      intro="Collections, globals and blocks, and the fields that link them. Read left to right: what each is built from, then where it is used."
    >
      <LineageCanvas graph={graph} adminURLs={adminURLs(props, graph.nodes)} />
    </Page>
  );
}

/**
 * The admin page at `/admin/lineage/schema`: the data model as an ERD, a table per collection and
 * global with its fields, and a line per reference. Same access as the lineage page.
 */
export async function SchemaView(props: LineageViewProps) {
  const { payload, permissions, graphOptions } = await authorize(props, '/lineage/schema');
  const schema = schemaForViewer(
    buildSchema(payload.config as PayloadConfigLike, graphOptions),
    (entity) => canRead(permissions, entity),
  );
  return (
    <Page
      {...props}
      current="/lineage/schema"
      title="Data model"
      intro="Each collection and global with its fields, and the fields that reference other collections. Each line says how many of one the other can reference: many-to-one, many-to-many or one-to-one."
    >
      <ErdCanvas schema={schema} adminURLs={adminURLs(props, schema.entities)} />
    </Page>
  );
}

/**
 * "Lineage" in the admin's nav, for the users who can open the pages. Payload renders it on the
 * server with the nav's props, so the check runs before anything reaches the browser.
 */
export async function LineageNavLink({ payload, permissions, user }: ServerProps) {
  if (!(await canOpen(payload, permissions, user))) return null;
  return <LineageNavLinkClient />;
}

/**
 * The viewer, if they may open the pages: logged in, allowed into the admin, and passing the
 * plugin's `access`. Payload doesn't check custom views itself. Anyone else goes where Payload sends
 * them for its own pages: the login page, or the unauthorized page when logged in, then back here.
 */
async function authorize({ initPageResult }: AdminViewServerProps, path: `/${string}`) {
  const { req, permissions } = initPageResult;
  const { payload, user } = req;
  if (!(await canOpen(payload, permissions, user))) {
    const { admin, routes } = payload.config;
    const here = formatAdminURL({ adminRoute: routes.admin, path });
    const to = formatAdminURL({
      adminRoute: routes.admin,
      path: user ? admin.routes.unauthorized : admin.routes.login,
    });
    redirect(`${to}?redirect=${encodeURIComponent(here)}`);
  }
  return { payload, permissions, graphOptions: lineageConfig(payload).graphOptions };
}

function canRead(
  permissions: SanitizedPermissions,
  entity: { kind: string; slug: string },
): boolean {
  if (entity.kind === 'block') return true;
  return Boolean(
    entity.kind === 'collection'
      ? permissions.collections?.[entity.slug]?.read
      : permissions.globals?.[entity.slug]?.read,
  );
}

function adminURLs(
  { initPageResult }: AdminViewServerProps,
  entities: readonly {
    id: string;
    kind: 'collection' | 'global' | 'block';
    slug: string;
    label: string;
  }[],
) {
  const adminRoute = initPageResult.req.payload.config.routes.admin;
  return Object.fromEntries(
    entities.flatMap((e) => {
      const path = adminPath(e);
      return path ? [[e.id, formatAdminURL({ adminRoute, path })]] : [];
    }),
  );
}

/** Payload's admin layout, with the page's heading and the tabs between the two views. */
function Page({
  initPageResult,
  params,
  searchParams,
  current,
  title,
  intro,
  children,
}: AdminViewServerProps & {
  current: (typeof TABS)[number]['path'];
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  const { req, locale, permissions, visibleEntities } = initPageResult;
  const adminRoute = req.payload.config.routes.admin;
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
    >
      <Gutter className="rs-lineage-page">
        <header className="rs-lineage-page__header">
          <h1>{title}</h1>
          <p>{intro}</p>
          <nav className="rs-lineage-page__tabs" aria-label="Lineage views">
            {TABS.map((tab) => (
              <a
                key={tab.path}
                className="rs-lineage-page__tab"
                href={formatAdminURL({ adminRoute, path: tab.path })}
                aria-current={tab.path === current ? 'page' : undefined}
              >
                {tab.label}
              </a>
            ))}
          </nav>
        </header>
        {children}
      </Gutter>
    </DefaultTemplate>
  );
}
