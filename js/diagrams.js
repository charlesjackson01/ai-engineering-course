// Small inline-SVG diagram renderer. Every diagram is ~340px wide so it reads well on a phone.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const W = 340;

function node(x, y, w, h, n) {
  const kind = n.kind || "box";
  let shape;
  if (kind === "decision") shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" class="d-decision"/>`;
  else if (kind === "terminal") shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" class="d-terminal"/>`;
  else shape = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" class="d-box"/>`;
  const cx = x + w / 2;
  const t = n.detail
    ? `<text x="${cx}" y="${y + h / 2 - 5}" class="d-label">${esc(n.label)}</text><text x="${cx}" y="${y + h / 2 + 13}" class="d-detail">${esc(n.detail)}</text>`
    : `<text x="${cx}" y="${y + h / 2 + 5}" class="d-label">${esc(n.label)}</text>`;
  return shape + t;
}
const arrow = (x1, y1, x2, y2, label, lx, ly, anchor = "start") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="d-edge" marker-end="url(#ah)"/>` +
  (label ? `<text x="${lx ?? x1 + 8}" y="${ly ?? (y1 + y2) / 2 + 4}" class="d-elabel" text-anchor="${anchor}">${esc(label)}</text>` : "");
const defs = `<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-head"/></marker></defs>`;
const svg = (h, body, title) => `<svg viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(title || "diagram")}" class="diagram">${defs}${body}</svg>`;

export function renderDiagram(d, title) {
  if (d.type === "chain") {
    const nw = 230, nh = 50, gap = 34, x = (W - nw) / 2; let y = 8, b = "";
    d.nodes.forEach((n, i) => {
      b += node(x, y, nw, nh, n);
      if (i < d.nodes.length - 1) b += arrow(W / 2, y + nh + 2, W / 2, y + nh + gap - 3, d.edgeLabels && d.edgeLabels[i], W / 2 + 10);
      y += nh + gap;
    });
    return svg(y - gap + 16, b, title);
  }
  if (d.type === "pairs") {
    const nw = 150, nh = 54, colX = [10, 180]; let b = "";
    d.pairs.forEach(([a, r, lab], i) => {
      const x = colX[i];
      b += node(x, 8, nw, nh, a) + arrow(x + nw / 2, 64, x + nw / 2, 102, lab, x + nw / 2 + 8) + node(x, 106, nw, nh, r);
    });
    return svg(172, b, title);
  }
  if (d.type === "branch") {
    let b = node(70, 8, 200, 44, { label: d.ask });
    b += arrow(170, 54, 170, 80);
    b += node(45, 84, 250, 48, { label: d.check, kind: "decision" });
    b += `<path d="M110,134 L70,172" class="d-edge" marker-end="url(#ah)"/><text x="78" y="152" class="d-elabel" text-anchor="end">yes</text>`;
    b += `<path d="M230,134 L270,172" class="d-edge" marker-end="url(#ah)"/><text x="262" y="152" class="d-elabel">no</text>`;
    b += node(8, 176, 150, 44, { label: d.yes, kind: "terminal" }) + node(182, 176, 150, 44, { label: d.no, kind: "terminal" });
    return svg(230, b, title);
  }
  if (d.type === "ladder") {
    let y = 8, b = "";
    d.steps.forEach(([q, g], i) => {
      b += node(20, y, 170, 44, { label: "score " + q, kind: "decision" });
      b += arrow(192, y + 22, 248, y + 22, "yes", 220, y + 16, "middle");
      b += node(252, y + 2, 70, 40, { label: g, kind: "terminal" });
      b += arrow(105, y + 46, 105, y + 70, "no", 115);
      y += 74;
    });
    b += node(20, y, 170, 44, { label: "else" }) + arrow(192, y + 22, 248, y + 22) + node(252, y + 2, 70, 40, { label: d.last, kind: "terminal" });
    b += `<text x="20" y="${y + 66}" class="d-detail" text-anchor="start">Python stops at the first “yes”.</text>`;
    return svg(y + 76, b, title);
  }
  if (d.type === "loop") {
    let b = node(70, 8, 200, 50, { label: "SETUP", detail: d.setup });
    b += arrow(170, 60, 170, 86);
    b += node(40, 90, 260, 54, { label: "CHECK", detail: d.check, kind: "decision" });
    b += arrow(170, 146, 170, 184, d.yes, 180);
    b += node(50, 188, 240, 50, { label: "CHANGE", detail: d.change });
    b += `<path d="M50,213 C 6,213 6,117 38,117" class="d-edge d-back" marker-end="url(#ah)"/>`;
    if (d.back) b += `<text x="14" y="170" class="d-elabel" text-anchor="start" transform="rotate(-90 14 170)">${esc(d.back)}</text>`;
    b += `<path d="M300,117 C 330,117 330,250 290,262" class="d-edge" marker-end="url(#ah)"/><text x="334" y="190" class="d-elabel" text-anchor="end" transform="rotate(90 334 190)">${esc(d.no)}</text>`;
    b += node(110, 256, 180, 44, { label: d.done, kind: "terminal" });
    b += `<text x="200" y="316" class="d-detail">after the loop (optional print)</text>`;
    return svg(326, b, title);
  }
  if (d.type === "list") {
    const n = d.items.length, bw = 96, gap = 10, x0 = (W - (n * bw + (n - 1) * gap)) / 2; let b = "";
    b += `<text x="${W / 2}" y="18" class="d-detail">foods = [ … ]   len(foods) is ${n}</text>`;
    d.items.forEach((it, i) => {
      const x = x0 + i * (bw + gap);
      b += `<rect x="${x}" y="30" width="${bw}" height="46" rx="8" class="d-box"/><text x="${x + bw / 2}" y="58" class="d-label">${esc(it)}</text>`;
      b += `<text x="${x + bw / 2}" y="96" class="d-index">foods[${i}]</text>`;
      b += arrow(x + bw / 2, 104, W / 2 + (i - 1) * 40, 140);
    });
    b += node(55, 144, 230, 52, { label: "for food in foods:", detail: 'print("I like " + food)', kind: "terminal" });
    b += `<text x="${W / 2}" y="220" class="d-detail">one pass per item: chicken, then tacos, then pizza</text>`;
    return svg(232, b, title);
  }
  return "";
}
