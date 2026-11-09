(function (window) {
  'use strict';

  const Data = window.SmartShuttleData;
  const Storage = window.SmartShuttleStorage;
  const Notifications = window.SmartShuttleNotifications;
  const SeatMap = window.SmartShuttleSeatMap;
  const Booking = window.SmartShuttleBooking;
  const Tracking = window.SmartShuttleTracking;
  const Dashboard = window.SmartShuttleDashboard;

  const PAGE_TITLES = {
    beranda: 'Beranda',
    hasil: 'Hasil Pencarian',
    'detail-bus': 'Detail Bus',
    pesan: 'Pesan Tiket',
    lacak: 'Lacak Perjalanan Bus',
    dashboard: 'Dashboard Demo',
    tentang: 'Tentang'
  };

  const SEARCH_STORAGE_KEY = 'smartshuttle.search.v1';
  const FILTER_GROUPS = ['operators', 'classes', 'facilities'];

  const sections = {};
  const navLinks = [];
  const state = {
    initialRouteApplied: false,
    menuOpen: false,
    search: null,
    results: [],
    baseResults: [],
    filters: {
      operators: [],
      classes: [],
      facilities: []
    },
    sort: 'cheapest',
    currentBusId: null,
    seatSelections: Object.create(null)
  };

  function get(id) {
    return document.getElementById(id);
  }

  function getHashValue() {
    return window.location.hash.replace(/^#\/?/, '').trim();
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch (error) {
      return value;
    }
  }

  function parseView() {
    const raw = getHashValue();
    const normalized = raw.toLowerCase();

    if (normalized.indexOf('bus/') === 0) {
      return {
        route: 'detail-bus',
        busId: safeDecode(raw.slice(4)).trim()
      };
    }

    if (PAGE_TITLES[normalized] && normalized !== 'detail-bus') {
      return { route: normalized, busId: '' };
    }

    return { route: 'beranda', busId: '' };
  }

  function closeMobileMenu() {
    const nav = get('site-nav');
    const toggle = get('nav-toggle');
    if (!nav || !toggle) {
      return;
    }
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Buka menu navigasi');
    document.body.classList.remove('menu-open');
    state.menuOpen = false;
  }

  function openMobileMenu() {
    const nav = get('site-nav');
    const toggle = get('nav-toggle');
    if (!nav || !toggle) {
      return;
    }
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Tutup menu navigasi');
    document.body.classList.add('menu-open');
    state.menuOpen = true;
  }

  function toggleMobileMenu() {
    if (state.menuOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  function initMobileMenu() {
    const toggle = get('nav-toggle');
    const header = get('site-header');
    if (!toggle) {
      return;
    }

    toggle.addEventListener('click', toggleMobileMenu);

    navLinks.forEach((link) => {
      link.addEventListener('click', closeMobileMenu);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.menuOpen) {
        closeMobileMenu();
        toggle.focus();
      }
    });

    document.addEventListener('click', (event) => {
      if (!state.menuOpen || !header) {
        return;
      }
      if (!header.contains(event.target)) {
        closeMobileMenu();
      }
    });

    if (window.matchMedia) {
      const desktopQuery = window.matchMedia('(min-width: 961px)');
      const handleChange = (event) => {
        if (event.matches) {
          closeMobileMenu();
        }
      };
      if (typeof desktopQuery.addEventListener === 'function') {
        desktopQuery.addEventListener('change', handleChange);
      } else if (typeof desktopQuery.addListener === 'function') {
        desktopQuery.addListener(handleChange);
      }
    }
  }

  function showSection(route, shouldFocus) {
    const targetRoute = PAGE_TITLES[route] ? route : 'beranda';
    const targetSection = sections[targetRoute];

    Object.keys(sections).forEach((key) => {
      sections[key].hidden = key !== targetRoute;
    });

    if (targetSection) {
      const heading = targetSection.querySelector('h1');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        if (shouldFocus) {
          heading.focus({ preventScroll: true });
        }
      }
    }

    navLinks.forEach((link) => {
      if (link.getAttribute('data-route') === targetRoute) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    const accountTrigger = get('account-trigger');
    if (accountTrigger) {
      accountTrigger.classList.toggle('is-active', targetRoute === 'dashboard');
    }

    document.title = `${PAGE_TITLES[targetRoute]} | SmartShuttle`;
    closeMobileMenu();

    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: shouldFocus && !reduceMotion ? 'smooth' : 'auto' });

    document.dispatchEvent(new CustomEvent('smartshuttle:sectionchange', {
      detail: { route: targetRoute }
    }));
  }

  function handleRouteChange() {
    const shouldFocus = state.initialRouteApplied;
    const view = parseView();

    if (view.route === 'detail-bus') {
      const bus = Data.getBusById(view.busId);
      if (!bus) {
        Notifications.warning('Bus yang Anda cari tidak ditemukan. Silakan pilih dari hasil pencarian.');
        window.history.replaceState(null, '', '#/hasil');
        handleRouteChange();
        return;
      }
      state.currentBusId = bus.busId;
      showSection('detail-bus', shouldFocus);
      renderBusDetail(bus);
      state.initialRouteApplied = true;
      return;
    }

    if (view.route === 'hasil') {
      if (!state.search) {
        window.history.replaceState(null, '', '#/beranda');
        showSection('beranda', shouldFocus);
        applySearchToHomeForm();
        state.initialRouteApplied = true;
        return;
      }
      showSection('hasil', shouldFocus);
      renderResultsPage();
      state.initialRouteApplied = true;
      return;
    }

    showSection(view.route, shouldFocus);
    if (view.route === 'beranda') {
      applySearchToHomeForm();
    }
    state.initialRouteApplied = true;
  }

  function initRouter() {
    document.querySelectorAll('[data-section]').forEach((section) => {
      const route = section.getAttribute('data-section');
      if (PAGE_TITLES[route]) {
        sections[route] = section;
      }
    });

    document.querySelectorAll('.nav-link[data-route]').forEach((link) => {
      navLinks.push(link);
    });

    window.addEventListener('hashchange', handleRouteChange);

    const initialView = parseView();
    const isInvalidDetail = initialView.route === 'detail-bus' && !Data.getBusById(initialView.busId);
    const isInvalidResults = initialView.route === 'hasil' && !state.search;
    if (isInvalidDetail || isInvalidResults || !PAGE_TITLES[initialView.route]) {
      window.history.replaceState(null, '', '#/beranda');
    }

    handleRouteChange();
  }

  function initHeaderState() {
    const header = get('site-header');
    if (!header) {
      return;
    }

    const update = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function initSkipLink() {
    const skipLink = document.querySelector('.skip-link');
    const main = get('main-content');
    if (!skipLink || !main) {
      return;
    }

    skipLink.addEventListener('click', (event) => {
      event.preventDefault();
      main.setAttribute('tabindex', '-1');
      main.focus({ preventScroll: false });
    });
  }

  function initFooter() {
    const year = get('footer-year');
    if (year) {
      year.textContent = String(new Date().getFullYear());
    }

    const backToTop = get('back-to-top');
    if (backToTop) {
      backToTop.addEventListener('click', () => {
        const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    }
  }

  function populateHomeCities() {
    const origin = get('search-origin');
    const destination = get('search-destination');
    if (!origin || !destination) {
      return;
    }

    origin.innerHTML = '<option value="">Pilih kota asal</option>';
    Data.CITIES.forEach((city) => {
      const option = document.createElement('option');
      option.value = city.id;
      option.textContent = city.name;
      origin.appendChild(option);
    });
    origin.value = 'jkt';
    updateHomeDestinations('bdg');
  }

  function updateHomeDestinations(selectedId) {
    const origin = get('search-origin');
    const destination = get('search-destination');
    if (!origin || !destination) {
      return;
    }

    const currentValue = selectedId || destination.value;
    const originValue = origin.value;
    destination.innerHTML = '<option value="">Pilih kota tujuan</option>';

    Data.CITIES.filter((city) => city.id !== originValue).forEach((city) => {
      const option = document.createElement('option');
      option.value = city.id;
      option.textContent = city.name;
      if (city.id === currentValue) {
        option.selected = true;
      }
      destination.appendChild(option);
    });

    if (!destination.value) {
      destination.querySelector('option[value=""]').selected = true;
    }
  }

  function clearSearchError(field, errorId) {
    if (field) {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    }
    const error = get(errorId);
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }

  function setSearchError(field, errorId, message) {
    if (field) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
    }
    const error = get(errorId);
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function clearSearchErrors() {
    clearSearchError(get('search-origin'), 'search-origin-error');
    clearSearchError(get('search-destination'), 'search-destination-error');
    clearSearchError(get('search-date'), 'search-date-error');
    clearSearchError(get('search-passengers'), 'search-passengers-error');
  }

  function normalizeSearch(draft) {
    if (!draft) {
      return null;
    }

    const origin = Data.getCity(draft.origin);
    const destination = Data.getCity(draft.destination);
    const date = String(draft.date || '');
    const passengers = Number(draft.passengers);

    if (!origin || !destination || origin.id === destination.id) {
      return null;
    }
    if (!Data.getRoute(origin.id, destination.id)) {
      return null;
    }
    if (!date || date < Data.getTodayISO() || date.length !== 10) {
      return null;
    }
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > 6) {
      return null;
    }

    return {
      origin: origin.id,
      destination: destination.id,
      date,
      passengers
    };
  }

  function resetFilters() {
    state.filters = { operators: [], classes: [], facilities: [] };
  }

  function persistSearchState() {
    try {
      window.sessionStorage.setItem(SEARCH_STORAGE_KEY, JSON.stringify({
        search: state.search,
        sort: state.sort
      }));
    } catch (error) {
      return;
    }
  }

  function restoreSearchState() {
    try {
      const raw = window.sessionStorage.getItem(SEARCH_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const saved = JSON.parse(raw);
      state.search = normalizeSearch(saved.search);
      if (saved.sort === 'departure' || saved.sort === 'fastest' || saved.sort === 'cheapest') {
        state.sort = saved.sort;
      }
    } catch (error) {
      state.search = null;
      state.sort = 'cheapest';
    }
  }

  function applySearchToHomeForm() {
    if (!state.search) {
      return;
    }

    const origin = get('search-origin');
    const destination = get('search-destination');
    const date = get('search-date');
    const passengers = get('search-passengers');

    if (!origin || !destination || origin.options.length <= 1) {
      return;
    }

    origin.value = state.search.origin;
    updateHomeDestinations(state.search.destination);
    destination.value = state.search.destination;
    if (date) {
      date.value = state.search.date;
    }
    if (passengers) {
      passengers.value = String(state.search.passengers);
    }
  }

  function validateHomeSearch() {
    clearSearchErrors();
    const origin = get('search-origin');
    const destination = get('search-destination');
    const date = get('search-date');
    const passengers = get('search-passengers');
    const invalid = [];
    let isValid = true;

    if (!origin.value) {
      setSearchError(origin, 'search-origin-error', 'Pilih kota asal.');
      invalid.push(origin);
      isValid = false;
    }

    if (!destination.value) {
      setSearchError(destination, 'search-destination-error', 'Pilih kota tujuan.');
      invalid.push(destination);
      isValid = false;
    } else if (origin.value === destination.value) {
      setSearchError(destination, 'search-destination-error', 'Kota tujuan harus berbeda dari kota asal.');
      invalid.push(destination);
      isValid = false;
    }

    if (!date.value) {
      setSearchError(date, 'search-date-error', 'Pilih tanggal keberangkatan.');
      invalid.push(date);
      isValid = false;
    } else if (date.value < Data.getTodayISO()) {
      setSearchError(date, 'search-date-error', 'Tanggal keberangkatan tidak boleh di masa lalu.');
      invalid.push(date);
      isValid = false;
    }

    const count = Number(passengers.value);
    if (!Number.isInteger(count) || count < 1 || count > 6) {
      setSearchError(passengers, 'search-passengers-error', 'Pilih 1–6 penumpang.');
      invalid.push(passengers);
      isValid = false;
    }

    if (!isValid) {
      const first = invalid.find(Boolean);
      if (first) {
        first.focus();
      }
    }

    return isValid;
  }

  function handleHomeSearch(event) {
    event.preventDefault();
    if (!validateHomeSearch()) {
      Notifications.error('Lengkapi data pencarian yang ditandai.');
      return;
    }

    const draft = normalizeSearch({
      origin: get('search-origin').value,
      destination: get('search-destination').value,
      date: get('search-date').value,
      passengers: Number(get('search-passengers').value)
    });

    if (!draft) {
      Notifications.error('Pencarian belum valid. Periksa kembali rute, tanggal, dan jumlah penumpang.');
      return;
    }

    state.search = draft;
    state.sort = 'cheapest';
    state.currentBusId = null;
    resetFilters();
    persistSearchState();

    if (getHashValue().toLowerCase() === 'hasil') {
      renderResultsPage();
    } else {
      window.location.hash = '#/hasil';
    }
  }

  function initHomeSearch() {
    const form = get('home-search-form');
    if (!form) {
      return;
    }

    populateHomeCities();

    const date = get('search-date');
    if (date) {
      date.min = Data.getTodayISO();
      date.value = Data.addDaysISO(1);
    }

    applySearchToHomeForm();

    const origin = get('search-origin');
    const destination = get('search-destination');
    const swap = get('search-swap');

    if (origin) {
      origin.addEventListener('change', () => {
        updateHomeDestinations('');
        clearSearchError(origin, 'search-origin-error');
        clearSearchError(destination, 'search-destination-error');
      });
    }

    if (destination) {
      destination.addEventListener('change', () => {
        clearSearchError(destination, 'search-destination-error');
      });
    }

    if (swap) {
      swap.addEventListener('click', () => {
        if (!origin.value || !destination.value) {
          Notifications.info('Pilih kota asal dan tujuan sebelum menukar rute.');
          return;
        }
        const oldOrigin = origin.value;
        origin.value = destination.value;
        updateHomeDestinations(oldOrigin);
        destination.value = oldOrigin;
        Notifications.info('Kota asal dan tujuan ditukar.');
      });
    }

    ['search-origin', 'search-destination', 'search-date', 'search-passengers'].forEach((id) => {
      const field = get(id);
      if (field) {
        field.addEventListener('input', () => {
          clearSearchError(field, `${id}-error`);
        });
        field.addEventListener('change', () => {
          clearSearchError(field, `${id}-error`);
        });
      }
    });

    form.addEventListener('submit', handleHomeSearch);
  }

  function getSearchRoute() {
    if (!state.search) {
      return null;
    }
    return Data.getRoute(state.search.origin, state.search.destination);
  }

  function getSeatsLeft(schedule, travelDate) {
    return Data.getAvailableSeatCount(
      schedule,
      travelDate,
      Storage.getBookedSeats(schedule.id, travelDate)
    );
  }

  function computeBaseResults() {
    const route = getSearchRoute();
    if (!route || !state.search) {
      return [];
    }

    return Data.getAvailableSchedules(route.id, state.search.date)
      .map((schedule) => {
        const seatsLeft = getSeatsLeft(schedule, state.search.date);
        return Object.assign({}, schedule, { seatsLeft });
      })
      .filter((schedule) => schedule.seatsLeft >= state.search.passengers);
  }

  function collectFilterOptions(buses, group) {
    const options = new Map();

    buses.forEach((bus) => {
      if (group === 'operators') {
        if (!options.has(bus.operatorId)) {
          options.set(bus.operatorId, { value: bus.operatorId, label: bus.operatorName, count: 0 });
        }
        options.get(bus.operatorId).count += 1;
        return;
      }

      if (group === 'classes') {
        if (!options.has(bus.busClass)) {
          options.set(bus.busClass, { value: bus.busClass, label: bus.busClass, count: 0 });
        }
        options.get(bus.busClass).count += 1;
        return;
      }

      bus.amenities.forEach((amenity) => {
        if (!options.has(amenity)) {
          options.set(amenity, { value: amenity, label: amenity, count: 0 });
        }
        options.get(amenity).count += 1;
      });
    });

    return Array.from(options.values()).sort((first, second) => first.label.localeCompare(second.label, 'id'));
  }

  function renderFilterGroup(container, group, options) {
    if (!container) {
      return;
    }

    if (options.length === 0) {
      container.innerHTML = '<p class="filter-empty">Tidak ada pilihan pada jadwal ini.</p>';
      return;
    }

    const selected = state.filters[group];
    const escape = Notifications.escapeHTML;
    container.innerHTML = options.map((option) => {
      const isChecked = selected.indexOf(option.value) !== -1;
      return `
        <label class="filter-option">
          <input type="checkbox" name="filter-${group}" value="${escape(option.value)}"${isChecked ? ' checked' : ''}>
          <span>${escape(option.label)}</span>
          <small>${option.count}</small>
        </label>
      `;
    }).join('');
  }

  function renderFilters() {
    renderFilterGroup(get('filter-operators'), 'operators', collectFilterOptions(state.baseResults, 'operators'));
    renderFilterGroup(get('filter-classes'), 'classes', collectFilterOptions(state.baseResults, 'classes'));
    renderFilterGroup(get('filter-facilities'), 'facilities', collectFilterOptions(state.baseResults, 'facilities'));
  }

  function getVisibleResults() {
    let results = state.baseResults.slice();

    if (state.filters.operators.length > 0) {
      results = results.filter((bus) => state.filters.operators.indexOf(bus.operatorId) !== -1);
    }

    if (state.filters.classes.length > 0) {
      results = results.filter((bus) => state.filters.classes.indexOf(bus.busClass) !== -1);
    }

    if (state.filters.facilities.length > 0) {
      results = results.filter((bus) => {
        return state.filters.facilities.every((facility) => bus.amenities.indexOf(facility) !== -1);
      });
    }

    if (state.sort === 'departure') {
      results.sort((first, second) => first.departure.localeCompare(second.departure));
    } else if (state.sort === 'fastest') {
      results.sort((first, second) => first.durationMinutes - second.durationMinutes || first.price - second.price);
    } else {
      results.sort((first, second) => first.price - second.price || first.departure.localeCompare(second.departure));
    }

    return results;
  }

  function buildResultCard(bus) {
    const escape = Notifications.escapeHTML;
    const route = Data.getRouteById(bus.routeId);
    const arrivalSuffix = bus.arrivalDayOffset ? ' <small>+1 hari</small>' : '';
    const amenities = bus.amenities.slice(0, 4).map((amenity) => {
      return `<li><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"></use></svg>${escape(amenity)}</li>`;
    }).join('');

    return `
      <article class="result-card" role="listitem" data-result-bus="${escape(bus.busId)}">
        <div class="result-card__media">
          <img class="result-card__image" src="${escape(bus.image)}" alt="${escape(bus.imageAlt)}" width="720" height="480" loading="lazy" data-bus-id="${escape(bus.busId)}">
          <div class="result-card__image-fallback" hidden>
            <svg class="icon" aria-hidden="true"><use href="#icon-bus"></use></svg>
            <span>Foto bus demo</span>
          </div>
          <span class="badge badge--soft">${escape(bus.busClass)}</span>
        </div>

        <div class="result-card__body">
          <div class="result-card__top">
            <div class="operator-heading operator-heading--compact">
              <span class="operator-mark" aria-hidden="true">${escape(bus.operatorInitials)}</span>
              <div>
                <h2>${escape(bus.operatorName)}</h2>
                <p>${escape(bus.busName)} · Operator demo</p>
              </div>
            </div>
            <div class="result-card__price">
              <span>Mulai dari</span>
              <strong>${escape(Data.formatCurrency(bus.price))}</strong>
              <small>per penumpang</small>
            </div>
          </div>

          <div class="result-schedule">
            <div class="result-schedule__end">
              <strong>${escape(bus.departure)}</strong>
              <span>${escape(route.originName)}</span>
            </div>
            <div class="result-schedule__line">
              <span>${escape(Data.formatDuration(bus.durationMinutes))}</span>
              <span class="result-schedule__track" aria-hidden="true">
                <svg class="icon"><use href="#icon-bus"></use></svg>
              </span>
              <small>${bus.distanceKm} km · langsung demo</small>
            </div>
            <div class="result-schedule__end result-schedule__end--right">
              <strong>${escape(bus.arrival)}${arrivalSuffix}</strong>
              <span>${escape(route.destinationName)}</span>
            </div>
          </div>

          <ul class="result-facts">
            <li><svg class="icon" aria-hidden="true"><use href="#icon-calendar"></use></svg>${escape(Data.formatDate(state.search.date, 'short'))}</li>
            <li><svg class="icon" aria-hidden="true"><use href="#icon-users"></use></svg>${state.search.passengers} penumpang</li>
            <li><svg class="icon" aria-hidden="true"><use href="#icon-armchair"></use></svg>${bus.seatsLeft} kursi tersisa</li>
          </ul>

          <ul class="amenity-list result-amenities" aria-label="Fasilitas utama">
            ${amenities}
          </ul>

          <div class="result-card__footer">
            <a class="result-card__detail-link" href="#/bus/${encodeURIComponent(bus.busId)}">
              Lihat detail
              <svg class="icon" aria-hidden="true"><use href="#icon-arrow-right"></use></svg>
            </a>
            <button class="btn btn--primary" type="button" data-select-bus="${escape(bus.busId)}">
              <svg class="icon" aria-hidden="true"><use href="#icon-ticket"></use></svg>
              <span>Pilih Bus</span>
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function bindResultImageFallbacks() {
    const list = get('results-list');
    if (!list) {
      return;
    }

    list.querySelectorAll('.result-card__image').forEach((image) => {
      const card = image.closest('.result-card');
      const fallback = card ? card.querySelector('.result-card__image-fallback') : null;
      if (!fallback) {
        return;
      }
      const showFallback = () => {
        image.hidden = true;
        fallback.hidden = false;
      };
      image.addEventListener('error', showFallback, { once: true });
      if (image.complete && image.naturalWidth === 0) {
        showFallback();
      }
    });
  }

  function updateResultsHeading(visibleCount) {
    const route = getSearchRoute();
    if (!route || !state.search) {
      return;
    }

    const summary = get('results-summary');
    const context = get('results-context');
    const count = get('results-count');
    const filtersActive = FILTER_GROUPS.some((group) => state.filters[group].length > 0);
    const origin = Data.getCity(state.search.origin);
    const destination = Data.getCity(state.search.destination);

    if (summary) {
      summary.textContent = `${origin.name} → ${destination.name} · ${Data.formatDate(state.search.date)} · ${state.search.passengers} penumpang`;
    }
    if (context) {
      context.textContent = `${route.originTerminal} → ${route.destinationTerminal} · ${Data.formatDuration(route.durationMinutes)} estimasi perjalanan`;
    }
    if (count) {
      if (state.baseResults.length === 0) {
        count.textContent = '0 bus ditemukan';
      } else if (filtersActive) {
        count.textContent = `${visibleCount} dari ${state.baseResults.length} bus ditemukan`;
      } else {
        count.textContent = `${visibleCount} bus ditemukan`;
      }
    }
  }

  function renderVisibleResults() {
    const list = get('results-list');
    const empty = get('results-empty');
    const emptyDescription = get('results-empty-description');
    if (!list || !empty) {
      return;
    }

    const visible = getVisibleResults();
    state.results = visible;
    const filtersActive = FILTER_GROUPS.some((group) => state.filters[group].length > 0);

    list.innerHTML = visible.map(buildResultCard).join('');
    list.hidden = visible.length === 0;
    empty.hidden = visible.length > 0;

    if (emptyDescription) {
      if (state.baseResults.length === 0) {
        emptyDescription.textContent = 'Tidak ada layanan demo pada tanggal ini. Coba pilih tanggal lain, ubah rute, atau kurangi jumlah penumpang.';
      } else if (filtersActive) {
        emptyDescription.textContent = 'Tidak ada bus yang cocok dengan filter aktif. Longgarkan filter atau ubah kriteria pencarian.';
      } else {
        emptyDescription.textContent = 'Coba pilih tanggal lain atau ubah rute pencarian Anda.';
      }
    }

    const sort = get('results-sort');
    if (sort) {
      sort.value = state.sort;
    }

    updateResultsHeading(visible.length);
    bindResultImageFallbacks();
  }

  function renderResultsPage() {
    if (!state.search) {
      return;
    }
    state.baseResults = computeBaseResults();
    renderFilters();
    renderVisibleResults();
  }

  function updateFiltersFromInputs() {
    const mappings = {
      operators: 'filter-operators',
      classes: 'filter-classes',
      facilities: 'filter-facilities'
    };

    FILTER_GROUPS.forEach((group) => {
      const container = get(mappings[group]);
      state.filters[group] = container
        ? Array.from(container.querySelectorAll('input:checked')).map((input) => input.value)
        : [];
    });

    renderVisibleResults();
  }

  function syncFilterInputs() {
    ['filter-operators', 'filter-classes', 'filter-facilities'].forEach((containerId) => {
      const container = get(containerId);
      if (container) {
        container.querySelectorAll('input[type="checkbox"]').forEach((input) => {
          input.checked = false;
        });
      }
    });
  }

  function openBusForBooking(busId, selectedSeats) {
    const bus = Data.getBusById(busId);
    if (!bus) {
      Notifications.error('Bus tidak ditemukan. Silakan pilih bus lain dari hasil pencarian.');
      return false;
    }

    if (!state.search) {
      Notifications.warning('Lakukan pencarian terlebih dahulu sebelum memilih bus.');
      window.location.hash = '#/beranda';
      return false;
    }

    if (getSeatsLeft(bus, state.search.date) < state.search.passengers) {
      Notifications.warning('Kursi yang tersedia tidak mencukupi jumlah penumpang. Pilih bus lain.');
      return false;
    }

    state.currentBusId = bus.busId;
    if (!Booking.prefillFromBus(bus.busId, state.search, selectedSeats)) {
      return false;
    }
    window.location.hash = '#/pesan';
    return true;
  }

  function getDetailSelectionKey(busId, travelDate) {
    return `${busId}|${travelDate}`;
  }

  function getDetailOccupiedSeats(bus, travelDate) {
    const occupied = Data.getDemoOccupiedSeats(bus, travelDate);
    Storage.getBookedSeats(bus.id, travelDate).forEach((seat) => occupied.add(Number(seat)));
    return occupied;
  }

  function getDetailSelectedSeats(bus, travelDate) {
    const key = getDetailSelectionKey(bus.busId, travelDate);
    const stored = Array.isArray(state.seatSelections[key]) ? state.seatSelections[key] : [];
    const occupied = getDetailOccupiedSeats(bus, travelDate);
    const valid = stored
      .map(Number)
      .filter((seat) => Number.isInteger(seat) && seat > 0 && seat <= bus.seatCapacity && !occupied.has(seat));
    state.seatSelections[key] = Array.from(new Set(valid)).sort((first, second) => first - second);
    return state.seatSelections[key];
  }

  function updateDetailSeatHint(passengers, selectedSeats, isAvailable) {
    const hint = get('detail-seat-hint');
    const instruction = get('detail-seat-instruction');
    const selectedCount = selectedSeats.length;

    if (instruction) {
      instruction.textContent = isAvailable
        ? `Pilih tepat ${passengers} kursi sesuai jumlah penumpang. Klik kursi terpilih untuk membatalkannya.`
        : 'Bus ini tidak dapat dipesan pada tanggal tersebut. Silakan kembali dan pilih bus lain.';
    }

    if (!hint) {
      return;
    }

    hint.classList.toggle('is-complete', isAvailable && selectedCount === passengers);
    if (!isAvailable) {
      hint.textContent = 'Pemilihan kursi tidak tersedia untuk bus ini.';
    } else if (selectedCount === passengers) {
      hint.textContent = `${selectedCount} dari ${passengers} kursi dipilih. Jumlah kursi sudah sesuai.`;
    } else if (selectedCount > passengers) {
      hint.textContent = `${selectedCount} dari ${passengers} kursi dipilih. Kurangi pilihan kursi.`;
    } else {
      hint.textContent = `${selectedCount} dari ${passengers} kursi dipilih. Pilih ${passengers - selectedCount} kursi lagi.`;
    }
  }

  function updateDetailSeatSummary(bus, selectedSeats, passengers, isAvailable) {
    const selectedContainer = get('detail-selected-seats');
    const pricedSeatCount = isAvailable ? selectedSeats.length : 0;
    const breakdown = Data.calculatePrice(bus.price, pricedSeatCount);

    setText('detail-side-schedule', `${bus.departure} – ${bus.arrival}${bus.arrivalDayOffset ? ' (+1 hari)' : ''}`);
    setText('detail-subtotal', Data.formatCurrency(breakdown.fare));
    setText('detail-service', Data.formatCurrency(breakdown.serviceFee));
    setText('detail-total', Data.formatCurrency(breakdown.total));

    if (selectedContainer) {
      selectedContainer.innerHTML = '';
      if (selectedSeats.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'summary-empty';
        empty.textContent = 'Belum ada kursi dipilih';
        selectedContainer.appendChild(empty);
      } else {
        selectedSeats.forEach((seat) => {
          const chip = document.createElement('span');
          chip.className = 'seat-chip';
          chip.textContent = `Kursi ${seat}`;
          selectedContainer.appendChild(chip);
        });
      }
    }

    const selectButton = get('detail-select');
    if (selectButton) {
      selectButton.disabled = !isAvailable;
      const label = selectButton.querySelector('span');
      if (label) {
        label.textContent = isAvailable ? 'Lanjutkan ke Pemesanan' : 'Tidak Tersedia';
      }
    }

    updateDetailSeatHint(passengers, selectedSeats, isAvailable);
  }

  function renderDetailSeatMap(bus, travelDate, passengers, isAvailable) {
    const container = get('detail-seat-map');
    if (!container) {
      return;
    }

    const selectedSeats = getDetailSelectedSeats(bus, travelDate);
    if (selectedSeats.length > passengers) {
      state.seatSelections[getDetailSelectionKey(bus.busId, travelDate)] = selectedSeats.slice(0, passengers);
    }

    const occupied = getDetailOccupiedSeats(bus, travelDate);
    const visibleSelection = state.seatSelections[getDetailSelectionKey(bus.busId, travelDate)];

    SeatMap.render(container, {
      schedule: bus,
      travelDate,
      selectedSeats: visibleSelection,
      occupiedSeats: occupied,
      locked: !isAvailable,
      label: `Denah ${bus.seatCapacity} kursi ${bus.operatorName}, dua kursi di kiri dan dua kursi di kanan lorong`
    });

    setText('detail-seat-capacity', `${bus.seatCapacity} kursi`);
    updateDetailSeatSummary(bus, visibleSelection, passengers, isAvailable);
  }

  function handleDetailSeatClick(event) {
    const button = event.target.closest('[data-seat]');
    if (!button || button.disabled || !state.currentBusId) {
      return;
    }

    const bus = Data.getBusById(state.currentBusId);
    if (!bus) {
      return;
    }

    const travelDate = state.search ? state.search.date : Data.getTodayISO();
    const passengers = state.search ? state.search.passengers : 1;
    const isAvailable = bus.status === 'Aktif' && Data.isOperatingOn(bus, travelDate);
    if (!isAvailable) {
      return;
    }

    const key = getDetailSelectionKey(bus.busId, travelDate);
    const selectedSeats = getDetailSelectedSeats(bus, travelDate);
    const seatNumber = Number(button.getAttribute('data-seat'));
    const index = selectedSeats.indexOf(seatNumber);

    if (index >= 0) {
      selectedSeats.splice(index, 1);
    } else if (selectedSeats.length >= passengers) {
      Notifications.warning(`Jumlah kursi sudah sesuai untuk ${passengers} penumpang. Batalkan satu kursi sebelum memilih kursi lain.`);
      return;
    } else {
      selectedSeats.push(seatNumber);
      selectedSeats.sort((first, second) => first - second);
    }

    state.seatSelections[key] = selectedSeats.slice();
    SeatMap.paint(get('detail-seat-map'), selectedSeats);
    updateDetailSeatSummary(bus, selectedSeats, passengers, isAvailable);

    const error = get('detail-seat-error');
    if (error) {
      error.hidden = true;
      error.textContent = '';
    }
  }

  function goToResults() {
    window.location.hash = state.search ? '#/hasil' : '#/beranda';
  }

  function setText(id, value) {
    const element = get(id);
    if (element) {
      element.textContent = value;
    }
  }

  function setDetailImage(bus) {
    const image = get('detail-image');
    const fallback = get('detail-image-fallback');
    if (!image || !fallback) {
      return;
    }

    const showFallback = () => {
      image.hidden = true;
      fallback.hidden = false;
    };

    image.hidden = false;
    fallback.hidden = true;
    image.onerror = showFallback;
    image.onload = () => {
      if (image.naturalWidth > 0) {
        image.hidden = false;
        fallback.hidden = true;
      }
    };
    image.alt = bus.imageAlt;
    image.src = bus.image;
    if (image.complete && image.naturalWidth === 0) {
      showFallback();
    }
  }

  function renderBusDetail(bus) {
    const route = Data.getRouteById(bus.routeId);
    if (!route) {
      return;
    }

    const escape = Notifications.escapeHTML;
    const date = state.search ? state.search.date : Data.getTodayISO();
    const passengers = state.search ? state.search.passengers : 1;
    const seatsLeft = getSeatsLeft(bus, date);
    const isAvailable = bus.status === 'Aktif'
      && Data.isOperatingOn(bus, date)
      && seatsLeft >= passengers;

    setDetailImage(bus);
    setText('detail-initials', bus.operatorInitials);
    setText('detail-operator', `${bus.operatorName} · Operator demo`);
    setText('detail-title', `${bus.operatorName} ${bus.busClass}`);
    setText('detail-subtitle', `${bus.busName} untuk rute ${route.originName} menuju ${route.destinationName}.`);
    setText('detail-route', `${route.originName} → ${route.destinationName}`);
    setText('detail-date', Data.formatDate(date));
    setText('detail-passengers', `${passengers} penumpang`);
    setText('detail-departure', bus.departure);
    setText('detail-departure-city', route.originName);
    setText('detail-duration', Data.formatDuration(bus.durationMinutes));
    setText('detail-arrival', `${bus.arrival}${bus.arrivalDayOffset ? ' (+1)' : ''}`);
    setText('detail-arrival-city', route.destinationName);
    setText('detail-bus-id', bus.busId);
    setText('detail-class', bus.busClass);
    setText('detail-status', `Status: ${bus.status}`);
    setText('detail-price', Data.formatCurrency(bus.price));
    setText('detail-side-date', Data.formatDate(date, 'short'));
    setText('detail-side-passengers', `${passengers} orang`);
    setText('detail-seat-count', `${seatsLeft} dari ${bus.seatCapacity} kursi`);
    setText('detail-info-operator', bus.operatorName);
    setText('detail-info-code', bus.busCode);
    setText('detail-info-plate', bus.plate);
    setText('detail-info-driver', bus.driverName);
    setText('detail-info-capacity', `${bus.seatCapacity} kursi`);
    setText('detail-info-days', Data.getOperatingDaysLabel(bus));
    setText('detail-info-origin', route.originTerminal);
    setText('detail-info-destination', route.destinationTerminal);
    setText('detail-service-note', bus.serviceNote);

    const status = get('detail-status');
    if (status) {
      status.className = 'badge badge--success detail-hero__badge';
    }

    const amenities = get('detail-amenities');
    if (amenities) {
      amenities.innerHTML = bus.amenities.map((amenity) => {
        return `<li><svg class="icon" aria-hidden="true"><use href="#icon-check-circle"></use></svg>${escape(amenity)}</li>`;
      }).join('');
    }

    const timeline = get('detail-timeline');
    if (timeline) {
      const stops = Data.getTripStops(route, bus);
      timeline.innerHTML = stops.map((stop, index) => {
        const isFirst = index === 0;
        const isLast = index === stops.length - 1;
        const label = isFirst ? 'Keberangkatan demo' : isLast ? 'Kedatangan demo' : 'Titik istirahat simulasi';
        const daySuffix = stop.dayOffset ? ' <small>+1 hari</small>' : '';
        return `
          <li class="detail-stop${isFirst ? ' detail-stop--first' : ''}${isLast ? ' detail-stop--last' : ''}">
            <span class="detail-stop__marker" aria-hidden="true"></span>
            <time datetime="${escape(stop.time)}">${escape(stop.time)}${daySuffix}</time>
            <div>
              <strong>${escape(stop.name)}</strong>
              <span>${escape(label)}</span>
            </div>
          </li>
        `;
      }).join('');
    }

    renderDetailSeatMap(bus, date, passengers, isAvailable);

    document.title = `${bus.operatorName} · ${route.originName}–${route.destinationName} | SmartShuttle`;
  }

  function handleDetailSelect() {
    if (!state.currentBusId) {
      return;
    }

    const bus = Data.getBusById(state.currentBusId);
    if (!bus) {
      return;
    }

    const travelDate = state.search ? state.search.date : Data.getTodayISO();
    const passengers = state.search ? state.search.passengers : 1;
    const seatsLeft = getSeatsLeft(bus, travelDate);
    const isAvailable = bus.status === 'Aktif'
      && Data.isOperatingOn(bus, travelDate)
      && seatsLeft >= passengers;

    if (!isAvailable) {
      Notifications.warning('Bus ini tidak tersedia untuk rute dan tanggal yang dipilih.');
      return;
    }

    const selectedSeats = getDetailSelectedSeats(bus, travelDate);
    if (selectedSeats.length !== passengers) {
      const remaining = Math.max(0, passengers - selectedSeats.length);
      const error = get('detail-seat-error');
      if (error) {
        error.textContent = selectedSeats.length > passengers
          ? `Kurangi pilihan kursi agar tepat ${passengers} kursi.`
          : `Pilih ${remaining} kursi lagi agar sesuai dengan ${passengers} penumpang.`;
        error.hidden = false;
      }
      Notifications.warning(`Pilih tepat ${passengers} kursi sebelum melanjutkan ke pemesanan.`);
      const map = get('detail-seat-map');
      if (map) {
        map.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    openBusForBooking(bus.busId, selectedSeats);
  }

  function initSearchUI() {
    const sort = get('results-sort');
    if (sort) {
      sort.addEventListener('change', () => {
        state.sort = sort.value;
        persistSearchState();
        renderVisibleResults();
      });
    }

    [
      ['filter-operators', 'operators'],
      ['filter-classes', 'classes'],
      ['filter-facilities', 'facilities']
    ].forEach((entry) => {
      const container = get(entry[0]);
      if (container) {
        container.addEventListener('change', updateFiltersFromInputs);
      }
    });

    const reset = get('results-reset-filters');
    if (reset) {
      reset.addEventListener('click', () => {
        resetFilters();
        syncFilterInputs();
        renderVisibleResults();
        Notifications.info('Filter pencarian direset.');
      });
    }

    const list = get('results-list');
    if (list) {
      list.addEventListener('click', (event) => {
        const button = event.target.closest('[data-select-bus]');
        if (!button) {
          return;
        }
        const busId = button.getAttribute('data-select-bus');
        window.location.hash = `#/bus/${encodeURIComponent(busId)}`;
      });
    }
  }

  function initDetail() {
    const back = get('detail-back');
    const backSecondary = get('detail-back-secondary');
    const select = get('detail-select');
    const seatMap = get('detail-seat-map');

    if (back) {
      back.addEventListener('click', goToResults);
    }
    if (backSecondary) {
      backSecondary.addEventListener('click', goToResults);
    }
    if (select) {
      select.addEventListener('click', handleDetailSelect);
    }
    if (seatMap) {
      seatMap.addEventListener('click', handleDetailSeatClick);
    }
  }

  function initAccount() {
    const trigger = get('account-trigger');
    if (!trigger) {
      return;
    }
    trigger.addEventListener('click', () => {
      closeMobileMenu();
      if (window.location.hash === '#/dashboard') {
        if (Dashboard) {
          Dashboard.open('ringkasan');
        }
      } else {
        window.location.hash = '#/dashboard';
        if (Dashboard) {
          Dashboard.open('ringkasan');
        }
      }
    });
  }

  function initHeroFallback() {
    const image = get('hero-bus-image');
    const fallback = get('hero-image-fallback');
    if (!image || !fallback) {
      return;
    }

    const showFallback = () => {
      image.hidden = true;
      fallback.hidden = false;
    };

    image.addEventListener('error', showFallback, { once: true });
    if (image.complete && image.naturalWidth === 0) {
      showFallback();
    }
  }

  function initializeModules() {
    Notifications.init();
    Booking.init();
    Tracking.init();
    if (Dashboard) {
      Dashboard.init();
    }
    restoreSearchState();
    initHeaderState();
    initMobileMenu();
    initSkipLink();
    initFooter();
    initHomeSearch();
    initSearchUI();
    initDetail();
    initRouter();
    initAccount();
    initHeroFallback();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeModules);
  } else {
    initializeModules();
  }
})(window);
