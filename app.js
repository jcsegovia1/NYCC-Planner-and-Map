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
  const STORAGE_EVENT_OVERRIDES = 'nycc2026-friday-event-overrides-v1';
  const STORAGE_EXHIBITOR_TODOS = 'nycc2026-friday-exhibitor-todos-v1';
  const STORAGE_EXHIBITOR_DONE = 'nycc2026-friday-exhibitor-done-v1';
  const STORAGE_CUSTOM_EXHIBITORS = 'nycc2026-friday-custom-exhibitors-v1';

  let personalEvents = loadArray(STORAGE_EVENTS).filter(e => !e.date || e.date === FRIDAY).map(e => ({ ...e, date: FRIDAY }));
  let savedOfficialIds = loadArray(STORAGE_SAVED).filter(id => typeof id === 'string');
  let eventOverrides = loadObject(STORAGE_EVENT_OVERRIDES);
  let exhibitorTodoIds = loadArray(STORAGE_EXHIBITOR_TODOS).filter(id => typeof id === 'string');
  let exhibitorDone = loadObject(STORAGE_EXHIBITOR_DONE);
  let customExhibitors = loadArray(STORAGE_CUSTOM_EXHIBITORS).filter(item => item && item.name).map(item => ({ ...item, custom: true }));
  let currentLocationId = localStorage.getItem(STORAGE_START) || 'l1_hall_center';
  let destinationId = 'l1_main_stage';
  let activeRoute = null;
  let activeBooth = null;
  let activeBooths = [];
  let activeMap = 'overview';
  let gpsWatchId = null;
  let latestPosition = null;
  let exhibitorRenderLimit = 80;
  let guestRenderLimit = 60;

  const el = id => document.getElementById(id);
  const events = () => Array.isArray(window.NYCC_EVENTS) ? window.NYCC_EVENTS.filter(e => e.date === FRIDAY) : [];
  const activities = () => Array.isArray(window.NYCC_ACTIVITIES) ? window.NYCC_ACTIVITIES : [];
  const officialGuests = () => Array.isArray(window.NYCC_GUESTS) ? window.NYCC_GUESTS : [];
  const exhibitors = () => [...(Array.isArray(window.NYCC_EXHIBITORS) ? window.NYCC_EXHIBITORS : []), ...(Array.isArray(window.NYCC_EXHIBITOR_EXTRAS) ? window.NYCC_EXHIBITOR_EXTRAS : []), ...customExhibitors];

  function exhibitorId(item) {
    return String(item.id || item.booth || item.artistTable || item.name || '')
      .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function exhibitorIds(item) {
    return [...new Set([exhibitorId(item), ...(item.legacyIds || [])].filter(Boolean))];
  }

  function exhibitorBoothNumbers(item) {
    return [...new Set((String(item.booth || '').match(/\b\d{4}\b/g) || []))];
  }

  function mappedExhibitorBooths(item) {
    return exhibitorBoothNumbers(item).filter(booth => window.NYCC_BOOTHS?.[booth]);
  }

  function exhibitorSpotLabel(item) {
    if (item.artistTable) return `Artist Alley ${item.artistTable}`;
    if (item.booth) {
      const nums = exhibitorBoothNumbers(item);
      if (nums.length === 1 && String(item.booth).trim() === nums[0]) return `Booth ${nums[0]}`;
      return `Locations: ${item.booth}`;
    }
    return eventLocationLabel(item);
  }

  function isExhibitorTodo(item) {
    return exhibitorIds(item).some(id => exhibitorTodoIds.includes(id));
  }

  function savedExhibitorTodoId(item) {
    return exhibitorIds(item).find(id => exhibitorTodoIds.includes(id)) || exhibitorId(item);
  }

  function toggleExhibitorTodo(item) {
    const ids = exhibitorIds(item);
    const primary = exhibitorId(item);
    if (!primary) return;
    if (ids.some(id => exhibitorTodoIds.includes(id))) {
      exhibitorTodoIds = exhibitorTodoIds.filter(value => !ids.includes(value));
      ids.forEach(id => { delete exhibitorDone[id]; });
      toast('Removed from Friday to-do');
    } else {
      exhibitorTodoIds.push(primary);
      exhibitorDone[primary] = false;
      toast('Added to Friday to-do');
    }
    savePlan();
    renderMyFriday();
    renderExhibitors();
  }

  function setExhibitorDone(item, done) {
    const id = savedExhibitorTodoId(item);
    exhibitorDone[id] = Boolean(done);
    savePlan();
    renderMyFriday();
    renderExhibitors();
  }

  function myExhibitorTodos() {
    const byId = new Map();
    exhibitors().forEach(item => exhibitorIds(item).forEach(id => byId.set(id, item)));
    const seen = new Set();
    return exhibitorTodoIds.map(id => byId.get(id)).filter(item => {
      if (!item) return false;
      const primary = exhibitorId(item);
      if (seen.has(primary)) return false;
      seen.add(primary);
      return true;
    });
  }

  function loadArray(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  }

  function loadObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch (_) {
      return {};
    }
  }

  function savePlan() {
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(personalEvents));
    localStorage.setItem(STORAGE_SAVED, JSON.stringify(savedOfficialIds));
    localStorage.setItem(STORAGE_EVENT_OVERRIDES, JSON.stringify(eventOverrides));
    localStorage.setItem(STORAGE_EXHIBITOR_TODOS, JSON.stringify(exhibitorTodoIds));
    localStorage.setItem(STORAGE_EXHIBITOR_DONE, JSON.stringify(exhibitorDone));
    localStorage.setItem(STORAGE_CUSTOM_EXHIBITORS, JSON.stringify(customExhibitors));
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

  function addMinutesToTime(time, amount) {
    const base = minutes(time);
    if (base === null) return '';
    const total = Math.max(0, Math.min(23 * 60 + 59, base + amount));
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  function timeRange(item) {
    return item.end ? `${formatTime(item.start)}–${formatTime(item.end)}` : formatTime(item.start);
  }

  function compactDescription(value, limit = 420) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
  }

  function photoOfficialLabel(item) {
    const start = item.officialStart || item.start;
    const end = item.officialEnd || item.end;
    let first = start ? formatTime(start) : 'Time TBD';
    if (item.officialWindow && start && end) first = `${formatTime(start)}–${formatTime(end)} window`;
    const bits = [first];
    if (item.group) bits.push(item.group);
    return bits.join(' · ');
  }

  function minutes(time) {
    if (!time || !/^\d{2}:\d{2}$/.test(time)) return null;
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  function itemEndMinutes(item) {
    const start = minutes(item.start);
    if (start === null) return null;
    return minutes(item.end) ?? (Number.isFinite(item.durationMinutes) ? start + item.durationMinutes : start + 45);
  }

  function eventLocationLabel(item) {
    if (item.booth) return `Booth ${item.booth} · Level 3 Show Floor`;
    if (item.locationId && window.NYCC_LOCATIONS?.[item.locationId]) {
      const loc = window.NYCC_LOCATIONS[item.locationId];
      const exact = String(item.location || '').trim();
      return exact && exact.toLowerCase() !== String(loc.name || '').toLowerCase()
        ? `${exact} · ${loc.floor}`
        : `${loc.name} · ${loc.floor}`;
    }
    return item.location || 'Location not listed';
  }

  function flagBadges(item) {
    const labels = [];
    if (item.reservation) labels.push(['Reservation', 'important']);
    if (item.ticketed) labels.push(['Ticketed', 'important']);
    if (item.photoOp) labels.push(['Photo Op', 'photo']);
    if (item.teamUp) labels.push(['TeamUp', '']);
    if (item.soldOut) labels.push(['SOLD OUT', 'important']);
    if (item.group) labels.push([item.group, '']);
    if (item.afterDark) labels.push(['After Dark', 'late']);
    if (item.livestream) labels.push(['Livestream', '']);
    (item.tags || []).slice(0, 3).forEach(tag => labels.push([tag, '']));
    return labels.map(([label, cls]) => `<span class="badge ${cls}">${escapeHTML(label)}</span>`).join('');
  }

  function isSaved(id) {
    return savedOfficialIds.includes(id);
  }

  function toggleSaved(id) {
    const event = events().find(item => item.id === id);
    if (event?.photoOp) {
      openPhotoPlanDialog(event);
      return;
    }
    if (isSaved(id)) savedOfficialIds = savedOfficialIds.filter(value => value !== id);
    else savedOfficialIds.push(id);
    savePlan();
    renderAllPlanViews();
  }

  function renderAllPlanViews() {
    renderMyFriday();
    renderBrowse();
    renderActivities();
    renderGuests();
  }

  function plannedOfficialEvent(event) {
    if (!event.photoOp) return { ...event, sourceType: 'official' };
    const override = eventOverrides[event.id] || {};
    const planStart = override.start || event.defaultPlanStart || event.start;
    const planEnd = override.end || event.defaultPlanEnd || undefined;
    return {
      ...event,
      sourceType: 'official',
      officialStart: event.start,
      officialEnd: event.end,
      start: planStart,
      end: planEnd,
      planNotes: override.notes || undefined
    };
  }

  function myFridayItems() {
    const official = events().filter(event => isSaved(event.id)).map(plannedOfficialEvent);
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
    const todos = myExhibitorTodos();
    const conflict = conflictInfo(items);
    const conflicts = conflict.ids;
    el('savedCount').textContent = String(items.length);
    el('todoCount').textContent = String(todos.filter(item => !exhibitorDone[exhibitorId(item)]).length);
    el('conflictCount').textContent = String(conflict.pairs);
    list.innerHTML = '';

    if (!items.length) {
      list.innerHTML = `<div class="empty-state compact-empty"><h3>No timed plans yet</h3><p>Save Friday panels, photo ops and activities to build the timed part of your day.</p><button id="emptyBrowseBtn" class="primary" type="button">Browse Friday events</button></div>`;
      el('emptyBrowseBtn').addEventListener('click', () => switchTab('browse'));
    } else {
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

        const savedBadges = item.sourceType === 'official' ? flagBadges(item) : '';
        const savedGuestLine = item.guests?.length
          ? `<div class="saved-event-guests"><strong>Guests:</strong> ${escapeHTML(item.guests.join(', '))}</div>`
          : '';
        const savedDescription = item.description
          ? `<div class="saved-event-description">${escapeHTML(compactDescription(item.description, 520))}</div>`
          : '';
        const photoPlanInfo = item.photoOp
          ? `<div class="photo-plan-note"><strong>Official session:</strong> ${escapeHTML(photoOfficialLabel({ ...item, start: item.officialStart || item.start }))}${item.planNotes ? ` · ${escapeHTML(item.planNotes)}` : ''}</div>`
          : '';

        body.innerHTML = `
          ${conflicts.has(item.id) ? '<span class="conflict-label">TIME CONFLICT</span>' : ''}
          <div class="event-title">${escapeHTML(item.title || 'Untitled item')}</div>
          <div class="event-meta">${escapeHTML(eventLocationLabel(item))}</div>
          ${item.category ? `<div class="event-notes saved-event-category">${escapeHTML(item.category)}</div>` : ''}
          ${savedBadges ? `<div class="badge-row saved-event-badges">${savedBadges}</div>` : ''}
          ${savedGuestLine}
          ${savedDescription}
          ${item.notes ? `<div class="event-notes">${escapeHTML(item.notes)}</div>` : ''}
          ${photoPlanInfo}
        `;

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
        if (item.photoOp && item.sourceType === 'official') {
          const editTime = document.createElement('button');
          editTime.className = 'secondary';
          editTime.type = 'button';
          editTime.textContent = 'Edit my time';
          editTime.addEventListener('click', () => {
            const original = events().find(event => event.id === item.id);
            if (original) openPhotoPlanDialog(original);
          });
          actions.appendChild(editTime);
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
          if (item.sourceType === 'official') { savedOfficialIds = savedOfficialIds.filter(id => id !== item.id); delete eventOverrides[item.id]; }
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

    const todoList = el('fridayTodoList');
    todoList.innerHTML = '';
    if (!todos.length) {
      todoList.innerHTML = `<div class="empty-state compact-empty"><h3>No booth stops saved</h3><p>Save exhibitors or Artist Alley stops as untimed Friday to-dos. They won't create schedule conflicts.</p><button id="emptyExhibitorsBtn" class="secondary" type="button">Browse exhibitors</button></div>`;
      el('emptyExhibitorsBtn').addEventListener('click', () => switchTab('exhibitors'));
      return;
    }

    todos.forEach(item => {
      const id = savedExhibitorTodoId(item);
      const done = Boolean(exhibitorDone[id]);
      const card = document.createElement('article');
      card.className = `todo-card${done ? ' done' : ''}`;

      const check = document.createElement('label');
      check.className = 'todo-check';
      check.innerHTML = `<input type="checkbox" ${done ? 'checked' : ''}><span class="todo-box" aria-hidden="true"></span><span class="sr-only">${done ? 'Mark not done' : 'Mark done'}</span>`;
      check.querySelector('input').addEventListener('change', event => setExhibitorDone(item, event.target.checked));

      const body = document.createElement('div');
      body.className = 'todo-body';
      const spot = exhibitorSpotLabel(item);
      body.innerHTML = `<div class="event-title">${escapeHTML(item.name)}</div><div class="event-meta">${escapeHTML(spot)}</div>${item.category ? `<div class="event-notes">${escapeHTML(item.category)}</div>` : ''}`;

      const actions = document.createElement('div');
      actions.className = 'event-actions';
      const mappedBooths = mappedExhibitorBooths(item);
      if (mappedBooths.length) {
        mappedBooths.slice(0, 3).forEach((booth, index) => {
          const nav = document.createElement('button');
          nav.className = index === 0 ? 'primary' : 'secondary';
          nav.type = 'button';
          nav.textContent = mappedBooths.length === 1 ? 'Navigate' : `Navigate #${booth}`;
          nav.addEventListener('click', () => navigateToItem({ booth }));
          actions.appendChild(nav);
        });
        const mapBtn = document.createElement('button');
        mapBtn.className = 'secondary';
        mapBtn.type = 'button';
        mapBtn.textContent = mappedBooths.length === 1 ? 'Map' : `Map ${mappedBooths.length} booths`;
        mapBtn.addEventListener('click', () => showExhibitorBoothsOnMap(mappedBooths));
        actions.appendChild(mapBtn);
      } else if (item.locationId) {
        const nav = document.createElement('button');
        nav.className = 'primary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem(item));
        actions.appendChild(nav);
      }
      const remove = document.createElement('button');
      remove.className = 'secondary';
      remove.type = 'button';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => toggleExhibitorTodo(item));
      actions.appendChild(remove);

      card.append(check, body, actions);
      todoList.appendChild(card);
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

  function populateExhibitorTags() {
    const select = el('exhibitorTag');
    [...new Set(exhibitors().flatMap(item => item.tags || []).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b))
      .forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
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
        <div class="browse-card-top"><div><span class="eyebrow">${escapeHTML(event.photoOp ? `OFFICIAL SESSION · ${photoOfficialLabel(event)}` : timeRange(event))}</span><h3>${escapeHTML(event.title)}</h3></div><span class="category-pill">${escapeHTML(event.category || 'Programming')}</span></div>
        <p class="location-line">${escapeHTML(eventLocationLabel(event))}</p>
        <div class="badge-row">${flagBadges(event)}</div>
        <p>${escapeHTML(compactDescription(event.description || ''))}</p>
        ${guestLine}
        <div class="card-actions"></div>`;
      const actions = card.querySelector('.card-actions');
      const save = document.createElement('button');
      save.className = isSaved(event.id) ? 'saved-button' : 'primary';
      save.type = 'button';
      save.textContent = event.photoOp ? (isSaved(event.id) ? 'Edit my time' : '+ Plan photo op') : (isSaved(event.id) ? '✓ Saved' : '+ My Friday');
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

  function activityEventIds(activity) {
    return [...new Set([...(activity.eventIds || []), ...(activity.eventId ? [activity.eventId] : [])])];
  }

  function createTimedItemRows(ids) {
    const matches = ids.map(id => events().find(event => event.id === id)).filter(Boolean).sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99'));
    if (!matches.length) return null;
    const wrap = document.createElement('div');
    wrap.className = 'timed-items';
    const heading = document.createElement('div');
    heading.className = 'timed-items-heading';
    heading.textContent = 'Timed Friday items';
    wrap.appendChild(heading);
    matches.forEach(event => {
      const row = document.createElement('div');
      row.className = 'timed-item-row';
      const info = document.createElement('div');
      info.className = 'timed-item-info';
      info.innerHTML = `<strong>${escapeHTML(event.photoOp ? photoOfficialLabel(event) : formatTime(event.start))}</strong><span>${escapeHTML(event.title)}</span>`;
      const save = document.createElement('button');
      save.type = 'button';
      save.className = isSaved(event.id) ? 'saved-button mini-save' : 'secondary mini-save';
      save.textContent = event.photoOp ? (isSaved(event.id) ? 'Edit time' : '+ Plan') : (isSaved(event.id) ? '✓ Saved' : '+ Save');
      save.addEventListener('click', () => toggleSaved(event.id));
      row.append(info, save);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function planActivity(activity) {
    openEventDialog({
      title: activity.name,
      locationId: activity.locationId,
      notes: `${activity.hours || 'Friday activity'}${activity.location ? ` · ${activity.location}` : ''}`
    });
  }

  function renderActivities() {
    const list = el('activitiesList');
    list.innerHTML = '';
    activities().forEach(activity => {
      const card = document.createElement('article');
      card.className = 'browse-card';
      card.innerHTML = `<div class="browse-card-top"><div><span class="eyebrow">${escapeHTML(activity.hours || 'Friday')}</span><h3>${escapeHTML(activity.name)}</h3></div></div><p class="location-line">${escapeHTML(activity.location || eventLocationLabel(activity))}</p><p>${escapeHTML(activity.description || '')}</p>${activity.highlights?.length ? `<ul class="compact-list">${activity.highlights.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>` : ''}`;

      const timed = createTimedItemRows(activityEventIds(activity));
      if (timed) card.appendChild(timed);

      const actions = document.createElement('div');
      actions.className = 'card-actions';
      const plan = document.createElement('button');
      plan.className = 'primary';
      plan.type = 'button';
      plan.textContent = '+ Plan a visit';
      plan.title = 'Choose your own Friday start/end time for this activity';
      plan.addEventListener('click', () => planActivity(activity));
      actions.appendChild(plan);
      if (activity.locationId) {
        const nav = document.createElement('button');
        nav.className = 'secondary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem(activity));
        actions.appendChild(nav);
      }
      if (activity.sourceUrl) actions.appendChild(externalLink(activity.sourceUrl, 'Official info'));
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function guestBoothNumbers(guest) {
    return [...new Set((String(guest.booth || '').match(/\b\d{4}\b/g) || []))];
  }

  function guestPriceLine(guest) {
    const bits = [];
    if (guest.autographPrice) bits.push(`Autograph $${Number(guest.autographPrice).toFixed(0)}`);
    if (guest.photoOpPrice) bits.push(`Photo op $${Number(guest.photoOpPrice).toFixed(0)}`);
    if (guest.tablePhotoPrice) bits.push(`Table photo $${Number(guest.tablePhotoPrice).toFixed(0)}`);
    return bits.join(' · ');
  }

  function allGuestRecords() {
    const eventByScheduleId = new Map(
      events().filter(event => event.scheduleId).map(event => [String(event.scheduleId), event])
    );
    const eventsByGuestName = new Map();

    events().forEach(event => {
      (event.guests || []).forEach(name => {
        const key = String(name || '').trim().toLowerCase();
        if (!key) return;
        if (!eventsByGuestName.has(key)) eventsByGuestName.set(key, []);
        eventsByGuestName.get(key).push(event);
      });
    });

    return officialGuests().map(guest => {
      const matches = [];
      const seen = new Set();

      (guest.fridayScheduleIds || []).forEach(scheduleId => {
        const event = eventByScheduleId.get(String(scheduleId));
        if (event && !seen.has(event.id)) {
          matches.push(event);
          seen.add(event.id);
        }
      });

      [guest.name, guest.altName].filter(Boolean).forEach(name => {
        (eventsByGuestName.get(String(name).toLowerCase()) || []).forEach(event => {
          if (!seen.has(event.id)) {
            matches.push(event);
            seen.add(event.id);
          }
        });
      });

      matches.sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99') || a.title.localeCompare(b.title));

      return {
        ...guest,
        eventIds: matches.map(event => event.id),
        eventTitles: matches.map(event => event.title),
        fridayRelevant: Boolean(guest.fridayRelevant || matches.length),
        hasPhotoOp: matches.some(event => event.photoOp || event.category === 'Photo Op') || (guest.categories || []).includes('Autographing and Photo Ops'),
        hasAutograph: matches.some(event => /autograph|signing/i.test(event.title)) || (guest.categories || []).includes('Autographing and Photo Ops')
      };
    });
  }

  function guestMatchesFilter(guest, filter) {
    const activeFriday = guest.fridayRelevant && !guest.canceled;
    if (filter === 'featured') return activeFriday && guest.featured;
    if (filter === 'photoops') return activeFriday && (guest.hasPhotoOp || guest.hasAutograph);
    if (filter === 'artist') return activeFriday && (guest.categories || []).includes('Artist Alley');
    if (filter === 'literary') return activeFriday && ((guest.categories || []).includes('Literary') || (guest.categories || []).includes('Writers Block'));
    if (filter === 'movies') return activeFriday && (guest.categories || []).includes('Movies/TV');
    if (filter === 'comics') return activeFriday && (guest.categories || []).includes('Comics');
    if (filter === 'canceled') return guest.canceled;
    if (filter === 'all') return !guest.canceled;
    return activeFriday;
  }

  function guestSearchText(guest) {
    return [
      guest.name, guest.altName, guest.type, guest.knownFor, guest.bio, guest.booth,
      ...(guest.days || []), ...(guest.categories || []), ...(guest.eventTitles || [])
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function guestImageElement(guest) {
    const wrap = document.createElement('div');
    wrap.className = 'guest-photo-wrap';

    const initials = String(guest.name || '?')
      .split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
    const fallback = document.createElement('div');
    fallback.className = 'guest-photo-fallback';
    fallback.textContent = initials || '?';
    wrap.appendChild(fallback);

    const src = guest.image?.med || guest.image?.small || guest.image?.big || guest.image?.thumb;
    if (src) {
      const img = document.createElement('img');
      img.className = 'guest-photo';
      img.src = src;
      img.alt = `${guest.name} — official NYCC guest photo`;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('load', () => wrap.classList.add('loaded'));
      img.addEventListener('error', () => img.remove());
      wrap.appendChild(img);
    }
    return wrap;
  }

  function guestNavigationTarget(guest) {
    const mappedBooth = guestBoothNumbers(guest).find(booth => window.NYCC_BOOTHS?.[booth]);
    if (mappedBooth) return { booth: mappedBooth };
    if (guest.locationId) return { locationId: guest.locationId };
    return null;
  }

  function renderGuests() {
    const query = el('guestSearch').value.trim().toLowerCase();
    const filter = el('guestFilter').value;
    const all = allGuestRecords();

    const filtered = all.filter(guest => {
      if (!guestMatchesFilter(guest, filter)) return false;
      if (query && !guestSearchText(guest).includes(query)) return false;
      return true;
    }).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));

    const fridayRelevant = all.filter(guest => guest.fridayRelevant).length;
    const activeFriday = all.filter(guest => guest.fridayRelevant && !guest.canceled).length;
    const shown = Math.min(filtered.length, guestRenderLimit);

    el('guestResultCount').textContent =
      `${shown} of ${filtered.length} matching guests shown · ${all.length} official guests indexed · ${activeFriday} active Friday-relevant (${fridayRelevant} including canceled)`;

    const list = el('guestList');
    list.innerHTML = '';

    filtered.slice(0, guestRenderLimit).forEach(guest => {
      const card = document.createElement('article');
      card.className = 'browse-card guest-card';

      card.appendChild(guestImageElement(guest));

      const body = document.createElement('div');
      body.className = 'guest-card-body';

      const header = document.createElement('div');
      header.className = 'browse-card-top';
      const heading = guest.featured ? (guest.fridayRelevant ? 'FEATURED FRIDAY GUEST' : 'FEATURED GUEST') : (guest.fridayRelevant ? 'FRIDAY GUEST' : 'OFFICIAL GUEST');
      header.innerHTML = `<div><span class="eyebrow">${heading}</span><h3>${escapeHTML(guest.name)}</h3></div><span class="category-pill">${escapeHTML(guest.type || 'Guest')}</span>`;
      body.appendChild(header);

      const badges = document.createElement('div');
      badges.className = 'badge-row guest-badges';
      if (guest.canceled) badges.innerHTML += '<span class="badge canceled">Canceled</span>';
      if (guest.guestOfHonor) badges.innerHTML += '<span class="badge important">Guest of Honor</span>';
      if (guest.days?.length) badges.innerHTML += `<span class="badge">${escapeHTML(guest.days.join(' · '))}</span>`;
      (guest.categories || []).filter(c => c !== 'Canceled').slice(0, 3).forEach(category => {
        badges.innerHTML += `<span class="badge">${escapeHTML(category)}</span>`;
      });
      if (badges.childNodes.length || badges.innerHTML) body.appendChild(badges);

      if (guest.knownFor) {
        const known = document.createElement('p');
        known.className = 'location-line guest-known-for';
        known.textContent = guest.knownFor;
        body.appendChild(known);
      }

      if (guest.booth) {
        const booth = document.createElement('p');
        booth.className = 'guest-meta-line';
        booth.innerHTML = `<strong>Location:</strong> ${escapeHTML(guest.booth)}`;
        body.appendChild(booth);
      }

      const priceLine = guestPriceLine(guest);
      if (priceLine) {
        const price = document.createElement('p');
        price.className = 'guest-meta-line';
        price.innerHTML = `<strong>Listed prices:</strong> ${escapeHTML(priceLine)}`;
        body.appendChild(price);
      }

      const timedEvents = (guest.eventIds || [])
        .map(id => events().find(event => event.id === id))
        .filter(Boolean)
        .sort((a, b) => (a.start || '99:99').localeCompare(b.start || '99:99'));

      if (timedEvents.length) {
        const details = document.createElement('details');
        details.className = 'guest-schedule-details';
        if (query || timedEvents.length <= 2) details.open = true;
        const summary = document.createElement('summary');
        summary.textContent = `Friday schedule (${timedEvents.length})`;
        details.appendChild(summary);
        const timed = createTimedItemRows(timedEvents.map(event => event.id));
        if (timed) details.appendChild(timed);
        body.appendChild(details);
      } else if (guest.fridayRelevant && !guest.canceled) {
        const note = document.createElement('p');
        note.className = 'data-note guest-no-time';
        note.textContent = 'Attending Friday, but no exact Friday time is listed in the captured schedule feeds.';
        body.appendChild(note);
      }

      if (guest.bio) {
        const bio = document.createElement('details');
        bio.className = 'guest-bio';
        const summary = document.createElement('summary');
        summary.textContent = 'About this guest';
        const p = document.createElement('p');
        p.textContent = guest.bio;
        bio.append(summary, p);
        body.appendChild(bio);
      }

      const actions = document.createElement('div');
      actions.className = 'card-actions guest-actions';

      const target = guestNavigationTarget(guest);
      if (target) {
        const nav = document.createElement('button');
        nav.className = 'secondary';
        nav.type = 'button';
        nav.textContent = target.booth ? `Navigate #${target.booth}` : 'Navigate';
        nav.addEventListener('click', () => navigateToItem(target));
        actions.appendChild(nav);
      }

      if (guest.profileUrl) actions.appendChild(externalLink(guest.profileUrl, 'NYCC profile'));
      if (guest.epicPhotoUrl) actions.appendChild(externalLink(guest.epicPhotoUrl, 'Photo ops'));
      body.appendChild(actions);

      card.appendChild(body);
      list.appendChild(card);
    });

    const more = el('guestLoadMoreBtn');
    more.hidden = shown >= filtered.length;
    more.textContent = `Show more (${filtered.length - shown} remaining)`;
  }

  function openExhibitorDialog() {
    el('exhibitorForm').reset();
    el('customExhibitorCategory').value = 'Exhibitor';
    el('exhibitorDialog').showModal();
    setTimeout(() => el('customExhibitorName').focus(), 0);
  }

  function closeExhibitorDialog() {
    if (el('exhibitorDialog').open) el('exhibitorDialog').close();
  }

  function saveCustomExhibitorFromForm() {
    const name = el('customExhibitorName').value.trim();
    if (!name) return;
    const booth = el('customExhibitorBooth').value.trim().toUpperCase();
    const category = el('customExhibitorCategory').value.trim() || 'Exhibitor';
    const note = el('customExhibitorNote').value.trim();
    const item = {
      id: `custom-exhibitor-${Date.now()}`,
      name,
      booth,
      category,
      note: note || 'Added manually from the official NYCC directory.',
      sourceUrl: 'https://www.newyorkcomiccon.com/en-us/exhibitors-and-artists/exhibitors.html',
      custom: true
    };
    customExhibitors.push(item);
    const id = exhibitorId(item);
    if (!exhibitorTodoIds.includes(id)) exhibitorTodoIds.push(id);
    exhibitorDone[id] = false;
    savePlan();
    renderExhibitors();
    renderMyFriday();
    closeExhibitorDialog();
    toast('Added exhibitor to Friday to-do');
  }

  function deleteCustomExhibitor(item) {
    if (!item?.custom) return;
    const id = exhibitorId(item);
    customExhibitors = customExhibitors.filter(entry => exhibitorId(entry) !== id);
    exhibitorTodoIds = exhibitorTodoIds.filter(value => value !== id);
    delete exhibitorDone[id];
    savePlan();
    renderExhibitors();
    renderMyFriday();
    toast('Custom exhibitor removed');
  }

  function exhibitorBadges(item) {
    const badges = [];
    if (item.featured) badges.push('<span class="badge important">Featured</span>');
    if (item.exclusives) badges.push('<span class="badge">Exclusives</span>');
    if (item.showSpecials) badges.push('<span class="badge">Show specials</span>');
    (item.tags || []).slice(0, 3).forEach(tag => badges.push(`<span class="badge">${escapeHTML(tag)}</span>`));
    return badges.join('');
  }

  function exhibitorSearchText(item) {
    const specials = (item.specials || []).flatMap(s => [s.title, s.description, s.price]);
    return [
      item.name, item.booth, item.artistTable, item.category, item.description, item.note,
      item.website, item.storeUrl, ...(item.tags || []), ...(item.categories || []),
      ...(item.aliases || []), ...specials
    ].filter(Boolean).join(' ').toLowerCase();
  }

  function renderExhibitorSpecials(item, host) {
    if (!item.specials?.length) return;
    const details = document.createElement('details');
    details.className = 'exhibitor-specials';
    const summary = document.createElement('summary');
    summary.textContent = `Exclusives / specials (${item.specials.length})`;
    details.appendChild(summary);

    const list = document.createElement('div');
    list.className = 'special-list';
    item.specials.forEach(special => {
      const row = document.createElement('div');
      row.className = 'special-item';
      const price = special.price ? `<span class="special-price">$${escapeHTML(special.price)}</span>` : '';
      row.innerHTML = `<div class="special-title">${escapeHTML(special.title || 'Show special')}${price}</div>${special.description ? `<div class="special-description">${escapeHTML(compactDescription(special.description, 360))}</div>` : ''}`;
      if (special.link) row.appendChild(externalLink(special.link, 'Item'));
      list.appendChild(row);
    });
    details.appendChild(list);
    host.appendChild(details);
  }

  function renderExhibitors() {
    const query = el('exhibitorSearch').value.trim().toLowerCase();
    const filter = el('exhibitorFilter').value;
    const tag = el('exhibitorTag').value;
    const all = exhibitors();

    const filtered = all.filter(item => {
      if (query && !exhibitorSearchText(item).includes(query)) return false;
      if (tag && !(item.tags || []).includes(tag)) return false;
      if (filter === 'featured' && !item.featured) return false;
      if (filter === 'exclusives' && !item.exclusives) return false;
      if (filter === 'specials' && !(item.specials?.length)) return false;
      if (filter === 'mapped' && !mappedExhibitorBooths(item).length && !item.locationId) return false;
      if (filter === 'saved' && !isExhibitorTodo(item)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    const officialCount = Array.isArray(window.NYCC_EXHIBITORS) ? window.NYCC_EXHIBITORS.length : 0;
    const extraCount = Array.isArray(window.NYCC_EXHIBITOR_EXTRAS) ? window.NYCC_EXHIBITOR_EXTRAS.length : 0;
    const shown = Math.min(filtered.length, exhibitorRenderLimit);
    el('exhibitorResultCount').textContent =
      `${shown} of ${filtered.length} matching entries shown · ${officialCount} official exhibitors${extraCount ? ` + ${extraCount} supplemental artist/cosplay stops` : ''}`;

    const list = el('exhibitorList');
    list.innerHTML = '';

    filtered.slice(0, exhibitorRenderLimit).forEach(item => {
      const card = document.createElement('article');
      card.className = 'browse-card exhibitor-card';
      const spot = exhibitorSpotLabel(item);
      const saved = isExhibitorTodo(item);
      const done = Boolean(exhibitorDone[savedExhibitorTodoId(item)]);
      const isOfficial = item.sourceKind === 'official-feed';
      const sourceBadge = item.custom ? 'MY ENTRY' : isOfficial ? 'OFFICIAL NYCC' : 'SUPPLEMENTAL';
      const eyebrow = item.tags?.[0] || item.category || item.categories?.[0] || 'EXHIBITOR';
      const boothLabel = item.booth ? `<span class="booth-pill">${escapeHTML(item.booth)}</span>` : '';

      card.innerHTML = `
        <div class="browse-card-top">
          <div><span class="eyebrow">${escapeHTML(eyebrow)}</span><h3>${escapeHTML(item.name)}</h3></div>
          ${boothLabel}
        </div>
        <div class="source-status">${sourceBadge}</div>
        <p class="location-line">${escapeHTML(spot)}</p>
        <div class="badge-row">${exhibitorBadges(item)}</div>
        ${item.description ? `<p>${escapeHTML(compactDescription(item.description, 420))}</p>` : item.note ? `<p>${escapeHTML(item.note)}</p>` : ''}
        ${saved ? `<div class="todo-status ${done ? 'done' : ''}">${done ? '✓ Visited / done' : '★ On Friday to-do'}</div>` : ''}
        <div class="card-actions"></div>`;

      renderExhibitorSpecials(item, card);
      const actions = card.querySelector('.card-actions');

      const todo = document.createElement('button');
      todo.className = saved ? 'saved-button' : 'primary';
      todo.type = 'button';
      todo.textContent = saved ? '✓ Saved to-do' : '+ Friday to-do';
      todo.addEventListener('click', () => toggleExhibitorTodo(item));
      actions.appendChild(todo);

      const mappedBooths = mappedExhibitorBooths(item);
      if (mappedBooths.length) {
        const map = document.createElement('button');
        map.className = 'secondary';
        map.type = 'button';
        map.textContent = mappedBooths.length === 1 ? `Map #${mappedBooths[0]}` : `Map ${mappedBooths.length} booths`;
        map.addEventListener('click', () => showExhibitorBoothsOnMap(mappedBooths));
        actions.appendChild(map);

        const nav = document.createElement('button');
        nav.className = 'secondary';
        nav.type = 'button';
        nav.textContent = mappedBooths.length === 1 ? 'Navigate' : `Navigate #${mappedBooths[0]}`;
        nav.title = mappedBooths.length > 1 ? `Routes to the first mapped show-floor booth, #${mappedBooths[0]}` : '';
        nav.addEventListener('click', () => navigateToItem({ booth: mappedBooths[0] }));
        actions.appendChild(nav);
      } else if (item.locationId) {
        const nav = document.createElement('button');
        nav.className = 'secondary';
        nav.type = 'button';
        nav.textContent = 'Navigate';
        nav.addEventListener('click', () => navigateToItem(item));
        actions.appendChild(nav);
      }

      if (item.website) actions.appendChild(externalLink(item.website, 'Website'));
      if (item.storeUrl && item.storeUrl !== item.website) actions.appendChild(externalLink(item.storeUrl, 'Store'));
      if (item.sourceUrl && !item.website && !item.storeUrl) actions.appendChild(externalLink(item.sourceUrl, 'NYCC directory'));

      if (item.custom) {
        const removeCustom = document.createElement('button');
        removeCustom.className = 'secondary danger-outline';
        removeCustom.type = 'button';
        removeCustom.textContent = 'Delete my entry';
        removeCustom.addEventListener('click', () => deleteCustomExhibitor(item));
        actions.appendChild(removeCustom);
      }
      list.appendChild(card);
    });

    const more = el('exhibitorLoadMoreBtn');
    more.hidden = shown >= filtered.length;
    more.textContent = `Show more (${filtered.length - shown} remaining)`;
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
    activeBooths = activeBooth ? [activeBooth] : [];
    destinationId = item.locationId || (item.booth ? 'l3_show_floor' : destinationId);
    if (!window.NYCC_LOCATIONS[destinationId]) return;
    el('destinationSelect').value = destinationId;
    buildAndRenderRoute();
    switchTab('navigate');
  }

  function showBoothOnMap(booth) {
    showExhibitorBoothsOnMap([booth]);
  }

  function showExhibitorBoothsOnMap(booths) {
    activeBooths = [...new Set((booths || []).filter(booth => window.NYCC_BOOTHS?.[booth]))];
    activeBooth = activeBooths[0] || null;
    if (!activeBooth) return;
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
          activeBooths = [];
          destinationId = id;
          el('destinationSelect').value = id;
          buildAndRenderRoute();
          toast(`Destination: ${loc.name}`);
        });
        markers.appendChild(button);
      });

    if (activeBooths.length && activeMap === 'showfloor') {
      activeBooths.forEach(boothNumber => {
        const booth = window.NYCC_BOOTHS?.[boothNumber];
        if (!booth) return;
        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'map-marker booth';
        marker.style.left = `${booth.x}%`;
        marker.style.top = `${booth.y}%`;
        marker.setAttribute('aria-label', `Booth ${boothNumber}`);
        marker.title = `Booth ${boothNumber}`;
        markers.appendChild(marker);
      });
    }

    const legend = [];
    if (current?.map === activeMap) legend.push('<span><i class="legend-dot current"></i>Your selected indoor start</span>');
    if (!activeBooth && destination?.map === activeMap) legend.push('<span><i class="legend-dot destination"></i>Destination</span>');
    if (activeBooths.length && activeMap === 'showfloor') legend.push(`<span><i class="legend-dot booth"></i>${activeBooths.length === 1 ? `Booth ${escapeHTML(activeBooths[0])}` : `${activeBooths.length} exhibitor booths`}</span>`);
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
    activeBooths = [booth];
    destinationId = 'l3_show_floor';
    el('destinationSelect').value = destinationId;
    activeMap = 'showfloor';
    el('mapSelect').value = activeMap;
    msg.textContent = `Booth ${booth} found. Red marker added.`;
    renderMap();
  }

  function openPhotoPlanDialog(event) {
    if (!event?.photoOp) return;
    const override = eventOverrides[event.id] || {};
    el('photoPlanEventId').value = event.id;
    el('photoOfficialInfo').innerHTML = `<strong>${escapeHTML(event.title)}</strong><span>Official listed window: ${escapeHTML(photoOfficialLabel(event))} · ${escapeHTML(eventLocationLabel(event))}</span>`;
    el('photoPlanStart').value = override.start || event.defaultPlanStart || (event.officialWindow ? '' : (event.start || ''));
    el('photoPlanEnd').value = override.end || event.defaultPlanEnd || (event.officialWindow ? '' : (event.start ? addMinutesToTime(event.start, Number.isFinite(event.durationMinutes) ? event.durationMinutes : 10) : ''));
    el('photoPlanNotes').value = override.notes || '';
    el('removePhotoPlanBtn').hidden = !isSaved(event.id);
    el('photoPlanDialog').showModal();
  }

  function closePhotoPlanDialog() {
    el('photoPlanDialog').close();
  }

  function savePhotoPlanFromForm() {
    const id = el('photoPlanEventId').value;
    const event = events().find(item => item.id === id);
    if (!event?.photoOp) return;
    const start = el('photoPlanStart').value;
    const end = el('photoPlanEnd').value;
    const notes = el('photoPlanNotes').value.trim();
    if (!start) { toast('Set the time you need to go or queue'); return; }
    if (end && minutes(end) <= minutes(start)) { toast('Block-until time must be after your go time'); return; }
    eventOverrides[id] = { start, end: end || undefined, notes: notes || undefined };
    if (!isSaved(id)) savedOfficialIds.push(id);
    savePlan();
    renderAllPlanViews();
    closePhotoPlanDialog();
    toast('Photo op added to My Friday with your time');
  }

  function removePhotoPlan() {
    const id = el('photoPlanEventId').value;
    savedOfficialIds = savedOfficialIds.filter(value => value !== id);
    delete eventOverrides[id];
    savePlan();
    renderAllPlanViews();
    closePhotoPlanDialog();
    toast('Photo op removed from My Friday');
  }

  function openEventDialog(prefill = {}) {
    el('eventForm').reset();
    el('eventTitle').value = prefill.title || '';
    el('eventStart').value = prefill.start || '';
    el('eventEnd').value = prefill.end || '';
    el('eventLocation').value = prefill.locationId || '';
    el('eventBooth').value = prefill.booth || '';
    el('eventNotes').value = prefill.notes || '';
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
    const data = JSON.stringify({ version: 5, date: FRIDAY, savedOfficialIds, eventOverrides, personalEvents, exhibitorTodoIds, exhibitorDone, customExhibitors }, null, 2);
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
          eventOverrides = parsed.eventOverrides && typeof parsed.eventOverrides === 'object' && !Array.isArray(parsed.eventOverrides) ? parsed.eventOverrides : {};
          exhibitorTodoIds = Array.isArray(parsed.exhibitorTodoIds) ? parsed.exhibitorTodoIds.filter(id => typeof id === 'string') : [];
          exhibitorDone = parsed.exhibitorDone && typeof parsed.exhibitorDone === 'object' && !Array.isArray(parsed.exhibitorDone) ? parsed.exhibitorDone : {};
          customExhibitors = Array.isArray(parsed.customExhibitors) ? parsed.customExhibitors.filter(item => item && item.name).map(item => ({ ...item, custom: true })) : [];
        } else throw new Error('Invalid plan');
        savePlan();
        renderMyFriday();
        renderBrowse();
        renderExhibitors();
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
      navigator.serviceWorker.register('./sw.js?v=17').catch(() => { el('offlineBadge').textContent = 'Friday-first · Online only'; });
    } else el('offlineBadge').textContent = 'Friday-first · Online only';
  }

  function wireEvents() {
    document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
    el('addEventBtn').addEventListener('click', openEventDialog);
    el('closeDialogBtn').addEventListener('click', closeEventDialog);
    el('cancelEventBtn').addEventListener('click', closeEventDialog);
    el('eventForm').addEventListener('submit', event => { event.preventDefault(); saveEventFromForm(); });
  el('photoPlanForm').addEventListener('submit', event => { event.preventDefault(); savePhotoPlanFromForm(); });
  el('closePhotoPlanBtn').addEventListener('click', closePhotoPlanDialog);
  el('cancelPhotoPlanBtn').addEventListener('click', closePhotoPlanDialog);
  el('removePhotoPlanBtn').addEventListener('click', removePhotoPlan);
    el('browseFridayBtn').addEventListener('click', () => switchTab('browse'));
    el('browseExhibitorsBtn').addEventListener('click', () => switchTab('exhibitors'));
    el('exportBtn').addEventListener('click', exportPlan);
    el('importInput').addEventListener('change', event => importPlan(event.target.files[0]));
    el('eventSearch').addEventListener('input', renderBrowse);
    el('eventCategory').addEventListener('change', renderBrowse);
    el('guestSearch').addEventListener('input', () => { guestRenderLimit = 60; renderGuests(); });
    el('guestFilter').addEventListener('change', () => { guestRenderLimit = 60; renderGuests(); });
    el('guestLoadMoreBtn').addEventListener('click', () => { guestRenderLimit += 60; renderGuests(); });
    el('exhibitorSearch').addEventListener('input', () => { exhibitorRenderLimit = 80; renderExhibitors(); });
    el('exhibitorFilter').addEventListener('change', () => { exhibitorRenderLimit = 80; renderExhibitors(); });
    el('exhibitorTag').addEventListener('change', () => { exhibitorRenderLimit = 80; renderExhibitors(); });
    el('exhibitorLoadMoreBtn').addEventListener('click', () => { exhibitorRenderLimit += 80; renderExhibitors(); });
    el('addMissingExhibitorBtn').addEventListener('click', openExhibitorDialog);
    el('closeExhibitorDialogBtn').addEventListener('click', closeExhibitorDialog);
    el('cancelExhibitorBtn').addEventListener('click', closeExhibitorDialog);
    el('exhibitorForm').addEventListener('submit', event => { event.preventDefault(); saveCustomExhibitorFromForm(); });

    el('currentLocationSelect').addEventListener('change', () => {
      currentLocationId = el('currentLocationSelect').value;
      localStorage.setItem(STORAGE_START, currentLocationId);
      renderMap();
    });
    el('destinationSelect').addEventListener('change', () => {
      activeBooth = null;
      activeBooths = [];
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
