// The Life page: live time and weather in each city, the journey between them, and the photo album.
(() => {
  const CITIES = {
    melbourne: { tz: 'Australia/Melbourne', lat: -37.81, lon: 144.96 },
    sydney: { tz: 'Australia/Sydney', lat: -33.87, lon: 151.21 },
    perth: { tz: 'Australia/Perth', lat: -31.95, lon: 115.86 },
    singapore: { tz: 'Asia/Singapore', lat: 1.29, lon: 103.85 },
    'hong kong': { tz: 'Asia/Hong_Kong', lat: 22.32, lon: 114.17 },
    shanghai: { tz: 'Asia/Shanghai', lat: 31.23, lon: 121.47 },
    london: { tz: 'Europe/London', lat: 51.51, lon: -0.13 },
    'los angeles': { tz: 'America/Los_Angeles', lat: 34.05, lon: -118.24 },
    'new york': { tz: 'America/New_York', lat: 40.71, lon: -74.01 },
  };
  const find = (name) => CITIES[String(name || '').trim().toLowerCase()];

  // Open-Meteo weather codes, in plain words.
  const WEATHER = [
    [[0], 'Clear skies', 'Clear night'],
    [[1], 'Mostly sunny', 'Mostly clear'],
    [[2], 'Partly cloudy', 'Partly cloudy'],
    [[3], 'Overcast', 'Overcast'],
    [[45, 48], 'Foggy', 'Foggy'],
    [[51, 53, 55, 56, 57], 'Drizzle', 'Drizzle'],
    [[61, 63, 66, 80, 81], 'Rain', 'Rain'],
    [[65, 67, 82], 'Heavy rain', 'Heavy rain'],
    [[71, 73, 75, 77, 85, 86], 'Snow', 'Snow'],
    [[95, 96, 99], 'Thunderstorms', 'Thunderstorms'],
  ];
  const describe = (code, isDay) => {
    const row = WEATHER.find(([codes]) => codes.includes(code));
    return row ? (isDay ? row[1] : row[2]) : '';
  };

  /* ---------- Clocks ---------- */
  const cards = [...document.querySelectorAll('[data-city]')];
  const tick = () => {
    cards.forEach((card) => {
      const c = find(card.dataset.city);
      if (!c) return;
      const now = new Date();
      card.querySelector('[data-city-time]').textContent = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', timeZone: c.tz })
        .format(now)
        .replace(/\s?([ap])m$/i, ' $1m');
      const hour = Number(new Intl.DateTimeFormat('en-AU', { hour: 'numeric', hourCycle: 'h23', timeZone: c.tz }).format(now));
      const part = hour < 5 ? 'Late night' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night';
      const day = new Intl.DateTimeFormat('en-AU', { weekday: 'long', timeZone: c.tz }).format(now);
      card.querySelector('[data-city-day]').textContent = `${day} ${part.toLowerCase()}`;
      card.classList.toggle('city--night', hour < 6 || hour >= 19);
    });
  };
  tick();
  setInterval(tick, 20000);

  /* ---------- Weather ---------- */
  cards.forEach((card) => {
    const c = find(card.dataset.city);
    const out = card.querySelector('[data-city-weather]');
    if (!c) {
      out.textContent = '';
      return;
    }
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code,is_day&timezone=auto`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const cur = d.current;
        out.textContent = `${Math.round(cur.temperature_2m)}°C, ${describe(cur.weather_code, cur.is_day).toLowerCase() || 'right now'}`;
      })
      .catch(() => (out.textContent = ''));
  });

  /* ---------- The journey ---------- */
  const journey = document.querySelector('[data-journey]');
  if (journey) {
    const a = find(journey.dataset.from);
    const b = find(journey.dataset.to);
    const facts = journey.querySelector('[data-journey-facts]');
    if (a && b) {
      const rad = (x) => (x * Math.PI) / 180;
      const km = Math.round(
        (6371 * 2 * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2))) / 10
      ) * 10;
      const offset = (tz) => {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
        const m = (parts.find((p) => p.type === 'timeZoneName') || {}).value.match(/GMT([+-]\d+)?(?::(\d+))?/);
        return m ? Number(m[1] || 0) + (m[2] ? Number(m[2]) / 60 : 0) * Math.sign(Number(m[1] || 1)) : 0;
      };
      const diff = offset(a.tz) - offset(b.tz);
      const hrs = Math.abs(diff);
      const when = diff === 0 ? 'same time zone' : `${journey.dataset.to} is ${hrs} hour${hrs === 1 ? '' : 's'} ${diff > 0 ? 'behind' : 'ahead'}`;
      const flight = Math.round((km / 800 + 0.5) * 2) / 2;
      facts.textContent = `${km.toLocaleString('en-AU')} km apart, about ${flight} hours by plane, ${when}.`;
    }
    // Fly the little plane along the arc, unless the visitor prefers less motion.
    const path = journey.querySelector('.journey__path');
    const plane = journey.querySelector('.journey__plane');
    const len = path.getTotalLength();
    const place = (t) => {
      const p = path.getPointAtLength(t * len);
      const q = path.getPointAtLength(Math.min(len, t * len + 1));
      const ang = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      plane.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${ang})`);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) place(0.55);
    else {
      let start = 0;
      const loop = (ts) => {
        if (!start) start = ts;
        const t = ((ts - start) / 7000) % 1;
        place(t);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  /* ---------- Photo album ---------- */
  const dataEl = document.querySelector('[data-album-data]');
  const box = document.querySelector('[data-lightbox]');
  if (dataEl && box) {
    const photos = JSON.parse(dataEl.textContent);
    const img = box.querySelector('img');
    const cap = box.querySelector('figcaption');
    let i = 0;
    const show = (n) => {
      i = (n + photos.length) % photos.length;
      const p = photos[i];
      img.src = p.src;
      img.alt = p.caption;
      cap.textContent = [p.caption, [p.place, p.date].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    };
    document.querySelectorAll('[data-photo]').forEach((btn) =>
      btn.addEventListener('click', () => {
        show(Number(btn.dataset.photo));
        box.showModal();
      })
    );
    box.querySelectorAll('[data-lb]').forEach((b) => b.addEventListener('click', () => show(i + Number(b.dataset.lb))));
    box.querySelector('[data-lb-close]').addEventListener('click', () => box.close());
    box.addEventListener('click', (e) => e.target === box && box.close());
    box.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(i + 1);
      if (e.key === 'ArrowLeft') show(i - 1);
    });
    // Swipe on phones.
    let x0 = null;
    box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    box.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }
})();
