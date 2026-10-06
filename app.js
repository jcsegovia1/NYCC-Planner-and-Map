(() => {
  'use strict';

  const FRIDAY = '2026-10-09';
  const JAVITS = {
    address: '429 11th Avenue, New York, NY 10001',
    lat: 40.75755,
    lng: -74.00250
  };

  const STORAGE_EVENTS = 'nycc2026-personal-events-v1';
  const STORAGE_SAVED = 'nycc2026-friday-saved-v1';
  const STORAGE_START = 'nycc2026-current-location-v1';

  let personalEvents = loadArray(STORAGE_EVENTS).filter(e => !e.date || e.date === FRIDAY).map(e => ({ ...e, date: FRIDAY }));
  let savedOfficialIds = loadArray(STORAGE_SAVED).filter(id => typeof id === 'string');
  let currentLocationId = localStorage.getItem(STORAGE_START) || 'l1_hall_center';
  let destinationId = 'l1_main_stage';
  let activeRoute = null;
  let activeBooth = null;
  let activeMap = 'overview';
  let gpsWatchId = null;
  let latestPosition = null;

  const el = id => document.getElementById(id);
  const events = () => Array.isArray(window.NYCC_EVENTS) ? window.NYCC_EVENTS.filter(e => e.date === FRIDAY) : [];
  const activities = () => Array.isArray(window.NYCC_ACTIVITIES) ? window.NYCC_ACTIVITIES : [];
  const guestHighlights = () => Array.isArray(window.NYCC_GUEST_HIGHLIGHTS) ? window.NYCC_GUEST_HIGHLIGHTS : [];
  const exhibitors = () => Array.isArray(window.NYCC_EXHIBITORS) ? window.NYCC_EXHIBITORS : [];

  function loadArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function savePlan() {
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(personalEvents));
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(savedOfficialIds));
  }

  function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function formatTime(time) {
    if (!time) return 'Time TBA';
    const [h, m] = String(time).split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }

  function timeRange(item) {
    return item.end ? `${formatTime(item.start)}–${formatTime(item.end)}` : formatTime(item.start);
  }

  function minutes(time) {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function itemEndMinutes(item) {
    const start = minutes(item.start);
    if (start === null) return null;
    return minutes(item.end) ?? (start + 45);
  }

  function eventLocationLabel(item) {
    if (item.booth) return `Booth ${item.booth} · Level 3 Show Floor`;
    if (item.locationId && window.NYCC_LOCATIONS?.[item.locationId]) {
      const loc = window.NYCC_LOCATIONS[item.locationId];
      return `${loc.name} · ${loc.floor}`;
    }
    return item.location || 'Location not listed';
  }

  function flagBadges(item) {
    const labels = [];
    if (item.reservation) labels.push(['Reservation', 'important']);
    if (item.ticketed) labels.push(['Ticketed', 'important']);
    if (item.afterDark) labels.push(['After Dark', 'late']);
    (item.tags || []).slice(0, 3).forEach(tag => labels.push([tag, '']));
    return labels.map(([label, cls]) => `<span class="badge ${cls}">${escapeHTML(label)}</span>`).join('');
  }

  function isSaved(id) {
    return savedOfficialIds.includes(id);
  }

  function toggleSaved(id) {
    if (isSaved(id)) savedOfficialIds = savedOfficialIds.filter(value => value !== id);
    else savedOfficialIds.push(id);
    savePlan();
    renderMyFriday();
    renderBrowse();
  }

  function myFridayItems() {
    const official = events().filter(event => isSaved(event.id)).map(event => ({ ...event, sourceType: 'official' }));
    const personal = personalEvents.map(event => ({ ...event, sourceType: 'personal' }));
    return [...official, ...personal].sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99') || (a.title || '').localeCompare(b.title || ''));
  }

  function conflictInfo(items) {
    const ids = new Set();
    let pairs = 0;
    for (let i = 0; i < items.length; i += 1) {
      const aStart = minutes(items[i].start);
      const aEnd = itemEndMinutes(items[i]);
      if (aStart === null || aEnd === null) continue;
      for (let j = i + 1; j < items.length; j += 1) {
        const bStart = minutes(items[j].start);
        const bEnd = itemEndMinutes(items[j]);
        if (bStart === null || bEnd === null) continue;
        if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
          ids.add(items[i].id);
          ids.add(items[j].id);
          pairs += 1;
        }
      }
    }
    return { ids, pairs };
  }

  function renderMyFriday() {
    const list = el('myFridayList');
    const items = myFridayItems();
    const conflict = conflictInfo(items);
    const conflicts = conflict.ids;
    el('savedCount').textContent = String(items.length);
    el('conflictCount').textContent = String(conflict.pairs);
    list.innerHTML = '';

    if (!items.length) {
      list.innerHTML = `<div class="empty-state"><h3>Your Friday is open</h3><p>Browse the Friday schedule and save panels, screenings and meetups. You can also add personal signings, meals or booth stops.</p><button id="emptyBrowseBtn" class="primary" type="button">Browse Friday events</button></div>`;
      el('emptyBrowseBtn').addEventListener('click', () => switchTab('browse'));
      return;
    }

    items.forEach(item => {
      const card = document.createElement('article');
      card.className = `event-card${conflicts.has(item.id) ? ' has-conflict' : ''}`;

      const time = document.createElement('div');
      time.className = 'event-time';
      time.textContent = formatTime(item.start);
      if (item.end) {
        const end = document.createElement('span');
        end.textContent = `to ${formatTime(item.end)}`;
        time.appendChild(end);
      }

      const body = document.createElement('div');
      body.className = 'event-card-body';
      body.innerHTML = `${conflicts.has(item.id) ? '<span class="conflict-label">TIME CONFLICT</span>' : ''}<div class="event-title">${escapeHTML(item.title || 'Untitled item')}</div><div class="event-meta">${escapeHTML(eventLocationLabel(item))}</div>${item.category ? `<div class="event-notes">${escapeHTML(item.category)}</div>` : ''}${item.notes ? `<div class="event-notes">${escapeHTML(item.notes)}</div>` : ''}`;

      const actions = document.createElement('div');
      actions.className = 'event-actions';
      if (item.locationId || item.booth) {
        const nav = document.createElement('button');
        nav.className = 'primary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem(item));
        actions.appendChild(nav);
      }
      if (item.sourceUrl) {
        const source = document.createElement('a');
        source.className = 'secondary link-button small-action';
        source.target = '_blank';
        source.rel = 'noopener';
        source.href = item.sourceUrl;
        source.textContent = 'Details ↗';
        actions.appendChild(source);
      }
      const remove = document.createElement('button');
      remove.className = 'secondary';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        if (item.sourceType === 'official') savedOfficialIds = savedOfficialIds.filter(id => id !== item.id);
        else personalEvents = personalEvents.filter(event => event.id !== item.id);
        savePlan();
        renderMyFriday();
        renderBrowse();
        toast('Removed from My Friday');
      });
      actions.appendChild(remove);
      card.append(time, body, actions);
      list.appendChild(card);
    });
  }

  function populateEventCategories() {
    const select = el('eventCategory');
    const categories = [...new Set(events().map(e => e.category).filter(Boolean))].sort();
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      select.appendChild(option);
    });
  }

  function renderBrowse() {
    const query = el('eventSearch').value.trim().toLowerCase();
    const category = el('eventCategory').value;
    const filtered = events().filter(event => {
      const haystack = [event.title, event.description, event.category, ...(event.tags || []), ...(event.guests || []), eventLocationLabel(event)].join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (!category || event.category === category);
    }).sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99'));

    el('eventResultCount').textContent = `${filtered.length} Friday event${filtered.length === 1 ? '' : 's'} shown · ${events().length} indexed in this build`;
    const list = el('eventBrowseList');
    list.innerHTML = '';

    filtered.forEach(event => {
      const card = document.createElement('article');
      card.className = 'browse-card event-browse-card';
      const guestLine = event.guests?.length ? `<p class="card-people"><strong>Guests:</strong> ${escapeHTML(event.guests.join(', '))}</p>` : '';
      card.innerHTML = `
        <div class="browse-card-top"><div><span class="eyebrow">${escapeHTML(timeRange(event))}</span><h3>${escapeHTML(event.title)}</h3></div><span class="category-pill">${escapeHTML(event.category || 'Programming')}</span></div>
        <p class="location-line">${escapeHTML(eventLocationLabel(event))}</p>
        <div class="badge-row">${flagBadges(event)}</div>
        <p>${escapeHTML(event.description || '')}</p>
        ${guestLine}
        <div class="card-actions"></div>`;
      const actions = card.querySelector('.card-actions');
      const save = document.createElement('button');
      save.className = isSaved(event.id) ? 'saved-button' : 'primary';
      save.type = 'button';
      save.textContent = isSaved(event.id) ? '✓ Saved' : '+ My Friday';
      save.addEventListener('click', () => toggleSaved(event.id));
      actions.appendChild(save);
      if (event.locationId || event.booth) {
        const nav = document.createElement('button');
        nav.className = 'secondary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem(event));
        actions.appendChild(nav);
      }
      if (event.sourceUrl) actions.appendChild(externalLink(event.sourceUrl, event.sourceLabel || 'Source'));
      list.appendChild(card);
    });
  }

  function renderActivities() {
    const list = el('activitiesList');
    list.innerHTML = '';
    activities().forEach(activity => {
      const card = document.createElement('article');
      card.className = 'browse-card';
      card.innerHTML = `<div class="browse-card-top"><div><span class="eyebrow">${escapeHTML(activity.hours || 'Friday')}</span><h3>${escapeHTML(activity.name)}</h3></div></div><p class="location-line">${escapeHTML(activity.location || eventLocationLabel(activity))}</p><p>${escapeHTML(activity.description || '')}</p>${activity.highlights?.length ? `<ul class="compact-list">${activity.highlights.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>` : ''}<div class="card-actions"></div>`;
      const actions = card.querySelector('.card-actions');
      if (activity.locationId) {
        const nav = document.createElement('button');
        nav.className = 'primary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem(activity));
        actions.appendChild(nav);
      }
      if (activity.sourceUrl) actions.appendChild(externalLink(activity.sourceUrl, 'Official info'));
      list.appendChild(card);
    });
  }

  function allGuestRecords() {
    const map = new Map();
    guestHighlights().forEach(guest => map.set(guest.name.toLowerCase(), { ...guest, highlighted: true, eventTitles: [] }));
    events().forEach(event => {
      (event.guests || []).forEach(name => {
        const key = name.toLowerCase();
        const existing = map.get(key) || { name, type: 'Friday panel / event', knownFor: '', fridayNote: '', highlighted: false, eventTitles: [] };
        existing.eventTitles = existing.eventTitles || [];
        if (!existing.eventTitles.includes(event.title)) existing.eventTitles.push(event.title);
        existing.eventId = existing.eventId || event.id;
        existing.locationId = existing.locationId || event.locationId;
        existing.sourceUrl = existing.sourceUrl || event.sourceUrl;
        map.set(key, existing);
      });
    });
    return [...map.values()].sort((a, b) => Number(b.highlighted) - Number(a.highlighted) || a.name.localeCompare(b.name));
  }

  function renderGuests() {
    const query = el('guestSearch').value.trim().toLowerCase();
    const all = allGuestRecords();
    const filtered = all.filter(guest => [guest.name, guest.type, guest.knownFor, guest.fridayNote, ...(guest.eventTitles || [])].join(' ').toLowerCase().includes(query));
    el('guestResultCount').textContent = `${filtered.length} Friday guest / panelist record${filtered.length === 1 ? '' : 's'} shown`;
    const list = el('guestList');
    list.innerHTML = '';
    filtered.forEach(guest => {
      const card = document.createElement('article');
      card.className = 'browse-card guest-card';
      const appearing = guest.eventTitles?.length ? `<p class="card-people"><strong>Friday programming:</strong> ${escapeHTML(guest.eventTitles.slice(0, 4).join(' · '))}${guest.eventTitles.length > 4 ? '…' : ''}</p>` : '';
      card.innerHTML = `<div class="browse-card-top"><div>${guest.highlighted ? '<span class="eyebrow">FRIDAY HIGHLIGHT</span>' : '<span class="eyebrow">FRIDAY PROGRAMMING</span>'}<h3>${escapeHTML(guest.name)}</h3></div><span class="category-pill">${escapeHTML(guest.type || 'Guest')}</span></div>${guest.knownFor ? `<p class="location-line">${escapeHTML(guest.knownFor)}</p>` : ''}${guest.fridayNote ? `<p>${escapeHTML(guest.fridayNote)}</p>` : ''}${appearing}<div class="card-actions"></div>`;
      const actions = card.querySelector('.card-actions');
      if (guest.eventId) {
        const event = events().find(e => e.id === guest.eventId);
        if (event) {
          const button = document.createElement('button');
          button.className = isSaved(event.id) ? 'saved-button' : 'primary';
          button.type = 'button';
          button.textContent = isSaved(event.id) ? '✓ Event saved' : '+ Save event';
          button.addEventListener('click', () => toggleSaved(event.id));
          actions.appendChild(button);
        }
      }
      if (guest.locationId) {
        const nav = document.createElement('button');
        nav.className = 'secondary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem(guest));
        actions.appendChild(nav);
      }
      if (guest.sourceUrl) actions.appendChild(externalLink(guest.sourceUrl, 'Source'));
      list.appendChild(card);
    });
  }

  function renderExhibitors() {
    const query = el('exhibitorSearch').value.trim().toLowerCase();
    const filtered = exhibitors().filter(item => [item.name, item.booth, item.artistTable, item.category, item.note].join(' ').toLowerCase().includes(query));
    const list = el('exhibitorList');
    list.innerHTML = '';
    filtered.forEach(item => {
      const card = document.createElement('article');
      card.className = 'browse-card exhibitor-card';
      const spot = item.booth ? `Booth ${item.booth}` : item.artistTable ? `Artist Alley ${item.artistTable}` : eventLocationLabel(item);
      card.innerHTML = `<div class="browse-card-top"><div><span class="eyebrow">${escapeHTML(item.category || 'EXHIBITOR')}</span><h3>${escapeHTML(item.name)}</h3></div>${item.booth ? `<span class="booth-pill">#${escapeHTML(item.booth)}</span>` : ''}</div><p class="location-line">${escapeHTML(spot)}</p><p>${escapeHTML(item.note || '')}</p><div class="card-actions"></div>`;
      const actions = card.querySelector('.card-actions');
      if (item.booth && window.NYCC_BOOTHS?.[item.booth]) {
        const show = document.createElement('button');
        show.className = 'primary';
        show.type = 'button';
        show.textContent = 'Show booth';
        show.addEventListener('click', () => showBoothOnMap(item.booth));
        actions.appendChild(show);
        const nav = document.createElement('button');
        nav.className = 'secondary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem({ booth: item.booth }));
        actions.appendChild(nav);
      } else if (item.locationId) {
        const nav = document.createElement('button');
        nav.className = 'primary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem(item));
        actions.appendChild(nav);
      }
      if (item.sourceUrl) actions.appendChild(externalLink(item.sourceUrl, 'Info'));
      list.appendChild(card);
    });
  }

  function externalLink(url, label) {
    const a = document.createElement('a');
    a.className = 'secondary link-button small-action';
    a.target = '_blank';
    a.rel = 'noopener';
    a.href = url;
    a.textContent = `${label} ↗`;
    return a;
  }

  function locationSortEntries(includeHidden = false) {
    return Object.entries(window.NYCC_LOCATIONS || {})
      .filter(([, loc]) => includeHidden || !loc.hidden)
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
    Object.entries(window.NYCC_MAPS || {}).forEach(([key, map]) => {
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
    if (name === 'guests') renderGuests();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigateToItem(item) {
    activeBooth = item.booth || null;
    destinationId = item.locationId || (item.booth ? 'l3_show_floor' : destinationId);
    if (!window.NYCC_LOCATIONS[destinationId]) return;
    el('destinationSelect').value = destinationId;
    buildAndRenderRoute();
    switchTab('navigate');
  }

  function showBoothOnMap(booth) {
    activeBooth = booth;
    destinationId = 'l3_show_floor';
    el('destinationSelect').value = destinationId;
    activeMap = 'showfloor';
    el('mapSelect').value = activeMap;
    renderMap();
    switchTab('map');
  }

  function buildGraph() {
    const graph = {};
    Object.keys(window.NYCC_LOCATIONS || {}).forEach(id => { graph[id] = []; });
    (window.NYCC_EDGES || []).forEach(([a, b, edgeMinutes, note]) => {
      if (!graph[a] || !graph[b]) return;
      graph[a].push({ to: b, minutes: edgeMinutes, note });
      graph[b].push({ to: a, minutes: edgeMinutes, note });
    });
    return graph;
  }

  function shortestPath(start, end) {
    if (start === end) return { path: [start], minutes: 0, edges: [] };
    const graph = buildGraph();
    if (!graph[start] || !graph[end]) return null;
    const dist = {}, prev = {}, prevEdge = {};
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
      graph[current].forEach(edge => {
        if (!unvisited.has(edge.to)) return;
        const candidate = dist[current] + edge.minutes;
        if (candidate < dist[edge.to]) {
          dist[edge.to] = candidate;
          prev[edge.to] = current;
          prevEdge[edge.to] = edge;
        }
      });
    }

    if (!Number.isFinite(dist[end])) return null;
    const path = [];
    const edges = [];
    let cursor = end;
    while (cursor) {
      path.unshift(cursor);
      if (cursor === start) break;
      edges.unshift(prevEdge[cursor]);
      cursor = prev[cursor];
    }
    return { path, minutes: dist[end], edges };
  }

  function buildAndRenderRoute() {
    currentLocationId = el('currentLocationSelect').value;
    destinationId = el('destinationSelect').value;
    localStorage.setItem(STORAGE_START, currentLocationId);
    const route = shortestPath(currentLocationId, destinationId);
    const card = el('routeCard');
    if (!route) {
      card.hidden = false;
      el('routeTitle').textContent = 'No mapped route';
      el('routeMinutes').textContent = '—';
      el('routeSteps').innerHTML = '<li>Choose another nearby landmark. This routing graph intentionally avoids inventing connections not shown on the official map.</li>';
      activeRoute = null;
      return;
    }

    activeRoute = route;
    const start = window.NYCC_LOCATIONS[currentLocationId];
    const end = window.NYCC_LOCATIONS[destinationId];
    el('routeTitle').textContent = activeBooth ? `${start.name} → Booth ${activeBooth}` : `${start.name} → ${end.name}`;
    el('routeMinutes').textContent = String(route.minutes + (activeBooth ? 4 : 0));
    const steps = [];
    route.path.forEach((id, index) => {
      const loc = window.NYCC_LOCATIONS[id];
      if (index === 0) steps.push(`<li><strong>Start:</strong> ${escapeHTML(loc.name)}<small>${escapeHTML(loc.floor)}</small></li>`);
      else {
        const edge = route.edges[index - 1];
        steps.push(`<li>${edge?.note ? escapeHTML(edge.note) : `Continue to ${escapeHTML(loc.name)}.`}<small>${escapeHTML(loc.name)} · about ${edge?.minutes || 1} min</small></li>`);
      }
    });
    if (activeBooth) steps.push(`<li><strong>Enter the show floor and continue to Booth ${escapeHTML(activeBooth)}.</strong><small>Use the red booth marker on the detailed Level 3 Show Floor map.</small></li>`);
    el('routeSteps').innerHTML = steps.join('');
    card.hidden = false;
    renderMap();
  }

  function renderMap() {
    const map = window.NYCC_MAPS?.[activeMap];
    if (!map) return;
    const image = el('mapImage');
    image.src = map.image;
    image.alt = `NYCC 2026 ${map.name} map`;
    const overlay = el('mapOverlay');
    const markers = el('mapMarkers');
    overlay.innerHTML = '';
    markers.innerHTML = '';

    if (activeRoute && !activeBooth) {
      const points = activeRoute.path.map(id => window.NYCC_LOCATIONS[id]).filter(loc => loc?.map === activeMap);
      if (points.length > 1) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        line.setAttribute('points', points.map(p => `${p.x},${p.y}`).join(' '));
        line.setAttribute('class', 'route-line');
        overlay.appendChild(line);
      }
    }

    const current = window.NYCC_LOCATIONS[currentLocationId];
    const destination = window.NYCC_LOCATIONS[destinationId];
    Object.entries(window.NYCC_LOCATIONS || {})
      .filter(([id, loc]) => loc.map === activeMap && (!loc.hidden || id === currentLocationId || (!activeBooth && id === destinationId)))
      .forEach(([id, loc]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `map-marker${id === currentLocationId ? ' current' : ''}${!activeBooth && id === destinationId ? ' destination' : ''}`;
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

    if (activeBooth && activeMap === 'showfloor' && window.NYCC_BOOTHS?.[activeBooth]) {
      const booth = window.NYCC_BOOTHS[activeBooth];
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'map-marker booth';
      marker.style.left = `${booth.x}%`;
      marker.style.top = `${booth.y}%`;
      marker.setAttribute('aria-label', `Booth ${activeBooth}`);
      marker.title = `Booth ${activeBooth}`;
      markers.appendChild(marker);
    }

    const legend = [];
    if (current?.map === activeMap) legend.push('<span><i class="legend-dot current"></i>Your selected indoor start</span>');
    if (!activeBooth && destination?.map === activeMap) legend.push('<span><i class="legend-dot destination"></i>Destination</span>');
    if (activeBooth && activeMap === 'showfloor') legend.push(`<span><i class="legend-dot booth"></i>Booth ${escapeHTML(activeBooth)}</span>`);
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
    if (!window.NYCC_BOOTHS?.[booth]) {
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
    el('eventDialog').showModal();
  }

  function closeEventDialog() {
    el('eventDialog').close();
  }

  function saveEventFromForm() {
    const title = el('eventTitle').value.trim();
    const start = el('eventStart').value;
    const end = el('eventEnd').value;
    const locationId = el('eventLocation').value || undefined;
    const booth = el('eventBooth').value.trim() || undefined;
    const notes = el('eventNotes').value.trim() || undefined;
    if (!title || !start) return;
    if (booth && !/^\d{4}$/.test(booth)) {
      toast('Booth number must be four digits');
      return;
    }
    personalEvents.push({
      id: `personal-${Date.now()}`,
      title,
      date: FRIDAY,
      start,
      end: end || undefined,
      locationId: booth ? undefined : locationId,
      booth,
      notes
    });
    savePlan();
    renderMyFriday();
    closeEventDialog();
    toast('Added to My Friday');
  }

  function exportPlan() {
    const data = JSON.stringify({ version: 2, date: FRIDAY, savedOfficialIds, personalEvents }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nycc-2026-friday-plan.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importPlan(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (Array.isArray(parsed)) {
          personalEvents = parsed.filter(e => e && e.title && e.start).map((e, i) => ({ ...e, date: FRIDAY, id: e.id || `imported-${Date.now()}-${i}` }));
        } else if (parsed && typeof parsed === 'object') {
          personalEvents = Array.isArray(parsed.personalEvents) ? parsed.personalEvents.filter(e => e && e.title && e.start).map(e => ({ ...e, date: FRIDAY })) : [];
          savedOfficialIds = Array.isArray(parsed.savedOfficialIds) ? parsed.savedOfficialIds.filter(id => events().some(event => event.id === id)) : [];
        } else throw new Error('Invalid plan');
        savePlan();
        renderMyFriday();
        renderBrowse();
        toast('Friday plan imported');
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
    const destination = encodeURIComponent(JAVITS.address);
    if (position) {
      const origin = `${position.coords.latitude},${position.coords.longitude}`;
      el('googleMapsLink').href = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${destination}&travelmode=walking`;
      el('appleMapsLink').href = `https://maps.apple.com/?saddr=${encodeURIComponent(origin)}&daddr=${destination}&dirflg=w`;
    } else {
      el('googleMapsLink').href = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
      el('appleMapsLink').href = `https://maps.apple.com/?daddr=${destination}&dirflg=w`;
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
      el('gpsStatus').textContent = distance < 350 ? 'You appear to be near Javits. Switch to indoor landmark routing once inside.' : 'Live location is updating while this page remains open.';
      updateMapLinks(position);
    }, error => {
      el('gpsStatus').textContent = error.code === 1 ? 'Location permission was denied. You can still use the indoor maps manually.' : 'Your location could not be determined right now.';
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
      navigator.serviceWorker.register('./sw.js?v=7').catch(() => { el('offlineBadge').textContent = 'Friday-first · Online only'; });
    } else el('offlineBadge').textContent = 'Friday-first · Online only';
  }

  function wireEvents() {
    document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    el('addEventBtn').addEventListener('click', openEventDialog);
    el('closeDialogBtn').addEventListener('click', closeEventDialog);
    el('cancelEventBtn').addEventListener('click', closeEventDialog);
    el('eventForm').addEventListener('submit', event => { event.preventDefault(); saveEventFromForm(); });
    el('browseFridayBtn').addEventListener('click', () => switchTab('browse'));
    el('exportBtn').addEventListener('click', exportPlan);
    el('importInput').addEventListener('change', event => importPlan(event.target.files[0]));
    el('eventSearch').addEventListener('input', renderBrowse);
    el('eventCategory').addEventListener('change', renderBrowse);
    el('guestSearch').addEventListener('input', renderGuests);
    el('exhibitorSearch').addEventListener('input', renderExhibitors);

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
      if ([...el('destinationSelect').options].some(option => option.value === a)) el('destinationSelect').value = a;
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
    populateEventCategories();
    initSelects();
    initMapSelect();
    wireEvents();
    renderMyFriday();
    renderBrowse();
    renderActivities();
    renderGuests();
    renderExhibitors();
    updateMapLinks(null);
    renderMap();
    registerServiceWorker();
  }

  init();
})();
