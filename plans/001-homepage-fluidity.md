# Homepage fluidity pass

Commit: 7cd0bb3. Scope: homepage motion only (page.tsx, globals.css,
tailwind.config.js, SiteNavMenus.tsx, IntegrationTiles.tsx, CodeTabs.tsx,
new LiveEventsCard.tsx). Audit per improve-animations AUDIT.md.

## Vetted findings

| # | Sev | Category | Location | Finding | Fix |
|---|-----|----------|----------|---------|-----|
| 1 | HIGH | Cohesion/easing | tailwind.config.js, all components | No motion tokens; every transition rides Tailwind's weak built-ins | Add `ease-out-strong: cubic-bezier(0.23,1,0.32,1)` + `ease-in-out-strong: cubic-bezier(0.77,0,0.175,1)` tokens; apply to dropdowns, tiles, CTA, underline |
| 2 | MED | Easing/interrupt | SiteNavMenus.tsx panelClass | Dropdown enter/exit symmetric 150ms, weak ease-out, pure translate | Enter 200ms ease-out-strong with `origin-top scale-[0.98]→100` + translate; exit 100ms (exit faster than enter) |
| 3 | MED | Performance | CodeTabs.tsx copy button, DocsMarkdown.tsx CodeBlock | `transition-all` animates unintended properties | `transition-colors` |
| 4 | MED | Missed/interrupt | CodeTabs.tsx code swap | Tab click teleports code content | `key={lang}` remount + 150ms opacity fade-in keyframe (opacity only, kept under reduced motion) |
| 5 | MED | Accessibility | tiles hover, dropdown translate, hero | Transform motion not gated by prefers-reduced-motion (only tile entrance is) | `motion-safe:` variants on transform states; `html{scroll-behavior:smooth}` gated back to auto |
| 6 | LOW | Physicality | IntegrationTiles.tsx, PRIMARY_CTA | Tiles lack press feedback; CTA active uses default easing | `group-active:scale-[0.97]` on tile square; ease-out-strong on both |
| 7 | LOW | Polish | globals.css hover-underline-gradient | Underline retracts to the left (same origin both ways) | Directional wipe: rest origin right, hover origin left, 220ms strong curve |

## Missed opportunities (additive)

- **Hero entrance**: one-shot staggered rise (badge/h1/p/CTA/events card,
  600ms `cubic-bezier(0.23,1,0.32,1)`, 60ms steps, motion-safe only). Rare
  (first paint) so delight budget applies.
- **Live events card**: it says "Live" but never moves. Cycle fake events
  every ~3s: rows absolutely positioned, moved by `transform: translateY`
  transitions (400ms ease-in-out-strong), new row enters from above with
  opacity; interruptible by design (transitions, not keyframes); paused on
  `document.hidden` and `prefers-reduced-motion`.
- **Smooth anchor scroll**: Product dropdown + tile links jump to sections;
  `scroll-behavior: smooth` gives spatial continuity (reduced-motion: auto).

## Explicitly not done

- Scroll-reveal on feature sections: content-heavy page, restraint wins.
- Command palette open/close animation: high-frequency keyboard surface,
  correct to stay instant (it already is; entrance stays unanimated).

## Verification

- `npm run` build + tsc clean; tiles-qa.cjs, nav-qa.cjs stay green.
- Feel-check: dropdown exit visibly snappier than enter; code swap no longer
  flashes; hero rises once; events card cycles smoothly and pauses when the
  tab is hidden; everything still under reduced motion except opacity fades.
