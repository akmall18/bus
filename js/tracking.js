(function (window) {
  'use strict';

  const Data = window.SmartShuttleData;
  const Storage = window.SmartShuttleStorage;
  const Notifications = window.SmartShuttleNotifications;
  const TrackingData = window.SmartShuttleTrackingData;

  const TICK_MS = 500;

  const state = {
    initialized: false,
    activeTrip: null,
    routeMap: null,
    progress: 0,
    running: false,
    timer: null,
    lookupTimer: null,
    lookupToken: 0,
    arrivedAnnounced: false,
    startNotified: false,
    delayNotified: false,
    approachingNotified: false,
    delayMinutes: 0,
    speedMultiplier: 1,
    lastTickAt: 0,
    mapMode: 'none',
    map: null,
    mapBusMarker: null,
    mapTraveledLine: null,
    mapRouteLine: null,
    mapPoint: null,
    mapStatusSet: false,
    fallbackBus: null,
    fallbackTraveled: null,
    fallbackStops: [],
    fallbackProject: null,
    fallbackPoint: null
  };

  const elements = {};

  function get(id) {
    return document.getElementById(id);
  }

  function escape(value) {
    return Notifications.escapeHTML(value);
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function formatNowWithSeconds() {
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  function setError(message) {
    if (elements.code) {
      elements.code.classList.toggle('is-invalid', Boolean(message));
      if (message) {
        elements.code.setAttribute('aria-invalid', 'true');
      } else {
        elements.code.removeAttribute('aria-invalid');
      }
    }
    if (!elements.error) {
      return;
    }
    elements.error.textContent = message || '';
    elements.error.hidden = !message;
  }

  function setLookupLoading(isLoading) {
    if (!elements.submit) {
      return;
    }
    elements.submit.disabled = isLoading;
    elements.submit.classList.toggle('is-loading', isLoading);
    elements.submit.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    const label = elements.submit.querySelector('.btn__label');
    if (label) {
      label.textContent = isLoading ? 'Mencari tiket...' : 'Lacak Bus';
    }
  }

  function setMapStatus(message) {
    if (elements.mapStatus) {
      elements.mapStatus.textContent = message;
    }
  }

  function populateDemoCodes() {
    if (!elements.demoList) {
      return;
    }
    elements.demoList.innerHTML = '';

    Data.DEMO_TRIPS.forEach((trip) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'demo-code-button';
      button.setAttribute('data-code', trip.code);
      button.innerHTML = `
        <span class="demo-code-button__code">${escape(trip.code)}</span>
        <span class="demo-code-button__route">${escape(trip.route.originName)} → ${escape(trip.route.destinationName)}</span>
      `;
      button.addEventListener('click', () => {
        if (elements.code) {
          elements.code.value = trip.code;
        }
        setError('');
        performLookup(trip.code);
      });
      elements.demoList.appendChild(button);
    });
  }

  function normalizeDemoTrip(trip) {
    return {
      code: trip.code,
      route: trip.route,
      schedule: trip.schedule,
      travelDate: trip.travelDate,
      busName: trip.busName,
      busClass: trip.busClass,
      plate: trip.plate,
      driverName: trip.driverName,
      operatorName: trip.schedule.operatorName || trip.schedule.busName,
      note: trip.note,
      sourceLabel: 'Perjalanan demo'
    };
  }

  function normalizeStoredBooking(booking) {
    const route = Data.getRoute(booking.originId, booking.destinationId) || Data.getRouteById(booking.routeId);
    const schedule = Data.getSchedule(booking.scheduleId);

    if (!route) {
      return null;
    }

    return {
      code: booking.code,
      route,
      schedule: schedule || {
        departure: booking.departure,
        arrival: booking.arrival,
        arrivalDayOffset: booking.arrivalDayOffset || 0,
        durationMinutes: booking.durationMinutes,
        busName: booking.busName,
        busClass: booking.busClass,
        plate: booking.plate,
        driverName: booking.driverName,
        operatorName: booking.operatorName || booking.busName
      },
      travelDate: booking.travelDate,
      busName: booking.busName,
      busClass: booking.busClass,
      plate: booking.plate,
      driverName: booking.driverName || 'Pengemudi demo',
      operatorName: booking.operatorName || (schedule && schedule.operatorName) || booking.busName,
      note: 'Tiket demo yang tersimpan di browser ini',
      sourceLabel: 'Tiket tersimpan'
    };
  }

  function clearTimer() {
    if (state.timer) {
      window.clearInterval(state.timer);
      state.timer = null;
    }
  }

  function stopSimulation() {
    clearTimer();
    state.running = false;
    if (state.activeTrip) {
      updateDynamicUI();
      return;
    }
    updateToggleButton();
  }

  function getSimulationSeconds() {
    return state.routeMap ? state.routeMap.simulationSeconds : 60;
  }

  function getDurationMinutes() {
    if (!state.activeTrip) {
      return 0;
    }
    return Number(state.activeTrip.schedule.durationMinutes) ||
      Number(state.activeTrip.route.durationMinutes) ||
      0;
  }

  function notifyTripEvent(name, type, title, message, showToast) {
    if (!state.activeTrip || !Notifications || typeof Notifications.notify !== 'function') {
      return null;
    }

    return Notifications.notify({
      type,
      title,
      message,
      eventKey: `tracking-${name}:${state.activeTrip.code}:${state.activeTrip.travelDate}`,
      code: state.activeTrip.code,
      toast: showToast === true
    });
  }

  function getStops() {
    if (!state.activeTrip) {
      return [];
    }

    const trip = state.activeTrip;
    const duration = getDurationMinutes();

    if (state.routeMap && trip.schedule && trip.schedule.departure) {
      return state.routeMap.stops.map((stop) => {
        const time = Data.addMinutesToTime(trip.schedule.departure, Math.round(duration * stop.offset));
        return {
          name: stop.name,
          offset: stop.offset,
          time: time.time,
          dayOffset: time.dayOffset
        };
      });
    }

    return Data.getTripStops(trip.route, trip.schedule);
  }

  function getStatus() {
    if (state.progress >= 100) {
      return { key: 'arrived', label: 'Tiba di tujuan' };
    }
    if (state.progress >= 82) {
      return { key: 'almost', label: 'Mendekati tujuan' };
    }
    if (state.progress <= 0) {
      return { key: 'scheduled', label: 'Belum berangkat' };
    }
    return { key: 'transit', label: 'Dalam perjalanan' };
  }

  function getNextStop() {
    if (!state.activeTrip) {
      return null;
    }
    const stops = getStops();
    if (!stops.length) {
      return null;
    }
    if (state.progress <= 0) {
      return stops[0];
    }
    return stops.find((stop) => state.progress < (stop.offset * 100)) || stops[stops.length - 1];
  }

  function getSpeed() {
    if (!state.running || state.progress >= 100) {
      return 0;
    }
    const route = state.activeTrip.route;
    const durationHours = Math.max(0.1, getDurationMinutes() / 60);
    const average = route.distanceKm / durationHours;
    const wave = Math.abs(Math.sin(state.progress / 9));
    return Math.round(Math.max(20, average + (wave * 6) - 3));
  }

  function getRemainingMinutes(progress) {
    if (progress >= 100) {
      return 0;
    }
    return Math.max(0, Math.ceil(getDurationMinutes() * (1 - (progress / 100))) + state.delayMinutes);
  }

  function getEta(progress) {
    const remainingMinutes = getRemainingMinutes(progress);
    if (remainingMinutes <= 0) {
      return {
        value: 'Tiba',
        clock: 'Tiba',
        remaining: 'Tiba',
        caption: 'Bus telah tiba di tujuan pada simulasi ini.'
      };
    }

    const arrival = Data.addMinutesToTime(Data.getNowTime(), remainingMinutes);
    const suffix = arrival.dayOffset === 1
      ? ' besok'
      : (arrival.dayOffset > 1 ? ` +${arrival.dayOffset} hari` : '');

    return {
      value: `± ${Data.formatDuration(remainingMinutes)}`,
      clock: `${arrival.time}${suffix}`,
      remaining: `± ${Data.formatDuration(remainingMinutes)}`,
      caption: `Perkiraan tiba pukul ${arrival.time}${suffix} berdasarkan sisa progres simulasi.`
    };
  }

  function updateToggleButton() {
    if (!elements.toggle) {
      return;
    }

    const use = elements.toggle.querySelector('use');
    const label = elements.toggle.querySelector('.btn__label');
    let text = 'Mulai simulasi';
    let icon = '#icon-play';

    if (state.progress >= 100) {
      text = 'Perjalanan selesai';
      icon = '#icon-check-circle';
      elements.toggle.disabled = true;
    } else if (state.running) {
      text = 'Jeda simulasi';
      icon = '#icon-pause';
      elements.toggle.disabled = false;
    } else if (state.progress > 0) {
      text = 'Lanjutkan simulasi';
      icon = '#icon-play';
      elements.toggle.disabled = false;
    } else {
      elements.toggle.disabled = false;
    }

    if (label) {
      label.textContent = text;
    }
    if (use) {
      use.setAttribute('href', icon);
    }
    elements.toggle.setAttribute('aria-pressed', state.running ? 'true' : 'false');
  }

  function renderStops() {
    if (!elements.stops || !state.activeTrip) {
      return;
    }
    elements.stops.innerHTML = '';
    const stops = getStops();

    stops.forEach((stop) => {
      const item = document.createElement('li');
      item.className = 'stop-item';
      item.setAttribute('data-offset', String(stop.offset * 100));
      item.innerHTML = `
        <span class="stop-marker" aria-hidden="true">
          <span class="stop-marker__dot"></span>
        </span>
        <div class="stop-copy">
          <div class="stop-heading">
            <span class="stop-name">${escape(stop.name)}</span>
            <span class="stop-time">${escape(stop.time)}${stop.dayOffset ? ' <small>+1 hari</small>' : ''}</span>
          </div>
          <span class="stop-status" data-stop-status>Menunggu</span>
        </div>
      `;
      elements.stops.appendChild(item);
    });
  }

  function updateStops() {
    if (!elements.stops) {
      return;
    }

    const items = Array.from(elements.stops.querySelectorAll('.stop-item'));
    let nextMarked = false;

    items.forEach((item, index) => {
      const offset = Number(item.getAttribute('data-offset'));
      const isDone = state.progress > offset || state.progress >= 100;
      const isNext = !isDone && !nextMarked;
      const status = item.querySelector('[data-stop-status]');
      const last = index === items.length - 1;

      item.classList.toggle('stop-item--done', isDone);
      item.classList.toggle('stop-item--next', isNext);

      if (status) {
        if (state.progress >= 100) {
          status.textContent = last ? 'Tiba' : 'Selesai';
        } else if (isDone) {
          status.textContent = 'Selesai';
        } else if (state.progress <= 0 && index === 0) {
          status.textContent = 'Titik awal';
          nextMarked = true;
        } else if (isNext) {
          status.textContent = 'Berikutnya';
          nextMarked = true;
        } else {
          status.textContent = 'Menunggu';
        }
      }
    });
  }

  function clearMap() {
    if (state.map) {
      try {
        state.map.off();
        state.map.remove();
      } catch (error) {
        state.map = null;
      }
    }

    state.map = null;
    state.mapBusMarker = null;
    state.mapTraveledLine = null;
    state.mapRouteLine = null;
    state.mapPoint = null;
    state.mapStatusSet = false;
    state.mapMode = 'none';
    state.fallbackBus = null;
    state.fallbackTraveled = null;
    state.fallbackStops = [];
    state.fallbackProject = null;
    state.fallbackPoint = null;

    if (elements.map) {
      elements.map.innerHTML = '';
      elements.map.hidden = false;
    }
    if (elements.mapFallback) {
      elements.mapFallback.innerHTML = '';
      elements.mapFallback.hidden = true;
    }
  }

  function buildSvgPath(points, project) {
    return points.map((point, index) => {
      const projected = project(point);
      return `${index === 0 ? 'M' : 'L'}${projected.x.toFixed(1)} ${projected.y.toFixed(1)}`;
    }).join(' ');
  }

  function renderFallback(message) {
    state.mapMode = 'fallback';
    setMapStatus(message || 'Mode peta sederhana · simulasi tetap berjalan');

    if (!elements.map || !elements.mapFallback) {
      return;
    }

    elements.map.hidden = true;
    elements.mapFallback.hidden = false;

    if (!state.routeMap) {
      elements.mapFallback.innerHTML = '<p class="map-fallback-empty">Peta rute belum tersedia. Simulasi status dan ETA tetap berjalan.</p>';
      return;
    }

    const width = 640;
    const height = 320;
    const padding = 38;
    const project = TrackingData.createProjection(state.routeMap, width, height, padding);
    const point = TrackingData.pointAtProgress(state.routeMap, state.progress) || {
      lat: state.routeMap.points[0][0],
      lng: state.routeMap.points[0][1]
    };
    const projectedBus = project([point.lat, point.lng]);
    const start = project(state.routeMap.points[0]);
    const end = project(state.routeMap.points[state.routeMap.points.length - 1]);
    const startAnchor = start.x > width / 2 ? 'end' : 'start';
    const endAnchor = end.x > width / 2 ? 'end' : 'start';
    const startLabelX = start.x + (startAnchor === 'end' ? -8 : 8);
    const endLabelX = end.x + (endAnchor === 'end' ? -8 : 8);
    const basePath = buildSvgPath(state.routeMap.points, project);
    const traveledPath = buildSvgPath(TrackingData.sliceAtProgress(state.routeMap, state.progress), project);
    const stops = state.routeMap.stops.map((stop) => {
      const stopPoint = TrackingData.pointAtProgress(state.routeMap, stop.offset * 100);
      const projected = project([stopPoint.lat, stopPoint.lng]);
      return `<circle class="map-stop" cx="${projected.x.toFixed(1)}" cy="${projected.y.toFixed(1)}" r="4.5"></circle>`;
    }).join('');

    elements.mapFallback.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Peta sederhana rute ${escape(state.routeMap.originName)} menuju ${escape(state.routeMap.destinationName)}">
        <path class="map-route-base" d="${basePath}"></path>
        <path class="map-route-traveled" d="${traveledPath}" data-map-traveled></path>
        ${stops}
        <circle class="map-stop map-stop--passed" cx="${start.x.toFixed(1)}" cy="${start.y.toFixed(1)}" r="4.5"></circle>
        <circle class="map-stop" cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="4.5"></circle>
        <text class="map-endpoint-label" x="${startLabelX.toFixed(1)}" y="${(start.y - 11).toFixed(1)}" text-anchor="${startAnchor}">${escape(state.routeMap.originName)}</text>
        <text class="map-endpoint-label" x="${endLabelX.toFixed(1)}" y="${(end.y - 11).toFixed(1)}" text-anchor="${endAnchor}">${escape(state.routeMap.destinationName)}</text>
        <g data-map-bus transform="translate(${projectedBus.x.toFixed(1)} ${projectedBus.y.toFixed(1)})">
          <circle class="map-bus-dot" r="14"></circle>
          <rect class="map-bus-icon" x="-6" y="-7" width="12" height="14" rx="2"></rect>
          <rect x="-4" y="-5" width="3" height="3" rx="0.7" fill="#1264E8"></rect>
          <rect x="1" y="-5" width="3" height="3" rx="0.7" fill="#1264E8"></rect>
          <rect x="-4" y="1" width="3" height="3" rx="0.7" fill="#1264E8"></rect>
          <rect x="1" y="1" width="3" height="3" rx="0.7" fill="#1264E8"></rect>
          <circle cx="-4" cy="8" r="1.6" fill="#1264E8"></circle>
          <circle cx="4" cy="8" r="1.6" fill="#1264E8"></circle>
        </g>
      </svg>
    `;

    state.fallbackProject = project;
    state.fallbackPoint = point;
    state.fallbackBus = elements.mapFallback.querySelector('[data-map-bus]');
    state.fallbackTraveled = elements.mapFallback.querySelector('[data-map-traveled]');
    state.fallbackStops = Array.from(elements.mapFallback.querySelectorAll('.map-stop'))
      .slice(0, state.routeMap.stops.length)
      .map((node, index) => ({
        node,
        offset: state.routeMap.stops[index].offset
      }));
  }

  function setupMap() {
    if (!elements.map || !elements.mapFallback) {
      return;
    }

    clearMap();
    state.mapMode = 'loading';
    setMapStatus('Menyiapkan peta...');

    if (!state.routeMap) {
      renderFallback('Peta rute tidak tersedia · simulasi tetap berjalan');
      return;
    }

    const L = window.L;
    if (!L || typeof L.map !== 'function') {
      renderFallback('Leaflet tidak tersedia · memakai peta sederhana');
      return;
    }

    try {
      state.mapMode = 'leaflet';
      state.map = L.map(elements.map, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false
      });

      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
      });

      tiles.once('tileerror', () => {
        if (!state.mapStatusSet) {
          state.mapStatusSet = true;
          setMapStatus('Sebagian tile OSM gagal dimuat · simulasi tetap berjalan');
        }
      });
      tiles.addTo(state.map);

      state.mapRouteLine = L.polyline(state.routeMap.points, {
        color: '#C9D9EA',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(state.map);

      state.mapTraveledLine = L.polyline([], {
        color: '#1264E8',
        weight: 5,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(state.map);

      const start = state.routeMap.points[0];
      const end = state.routeMap.points[state.routeMap.points.length - 1];

      L.circleMarker(start, {
        radius: 6,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#1264E8',
        fillOpacity: 1
      }).addTo(state.map).bindPopup(`<div class="map-popup"><strong>${escape(state.routeMap.originName)}</strong><span>Titik awal simulasi</span></div>`);

      L.circleMarker(end, {
        radius: 6,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#16A34A',
        fillOpacity: 1
      }).addTo(state.map).bindPopup(`<div class="map-popup"><strong>${escape(state.routeMap.destinationName)}</strong><span>Titik tujuan simulasi</span></div>`);

      const startPoint = TrackingData.pointAtProgress(state.routeMap, state.progress) || {
        lat: start[0],
        lng: start[1]
      };

      state.mapBusMarker = L.marker([startPoint.lat, startPoint.lng], {
        title: 'Posisi bus simulasi',
        keyboard: false,
        zIndexOffset: 800,
        icon: L.divIcon({
          className: 'bus-map-marker-wrap',
          html: '<span class="bus-map-marker"><svg class="icon" aria-hidden="true"><use href="#icon-bus"></use></svg></span>',
          iconSize: [42, 42],
          iconAnchor: [21, 21],
          popupAnchor: [0, -22]
        })
      }).addTo(state.map).bindPopup(`<div class="map-popup"><strong>${escape(state.activeTrip.busName)}</strong><span>Posisi bus simulasi · ${escape(state.routeMap.originName)} → ${escape(state.routeMap.destinationName)}</span></div>`);

      state.map.fitBounds(state.mapRouteLine.getBounds(), { padding: [28, 28] });
      setMapStatus('Peta aktif · OpenStreetMap');
      updateMap();

      window.setTimeout(() => {
        if (state.map) {
          state.map.invalidateSize();
        }
      }, 80);
    } catch (error) {
      clearMap();
      renderFallback('Peta interaktif tidak dapat dimuat · memakai peta sederhana');
    }
  }

  function updateMap() {
    if (!state.activeTrip) {
      return;
    }

    if (state.mapMode === 'leaflet' && state.map && state.mapBusMarker && state.routeMap) {
      const point = TrackingData.pointAtProgress(state.routeMap, state.progress);
      if (!point) {
        return;
      }
      state.mapPoint = point;
      state.mapBusMarker.setLatLng([point.lat, point.lng]);
      if (state.mapTraveledLine) {
        state.mapTraveledLine.setLatLngs(TrackingData.sliceAtProgress(state.routeMap, state.progress));
      }
      return;
    }

    if (state.mapMode === 'fallback' && state.routeMap && state.fallbackProject) {
      const point = TrackingData.pointAtProgress(state.routeMap, state.progress);
      if (!point || !state.fallbackBus) {
        return;
      }
      state.fallbackPoint = point;
      const projected = state.fallbackProject([point.lat, point.lng]);
      state.fallbackBus.setAttribute('transform', `translate(${projected.x.toFixed(1)} ${projected.y.toFixed(1)})`);
      if (state.fallbackTraveled) {
        state.fallbackTraveled.setAttribute('d', buildSvgPath(
          TrackingData.sliceAtProgress(state.routeMap, state.progress),
          state.fallbackProject
        ));
      }
      state.fallbackStops.forEach((stop) => {
        stop.node.classList.toggle('map-stop--passed', state.progress >= stop.offset * 100 && state.progress > 0);
      });
    }
  }

  function updateDynamicUI() {
    if (!state.activeTrip) {
      return;
    }

    const status = getStatus();
    const nextStop = getNextStop();
    const safeProgress = Math.max(0, Math.min(100, state.progress));
    const markerPosition = Math.max(3, Math.min(97, safeProgress));
    const eta = getEta(safeProgress);
    const now = formatNowWithSeconds();

    if (elements.statusBadge) {
      elements.statusBadge.className = `status-badge status-badge--${status.key}`;
      elements.statusBadge.innerHTML = `<span class="status-dot" aria-hidden="true"></span>${escape(status.label)}`;
    }
    if (elements.progressFill) {
      elements.progressFill.style.width = `${safeProgress}%`;
    }
    if (elements.busMarker) {
      elements.busMarker.style.left = `${markerPosition}%`;
    }
    if (elements.progressBar) {
      elements.progressBar.setAttribute('aria-valuenow', String(Math.round(safeProgress)));
      elements.progressBar.setAttribute('aria-valuetext', `${Math.round(safeProgress)} persen perjalanan, ${status.label}`);
    }
    if (elements.progressValue) {
      elements.progressValue.textContent = `${Math.round(safeProgress)}% perjalanan`;
    }
    if (elements.progressContext) {
      if (safeProgress >= 100) {
        elements.progressContext.textContent = `Tiba di ${state.activeTrip.route.destinationTerminal}.`;
      } else if (safeProgress <= 0) {
        elements.progressContext.textContent = `Menunggu keberangkatan di ${state.activeTrip.route.originTerminal}.`;
      } else if (nextStop) {
        elements.progressContext.textContent = `Menuju ${nextStop.name} · ${nextStop.time}`;
      }
    }
    if (elements.eta) {
      elements.eta.textContent = eta.value;
    }
    if (elements.etaCaption) {
      elements.etaCaption.textContent = eta.caption;
    }
    if (elements.etaHeader) {
      elements.etaHeader.textContent = eta.clock;
    }
    if (elements.remainingHeader) {
      elements.remainingHeader.textContent = eta.remaining;
    }
    if (elements.updateHeader) {
      elements.updateHeader.textContent = now;
    }
    if (elements.speed) {
      const speed = getSpeed();
      if (safeProgress >= 100) {
        elements.speed.textContent = 'Tiba (simulasi)';
      } else if (!state.running) {
        elements.speed.textContent = safeProgress <= 0
          ? 'Belum bergerak (simulasi)'
          : 'Berhenti sementara (simulasi)';
      } else {
        elements.speed.textContent = `${speed} km/jam (simulasi)`;
      }
    }
    if (elements.lastUpdate) {
      elements.lastUpdate.textContent = now;
    }

    updateStops();
    updateMap();
    updateToggleButton();
  }

  function renderTrip() {
    if (!state.activeTrip || !elements.dashboard) {
      return;
    }

    const trip = state.activeTrip;
    const route = trip.route;

    if (elements.routeTitle) {
      elements.routeTitle.textContent = `${route.originName} → ${route.destinationName}`;
    }
    if (elements.routeSubtitle) {
      elements.routeSubtitle.textContent = `${route.originTerminal} menuju ${route.destinationTerminal}`;
    }
    if (elements.busName) {
      elements.busName.textContent = `${trip.busName} · ${trip.busClass}`;
    }
    if (elements.startTerminal) {
      elements.startTerminal.textContent = route.originName;
    }
    if (elements.endTerminal) {
      elements.endTerminal.textContent = route.destinationName;
    }
    if (elements.trackCodeValue) {
      elements.trackCodeValue.textContent = trip.code;
    }
    if (elements.codeHeader) {
      elements.codeHeader.textContent = trip.code;
    }
    if (elements.operator) {
      elements.operator.textContent = trip.operatorName || trip.schedule.operatorName || 'Operator demo';
    }
    if (elements.departure) {
      elements.departure.textContent = trip.schedule.departure || '—';
    }
    if (elements.date) {
      elements.date.textContent = Data.formatDate(trip.travelDate);
    }
    if (elements.driver) {
      elements.driver.textContent = trip.driverName || 'Pengemudi demo';
    }
    if (elements.plate) {
      elements.plate.textContent = trip.plate || '—';
    }
    if (elements.source) {
      elements.source.textContent = trip.sourceLabel;
    }

    renderStops();
    elements.empty.hidden = true;
    elements.dashboard.hidden = false;
    setupMap();
    updateDynamicUI();
  }

  function startSimulation() {
    if (!state.activeTrip) {
      return;
    }

    if (state.running) {
      return;
    }

    if (state.progress >= 100) {
      updateDynamicUI();
      return;
    }

    clearTimer();
    state.running = true;
    state.lastTickAt = Date.now();

    if (state.progress <= 0 && !state.startNotified) {
      state.startNotified = true;
      notifyTripEvent(
        'start',
        'info',
        'Perjalanan demo akan segera dimulai',
        `Perjalanan demo ${state.activeTrip.code} dari ${state.activeTrip.route.originName} menuju ${state.activeTrip.route.destinationName} akan segera dimulai.`,
        false
      );
    }

    updateDynamicUI();

    state.timer = window.setInterval(() => {
      if (!state.activeTrip || !state.running) {
        stopSimulation();
        return;
      }

      const now = Date.now();
      const elapsed = Math.min(1200, Math.max(0, now - state.lastTickAt));
      state.lastTickAt = now;
      const increment = (100 / Math.max(1, getSimulationSeconds())) * (elapsed / 1000) * state.speedMultiplier;
      state.progress = Math.min(100, state.progress + increment);

      if (state.progress >= 55 && state.progress < 100 && !state.delayNotified) {
        state.delayNotified = true;
        const delayMinutes = Math.max(5, Math.min(20, Math.round(getDurationMinutes() / 50)));
        const nextStop = getNextStop();
        const created = notifyTripEvent(
          'delay',
          'warning',
          'Simulasi bus mengalami keterlambatan',
          `Simulasi ${state.activeTrip.code} mencatat perlambatan menuju ${nextStop ? nextStop.name : state.activeTrip.route.destinationName}. ETA diperbarui +${delayMinutes} menit.`,
          true
        );
        if (created) {
          state.delayMinutes = delayMinutes;
        }
      }

      if (state.progress >= 82 && state.progress < 100 && !state.approachingNotified) {
        state.approachingNotified = true;
        notifyTripEvent(
          'approaching',
          'info',
          'Bus simulasi mendekati tujuan',
          `Bus simulasi ${state.activeTrip.code} mendekati ${state.activeTrip.route.destinationName}. Sisa waktu simulasi sekitar ${Data.formatDuration(getRemainingMinutes(state.progress))}.`,
          true
        );
      }

      updateDynamicUI();

      if (state.progress >= 100) {
        stopSimulation();
        if (!state.arrivedAnnounced) {
          state.arrivedAnnounced = true;
          notifyTripEvent(
            'arrived',
            'success',
            'Simulasi perjalanan selesai',
            `Simulasi ${state.activeTrip.code} selesai. Bus tiba di ${state.activeTrip.route.destinationName}.`,
            true
          );
        }
      }
    }, TICK_MS);
  }

  function resetSimulation() {
    if (!state.activeTrip) {
      return;
    }
    stopSimulation();
    state.progress = 0;
    state.arrivedAnnounced = false;
    state.startNotified = false;
    state.delayNotified = false;
    state.approachingNotified = false;
    state.delayMinutes = 0;
    updateDynamicUI();
    Notifications.info('Simulasi direset ke titik awal. Tekan Mulai simulasi untuk memulai kembali.');
  }

  function toggleSimulation() {
    if (!state.activeTrip) {
      return;
    }
    if (state.running) {
      stopSimulation();
      Notifications.info('Simulasi dijeda. Tekan Lanjutkan simulasi untuk meneruskan perjalanan.');
      return;
    }
    if (state.progress >= 100) {
      return;
    }
    startSimulation();
    Notifications.info(state.progress > 0 ? 'Simulasi dilanjutkan.' : 'Simulasi dimulai dari titik keberangkatan.');
  }

  function setSpeed(value) {
    const next = Number(value);
    state.speedMultiplier = [1, 2, 4].includes(next) ? next : 1;

    if (elements.speedButtons) {
      elements.speedButtons.forEach((button) => {
        const isActive = Number(button.getAttribute('data-speed')) === state.speedMultiplier;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    if (elements.timeMode) {
      elements.timeMode.textContent = `Mode simulasi dipercepat ${state.speedMultiplier}×. ETA mengikuti jam perangkat Anda.`;
    }
  }

  function performLookup(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (elements.code) {
      elements.code.value = code;
    }
    setError('');

    if (!code) {
      setError('Masukkan kode pemesanan terlebih dahulu.');
      if (elements.code) {
        elements.code.focus();
      }
      return;
    }

    if (!/^SS-(?:\d{4}-[A-Z0-9]{5}|[A-Z0-9]{4,8})$/.test(code)) {
      setError('Format kode tidak valid. Contoh yang benar: SS-2026-AB12C atau SS-DEMO01.');
      Notifications.error('Kode pemesanan belum sesuai format.');
      if (elements.code) {
        elements.code.focus();
      }
      return;
    }

    state.lookupToken += 1;
    const token = state.lookupToken;
    if (state.lookupTimer) {
      window.clearTimeout(state.lookupTimer);
    }
    stopSimulation();
    setLookupLoading(true);

    state.lookupTimer = window.setTimeout(() => {
      if (token !== state.lookupToken) {
        return;
      }

      const demo = Data.getDemoTrip(code);
      const booking = Storage.findBooking(code);
      let trip = null;

      if (demo) {
        trip = normalizeDemoTrip(demo);
      } else if (booking) {
        trip = normalizeStoredBooking(booking);
      }

      setLookupLoading(false);

      if (!trip) {
        state.activeTrip = null;
        state.routeMap = null;
        state.progress = 0;
        state.delayMinutes = 0;
        clearMap();
        setError('Kode pemesanan tidak ditemukan. Gunakan kode demo yang tersedia atau kode tiket yang Anda simpan.');
        if (elements.empty) {
          elements.empty.hidden = false;
        }
        if (elements.dashboard) {
          elements.dashboard.hidden = true;
        }
        Notifications.error('Tiket dengan kode tersebut tidak ditemukan di data demo maupun penyimpanan browser.');
        return;
      }

      state.activeTrip = trip;
      state.routeMap = TrackingData ? TrackingData.getRouteMap(trip.route.id) : null;
      state.progress = 0;
      state.arrivedAnnounced = false;
      state.startNotified = false;
      state.delayNotified = false;
      state.approachingNotified = false;
      state.delayMinutes = 0;
      renderTrip();
      Notifications.success(`Pemantauan simulasi ${trip.code} siap. Tekan Mulai simulasi untuk menjalankan perjalanan.`);
    }, 650);
  }

  function handleSubmit(event) {
    event.preventDefault();
    performLookup(elements.code ? elements.code.value : '');
  }

  function trackCode(code) {
    if (!state.initialized) {
      return;
    }
    if (elements.code) {
      elements.code.value = String(code || '').toUpperCase();
    }
    performLookup(code);
  }

  function pause() {
    if (state.running) {
      stopSimulation();
    }
  }

  function invalidateMap() {
    if (state.map) {
      state.map.invalidateSize();
    }
  }

  function init() {
    if (state.initialized) {
      return;
    }

    elements.form = get('tracking-form');
    elements.code = get('tracking-code');
    elements.submit = get('tracking-submit');
    elements.error = get('tracking-error');
    elements.demoList = get('demo-code-list');
    elements.demoCta = get('tracking-demo-cta');
    elements.empty = get('tracking-empty');
    elements.dashboard = get('tracking-dashboard');
    elements.statusBadge = get('track-status-badge');
    elements.routeTitle = get('track-route-title');
    elements.routeSubtitle = get('track-route-subtitle');
    elements.busName = get('track-bus-name');
    elements.operator = get('track-operator');
    elements.codeHeader = get('track-code-header');
    elements.departure = get('track-departure');
    elements.progressBar = get('track-progress');
    elements.progressFill = get('track-progress-fill');
    elements.busMarker = get('track-bus-marker');
    elements.progressValue = get('track-progress-value');
    elements.progressContext = get('track-progress-context');
    elements.startTerminal = get('track-start-terminal');
    elements.endTerminal = get('track-end-terminal');
    elements.stops = get('track-stops');
    elements.eta = get('track-eta');
    elements.etaCaption = get('track-eta-caption');
    elements.etaHeader = get('track-eta-header');
    elements.remainingHeader = get('track-remaining-header');
    elements.updateHeader = get('track-update-header');
    elements.speed = get('track-speed');
    elements.lastUpdate = get('track-last-update');
    elements.trackCodeValue = get('track-code');
    elements.date = get('track-date');
    elements.driver = get('track-driver');
    elements.plate = get('track-plate');
    elements.source = get('track-source');
    elements.toggle = get('tracking-toggle');
    elements.reset = get('tracking-reset');
    elements.map = get('tracking-map');
    elements.mapFallback = get('tracking-map-fallback');
    elements.mapStatus = get('tracking-map-status');
    elements.timeMode = get('tracking-time-mode');
    elements.speedButtons = Array.from(document.querySelectorAll('#simulation-speed [data-speed]'));

    if (!elements.form || !elements.code || !elements.dashboard) {
      return;
    }

    elements.code.addEventListener('blur', () => {
      elements.code.value = elements.code.value.toUpperCase();
    });

    elements.code.addEventListener('input', () => {
      setError('');
    });

    elements.form.addEventListener('submit', handleSubmit);

    if (elements.toggle) {
      elements.toggle.addEventListener('click', toggleSimulation);
    }
    if (elements.reset) {
      elements.reset.addEventListener('click', resetSimulation);
    }
    if (elements.demoCta) {
      elements.demoCta.addEventListener('click', () => {
        const demo = Data.DEMO_TRIPS[0];
        if (!demo) {
          return;
        }
        if (elements.code) {
          elements.code.value = demo.code;
        }
        performLookup(demo.code);
      });
    }
    elements.speedButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setSpeed(button.getAttribute('data-speed'));
      });
    });

    populateDemoCodes();
    setSpeed(1);

    document.addEventListener('smartshuttle:sectionchange', (event) => {
      if (event.detail && event.detail.route !== 'lacak') {
        pause();
        return;
      }
      window.setTimeout(invalidateMap, 80);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        pause();
      }
    });

    window.addEventListener('resize', () => {
      window.requestAnimationFrame(invalidateMap);
    });

    window.addEventListener('beforeunload', () => {
      clearTimer();
      if (state.map) {
        state.map.remove();
        state.map = null;
      }
    });

    state.initialized = true;
  }

  window.SmartShuttleTracking = {
    init,
    trackCode,
    pause
  };
})(window);
