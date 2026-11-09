(function (window) {
  'use strict';

  const Data = window.SmartShuttleData;

  function getSeatState(seatNumber, selectedSeats, occupiedSeats) {
    if (occupiedSeats.has(seatNumber)) {
      return 'occupied';
    }
    if (selectedSeats.has(seatNumber)) {
      return 'selected';
    }
    return 'available';
  }

  function getSeatLabel(seatNumber, status, locked) {
    if (status === 'occupied') {
      return `Kursi ${seatNumber}, sudah dipesan`;
    }
    if (locked) {
      return `Kursi ${seatNumber}, tidak dapat dipilih`;
    }
    if (status === 'selected') {
      return `Kursi ${seatNumber}, dipilih. Klik untuk membatalkan`;
    }
    return `Kursi ${seatNumber}, tersedia`;
  }

  function buildStateIcon(status) {
    const icon = document.createElement('span');
    icon.className = 'bus-seat__state';
    icon.setAttribute('aria-hidden', 'true');

    if (status === 'selected') {
      icon.innerHTML = '<svg class="icon"><use href="#icon-check"></use></svg>';
    } else if (status === 'occupied') {
      icon.innerHTML = '<svg class="icon"><use href="#icon-x"></use></svg>';
    } else {
      icon.textContent = '○';
    }
    return icon;
  }

  function buildSeat(seatNumber, selectedSeats, occupiedSeats, locked) {
    const status = getSeatState(seatNumber, selectedSeats, occupiedSeats);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `bus-seat bus-seat--${status}`;
    button.setAttribute('data-seat', String(seatNumber));
    button.setAttribute('aria-pressed', status === 'selected' ? 'true' : 'false');
    button.setAttribute('aria-label', getSeatLabel(seatNumber, status, locked));

    const number = document.createElement('span');
    number.className = 'bus-seat__number';
    number.textContent = String(seatNumber);
    button.appendChild(number);
    button.appendChild(buildStateIcon(status));

    if (status === 'occupied' || locked) {
      button.disabled = true;
    }
    return button;
  }

  function buildFront() {
    const front = document.createElement('div');
    front.className = 'bus-cabin__front';
    front.innerHTML = `
      <div class="bus-cabin__windshield">
        <span>Depan bus</span>
        <small>Arah perjalanan</small>
      </div>
      <div class="bus-cabin__front-row">
        <span class="bus-cabin__door">
          <svg class="icon" aria-hidden="true"><use href="#icon-arrow-left"></use></svg>
          Pintu
        </span>
        <span class="bus-cabin__driver">
          <svg class="icon" aria-hidden="true"><use href="#icon-user"></use></svg>
          Pengemudi
        </span>
      </div>
    `;
    return front;
  }

  function buildAxis() {
    const axis = document.createElement('div');
    axis.className = 'bus-cabin__axis';
    axis.setAttribute('aria-hidden', 'true');
    axis.innerHTML = '<span>Kiri</span><span>Lorong</span><span>Kanan</span>';
    return axis;
  }

  function buildRow(row, selectedSeats, occupiedSeats, locked) {
    const rowElement = document.createElement('div');
    rowElement.className = 'bus-seat-row';

    const left = document.createElement('div');
    left.className = 'bus-seat-pair bus-seat-pair--left';
    row.left.forEach((seat) => left.appendChild(buildSeat(seat, selectedSeats, occupiedSeats, locked)));

    const aisle = document.createElement('span');
    aisle.className = 'bus-aisle';
    aisle.setAttribute('aria-hidden', 'true');
    aisle.innerHTML = '<span>Lorong</span>';

    const right = document.createElement('div');
    right.className = 'bus-seat-pair bus-seat-pair--right';
    row.right.forEach((seat) => right.appendChild(buildSeat(seat, selectedSeats, occupiedSeats, locked)));

    rowElement.appendChild(left);
    rowElement.appendChild(aisle);
    rowElement.appendChild(right);
    return rowElement;
  }

  function buildEmpty(message) {
    const empty = document.createElement('p');
    empty.className = 'seat-map__empty';
    empty.textContent = message;
    return empty;
  }

  function render(container, config) {
    if (!container) {
      return;
    }

    const options = config || {};
    const schedule = options.schedule;
    container.innerHTML = '';

    if (!schedule || !options.travelDate) {
      container.appendChild(buildEmpty(options.emptyMessage || 'Pilih jadwal dan tanggal untuk melihat ketersediaan kursi.'));
      return;
    }

    const selectedSeats = new Set((options.selectedSeats || []).map(Number));
    const occupiedSeats = options.occupiedSeats instanceof Set
      ? options.occupiedSeats
      : new Set(Array.isArray(options.occupiedSeats) ? options.occupiedSeats.map(Number) : []);
    const locked = Boolean(options.locked);

    const cabin = document.createElement('div');
    cabin.className = `bus-cabin${locked ? ' bus-cabin--locked' : ''}`;
    cabin.setAttribute('role', 'group');
    cabin.setAttribute('aria-label', options.label || `Denah ${schedule.seatCapacity} kursi bus, dua kursi di kiri dan dua kursi di kanan lorong`);
    cabin.appendChild(buildFront());
    cabin.appendChild(buildAxis());

    const rows = document.createElement('div');
    rows.className = 'bus-cabin__rows';
    Data.getSeatRows(schedule).forEach((row) => {
      rows.appendChild(buildRow(row, selectedSeats, occupiedSeats, locked));
    });

    cabin.appendChild(rows);
    container.appendChild(cabin);
  }

  function paint(container, selectedSeatList) {
    if (!container) {
      return;
    }

    const selectedSeats = new Set((selectedSeatList || []).map(Number));
    container.querySelectorAll('[data-seat]').forEach((button) => {
      if (button.disabled) {
        return;
      }

      const seatNumber = Number(button.getAttribute('data-seat'));
      const isSelected = selectedSeats.has(seatNumber);
      button.classList.toggle('bus-seat--selected', isSelected);
      button.classList.toggle('bus-seat--available', !isSelected);
      button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      button.setAttribute('aria-label', getSeatLabel(seatNumber, isSelected ? 'selected' : 'available', false));

      let state = button.querySelector('.bus-seat__state');
      if (!state) {
        state = buildStateIcon(isSelected ? 'selected' : 'available');
        button.appendChild(state);
      } else if (isSelected) {
        state.innerHTML = '<svg class="icon"><use href="#icon-check"></use></svg>';
      } else {
        state.textContent = '○';
      }
    });
  }

  window.SmartShuttleSeatMap = {
    render,
    paint
  };
})(window);
