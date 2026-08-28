# Knowledge Note Bridge — visual thesis

## Direction: glacial minimal ceramics

Knowledge Note Bridge protects something slow-built and fragile: review history. Its
visual world treats a collection like hand-thrown porcelain held in cold, clear light.
Soft mineral surfaces communicate care; hairline strata and registration marks explain
identity, movement, and preservation. The site avoids the usual terminal-neon CLI
language. It should feel quiet enough for inspection and exact enough for a migration.

## Palette

The default is a deliberately single-mode, pale studio treatment. A second theme would
weaken the ceramics thesis, so the page always paints its own background.

| Token | Value | Use |
| --- | --- | --- |
| `ice` | `#F4F7F5` | page background, like diffuse glacial light |
| `porcelain` | `#FFFEFA` | raised surfaces |
| `slate` | `#172B2F` | primary text |
| `fjord` | `#36565C` | secondary text |
| `cobalt` | `#155E75` | actions and identity marks |
| `cobalt-deep` | `#0B4658` | action hover and links |
| `moss` | `#2D6A56` | preserved history / success |
| `ochre` | `#8B5A13` | attention / renamed card |
| `oxide` | `#9B3D35` | archive / error |
| `hairline` | `#CAD7D5` | boundaries and rules |

All body/link combinations meet WCAG AA (4.5:1); state always has an icon or label in
addition to colour. Shadows use cool translucent slate rather than neutral black.

## Type

- Interface and prose: the system humanist sans stack to keep the package font-free,
  private, and fast.
- Commands, card IDs, counts: `ui-monospace`, used as the technical registration stamp.
- Scale: 14 / 16 / 19 / 24 / 40 / 64 px. Body is never below 16 px. Headings are
  slightly tightened; prose stays between 52 and 72 characters.

## Space and shape

An 8 px base rhythm with 4 px only for optical adjustments. Primary sections use
64–112 px vertical breathing room. Surfaces use asymmetrical `28px 28px 34px 30px`
radii—the small imperfection of hand-thrown ware. Rules are 1 px; interactive outlines
are 3 px. Buttons and controls are at least 44 px high.

## Interaction grammar

- A stable card ID is shown as a cobalt maker's stamp.
- Diffs read as horizontal strata: kept, updated, renamed, then archived.
- The demo is a real local parser/diff in the browser, never a fake terminal recording.
- Destructive rows use explicit `Archive` wording and appear only after compare.
- Focus is a high-contrast cobalt ring with an ice gap. Buttons compress by 1 px on
  press, like weight meeting clay.

## Motion

Interface transitions last 160–240 ms and animate only opacity and transform. The hero
layers settle once on entry; diff rows appear from their source column. Nothing loops.
With `prefers-reduced-motion: reduce`, movement and smooth scrolling are removed and all
content appears immediately.

## Original asset plan and provenance

`site/public/bridge-ceramic.webp` is an original wide still generated for this product:
three translucent porcelain index tiles crossing a blue glacial fissure, with one thin
cobalt registration line continuing intact across every tile. The image contains no
text, brands, people, or UI. It explains the product promise: the content can change
while identity remains unbroken. It is generated with the factory `factory-image`
deployment through `/opt/fleet/lib/gen-image.sh`, then locally converted to WebP. The
source prompt and deployment metadata live beside the source PNG during production;
only the optimized WebP ships. Generated for Sociobot/Param Factory on 2026-08-28;
project asset under the repository MIT license.

Prompt: “Wide editorial still life for a software documentation hero. On a pale icy
studio plane, three thin hand-made porcelain index tiles form a careful bridge over a
narrow translucent glacial fissure. A single fine cobalt registration line and small
maker's marks continue perfectly across all three tiles, suggesting stable identity and
preserved history. Cool diffuse northern daylight, subtle ceramic grain, frost haze,
quiet museum-catalogue composition, ample negative space on the left, objects weighted
to the right. Palette of porcelain white, pale blue-grey, deep fjord slate, restrained
cobalt. Photoreal tactile materials with a slightly surreal architectural scale. No
words, letters, logos, screens, devices, people, gradients, or watermark.”

