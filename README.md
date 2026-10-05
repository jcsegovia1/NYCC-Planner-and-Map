# NYCC 2026 Planner

A static, phone-friendly New York Comic Con 2026 schedule + Javits navigation helper. It needs no server, database, build step, package manager, API key, or command line.

## What is included

- Official 2026 NYCC map images extracted from the supplied PDF: overview, Levels 1–5, show floor, and Artist Alley/Writers Block.
- Indoor route graph for major mapped destinations.
- The Level 4 routing model keeps River Pavilion separate from the North Javits panel-room area, matching the access warning on the official map.
- Searchable Level 3 booth overlay. `data/booths.js` contains 570 booth numbers automatically indexed from the PDF text coordinates.
- Browser GPS while the page is open, plus Google Maps and Apple Maps walking-direction handoff to Javits.
- Personal schedule editor saved in browser `localStorage`.
- Import/export of personal schedule JSON.
- Optional shared schedule in `data/events.js`.
- Offline cache after the site has been loaded once.
- Installable web-app manifest.

## Add shared schedule events

Edit `data/events.js` before uploading. Example:

```js
window.NYCC_EVENTS = [
  {
    id: 'panel-1',
    title: 'My panel',
    date: '2026-10-08',
    start: '13:30',
    end: '14:30',
    locationId: 'l4_room405',
    notes: 'Line up 30 minutes early.'
  },
  {
    id: 'booth-stop',
    title: 'Visit a booth',
    date: '2026-10-08',
    start: '15:00',
    booth: '3425'
  }
];
```

Mapped `locationId` values are listed in `data/locations.js`. You can also add events directly in the app; those are private to the browser/device.

## Indoor positioning limitation

Normal phone GPS is not accurate enough to reliably determine a room, hallway, or floor inside Javits. This app therefore uses live GPS for approaching the venue and a manually selected indoor landmark for in-building routing. Indoor marker positions and walking-time weights are approximate; posted signs and event staff should take priority.

## Privacy

The site has no analytics and no backend. Location is read locally in the browser. Coordinates are included in a Google Maps or Apple Maps URL only if the user taps the corresponding directions link.

## Map rights

The included NYCC floor-map images came from the official 2026 map PDF supplied for this project. NYCC/ReedPop/Javits names, logos, artwork, and map graphics may be protected by their respective owners. Before publishing a public mirror of the map artwork, check the applicable event/site terms or obtain permission if required. If you do not want to redistribute the images, replace the files in `assets/maps/` with maps you are allowed to publish while keeping the same filenames.

## Files you will edit most often

- `data/events.js` — shared/preloaded schedule.
- `data/locations.js` — mapped destinations, marker positions, and indoor route graph.
- `styles.css` — appearance.
- `app.js` — app behavior.

## Test locally

Opening `index.html` directly will show most of the interface, but browser security rules may prevent service workers and geolocation on a `file://` URL. GitHub Pages uses HTTPS, which is the intended environment.
