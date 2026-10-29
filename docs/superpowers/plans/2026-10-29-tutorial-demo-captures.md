# Tutorial Demo and Screenshot Capture Plan

> **For agentic workers:** Use the approved native workflow to implement each task in order.

**Goal:** Replace schematic help illustrations with repeatable desktop and mobile screenshots of Zelo screens populated only with fictitious demonstration data.

**Architecture:** Add a development-only demo route that renders representative Zelo workflows without authentication or Supabase writes. Add a Playwright capture script that visits a fixed list of demo steps at fixed desktop and mobile viewports, captures optimized JPEGs under `output/playwright/tutorial`, copies deliverable images under `public/tutorial`, and wires those assets into the existing searchable, step-by-step help center.

**Tech Stack:** React, Vite, Tailwind, existing `@playwright/test` Playwright runtime, JPEG screenshots.

**Spec:** User request on 2026-10-29 to create a demonstration environment, use fictitious data, capture desktop and mobile screens, and connect each capture to the help tutorial.

## Global Constraints

- Demo route is available only in Vite development mode.
- All demo names, dates, group labels, and records are synthetic.
- Capture uses fixed viewport sizes: desktop 1440×900 and mobile 390×844.
- Captures are JPEG at quality 78 to keep the PWA asset weight modest.
- Capture flow never submits forms or writes data to Supabase.

## Review Focus

- Production builds must not expose the demo route.
- Captures must contain no real account or member data.
- Every help step must resolve to an image for the current device mode.
- Mobile and desktop images must preserve their natural aspect ratio.
- Re-running the capture script must deterministically replace the same named assets.

### Task 1: Isolated demo screens

**Files:** Create `src/pages/TutorialDemo.tsx`; modify `src/routes/AppRoutes.tsx`.

- [ ] Add 15 named synthetic screen states covering member list/create/profile, meeting list/create/attendance, calendar/visit/event, notes list/editor/search, and account/notifications/app settings.
- [ ] Render responsive desktop and mobile app shells using the existing theme and component styles.
- [ ] Expose `/tutorial-demo/:screen` only when `import.meta.env.DEV` is true; all other environments redirect to `/`.

### Task 2: Deterministic capture pipeline

**Files:** Create `scripts/capture-tutorial-assets.mjs`.

- [ ] Launch/reuse the local Vite server and capture every demo screen at 1440×900 and 390×844.
- [ ] Write quality-78 JPEGs to `output/playwright/tutorial/{desktop,mobile}` and copy deliverable assets to `public/tutorial/{desktop,mobile}` with stable names.
- [ ] Print the number of generated files and total asset size; fail if a requested demo screen does not render.

### Task 3: Tutorial integration

**Files:** Modify `src/components/settings/HelpCenterSection.tsx`.

- [ ] Associate each step with its desktop/mobile asset key and use the current device mode to select the image.
- [ ] Replace the fabricated screenshot markup with a responsive real-image preview and descriptive alt text.
- [ ] Keep search and previous/next behavior coherent after filtering, including empty result and end-of-guide handling.

### Task 4: Verification

**Files:** Generated `public/tutorial/**/*.{jpg}`.

- [ ] Run the capture script and inspect representative desktop/mobile images.
- [ ] Run `npm run typecheck` and `npm run build`.
- [ ] Confirm the demo route is absent from a production-mode build configuration.
