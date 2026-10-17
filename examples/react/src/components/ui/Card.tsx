import type { ReactNode } from 'react';

/** A bordered box with a heading. */
export const Card = ({ title, children }: { title: string; children: ReactNode }) => (
  <article style={{ border: '1px solid #64748b', padding: 16 }}>
    <h3>{title}</h3>
    {children}
  </article>
);
