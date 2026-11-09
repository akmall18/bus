(function (window) {
  'use strict';

  const Data = window.SmartShuttleData;
  const Storage = window.SmartShuttleStorage;
  const Notifications = window.SmartShuttleNotifications;
  const SeatMap = window.SmartShuttleSeatMap;

  const PAYMENT_LABELS = {
    transfer: 'Transfer bank demo',
    ewallet: 'E-wallet demo',
    counter: 'Bayar di loket demo'
  };

  const state = {
    initialized: false,
    selectedSeats: [],
    passengerDrafts: {},
    submitting: false,
    currentBooking: null
  };

  const elements = {};

  function get(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const element = get(id);
    if (element) {
      element.textContent = value;
    }
  }

  function isDateInPast(value) {
    if (!value) {
      return true;
    }
    return value < Data.getTodayISO();
  }

  function populateCitySelect(select, selectedId, placeholder) {
    if (!select) {
      return;
    }
    select.innerHTML = '';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder || 'Pilih kota';
    select.appendChild(placeholderOption);

    Data.CITIES.forEach((city) => {
      const option = document.createElement('option');
      option.value = city.id;
      option.textContent = city.name;
      if (city.id === selectedId) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }

  function populateDestinationSelect(selectedId) {
    if (!elements.destination) {
      return;
    }
    const originId = elements.origin.value;
    const currentValue = selectedId || elements.destination.value;
    elements.destination.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Pilih kota tujuan';
    elements.destination.appendChild(placeholder);

    Data.CITIES.filter((city) => city.id !== originId).forEach((city) => {
      const option = document.createElement('option');
      option.value = city.id;
      option.textContent = city.name;
      if (city.id === currentValue) {
        option.selected = true;
      }
      elements.destination.appendChild(option);
    });

    if (!elements.destination.value) {
      const firstOption = elements.destination.querySelector('option[value=""]');
      if (firstOption) {
        firstOption.selected = true;
      }
    }
  }

  function getRoute() {
    if (!elements.origin || !elements.destination) {
      return null;
    }
    return Data.getRoute(elements.origin.value, elements.destination.value);
  }

  function getSelectedSchedule() {
    if (!elements.schedule || !elements.schedule.value) {
      return null;
    }
    return Data.getSchedule(elements.schedule.value);
  }

  function getPassengerCount() {
    return Math.max(1, Math.min(6, Number(elements.passengers.value) || 1));
  }

  function getPriceBreakdown() {
    const schedule = getSelectedSchedule();
    const seatCount = state.selectedSeats.length;
    const price = Data.calculatePrice(schedule ? schedule.price : 0, schedule ? seatCount : 0);
    return Object.assign({ schedule }, price);
  }

  function getPassengerInputs() {
    if (!elements.passengerFields) {
      return [];
    }
    return Array.from(elements.passengerFields.querySelectorAll('[data-passenger-name]'));
  }

  function syncPassengerDrafts() {
    const activeSeats = new Set(state.selectedSeats);
    getPassengerInputs().forEach((input) => {
      const seat = Number(input.getAttribute('data-passenger-seat'));
      if (!Number.isInteger(seat) || !activeSeats.has(seat)) {
        return;
      }
      const value = input.value.trim();
      if (value) {
        state.passengerDrafts[seat] = value;
      } else {
        delete state.passengerDrafts[seat];
      }
    });
  }

  function createPassengerRow(seat, index) {
    const row = document.createElement('div');
    row.className = 'passenger-row';
    row.setAttribute('data-passenger-seat', String(seat));

    const seatBlock = document.createElement('div');
    seatBlock.className = 'passenger-row__seat';
    const seatKicker = document.createElement('span');
    seatKicker.textContent = `Penumpang ${index + 1}`;
    const seatValue = document.createElement('strong');
    seatValue.textContent = `Kursi ${seat}`;
    seatBlock.append(seatKicker, seatValue);

    const field = document.createElement('div');
    field.className = 'field';
    const inputId = index === 0 ? 'booking-name' : `booking-passenger-${index + 1}`;
    const errorId = index === 0 ? 'booking-name-error' : `booking-passenger-${index + 1}-error`;
    const label = document.createElement('label');
    label.className = 'form-label';
    label.setAttribute('for', inputId);
    label.textContent = 'Nama lengkap penumpang';

    const input = document.createElement('input');
    input.className = 'form-control';
    input.type = 'text';
    input.id = inputId;
    input.name = `booking-passenger-${index + 1}`;
    input.autocomplete = index === 0 ? 'name' : 'off';
    input.placeholder = 'Contoh: Rani Prameswari';
    input.required = true;
    input.setAttribute('aria-describedby', errorId);
    input.setAttribute('data-passenger-name', 'true');
    input.setAttribute('data-passenger-seat', String(seat));
    input.setAttribute('data-error-id', errorId);
    input.value = state.passengerDrafts[seat] || '';

    const error = document.createElement('p');
    error.className = 'field-error';
    error.id = errorId;
    error.setAttribute('role', 'alert');
    error.hidden = true;

    const clearInputState = () => {
      clearFieldError(input, errorId);
      clearFieldError(elements.passengerFields, 'booking-passengers-fields-error');
      updateReviewSummary();
      updateBookingSteps();
    };
    input.addEventListener('input', clearInputState);
    input.addEventListener('change', clearInputState);

    field.append(label, input, error);
    row.append(seatBlock, field);
    return row;
  }

  function renderPassengerFields() {
    if (!elements.passengerFields) {
      return;
    }

    syncPassengerDrafts();
    elements.passengerFields.textContent = '';

    if (state.selectedSeats.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'passenger-empty';
      const title = document.createElement('strong');
      title.textContent = 'Belum ada kursi dipilih';
      const description = document.createElement('p');
      description.textContent = 'Pilih kursi pada langkah 2. Form nama penumpang akan muncul otomatis sesuai kursi yang dipilih.';
      empty.append(title, description);
      elements.passengerFields.appendChild(empty);
      return;
    }

    state.selectedSeats.forEach((seat, index) => {
      elements.passengerFields.appendChild(createPassengerRow(seat, index));
    });
  }

  function getPassengerData() {
    return getPassengerInputs().map((input) => ({
      seat: Number(input.getAttribute('data-passenger-seat')),
      name: input.value.trim()
    })).filter((passenger) => Number.isInteger(passenger.seat));
  }

  function getPaymentMethod() {
    if (!elements.form) {
      return '';
    }
    const selected = elements.form.querySelector('input[name="booking-payment-method"]:checked');
    return selected ? selected.value : '';
  }

  function getPaymentLabel() {
    const method = getPaymentMethod();
    return PAYMENT_LABELS[method] || 'Belum dipilih';
  }

  function routeExistsForSelection() {
    return Boolean(getRoute());
  }

  function renderSchedules(options) {
    const config = options || {};
    if (!elements.schedule) {
      return;
    }

    if (config.resetSeats !== false) {
      state.selectedSeats = [];
      state.passengerDrafts = {};
    }

    const route = getRoute();
    elements.schedule.innerHTML = '';

    if (!route) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Pilih kota asal dan tujuan terlebih dahulu';
      elements.schedule.appendChild(option);
      elements.schedule.disabled = true;
      renderSeatMap();
      updateSummary();
      return;
    }

    const travelDate = elements.date ? elements.date.value : '';
    const schedules = travelDate ? Data.getAvailableSchedules(route.id, travelDate) : [];

    if (schedules.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Tidak ada jadwal pada tanggal ini';
      elements.schedule.appendChild(option);
      elements.schedule.disabled = true;
      state.selectedSeats = [];
      renderSeatMap();
      updateSummary();
      return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Pilih jadwal keberangkatan';
    elements.schedule.appendChild(placeholder);

    schedules.forEach((schedule) => {
      const option = document.createElement('option');
      option.value = schedule.id;
      option.textContent = `${schedule.departure} · ${schedule.operatorName} · ${schedule.busClass} · ${Data.formatCurrency(schedule.price)}`;
      elements.schedule.appendChild(option);
    });

    elements.schedule.disabled = false;

    if (config.preserveSchedule && elements.schedule.querySelector(`option[value="${config.preserveSchedule}"]`)) {
      elements.schedule.value = config.preserveSchedule;
    } else {
      const firstSchedule = elements.schedule.querySelector('option[value]:not([value=""])');
      if (firstSchedule) {
        firstSchedule.selected = true;
      }
    }

    if (config.resetSeats !== false) {
      state.selectedSeats = [];
    }

    renderSeatMap();
    updateSummary();
  }

  function getOccupiedSeats(schedule, travelDate) {
    const occupied = Data.getDemoOccupiedSeats(schedule, travelDate);
    Storage.getBookedSeats(schedule.id, travelDate).forEach((seat) => occupied.add(seat));
    return occupied;
  }

  function renderSeatMap() {
    if (!elements.seatMap) {
      return;
    }

    const schedule = getSelectedSchedule();
    const selectedDate = elements.date ? elements.date.value : '';
    if (!schedule || !selectedDate) {
      SeatMap.render(elements.seatMap, {
        emptyMessage: 'Pilih jadwal dan tanggal untuk melihat ketersediaan kursi.'
      });
      setText('booking-seat-capacity', '— kursi demo');
      updateSeatHint(0);
      return;
    }

    const occupied = getOccupiedSeats(schedule, selectedDate);
    state.selectedSeats = state.selectedSeats.filter((seat) => {
      return seat <= schedule.seatCapacity && !occupied.has(seat);
    });

    SeatMap.render(elements.seatMap, {
      schedule,
      travelDate: selectedDate,
      selectedSeats: state.selectedSeats,
      occupiedSeats: occupied,
      label: `Denah ${schedule.seatCapacity} kursi ${schedule.operatorName}, dua kursi di kiri dan dua kursi di kanan lorong`
    });

    setText('booking-seat-capacity', `${schedule.seatCapacity} kursi demo`);
    updateSeatHint(state.selectedSeats.length);
  }

  function updateSeatHint(count) {
    if (!elements.seatHint) {
      return;
    }
    const passengerCount = getPassengerCount();
    if (count === passengerCount) {
      elements.seatHint.textContent = `${count} dari ${passengerCount} kursi dipilih. Kursi sudah sesuai jumlah penumpang.`;
      elements.seatHint.classList.add('is-complete');
    } else {
      elements.seatHint.textContent = `${count} dari ${passengerCount} kursi dipilih. Pilih ${passengerCount - count} kursi lagi.`;
      elements.seatHint.classList.remove('is-complete');
    }
  }

  function paintSeats() {
    if (!elements.seatMap) {
      return;
    }
    const passengerCount = getPassengerCount();

    SeatMap.paint(elements.seatMap, state.selectedSeats);

    updateSeatHint(state.selectedSeats.length);
    if (state.selectedSeats.length === passengerCount) {
      clearFieldError(elements.seatMap, 'booking-seats-error');
    }
    updateSummary();
  }

  function toggleSeat(seatNumber) {
    if (state.selectedSeats.includes(seatNumber)) {
      state.selectedSeats = state.selectedSeats.filter((seat) => seat !== seatNumber);
      paintSeats();
      return;
    }

    if (state.selectedSeats.length >= getPassengerCount()) {
      Notifications.warning(`Jumlah kursi sudah sesuai untuk ${getPassengerCount()} penumpang. Kurangi pilihan kursi terlebih dahulu.`);
      return;
    }

    state.selectedSeats.push(seatNumber);
    state.selectedSeats.sort((first, second) => first - second);
    paintSeats();
  }

  function updateSummary() {
    const schedule = getSelectedSchedule();
    const route = getRoute();
    const travelDate = elements.date ? elements.date.value : '';

    if (elements.summaryRoute) {
      elements.summaryRoute.textContent = route
        ? `${route.originName} → ${route.destinationName}`
        : 'Belum ada rute dipilih';
    }

    if (elements.summarySchedule) {
      elements.summarySchedule.textContent = schedule
        ? `${schedule.departure} – ${schedule.arrival}${schedule.arrivalDayOffset ? ' (+1 hari)' : ''}`
        : '—';
    }

    if (elements.summaryDate) {
      elements.summaryDate.textContent = travelDate ? Data.formatDate(travelDate) : 'Belum dipilih';
    }

    if (elements.summaryBus) {
      elements.summaryBus.textContent = schedule ? `${schedule.busName} · ${schedule.busClass}` : '—';
    }

    if (elements.summarySeatList) {
      elements.summarySeatList.innerHTML = '';
      if (state.selectedSeats.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'summary-empty';
        empty.textContent = 'Belum ada kursi dipilih';
        elements.summarySeatList.appendChild(empty);
      } else {
        state.selectedSeats.forEach((seat) => {
          const chip = document.createElement('span');
          chip.className = 'seat-chip';
          chip.textContent = `Kursi ${seat}`;
          elements.summarySeatList.appendChild(chip);
        });
      }
    }

    const breakdown = getPriceBreakdown();

    if (elements.summaryFareLabel) {
      elements.summaryFareLabel.textContent = `Tiket × ${breakdown.seatCount}`;
    }
    if (elements.summaryFare) {
      elements.summaryFare.textContent = schedule ? Data.formatCurrency(breakdown.fare) : '—';
    }
    if (elements.summaryService) {
      elements.summaryService.textContent = schedule ? Data.formatCurrency(breakdown.serviceFee) : '—';
    }
    if (elements.summaryTotal) {
      elements.summaryTotal.textContent = schedule ? Data.formatCurrency(breakdown.total) : '—';
    }

    renderPassengerFields();
    updateReviewSummary();
    updateBookingSteps();

    if (elements.scheduleMeta) {
      if (!route) {
        elements.scheduleMeta.textContent = 'Pilih rute untuk melihat detail perjalanan.';
      } else if (!schedule) {
        elements.scheduleMeta.textContent = 'Tidak ada jadwal pada tanggal ini. Pilih tanggal lain untuk melihat keberangkatan yang tersedia.';
      } else {
        elements.scheduleMeta.textContent = `Tiba di ${route.destinationTerminal} pukul ${schedule.arrival}${schedule.arrivalDayOffset ? ' hari berikutnya' : ''}. Durasi ${Data.formatDuration(schedule.durationMinutes)}.`;
      }
    }

    if (elements.submit) {
      elements.submit.disabled = !schedule || state.submitting;
    }
  }

  function updateReviewSummary() {
    const route = getRoute();
    const schedule = getSelectedSchedule();
    const travelDate = elements.date ? elements.date.value : '';
    const breakdown = getPriceBreakdown();

    if (elements.reviewRoute) {
      elements.reviewRoute.textContent = route
        ? `${route.originName} → ${route.destinationName}`
        : 'Belum ada rute dipilih';
    }

    if (elements.reviewSchedule) {
      if (schedule && travelDate) {
        elements.reviewSchedule.textContent = `${Data.formatDate(travelDate)} · ${schedule.departure}–${schedule.arrival}${schedule.arrivalDayOffset ? ' (+1 hari)' : ''}`;
      } else {
        elements.reviewSchedule.textContent = 'Belum ada jadwal dipilih';
      }
    }

    if (elements.reviewPassengers) {
      const passengers = getPassengerData();
      if (passengers.length === 0) {
        elements.reviewPassengers.textContent = 'Belum ada kursi dipilih';
      } else {
        elements.reviewPassengers.textContent = passengers
          .map((passenger, index) => `${passenger.name || `Penumpang ${index + 1}`} · Kursi ${passenger.seat}`)
          .join(', ');
      }
    }

    if (elements.reviewTotal) {
      elements.reviewTotal.textContent = schedule ? Data.formatCurrency(breakdown.total) : '—';
    }
  }

  function updateBookingSteps() {
    const steps = Array.from(document.querySelectorAll('.booking-step'));
    if (steps.length === 0) {
      return;
    }

    const schedule = getSelectedSchedule();
    const travelDate = elements.date ? elements.date.value : '';
    const detailsReady = Boolean(
      elements.origin &&
      elements.destination &&
      elements.origin.value &&
      elements.destination.value &&
      travelDate &&
      !isDateInPast(travelDate) &&
      schedule &&
      getRoute()
    );
    const seatsReady = detailsReady && state.selectedSeats.length === getPassengerCount();
    const passengerInputs = getPassengerInputs();
    const passengerNamesReady = passengerInputs.length > 0 && passengerInputs.every((input) => input.value.trim().length >= 3);
    const phoneDigits = elements.phone ? elements.phone.value.replace(/\D/g, '') : '';
    const phoneReady = phoneDigits.length >= 9 && phoneDigits.length <= 15;
    const emailReady = elements.email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(elements.email.value.trim()) : false;
    const passengersReady = seatsReady && passengerNamesReady && phoneReady && emailReady;
    const paymentReady = passengersReady && Boolean(getPaymentMethod()) && Boolean(elements.terms && elements.terms.checked);
    const successVisible = Boolean(state.currentBooking && elements.success && !elements.success.hidden);

    let activeIndex = 0;
    if (detailsReady) {
      activeIndex = 1;
    }
    if (seatsReady) {
      activeIndex = 2;
    }
    if (passengersReady) {
      activeIndex = 3;
    }
    if (paymentReady || successVisible) {
      activeIndex = 4;
    }

    const completedCount = successVisible ? 5 : activeIndex;
    steps.forEach((step, index) => {
      const isActive = index === activeIndex;
      const isComplete = index < completedCount;
      step.classList.toggle('is-active', isActive);
      step.classList.toggle('is-complete', isComplete);
      if (isActive) {
        step.setAttribute('aria-current', 'step');
      } else {
        step.removeAttribute('aria-current');
      }
    });
  }

  function clearFieldError(field, errorId) {
    if (field) {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    }
    const error = errorId ? get(errorId) : null;
    if (error) {
      error.textContent = '';
      error.hidden = true;
    }
  }

  function setFieldError(field, errorId, message) {
    if (field) {
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
    }
    const error = errorId ? get(errorId) : null;
    if (error) {
      error.textContent = message;
      error.hidden = false;
    }
  }

  function clearAllErrors() {
    clearFieldError(elements.origin, 'booking-origin-error');
    clearFieldError(elements.destination, 'booking-destination-error');
    clearFieldError(elements.date, 'booking-date-error');
    clearFieldError(elements.passengers, 'booking-passengers-error');
    clearFieldError(elements.schedule, 'booking-schedule-error');
    clearFieldError(elements.seatMap, 'booking-seats-error');
    getPassengerInputs().forEach((input) => clearFieldError(input, input.getAttribute('data-error-id')));
    clearFieldError(elements.passengerFields, 'booking-passengers-fields-error');
    clearFieldError(elements.phone, 'booking-phone-error');
    clearFieldError(elements.email, 'booking-email-error');
    clearFieldError(elements.paymentMethods, 'booking-payment-error');
    clearFieldError(elements.terms, 'booking-terms-error');
  }

  function validateForm() {
    clearAllErrors();
    const invalidFields = [];
    let isValid = true;

    if (!elements.origin.value) {
      setFieldError(elements.origin, 'booking-origin-error', 'Pilih kota asal.');
      invalidFields.push(elements.origin);
      isValid = false;
    }

    if (!elements.destination.value) {
      setFieldError(elements.destination, 'booking-destination-error', 'Pilih kota tujuan.');
      invalidFields.push(elements.destination);
      isValid = false;
    } else if (elements.origin.value === elements.destination.value) {
      setFieldError(elements.destination, 'booking-destination-error', 'Kota tujuan harus berbeda dari kota asal.');
      invalidFields.push(elements.destination);
      isValid = false;
    }

    if (!elements.date.value || isDateInPast(elements.date.value)) {
      setFieldError(elements.date, 'booking-date-error', 'Pilih tanggal keberangkatan hari ini atau setelahnya.');
      invalidFields.push(elements.date);
      isValid = false;
    }

    if (!routeExistsForSelection()) {
      setFieldError(elements.destination, 'booking-destination-error', 'Rute demo untuk pasangan kota ini belum tersedia.');
      invalidFields.push(elements.destination);
      isValid = false;
    }

    if (!elements.schedule.value || !getSelectedSchedule()) {
      setFieldError(elements.schedule, 'booking-schedule-error', 'Pilih jadwal keberangkatan.');
      invalidFields.push(elements.schedule);
      isValid = false;
    }

    if (state.selectedSeats.length !== getPassengerCount()) {
      setFieldError(elements.seatMap, 'booking-seats-error', `Pilih tepat ${getPassengerCount()} kursi sesuai jumlah penumpang.`);
      invalidFields.push(elements.seatMap);
      isValid = false;
    }

    const passengerInputs = getPassengerInputs();
    if (passengerInputs.length === 0) {
      setFieldError(elements.passengerFields, 'booking-passengers-fields-error', 'Pilih kursi terlebih dahulu agar form data penumpang muncul.');
      invalidFields.push(elements.passengerFields);
      isValid = false;
    }

    passengerInputs.forEach((input, index) => {
      if (input.value.trim().length < 3) {
        const errorId = input.getAttribute('data-error-id') || `booking-passenger-${index + 1}-error`;
        setFieldError(input, errorId, `Nama penumpang ${index + 1} minimal 3 karakter.`);
        invalidFields.push(input);
        isValid = false;
      }
    });

    const phoneDigits = elements.phone.value.replace(/\D/g, '');
    if (phoneDigits.length < 9 || phoneDigits.length > 15) {
      setFieldError(elements.phone, 'booking-phone-error', 'Masukkan nomor telepon dengan 9–15 digit.');
      invalidFields.push(elements.phone);
      isValid = false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(elements.email.value.trim())) {
      setFieldError(elements.email, 'booking-email-error', 'Masukkan alamat email yang valid.');
      invalidFields.push(elements.email);
      isValid = false;
    }

    if (!getPaymentMethod()) {
      setFieldError(elements.paymentMethods, 'booking-payment-error', 'Pilih satu metode pembayaran simulasi.');
      const firstPayment = elements.form.querySelector('input[name="booking-payment-method"]');
      invalidFields.push(firstPayment || elements.paymentMethods);
      isValid = false;
    }

    if (!elements.terms.checked) {
      setFieldError(elements.terms, 'booking-terms-error', 'Centang pernyataan bahwa Anda memahami pemesanan dan pembayaran ini adalah simulasi.');
      invalidFields.push(elements.terms);
      isValid = false;
    }

    if (!isValid) {
      const firstInvalid = invalidFields.find(Boolean);
      if (firstInvalid && typeof firstInvalid.focus === 'function') {
        firstInvalid.focus({ preventScroll: false });
        const panel = firstInvalid.closest('.form-panel');
        if (panel) {
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    return isValid;
  }

  function createBookingCode() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const year = new Date().getFullYear();
    let code = '';
    let attempts = 0;

    do {
      code = `SS-${year}-`;
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        const values = new Uint32Array(5);
        window.crypto.getRandomValues(values);
        values.forEach((value) => {
          code += characters[value % characters.length];
        });
      } else {
        for (let index = 0; index < 5; index += 1) {
          code += characters[Math.floor(Math.random() * characters.length)];
        }
      }
      attempts += 1;
    } while (attempts < 20 && (Storage.findBooking(code) || Data.getDemoTrip(code)));

    return code;
  }

  function setSubmitLoading(isLoading) {
    if (!elements.submit) {
      return;
    }
    state.submitting = isLoading;
    elements.submit.classList.toggle('is-loading', isLoading);
    elements.submit.disabled = isLoading || !getSelectedSchedule();
    elements.submit.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    const label = elements.submit.querySelector('.btn__label');
    if (label) {
      label.textContent = isLoading ? 'Memproses pembayaran demo...' : 'Konfirmasi Pembayaran Demo';
    }
  }

  function createBooking(schedule, route) {
    const passengerDetails = getPassengerData();
    const breakdown = getPriceBreakdown();
    const code = createBookingCode();
    const paymentMethod = getPaymentMethod();
    const booking = {
      id: code,
      code,
      createdAt: new Date().toISOString(),
      status: 'Terjadwal',
      scheduleId: schedule.id,
      busId: schedule.busId,
      routeId: route.id,
      originId: route.originId,
      destinationId: route.destinationId,
      originName: route.originName,
      destinationName: route.destinationName,
      originTerminal: route.originTerminal,
      destinationTerminal: route.destinationTerminal,
      travelDate: elements.date.value,
      departure: schedule.departure,
      arrival: schedule.arrival,
      arrivalDayOffset: schedule.arrivalDayOffset,
      durationMinutes: schedule.durationMinutes,
      busName: schedule.busName,
      busClass: schedule.busClass,
      operatorId: schedule.operatorId,
      operatorName: schedule.operatorName,
      busImage: schedule.image,
      busCode: schedule.busCode,
      plate: schedule.plate,
      driverName: schedule.driverName,
      passengers: passengerDetails.length,
      passengerDetails,
      seats: state.selectedSeats.slice(),
      contactName: passengerDetails[0] ? passengerDetails[0].name : '',
      contactPhone: elements.phone.value.trim(),
      contactEmail: elements.email.value.trim(),
      notes: elements.notes.value.trim(),
      paymentMethod,
      paymentLabel: PAYMENT_LABELS[paymentMethod] || 'Belum dipilih',
      paymentStatus: 'Demo berhasil',
      pricePerSeat: schedule.price,
      serviceFee: breakdown.serviceFee,
      total: breakdown.total
    };

    return booking;
  }

  function renderSuccess(booking) {
    if (!elements.success) {
      return;
    }

    if (elements.successCode) {
      elements.successCode.textContent = booking.code;
    }
    if (elements.successRoute) {
      elements.successRoute.textContent = `${booking.originName} → ${booking.destinationName}`;
    }
    if (elements.successDate) {
      elements.successDate.textContent = Data.formatDate(booking.travelDate);
    }
    if (elements.successTime) {
      elements.successTime.textContent = `${booking.departure} – ${booking.arrival}${booking.arrivalDayOffset ? ' (+1 hari)' : ''}`;
    }
    if (elements.successSeats) {
      elements.successSeats.textContent = booking.seats.join(', ');
    }
    if (elements.successTotal) {
      elements.successTotal.textContent = Data.formatCurrency(booking.total);
    }
    if (elements.successName) {
      elements.successName.textContent = booking.contactName;
    }
    if (elements.successTerminal) {
      elements.successTerminal.textContent = booking.originTerminal;
    }
    if (elements.successPayment) {
      elements.successPayment.textContent = booking.paymentLabel || 'Demo berhasil';
    }

    if (elements.successPassengersList) {
      elements.successPassengersList.textContent = '';
      const passengers = Array.isArray(booking.passengerDetails)
        ? booking.passengerDetails
        : booking.seats.map((seat) => ({ seat, name: booking.contactName || 'Penumpang demo' }));
      passengers.forEach((passenger, index) => {
        const item = document.createElement('li');
        const name = document.createElement('strong');
        name.textContent = passenger.name || `Penumpang ${index + 1}`;
        const seat = document.createElement('span');
        seat.className = 'seat-chip';
        seat.textContent = `Kursi ${passenger.seat}`;
        item.append(name, seat);
        elements.successPassengersList.appendChild(item);
      });
    }

    elements.success.setAttribute('aria-label', `Tiket demo ${booking.code} berhasil dibuat`);
    if (elements.flow) {
      elements.flow.hidden = true;
    }
    elements.success.hidden = false;
    updateBookingSteps();
    const heading = elements.success.querySelector('h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    elements.success.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.submitting) {
      return;
    }

    if (!validateForm()) {
      Notifications.error('Periksa kembali kolom yang ditandai sebelum melanjutkan.');
      return;
    }

    const schedule = getSelectedSchedule();
    const route = getRoute();
    if (!schedule || !route) {
      Notifications.error('Rute atau jadwal belum tersedia.');
      return;
    }

    setSubmitLoading(true);

    window.setTimeout(() => {
      const booking = createBooking(schedule, route);
      const saved = Storage.saveBooking(booking);
      state.currentBooking = booking;
      setSubmitLoading(false);
      renderSuccess(booking);

      if (saved) {
        Notifications.success(`Tiket demo ${booking.code} berhasil disimpan di browser ini.`);
        if (typeof Notifications.notify === 'function') {
          Notifications.notify({
            type: 'success',
            title: 'Pesanan demo berhasil dibuat',
            message: `Pesanan ${booking.code} untuk rute ${booking.originName} menuju ${booking.destinationName} tersimpan di browser ini.`,
            eventKey: `booking-created:${booking.code}`,
            code: booking.code,
            toast: false
          });
        }
      } else {
        Notifications.warning(`Tiket demo ${booking.code} dibuat, tetapi penyimpanan permanen tidak tersedia. Data hanya bertahan selama tab ini terbuka.`);
      }
    }, 900);
  }

  function resetForm() {
    if (!elements.form) {
      return;
    }

    elements.form.reset();
    state.selectedSeats = [];
    state.passengerDrafts = {};
    state.currentBooking = null;

    if (elements.origin) {
      elements.origin.value = 'jkt';
    }
    populateDestinationSelect('bdg');
    if (elements.destination) {
      elements.destination.value = 'bdg';
    }
    if (elements.date) {
      elements.date.min = Data.getTodayISO();
      elements.date.value = Data.addDaysISO(1);
    }
    if (elements.passengers) {
      elements.passengers.value = '1';
    }
    clearAllErrors();
    renderSchedules({ resetSeats: true });
    updateSummary();
  }

  function showBookingFlow() {
    if (elements.success) {
      elements.success.hidden = true;
    }
    if (elements.flow) {
      elements.flow.hidden = false;
    }
    updateBookingSteps();
  }

  function prefillFromSearch(draft) {
    if (!state.initialized || !draft) {
      return;
    }

    showBookingFlow();
    const originCity = Data.getCity(draft.origin);
    const destinationCity = Data.getCity(draft.destination);

    if (originCity) {
      populateCitySelect(elements.origin, draft.origin, 'Pilih kota');
    }
    populateDestinationSelect(destinationCity ? draft.destination : '');

    if (originCity && destinationCity && draft.origin !== draft.destination) {
      elements.destination.value = draft.destination;
    }

    if (draft.date && !isDateInPast(draft.date)) {
      elements.date.value = draft.date;
    }

    const passengerCount = Math.max(1, Math.min(6, Number(draft.passengers) || 1));
    if (elements.passengers) {
      elements.passengers.value = String(passengerCount);
    }

    state.selectedSeats = [];
    state.passengerDrafts = {};
    renderSchedules({ resetSeats: true });
    updateSummary();
    clearAllErrors();
    elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function prefillFromBus(busId, draft, preselectedSeats) {
    if (!state.initialized) {
      return false;
    }

    const schedule = Data.getBusById(busId);
    if (!schedule) {
      return false;
    }

    const route = Data.getRouteById(schedule.routeId);
    if (!route) {
      return false;
    }

    showBookingFlow();
    populateCitySelect(elements.origin, schedule.originId, 'Pilih kota asal');
    populateCitySelect(elements.destination, schedule.destinationId, 'Pilih kota tujuan');
    populateDestinationSelect(schedule.destinationId);
    elements.origin.value = schedule.originId;
    elements.destination.value = schedule.destinationId;

    const requestedDate = draft && draft.date ? draft.date : Data.addDaysISO(1);
    const travelDate = isDateInPast(requestedDate) ? Data.addDaysISO(1) : requestedDate;
    if (elements.date) {
      elements.date.min = Data.getTodayISO();
      elements.date.value = travelDate;
    }

    const passengerCount = Math.max(1, Math.min(6, Number(draft && draft.passengers) || 1));
    if (elements.passengers) {
      elements.passengers.value = String(passengerCount);
    }

    state.selectedSeats = [];
    clearAllErrors();
    renderSchedules({ preserveSchedule: schedule.id, resetSeats: true });
    updateSummary();

    if (elements.schedule.value !== schedule.id) {
      Notifications.warning('Jadwal bus tersebut tidak tersedia pada tanggal yang dipilih. Silakan pilih bus lain.');
      return false;
    }

    if (Array.isArray(preselectedSeats) && preselectedSeats.length > 0) {
      const occupied = getOccupiedSeats(schedule, travelDate);
      const availableSeats = preselectedSeats
        .map(Number)
        .filter((seat) => Number.isInteger(seat) && seat > 0 && seat <= schedule.seatCapacity && !occupied.has(seat));
      state.selectedSeats = Array.from(new Set(availableSeats))
        .sort((first, second) => first - second)
        .slice(0, passengerCount);
      renderSeatMap();
      updateSummary();
    }

    elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function bindField(input, errorId) {
    if (!input) {
      return;
    }
    const clear = () => clearFieldError(input, errorId);
    input.addEventListener('input', clear);
    input.addEventListener('change', clear);
  }

  function init() {
    if (state.initialized) {
      return;
    }

    elements.form = get('booking-form');
    elements.flow = get('booking-flow');
    elements.success = get('booking-success');
    elements.origin = get('booking-origin');
    elements.destination = get('booking-destination');
    elements.swap = get('booking-swap');
    elements.date = get('booking-date');
    elements.passengers = get('booking-passengers');
    elements.schedule = get('booking-schedule');
    elements.scheduleMeta = get('booking-schedule-meta');
    elements.seatMap = get('seat-map');
    elements.seatHint = get('seat-selection-note');
    elements.passengerFields = get('passenger-fields');
    elements.phone = get('booking-phone');
    elements.email = get('booking-email');
    elements.notes = get('booking-notes');
    elements.paymentMethods = get('booking-payment-methods');
    elements.terms = get('booking-terms');
    elements.submit = get('booking-submit');
    elements.reviewRoute = get('review-route');
    elements.reviewSchedule = get('review-schedule');
    elements.reviewPassengers = get('review-passengers');
    elements.reviewTotal = get('review-total');
    elements.summaryRoute = get('summary-route');
    elements.summarySchedule = get('summary-schedule');
    elements.summaryDate = get('summary-date');
    elements.summaryBus = get('summary-bus');
    elements.summarySeatList = get('summary-seat-list');
    elements.summaryFareLabel = get('summary-fare-label');
    elements.summaryFare = get('summary-fare');
    elements.summaryService = get('summary-service');
    elements.summaryTotal = get('summary-total');
    elements.successCode = get('success-code');
    elements.successRoute = get('success-route');
    elements.successDate = get('success-date');
    elements.successTime = get('success-time');
    elements.successSeats = get('success-seats');
    elements.successTotal = get('success-total');
    elements.successName = get('success-name');
    elements.successTerminal = get('success-terminal');
    elements.successPayment = get('success-payment');
    elements.successPassengersList = get('success-passengers-list');
    elements.successTrack = get('success-track');
    elements.successNew = get('success-new');

    if (!elements.form) {
      return;
    }

    populateCitySelect(elements.origin, 'jkt', 'Pilih kota asal');
    populateCitySelect(elements.destination, 'bdg', 'Pilih kota tujuan');
    populateDestinationSelect('bdg');
    elements.destination.value = 'bdg';

    if (elements.date) {
      elements.date.min = Data.getTodayISO();
      elements.date.value = Data.addDaysISO(1);
    }

    elements.origin.addEventListener('change', () => {
      populateDestinationSelect('');
      state.selectedSeats = [];
      clearFieldError(elements.origin, 'booking-origin-error');
      clearFieldError(elements.destination, 'booking-destination-error');
      renderSchedules({ resetSeats: true });
      updateSummary();
    });

    elements.destination.addEventListener('change', () => {
      state.selectedSeats = [];
      clearFieldError(elements.destination, 'booking-destination-error');
      renderSchedules({ resetSeats: true });
      updateSummary();
    });

    if (elements.swap) {
      elements.swap.addEventListener('click', () => {
        const origin = elements.origin.value;
        const destination = elements.destination.value;
        if (!origin || !destination) {
          Notifications.info('Pilih kota asal dan tujuan terlebih dahulu untuk menukar rute.');
          return;
        }
        elements.origin.value = destination;
        populateDestinationSelect(origin);
        elements.destination.value = origin;
        state.selectedSeats = [];
        renderSchedules({ resetSeats: true });
        updateSummary();
        Notifications.info('Kota asal dan tujuan ditukar.');
      });
    }

    elements.date.addEventListener('change', () => {
      state.selectedSeats = [];
      if (elements.date.value && isDateInPast(elements.date.value)) {
        setFieldError(elements.date, 'booking-date-error', 'Tanggal tidak boleh di masa lalu.');
      } else {
        clearFieldError(elements.date, 'booking-date-error');
      }
      renderSchedules({
        preserveSchedule: elements.schedule ? elements.schedule.value : '',
        resetSeats: true
      });
      updateSummary();
    });

    elements.passengers.addEventListener('change', () => {
      const limit = getPassengerCount();
      if (state.selectedSeats.length > limit) {
        state.selectedSeats = state.selectedSeats.slice(0, limit);
      }
      paintSeats();
      updateSeatHint(state.selectedSeats.length);
      updateSummary();
    });

    elements.schedule.addEventListener('change', () => {
      state.selectedSeats = [];
      state.passengerDrafts = {};
      clearFieldError(elements.schedule, 'booking-schedule-error');
      renderSeatMap();
      updateSummary();
    });

    if (elements.seatMap) {
      elements.seatMap.addEventListener('click', (event) => {
        const seatButton = event.target.closest('[data-seat]');
        if (!seatButton || seatButton.disabled) {
          return;
        }
        toggleSeat(Number(seatButton.getAttribute('data-seat')));
      });
    }

    bindField(elements.origin, 'booking-origin-error');
    bindField(elements.destination, 'booking-destination-error');
    bindField(elements.date, 'booking-date-error');
    bindField(elements.passengers, 'booking-passengers-error');
    bindField(elements.schedule, 'booking-schedule-error');
    bindField(elements.phone, 'booking-phone-error');
    bindField(elements.email, 'booking-email-error');
    bindField(elements.terms, 'booking-terms-error');

    [elements.phone, elements.email].forEach((input) => {
      if (input) {
        input.addEventListener('input', updateBookingSteps);
        input.addEventListener('change', updateBookingSteps);
      }
    });

    if (elements.paymentMethods) {
      elements.paymentMethods.addEventListener('change', (event) => {
        if (!event.target.matches('input[name="booking-payment-method"]')) {
          return;
        }
        clearFieldError(elements.paymentMethods, 'booking-payment-error');
        updateBookingSteps();
      });
    }

    if (elements.terms) {
      elements.terms.addEventListener('change', updateBookingSteps);
    }

    elements.form.addEventListener('submit', handleSubmit);

    if (elements.successTrack) {
      elements.successTrack.addEventListener('click', () => {
        if (!state.currentBooking) {
          return;
        }
        if (window.SmartShuttleTracking) {
          window.SmartShuttleTracking.trackCode(state.currentBooking.code);
        }
        window.location.hash = '#/lacak';
      });
    }

    if (elements.successNew) {
      elements.successNew.addEventListener('click', () => {
        resetForm();
        showBookingFlow();
        elements.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }

    state.initialized = true;
    renderSchedules({ resetSeats: true });
    updateSummary();
  }

  window.SmartShuttleBooking = {
    init,
    prefillFromSearch,
    prefillFromBus,
    resetForm
  };
})(window);
