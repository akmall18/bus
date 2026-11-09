(function (window) {
  'use strict';

  const Data = window.SmartShuttleData;

  const POINTS = {
    jkt: [-6.1708, 106.9540],
    bekasi: [-6.2383, 106.9756],
    karawang: [-6.3010, 107.3060],
    cikampek: [-6.4020, 107.4580],
    purwakarta: [-6.5570, 107.4430],
    padalarang: [-6.8430, 107.4780],
    bdg: [-6.9024, 107.6530],
    cileunyi: [-6.9370, 107.6990],
    sumedang: [-6.8580, 107.9230],
    kadipaten: [-6.7560, 108.1670],
    cirebon: [-6.7320, 108.5520],
    brebes: [-6.8720, 109.0430],
    tegal: [-6.8690, 109.1250],
    pemalang: [-6.8910, 109.3800],
    pekalongan: [-6.8890, 109.6750],
    batang: [-6.9120, 109.7350],
    smg: [-6.9550, 110.4290],
    ungaran: [-7.1390, 110.4050],
    bawen: [-7.2270, 110.4370],
    ambarawa: [-7.2620, 110.4040],
    magelang: [-7.4700, 110.2170],
    yog: [-7.8350, 110.3900],
    solo: [-7.5750, 110.8240],
    ngawi: [-7.4100, 111.4460],
    madiun: [-7.6290, 111.5230],
    kertosono: [-7.5940, 112.1050],
    jombang: [-7.5460, 112.2260],
    sby: [-7.3570, 112.7230],
    pwt: [-7.4350, 109.2520],
    purbalingga: [-7.3880, 109.3630],
    banyumas: [-7.5150, 109.2940],
    gombong: [-7.6080, 109.5140],
    kebumen: [-7.6690, 109.6520],
    purworejo: [-7.7140, 110.0080]
  };

  const CORRIDOR_DEFINITIONS = {
    'jkt-bdg': {
      path: ['jkt', 'bekasi', 'karawang', 'cikampek', 'purwakarta', 'padalarang', 'bdg'],
      stops: ['Terminal Pulo Gebang', 'Rest Area KM 57', 'Rest Area KM 97', 'Terminal Cicaheum']
    },
    'jkt-pwt': {
      path: ['jkt', 'bekasi', 'karawang', 'cikampek', 'cirebon', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'purbalingga', 'pwt'],
      stops: ['Terminal Pulo Gebang', 'Rest Area KM 207', 'Rest Area Pekalongan', 'Terminal Bulupitu']
    },
    'jkt-smg': {
      path: ['jkt', 'bekasi', 'karawang', 'cikampek', 'cirebon', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'batang', 'smg'],
      stops: ['Terminal Pulo Gebang', 'Rest Area KM 207', 'Rest Area KM 379', 'Terminal Terboyo']
    },
    'jkt-yog': {
      path: ['jkt', 'bekasi', 'karawang', 'cikampek', 'cirebon', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'batang', 'smg', 'ungaran', 'bawen', 'ambarawa', 'magelang', 'yog'],
      stops: ['Terminal Pulo Gebang', 'Rest Area KM 207', 'Rest Area Bawen', 'Terminal Giwangan']
    },
    'jkt-sby': {
      path: ['jkt', 'bekasi', 'karawang', 'cikampek', 'cirebon', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'batang', 'smg', 'solo', 'ngawi', 'madiun', 'kertosono', 'jombang', 'sby'],
      stops: ['Terminal Pulo Gebang', 'Rest Area KM 207', 'Rest Area Ngawi', 'Terminal Bungurasih']
    },
    'bdg-pwt': {
      path: ['bdg', 'cileunyi', 'sumedang', 'kadipaten', 'cirebon', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'purbalingga', 'pwt'],
      stops: ['Terminal Cicaheum', 'Rest Area KM 130', 'Rest Area Pekalongan', 'Terminal Bulupitu']
    },
    'bdg-smg': {
      path: ['bdg', 'cileunyi', 'sumedang', 'kadipaten', 'cirebon', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'batang', 'smg'],
      stops: ['Terminal Cicaheum', 'Rest Area KM 130', 'Rest Area KM 379', 'Terminal Terboyo']
    },
    'bdg-yog': {
      path: ['bdg', 'cileunyi', 'sumedang', 'kadipaten', 'cirebon', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'batang', 'smg', 'ungaran', 'bawen', 'ambarawa', 'magelang', 'yog'],
      stops: ['Terminal Cicaheum', 'Rest Area KM 130', 'Rest Area Bawen', 'Terminal Giwangan']
    },
    'bdg-sby': {
      path: ['bdg', 'cileunyi', 'sumedang', 'kadipaten', 'cirebon', 'brebes', 'tegal', 'pemalang', 'pekalongan', 'batang', 'smg', 'solo', 'ngawi', 'madiun', 'kertosono', 'jombang', 'sby'],
      stops: ['Terminal Cicaheum', 'Rest Area KM 130', 'Rest Area Ngawi', 'Terminal Bungurasih']
    },
    'pwt-smg': {
      path: ['pwt', 'purbalingga', 'pemalang', 'pekalongan', 'batang', 'smg'],
      stops: ['Terminal Bulupitu', 'Rest Area Pemalang', 'Rest Area Batang', 'Terminal Terboyo']
    },
    'pwt-yog': {
      path: ['pwt', 'banyumas', 'gombong', 'kebumen', 'purworejo', 'yog'],
      stops: ['Terminal Bulupitu', 'Rest Area Gombong', 'Rest Area Purworejo', 'Terminal Giwangan']
    },
    'pwt-sby': {
      path: ['pwt', 'banyumas', 'gombong', 'kebumen', 'purworejo', 'yog', 'solo', 'ngawi', 'madiun', 'kertosono', 'jombang', 'sby'],
      stops: ['Terminal Bulupitu', 'Rest Area Kebumen', 'Rest Area Ngawi', 'Terminal Bungurasih']
    },
    'smg-yog': {
      path: ['smg', 'ungaran', 'bawen', 'ambarawa', 'magelang', 'yog'],
      stops: ['Terminal Terboyo', 'Rest Area Bawen', 'Rest Area Magelang', 'Terminal Giwangan']
    },
    'smg-sby': {
      path: ['smg', 'solo', 'ngawi', 'madiun', 'kertosono', 'jombang', 'sby'],
      stops: ['Terminal Terboyo', 'Rest Area Solo', 'Rest Area Ngawi', 'Terminal Bungurasih']
    },
    'yog-sby': {
      path: ['yog', 'solo', 'ngawi', 'madiun', 'kertosono', 'jombang', 'sby'],
      stops: ['Terminal Giwangan', 'Rest Area Solo', 'Rest Area Ngawi', 'Terminal Bungurasih']
    }
  };

  function toRadians(value) {
    return (value * Math.PI) / 180;
  }

  function distanceBetween(first, second) {
    const earthRadius = 6371;
    const deltaLat = toRadians(second[0] - first[0]);
    const deltaLng = toRadians(second[1] - first[1]);
    const a = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRadians(first[0])) * Math.cos(toRadians(second[0])) * Math.sin(deltaLng / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function buildGeometry(points) {
    const segments = [];
    let totalDistance = 0;
    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const distance = distanceBetween(start, end);
      segments.push({ start, end, distance, startDistance: totalDistance });
      totalDistance += distance;
    }
    return { points, segments, totalDistance };
  }

  function pointAtDistance(geometry, distance) {
    if (!geometry.points.length) {
      return null;
    }
    const target = Math.max(0, Math.min(geometry.totalDistance, distance));
    if (geometry.segments.length === 0) {
      return { lat: geometry.points[0][0], lng: geometry.points[0][1], segmentIndex: 0 };
    }

    for (let index = 0; index < geometry.segments.length; index += 1) {
      const segment = geometry.segments[index];
      if (target <= segment.startDistance + segment.distance || index === geometry.segments.length - 1) {
        const ratio = segment.distance === 0 ? 0 : (target - segment.startDistance) / segment.distance;
        return {
          lat: segment.start[0] + (segment.end[0] - segment.start[0]) * ratio,
          lng: segment.start[1] + (segment.end[1] - segment.start[1]) * ratio,
          segmentIndex: index
        };
      }
    }

    const last = geometry.points[geometry.points.length - 1];
    return { lat: last[0], lng: last[1], segmentIndex: geometry.segments.length - 1 };
  }

  function pointAtProgress(routeMap, progress) {
    if (!routeMap) {
      return null;
    }
    const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
    return pointAtDistance(routeMap.geometry, (safeProgress / 100) * routeMap.geometry.totalDistance);
  }

  function sliceAtProgress(routeMap, progress) {
    if (!routeMap || !routeMap.points.length) {
      return [];
    }
    const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0));
    if (safeProgress >= 100) {
      return routeMap.points.slice();
    }
    if (safeProgress <= 0) {
      return [routeMap.points[0].slice()];
    }

    const point = pointAtProgress(routeMap, safeProgress);
    const result = routeMap.points.slice(0, point.segmentIndex + 1).map((item) => item.slice());
    result.push([point.lat, point.lng]);
    return result;
  }

  function createProjection(routeMap, width, height, padding) {
    const points = routeMap.points;
    const minLat = Math.min(...points.map((point) => point[0]));
    const maxLat = Math.max(...points.map((point) => point[0]));
    const minLng = Math.min(...points.map((point) => point[1]));
    const maxLng = Math.max(...points.map((point) => point[1]));
    const latSpan = Math.max(0.0001, maxLat - minLat);
    const lngSpan = Math.max(0.0001, maxLng - minLng);
    const innerWidth = width - (padding * 2);
    const innerHeight = height - (padding * 2);

    return function project(point) {
      return {
        x: padding + ((point[1] - minLng) / lngSpan) * innerWidth,
        y: padding + ((maxLat - point[0]) / latSpan) * innerHeight
      };
    };
  }

  function buildRouteMap(baseId, routeId, definition, reversed) {
    const route = Data.getRouteById(routeId);
    if (!route) {
      return null;
    }

    const pathIds = reversed ? definition.path.slice().reverse() : definition.path.slice();
    const points = pathIds.map((id) => POINTS[id].slice());
    const geometry = buildGeometry(points);
    const stopNames = reversed ? definition.stops.slice().reverse() : definition.stops.slice();
    const simulationSeconds = Math.max(42, Math.min(75, Math.round(route.durationMinutes / 6)));
    const stops = [0, 0.36, 0.7, 1].map((offset, index) => ({
      name: stopNames[index],
      offset
    }));

    return {
      routeId,
      baseId,
      originId: route.originId,
      destinationId: route.destinationId,
      originName: route.originName,
      destinationName: route.destinationName,
      originTerminal: route.originTerminal,
      destinationTerminal: route.destinationTerminal,
      durationMinutes: route.durationMinutes,
      distanceKm: route.distanceKm,
      points,
      geometry,
      stops,
      simulationSeconds,
      minutesPerSecond: route.durationMinutes / simulationSeconds
    };
  }

  const ROUTE_MAP = {};

  Object.keys(CORRIDOR_DEFINITIONS).forEach((baseId) => {
    const definition = CORRIDOR_DEFINITIONS[baseId];
    const [fromId, toId] = baseId.split('-');
    const forwardId = `${fromId}-${toId}`;
    const reverseId = `${toId}-${fromId}`;
    const forward = buildRouteMap(baseId, forwardId, definition, false);
    const reverse = buildRouteMap(baseId, reverseId, definition, true);
    if (forward) {
      ROUTE_MAP[forwardId] = forward;
    }
    if (reverse) {
      ROUTE_MAP[reverseId] = reverse;
    }
  });

  window.SmartShuttleTrackingData = {
    ROUTE_MAP,
    getRouteMap(routeId) {
      return ROUTE_MAP[routeId] || null;
    },
    pointAtProgress,
    sliceAtProgress,
    createProjection
  };
})(window);
