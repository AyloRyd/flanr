# Data import: notes for later

Problems in the imported city data that the owner wants to look at later, with what is known so far. Nothing here is decided; a decision goes into the SRS and `docs/DECISIONS.md`.

## Cities without a population whose municipality has one

Found on 2026-11-24 in the local Europe import.

- **Lindau (Bodensee)** (OSM node 240030533). The node's `wikidata` tag is `Q138686279`, an item without a population. Its municipality, the boundary relation 959426, has `Q153969` with a population. The city represents its municipality (`represents_municipality`).
- **Bad Karlshafen** (OSM node 30685220). The node has no `wikidata` tag. Its municipality, relation 1112227, has `Q506295`. The city does not represent its municipality in the data, although it has the same name.

Why: the import takes a population from the node's OSM tag and from the node's Wikidata item only. It does not fetch the Wikidata items of municipalities.

Options:

1. A fallback in the import: a city without a population that is the centre of its municipality and has the same name takes the population of the municipality's Wikidata item. This needs the municipalities' items fetched from Wikidata and a re-import. Before deciding, count how many cities in Europe would get a population this way, and check that it does not give a municipality's population to a village of the same name (see "Signs of such a point" in `docs/DECISIONS.md`, 2026-11-17, and BR-017).
2. Correct the tags in OpenStreetMap (and the item on Lindau's node, if it is wrong), as with OI-021; the next import picks the fix up. Only fixes the cities someone notices.

## Matching the owner's travel data to cities

Found on 2026-11-24. The visits of the local test user were matched to cities by name alone, so "Lindau" became Lindau am Harz instead of Lindau (Bodensee); the visit was moved by hand. A check of the user's other cities against larger namesakes found no further cases. The seed script of Phase 10 (`docs/MVP.md`) has to match by name, country and region, and report ambiguous rows instead of picking one.
