// Renders the workbook's flowchart subset (TD / LR) to SVG.
// The course diagrams stay the main picture; this draws the mermaid source too.

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
let seq = 0;

function cleanLabel(raw) {
  let s = String(raw).trim().replace(/\\"/g, '"').replace(/\\'/g, "'");
  if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) s = s.slice(1, -1);
  return s;
}

function displayLines(label) {
  return cleanLabel(label).split(/<br\s*\/?>/i).map((line) => {
    let t = line.trim();
    if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) t = t.slice(1, -1);
    return t;
  }).filter((t) => t !== "");
}

function readNode(s, i) {
  const m = /^[A-Za-z_]\w*/.exec(s.slice(i));
  if (!m) return null;
  const id = m[0];
  let j = i + id.length;
  if (s[j] !== "[" && s[j] !== "{") return { id, label: null, shape: null, end: j };
  const close = s[j] === "{" ? "}" : "]";
  const shape = s[j] === "{" ? "decision" : "box";
  j += 1;
  let buf = "";
  let q = null;
  while (j < s.length) {
    const c = s[j];
    if (q) {
      if (c === "\\" && j + 1 < s.length) { buf += c + s[j + 1]; j += 2; continue; }
      buf += c;
      if (c === q) q = null;
      j += 1;
      continue;
    }
    if (c === '"' || c === "'") { q = c; buf += c; j += 1; continue; }
    if (c === close) { j += 1; break; }
    buf += c;
    j += 1;
  }
  return { id, label: cleanLabel(buf), shape, end: j };
}

function parseLine(line, nodes, edges) {
  const s = line.trim();
  if (!s || s.startsWith("%%")) return;
  let i = 0;
  let prev = null;
  let pending = null;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i += 1;
    if (i >= s.length) break;
    if (s.startsWith("-->", i)) {
      i += 3;
      while (i < s.length && /\s/.test(s[i])) i += 1;
      if (s[i] === "|") {
        const end = s.indexOf("|", i + 1);
        if (end < 0) return;
        pending = s.slice(i + 1, end).trim();
        i = end + 1;
      }
      continue;
    }
    const node = readNode(s, i);
    if (!node) return;
    const prevNode = nodes.get(node.id);
    if (!prevNode) nodes.set(node.id, { id: node.id, label: node.label || node.id, shape: node.shape || "box" });
    else {
      if (node.label) prevNode.label = node.label;
      if (node.shape) prevNode.shape = node.shape;
    }
    if (prev) edges.push({ from: prev, to: node.id, label: pending || "" });
    pending = null;
    prev = node.id;
    i = node.end;
  }
}

export function parseMermaid(src) {
  const lines = String(src || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const head = lines[0].match(/^flowchart\s+(TD|TB|LR|RL)$/i);
  if (!head) return null;
  const dir = /LR|RL/i.test(head[1]) ? "LR" : "TD";
  const nodes = new Map();
  const edges = [];
  for (const line of lines.slice(1)) parseLine(line, nodes, edges);
  if (!nodes.size) return null;
  return { dir, nodes, edges };
}

function measure(node) {
  const lines = displayLines(node.label);
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 1);
  const w = Math.max(88, Math.min(210, Math.round(longest * 7.1 + 28)));
  const h = Math.max(44, 18 + lines.length * 16);
  return { ...node, lines, w, h };
}

function rankOf(nodes, edges) {
  const ids = [...nodes.keys()];
  const out = new Map(ids.map((id) => [id, []]));
  const inc = new Map(ids.map((id) => [id, 0]));
  for (const e of edges) {
    if (!out.has(e.from) || !nodes.has(e.to)) continue;
    out.get(e.from).push(e);
    inc.set(e.to, (inc.get(e.to) || 0) + 1);
  }
  const rank = new Map();
  const sources = ids.filter((id) => !inc.get(id));
  (sources.length ? sources : [ids[0]]).forEach((id) => rank.set(id, 0));
  const q = [...(sources.length ? sources : [ids[0]])];
  let guard = 0;
  while (q.length && guard++ < 500) {
    const id = q.shift();
    for (const e of out.get(id) || []) {
      if (rank.has(e.to) && rank.get(e.to) <= rank.get(id)) { e.back = true; continue; }
      const nr = rank.get(id) + 1;
      if (!rank.has(e.to) || rank.get(e.to) < nr) { rank.set(e.to, nr); q.push(e.to); }
    }
  }
  ids.forEach((id) => { if (!rank.has(id)) rank.set(id, 0); });
  return rank;
}

function layout(graph) {
  const measured = new Map([...graph.nodes].map(([id, n]) => [id, measure(n)]));
  const rank = rankOf(measured, graph.edges);
  const groups = new Map();
  for (const [id, r] of rank) {
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(measured.get(id));
  }
  const ranks = [...groups.keys()].sort((a, b) => a - b);
  const gapA = 28;
  const gapB = 22;
  const pos = new Map();
  if (graph.dir === "TD") {
    const rowW = ranks.map((r) => groups.get(r).reduce((s, n) => s + n.w, 0) + gapB * (groups.get(r).length - 1));
    const width = Math.max(280, ...rowW) + 24;
    let y = 12;
    for (const r of ranks) {
      const row = groups.get(r);
      const used = row.reduce((s, n) => s + n.w, 0) + gapB * (row.length - 1);
      let x = Math.max(12, (width - used) / 2);
      const h = Math.max(...row.map((n) => n.h));
      for (const n of row) { pos.set(n.id, { x, y: y + (h - n.h) / 2, w: n.w, h: n.h, n }); x += n.w + gapB; }
      y += h + gapA;
    }
    return { pos, width, height: y - gapA + 16, dir: "TD" };
  }
  const colH = ranks.map((r) => groups.get(r).reduce((s, n) => s + n.h, 0) + gapB * (groups.get(r).length - 1));
  const height = Math.max(120, ...colH) + 24;
  let x = 12;
  for (const r of ranks) {
    const col = groups.get(r);
    const used = col.reduce((s, n) => s + n.h, 0) + gapB * (col.length - 1);
    let y = Math.max(12, (height - used) / 2);
    const w = Math.max(...col.map((n) => n.w));
    for (const n of col) { pos.set(n.id, { x: x + (w - n.w) / 2, y, w: n.w, h: n.h, n }); y += n.h + gapB; }
    x += w + gapA + 8;
  }
  return { pos, width: x - gapA + 8, height, dir: "LR" };
}

function anchor(a, b) {
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  const dx = bcx - acx, dy = bcy - acy;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0 ? [acx, a.y + a.h, bcx, b.y] : [acx, a.y, bcx, b.y + b.h];
  }
  return dx >= 0 ? [a.x + a.w, acy, b.x, bcy] : [a.x, acy, b.x + b.w, bcy];
}

export function renderMermaid(src, title) {
  const graph = parseMermaid(src);
  if (!graph) return "";
  const { pos, width, height } = layout(graph);
  const id = `mh${++seq}`;
  let body = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="d-head"/></marker></defs>`;
  for (const e of graph.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    if (!a || !b) continue;
    if (e.back) {
      const x1 = a.x, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      const c = Math.min(x1, x2) - 28;
      body += `<path d="M${x1},${y1} C ${c},${y1} ${c},${y2} ${x2},${y2}" class="d-edge d-back" marker-end="url(#${id})"/>`;
      if (e.label) body += `<text x="${c + 4}" y="${(y1 + y2) / 2}" class="d-elabel">${esc(e.label)}</text>`;
    } else {
      const [x1, y1, x2, y2] = anchor(a, b);
      body += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="d-edge" marker-end="url(#${id})"/>`;
      if (e.label) body += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" class="d-elabel" text-anchor="middle">${esc(e.label)}</text>`;
    }
  }
  for (const p of pos.values()) {
    const cls = p.n.shape === "decision" ? "d-decision" : "d-box";
    const rx = p.n.shape === "decision" ? Math.min(18, p.h / 2) : 10;
    body += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${rx}" class="${cls}"/>`;
    const lines = p.n.lines.length ? p.n.lines : [p.n.id];
    const start = p.y + p.h / 2 - (lines.length - 1) * 8;
    lines.forEach((line, i) => {
      const klass = i === 0 ? "d-label" : "d-detail";
      body += `<text x="${p.x + p.w / 2}" y="${start + i * 16}" class="${klass}">${esc(line)}</text>`;
    });
  }
  return `<svg viewBox="0 0 ${Math.ceil(width)} ${Math.ceil(height)}" role="img" aria-label="${esc(title || "flowchart")}" class="diagram mermaid-diagram">${body}</svg>`;
}
