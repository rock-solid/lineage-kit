---
'@rocksoliddigital/storybook-addon-lineage': patch
---

Faster on large graphs: tracing a node's lineage no longer repeats work where paths converge, and building the graph's links no longer slows down for files with many imports. Now published on npmjs.com as `@rocksoliddigital/storybook-addon-lineage`; 0.1.1 and earlier were `@rock-solid/storybook-addon-lineage` on GitHub Packages.
