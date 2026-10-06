# NYCC 2026 Friday Planner

https://jcsegovia1.github.io/NYCC-Planner-and-Map/

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

## Friday data note

NYCC's schedule, guest and exhibitor directories can change and some directories are dynamically rendered. This project contains a Friday-focused indexed snapshot assembled on October 6, 2026, with source links on the cards so late changes can be checked against NYCC or participating publisher/event pages. The Exhibitors tab intentionally does not claim to mirror every card in NYCC's dynamic exhibitor directory.

## Personal data

Saved official event IDs and personal schedule items are stored in `localStorage` on the device/browser. The **Export My Friday** button creates a JSON backup that can be imported on another device.


## v8 Friday guest/photo-op update

- Friday professional photo-op start times are indexed as saveable schedule items and route to Hall 1C.
- Guest cards now show every indexed timed Friday item (panels, photo ops, team-ups) with individual Save buttons.
- Matthew Lillard is included with his official NYCC guest profile, Friday Scream panel, solo photo-op slots, and Scream Group photo op.
- Activities can be added to My Friday: exact timed sub-events have one-tap Save buttons; open-hour activities use **Plan a visit** so you can choose the time you actually want to go.
- At-table autograph offerings without a specific start time are shown as guest information rather than fake timed events.
- Photo-op times/groups are subject to change; verify the linked Epic/NYCC source before the event.
