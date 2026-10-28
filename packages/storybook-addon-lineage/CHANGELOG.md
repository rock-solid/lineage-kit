# @rocksoliddigital/storybook-addon-lineage

## 0.4.0

### 🚀 Features

- **storybook-addon-lineage:** Group the graph by layer, as dbt groups sources, staging and marts: each layer is a band of columns under its name, ordered so most imports run left to right (utilities, then primitives, components, pages), whatever order the layers are listed in. A layer's new `column` option pins its place. **Group by layer** in the panel switches back to the free layout. ([#33](https://github.com/rock-solid/lineage-kit/pull/33)) ([c052f6a](https://github.com/rock-solid/lineage-kit/commit/c052f6aee2b72d01096a3da85b16eff0fd595b88))
- **storybook-addon-lineage:** Merge a barrel that re-exports a single file into that file. Folders such as `ui/button/` with `button.tsx` and an `index.ts` of `export * from './button'` now show one `button` node, linked to everything that imports either file, instead of `button/button` and `button/index`. A barrel that also re-exports another file or a package stays a node, and so do barrels that only re-export each other. ([#32](https://github.com/rock-solid/lineage-kit/pull/32)) ([d08a45a](https://github.com/rock-solid/lineage-kit/commit/d08a45aa5b2a647876bfa071d02738f423d77baf))

### 🤝 Contributors

- Adrian Cando (@godhand1607)

## 0.3.0

### Minor Changes

- [#23](https://github.com/rock-solid/lineage-kit/pull/23) [`cf28097`](https://github.com/rock-solid/lineage-kit/commit/cf28097f348d19839131e089f1e5b6a1c934c3da) Thanks [@godhand1607](https://github.com/godhand1607)! - Copy a view as a Mermaid diagram, for pasting into a PR, a doc or a ticket. The Storybook graph and the Payload Lineage page copy a flowchart of what they show; the Data model page copies an `erDiagram` in crow's-foot notation. The Payload plugin also exports `contentGraphToMermaid` and `schemaToMermaid` for scripts.

## 0.2.0

### Patch Changes

- [#15](https://github.com/rock-solid/lineage-kit/pull/15) [`98417db`](https://github.com/rock-solid/lineage-kit/commit/98417db9077aaa48cd1e600f7fc0caddf0ee157d) Thanks [@godhand1607](https://github.com/godhand1607)! - Faster on large graphs: tracing a node's lineage no longer repeats work where paths converge, and building the graph's links no longer slows down for files with many imports. Now published on npmjs.com as `@rocksoliddigital/storybook-addon-lineage`; 0.1.1 and earlier were `@rock-solid/storybook-addon-lineage` on GitHub Packages.
