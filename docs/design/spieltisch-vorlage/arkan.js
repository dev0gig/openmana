/*
 * Table variant "arkan" (Holztisch): the whole screen is a dark wooden desk;
 * the playing area is one board set into it - carved frame, brass corner
 * plates, a leather surface and a gold arcane circle across both halves.
 * Everything is SVG, drawn for the actual sizes (mockup only).
 */
(() => {
  const f = (n) => n.toFixed(1);
  const GOLD = "#d9ac5c";
  const RUNEN = [
    "M5 0V14M5 4 9 0M5 8 1 4", "M2 0V14M2 0 8 5 2 9", "M1 0V14M9 0V14M1 4 9 10", "M5 0V14M1 3 5 7 9 3",
    "M2 0V14M2 7H8M8 0V14", "M5 0 9 7 5 14 1 7Z", "M1 0 9 14M9 0 1 14", "M5 0V14M1 10 5 6 9 10",
    "M1 2H9M5 2V14M1 14H9", "M2 0V14M2 3 8 0M2 9 8 6", "M5 0V8M1 14 5 8 9 14", "M1 0V14M1 0 8 3 1 7 8 11",
  ];

  /* ---------- Shared paint ---------- */
  const DEFS = `
    <filter id="ak-holz" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".002 .035" numOctaves="4" seed="11"/>
      <feColorMatrix values="0 0 0 0 .36  0 0 0 0 .22  0 0 0 0 .12  0 0 0 .9 -.25"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="ak-leder" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="4"/>
      <feColorMatrix values="0 0 0 0 .6  0 0 0 0 .65  0 0 0 0 .8  0 0 0 .14 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="ak-schatten" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="ak-weich" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <filter id="ak-glut" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="ak-messing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc9a"/><stop offset=".35" stop-color="#c39443"/><stop offset=".7" stop-color="#7a5521"/><stop offset="1" stop-color="#d8b062"/></linearGradient>
    <linearGradient id="ak-inlay" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d896"/><stop offset=".5" stop-color="#b8873a"/><stop offset="1" stop-color="#e6c06e"/></linearGradient>
    <linearGradient id="ak-rahmen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a2f1a"/><stop offset=".5" stop-color="#2a190c"/><stop offset="1" stop-color="#3b2413"/></linearGradient>
    <radialGradient id="ak-flaeche" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#1d2a40"/><stop offset=".65" stop-color="#121b2b"/><stop offset="1" stop-color="#0a0f19"/></radialGradient>
    <radialGradient id="ak-kreislicht"><stop offset="0" stop-color="#7fb4ff" stop-opacity=".16"/><stop offset=".7" stop-color="#7fb4ff" stop-opacity=".04"/><stop offset="1" stop-color="#7fb4ff" stop-opacity="0"/></radialGradient>
`;

  /* ---------- The board ---------- */
  function brett(w, h) {
    const kurz = Math.min(w, h);
    const rand = Math.max(10, Math.min(18, kurz * 0.022));
    const cx = w / 2, cy = h / 2, R = Math.min(w * 0.46, h * 0.44);
    const kreis = (r) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
    const rille = (d, b = 1.5, o = 1) => `<path d="${d}" fill="none" stroke="#04060a" stroke-opacity="${0.7 * o}" stroke-width="${b + 2.6}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="url(#ak-inlay)" stroke-opacity="${o}" stroke-width="${b}" stroke-linecap="round"/>`;
    // rune band
    const anzahl = Math.floor((2 * Math.PI * (R - 14)) / 24);
    let runen = "";
    for (let i = 0; i < anzahl; i++) {
      const s = 11 / 14;
      runen += `<path d="${RUNEN[(i * 5) % RUNEN.length]}" transform="rotate(${f((i / anzahl) * 360)} ${f(cx)} ${f(cy)}) translate(${f(cx - 5 * s)} ${f(cy - (R - 14) - 7 * s)}) scale(${s.toFixed(3)})" vector-effect="non-scaling-stroke"/>`;
    }
    let speichen = "";
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      speichen += `M${f(cx + Math.cos(a) * R * 0.36)} ${f(cy + Math.sin(a) * R * 0.36)}L${f(cx + Math.cos(a) * (R - 28))} ${f(cy + Math.sin(a) * (R - 28))}`;
    }
    const stern = (() => {
      let d = "";
      for (let i = 0; i < 16; i++) { const r = i % 2 ? R * 0.12 : R * 0.33, a = ((-90 + i * 22.5) * Math.PI) / 180; d += `${i ? "L" : "M"}${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`; }
      return d + "Z";
    })();
    // Brass corner plates, mirrored.
    const e = rand * 3.4;
    const platte = `<path d="M0 0H${f(e)}L${f(e - rand * 0.7)} ${f(rand * 0.9)}H${f(rand * 0.9)}V${f(e - rand * 0.7)}L0 ${f(e)}Z" fill="url(#ak-messing)" stroke="#2a1a08" stroke-width="1"/>
      <path d="M${f(rand * 0.5)} ${f(rand * 0.5)}L${f(e * 0.7)} ${f(rand * 0.5)}M${f(rand * 0.5)} ${f(rand * 0.5)}L${f(rand * 0.5)} ${f(e * 0.7)}" stroke="#2a1a08" stroke-width=".8" opacity=".6"/>
      <circle cx="${f(rand * 0.45)}" cy="${f(rand * 0.45)}" r="${f(rand * 0.16)}" fill="#2a1a08"/>
      <circle cx="${f(e * 0.72)}" cy="${f(rand * 0.45)}" r="${f(rand * 0.12)}" fill="#2a1a08"/><circle cx="${f(rand * 0.45)}" cy="${f(e * 0.72)}" r="${f(rand * 0.12)}" fill="#2a1a08"/>`;
    const ecken = [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]]
      .map(([x, y, sx, sy]) => `<g transform="translate(${f(x)} ${f(y)}) scale(${sx} ${sy})">${platte}</g>`).join("");
    const i = rand, iw = w - 2 * rand, ih = h - 2 * rand;
    return `
      <rect x="-4" y="6" width="${w + 8}" height="${h}" rx="22" fill="#000" opacity=".7" filter="url(#ak-schatten)"/>
      <rect width="${w}" height="${h}" rx="20" fill="url(#ak-rahmen)" stroke="#0a0604" stroke-width="2"/>
      <rect width="${w}" height="${h}" rx="20" fill="#000" filter="url(#ak-holz)" opacity=".7"/>
      <rect x="${f(rand * 0.45)}" y="${f(rand * 0.45)}" width="${f(w - rand * 0.9)}" height="${f(h - rand * 0.9)}" rx="16" fill="none" stroke="url(#ak-inlay)" stroke-width="1.3" opacity=".75"/>
      <rect x="${f(i)}" y="${f(i)}" width="${f(iw)}" height="${f(ih)}" rx="12" fill="url(#ak-flaeche)" stroke="#05070b" stroke-width="3"/>
      <rect x="${f(i)}" y="${f(i)}" width="${f(iw)}" height="${f(ih)}" rx="12" fill="#000" filter="url(#ak-leder)"/>
      <rect x="${f(i + 7)}" y="${f(i + 7)}" width="${f(iw - 14)}" height="${f(ih - 14)}" rx="8" fill="none" stroke="${GOLD}" stroke-opacity=".28" stroke-width="1"/>
      <rect x="${f(i)}" y="${f(i)}" width="${f(iw)}" height="${f(ih)}" rx="12" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="6" filter="url(#ak-weich)"/>
      <circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R * 1.05)}" fill="url(#ak-kreislicht)"/>
      <g opacity=".75">
        ${rille(kreis(R), 2)}${rille(kreis(R - 28), 1.1)}${rille(kreis(R * 0.36), 1.1)}
        <path d="${speichen}" stroke="${GOLD}" stroke-opacity=".22" stroke-width=".8"/>
        <path d="${stern}" fill="none" stroke="${GOLD}" stroke-opacity=".4" stroke-width="1"/>
        <path d="M${f(i + 18)} ${f(cy)}H${f(cx - R - 6)}M${f(cx + R + 6)} ${f(cy)}H${f(w - i - 18)}" stroke="${GOLD}" stroke-opacity=".45" stroke-width="1"/>
        <path d="M${f(i + 18)} ${f(cy)}l5 -4 5 4 -5 4Z M${f(w - i - 18)} ${f(cy)}l-5 -4 -5 4 5 4Z" fill="${GOLD}" opacity=".6"/>
      </g>
      <g class="drehen" style="transform-origin:${f(cx)}px ${f(cy)}px"><g class="runen-glut" fill="none" stroke="#f1cf86" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" filter="url(#ak-glut)" opacity=".55">${runen}</g></g>
      ${ecken}`;
  }

  function arkan(w, h, W, H, ox, oy) {
    // Board rectangle: the playing area, kept inside the screen.
    const x0 = Math.max(0, 6 - ox), x1 = Math.min(w, W - ox - 6), y0 = 2, y1 = h - 2;
    return `<defs>${DEFS}<radialGradient id="ak-vignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient></defs>
      <g transform="translate(${f(-ox)} ${f(-oy)})">
        <rect width="${W}" height="${H}" fill="#1b110a"/>
        <rect width="${W}" height="${H}" fill="#000" filter="url(#ak-holz)"/>
        ${Array.from({ length: Math.ceil(H / 150) }, (_, k) => `<path d="M0 ${f(k * 150 + 70)}H${W}" stroke="#0a0603" stroke-width="2" opacity=".45"/><path d="M0 ${f(k * 150 + 72)}H${W}" stroke="#6b4a2c" stroke-width=".6" opacity=".25"/>`).join("")}
        <rect width="${W}" height="${H}" fill="url(#ak-vignette)"/>
      </g>
      <g transform="translate(${f(x0)} ${f(y0)})">${brett(x1 - x0, y1 - y0)}</g>`;
  }

  Tischflaeche.varianten.arkan = arkan;
})();
