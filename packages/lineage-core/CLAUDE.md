# @rocksoliddigital/lineage-core

What the Storybook addon and the Payload plugin share: walking a graph's links (`src/traverse.ts`),
laying it out with ELK (`src/layout.ts`) and the React hook that runs the layout (`src/react.ts`).

- Private and never published: `package.json` exports the TypeScript source, and both packages
  list it as a devDependency, so tsup bundles it into their `dist`. Nothing here needs a build.
- Every change ships inside both published packages, so check both: `pnpm check` runs their tests,
  including the Storybook viewer's browser tests.
- Keep its types out of the published packages' public types: their `.d.ts` can't import a package
  that isn't published.
- Keep functions pure and tested here (`src/*.test.ts`); hover tracing and layout run on every
  interaction, so watch the cost on large graphs (there are tests with 100,000 links).
