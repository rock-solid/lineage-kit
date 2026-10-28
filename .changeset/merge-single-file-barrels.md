---
'@rocksoliddigital/storybook-addon-lineage': minor
---

Merge a barrel that re-exports a single file into that file. Folders such as `ui/button/` with `button.tsx` and an `index.ts` of `export * from './button'` now show one `button` node, linked to everything that imports either file, instead of `button/button` and `button/index`. A barrel over several files stays a node.
