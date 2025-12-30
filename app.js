/* =========================
   ARSLAN — Facturación Diaria PRO (V4)
   - Login por hash (PIN no se muestra)
   - Fallback SHA-256 (funciona incluso en file://)
   - 3 tiendas: San Pablo / San Lesmes / Santiago
   - Entrada: efectivo + tarjeta + ticket + diferencia
   - Resumen día + WhatsApp
   - Reportes con rango + gráficos + ranking
   - Export/Import JSON + Export CSV
========================= */

const APP_KEY = "ARSLAN_FACTURACION_PRO_V4";
const SETTINGS_KEY = "ARSLAN_FACTURACION_SETTINGS_PRO_V4";

const WA_PHONE = "34631667893"; // +34 631 667 893

// ✅ PIN NUEVO: 7392  (NO se muestra en UI)
// SHA-256("7392") = fa68d2ed5f32f14746be3ce92a07e5dcc7431b3ac4e7717b6947a4054fae5c18
const DEFAULT_PIN_HASH = "fa68d2ed5f32f14746be3ce92a07e5dcc7431b3ac4e7717b6947a4054fae5c18";

const STORES = [
  { id: "san_pablo", name: "San Pablo" },
  { id: "san_lesmes", name: "San Lesmes" },
  { id: "santiago", name: "Santiago" },
];

let state = loadState();
let settings = loadSettings();

const $ = (id) => document.getElementById(id);

/* ---------- DOM ---------- */
// Views
const loginView = $("loginView");
const appView = $("appView");

// Login
const pinInput = $("pinInput");
const btnLogin = $("btnLogin");
const loginMsg = $("loginMsg");

// Entry
const dateInput = $("dateInput");
const storeInput = $("storeInput");
const cashInput = $("cashInput");
const cardInput = $("cardInput");
const ticketInput = $("ticketInput");
const diffBox = $("diffBox");

const btnSave = $("btnSave");
const btnClear = $("btnClear");
const btnDelete = $("btnDelete");
const btnWhatsAppDay = $("btnWhatsAppDay");
const btnCopyDay = $("btnCopyDay");

const dayList = $("dayList");
const dayHint = $("dayHint");
const saveMsg = $("saveMsg");

// Summary
const sumSP = $("sumSP");
const sumSP2 = $("sumSP2");
const sumSL = $("sumSL");
const sumSL2 = $("sumSL2");
const sumSA = $("sumSA");
const sumSA2 = $("sumSA2");
const sumGlobal = $("sumGlobal");
const sumGlobal2 = $("sumGlobal2");

// Goals
const goalDaily = $("goalDaily");
const goalMonthly = $("goalMonthly");
const btnSaveGoals = $("btnSaveGoals");
const goalTodayPct = $("goalTodayPct");
const goalTodayTxt = $("goalTodayTxt");
const goalMonthPct = $("goalMonthPct");
const goalMonthTxt = $("goalMonthTxt");

// Reports
const reportType = $("reportType");
const reportStore = $("reportStore");
const rangeFrom = $("rangeFrom");
const rangeTo = $("rangeTo");
const btnRefresh = $("btnRefresh");
const btnWhatsAppReport = $("btnWhatsAppReport");
const btnWhatsAppReportFull = $("btnWhatsAppReportFull");
const btnExportCSV = $("btnExportCSV");

const kpiCash = $("kpiCash");
const kpiCard = $("kpiCard");
const kpiTotal = $("kpiTotal");
const kpiAvg = $("kpiAvg");

const reportTableBody = $("reportTable").querySelector("tbody");
const tableHint = $("tableHint");

// Ranking
const rankList = $("rankList");
const bestStore = $("bestStore");
const bestStoreTxt = $("bestStoreTxt");
const worstStore = $("worstStore");
const worstStoreTxt = $("worstStoreTxt");

// Top controls
const btnLogout = $("btnLogout");
const btnBackup = $("btnBackup");
const importFile = $("importFile");
const btnTheme = $("btnTheme");
const btnThemeLogin = $("btnThemeLogin");

// Charts
let chartTotal = null;
let chartMix = null;

/* ---------- INIT ---------- */
applyTheme(settings.theme || "dark");
initDefaults();

// Login
btnLogin.addEventListener("click", doLogin);
pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

// Theme
btnTheme?.addEventListener("click", toggleTheme);
btnThemeLogin?.addEventListener("click", toggleTheme);

// Logout
btnLogout.addEventListener("click", () => {
  settings.isLogged = false;
  saveSettings();
  showLogin();
});

// Entry events
btnSave.addEventListener("click", onSave);
btnClear.addEventListener("click", clearEntry);
btnDelete.addEventListener("click", onDelete);

btnWhatsAppDay.addEventListener("click", () => openWhatsApp(buildWhatsAppDayText(getSelectedDate())));
btnCopyDay.addEventListener("click", async () => {
  const txt = buildWhatsAppDayText(getSelectedDate());
  await copyToClipboard(txt);
  toast(saveMsg, "Copiado ✅", true);
});

btnSaveGoals.addEventListener("click", onSaveGoals);

dateInput.addEventListener("change", () => {
  fillEntryIfExists();
  renderTodaySummary();
  renderDayHistory();
  renderGoals();
});
storeInput.addEventListener("change", fillEntryIfExists);

cashInput.addEventListener("input", () => { normalizeMoneyInput(cashInput); updateDiffBox(); });
cardInput.addEventListener("input", () => { normalizeMoneyInput(cardInput); updateDiffBox(); });
ticketInput.addEventListener("input", () => { normalizeMoneyInput(ticketInput); updateDiffBox(); });

// Reports
btnRefresh.addEventListener("click", refreshReports);
btnWhatsAppReport.addEventListener("click", () => sendWhatsAppReport(false));
btnWhatsAppReportFull.addEventListener("click", () => sendWhatsAppReport(true));
btnExportCSV.addEventListener("click", exportCSV);

// Backup
btnBackup.addEventListener("click", exportBackup);
importFile.addEventListener("change", importBackup);

// Start view
if (settings.isLogged) showApp();
else showLogin();

/* ---------- Defaults ---------- */
function initDefaults(){
  const today = toISODate(new Date());
  if (!settings.goals) settings.goals = { daily: 0, monthly: 0 };

  const firstDay = today.slice(0,7) + "-01";
  dateInput.value = today;
  rangeFrom.value = firstDay;
  rangeTo.value = today;

  goalDaily.value = settings.goals.daily ? String(settings.goals.daily).replace(".", ",") : "";
  goalMonthly.value = settings.goals.monthly ? String(settings.goals.monthly).replace(".", ",") : "";
}

function getSelectedDate(){ return dateInput.value; }

/* ---------- Views ---------- */
function showLogin(){
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  loginMsg.textContent = "";
  pinInput.value = "";
  pinInput.focus();
}

function showApp(){
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  fillEntryIfExists();
  renderTodaySummary();
  renderDayHistory();
  renderGoals();
  refreshReports();
}

/* ---------- Login (hash + fallback) ---------- */
async function doLogin(){
  const pin = (pinInput.value || "").trim();
  const validHash = settings.pinHash || DEFAULT_PIN_HASH;

  const enteredHash = await sha256Hex(pin);

  if (enteredHash === validHash){
    settings.isLogged = true;
    saveSettings();
    loginMsg.className = "msg ok";
    loginMsg.textContent = "Acceso correcto ✅";
    showApp();
  } else {
    loginMsg.className = "msg err";
    loginMsg.textContent = "PIN incorrecto ❌";
  }
}

async function sha256Hex(text){
  // WebCrypto (si disponible)
  try{
    if (crypto?.subtle?.digest){
      const enc = new TextEncoder();
      const data = enc.encode(text);
      const hashBuf = await crypto.subtle.digest("SHA-256", data);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      return hashArr.map(b => b.toString(16).padStart(2,"0")).join("");
    }
  }catch(e){
    // cae al fallback
  }
  // Fallback JS puro (funciona en file://)
  return sha256Fallback(text);
}

/* ===== SHA-256 fallback (JS puro) ===== */
function sha256Fallback(ascii){
  function rightRotate(value, amount){ return (value>>>amount) | (value<<(32-amount)); }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";

  const words = [];
  const asciiBitLength = ascii.length * 8;

  let hash = sha256Fallback.h = sha256Fallback.h || [];
  let k = sha256Fallback.k = sha256Fallback.k || [];
  let primeCounter = k.length;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++){
    if (!isComposite[candidate]){
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
    }
  }

  ascii += "\x80";
  while (ascii.length % 64 - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++){
    const j = ascii.charCodeAt(i);
    words[i>>2] |= j << ((3 - i)%4)*8;
  }
  words[words.length] = ((asciiBitLength / maxWord) | 0);
  words[words.length] = (asciiBitLength);

  for (let j = 0; j < words.length;){
    const w = words.slice(j, j += 16);
    const oldHash = hash.slice(0);

    for (let i = 0; i < 64; i++){
      const w15 = w[i - 15], w2 = w[i - 2];

      const a = hash[0], e = hash[4];
      const temp1 = (hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ ((~e) & hash[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
          w[i - 16]
          + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15>>>3))
          + w[i - 7]
          + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2>>>10))
        ) | 0)
      ) | 0;

      const temp2 = ((rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))
      ) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }

    for (let i = 0; i < 8; i++){
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++){
    for (let j = 3; j + 1; j--){
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/* ---------- Theme ---------- */
function toggleTheme(){
  const next = (document.documentElement.getAttribute("data-theme") === "light") ? "dark" : "light";
  applyTheme(next);
  settings.theme = next;
  saveSettings();
  refreshReports();
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
}

/* ---------- Storage ---------- */
function loadState(){
  try{
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return { entries: {} };
    const parsed = JSON.parse(raw);
    if (!parsed.entries) parsed.entries = {};
    return parsed;
  }catch{
    return { entries: {} };
  }
}
function saveState(){ localStorage.setItem(APP_KEY, JSON.stringify(state)); }

function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { isLogged:false, theme:"dark", goals:{daily:0, monthly:0}, pinHash: DEFAULT_PIN_HASH };

    const parsed = JSON.parse(raw);
    if (typeof parsed.isLogged !== "boolean") parsed.isLogged = false;
    if (!parsed.theme) parsed.theme = "dark";
    if (!parsed.goals) parsed.goals = { daily:0, monthly:0 };

    // ✅ si el pinHash guardado es inválido, fuerza el nuevo
    if (!parsed.pinHash || String(parsed.pinHash).length !== 64) parsed.pinHash = DEFAULT_PIN_HASH;

    return parsed;
  }catch{
    return { isLogged:false, theme:"dark", goals:{daily:0, monthly:0}, pinHash: DEFAULT_PIN_HASH };
  }
}
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

/* ---------- Helpers ---------- */
function toISODate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}

function parseMoney(str){
  if (!str) return 0;
  const clean = String(str).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}
function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }

function formatMoney(n){
  const v = Number(n || 0);
  return v.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
}

function normalizeMoneyInput(el){
  el.value = String(el.value || "").replace(/[^\d,.-]/g,"");
}

function keyOf(dateISO, storeId){ return `${dateISO}__${storeId}`; }
function getEntry(dateISO, storeId){ return state.entries[keyOf(dateISO, storeId)] || null; }

function setEntry(dateISO, storeId, cash, card, ticket){
  state.entries[keyOf(dateISO, storeId)] = {
    date: dateISO,
    store: storeId,
    cash, card,
    ticket,
    updatedAt: new Date().toISOString()
  };
  saveState();
}

function deleteEntry(dateISO, storeId){
  delete state.entries[keyOf(dateISO, storeId)];
  saveState();
}

function storeName(id){ return STORES.find(s => s.id === id)?.name || id; }

function weekdayES(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const days = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  return days[d.getDay()];
}
function dailyLabelWithWeekday(dateISO){
  return `${dateISO} (${weekdayES(dateISO)})`;
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function diffValue(ticket, total){
  return round2((ticket || 0) - (total || 0));
}
function formatDiff(d){
  const v = Number(d || 0);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
}

/* ---------- Entry ---------- */
function fillEntryIfExists(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;
  const e = getEntry(dateISO, storeId);

  if (e){
    cashInput.value = String(e.cash ?? "").replace(".", ",");
    cardInput.value = String(e.card ?? "").replace(".", ",");
    ticketInput.value = String(e.ticket ?? "").replace(".", ",");
  } else {
    cashInput.value = "";
    cardInput.value = "";
    ticketInput.value = "";
  }
  updateDiffBox();
  saveMsg.textContent = "";
  saveMsg.className = "msg";
}

function updateDiffBox(){
  const cash = round2(parseMoney(cashInput.value));
  const card = round2(parseMoney(cardInput.value));
  const ticket = round2(parseMoney(ticketInput.value));
  const total = cash + card;
  const d = diffValue(ticket, total);

  if (!ticketInput.value && !cashInput.value && !cardInput.value){
    diffBox.textContent = "—";
    return;
  }
  diffBox.textContent = `${formatDiff(d)}  (Ticket ${formatMoney(ticket)} - Total ${formatMoney(total)})`;
}

function clearEntry(){
  cashInput.value = "";
  cardInput.value = "";
  ticketInput.value = "";
  updateDiffBox();
  saveMsg.textContent = "";
  saveMsg.className = "msg";
}

function onSave(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;
  if (!dateISO){
    toast(saveMsg, "Selecciona una fecha.", false);
    return;
  }

  const cash = round2(parseMoney(cashInput.value));
  const card = round2(parseMoney(cardInput.value));
  const ticket = round2(parseMoney(ticketInput.value));

  setEntry(dateISO, storeId, cash, card, ticket);

  const total = cash + card;
  const d = diffValue(ticket, total);

  toast(saveMsg, `Guardado ✅ (${storeName(storeId)} — Total ${formatMoney(total)} · Ticket ${formatMoney(ticket)} · Dif ${formatDiff(d)})`, true);

  renderTodaySummary();
  renderDayHistory();
  renderGoals();
  refreshReports();
}

function onDelete(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;
  if (!getEntry(dateISO, storeId)){
    toast(saveMsg, "No existe registro para borrar.", false);
    return;
  }
  deleteEntry(dateISO, storeId);
  toast(saveMsg, "Registro borrado ✅", true);

  fillEntryIfExists();
  renderTodaySummary();
  renderDayHistory();
  renderGoals();
  refreshReports();
}

/* ---------- Day summary + history ---------- */
function computeDayTotals(dateISO){
  const byStore = {};
  let gCash = 0, gCard = 0, gTicket = 0;

  for (const s of STORES){
    const e = getEntry(dateISO, s.id);
    const cash = e?.cash || 0;
    const card = e?.card || 0;
    const ticket = e?.ticket || 0;

    const total = cash + card;
    const diff = diffValue(ticket, total);

    byStore[s.id] = { cash, card, ticket, total, diff };
    gCash += cash; gCard += card; gTicket += ticket;
  }

  const gTotal = gCash + gCard;
  const gDiff = diffValue(gTicket, gTotal);

  return {
    byStore,
    global: { cash:gCash, card:gCard, ticket:gTicket, total:gTotal, diff:gDiff }
  };
}

function renderTodaySummary(){
  const dateISO = dateInput.value;
  const totals = computeDayTotals(dateISO);

  const sp = totals.byStore.san_pablo;
  const sl = totals.byStore.san_lesmes;
  const sa = totals.byStore.santiago;
  const g  = totals.global;

  sumSP.textContent = formatMoney(sp.total);
  sumSP2.textContent = `Efe: ${formatMoney(sp.cash)} · Tar: ${formatMoney(sp.card)} · Ticket: ${formatMoney(sp.ticket)} · Dif: ${formatDiff(sp.diff)}`;

  sumSL.textContent = formatMoney(sl.total);
  sumSL2.textContent = `Efe: ${formatMoney(sl.cash)} · Tar: ${formatMoney(sl.card)} · Ticket: ${formatMoney(sl.ticket)} · Dif: ${formatDiff(sl.diff)}`;

  sumSA.textContent = formatMoney(sa.total);
  sumSA2.textContent = `Efe: ${formatMoney(sa.cash)} · Tar: ${formatMoney(sa.card)} · Ticket: ${formatMoney(sa.ticket)} · Dif: ${formatDiff(sa.diff)}`;

  sumGlobal.textContent = formatMoney(g.total);
  sumGlobal2.textContent = `Efectivo: ${formatMoney(g.cash)} · Tarjeta: ${formatMoney(g.card)} · Ticket: ${formatMoney(g.ticket)} · Dif: ${formatDiff(g.diff)}`;
}

function renderDayHistory(){
  const dateISO = dateInput.value;
  dayList.innerHTML = "";

  const items = STORES.map(s => {
    const e = getEntry(dateISO, s.id);
    const cash = e?.cash || 0;
    const card = e?.card || 0;
    const ticket = e?.ticket || 0;
    const total = cash + card;
    const diff = diffValue(ticket, total);

    return { store:s.id, name:s.name, cash, card, ticket, total, diff, exists: !!e };
  });

  const existsCount = items.filter(x => x.exists).length;
  dayHint.textContent = `${dateISO} (${weekdayES(dateISO)}) · registros: ${existsCount}/3`;

  for (const it of items){
    const div = document.createElement("div");
    div.className = "dayitem";
    div.innerHTML = `
      <div>
        <div class="k">${escapeHtml(it.name)}</div>
        <div class="muted small">Total ${formatMoney(it.total)} · Ticket ${formatMoney(it.ticket)} · Dif ${formatDiff(it.diff)}</div>
      </div>
      <div class="v">${formatMoney(it.total)}</div>
    `;
    div.addEventListener("click", () => {
      storeInput.value = it.store;
      fillEntryIfExists();
      cashInput.focus();
    });
    dayList.appendChild(div);
  }
}

/* ---------- Goals ---------- */
function onSaveGoals(){
  const d = round2(parseMoney(goalDaily.value));
  const m = round2(parseMoney(goalMonthly.value));
  settings.goals = { daily: d, monthly: m };
  saveSettings();
  renderGoals();
  toast(saveMsg, "Objetivos guardados ✅", true);
}

function renderGoals(){
  const dateISO = dateInput.value;
  const todayTotals = computeDayTotals(dateISO).global.total;

  const monthKey = dateISO.slice(0,7);
  const monthRows = buildReport("daily", "global", monthKey + "-01", monthKey + "-31");
  const monthTotal = monthRows.reduce((a,r)=>a + r.total, 0);

  const gd = Number(settings.goals?.daily || 0);
  if (gd > 0){
    const pct = Math.max(0, Math.min(100, (todayTotals / gd) * 100));
    goalTodayPct.textContent = pct.toFixed(1) + "%";
    goalTodayTxt.textContent = `${formatMoney(todayTotals)} / ${formatMoney(gd)}`;
  } else {
    goalTodayPct.textContent = "—";
    goalTodayTxt.textContent = "Define objetivo diario";
  }

  const gm = Number(settings.goals?.monthly || 0);
  if (gm > 0){
    const pct = Math.max(0, Math.min(100, (monthTotal / gm) * 100));
    goalMonthPct.textContent = pct.toFixed(1) + "%";
    goalMonthTxt.textContent = `${formatMoney(monthTotal)} / ${formatMoney(gm)}`;
  } else {
    goalMonthPct.textContent = "—";
    goalMonthTxt.textContent = "Define objetivo mensual";
  }
}

/* ---------- Reports ---------- */
function refreshReports(){
  const type = reportType.value;
  const store = reportStore.value;
  const from = rangeFrom.value || null;
  const to = rangeTo.value || null;

  const rows = buildReport(type, store, from, to);

  const sum = rows.reduce((acc,r)=>({
    cash: acc.cash + r.cash,
    card: acc.card + r.card,
    total: acc.total + r.total
  }), {cash:0, card:0, total:0});

  const daysCount = estimateDaysCovered(rows, type);
  const avg = (daysCount > 0) ? (sum.total / daysCount) : 0;

  kpiCash.textContent = formatMoney(sum.cash);
  kpiCard.textContent = formatMoney(sum.card);
  kpiTotal.textContent = formatMoney(sum.total);
  kpiAvg.textContent = formatMoney(avg);

  reportTableBody.innerHTML = "";
  for (const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.periodLabel)}</td>
      <td>${formatMoney(r.cash)}</td>
      <td>${formatMoney(r.card)}</td>
      <td><b>${formatMoney(r.total)}</b></td>
    `;
    reportTableBody.appendChild(tr);
  }

  tableHint.textContent = rows.length
    ? `Mostrando ${rows.length} periodos. Rango: ${from || "—"} → ${to || "—"}`
    : "No hay datos en ese rango.";

  renderCharts(rows);
  renderRanking(from, to);
}

function buildReport(type, store, from=null, to=null){
  const all = Object.values(state.entries || []);
  if (!all.length) return [];

  const filtered = all.filter(e => {
    if (store !== "global" && e.store !== store) return false;
    if (from && e.date < from) return false;
    if (to && e.date > to) return false;
    return true;
  });

  const map = new Map();

  for (const e of filtered){
    const date = e.date;
    const cash = Number(e.cash || 0);
    const card = Number(e.card || 0);

    let period, periodLabel;
    if (type === "daily"){
      period = date;
      periodLabel = dailyLabelWithWeekday(date);
    } else if (type === "weekly"){
      period = isoWeekLabel(date);
      periodLabel = weekRangeLabel(date);
    } else {
      period = monthLabel(date);
      periodLabel = monthPrettyLabel(date);
    }

    const prev = map.get(period) || {
      period, periodLabel,
      cash:0, card:0, total:0,
      sortKey: periodSortKey(type, date)
    };

    prev.cash += cash;
    prev.card += card;
    prev.total += (cash + card);
    prev.sortKey = Math.min(prev.sortKey, periodSortKey(type, date));

    map.set(period, prev);
  }

  const rows = Array.from(map.values());
  rows.sort((a,b)=> a.sortKey - b.sortKey);

  return rows.map(r => ({
    period: r.period,
    periodLabel: r.periodLabel,
    cash: round2(r.cash),
    card: round2(r.card),
    total: round2(r.total),
    sortKey: r.sortKey
  }));
}

function periodSortKey(type, dateISO){
  const d = new Date(dateISO + "T00:00:00");
  if (type === "daily") return d.getTime();
  if (type === "weekly"){
    const wk = isoWeek(d);
    return new Date(wk.mondayISO + "T00:00:00").getTime();
  }
  return (d.getFullYear() * 100 + (d.getMonth()+1)) * 100;
}

function estimateDaysCovered(rows, type){
  if (!rows.length) return 0;
  if (type === "daily") return rows.length;
  if (type === "weekly") return rows.length * 7;
  if (type === "monthly") return rows.length * 30;
  return rows.length;
}

/* ---------- Labels helpers ---------- */
function monthLabel(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function monthPrettyLabel(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `Mes ${y}-${m}`;
}
function isoWeekLabel(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const w = isoWeek(d);
  return `${w.year}-W${String(w.week).padStart(2,"0")}`;
}
function weekRangeLabel(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const w = isoWeek(d);
  const mon = w.mondayISO;
  const sun = addDaysISO(mon, 6);
  return `Semana ${w.year}-W${String(w.week).padStart(2,"0")} (${mon}→${sun})`;
}
function addDaysISO(dateISO, days){
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();

  const d2 = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day2 = d2.getUTCDay() || 7;
  d2.setUTCDate(d2.getUTCDate() - (day2 - 1));
  const mondayISO = `${d2.getUTCFullYear()}-${String(d2.getUTCMonth()+1).padStart(2,"0")}-${String(d2.getUTCDate()).padStart(2,"0")}`;

  return { year, week: weekNo, mondayISO };
}

/* ---------- Charts ---------- */
function renderCharts(rows){
  const labels = rows.map(r => r.periodLabel);
  const totals = rows.map(r => r.total);
  const cash = rows.map(r => r.cash);
  const card = rows.map(r => r.card);

  if (chartTotal) chartTotal.destroy();
  chartTotal = new Chart($("chartTotal"), {
    type: "line",
    data: { labels, datasets: [{ label: "Total", data: totals, tension: 0.3 }] },
    options: baseChartOptions()
  });

  if (chartMix) chartMix.destroy();
  chartMix = new Chart($("chartMix"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Efectivo", data: cash }, { label: "Tarjeta", data: card }] },
    options: baseChartOptions()
  });
}

function baseChartOptions(){
  const isLight = document.documentElement.getAttribute("data-theme") === "light";
  return {
    responsive: true,
    plugins: { legend: { labels: { color: isLight ? "#101828" : "#eaf0ff" } } },
    scales: {
      x: { ticks: { color: isLight ? "#101828" : "#eaf0ff" }, grid: { color: "rgba(255,255,255,.06)" } },
      y: { ticks: { color: isLight ? "#101828" : "#eaf0ff" }, grid: { color: "rgba(255,255,255,.06)" } },
    }
  };
}

/* ---------- Ranking ---------- */
function renderRanking(from, to){
  const sums = STORES.map(s => {
    const rows = buildReport("daily", s.id, from, to);
    const total = rows.reduce((a,r)=>a + r.total, 0);
    return { id: s.id, name: s.name, total };
  }).sort((a,b)=> b.total - a.total);

  rankList.innerHTML = "";
  for (const it of sums){
    const div = document.createElement("div");
    div.className = "rankitem";
    div.innerHTML = `
      <div class="left"><div class="dot"></div><div><b>${escapeHtml(it.name)}</b></div></div>
      <div>${formatMoney(it.total)}</div>
    `;
    rankList.appendChild(div);
  }

  const best = sums[0];
  const worst = sums[sums.length - 1];

  bestStore.textContent = best ? best.name : "—";
  bestStoreTxt.textContent = best ? `Total: ${formatMoney(best.total)}` : "—";

  worstStore.textContent = worst ? worst.name : "—";
  worstStoreTxt.textContent = worst ? `Total: ${formatMoney(worst.total)}` : "—";
}

/* ---------- WhatsApp ---------- */
function buildWhatsAppDayText(dateISO){
  const totals = computeDayTotals(dateISO);
  const dayName = weekdayES(dateISO);

  const sp = totals.byStore.san_pablo;
  const sl = totals.byStore.san_lesmes;
  const sa = totals.byStore.santiago;
  const g  = totals.global;

  return [
    `📊 *RESUMEN DEL DÍA*`,
    `📅 ${dateISO} (${dayName})`,
    ``,
    `🏪 *San Pablo*`,
    `🧾 Total: ${formatMoney(sp.total)} · Ticket: ${formatMoney(sp.ticket)} · Dif: ${formatDiff(sp.diff)}`,
    `💶 Efectivo: ${formatMoney(sp.cash)} · 💳 Tarjeta: ${formatMoney(sp.card)}`,
    ``,
    `🏪 *San Lesmes*`,
    `🧾 Total: ${formatMoney(sl.total)} · Ticket: ${formatMoney(sl.ticket)} · Dif: ${formatDiff(sl.diff)}`,
    `💶 Efectivo: ${formatMoney(sl.cash)} · 💳 Tarjeta: ${formatMoney(sl.card)}`,
    ``,
    `🏪 *Santiago*`,
    `🧾 Total: ${formatMoney(sa.total)} · Ticket: ${formatMoney(sa.ticket)} · Dif: ${formatDiff(sa.diff)}`,
    `💶 Efectivo: ${formatMoney(sa.cash)} · 💳 Tarjeta: ${formatMoney(sa.card)}`,
    ``,
    `🌍 *GLOBAL (3 tiendas)*`,
    `🧾 Total global: ${formatMoney(g.total)} · Ticket global: ${formatMoney(g.ticket)} · Dif: ${formatDiff(g.diff)}`,
    `💶 Efectivo global: ${formatMoney(g.cash)} · 💳 Tarjeta global: ${formatMoney(g.card)}`
  ].join("\n");
}

function sendWhatsAppReport(full=false){
  const type = reportType.value;
  const store = reportStore.value;
  const from = rangeFrom.value || null;
  const to = rangeTo.value || null;

  const rows = buildReport(type, store, from, to);
  if (!rows.length){
    alert("No hay datos para este reporte.");
    return;
  }

  const titleType = (type === "daily") ? "DIARIO" : (type === "weekly") ? "SEMANAL" : "MENSUAL";
  const titleStore = (store === "global") ? "GLOBAL (3 tiendas)" : storeName(store);

  const sum = rows.reduce((acc,r)=>({
    cash: acc.cash + r.cash,
    card: acc.card + r.card,
    total: acc.total + r.total
  }), {cash:0, card:0, total:0});

  const list = full ? rows : rows.slice(-10);
  const first = rows[0].periodLabel;
  const last = rows[rows.length - 1].periodLabel;

  const lines = [];
  lines.push(`📈 *REPORTE ${titleType}*`);
  lines.push(`🏷️ ${titleStore}`);
  if (from || to) lines.push(`📌 Rango: ${from || "—"} → ${to || "—"}`);
  lines.push(``);
  lines.push(`💶 Efectivo: ${formatMoney(sum.cash)}`);
  lines.push(`💳 Tarjeta: ${formatMoney(sum.card)}`);
  lines.push(`🧾 TOTAL: ${formatMoney(sum.total)}`);
  lines.push(``);
  lines.push(`🗂️ *${full ? "Reporte completo" : "Últimos " + list.length + " periodos"}*:`);

  for (const r of list){
    lines.push(`• ${r.periodLabel} — Efe ${formatMoney(r.cash)} · Tar ${formatMoney(r.card)} · Total ${formatMoney(r.total)}`);
  }

  lines.push(``);
  lines.push(`📌 Periodos: ${first} → ${last}`);

  openWhatsApp(lines.join("\n"));
}

function openWhatsApp(text){
  const url = "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

/* ---------- Export CSV ---------- */
function exportCSV(){
  const type = reportType.value;
  const store = reportStore.value;
  const from = rangeFrom.value || null;
  const to = rangeTo.value || null;

  const rows = buildReport(type, store, from, to);
  if (!rows.length){
    alert("No hay datos para exportar.");
    return;
  }

  const header = ["Periodo","Efectivo","Tarjeta","Total"];
  const lines = [header.join(";")];

  for (const r of rows){
    lines.push([
      `"${r.periodLabel.replaceAll('"','""')}"`,
      r.cash.toFixed(2).replace(".", ","),
      r.card.toFixed(2).replace(".", ","),
      r.total.toFixed(2).replace(".", ",")
    ].join(";"));
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte_${type}_${store}_${(from||"")}_${(to||"")}.csv`.replaceAll("__","_");
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- Backup JSON ---------- */
function exportBackup(){
  const payload = {
    meta: { app: "ARSLAN_FACTURACION_PRO_V4", exportedAt: new Date().toISOString() },
    state,
    settings: { ...settings, isLogged:false } // no exporta sesión activa
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_arslan_facturacion_${toISODate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(){
  const file = importFile.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try{
      const payload = JSON.parse(reader.result);
      if (!payload?.state?.entries) throw new Error("Formato no válido.");

      state = payload.state;
      saveState();

      if (payload.settings){
        const keepTheme = settings.theme;
        const keepPinHash = settings.pinHash || DEFAULT_PIN_HASH; // protege pin
        settings = { ...settings, ...payload.settings, isLogged:false, theme:keepTheme, pinHash: keepPinHash };
        saveSettings();
      }

      initDefaults();
      fillEntryIfExists();
      renderTodaySummary();
      renderDayHistory();
      renderGoals();
      refreshReports();
      alert("Importado correctamente ✅");
    }catch(err){
      alert("Error importando: " + err.message);
    }finally{
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

/* ---------- UX ---------- */
function toast(el, text, ok=true){
  el.className = "msg " + (ok ? "ok" : "err");
  el.textContent = text;
}
async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
  }catch{
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}
