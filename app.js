(() => {
  'use strict';

  const DAYS = [
    { date: '2026-10-08', short: 'Thu', label: 'Thursday', day: 'Oct 8' },
    { date: '2026-10-09', short: 'Fri', label: 'Friday', day: 'Oct 9' },
    { date: '2026-10-10', short: 'Sat', label: 'Saturday', day: 'Oct 10' },
    { date: '2026-10-11', short: 'Sun', label: 'Sunday', day: 'Oct 11' }
  ];

  const JAVITS = {
    name: 'Jacob K. Javits Convention Center',
    address: '429 11th Avenue, New York, NY 10001',
    lat: 40.75755,
    lng: -74.00250
  };

  const STORAGE_EVENTS = 'nycc2026-personal-events-v1';
  const STORAGE_START = 'nycc2026-current-location-v1';

  let selectedDay = pickInitialDay();
  let personalEvents = loadJSON(STORAGE_EVENTS, []);
  let currentLocationId = localStorage.getItem(STORAGE_START) || 'l1_hall_center';
  let destinationId = 'l1_main_stage';
  let activeRoute = null;
  let activeBooth = null;
  let activeMap = 'overview';
  let gpsWatchId = null;
  let latestPosition = null;

  const el = id => document.getElementById(id);

  function pickInitialDay() {
    const today = new Date().toISOString().slice(0, 10);
    return DAYS.some(d => d.date === today) ? today : DAYS[0].date;
  }

  function loadJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(fallback) ? (Array.isArray(value) ? value : fallback) : (value ?? fallback);
    } catch (_) {
      return fallback;
    }
  }

  function savePersonalEvents() {
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(personalEvents));
  }

  function allEvents() {
    return [
      ...(Array.isArray(window.NYCC_EVENTS) ? window.NYCC_EVENTS.map(e => ({ ...e, source: 'site' })) : []),
      ...personalEvents.map(e => ({ ...e, source: 'personal' }))
    ];
  }

  function formatTime(time) {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  function eventLocationLabel(event) {
    if (event.booth) return `Booth ${event.booth} · Level 3 Show Floor`;
    if (event.locationId && window.NYCC_LOCATIONS[event.locationId]) {
      const loc = window.NYCC_LOCATIONS[event.locationId];
      return `${loc.name} · ${loc.floor}`;
    }
    return event.location || 'Location not set';
  }

  function renderDayTabs() {
    const wrap = el('dayTabs');
    wrap.innerHTML = '';
    DAYS.forEach(day => {
      const button = document.createElement('button');
      button.className = `day-tab${selectedDay === day.date ? ' active' : ''}`;
      button.type = 'button';
      button.role = 'tab';
      button.setAttribute('aria-selected', selectedDay === day.date ? 'true' : 'false');
      button.innerHTML = `<strong>${day.short}</strong><span>${day.day}</span>`;
      button.addEventListener('click', () => {
        selectedDay = day.date;
        renderDayTabs();
        renderSchedule();
      });
      wrap.appendChild(button);
    });
  }

  function renderSchedule() {
    const list = el('scheduleList');
    list.innerHTML = '';
    const events = allEvents()
      .filter(e => e.date === selectedDay)
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));

    if (!events.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = `<h3>No events yet</h3><p>Add events on your phone, or edit <code>data/events.js</code> before uploading the site to GitHub.</p><button class="primary" type="button">Add my first event</button>`;
      empty.querySelector('button').addEventListener('click', openEventDialog);
      list.appendChild(empty);
      return;
    }

    events.forEach(event => {
      const card = document.createElement('article');
      card.className = 'event-card';

      const time = document.createElement('div');
      time.className = 'event-time';
      time.textContent = formatTime(event.start);
      if (event.end) {
        const end = document.createElement('span');
        end.textContent = `to ${formatTime(event.end)}`;
        time.appendChild(end);
      }

      const body = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'event-title';
      title.textContent = event.title || 'Untitled event';
      const meta = document.createElement('div');
      meta.className = 'event-meta';
      meta.textContent = eventLocationLabel(event);
      body.append(title, meta);
      if (event.notes) {
        const notes = document.createElement('div');
        notes.className = 'event-notes';
        notes.textContent = event.notes;
        body.appendChild(notes);
      }

      const actions = document.createElement('div');
      actions.className = 'event-actions';
      const nav = document.createElement('button');
      nav.className = 'primary';
      nav.type = 'button';
      nav.textContent = 'Navigate';
      nav.disabled = !event.locationId && !event.booth;
      nav.addEventListener('click', () => navigateToEvent(event));
      actions.appendChild(nav);

      if (event.source === 'personal') {
        const remove = document.createElement('button');
        remove.className = 'secondary';
        remove.type = 'button';
        remove.textContent = 'Delete';
        remove.addEventListener('click', () => {
          personalEvents = personalEvents.filter(e => e.id !== event.id);
          savePersonalEvents();
          renderSchedule();
          toast('Event deleted');
        });
        actions.appendChild(remove);
      }

      card.append(time, body, actions);
      list.appendChild(card);
    });
  }

  function locationSortEntries(includeHidden = false) {
    return Object.entries(window.NYCC_LOCATIONS)
      .filter(([, l]) => includeHidden || !l.hidden)
      .sort((a, b) => `${a[1].floor} ${a[1].name}`.localeCompare(`${b[1].floor} ${b[1].name}`, undefined, { numeric: true }));
  }

  function fillLocationSelect(select, includeHidden = false, blank = false) {
    select.innerHTML = '';
    if (blank) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Choose a mapped location…';
      select.appendChild(opt);
    }
    let lastFloor = null;
    let group = null;
    locationSortEntries(includeHidden).forEach(([id, loc]) => {
      const floor = loc.floor.split(' • ')[0];
      if (floor !== lastFloor) {
        group = document.createElement('optgroup');
        group.label = floor;
        select.appendChild(group);
        lastFloor = floor;
      }
      const option = document.createElement('option');
      option.value = id;
      option.textContent = loc.short || loc.name;
      group.appendChild(option);
    });
  }

  function initSelects() {
    fillLocationSelect(el('currentLocationSelect'), true, false);
    fillLocationSelect(el('destinationSelect'), false, false);
    fillLocationSelect(el('eventLocation'), false, true);
    if (!window.NYCC_LOCATIONS[currentLocationId]) currentLocationId = 'l1_hall_center';
    el('currentLocationSelect').value = currentLocationId;
    el('destinationSelect').value = destinationId;
  }

  function initMapSelect() {
    const select = el('mapSelect');
    Object.entries(window.NYCC_MAPS).forEach(([key, map]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = map.name;
      select.appendChild(opt);
    });
    select.value = activeMap;
    select.addEventListener('change', () => {
      activeMap = select.value;
      renderMap();
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(button => {
      const active = button.dataset.tab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === `tab-${name}`));
    if (name === 'map') renderMap();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateToEvent(event) {
    activeBooth = event.booth || null;
    destinationId = event.locationId || 'l3_show_floor';
    el('destinationSelect').value = destinationId;
    buildAndRenderRoute();
    switchTab('navigate');
  }

  function buildGraph() {
    const graph = {};
    Object.keys(window.NYCC_LOCATIONS).forEach(id => { graph[id] = []; });
    window.NYCC_EDGES.forEach(edge => {
      const [a, b, minutes, note] = edge;
      if (!graph[a] || !graph[b]) return;
      graph[a].push({ to: b, minutes, note });
      graph[b].push({ to: a, minutes, note });
    });
    return graph;
  }

  function shortestPath(start, end) {
    if (start === end) return { path: [start], minutes: 0, edges: [] };
    const graph = buildGraph();
    const dist = {};
    const prev = {};
    const prevEdge = {};
    const unvisited = new Set(Object.keys(graph));
    Object.keys(graph).forEach(id => { dist[id] = Infinity; });
    dist[start] = 0;

    while (unvisited.size) {
      let current = null;
      let best = Infinity;
      for (const id of unvisited) {
        if (dist[id] < best) { best = dist[id]; current = id; }
      }
      if (current === null || best === Infinity) break;
      unvisited.delete(current);
      if (current === end) break;
      for (const edge of graph[current]) {
        if (!unvisited.has(edge.to)) continue;
        const candidate = dist[current] + edge.minutes;
        if (candidate < dist[edge.to]) {
          dist[edge.to] = candidate;
          prev[edge.to] = current;
          prevEdge[edge.to] = edge;
        }
      }
    }

    if (!Number.isFinite(dist[end])) return null;
    const path = [];
    const edges = [];
    let cursor = end;
    while (cursor) {
      path.push(cursor);
      if (prevEdge[cursor]) edges.push(prevEdge[cursor]);
      cursor = prev[cursor];
    }
    path.reverse();
    edges.reverse();
    return { path, minutes: dist[end], edges };
  }

  function routeStepText(fromId, toId, edge) {
    const from = window.NYCC_LOCATIONS[fromId];
    const to = window.NYCC_LOCATIONS[toId];
    if (edge && edge.note) return edge.note;
    const fromBase = from.floor.split(' • ')[0];
    const toBase = to.floor.split(' • ')[0];
    if (fromBase !== toBase) return `Change floors: continue to ${to.name} on ${to.floor}.`;
    return `Continue to ${to.name}.`;
  }

  function buildAndRenderRoute() {
    currentLocationId = el('currentLocationSelect').value;
    destinationId = el('destinationSelect').value;
    localStorage.setItem(STORAGE_START, currentLocationId);
    const route = shortestPath(currentLocationId, destinationId);
    const card = el('routeCard');
    if (!route) {
      card.hidden = false;
      el('routeTitle').textContent = 'No route available';
      el('routeMinutes').textContent = '—';
      el('routeSteps').innerHTML = '<li>This destination is not connected in the current indoor map graph.</li>';
      activeRoute = null;
      return;
    }
    activeRoute = route;
    const from = window.NYCC_LOCATIONS[currentLocationId];
    const to = window.NYCC_LOCATIONS[destinationId];
    card.hidden = false;
    el('routeTitle').textContent = activeBooth ? `${from.name} → Booth ${activeBooth}` : `${from.name} → ${to.name}`;
    el('routeMinutes').textContent = Math.max(1, Math.round(route.minutes + (activeBooth ? 3 : 0)));

    const steps = el('routeSteps');
    steps.innerHTML = '';
    if (route.path.length === 1) {
      const li = document.createElement('li');
      li.textContent = 'You are already at the mapped destination area.';
      steps.appendChild(li);
    } else {
      for (let i = 0; i < route.path.length - 1; i++) {
        const fromId = route.path[i];
        const toId = route.path[i + 1];
        const li = document.createElement('li');
        li.textContent = routeStepText(fromId, toId, route.edges[i]);
        const small = document.createElement('small');
        small.textContent = `${window.NYCC_LOCATIONS[fromId].name} → ${window.NYCC_LOCATIONS[toId].name}`;
        li.appendChild(small);
        steps.appendChild(li);
      }
    }
    if (activeBooth) {
      const booth = window.NYCC_BOOTHS[activeBooth];
      const li = document.createElement('li');
      li.textContent = booth
        ? `On the Level 3 show floor, use the map marker to find booth ${activeBooth}.`
        : `Booth ${activeBooth} is not indexed in the supplied show-floor map.`;
      steps.appendChild(li);
    }

    const destMap = activeBooth ? 'showfloor' : to.map;
    activeMap = destMap;
    el('mapSelect').value = activeMap;
    renderMap();
  }

  function renderMap() {
    const map = window.NYCC_MAPS[activeMap];
    if (!map) return;
    const image = el('mapImage');
    image.src = map.image;
    image.alt = `${map.name} — official NYCC 2026 map`;
    el('mapSelect').value = activeMap;

    const markers = el('mapMarkers');
    markers.innerHTML = '';
    const overlay = el('mapOverlay');
    overlay.innerHTML = '';

    const current = window.NYCC_LOCATIONS[currentLocationId];
    const destination = window.NYCC_LOCATIONS[destinationId];

    if (activeRoute && activeRoute.path.length > 1) {
      for (let i = 0; i < activeRoute.path.length - 1; i++) {
        const a = window.NYCC_LOCATIONS[activeRoute.path[i]];
        const b = window.NYCC_LOCATIONS[activeRoute.path[i + 1]];
        if (a.map !== activeMap || b.map !== activeMap) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
        line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
        line.setAttribute('class', 'route-line');
        overlay.appendChild(line);
      }
    }

    Object.entries(window.NYCC_LOCATIONS)
      .filter(([, loc]) => loc.map === activeMap && !loc.hidden)
      .forEach(([id, loc]) => {
        const classes = ['map-marker'];
        if (id === currentLocationId) classes.push('current');
        if (id === destinationId && !activeBooth) classes.push('destination');
        const button = document.createElement('button');
        button.type = 'button';
        button.className = classes.join(' ');
        button.style.left = `${loc.x}%`;
        button.style.top = `${loc.y}%`;
        button.setAttribute('aria-label', loc.name);
        button.title = loc.name;
        button.addEventListener('click', () => {
          activeBooth = null;
          destinationId = id;
          el('destinationSelect').value = id;
          buildAndRenderRoute();
          toast(`Destination: ${loc.name}`);
        });
        markers.appendChild(button);
      });

    if (activeBooth && activeMap === 'showfloor' && window.NYCC_BOOTHS[activeBooth]) {
      const b = window.NYCC_BOOTHS[activeBooth];
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'map-marker booth';
      marker.style.left = `${b.x}%`;
      marker.style.top = `${b.y}%`;
      marker.setAttribute('aria-label', `Booth ${activeBooth}`);
      marker.title = `Booth ${activeBooth}`;
      markers.appendChild(marker);
    }

    const legend = [];
    if (current && current.map === activeMap) legend.push('<span><i class="legend-dot current"></i>Your selected indoor start</span>');
    if (!activeBooth && destination && destination.map === activeMap) legend.push('<span><i class="legend-dot destination"></i>Destination</span>');
    if (activeBooth && activeMap === 'showfloor') legend.push(`<span><i class="legend-dot booth"></i>Booth ${activeBooth}</span>`);
    legend.push('<span>Tap a black marker to route there</span>');
    el('mapLegend').innerHTML = legend.join('');
  }

  function findBooth(value) {
    const booth = String(value || '').trim();
    const msg = el('boothSearchMsg');
    if (!/^\d{4}$/.test(booth)) {
      msg.textContent = 'Enter a four-digit booth number.';
      return;
    }
    if (!window.NYCC_BOOTHS[booth]) {
      msg.textContent = `Booth ${booth} was not found in the indexed map labels.`;
      return;
    }
    activeBooth = booth;
    destinationId = 'l3_show_floor';
    el('destinationSelect').value = destinationId;
    activeMap = 'showfloor';
    el('mapSelect').value = activeMap;
    msg.textContent = `Booth ${booth} found. Red marker added.`;
    renderMap();
  }

  function openEventDialog() {
    el('eventForm').reset();
    el('eventDate').value = selectedDay;
    el('eventDialog').showModal();
  }

  function closeEventDialog() {
    el('eventDialog').close();
  }

  function saveEventFromForm() {
    const title = el('eventTitle').value.trim();
    const date = el('eventDate').value;
    const start = el('eventStart').value;
    const end = el('eventEnd').value;
    const locationId = el('eventLocation').value || undefined;
    const booth = el('eventBooth').value.trim() || undefined;
    const notes = el('eventNotes').value.trim() || undefined;

    if (!title || !date || !start) return;
    if (booth && !/^\d{4}$/.test(booth)) {
      toast('Booth number must be four digits');
      return;
    }
    personalEvents.push({
      id: `personal-${Date.now()}`,
      title,
      date,
      start,
      end: end || undefined,
      locationId: booth ? undefined : locationId,
      booth,
      notes
    });
    savePersonalEvents();
    selectedDay = date;
    renderDayTabs();
    renderSchedule();
    closeEventDialog();
    toast('Event saved');
  }

  function exportEvents() {
    const data = JSON.stringify(personalEvents, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nycc-2026-my-events.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importEvents(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error('Expected an array');
        personalEvents = parsed.filter(e => e && typeof e === 'object' && e.title && e.date && e.start)
          .map((e, i) => ({ ...e, id: e.id || `imported-${Date.now()}-${i}` }));
        savePersonalEvents();
        renderSchedule();
        toast(`Imported ${personalEvents.length} events`);
      } catch (_) {
        toast('Could not import that JSON file');
      }
    };
    reader.readAsText(file);
  }

  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const p1 = lat1 * Math.PI / 180;
    const p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180;
    const dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    const miles = meters / 1609.344;
    return `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
  }

  function updateMapLinks(position) {
    const google = el('googleMapsLink');
    const apple = el('appleMapsLink');
    const destination = encodeURIComponent(JAVITS.address);
    if (position) {
      const origin = `${position.coords.latitude},${position.coords.longitude}`;
      google.href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${destination}&travelmode=walking`;
      apple.href = `https://maps.apple.com/?saddr=${encodeURIComponent(origin)}&daddr=${destination}&dirflg=w`;
    } else {
      google.href = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
      apple.href = `https://maps.apple.com/?daddr=${destination}&dirflg=w`;
    }
  }

  function startGPS() {
    if (!navigator.geolocation) {
      el('gpsStatus').textContent = 'This browser does not support location services.';
      return;
    }
    el('gpsBtn').disabled = true;
    el('gpsStopBtn').disabled = false;
    el('gpsStatus').textContent = 'Requesting location permission…';
    gpsWatchId = navigator.geolocation.watchPosition(position => {
      latestPosition = position;
      const { latitude, longitude, accuracy } = position.coords;
      const distance = haversineMeters(latitude, longitude, JAVITS.lat, JAVITS.lng);
      el('gpsDetails').hidden = false;
      el('distanceToJavits').textContent = formatDistance(distance);
      el('gpsAccuracy').textContent = `±${Math.round(accuracy)} m`;
      el('gpsStatus').textContent = distance < 350
        ? 'You appear to be near Javits. Switch to indoor landmark routing once inside.'
        : 'Live location is updating while this page remains open.';
      updateMapLinks(position);
    }, error => {
      const message = error.code === 1
        ? 'Location permission was denied. You can still use the indoor maps manually.'
        : 'Your location could not be determined right now.';
      el('gpsStatus').textContent = message;
      stopGPS(false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 });
  }

  function stopGPS(updateStatus = true) {
    if (gpsWatchId !== null) navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
    el('gpsBtn').disabled = false;
    el('gpsStopBtn').disabled = true;
    if (updateStatus) el('gpsStatus').textContent = latestPosition ? 'Live location paused.' : 'Location not enabled.';
  }

  function toast(message) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.role = 'status';
    t.textContent = message;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        el('offlineBadge').textContent = 'Online only';
      });
    } else {
      el('offlineBadge').textContent = 'Online only';
    }
  }

  function wireEvents() {
    document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    el('addEventBtn').addEventListener('click', openEventDialog);
    el('closeDialogBtn').addEventListener('click', closeEventDialog);
    el('cancelEventBtn').addEventListener('click', closeEventDialog);
    el('eventForm').addEventListener('submit', event => { event.preventDefault(); saveEventFromForm(); });
    el('exportBtn').addEventListener('click', exportEvents);
    el('importInput').addEventListener('change', event => importEvents(event.target.files[0]));

    el('currentLocationSelect').addEventListener('change', () => {
      currentLocationId = el('currentLocationSelect').value;
      localStorage.setItem(STORAGE_START, currentLocationId);
      renderMap();
    });
    el('destinationSelect').addEventListener('change', () => {
      activeBooth = null;
      destinationId = el('destinationSelect').value;
      renderMap();
    });
    el('routeBtn').addEventListener('click', buildAndRenderRoute);
    el('swapBtn').addEventListener('click', () => {
      const a = el('currentLocationSelect').value;
      const b = el('destinationSelect').value;
      if (!window.NYCC_LOCATIONS[b]) return;
      el('currentLocationSelect').value = b;
      if ([...el('destinationSelect').options].some(o => o.value === a)) el('destinationSelect').value = a;
      currentLocationId = el('currentLocationSelect').value;
      destinationId = el('destinationSelect').value;
      activeBooth = null;
      buildAndRenderRoute();
    });
    el('viewRouteMapBtn').addEventListener('click', () => {
      const dest = window.NYCC_LOCATIONS[destinationId];
      activeMap = activeBooth ? 'showfloor' : dest.map;
      el('mapSelect').value = activeMap;
      renderMap();
      switchTab('map');
    });

    el('boothSearchForm').addEventListener('submit', event => {
      event.preventDefault();
      findBooth(el('boothSearch').value);
    });

    el('gpsBtn').addEventListener('click', startGPS);
    el('gpsStopBtn').addEventListener('click', () => stopGPS(true));
  }

  function init() {
    renderDayTabs();
    renderSchedule();
    initSelects();
    initMapSelect();
    wireEvents();
    updateMapLinks(null);
    renderMap();
    registerServiceWorker();
  }

  init();
})();
