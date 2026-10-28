---
'@rocksoliddigital/storybook-addon-lineage': minor
---

Merge a barrel that re-exports a single file into that file. Folders such as `ui/button/` with `button.tsx` and an `index.ts` of `export * from './button'` now show one `button` node, linked to everything that imports either file, instead of `button/button` and `button/index`. A barrel that also re-exports another file or a package stays a node, and so do barrels that only re-export each other.
