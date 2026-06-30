/* =====================================================================
   Bodyshop Damage Assessment — diagram → price match
   Loads your Inkscape SVG, turns the "Hotspot" layer into clickable
   panels, and looks up the historical price from your quote data.
   ===================================================================== */

// Where your SVG lives (put the file next to index.html, or adjust path)
const SVG_URL = 'CarTemplatesvg.svg';

/* ---------------------------------------------------------------------
   1. THE CONTRACT: SVG element id  ->  database Part Description
   Your ids are camelCase and split left/right; your data uses spaced,
   side-agnostic names. This map bridges them. Both doors -> "Front Door".
   Edit the right-hand strings to match your Quotations sheet EXACTLY.
   Ids left out of this map (the wheels) simply aren't clickable.
   --------------------------------------------------------------------- */
const ID_TO_PART = {
  frontBumper:      'Front Bumper',
  lowerFrontBumper: 'Front Lower Bumper',
  rearBumper:       'Rear Bumper',
  grill:            'Radiator Grille',
  hood:             'Bonnet',
  trunk:            'Boot Lid',
  roof:             'Roof',
  rightSideSill:    'Sill',
  headLight_1:      'Headlamp',     headLight_2:      'Headlamp',
  tailLight_1:      'Tail Lamp',    tailLight_2:      'Tail Lamp',
  leftFrontDoor:    'Front Door',   rightFrontDoor:   'Front Door',
  leftRearDoor:     'Rear Door',    rightRearDoor:    'Rear Door',
  leftFrontFender:  'Front Fender', rightFrontFender: 'Front Fender',
  leftRearFender:   'Rear Fender',  rightRearFender:  'Rear Fender',
  frontWindshield:  'Windscreen',   rearWindshield:   'Rear Windscreen',
  leftFrontWindow:  'Window Glass', rightFrontWindow: 'Window Glass',
  leftRearWindow:   'Window Glass', rightRearWindow:  'Window Glass',
  wheel_1: 'Wheel Rim', wheel_2: 'Wheel Rim',
  wheel_3: 'Wheel Rim', wheel_4: 'Wheel Rim',
};

/* ---------------------------------------------------------------------
   2. YOUR DATA — replace this with your real export.
   Easiest: keep a quotes.json and do
     const DATA = await fetch('quotes.json').then(r => r.json());
   One object per quote LINE.
   --------------------------------------------------------------------- */
const DATA = [
  {ref:'SOS684297',part:'Front Bumper',op:'Remove',rate:175,qty:3},
  {ref:'SOS686006',part:'Front Bumper',op:'Remove',rate:175,qty:6},
  {ref:'QUOTE-006',part:'Front Bumper',op:'Remove',rate:175,qty:6},
  {ref:'SQS107743',part:'Front Bumper',op:'Remove',rate:175,qty:6},
  {ref:'SOS684297',part:'Front Bumper',op:'Renew',rate:175,qty:3},
  {ref:'SQS107743',part:'Front Bumper',op:'Renew',rate:175,qty:6},
  {ref:'SOS686006',part:'Front Bumper',op:'Repair',rate:225,qty:14},
  {ref:'SOS684297',part:'Front Bumper',op:'Respray',rate:225,qty:48},
  {ref:'SQS107743',part:'Front Bumper',op:'Respray',rate:225,qty:60},
  {ref:'SOS685230',part:'Rear Bumper',op:'Renew',rate:175,qty:12},
  {ref:'SOS685230',part:'Rear Bumper',op:'Renew',rate:175,qty:6},
  {ref:'SOS686006',part:'Rear Bumper',op:'Renew',rate:175,qty:6},
  {ref:'QUOTE-004',part:'Rear Bumper',op:'Renew',rate:175,qty:6},
  {ref:'QUOTE-005',part:'Rear Bumper',op:'Renew',rate:175,qty:6},
  {ref:'SOS685230',part:'Boot Lid',op:'Repair',rate:225,qty:48},
  {ref:'QUOTE-004',part:'Boot Lid',op:'Repair',rate:225,qty:12},
  {ref:'SOS686006',part:'Boot Lid',op:'Renew',rate:175,qty:6},
  {ref:'QUOTE-005',part:'Boot Lid',op:'Renew',rate:175,qty:6},
  {ref:'SOS684297',part:'Headlamp',op:'Remove',rate:175,qty:1.5},
  {ref:'SOS686006',part:'Headlamp',op:'Remove',rate:175,qty:3},
  {ref:'SQS107743',part:'Headlamp',op:'Remove',rate:175,qty:6},
  {ref:'QUOTE-006',part:'Front Door',op:'Repair',rate:225,qty:60},
  {ref:'SQS033662',part:'Front Door',op:'Renew',rate:125,qty:12},
  {ref:'QUOTE-007',part:'Front Door',op:'Renew',rate:205,qty:12},
  // car-level services (logged with part "N/A")
  {ref:'QUOTE-005',part:'N/A',op:'Wheel Balancing',rate:137.5,qty:2},
  {ref:'QUOTE-005',part:'N/A',op:'Wheel Alignment',rate:3000,qty:1},
];

// Operations offered depend on the part. Wheels get their own set.
const DEFAULT_OPS = ['Remove','Refit and Adjust','Repair','Renew','Respray'];
const OPS_BY_PART = {
  'Wheel Rim': ['Wheel Balancing','Wheel Alignment','Repair','Renew','Refit and Adjust'],
};
const opsFor = part => OPS_BY_PART[part] || DEFAULT_OPS;

// These are car-level services, not panel-specific — match by operation only.
const SERVICE_OPS = new Set(['Wheel Balancing','Wheel Alignment']);

const VAT = 1.15;
const fmt = n => 'Rs ' + Math.round(n).toLocaleString('en-US');

// ---- direction of impact (optional, per damaged panel) ----
const NS = 'http://www.w3.org/2000/svg';
const DIRS  = {N:0, NE:45, E:90, SE:135, S:180, SW:225, W:270, NW:315};   // degrees, N = up
const ARROW = {N:'↑', NE:'↗', E:'→', SE:'↘', S:'↓', SW:'↙', W:'←', NW:'↖'};
const damage = {};   // part -> { dir }  (only set where a direction matters)

/* ---------------------------------------------------------------------
   3. THE MATCH (same per-job logic as your spreadsheet)
   Sum lines within a quote -> one job total. Average across jobs.
   --------------------------------------------------------------------- */
function priceMatch(part, op){
  // panel ops match on part + op; service ops (balancing/alignment) match op only
  const lines = DATA.filter(r =>
    r.op === op && (SERVICE_OPS.has(op) || r.part === part));
  if(!lines.length) return null;
  const jobs = {};
  for(const r of lines) jobs[r.ref] = (jobs[r.ref] || 0) + r.rate * r.qty;
  const totals = Object.values(jobs);
  const sum = totals.reduce((a,b) => a+b, 0);
  return { jobs: totals.length, estimate: sum/totals.length,
           low: Math.min(...totals), high: Math.max(...totals) };
}

/* ---------------------------------------------------------------------
   4. BOOT IT UP
   --------------------------------------------------------------------- */
const partsWithData = new Set(DATA.map(r => r.part));
let selectedPart = null, selectedOp = null, selectedEl = null, svgEl = null;
const damageDir = {};                            // svg element id -> 'Horizontal'|'Diagonal'|'Vertical'
const DIR_ANGLE = { Horizontal:0, Diagonal:45, Vertical:90 };

init();
async function init(){
  const res = await fetch(SVG_URL);
  document.getElementById('car').innerHTML = await res.text();

  const svg = svgEl = document.querySelector('#car svg');
  svg.removeAttribute('width');           // ignore the 210mm physical size
  svg.removeAttribute('height');          // let CSS scale it to the container
  ensureArrowLayer();

  // tag every mapped hotspot: give it data-part, mark .hot and .has-data
  document.querySelectorAll('#layer3 [id]').forEach(el => {
    const part = ID_TO_PART[el.id];
    if(!part) return;                     // unmapped (wheels) -> stays inert
    el.dataset.part = part;
    el.classList.add('hot');
    if(partsWithData.has(part)) el.classList.add('has-data');
  });

  // ONE delegated listener
  svg.addEventListener('click', e => {
    const hot = e.target.closest('[data-part]');
    if(hot) selectPart(hot.dataset.part, hot);
  });
}

function selectPart(part, el){
  selectedPart = part; selectedEl = el || null; selectedOp = null;
  document.querySelectorAll('#layer3 .hot').forEach(h =>
    h.classList.toggle('selected', h.dataset.part === part));      // both sides light up
  render();
}
function chooseOp(op){ selectedOp = op; render(); }
window.chooseOp = chooseOp;

/* ---- damage direction: an optional arrow on the specific panel ---- */
function chooseDir(dir){
  if(!selectedEl) return;
  const id = selectedEl.id;
  if(!dir || damageDir[id] === dir) delete damageDir[id];   // tap again to clear
  else damageDir[id] = dir;
  drawArrows();
  render();
}
window.chooseDir = chooseDir;

function ensureArrowLayer(){
  const NS = 'http://www.w3.org/2000/svg';
  let defs = svgEl.querySelector('defs');
  if(!defs){ defs = document.createElementNS(NS,'defs'); svgEl.appendChild(defs); }
  if(!document.getElementById('dmgHead')){
    const m = document.createElementNS(NS,'marker');
    m.setAttribute('id','dmgHead'); m.setAttribute('viewBox','0 0 10 10');
    m.setAttribute('refX','8'); m.setAttribute('refY','5');
    m.setAttribute('markerWidth','5'); m.setAttribute('markerHeight','5');
    m.setAttribute('orient','auto-start-reverse');
    const p = document.createElementNS(NS,'path');
    p.setAttribute('d','M0 0 L10 5 L0 10 z'); p.setAttribute('fill','#BA7517');
    m.appendChild(p); defs.appendChild(m);
  }
  if(!document.getElementById('dmgArrows')){
    const g = document.createElementNS(NS,'g'); g.setAttribute('id','dmgArrows');
    svgEl.appendChild(g);
  }
}

function drawArrows(){
  const NS = 'http://www.w3.org/2000/svg';
  const layer = document.getElementById('dmgArrows');
  layer.innerHTML = '';
  for(const id in damageDir){
    const el = document.getElementById(id); if(!el) continue;
    const b = el.getBBox(), m = el.getCTM(); if(!m) continue;       // map panel centre to root coords
    const p = svgEl.createSVGPoint(); p.x = b.x + b.width/2; p.y = b.y + b.height/2;
    const c = p.matrixTransform(m);
    const scale = Math.hypot(m.a, m.b) || 1;
    const L = Math.max(6, Math.min(b.width, b.height) * 0.7 * scale);
    const line = document.createElementNS(NS,'line');
    line.setAttribute('x1', c.x - L/2); line.setAttribute('y1', c.y);
    line.setAttribute('x2', c.x + L/2); line.setAttribute('y2', c.y);
    line.setAttribute('stroke', '#BA7517'); line.setAttribute('stroke-width', '2');
    line.setAttribute('marker-end', 'url(#dmgHead)');
    line.setAttribute('transform', `rotate(${DIR_ANGLE[damageDir[id]]} ${c.x} ${c.y})`);
    layer.appendChild(line);
  }
}

/* ---------------------------------------------------------------------
   5. RENDER the estimate panel
   --------------------------------------------------------------------- */
function render(){
  const el = document.getElementById('result');
  if(!selectedPart){ el.innerHTML = '<p class="hint">Select a panel to begin.</p>'; return; }

  const ops = opsFor(selectedPart).map(o =>
    `<button class="op ${o===selectedOp?'on':''}" onclick="chooseOp('${o}')">${o}</button>`).join('');
  let html = `<span class="tag">${selectedPart}</span><div class="ops">${ops}</div>`;

  if(selectedOp){
    const m = priceMatch(selectedPart, selectedOp);
    if(!m){
      html += `<p class="empty">No history yet for ${selectedOp} / ${selectedPart}.</p>`;
    } else {
      html += `<div class="big">${fmt(m.estimate)}</div>
        <div class="vat">${fmt(m.estimate*VAT)} incl. VAT &middot; per job</div>
        <div class="meta">
          <span>Range <span class="range">${fmt(m.low)}–${fmt(m.high)}</span></span>
          <span><b>${m.jobs}</b> past job${m.jobs>1?'s':''}</span>
        </div>`;
    }
  } else {
    html += `<p class="hint">Pick an operation.</p>`;
  }

  // optional: orientation of the damage on THIS panel (drawn as an arrow)
  const cur = selectedEl ? damageDir[selectedEl.id] : null;
  const dirs = ['Horizontal','Diagonal','Vertical'].map(d =>
    `<button class="op ${d===cur?'on':''}" onclick="chooseDir('${d}')">${d}</button>`).join('');
  html += `<div class="dirwrap"><div class="dirlabel">Damage direction <span class="opt">optional · tap to toggle</span></div>
           <div class="ops">${dirs}</div></div>`;

  el.innerHTML = html;
}