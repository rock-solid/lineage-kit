import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { releaseTarget } from './release-target.mjs';

const packages = {
  'payload-lineage': { name: '@rock-solid/payload-lineage', version: '0.1.0' },
  'storybook-addon-lineage': {
    name: '@rock-solid/storybook-addon-lineage',
    version: '0.2.0-rc.1',
    publishConfig: { registry: 'https://npm.pkg.github.com/' },
  },
  'lineage-core': { name: '@rock-solid/lineage-core', version: '0.0.0', private: true },
};
const target = (tag) => releaseTarget(tag, (folder) => packages[folder] ?? null);

describe('releaseTarget', () => {
  it('publishes to npmjs.com as latest by default', () => {
    assert.deepEqual(target('payload-lineage@0.1.0'), {
      folder: 'payload-lineage',
      name: '@rock-solid/payload-lineage',
      version: '0.1.0',
      registry: 'https://registry.npmjs.org',
      github: false,
      distTag: 'latest',
    });
  });

  it("follows the package's publishConfig registry, and tags a prerelease next", () => {
    const { registry, github, distTag } = target('storybook-addon-lineage@0.2.0-rc.1');
    assert.equal(registry, 'https://npm.pkg.github.com');
    assert.equal(github, true);
    assert.equal(distTag, 'next');
  });

  it("refuses a tag that doesn't match the package's version", () => {
    assert.match(target('payload-lineage@0.2.0').error, /at 0\.1\.0/);
  });

  it('refuses a private package, a missing one and a malformed tag', () => {
    assert.match(target('lineage-core@0.0.0').error, /private/);
    assert.match(target('nope@1.0.0').error, /No package/);
    for (const tag of ['payload-lineage', '@0.1.0', 'payload-lineage@', '../x@1.0.0']) {
      assert.match(target(tag).error, /isn't <package folder>@<version>/, tag);
    }
  });

  it('reads the real packages in the repo', async () => {
    const { releaseTarget: real } = await import('./release-target.mjs');
    const pkg = JSON.parse(
      (await import('node:fs')).readFileSync(
        new URL('../packages/payload-lineage/package.json', import.meta.url),
        'utf8',
      ),
    );
    assert.equal(real(`payload-lineage@${pkg.version}`).name, '@rock-solid/payload-lineage');
  });
});
