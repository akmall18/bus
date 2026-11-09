(function (window) {
  'use strict';

  const Data = window.SmartShuttleData;
  const Storage = window.SmartShuttleStorage;
  const Notifications = window.SmartShuttleNotifications;
  const TrackingData = window.SmartShuttleTrackingData;
  const Tracking = window.SmartShuttleTracking;

  const VIEWS = ['ringkasan', 'pesanan', 'lacak', 'notifikasi', 'profil', 'pengaturan', 'tiket'];

  const state = {
    initialized: false,
    view: 'ringkasan',
    orderQuery: '',
    orderStatus: 'Semua',
    activeTicket: null
  };

  const elements = {};

  function get(id) {
    return document.getElementById(id);
  }

  function escape(value) {
    return Notifications.escapeHTML(value);
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatSeats(booking) {
    if (Array.isArray(booking.seats) && booking.seats.length) {
      return booking.seats.join(', ');
    }
    return '—';
  }

  function getPassengerCount(booking) {
    return Number(booking.passengers) ||
      (Array.isArray(booking.passengerDetails) ? booking.passengerDetails.length : 0) ||
      (Array.isArray(booking.seats) ? booking.seats.length : 0);
  }

  function getSchedule(booking) {
    return Data.getSchedule(booking.scheduleId) || null;
  }

  function getOperator(booking) {
    const schedule = getSchedule(booking);
    return booking.operatorName ||
      (schedule && schedule.operatorName) ||
      booking.busName ||
      'Operator demo';
  }

  function getRouteId(booking) {
    return booking.routeId || `${booking.originId || ''}-${booking.destinationId || ''}`;
  }

  function isTrackable(booking) {
    if (!TrackingData || typeof TrackingData.getRouteMap !== 'function') {
      return false;
    }
    return Boolean(TrackingData.getRouteMap(getRouteId(booking)));
  }

  function getStatusLabel(booking) {
    return String(booking.status || 'Terjadwal');
  }

  function getStatusGroup(status) {
    const value = String(status || '').toLowerCase();
    if (value.indexOf('batal') !== -1) {
      return 'Dibatalkan';
    }
    if (value.indexOf('selesai') !== -1) {
      return 'Selesai';
    }
    if (value.indexOf('aktif') !== -1 || value.indexOf('berlangsung') !== -1 || value.indexOf('jalan') !== -1) {
      return 'Berlangsung';
    }
    return 'Terjadwal';
  }

  function getStatusClass(status) {
    return {
      Terjadwal: 'scheduled',
      Berlangsung: 'transit',
      Selesai: 'arrived',
      Dibatalkan: 'cancelled'
    }[getStatusGroup(status)] || 'scheduled';
  }

  function isUpcoming(booking) {
    const group = getStatusGroup(booking.status);
    return String(booking.travelDate || '') >= Data.getTodayISO() &&
      group !== 'Selesai' &&
      group !== 'Dibatalkan';
  }

  function sortBookings(bookings) {
    return bookings.slice().sort((first, second) => {
      const upcomingFirst = Number(isUpcoming(second)) - Number(isUpcoming(first));
      if (upcomingFirst !== 0) {
        return upcomingFirst;
      }
      const firstDate = `${first.travelDate || ''} ${first.departure || ''}`;
      const secondDate = `${second.travelDate || ''} ${second.departure || ''}`;
      return isUpcoming(first)
        ? firstDate.localeCompare(secondDate)
        : secondDate.localeCompare(firstDate);
    });
  }

  function getBookingStats() {
    const bookings = Storage.getBookings();
    const upcoming = bookings.filter(isUpcoming).length;
    return {
      total: bookings.length,
      upcoming,
      history: bookings.length - upcoming
    };
  }

  function setText(id, value) {
    const element = get(id);
    if (element) {
      element.textContent = value;
    }
  }

  function statusBadge(status) {
    return `<span class="status-badge status-badge--${getStatusClass(status)}"><span class="status-dot" aria-hidden="true"></span>${escape(getStatusLabel({ status }))}</span>`;
  }

  function updateBadges() {
    const unread = Storage.getUnreadNotificationCount();
    const profile = Storage.getProfile();
    const badges = ['account-notif-badge', 'dashboard-menu-notif-badge'];

    badges.forEach((id) => {
      const badge = get(id);
      if (!badge) {
        return;
      }
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.hidden = unread === 0;
    });

    const trigger = get('account-trigger');
    if (trigger) {
      trigger.setAttribute('aria-label', unread > 0
        ? `Buka dashboard demo, ${unread} notifikasi belum dibaca`
        : 'Buka dashboard demo');
    }

    const avatar = get('account-avatar');
    if (avatar) {
      avatar.textContent = profile.initials;
    }
    const dashboardAvatar = get('dashboard-avatar');
    if (dashboardAvatar) {
      dashboardAvatar.textContent = profile.initials;
    }
    setText('dashboard-profile-name', profile.name);
    setText('dashboard-profile-email', profile.email);
  }

  function emptyState(options) {
    return `
      <div class="dashboard-empty">
        <span class="empty-state__icon"><svg class="icon" aria-hidden="true"><use href="#${escape(options.icon || 'icon-ticket')}"></use></svg></span>
        <h3>${escape(options.title)}</h3>
        <p>${escape(options.message)}</p>
        ${options.action || ''}
      </div>
    `;
  }

  function renderSummary() {
    const stats = getBookingStats();
    const notifications = Storage.getNotifications();
    const unread = notifications.filter((item) => !item.read).length;

    setText('dashboard-stat-orders', String(stats.total));
    setText('dashboard-stat-upcoming', String(stats.upcoming));
    setText('dashboard-stat-history', String(stats.history));
    setText('dashboard-stat-notifications', String(unread));
    setText('dashboard-stat-notifications-caption', notifications.length
      ? (notifications[0].title || 'Notifikasi terbaru')
      : 'Belum ada notifikasi');

    const bookings = sortBookings(Storage.getBookings());
    if (!elements.recentOrders) {
      return;
    }

    if (!bookings.length) {
      elements.recentOrders.innerHTML = emptyState({
        icon: 'icon-ticket',
        title: 'Belum ada pesanan demo',
        message: 'Buat tiket demo untuk melihat ringkasan perjalanan dan riwayat Anda di sini.',
        action: '<a class="btn btn--primary btn--small" href="#/pesan">Pesan Tiket Demo</a>'
      });
    } else {
      elements.recentOrders.innerHTML = bookings.slice(0, 3).map((booking) => `
        <button class="dashboard-recent-order" type="button" data-booking-detail="${escape(booking.code)}">
          <span class="dashboard-recent-order__top">
            <span class="code-value">${escape(booking.code)}</span>
            ${statusBadge(booking.status)}
          </span>
          <strong>${escape(booking.originName)} → ${escape(booking.destinationName)}</strong>
          <span class="dashboard-recent-order__meta">${escape(Data.formatDate(booking.travelDate, 'short'))} · ${escape(booking.departure || '—')} · ${escape(getOperator(booking))}</span>
        </button>
      `).join('');
    }

    if (elements.recentNotifications) {
      if (!notifications.length) {
        elements.recentNotifications.innerHTML = emptyState({
          icon: 'icon-radio',
          title: 'Belum ada notifikasi demo',
          message: 'Kejadian pemesanan dan simulasi perjalanan akan muncul di sini.',
          action: '<button class="btn btn--secondary btn--small" type="button" data-dashboard-go="pesanan">Lihat Pesanan</button>'
        });
      } else {
        elements.recentNotifications.innerHTML = notifications.slice(0, 3).map((notification) => `
          <article class="dashboard-recent-notification ${notification.read ? '' : 'is-unread'}">
            <span class="dashboard-notification__dot" aria-hidden="true"></span>
            <div>
              <strong>${escape(notification.title)}</strong>
              <p>${escape(notification.message)}</p>
              <time datetime="${escape(notification.createdAt)}">${escape(formatDateTime(notification.createdAt))}</time>
            </div>
          </article>
        `).join('');
      }
    }
  }

  function renderOrderCard(booking) {
    const trackable = isTrackable(booking);
    const seats = getPassengerCount(booking);

    return `
      <article class="dashboard-order-card" data-order-card="${escape(booking.code)}">
        <div class="dashboard-order-card__top">
          <span class="booking-code">${escape(booking.code)}</span>
          ${statusBadge(booking.status)}
        </div>
        <div class="dashboard-order-card__route">
          <h3>${escape(booking.originName)} → ${escape(booking.destinationName)}</h3>
          <p>${escape(getOperator(booking))}${booking.busClass ? ` · ${escape(booking.busClass)}` : ''}</p>
        </div>
        <dl class="dashboard-order-facts">
          <div><dt>Tanggal</dt><dd>${escape(Data.formatDate(booking.travelDate, 'short'))}</dd></div>
          <div><dt>Keberangkatan</dt><dd>${escape(booking.departure || '—')}</dd></div>
          <div><dt>Jumlah kursi</dt><dd>${seats} kursi</dd></div>
          <div><dt>Total demo</dt><dd>${escape(Data.formatCurrency(booking.total))}</dd></div>
        </dl>
        <div class="dashboard-order-card__actions">
          <button class="btn btn--secondary btn--small" type="button" data-booking-detail="${escape(booking.code)}">
            <svg class="icon" aria-hidden="true"><use href="#icon-ticket"></use></svg>
            <span>Lihat Detail</span>
          </button>
          <button class="btn btn--primary btn--small" type="button" data-booking-track="${escape(booking.code)}" ${trackable ? '' : 'disabled'}>
            <svg class="icon" aria-hidden="true"><use href="#icon-navigation"></use></svg>
            <span>${trackable ? 'Lacak Bus' : 'Simulasi tidak tersedia'}</span>
          </button>
        </div>
      </article>
    `;
  }

  function renderOrders() {
    if (!elements.ordersList) {
      return;
    }

    const bookings = sortBookings(Storage.getBookings());
    const query = state.orderQuery.trim().toUpperCase();
    const filtered = bookings.filter((booking) => {
      const matchesCode = !query || String(booking.code).toUpperCase().indexOf(query) !== -1;
      const matchesStatus = state.orderStatus === 'Semua' ||
        getStatusGroup(booking.status) === state.orderStatus;
      return matchesCode && matchesStatus;
    });

    if (elements.orderCount) {
      elements.orderCount.textContent = `${filtered.length} pesanan ditampilkan`;
    }
    if (elements.markAll) {
      elements.markAll.disabled = Storage.getUnreadNotificationCount() === 0;
    }

    if (!bookings.length) {
      elements.ordersList.innerHTML = emptyState({
        icon: 'icon-ticket',
        title: 'Belum ada riwayat pesanan',
        message: 'Pesanan demo yang Anda buat akan muncul di sini beserta status dan tombol pelacakan.',
        action: '<a class="btn btn--primary" href="#/pesan">Buat Pesanan Demo</a>'
      });
      return;
    }

    if (!filtered.length) {
      elements.ordersList.innerHTML = emptyState({
        icon: 'icon-search',
        title: 'Pesanan tidak ditemukan',
        message: 'Coba kode pesanan lain atau ubah filter status yang dipilih.',
        action: '<button class="btn btn--secondary btn--small" type="button" data-dashboard-reset-filter>Reset Filter</button>'
      });
      return;
    }

    elements.ordersList.innerHTML = filtered.map(renderOrderCard).join('');
  }

  function renderTracking() {
    if (!elements.trackList) {
      return;
    }

    const bookings = sortBookings(Storage.getBookings()).filter(isUpcoming);
    if (!bookings.length) {
      elements.trackList.innerHTML = emptyState({
        icon: 'icon-navigation',
        title: 'Belum ada perjalanan mendatang',
        message: 'Buat pesanan demo terlebih dahulu, lalu buka pelacakan simulasi dari dashboard atau halaman Lacak Bus.',
        action: '<a class="btn btn--primary btn--small" href="#/lacak">Buka Lacak Bus</a>'
      });
      return;
    }

    elements.trackList.innerHTML = bookings.map((booking) => {
      const trackable = isTrackable(booking);
      return `
        <article class="dashboard-track-card">
          <div>
            <span class="code-value">${escape(booking.code)}</span>
            <h3>${escape(booking.originName)} → ${escape(booking.destinationName)}</h3>
            <p>${escape(Data.formatDate(booking.travelDate, 'short'))} · ${escape(booking.departure || '—')} · ${escape(getOperator(booking))}</p>
          </div>
          <button class="btn btn--primary btn--small" type="button" data-booking-track="${escape(booking.code)}" ${trackable ? '' : 'disabled'}>
            <svg class="icon" aria-hidden="true"><use href="#icon-navigation"></use></svg>
            <span>${trackable ? 'Lacak Simulasi' : 'Tidak tersedia'}</span>
          </button>
        </article>
      `;
    }).join('');
  }

  function notificationIcon(type) {
    const icon = {
      success: 'icon-check-circle',
      warning: 'icon-alert-triangle',
      error: 'icon-x-circle',
      info: 'icon-info'
    }[type] || 'icon-info';
    return `<svg class="icon" aria-hidden="true"><use href="#${icon}"></use></svg>`;
  }

  function renderNotifications() {
    if (!elements.notificationList) {
      return;
    }

    const notifications = Storage.getNotifications();
    const unread = notifications.filter((item) => !item.read).length;
    setText('dashboard-notification-count', `${unread} belum dibaca`);
    if (elements.markAll) {
      elements.markAll.disabled = unread === 0;
    }

    if (!notifications.length) {
      elements.notificationList.innerHTML = emptyState({
        icon: 'icon-radio',
        title: 'Belum ada notifikasi demo',
        message: 'Notifikasi dibuat saat pesanan demo disimpan atau simulasi perjalanan berjalan.',
        action: '<a class="btn btn--primary btn--small" href="#/pesan">Buat Pesanan Demo</a>'
      });
      return;
    }

    elements.notificationList.innerHTML = notifications.map((notification) => `
      <article class="dashboard-notification ${notification.read ? '' : 'is-unread'}" data-notification-id="${escape(notification.id)}">
        <span class="dashboard-notification__icon dashboard-notification__icon--${escape(notification.type)}">${notificationIcon(notification.type)}</span>
        <div class="dashboard-notification__body">
          <div class="dashboard-notification__top">
            <strong>${escape(notification.title)}</strong>
            <time datetime="${escape(notification.createdAt)}">${escape(formatDateTime(notification.createdAt))}</time>
          </div>
          <p>${escape(notification.message)}</p>
          <div class="dashboard-notification__foot">
            ${notification.code ? `<span class="code-value">${escape(notification.code)}</span>` : '<span></span>'}
            <div>
              ${notification.read ? '' : `<button class="btn btn--ghost btn--small" type="button" data-notification-read="${escape(notification.id)}">Tandai dibaca</button>`}
              <button class="btn btn--ghost btn--small dashboard-notification__delete" type="button" data-notification-delete="${escape(notification.id)}">Hapus</button>
            </div>
          </div>
        </div>
      </article>
    `).join('');
  }

  function fillProfileForm() {
    const profile = Storage.getProfile();
    const fields = [
      [elements.profileName, profile.name],
      [elements.profileEmail, profile.email],
      [elements.profilePhone, profile.phone]
    ];
    fields.forEach(([field, value]) => {
      if (field && field !== document.activeElement) {
        field.value = value;
      }
    });
  }

  function fillSettingsForm() {
    const settings = Storage.getSettings();
    if (elements.settingNotifications) {
      elements.settingNotifications.checked = settings.notificationsEnabled;
    }
    if (elements.settingCompact) {
      elements.settingCompact.checked = settings.compactMode;
    }
  }

  function applySettings() {
    const settings = Storage.getSettings();
    document.body.classList.toggle('dashboard-compact', settings.compactMode);
  }

  function clearProfileError(id) {
    const error = get(id);
    const input = get(id.replace(/-error$/, ''));
    if (input) {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
    }
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }

  function showProfileError(id, message) {
    const error = get(id);
    const input = get(id.replace(/-error$/, ''));
    if (input) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function validateProfile() {
    clearProfileError('dashboard-profile-name-input-error');
    clearProfileError('dashboard-profile-email-input-error');
    clearProfileError('dashboard-profile-phone-input-error');

    const name = elements.profileName ? elements.profileName.value.trim() : '';
    const email = elements.profileEmail ? elements.profileEmail.value.trim() : '';
    const phone = elements.profilePhone ? elements.profilePhone.value.trim() : '';
    let valid = true;
    let firstInvalid = null;

    if (name.length < 2 || name.length > 60) {
      showProfileError('dashboard-profile-name-input-error', 'Nama tampilan harus 2–60 karakter.');
      valid = false;
      firstInvalid = firstInvalid || elements.profileName;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showProfileError('dashboard-profile-email-input-error', 'Masukkan alamat email demo yang valid.');
      valid = false;
      firstInvalid = firstInvalid || elements.profileEmail;
    }
    if (!/^[0-9+()\-\s]+$/.test(phone) || phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 15) {
      showProfileError('dashboard-profile-phone-input-error', 'Masukkan nomor telepon demo dengan 8–15 digit.');
      valid = false;
      firstInvalid = firstInvalid || elements.profilePhone;
    }

    if (!valid && firstInvalid) {
      firstInvalid.focus();
    }

    return valid ? { name, email, phone } : null;
  }

  function handleProfileSubmit(event) {
    event.preventDefault();
    const values = validateProfile();
    if (!values) {
      Notifications.error('Periksa kembali data profil demo yang ditandai.');
      return;
    }

    Storage.saveProfile(values);
    if (Storage.isAvailable()) {
      Notifications.success('Profil demo diperbarui dan disimpan di LocalStorage browser ini.');
    } else {
      Notifications.warning('Profil demo diperbarui untuk sesi ini, tetapi penyimpanan permanen tidak tersedia.');
    }
  }

  function handleSettingsSubmit(event) {
    event.preventDefault();
    Storage.saveSettings({
      notificationsEnabled: Boolean(elements.settingNotifications && elements.settingNotifications.checked),
      compactMode: Boolean(elements.settingCompact && elements.settingCompact.checked)
    });
    Notifications.success('Pengaturan demo disimpan di browser ini.');
  }

  function handleResetData() {
    Notifications.confirm({
      title: 'Hapus semua data demo?',
      bodyHTML: `
        <p class="modal-lead">Tindakan ini akan menghapus pesanan demo, notifikasi, profil, dan pengaturan SmartShuttle yang tersimpan di browser ini.</p>
        <div class="notice-box">
          <svg class="icon" aria-hidden="true"><use href="#icon-alert-triangle"></use></svg>
          <p>Hanya key LocalStorage SmartShuttle yang dihapus. Data situs lain tetap aman. Tindakan ini tidak dapat dibatalkan.</p>
        </div>
      `,
      confirmLabel: 'Ya, hapus data demo',
      cancelLabel: 'Batal',
      variant: 'danger'
    }).then((confirmed) => {
      if (!confirmed) {
        return;
      }
      Storage.resetDemoData();
      state.orderQuery = '';
      state.orderStatus = 'Semua';
      state.activeTicket = null;
      if (elements.orderSearch) {
        elements.orderSearch.value = '';
      }
      if (elements.orderStatus) {
        elements.orderStatus.value = 'Semua';
      }
      renderAll();
      setView('ringkasan');
      Notifications.success('Data demo SmartShuttle telah dihapus dari browser ini.');
    });
  }

  function renderTicket(booking) {
    const passengers = Array.isArray(booking.passengerDetails) && booking.passengerDetails.length
      ? booking.passengerDetails
      : (Array.isArray(booking.seats)
        ? booking.seats.map((seat) => ({ seat, name: booking.contactName || 'Penumpang demo' }))
        : []);
    const seats = getPassengerCount(booking);
    const pricePerSeat = Number(booking.pricePerSeat) || 0;
    const serviceFee = Number(booking.serviceFee) || 0;
    const total = Number(booking.total) || 0;
    const arrivalSuffix = Number(booking.arrivalDayOffset) > 0 ? ' (+1 hari)' : '';

    return `
      <article class="ticket-print" aria-labelledby="dashboard-ticket-heading">
        <header class="ticket-print__head">
          <div class="ticket-print__brand">
            <span class="brand__mark"><svg class="icon" aria-hidden="true"><use href="#icon-bus"></use></svg></span>
            <span><strong>SmartShuttle</strong><small>Tiket perjalanan demo</small></span>
          </div>
          <div class="ticket-print__code">
            <span>Kode pesanan</span>
            <strong>${escape(booking.code)}</strong>
            ${statusBadge(booking.status)}
          </div>
        </header>

        <section class="ticket-print__hero">
          <div>
            <span class="eyebrow eyebrow--plain">Rute perjalanan</span>
            <h2 id="dashboard-ticket-heading">${escape(booking.originName)} → ${escape(booking.destinationName)}</h2>
            <p>${escape(booking.originTerminal || 'Terminal asal')} menuju ${escape(booking.destinationTerminal || 'Terminal tujuan')}</p>
          </div>
          <div class="ticket-print__operator">
            <span>Operator</span>
            <strong>${escape(getOperator(booking))}</strong>
            <small>${escape(booking.busName || 'Bus demo')}${booking.busClass ? ` · ${escape(booking.busClass)}` : ''}</small>
          </div>
        </section>

        <dl class="ticket-print__facts">
          <div><dt>Tanggal perjalanan</dt><dd>${escape(Data.formatDate(booking.travelDate))}</dd></div>
          <div><dt>Keberangkatan</dt><dd>${escape(booking.departure || '—')}</dd></div>
          <div><dt>Perkiraan tiba</dt><dd>${escape(booking.arrival || '—')}${escape(arrivalSuffix)}</dd></div>
          <div><dt>Jumlah kursi</dt><dd>${seats} kursi</dd></div>
          <div><dt>Nomor kursi</dt><dd>${escape(formatSeats(booking))}</dd></div>
          <div><dt>Status pesanan</dt><dd>${escape(getStatusLabel(booking))}</dd></div>
        </dl>

        <div class="ticket-print__columns">
          <section class="ticket-print__section">
            <h3>Penumpang demo</h3>
            <ul class="ticket-print__passengers">
              ${passengers.map((passenger) => `
                <li>
                  <span>${escape(passenger.name || 'Penumpang demo')}</span>
                  <span class="seat-chip">Kursi ${escape(passenger.seat || '—')}</span>
                </li>
              `).join('') || '<li><span>Penumpang demo</span><span>Kursi —</span></li>'}
            </ul>
            <dl class="ticket-print__small-facts">
              <div><dt>Nama pemesan</dt><dd>${escape(booking.contactName || '—')}</dd></div>
              <div><dt>Telepon demo</dt><dd>${escape(booking.contactPhone || '—')}</dd></div>
              <div><dt>Email demo</dt><dd>${escape(booking.contactEmail || '—')}</dd></div>
            </dl>
          </section>

          <section class="ticket-print__section">
            <h3>Ringkasan pembayaran demo</h3>
            <dl class="ticket-print__payment">
              <div><dt>Harga per kursi</dt><dd>${escape(Data.formatCurrency(pricePerSeat))}</dd></div>
              <div><dt>Jumlah kursi</dt><dd>${seats}</dd></div>
              <div><dt>Biaya layanan</dt><dd>${escape(Data.formatCurrency(serviceFee))}</dd></div>
              <div class="ticket-print__total"><dt>Total demo</dt><dd>${escape(Data.formatCurrency(total))}</dd></div>
            </dl>
            <p class="ticket-print__payment-status">${escape(booking.paymentLabel || 'Pembayaran demo')} · ${escape(booking.paymentStatus || 'Demo berhasil')}</p>
          </section>
        </div>

        <footer class="ticket-print__foot">
          <p>Tiket ini adalah data demo yang tersimpan di LocalStorage browser. Bukan bukti perjalanan, pembayaran, atau transaksi nyata.</p>
          <span>Dibuat ${escape(formatDateTime(booking.createdAt))}</span>
        </footer>
      </article>
    `;
  }

  function openTicket(id) {
    const booking = Storage.getBookingById(id);
    if (!booking) {
      Notifications.error('Pesanan demo tidak ditemukan. Muat ulang dashboard dan coba lagi.');
      return;
    }

    state.activeTicket = booking.code;
    if (elements.ticketDetail) {
      elements.ticketDetail.innerHTML = renderTicket(booking);
    }
    setView('tiket');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function printTicket() {
    if (!state.activeTicket) {
      return;
    }

    const cleanup = () => {
      document.body.classList.remove('is-printing-ticket');
      window.removeEventListener('afterprint', cleanup);
    };

    document.body.classList.add('is-printing-ticket');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(() => {
      window.print();
    }, 40);
    window.setTimeout(cleanup, 2000);
  }

  function trackBooking(id) {
    const booking = Storage.getBookingById(id);
    if (!booking) {
      Notifications.error('Pesanan demo tidak ditemukan.');
      return;
    }
    if (!isTrackable(booking)) {
      Notifications.warning('Rute pesanan ini belum memiliki geometri simulasi.');
      return;
    }
    if (!Tracking || typeof Tracking.trackCode !== 'function') {
      Notifications.error('Modul pelacakan simulasi belum tersedia.');
      return;
    }

    Tracking.trackCode(booking.code);
    window.location.hash = '#/lacak';
  }

  function setView(view) {
    const nextView = VIEWS.includes(view) ? view : 'ringkasan';
    if (nextView === 'tiket' && !state.activeTicket) {
      state.view = 'pesanan';
    } else {
      state.view = nextView;
    }

    document.querySelectorAll('[data-dashboard-view-panel]').forEach((panel) => {
      panel.hidden = panel.getAttribute('data-dashboard-view-panel') !== state.view;
    });
    document.querySelectorAll('[data-dashboard-view]').forEach((button) => {
      const isActive = button.getAttribute('data-dashboard-view') === state.view;
      button.classList.toggle('is-active', isActive);
      if (isActive) {
        button.setAttribute('aria-current', 'page');
      } else {
        button.removeAttribute('aria-current');
      }
    });
  }

  function renderAll() {
    if (!elements.root) {
      return;
    }
    updateBadges();
    renderSummary();
    renderOrders();
    renderTracking();
    renderNotifications();
    fillProfileForm();
    fillSettingsForm();
    applySettings();
    setView(state.view);
  }

  function handleDashboardClick(event) {
    const menuButton = event.target.closest('[data-dashboard-view]');
    if (menuButton) {
      setView(menuButton.getAttribute('data-dashboard-view'));
      return;
    }

    const goButton = event.target.closest('[data-dashboard-go]');
    if (goButton) {
      setView(goButton.getAttribute('data-dashboard-go'));
      return;
    }

    const detailButton = event.target.closest('[data-booking-detail]');
    if (detailButton) {
      openTicket(detailButton.getAttribute('data-booking-detail'));
      return;
    }

    const trackButton = event.target.closest('[data-booking-track]');
    if (trackButton && !trackButton.disabled) {
      trackBooking(trackButton.getAttribute('data-booking-track'));
      return;
    }

    const readButton = event.target.closest('[data-notification-read]');
    if (readButton) {
      Storage.markNotificationRead(readButton.getAttribute('data-notification-read'));
      return;
    }

    const deleteButton = event.target.closest('[data-notification-delete]');
    if (deleteButton) {
      const deleted = Storage.deleteNotification(deleteButton.getAttribute('data-notification-delete'));
      if (deleted) {
        Notifications.info('Notifikasi demo dihapus.');
      }
      return;
    }

    const resetFilter = event.target.closest('[data-dashboard-reset-filter]');
    if (resetFilter) {
      state.orderQuery = '';
      state.orderStatus = 'Semua';
      if (elements.orderSearch) {
        elements.orderSearch.value = '';
      }
      if (elements.orderStatus) {
        elements.orderStatus.value = 'Semua';
      }
      renderOrders();
    }
  }

  function init() {
    if (state.initialized) {
      return;
    }

    elements.root = get('dashboard');
    if (!elements.root) {
      return;
    }

    elements.recentOrders = get('dashboard-recent-orders');
    elements.recentNotifications = get('dashboard-recent-notifications');
    elements.ordersList = get('dashboard-orders-list');
    elements.orderCount = get('dashboard-order-count');
    elements.orderSearch = get('dashboard-order-search');
    elements.orderStatus = get('dashboard-order-status');
    elements.trackList = get('dashboard-track-list');
    elements.notificationList = get('dashboard-notification-list');
    elements.markAll = get('dashboard-mark-all');
    elements.profileName = get('dashboard-profile-name-input');
    elements.profileEmail = get('dashboard-profile-email-input');
    elements.profilePhone = get('dashboard-profile-phone-input');
    elements.profileForm = get('dashboard-profile-form');
    elements.settingNotifications = get('dashboard-settings-notifications');
    elements.settingCompact = get('dashboard-settings-compact');
    elements.settingsForm = get('dashboard-settings-form');
    elements.resetButton = get('dashboard-reset-data');
    elements.ticketDetail = get('dashboard-ticket-detail');
    elements.ticketBack = get('dashboard-ticket-back');
    elements.ticketPrint = get('dashboard-ticket-print');

    if (elements.orderSearch) {
      elements.orderSearch.addEventListener('input', () => {
        state.orderQuery = elements.orderSearch.value;
        renderOrders();
      });
    }

    if (elements.orderStatus) {
      elements.orderStatus.addEventListener('change', () => {
        state.orderStatus = elements.orderStatus.value;
        renderOrders();
      });
    }

    if (elements.markAll) {
      elements.markAll.addEventListener('click', () => {
        const count = Storage.markAllNotificationsRead();
        if (count > 0) {
          Notifications.success(`${count} notifikasi demo ditandai sebagai dibaca.`);
        } else {
          Notifications.info('Semua notifikasi demo sudah dibaca.');
        }
      });
    }

    if (elements.profileForm) {
      elements.profileForm.addEventListener('submit', handleProfileSubmit);
      elements.profileForm.addEventListener('input', (event) => {
        const field = event.target;
        if (field && field.id) {
          clearProfileError(`${field.id}-error`);
        }
      });
    }

    if (elements.settingsForm) {
      elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
    }

    if (elements.resetButton) {
      elements.resetButton.addEventListener('click', handleResetData);
    }

    if (elements.ticketBack) {
      elements.ticketBack.addEventListener('click', () => setView('pesanan'));
    }

    if (elements.ticketPrint) {
      elements.ticketPrint.addEventListener('click', printTicket);
    }

    elements.root.addEventListener('click', handleDashboardClick);

    document.addEventListener('smartshuttle:bookingschange', renderAll);
    document.addEventListener('smartshuttle:notificationschange', renderAll);
    document.addEventListener('smartshuttle:profilechange', renderAll);
    document.addEventListener('smartshuttle:settingschange', renderAll);

    document.addEventListener('smartshuttle:sectionchange', (event) => {
      if (event.detail && event.detail.route === 'dashboard') {
        renderAll();
        setView(state.view);
      } else {
        updateBadges();
      }
    });

    state.initialized = true;
    renderAll();
  }

  function open(view) {
    if (!state.initialized) {
      init();
    }
    setView(view || 'ringkasan');
    if (state.view === 'ringkasan') {
      state.activeTicket = null;
      if (elements.ticketDetail) {
        elements.ticketDetail.innerHTML = '';
      }
    }
    renderAll();
  }

  window.SmartShuttleDashboard = {
    init,
    open,
    refresh: renderAll,
    setView
  };
})(window);
