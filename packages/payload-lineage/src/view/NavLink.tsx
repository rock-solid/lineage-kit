import { Link, useConfig } from '@payloadcms/ui';
import { usePathname } from 'next/navigation';
import { formatAdminURL } from 'payload/shared';
import React from 'react';

/** "Lineage" in the admin's nav, after the collections and globals, marked like theirs on either lineage page. */
export const LineageNavLink: React.FC = () => {
  const { config } = useConfig();
  const pathname = usePathname();
  const href = formatAdminURL({ adminRoute: config.routes.admin, path: '/lineage' });
  const active = pathname === href || pathname.startsWith(`${href}/`);
  const label = (
    <>
      {active && <div className="nav__link-indicator" />}
      <span className="nav__link-label">Lineage</span>
    </>
  );
  // Payload's own nav classes, so the link looks like the ones above it
  return pathname === href ? (
    <div className="nav__link" id="nav-lineage">
      {label}
    </div>
  ) : (
    <Link className="nav__link" href={href} id="nav-lineage" prefetch={false}>
      {label}
    </Link>
  );
};
