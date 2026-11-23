/* Sereno · page chrome: smooth scroll, loader, nav, reveals, the stay clock, the booking planner.
   A classic script, so it runs before the 3D module and owns the shared clock. */
(function () {
  'use strict';

  /* ------------------------------------------------ booking details (edit me) */
  const CONFIG = {
    whatsapp: '919989542998',      // country code + number, no "+" or spaces
    weekday: 5999,                 // ₹ per night, up to `included` guests
    weekend: 6999,
    included: 8,
    extraPerHead: 250,
    weekendDays: [0, 6],           // check-in days charged at the weekend rate (0 = Sunday … 6 = Saturday)
    maxGuests: 60,
    checkIn: '12:30 PM',
    checkOut: '10:00 AM',
  };

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  gsap.registerPlugin(ScrollTrigger);

  /* ------------------------------------------------- shared maths */
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const seg = (p, a, b) => clamp01((p - a) / (b - a));
  const smooth = (t) => (t = clamp01(t), t * t * (3 - 2 * t));
  const progressOf = (el) => {
    const r = el.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    return span > 0 ? clamp01(-r.top / span) : r.top <= 0 ? 1 : 0;
  };
  const near = (el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > -100 && r.top < window.innerHeight + 100;
  };
  const cover = (el) => {
    if (!el) return 0;
    const r = el.getBoundingClientRect(), ih = window.innerHeight;
    return Math.max(0, Math.min(r.bottom, ih) - Math.max(r.top, 0)) / ih;
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  };
  /** Piecewise-linear lookup in [[x, ...values]] keyframes. */
  const keyed = (frames, x) => {
    if (x <= frames[0][0]) return { a: frames[0], b: frames[0], t: 0 };
    for (let i = 1; i < frames.length; i++) {
      if (x <= frames[i][0]) return { a: frames[i - 1], b: frames[i], t: (x - frames[i - 1][0]) / (frames[i][0] - frames[i - 1][0]) };
    }
    const l = frames[frames.length - 1];
    return { a: l, b: l, t: 0 };
  };
  const rupees = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

  /* ------------------------------------------- the clock for the stay */
  // scroll progress through the stay section → hour of the stay (12.5 = 12:30 PM, 34 = 10 AM next day)
  const HOURS = [[0, 12.5], [0.06, 12.5], [0.3, 17.5], [0.46, 19.5], [0.62, 22.5], [0.8, 29.5], [0.94, 34], [1, 34]];
  const hourAt = (e) => {
    const { a, b, t } = keyed(HOURS, e);
    return a[1] + (b[1] - a[1]) * t;
  };
  const darkAt = (h) => smooth(seg(h, 19.2, 21)) * (1 - smooth(seg(h, 29.2, 30.8)));

  /* ------------------------------------------- one clock for everything */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000)); // registered first, so the 3D reads the updated scroll
    lenis.stop();
  }
  gsap.ticker.lagSmoothing(0);
  window.sereno = { lenis, reduce, hourAt, nightF: 0, CONFIG };

  const scrollToEl = (target, offset = 0) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, offset });
    else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + window.scrollY + offset, behavior: 'auto' });
  };

  // in-page links go through Lenis
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    scrollToEl(target, id === '#book' ? -110 : 0);
  });

  /* -------------------------------------------------------------- loader */
  const loader = document.getElementById('loader');
  const countEl = document.getElementById('loaderCount');
  const msgEl = document.getElementById('loaderMsg');
  const glow = document.getElementById('loaderGlowFill');
  const door = loader.querySelector('.loader__door');
  const MESSAGES = [
    [0, 'Unlocking the gate'],
    [34, 'Sweeping the verandah'],
    [67, 'Switching on the lights'],
  ];
  const CAP = 9000;

  let worldReady = !!(window.__serenoWorld && window.__serenoWorld.ready);
  window.addEventListener('sereno:world-ready', () => (worldReady = true));

  const t0 = performance.now();
  let last = t0, shown = 0, msg = -1, done = false;

  function glowPath(p, time) {
    // warm light rising inside the house, with a soft wobble
    const y = 130 - 118 * p;
    const amp = p > 0.02 && p < 0.99 ? 2.5 : 0;
    let d = `M0 ${y.toFixed(1)}`;
    for (let x = 0; x <= 140; x += 10) d += ` L${x} ${(y + Math.sin(x * 0.08 + time * 0.005) * amp).toFixed(1)}`;
    return d + ' L140 260 L0 260 Z';
  }

  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const elapsed = now - t0;
    const target = worldReady || elapsed > CAP ? 100 : Math.min(92, (elapsed / 2600) * 92);
    shown = Math.min(target, shown + Math.max((target - shown) * dt * 5, dt * 28));
    countEl.textContent = String(Math.floor(shown)).padStart(3, '0');
    glow.setAttribute('d', glowPath(shown / 100, now));
    const m = MESSAGES.reduce((acc, [at], i) => (shown >= at ? i : acc), 0);
    if (m !== msg) {
      msg = m;
      msgEl.textContent = MESSAGES[m][1];
    }
    if (shown >= 100 && !done) {
      done = true;
      finish();
      return;
    }
    requestAnimationFrame(tick);
  }

  function finish() {
    const tl = gsap.timeline({ onComplete: begin });
    if (reduce) {
      tl.to(loader, { autoAlpha: 0, duration: 0.3 });
      return;
    }
    tl.to(door, { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut' }, 0.15)
      .to('.loader__house', { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1, ease: 'power1.inOut' }, 0.6)
      .to(loader, { yPercent: -100, duration: 0.9, ease: 'expo.inOut' }, 0.85)
      .set(loader, { autoAlpha: 0 });
  }

  function begin() {
    root.classList.remove('is-loading');
    if (lenis) lenis.start();
    window.__serenoStarted = true;
    window.dispatchEvent(new CustomEvent('sereno:start'));
    heroIn();
    ScrollTrigger.refresh();
  }

  requestAnimationFrame(tick);

  /* ------------------------------------------------------- hero reveal */
  function heroIn() {
    const lines = document.querySelectorAll('.hero__title .line > span');
    const bits = document.querySelectorAll('[data-hero-in]');
    if (reduce) {
      gsap.set(lines, { yPercent: 0, y: 0 });
      gsap.set(bits, { opacity: 1 });
      return;
    }
    gsap.fromTo(lines, { yPercent: 110 }, { yPercent: 0, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.12 });
    gsap.fromTo(bits, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, delay: 0.25 });
  }

  /* ------------------------------------------------------- block reveals */
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (reduce) return;
    gsap.from(el, { y: 28, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
  });

  /* ----------------------------------------------------- nav over dark */
  const nav = document.getElementById('nav');
  const staySec = document.getElementById('stay');
  const darkZones = [...document.querySelectorAll('[data-nav-dark]')];
  let navDark = false;
  gsap.ticker.add(() => {
    const y = nav.offsetTop + nav.offsetHeight / 2;
    const over = (el) => {
      const r = el.getBoundingClientRect();
      return r.top <= y && r.bottom >= y;
    };
    const dark = darkZones.some(over) || (staySec && staySec.classList.contains('is-night') && over(staySec));
    if (dark !== navDark) nav.classList.toggle('is-dark', (navDark = dark));
  });

  /* ------------------------------------------- stage UI, read from scroll */
  const heads = staySec ? [...staySec.querySelectorAll('[data-head]')] : [];
  const pills = staySec && staySec.querySelector('.pills');
  const clockEl = staySec && staySec.querySelector('[data-clock]');
  const clockDay = staySec && staySec.querySelector('[data-clock-day]');
  const insideSec = document.getElementById('inside');
  const steps = insideSec ? [...insideSec.querySelectorAll('[data-step-i]')] : [];
  const bulbCountEl = insideSec && insideSec.querySelector('[data-bulb-count]');
  const bulbTotalEl = insideSec && insideSec.querySelector('[data-bulb-total]');
  const whereSec = document.getElementById('location');

  // stay sky by hour: [hour, top, bottom]
  const STAY_SKY = [
    [12.5, '#8fd0f2', '#e9f6fc'],
    [16.5, '#a9d8ee', '#fbeed6'],
    [18.2, '#f2b27c', '#fde3c0'],
    [19.4, '#b9688a', '#f2a878'],
    [20.6, '#2a3262', '#4e4f7c'],
    [22, '#111a33', '#252c52'],
    [29, '#111a33', '#252c52'],
    [30.3, '#d98b86', '#fbd6b4'],
    [31.5, '#f6c8a0', '#fff0dc'],
    [34, '#93d2f2', '#eef8fd'],
  ];
  // where the sun or moon is: [hour, x %, y %, opacity, colour, glow]
  function orbAt(h) {
    let u, sun;
    if (h < 19.4) { u = (h - 6) / 13.4; sun = true; }
    else if (h < 30) { u = (h - 19.4) / 10.6; sun = false; }
    else { u = (h - 30) / 13.4; sun = true; }
    u = clamp01(u);
    // the arc peaks just under the headline, so the sun or moon rises behind the roof
    return {
      x: 8 + 84 * u,
      y: 80 - 47 * Math.sin(Math.PI * u),
      o: smooth(Math.sin(Math.PI * u) * 3),
      sun,
    };
  }
  const fmtHour = (h) => {
    let mins = Math.round((h * 60) / 5) * 5;
    let hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    const ap = hh < 12 ? 'AM' : 'PM';
    hh = hh % 12 || 12;
    return `${hh}:${String(mm).padStart(2, '0')} ${ap}`;
  };

  const ESTATE_SKY = [
    ['#ffb38a', '#ffe8cc', '#ffcf70'], // dawn peach
    ['#7cc6ff', '#e2f4ff', '#fff3b0'], // noon blue
    ['#ff9548', '#ffd98c', '#ffb347'], // golden hour
  ];

  let lastHead = -1, lastClock = '', lastBulbs = -1, lastNight = null;
  gsap.ticker.add(() => {
    let stayDark = 0;
    if (staySec && near(staySec)) {
      const e = progressOf(staySec);
      const h = hourAt(e);
      stayDark = darkAt(h);
      const head = h < 16.5 ? 0 : h < 19.6 ? 1 : h < 30 ? 2 : 3;
      if (head !== lastHead) {
        lastHead = head;
        heads.forEach((el, i) => {
          el.classList.toggle('is-on', i === head);
          el.setAttribute('aria-hidden', i === head ? 'false' : 'true');
        });
      }
      const label = fmtHour(h);
      if (label !== lastClock && clockEl) {
        lastClock = label;
        clockEl.textContent = label;
        clockDay.textContent = h < 24 ? 'check-in day' : 'next morning';
      }
      const { a, b, t } = keyed(STAY_SKY, h);
      staySec.style.setProperty('--sky-top', mix(a[1], b[1], t));
      staySec.style.setProperty('--sky-bot', mix(a[2], b[2], t));
      const o = orbAt(h);
      staySec.style.setProperty('--orb-x', `${o.x.toFixed(2)}%`);
      staySec.style.setProperty('--orb-y', `${o.y.toFixed(2)}%`);
      staySec.style.setProperty('--orb-o', o.o.toFixed(3));
      staySec.style.setProperty('--orb', o.sun ? '#ffd86b' : '#e9eefc');
      staySec.style.setProperty('--orb-glow', o.sun ? 'rgba(255, 214, 102, 0.55)' : 'rgba(190, 205, 255, 0.35)');
      staySec.style.setProperty('--dark', stayDark.toFixed(3));
      const night = stayDark > 0.5;
      if (night !== lastNight) staySec.classList.toggle('is-night', (lastNight = night));
      if (pills) pills.classList.toggle('is-on', e > 0.4 && e < 0.8);
    }
    window.sereno.nightF = Math.max(stayDark * cover(staySec), cover(insideSec) * 0.92);

    if (insideSec && near(insideSec)) {
      const P = progressOf(insideSec);
      const lit = reduce ? 1 : seg(P, 0.3, 0.6);
      const w = window.serenoWorld;
      const total = (w && w.garden.bulbCount) || 75;
      if (bulbTotalEl && bulbTotalEl.textContent !== String(total)) bulbTotalEl.textContent = total;
      const count = Math.round(lit * total);
      if (count !== lastBulbs && bulbCountEl) bulbCountEl.textContent = lastBulbs = count;
      const done = [reduce || P >= 0.25, reduce || lit >= 1, reduce || P >= 0.78];
      const active = P < 0.28 ? 0 : P < 0.63 ? 1 : 2;
      steps.forEach((s, i) => {
        s.classList.toggle('is-active', i === active);
        s.classList.toggle('is-done', done[i]);
      });
      insideSec.style.setProperty('--lit', lit.toFixed(3));
    }
    if (whereSec && near(whereSec)) {
      const f = progressOf(whereSec);
      const a = f < 0.5 ? 0 : 1, t = f < 0.5 ? smooth(f / 0.5) : smooth((f - 0.5) / 0.5);
      const [t0, b0, s0] = ESTATE_SKY[a], [t1, b1, s1] = ESTATE_SKY[a + 1];
      whereSec.style.setProperty('--sky-top', mix(t0, t1, t));
      whereSec.style.setProperty('--sky-bot', mix(b0, b1, t));
      whereSec.style.setProperty('--sun-c', mix(s0, s1, t));
      whereSec.style.setProperty('--sun-x', `${(12 + 76 * f).toFixed(2)}%`);
      whereSec.style.setProperty('--sun-y', `${(74 - 56 * Math.sin(Math.PI * f)).toFixed(2)}%`);
    }
  });

  /* ------------------------------------------------------ counted stats */
  document.querySelectorAll('[data-count-to]').forEach((el) => {
    const to = +el.dataset.countTo;
    const fmt = (v) => Math.round(v).toLocaleString('en-IN');
    if (reduce) { el.textContent = fmt(to); return; }
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => (el.textContent = fmt(o.v)) }),
    });
  });

  /* -------------------------------------------------------------- toast */
  const toast = document.getElementById('toast');
  let toastTimer = 0;
  function say(text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-on'), 2800);
  }

  /* ------------------------------------------------- rate cards & planner */
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const listDays = (days) => {
    const monFirst = (d) => (d + 6) % 7;
    const sorted = days.slice().sort((a, b) => monFirst(a) - monFirst(b));
    const names = sorted.map((d) => DAY_NAMES[d]);
    const runs = sorted.length > 2 && monFirst(sorted[sorted.length - 1]) - monFirst(sorted[0]) === sorted.length - 1;
    if (runs) return `${names[0]} to ${names[names.length - 1]}`;
    return names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
  };
  const weekdayDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !CONFIG.weekendDays.includes(d));

  // prices and day names on the page come from CONFIG
  document.querySelectorAll('[data-price]').forEach((el) => (el.textContent = Math.round(CONFIG[el.dataset.price]).toLocaleString('en-IN')));
  const dayCopy = {
    weekday: `${listDays(weekdayDays)} check-in. Quiet roads, the place all to yourselves.`,
    weekend: `${listDays(CONFIG.weekendDays)} check-in. Made for the big get-together.`,
  };
  document.querySelectorAll('[data-days]').forEach((el) => (el.textContent = dayCopy[el.dataset.days]));
  document.querySelectorAll('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

  const shots = () => window.serenoShots || null;
  function renderShots() {
    const s = shots();
    if (!s) return;
    document.querySelectorAll('img[data-shot]').forEach((img) => {
      const src = s[img.dataset.shot];
      if (src && img.getAttribute('src') !== src) {
        img.onload = () => img.classList.add('is-ready');
        img.src = src;
      }
    });
  }
  window.addEventListener('sereno:shots', renderShots);
  renderShots();

  const planner = document.getElementById('book');
  const dateIn = document.getElementById('plan-date');
  const guestsIn = document.getElementById('plan-guests');
  const hint = planner.querySelector('[data-date-hint]');
  const waBtn = planner.querySelector('[data-whatsapp]');
  const sumLabel = planner.querySelector('[data-sum-label]');
  const sumBase = planner.querySelector('[data-sum-base]');
  const extraRow = planner.querySelector('[data-sum-extra-row]');
  const extraLabel = planner.querySelector('[data-sum-extra-label]');
  const extraVal = planner.querySelector('[data-sum-extra]');
  const totalEl = planner.querySelector('[data-sum-total]');
  const rateToggle = document.querySelector('[data-rate-toggle]');
  const rateCards = [...document.querySelectorAll('[data-rate-card]')];

  const pad = (n) => String(n).padStart(2, '0');
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  };
  const fmtDate = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dateIn.min = isoOf(today);

  const plan = { rate: 'weekday', guests: CONFIG.included, date: null };
  let lastTotal = 0;

  function rateFor(date) {
    return CONFIG.weekendDays.includes(date.getDay()) ? 'weekend' : 'weekday';
  }

  function update() {
    const base = CONFIG[plan.rate];
    const extra = Math.max(0, plan.guests - CONFIG.included);
    const total = base + extra * CONFIG.extraPerHead;

    rateToggle.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rate === plan.rate)));
    rateCards.forEach((c) => c.classList.toggle('is-picked', c.dataset.rateCard === plan.rate));

    sumLabel.textContent = `${plan.rate === 'weekend' ? 'Weekend' : 'Weekday'} stay, up to ${CONFIG.included} guests`;
    sumBase.textContent = rupees(base);
    extraRow.hidden = extra === 0;
    extraLabel.textContent = `${extra} extra guest${extra === 1 ? '' : 's'} × ${rupees(CONFIG.extraPerHead)}`;
    extraVal.textContent = rupees(extra * CONFIG.extraPerHead);
    totalEl.textContent = rupees(total);
    if (total !== lastTotal && lastTotal) {
      totalEl.classList.remove('is-bump');
      void totalEl.offsetWidth;
      totalEl.classList.add('is-bump');
    }
    lastTotal = total;

    if (plan.date) {
      const out = new Date(plan.date);
      out.setDate(out.getDate() + 1);
      hint.textContent = `${fmtDate(plan.date)}, ${CONFIG.checkIn} → ${fmtDate(out)}, ${CONFIG.checkOut}`;
    }

    const lines = ["Hi Sereno Retreat! I'd like to book the farmhouse."];
    if (plan.date) {
      const out = new Date(plan.date);
      out.setDate(out.getDate() + 1);
      lines.push(`• Check-in: ${fmtDate(plan.date)}, ${CONFIG.checkIn}`);
      lines.push(`• Check-out: ${fmtDate(out)}, ${CONFIG.checkOut}`);
    } else {
      lines.push(`• Dates: a ${plan.rate}, flexible`);
    }
    lines.push(`• Guests: ${plan.guests}`);
    lines.push(`• Estimate: ${rupees(total)} + maintenance`);
    lines.push(plan.date ? 'Is this date available?' : 'Which dates are available?');
    waBtn.href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
  }

  function setRate(r) {
    plan.rate = r;
    if (plan.date && rateFor(plan.date) !== r) {
      plan.date = null;
      dateIn.value = '';
      hint.textContent = `Pick a ${r === 'weekend' ? listDays(CONFIG.weekendDays) : listDays(weekdayDays)} check-in`;
      hint.classList.remove('is-warn');
    }
    update();
  }

  rateToggle.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-rate]');
    if (b) setRate(b.dataset.rate);
  });
  document.querySelectorAll('[data-pick]').forEach((btn) =>
    btn.addEventListener('click', () => {
      setRate(btn.dataset.pick);
      scrollToEl(planner, -110);
      setTimeout(() => {
        try { dateIn.focus({ preventScroll: true }); if (dateIn.showPicker) dateIn.showPicker(); } catch (err) { /* picker needs a gesture in some browsers */ }
      }, reduce ? 0 : 900);
    })
  );

  dateIn.addEventListener('change', () => {
    const d = dateIn.value ? parseISO(dateIn.value) : null;
    hint.classList.remove('is-warn');
    if (!d) {
      plan.date = null;
      hint.textContent = `Check-in ${CONFIG.checkIn} · check-out ${CONFIG.checkOut} next day`;
      update();
      return;
    }
    if (d < today) {
      plan.date = null;
      dateIn.value = '';
      hint.textContent = 'That date has already gone. Pick another?';
      hint.classList.add('is-warn');
      update();
      return;
    }
    plan.date = d;
    plan.rate = rateFor(d);
    update();
    say(`${DAY_NAMES[d.getDay()]}: that's ${plan.rate} pricing, ${rupees(CONFIG[plan.rate])} for up to ${CONFIG.included} guests.`);
  });

  const setGuests = (n) => {
    plan.guests = Math.max(1, Math.min(CONFIG.maxGuests, Math.round(n) || 1));
    guestsIn.value = plan.guests;
    update();
  };
  planner.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
    const before = plan.guests;
    setGuests(plan.guests + +b.dataset.step);
    if (before === CONFIG.included && plan.guests === CONFIG.included + 1) say(`More than ${CONFIG.included}? Easy, it's ${rupees(CONFIG.extraPerHead)} per extra guest.`);
  }));
  guestsIn.addEventListener('change', () => setGuests(+guestsIn.value));
  guestsIn.addEventListener('input', () => {
    if (guestsIn.value !== '') setGuests(+guestsIn.value);
  });
  planner.addEventListener('submit', (e) => e.preventDefault());
  waBtn.addEventListener('click', () => say('Opening WhatsApp with your details…'));
  update();

  /* ------------------------------------------- mood toggle in the garden */
  const moodToggle = document.querySelector('[data-mood-toggle]');
  if (moodToggle) {
    moodToggle.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mood]');
      if (!b) return;
      moodToggle.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      insideSec.classList.toggle('is-party', b.dataset.mood === 'party');
      window.dispatchEvent(new CustomEvent('sereno:mood', { detail: { mood: b.dataset.mood } }));
    });
  }

  /* ---------------------------------------- drifting leaves and fireflies */
  const drift = document.getElementById('drift');
  if (drift && !reduce) {
    const g = drift.getContext('2d');
    const COLORS = ['#7cb85a', '#a8c3a0', '#f4b942', '#d98c1f', '#5f9a47', '#e0794f'];
    let W = 0, H = 0, dpr = 1;
    const size = () => {
      dpr = Math.min(window.devicePixelRatio, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      drift.width = W * dpr;
      drift.height = H * dpr;
    };
    size();
    window.addEventListener('resize', size);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const leaves = Array.from({ length: W < 760 ? 8 : 14 }, (_, i) => ({
      x: rnd(0, W), y: rnd(-H, H), s: rnd(7, 15), vy: rnd(14, 30), ph: rnd(0, 6.3), rot: rnd(-1, 1), c: COLORS[i % COLORS.length],
    }));
    const flies = Array.from({ length: W < 760 ? 16 : 30 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.9, 2.4), vy: rnd(4, 12), ph: rnd(0, 6.3) }));
    let lastY = window.scrollY;
    let speed = 0;
    gsap.ticker.add((time, dms) => {
      const dt = Math.min(dms / 1000, 0.05);
      const sy = window.scrollY;
      const v = lenis ? Math.abs(lenis.velocity) : Math.abs(sy - lastY) / Math.max(dt, 0.001) / 60;
      lastY = sy;
      speed += (Math.min(v, 60) - speed) * Math.min(1, dt * 4);
      const night = window.sereno.nightF;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      flies.forEach((m) => {
        m.y -= (m.vy + speed * 0.6) * dt;
        if (m.y < -10) { m.y = H + 10; m.x = rnd(0, W); }
        const a = (0.22 + 0.25 * Math.sin(time * 1.6 + m.ph)) * (1 + night * 1.6);
        const x = m.x + Math.sin(time * 0.6 + m.ph) * 8;
        if (night > 0.2) {
          g.fillStyle = `rgba(230,255,140,${(a * 0.25 * night).toFixed(3)})`;
          g.beginPath();
          g.arc(x, m.y, m.r * 4, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = night > 0.5 ? `rgba(235,255,150,${Math.min(1, a).toFixed(3)})` : `rgba(255,205,110,${a.toFixed(3)})`;
        g.beginPath();
        g.arc(x, m.y, m.r, 0, Math.PI * 2);
        g.fill();
      });
      const leafA = 0.7 * (1 - night * 0.8);
      if (leafA > 0.02) {
        leaves.forEach((f) => {
          f.y += (f.vy + speed * 6) * dt;
          if (f.y > H + 40) { f.y = -40; f.x = rnd(0, W); }
          const x = f.x + Math.sin(time * 0.9 + f.ph) * 26;
          const r = f.rot + Math.sin(time * 1.3 + f.ph) * 0.6;
          g.save();
          g.translate(x, f.y);
          g.rotate(r);
          g.globalAlpha = leafA;
          g.fillStyle = f.c;
          g.beginPath();
          g.moveTo(0, -f.s);
          g.quadraticCurveTo(f.s * 0.7, 0, 0, f.s);
          g.quadraticCurveTo(-f.s * 0.7, 0, 0, -f.s);
          g.fill();
          g.globalAlpha = leafA * 0.6;
          g.strokeStyle = 'rgba(255,255,255,0.7)';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(0, -f.s * 0.8);
          g.lineTo(0, f.s * 1.2);
          g.stroke();
          g.restore();
        });
      }
    });
  } else if (drift) {
    drift.style.display = 'none';
  }
})();
