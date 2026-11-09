(function (window) {
  'use strict';

  const SERVICE_FEE = 5000;

  const CITIES = [
    { id: 'jkt', name: 'Jakarta', short: 'JKT', terminal: 'Terminal Pulo Gebang', plate: 'B' },
    { id: 'bdg', name: 'Bandung', short: 'BDG', terminal: 'Terminal Cicaheum', plate: 'D' },
    { id: 'pwt', name: 'Purwokerto', short: 'PWT', terminal: 'Terminal Bulupitu', plate: 'R' },
    { id: 'smg', name: 'Semarang', short: 'SMG', terminal: 'Terminal Terboyo', plate: 'H' },
    { id: 'yog', name: 'Yogyakarta', short: 'YOG', terminal: 'Terminal Giwangan', plate: 'AB' },
    { id: 'sby', name: 'Surabaya', short: 'SBY', terminal: 'Terminal Bungurasih', plate: 'L' }
  ];

  const OPERATORS = [
    {
      id: 'sinar-jaya',
      name: 'Sinar Jaya',
      initials: 'SJ',
      image: 'assets/bus-sinar-jaya.svg',
      priceAdd: 0,
      tagline: 'Operator antarkota demo'
    },
    {
      id: 'agra-mas',
      name: 'Agra Mas',
      initials: 'AM',
      image: 'assets/bus-agra-mas.svg',
      priceAdd: 5000,
      tagline: 'Operator antarkota demo'
    },
    {
      id: 'rosalia-indah',
      name: 'Rosalia Indah',
      initials: 'RI',
      image: 'assets/bus-rosalia-indah.svg',
      priceAdd: 10000,
      tagline: 'Operator antarkota demo'
    },
    {
      id: 'nusantara-express',
      name: 'Nusantara Express',
      initials: 'NE',
      image: 'assets/bus-nusantara-express.svg',
      priceAdd: 15000,
      tagline: 'Operator antarkota demo'
    }
  ];

  const CLASS_PROFILES = {
    'Executive': {
      priceAdd: 0,
      capacity: 32,
      amenities: ['AC', 'Wi-Fi', 'USB Charger', 'Reclining Seat']
    },
    'Executive Plus': {
      priceAdd: 35000,
      capacity: 36,
      amenities: ['AC', 'Wi-Fi', 'USB Charger', 'Reclining Seat', 'Snack', 'Toilet']
    },
    'Luxury Sleeper': {
      priceAdd: 90000,
      capacity: 28,
      amenities: ['AC', 'Wi-Fi', 'USB Charger', 'Sleeper Seat', 'Selimut', 'Toilet']
    }
  };

  const TIME_SLOTS = [
    { departure: '05:30', busClass: 'Executive' },
    { departure: '08:15', busClass: 'Executive Plus' },
    { departure: '11:00', busClass: 'Executive' },
    { departure: '14:30', busClass: 'Executive Plus' },
    { departure: '18:45', busClass: 'Executive' },
    { departure: '21:30', busClass: 'Luxury Sleeper' }
  ];

  const CORRIDORS = [
    { from: 'jkt', to: 'bdg', distanceKm: 155, durationMinutes: 195, basePrice: 120000 },
    { from: 'jkt', to: 'pwt', distanceKm: 330, durationMinutes: 330, basePrice: 165000 },
    { from: 'jkt', to: 'smg', distanceKm: 440, durationMinutes: 390, basePrice: 210000 },
    { from: 'jkt', to: 'yog', distanceKm: 560, durationMinutes: 480, basePrice: 260000 },
    { from: 'jkt', to: 'sby', distanceKm: 780, durationMinutes: 660, basePrice: 340000 },
    { from: 'bdg', to: 'pwt', distanceKm: 230, durationMinutes: 270, basePrice: 135000 },
    { from: 'bdg', to: 'smg', distanceKm: 350, durationMinutes: 345, basePrice: 185000 },
    { from: 'bdg', to: 'yog', distanceKm: 420, durationMinutes: 420, basePrice: 200000 },
    { from: 'bdg', to: 'sby', distanceKm: 690, durationMinutes: 585, basePrice: 305000 },
    { from: 'pwt', to: 'smg', distanceKm: 170, durationMinutes: 195, basePrice: 100000 },
    { from: 'pwt', to: 'yog', distanceKm: 190, durationMinutes: 210, basePrice: 110000 },
    { from: 'pwt', to: 'sby', distanceKm: 420, durationMinutes: 450, basePrice: 230000 },
    { from: 'smg', to: 'yog', distanceKm: 130, durationMinutes: 150, basePrice: 110000 },
    { from: 'smg', to: 'sby', distanceKm: 310, durationMinutes: 270, basePrice: 170000 },
    { from: 'yog', to: 'sby', distanceKm: 330, durationMinutes: 300, basePrice: 180000 }
  ];

  const DRIVERS = [
    'Ahmad Fauzi', 'Budi Santoso', 'Dedi Kurniawan', 'Eko Prasetyo',
    'Fajar Nugroho', 'Gilang Ramadhan', 'Hendra Wijaya', 'Irfan Maulana'
  ];

  const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
  const LIMITED_DAYS = [1, 3, 5];
  const DURATION_VARIATIONS = [0, 15, 30, 10, 20, 25];
  const ROUTES = [];
  const SCHEDULES = [];
  let scheduleCounter = 0;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function addMinutesToTime(time, minutes) {
    const parts = String(time).split(':').map(Number);
    const total = (parts[0] * 60) + parts[1] + Number(minutes);
    const dayOffset = Math.floor(total / 1440);
    const normalized = ((total % 1440) + 1440) % 1440;
    return {
      time: `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`,
      dayOffset
    };
  }

  function buildStops(origin, destination) {
    return [
      { name: origin.terminal, offset: 0 },
      { name: 'Titik Istirahat 1', offset: 0.36 },
      { name: 'Titik Istirahat 2', offset: 0.7 },
      { name: destination.terminal, offset: 1 }
    ];
  }

  function getOperatingDays(routeId) {
    if (routeId === 'pwt-sby' || routeId === 'sby-pwt') {
      return LIMITED_DAYS.slice();
    }
    return ALL_DAYS.slice();
  }

  function buildSeatList(capacity) {
    return Array.from({ length: capacity }, (_, index) => index + 1);
  }

  function getSeatRows(scheduleOrId) {
    const schedule = typeof scheduleOrId === 'string' ? getSchedule(scheduleOrId) : scheduleOrId;
    if (!schedule) {
      return [];
    }

    const rows = [];
    for (let start = 1; start <= schedule.seatCapacity; start += 4) {
      const seats = buildSeatList(4)
        .map((offset) => start + offset - 1)
        .filter((seat) => seat <= schedule.seatCapacity);
      rows.push({
        number: rows.length + 1,
        left: seats.slice(0, 2),
        right: seats.slice(2)
      });
    }
    return rows;
  }

  CORRIDORS.forEach((corridor) => {
    const originCity = CITIES.find((city) => city.id === corridor.from);
    const destinationCity = CITIES.find((city) => city.id === corridor.to);

    [[originCity, destinationCity], [destinationCity, originCity]].forEach((direction) => {
      const origin = direction[0];
      const destination = direction[1];
      const routeId = `${origin.id}-${destination.id}`;
      const operatingDays = getOperatingDays(routeId);
      const limitedService = operatingDays.length < ALL_DAYS.length;
      const serviceNote = limitedService
        ? 'Rute demo ini hanya beroperasi pada hari Senin, Rabu, dan Jumat.'
        : 'Rute demo ini beroperasi setiap hari.';

      ROUTES.push({
        id: routeId,
        originId: origin.id,
        destinationId: destination.id,
        originName: origin.name,
        destinationName: destination.name,
        originTerminal: origin.terminal,
        destinationTerminal: destination.terminal,
        distanceKm: corridor.distanceKm,
        durationMinutes: corridor.durationMinutes,
        basePrice: corridor.basePrice,
        stops: buildStops(origin, destination),
        operatingDays: operatingDays.slice(),
        serviceNote
      });

      TIME_SLOTS.forEach((slot, slotIndex) => {
        const profile = CLASS_PROFILES[slot.busClass];
        const operator = OPERATORS[scheduleCounter % OPERATORS.length];
        const durationMinutes = corridor.durationMinutes + DURATION_VARIATIONS[slotIndex];
        const arrival = addMinutesToTime(slot.departure, durationMinutes);
        const seatCapacity = profile.capacity;
        scheduleCounter += 1;

        SCHEDULES.push({
          id: `${routeId}-${slotIndex + 1}`,
          busId: `BUS-${String(scheduleCounter).padStart(3, '0')}`,
          routeId,
          originId: origin.id,
          destinationId: destination.id,
          originName: origin.name,
          destinationName: destination.name,
          originTerminal: origin.terminal,
          destinationTerminal: destination.terminal,
          departure: slot.departure,
          arrival: arrival.time,
          arrivalDayOffset: arrival.dayOffset,
          durationMinutes,
          distanceKm: corridor.distanceKm,
          busClass: slot.busClass,
          busName: `${operator.name} ${slot.busClass}`,
          operatorId: operator.id,
          operatorName: operator.name,
          operatorInitials: operator.initials,
          operatorTagline: operator.tagline,
          image: operator.image,
          imageAlt: `Ilustrasi bus ${operator.name} untuk layanan demo`,
          price: corridor.basePrice + profile.priceAdd + operator.priceAdd,
          amenities: profile.amenities.slice(),
          plate: `${origin.plate} ${1027 + (scheduleCounter * 13)} SS`,
          busCode: `BUS-${String(100 + scheduleCounter).padStart(3, '0')}`,
          driverName: DRIVERS[scheduleCounter % DRIVERS.length],
          seatCapacity,
          seats: buildSeatList(seatCapacity),
          status: scheduleCounter % 37 === 0 ? 'Tidak beroperasi' : 'Aktif',
          operatingDays: operatingDays.slice(),
          serviceNote
        });
      });
    });
  });

  const ROUTE_MAP = ROUTES.reduce((map, route) => {
    map[route.id] = route;
    return map;
  }, {});

  const SCHEDULE_MAP = SCHEDULES.reduce((map, schedule) => {
    map[schedule.id] = schedule;
    return map;
  }, {});

  const BUS_MAP = SCHEDULES.reduce((map, schedule) => {
    map[schedule.busId] = schedule;
    return map;
  }, {});

  function getTodayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function addDaysISO(days) {
    const date = new Date();
    date.setDate(date.getDate() + Number(days));
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }
    const parts = String(value).split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return null;
    }
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function getCity(cityId) {
    return CITIES.find((city) => city.id === cityId) || null;
  }

  function getRoute(originId, destinationId) {
    return ROUTE_MAP[`${originId}-${destinationId}`] || null;
  }

  function getRouteById(routeId) {
    return ROUTE_MAP[routeId] || null;
  }

  function getSchedules(routeId) {
    return SCHEDULES.filter((schedule) => schedule.routeId === routeId);
  }

  function getSchedule(scheduleId) {
    return SCHEDULE_MAP[scheduleId] || null;
  }

  function getBusById(busId) {
    return BUS_MAP[busId] || null;
  }

  function getBusByScheduleId(scheduleId) {
    const schedule = getSchedule(scheduleId);
    return schedule ? getBusById(schedule.busId) : null;
  }

  function isOperatingOn(schedule, dateValue) {
    if (!schedule || schedule.status === 'Tidak beroperasi') {
      return false;
    }
    const date = parseDate(dateValue);
    if (!date) {
      return false;
    }
    return schedule.operatingDays.includes(date.getDay());
  }

  function getAvailableSchedules(routeId, dateValue) {
    return getSchedules(routeId).filter((schedule) => isOperatingOn(schedule, dateValue));
  }

  function getBusesForRoute(routeId, dateValue) {
    return getAvailableSchedules(routeId, dateValue);
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function getDemoOccupiedSeats(scheduleOrId, travelDate) {
    const schedule = typeof scheduleOrId === 'string' ? getSchedule(scheduleOrId) : scheduleOrId;
    const occupied = new Set();
    if (!schedule || !travelDate) {
      return occupied;
    }

    let seed = hashString(`${schedule.id}:${travelDate}`);
    for (let seat = 1; seat <= schedule.seatCapacity; seat += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const probability = (seed >>> 9) % 100;
      if (probability < 21) {
        occupied.add(seat);
      }
    }
    return occupied;
  }

  function getAvailableSeatCount(scheduleOrId, travelDate, additionalOccupied) {
    const schedule = typeof scheduleOrId === 'string' ? getSchedule(scheduleOrId) : scheduleOrId;
    if (!schedule) {
      return 0;
    }
    const occupied = getDemoOccupiedSeats(schedule, travelDate);
    const extra = additionalOccupied instanceof Set
      ? additionalOccupied
      : new Set(Array.isArray(additionalOccupied) ? additionalOccupied : []);
    extra.forEach((seat) => occupied.add(Number(seat)));
    return Math.max(0, schedule.seatCapacity - occupied.size);
  }

  function getTripStops(route, schedule) {
    if (!route || !schedule) {
      return [];
    }

    const totalMinutes = Number(schedule.durationMinutes) || route.durationMinutes;
    return route.stops.map((stop) => {
      const elapsed = Math.round(totalMinutes * stop.offset);
      const time = addMinutesToTime(schedule.departure, elapsed);
      return {
        name: stop.name,
        offset: stop.offset,
        time: time.time,
        dayOffset: time.dayOffset
      };
    });
  }

  function getOperatingDaysLabel(schedule) {
    if (!schedule || !Array.isArray(schedule.operatingDays)) {
      return 'Jadwal belum tersedia';
    }
    const names = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    if (schedule.operatingDays.length === 7) {
      return 'Setiap hari';
    }
    return schedule.operatingDays.map((day) => names[day]).join(', ');
  }

  const DEMO_SPECS = [
    {
      code: 'SS-DEMO01',
      routeId: 'jkt-bdg',
      scheduleId: 'jkt-bdg-1',
      initialProgress: 42,
      note: 'Contoh perjalanan Jakarta menuju Bandung'
    },
    {
      code: 'SS-DEMO02',
      routeId: 'jkt-yog',
      scheduleId: 'jkt-yog-6',
      initialProgress: 24,
      note: 'Contoh perjalanan malam Jakarta menuju Yogyakarta'
    },
    {
      code: 'SS-DEMO03',
      routeId: 'sby-smg',
      scheduleId: 'sby-smg-2',
      initialProgress: 67,
      note: 'Contoh perjalanan Surabaya menuju Semarang'
    }
  ];

  const DEMO_TRIPS = DEMO_SPECS.map((spec) => {
    const route = getRouteById(spec.routeId);
    const schedule = getSchedule(spec.scheduleId);

    return {
      code: spec.code,
      routeId: spec.routeId,
      scheduleId: spec.scheduleId,
      initialProgress: spec.initialProgress,
      note: spec.note,
      travelDate: getTodayISO(),
      route,
      schedule,
      busName: schedule.busName,
      busClass: schedule.busClass,
      plate: schedule.plate,
      driverName: schedule.driverName
    };
  });

  function getDemoTrip(code) {
    const normalized = String(code || '').trim().toUpperCase();
    return DEMO_TRIPS.find((trip) => trip.code === normalized) || null;
  }

  const currencyFormatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  function formatCurrency(value) {
    return currencyFormatter.format(Number(value) || 0).replace(/\u00A0/g, ' ');
  }

  function calculatePrice(pricePerSeat, seatCount) {
    const normalizedSeatCount = Math.max(0, Math.floor(Number(seatCount) || 0));
    const normalizedPrice = Math.max(0, Number(pricePerSeat) || 0);
    const fare = normalizedPrice * normalizedSeatCount;
    const serviceFee = normalizedSeatCount > 0 ? SERVICE_FEE : 0;
    return {
      pricePerSeat: normalizedPrice,
      seatCount: normalizedSeatCount,
      fare,
      serviceFee,
      total: fare + serviceFee
    };
  }

  function formatDate(value, style) {
    const date = parseDate(value);
    if (!date) {
      return 'Tanggal belum dipilih';
    }

    const options = style === 'short'
      ? { day: 'numeric', month: 'short', year: 'numeric' }
      : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };

    return date.toLocaleDateString('id-ID', options);
  }

  function formatDuration(minutes) {
    const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(safeMinutes / 60);
    const remaining = safeMinutes % 60;

    if (hours === 0) {
      return `${remaining} menit`;
    }
    if (remaining === 0) {
      return `${hours} jam`;
    }
    return `${hours} jam ${remaining} menit`;
  }

  function getNowTime() {
    const now = new Date();
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  window.SmartShuttleData = {
    SERVICE_FEE,
    CITIES,
    OPERATORS,
    ROUTES,
    SCHEDULES,
    DEMO_TRIPS,
    getCity,
    getRoute,
    getRouteById,
    getSchedules,
    getSchedule,
    getBusById,
    getBusByScheduleId,
    getBusesForRoute,
    getAvailableSchedules,
    isOperatingOn,
    getOperatingDaysLabel,
    getDemoOccupiedSeats,
    getAvailableSeatCount,
    getSeatRows,
    getTripStops,
    getDemoTrip,
    formatCurrency,
    calculatePrice,
    formatDate,
    formatDuration,
    getTodayISO,
    addDaysISO,
    addMinutesToTime,
    getNowTime
  };
})(window);
