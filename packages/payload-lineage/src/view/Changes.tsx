// What both pages show of the changes since the base branch: the toolbar toggle, badges, legend.

import React from 'react';

import type { Change, ChangesStatus } from '../diff';

const BADGE: Record<Change, string> = { added: 'new', changed: 'changed', deleted: 'deleted' };

export const ChangeBadge: React.FC<{ change: Change | undefined }> = ({ change }) =>
  change ? (
    <span className={`rs-change-badge rs-change-badge--${change}`}>{BADGE[change]}</span>
  ) : null;

/**
 * "Changed since origin/main": only what changed and what it affects. Disabled, with the reason,
 * when there is nothing to compare with.
 */
export const ChangedToggle: React.FC<{
  changes: ChangesStatus;
  checked: boolean;
  onChange: () => void;
  counts: Record<Change, number>;
  /** How many nodes or tables the page shows with the toggle on, to tell what's affected. */
  shown: number;
  unit: 'node' | 'table';
}> = ({ changes, checked, onChange, counts, shown, unit }) => {
  const total = counts.added + counts.changed + counts.deleted;
  const ready = changes.state === 'ready';
  const label = `Changed since ${changes.state === 'no-base' ? changes.branch : changes.base}`;
  return (
    <>
      <label
        className="rs-lineage__toggle"
        title={
          changes.state === 'no-base'
            ? `Needs git and the ${changes.branch} branch (origin/${changes.branch} or ${changes.branch}) to compare with`
            : changes.state === 'no-snapshot'
              ? `${changes.base} has no snapshot to compare with yet; it will once one is merged`
              : changes.state === 'invalid'
                ? `The snapshot on ${changes.base} isn't valid JSON: regenerate it there (start Payload, or open a page) and commit it`
                : `Only what changed since ${changes.base}, and what it affects`
        }
      >
        <input type="checkbox" checked={ready && checked} disabled={!ready} onChange={onChange} />
        {label}
        {ready && <span className="rs-lineage__count">{total}</span>}
      </label>
      {ready && checked && (
        <span className="rs-lineage__count" aria-live="polite">
          {counts.added} new, {counts.changed} changed, {counts.deleted} deleted;{' '}
          {Math.max(shown - total, 0)} affected {unit}
          {shown - total === 1 ? '' : 's'}
        </span>
      )}
      {changes.state === 'no-snapshot' && (
        <span className="rs-lineage__count">nothing on {changes.base} to compare with yet</span>
      )}
      {changes.state === 'invalid' && (
        <span className="rs-lineage__count">the snapshot on {changes.base} isn't valid JSON</span>
      )}
    </>
  );
};

export const ChangeLegend: React.FC<{ base: string }> = ({ base }) => (
  <dl className="rs-lineage__legend">
    {(Object.keys(BADGE) as Change[]).map((change) => (
      <div key={change}>
        <dt>
          <ChangeBadge change={change} />
        </dt>
        <dd>
          {change === 'deleted'
            ? `on ${base}, gone from the config`
            : change === 'added'
              ? `not on ${base}`
              : `differs from ${base}`}
        </dd>
      </div>
    ))}
  </dl>
);
