(function (window) {
  'use strict';

  const KEYS = {
    bookings: 'smartshuttle_bookings',
    notifications: 'smartshuttle_notifications',
    profile: 'smartshuttle_profile',
    settings: 'smartshuttle_settings'
  };

  const LEGACY_KEYS = {
    bookings: 'smartshuttle.bookings.v1',
    profile: 'smartshuttle.profile.v1'
  };

  const SEARCH_SESSION_KEY = 'smartshuttle.search.v1';
  const NOTIFICATION_TYPES = ['success', 'warning', 'error', 'info'];
  const memoryStore = {};
  let storageAvailable = null;
  let migrationChecked = false;

  const DEMO_PROFILE = {
    name: 'Rani Prameswari',
    email: 'rani.demo@smartshuttle.local',
    phone: '0812-3456-7890',
    tier: 'Akun Demo',
    initials: 'RP'
  };

  const DEFAULT_SETTINGS = {
    notificationsEnabled: true,
    compactMode: false
  };

  function checkStorage() {
    if (storageAvailable !== null) {
      return storageAvailable;
    }

    try {
      const testKey = 'smartshuttle.storage.test';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      storageAvailable = true;
    } catch (error) {
      storageAvailable = false;
    }

    return storageAvailable;
  }

  function readRaw(key, fallback) {
    if (Object.prototype.hasOwnProperty.call(memoryStore, key)) {
      return memoryStore[key];
    }
    if (!checkStorage()) {
      return fallback;
    }

    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch (error) {
      return fallback;
    }
  }

  function writeRaw(key, value) {
    if (!checkStorage()) {
      memoryStore[key] = value;
      return false;
    }

    try {
      window.localStorage.setItem(key, value);
      delete memoryStore[key];
      return true;
    } catch (error) {
      memoryStore[key] = value;
      return false;
    }
  }

  function removeStoredKey(key) {
    delete memoryStore[key];
    if (!checkStorage()) {
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      delete memoryStore[key];
    }
  }

  function migrateLegacyData() {
    if (migrationChecked || !checkStorage()) {
      return;
    }
    migrationChecked = true;

    [
      [KEYS.bookings, LEGACY_KEYS.bookings],
      [KEYS.profile, LEGACY_KEYS.profile]
    ].forEach(([currentKey, legacyKey]) => {
      try {
        const current = window.localStorage.getItem(currentKey);
        const legacy = window.localStorage.getItem(legacyKey);
        if (current === null && legacy !== null) {
          window.localStorage.setItem(currentKey, legacy);
          window.localStorage.removeItem(legacyKey);
        }
      } catch (error) {
        migrationChecked = false;
      }
    });
  }

  function emitChange(name) {
    if (!window.document || typeof window.CustomEvent !== 'function') {
      return;
    }
    window.document.dispatchEvent(new window.CustomEvent(`smartshuttle:${name}`));
  }

  function parseJSON(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function normalizeBooking(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const code = String(item.code || item.id || '').trim().toUpperCase();
    if (!code) {
      return null;
    }
    return Object.assign({}, item, {
      code,
      id: item.id || code
    });
  }

  function getBookings() {
    migrateLegacyData();
    const parsed = parseJSON(readRaw(KEYS.bookings, '[]'), []);
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.bookings) ? parsed.bookings : []);
    const seen = new Set();

    return list
      .map(normalizeBooking)
      .filter((booking) => {
        if (!booking || seen.has(booking.code)) {
          return false;
        }
        seen.add(booking.code);
        return true;
      });
  }

  function saveBooking(booking) {
    const normalized = normalizeBooking(booking);
    if (!normalized) {
      return false;
    }

    const bookings = getBookings().filter((item) => item.code !== normalized.code);
    bookings.unshift(normalized);
    const saved = writeRaw(KEYS.bookings, JSON.stringify(bookings));
    emitChange('bookingschange');
    return saved;
  }

  function findBooking(code) {
    const normalized = String(code || '').trim().toUpperCase();
    return getBookings().find((booking) => String(booking.code).toUpperCase() === normalized) || null;
  }

  function getBookingById(id) {
    return findBooking(id);
  }

  function updateBookingStatus(id, status) {
    const booking = findBooking(id);
    if (!booking || !status) {
      return null;
    }

    const updated = Object.assign({}, booking, {
      status: String(status),
      updatedAt: new Date().toISOString()
    });
    const bookings = getBookings().filter((item) => String(item.code).toUpperCase() !== String(updated.code).toUpperCase());
    bookings.unshift(updated);
    writeRaw(KEYS.bookings, JSON.stringify(bookings));
    emitChange('bookingschange');
    return updated;
  }

  function getBookedSeats(scheduleId, travelDate) {
    const seats = new Set();
    getBookings()
      .filter((booking) => booking.scheduleId === scheduleId && booking.travelDate === travelDate)
      .forEach((booking) => {
        if (Array.isArray(booking.seats)) {
          booking.seats.forEach((seat) => seats.add(Number(seat)));
        }
      });
    return Array.from(seats);
  }

  function deriveInitials(name) {
    const initials = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
    return initials || DEMO_PROFILE.initials;
  }

  function getProfile() {
    migrateLegacyData();
    const parsed = parseJSON(readRaw(KEYS.profile, ''), null);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return Object.assign({}, DEMO_PROFILE);
    }

    const profile = Object.assign({}, DEMO_PROFILE, parsed);
    profile.name = String(profile.name || DEMO_PROFILE.name).trim() || DEMO_PROFILE.name;
    profile.email = String(profile.email || DEMO_PROFILE.email).trim() || DEMO_PROFILE.email;
    profile.phone = String(profile.phone || DEMO_PROFILE.phone).trim() || DEMO_PROFILE.phone;
    profile.tier = DEMO_PROFILE.tier;
    profile.initials = deriveInitials(profile.name);
    return profile;
  }

  function saveProfile(profile) {
    const current = getProfile();
    const next = profile && typeof profile === 'object' ? profile : {};
    const updated = Object.assign({}, current, {
      name: String(next.name === undefined ? current.name : next.name).trim() || current.name,
      email: String(next.email === undefined ? current.email : next.email).trim() || current.email,
      phone: String(next.phone === undefined ? current.phone : next.phone).trim() || current.phone,
      tier: DEMO_PROFILE.tier
    });
    updated.initials = deriveInitials(updated.name);
    writeRaw(KEYS.profile, JSON.stringify(updated));
    emitChange('profilechange');
    return updated;
  }

  function getSettings() {
    const parsed = parseJSON(readRaw(KEYS.settings, ''), null);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }

    return {
      notificationsEnabled: parsed.notificationsEnabled !== false,
      compactMode: parsed.compactMode === true
    };
  }

  function saveSettings(settings) {
    const current = getSettings();
    const next = settings && typeof settings === 'object' ? settings : {};
    const updated = {
      notificationsEnabled: next.notificationsEnabled === undefined
        ? current.notificationsEnabled
        : next.notificationsEnabled !== false,
      compactMode: next.compactMode === undefined
        ? current.compactMode
        : next.compactMode === true
    };
    writeRaw(KEYS.settings, JSON.stringify(updated));
    emitChange('settingschange');
    return updated;
  }

  function createNotificationId() {
    return `notif-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function normalizeNotification(item) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const title = String(item.title || item.label || '').trim();
    const message = String(item.message || item.text || '').trim();
    if (!title && !message) {
      return null;
    }

    return {
      id: String(item.id || createNotificationId()),
      type: NOTIFICATION_TYPES.includes(item.type) ? item.type : 'info',
      title: title || 'Notifikasi SmartShuttle',
      message,
      eventKey: String(item.eventKey || ''),
      code: String(item.code || '').trim().toUpperCase(),
      createdAt: item.createdAt || new Date().toISOString(),
      read: Boolean(item.read)
    };
  }

  function getNotifications() {
    const parsed = parseJSON(readRaw(KEYS.notifications, '[]'), []);
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed && Array.isArray(parsed.notifications) ? parsed.notifications : []);
    return list
      .map(normalizeNotification)
      .filter(Boolean)
      .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
  }

  function addNotification(notification) {
    const normalized = normalizeNotification(notification);
    if (!normalized) {
      return null;
    }

    const notifications = getNotifications();
    if (normalized.eventKey && notifications.some((item) => item.eventKey === normalized.eventKey)) {
      return null;
    }

    notifications.unshift(normalized);
    writeRaw(KEYS.notifications, JSON.stringify(notifications.slice(0, 60)));
    emitChange('notificationschange');
    return normalized;
  }

  function markNotificationRead(id) {
    let updated = null;
    const notifications = getNotifications().map((item) => {
      if (item.id !== id) {
        return item;
      }
      updated = Object.assign({}, item, { read: true });
      return updated;
    });

    if (!updated) {
      return null;
    }

    writeRaw(KEYS.notifications, JSON.stringify(notifications));
    emitChange('notificationschange');
    return updated;
  }

  function markAllNotificationsRead() {
    let changed = 0;
    const notifications = getNotifications().map((item) => {
      if (item.read) {
        return item;
      }
      changed += 1;
      return Object.assign({}, item, { read: true });
    });

    if (changed > 0) {
      writeRaw(KEYS.notifications, JSON.stringify(notifications));
      emitChange('notificationschange');
    }
    return changed;
  }

  function deleteNotification(id) {
    const notifications = getNotifications();
    const filtered = notifications.filter((item) => item.id !== id);
    if (filtered.length === notifications.length) {
      return false;
    }

    writeRaw(KEYS.notifications, JSON.stringify(filtered));
    emitChange('notificationschange');
    return true;
  }

  function getUnreadNotificationCount() {
    return getNotifications().filter((item) => !item.read).length;
  }

  function getStats() {
    const bookings = getBookings();
    return bookings.reduce((stats, booking) => {
      stats.trips += 1;
      stats.seats += Number(booking.passengers) || (Array.isArray(booking.seats) ? booking.seats.length : 0);
      return stats;
    }, { trips: 0, seats: 0 });
  }

  function resetDemoData() {
    Object.keys(KEYS).forEach((key) => removeStoredKey(KEYS[key]));
    Object.keys(LEGACY_KEYS).forEach((key) => removeStoredKey(LEGACY_KEYS[key]));

    try {
      window.sessionStorage.removeItem(SEARCH_SESSION_KEY);
    } catch (error) {
      delete memoryStore[SEARCH_SESSION_KEY];
    }

    emitChange('bookingschange');
    emitChange('notificationschange');
    emitChange('profilechange');
    emitChange('settingschange');
    return true;
  }

  window.SmartShuttleStorage = {
    KEYS,
    DEFAULT_SETTINGS,
    isAvailable: checkStorage,
    getBookings,
    saveBooking,
    findBooking,
    getBookingById,
    updateBookingStatus,
    getBookedSeats,
    getProfile,
    saveProfile,
    getSettings,
    saveSettings,
    getNotifications,
    addNotification,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    getUnreadNotificationCount,
    getStats,
    resetDemoData
  };
})(window);
