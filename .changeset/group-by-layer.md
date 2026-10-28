---
'@rocksoliddigital/storybook-addon-lineage': minor
---

Group the graph by layer, as dbt groups sources, staging and marts: each layer is a band of columns under its name, ordered so most imports run left to right (utilities, then primitives, components, pages), whatever order the layers are listed in. A layer's new `column` option pins its place. **Group by layer** in the panel switches back to the free layout.
