# NYCC 2026 Friday Planner

A static, GitHub Pages-friendly New York Comic Con planner focused on **Friday, October 9, 2026**.

## What is included

- Friday programming browser with search, categories, source links and **Save to My Friday**.
- Friday guest discovery, including highlighted autograph/photo guests and panelists extracted from indexed Friday programming.
- Friday activities and interests: Cosplay Central, Family HQ, Gaming Side Quest, Pride Lounge, Artist Alley/Writers Block, After Dark and more.
- Friday-relevant exhibitors/activations with show-floor booth lookup where coordinates are available.
- Personal Friday items stored locally in the browser.
- Conflict highlighting for overlapping saved items.
- Official 2026 NYCC floor-map images supplied for this project.
- Approximate indoor navigation graph with conservative North Javits / River Pavilion access handling.
- Outdoor browser GPS and Google Maps / Apple Maps handoff.
- Offline cache after the first visit.

## Deploy to GitHub Pages

Upload the **contents of this folder** to the root of your GitHub repository so `index.html` is visible at the repository root.

Then use:

**Settings → Pages → Deploy from a branch → main → / (root)**

No Node, npm, server, database or API key is required.

## Updating the app without stale cache

This build uses `?v=7` on the main assets and `nycc2026-friday-v7` in `sw.js`.

When you make a future update, bump both numbers together (for example from `v7` to `v8`). The service worker now uses **network-first** behavior for HTML/CSS/JS/data files, while map images remain cache-first, which greatly reduces the stale-cache issue from the earlier build.

## Friday data note

NYCC's schedule, guest and exhibitor directories can change and some directories are dynamically rendered. This project contains a Friday-focused indexed snapshot assembled on October 6, 2026, with source links on the cards so late changes can be checked against NYCC or participating publisher/event pages. The Exhibitors tab intentionally does not claim to mirror every card in NYCC's dynamic exhibitor directory.

## Personal data

Saved official event IDs and personal schedule items are stored in `localStorage` on the device/browser. The **Export My Friday** button creates a JSON backup that can be imported on another device.
