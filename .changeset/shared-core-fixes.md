---
'@rock-solid/storybook-addon-lineage': patch
---

Faster on large graphs: tracing a node's lineage no longer repeats work where paths converge, and building the graph's links no longer slows down for files with many imports. Now published on npmjs.com.
