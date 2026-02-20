# Mobile UX Verification (Noona v1)

Branch: `fix/mobile-noona-v1`  
Baseline: `f1c71be`

## Environment
- Dev server started: `npm run dev -- --host 127.0.0.1 --port 4173`
- Production build: `npm run build` (passed)

## Viewports Checked
- `375x812`
- `390x844`
- `414x896`

## Checklist
- [x] No horizontal scroll at root level (`html`, `body`, `#root` guarded with `overflow-x: hidden`)
- [x] Mobile drawers open from RTL side, close on overlay, close button, and nav click
- [x] Body scroll locks while drawer is open and restores after close
- [x] Landing mobile menu links scroll to correct sections with sticky-header offset
- [x] Route changes restore top scroll (unless hash section is used)
- [x] Salon admin section navigation closes drawer and navigates cleanly
- [x] Footer is structured on mobile (brand, links, legal, contact) and stays within viewport width
- [x] Safe-area handling enabled (`viewport-fit=cover`, `env(safe-area-inset-bottom)`)

## Notes
- `npm run lint` currently fails due existing environment/config issue:
  `structuredClone is not defined` in ESLint config resolution.
