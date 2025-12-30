/* =========================
   ARSLAN — Facturación Diaria
   3 tiendas + PIN + Reportes + Gráficos + WhatsApp
   Guardado localStorage
========================= */

const APP_KEY = "ARSLAN_FACTURACION_V1";
const SETTINGS_KEY = "ARSLAN_FACTURACION_SETTINGS_V1";
const DEFAULT_PIN = "8410";

// WhatsApp fijo (España +34)
const WA_PHONE = "34631667893"; // +34 631 667 893

const STORES = [
  { id: "san_pablo", name: "San Pablo" },
  { id: "san_lesmes", name: "San Lesmes" },
  { id: "santiago", name: "Santiago" },
];

let state = loadState();
let settings = loadSettings();

const $ = (id) => document.getElementById(id);

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

const btnSave = $("btnSave");
const btnClear = $("btnClear");
const btnDelete = $("btnDelete");
const btnWhatsAppDay = $("btnWhatsAppDay");
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

// Reports
const reportType = $("reportType");
const reportStore = $("reportStore");
const btnRefresh = $("btnRefresh");
const btnWhatsAppReport = $("btnWhatsAppReport");

const kpiCash = $("kpiCash");
const kpiCard = $("kpiCard");
const kpiTotal = $("kpiTotal");
const kpiAvg = $("kpiAvg");

const reportTableBody = $("reportTable").querySelector("tbody");
const tableHint = $("tableHint");

// Top controls
const btnLogout = $("btnLogout");
const btnBackup = $("btnBackup");
const importFile = $("importFile");
const btnTheme = $("btnTheme");
const btnThemeLogin = $("btnThemeLogin");

// Charts
let chartTotal = null;
let chartMix = null;

/* -------------------------
   INIT
------------------------- */
applyTheme(settings.theme || "dark");
initDateDefault();
renderTodaySummary();
refreshReports();

btnLogin.addEventListener("click", doLogin);
pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

btnTheme.addEventListener("click", toggleTheme);
btnThemeLogin.addEventListener("click", toggleTheme);

btnLogout.addEventListener("click", () => {
  settings.isLogged = false;
  saveSettings();
  showLogin();
});

btnSave.addEventListener("click", onSave);
btnClear.addEventListener("click", clearEntry);
btnDelete.addEventListener("click", onDelete);
btnWhatsAppDay.addEventListener("click", sendWhatsAppDay);

btnRefresh.addEventListener("click", refreshReports);
btnWhatsAppReport.addEventListener("click", sendWhatsAppReport);

btnBackup.addEventListener("click", exportBackup);
importFile.addEventListener("change", importBackup);

dateInput.addEventListener("change", () => {
  renderTodaySummary();
  fillEntryIfExists();
});
storeInput.addEventListener("change", fillEntryIfExists);

cashInput.addEventListener("input", () => normalizeMoneyInput(cashInput));
cardInput.addEventListener("input", () => normalizeMoneyInput(cardInput));

if (settings.isLogged) showApp();
else showLogin();

/* -------------------------
   VIEWS
------------------------- */
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
  initDateDefault();
  fillEntryIfExists();
  renderTodaySummary();
  refreshReports();
}

/* -------------------------
   LOGIN
------------------------- */
function doLogin(){
  const pin = (pinInput.value || "").trim();
  const validPin = settings.pin || DEFAULT_PIN;

  if (pin === validPin){
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

/* -------------------------
   THEME
------------------------- */
function toggleTheme(){
  const next = (document.documentElement.getAttribute("data-theme") === "light") ? "dark" : "light";
  applyTheme(next);
  settings.theme = next;
  saveSettings();
  refreshReports(); // refresca colores charts
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
}

/* -------------------------
   STORAGE
------------------------- */
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

function saveState(){
  localStorage.setItem(APP_KEY, JSON.stringify(state));
}

function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { isLogged:false, pin: DEFAULT_PIN, theme:"dark" };
    const parsed = JSON.parse(raw);
    if (!parsed.pin) parsed.pin = DEFAULT_PIN;
    if (typeof parsed.isLogged !== "boolean") parsed.isLogged = false;
    if (!parsed.theme) parsed.theme = "dark";
    return parsed;
  }catch{
    return { isLogged:false, pin: DEFAULT_PIN, theme:"dark" };
  }
}

function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* -------------------------
   HELPERS
------------------------- */
function initDateDefault(){
  dateInput.value = toISODate(new Date());
}

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

function formatMoney(n){
  const v = Number(n || 0);
  return v.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
}

function normalizeMoneyInput(inputEl){
  inputEl.value = String(inputEl.value || "").replace(/[^\d,.-]/g,"");
}

function round2(n){
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function keyOf(dateISO, storeId){
  return `${dateISO}__${storeId}`;
}

function getEntry(dateISO, storeId){
  return state.entries[keyOf(dateISO, storeId)] || null;
}

function setEntry(dateISO, storeId, cash, card){
  state.entries[keyOf(dateISO, storeId)] = {
    date: dateISO,
    store: storeId,
    cash,
    card,
    updatedAt: new Date().toISOString()
  };
  saveState();
}

function deleteEntry(dateISO, storeId){
  delete state.entries[keyOf(dateISO, storeId)];
  saveState();
}

function storeName(id){
  return STORES.find(s => s.id === id)?.name || id;
}

/* -------------------------
   WEEKDAY ES
------------------------- */
function weekdayES(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const days = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  return days[d.getDay()];
}
function dailyLabelWithWeekday(dateISO){
  return `${dateISO} (${weekdayES(dateISO)})`;
}

/* -------------------------
   ENTRY FORM
------------------------- */
function fillEntryIfExists(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;
  const e = getEntry(dateISO, storeId);

  if (e){
    cashInput.value = String(e.cash ?? "").replace(".", ",");
    cardInput.value = String(e.card ?? "").replace(".", ",");
  } else {
    cashInput.value = "";
    cardInput.value = "";
  }
  saveMsg.textContent = "";
  saveMsg.className = "msg";
}

function clearEntry(){
  cashInput.value = "";
  cardInput.value = "";
  saveMsg.textContent = "";
  saveMsg.className = "msg";
}

function onSave(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;

  if (!dateISO){
    saveMsg.className = "msg err";
    saveMsg.textContent = "Selecciona una fecha.";
    return;
  }

  const cash = round2(parseMoney(cashInput.value));
  const card = round2(parseMoney(cardInput.value));

  setEntry(dateISO, storeId, cash, card);

  saveMsg.className = "msg ok";
  saveMsg.textContent = `Guardado ✅ (${storeName(storeId)} — ${formatMoney(cash)} efectivo, ${formatMoney(card)} tarjeta)`;

  renderTodaySummary();
  refreshReports();
}

function onDelete(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;

  const e = getEntry(dateISO, storeId);
  if (!e){
    saveMsg.className = "msg err";
    saveMsg.textContent = "No existe registro para borrar.";
    return;
  }

  deleteEntry(dateISO, storeId);
  saveMsg.className = "msg ok";
  saveMsg.textContent = "Registro borrado ✅";

  fillEntryIfExists();
  renderTodaySummary();
  refreshReports();
}

/* -------------------------
   TODAY SUMMARY
------------------------- */
function computeDayTotals(dateISO){
  const byStore = {};
  let gCash = 0, gCard = 0;

  for (const s of STORES){
    const e = getEntry(dateISO, s.id);
    const cash = e?.cash || 0;
    const card = e?.card || 0;
    const total = cash + card;
    byStore[s.id] = { cash, card, total };
    gCash += cash;
    gCard += card;
  }

  return {
    byStore,
    global: { cash: gCash, card: gCard, total: gCash + gCard }
  };
}

function renderTodaySummary(){
  const dateISO = dateInput.value;
  const totals = computeDayTotals(dateISO);

  const sp = totals.byStore.san_pablo || { cash:0, card:0, total:0 };
  const sl = totals.byStore.san_lesmes || { cash:0, card:0, total:0 };
  const sa = totals.byStore.santiago || { cash:0, card:0, total:0 };

  sumSP.textContent = formatMoney(sp.total);
  sumSP2.textContent = `Efe: ${formatMoney(sp.cash)} · Tar: ${formatMoney(sp.card)}`;

  sumSL.textContent = formatMoney(sl.total);
  sumSL2.textContent = `Efe: ${formatMoney(sl.cash)} · Tar: ${formatMoney(sl.card)}`;

  sumSA.textContent = formatMoney(sa.total);
  sumSA2.textContent = `Efe: ${formatMoney(sa.cash)} · Tar: ${formatMoney(sa.card)}`;

  sumGlobal.textContent = formatMoney(totals.global.total);
  sumGlobal2.textContent = `Efectivo: ${formatMoney(totals.global.cash)} · Tarjeta: ${formatMoney(totals.global.card)}`;
}

/* -------------------------
   REPORTS
------------------------- */
function refreshReports(){
  const type = reportType.value;
  const store = reportStore.value;

  const rows = buildReport(type, store);

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
    ? `Mostrando ${rows.length} periodos.`
    : "No hay datos aún. Empieza guardando ventas.";

  renderCharts(rows);
}

function buildReport(type, store){
  const all = Object.values(state.entries || []);
  if (!all.length) return [];

  const filtered = all.filter(e => store === "global" ? true : e.store === store);
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
      periodLabel = period; // simple
    } else {
      period = monthLabel(date);
      periodLabel = period;
    }

    const prev = map.get(period) || {
      period,
      periodLabel,
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

/* Week / Month labels */
function monthLabel(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  return `${y}-${m}`;
}

function isoWeekLabel(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const w = isoWeek(d);
  return `${w.year}-W${String(w.week).padStart(2,"0")}`;
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

/* -------------------------
   CHARTS
------------------------- */
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
    plugins: {
      legend: { labels: { color: isLight ? "#101828" : "#eaf0ff" } }
    },
    scales: {
      x: { ticks: { color: isLight ? "#101828" : "#eaf0ff" }, grid: { color: "rgba(255,255,255,.06)" } },
      y: { ticks: { color: isLight ? "#101828" : "#eaf0ff" }, grid: { color: "rgba(255,255,255,.06)" } },
    }
  };
}

/* -------------------------
   WHATSAPP
------------------------- */
function sendWhatsAppDay(){
  const dateISO = dateInput.value;
  if (!dateISO){
    alert("Selecciona una fecha.");
    return;
  }

  const totals = computeDayTotals(dateISO);
  const dayName = weekdayES(dateISO);

  const sp = totals.byStore.san_pablo;
  const sl = totals.byStore.san_lesmes;
  const sa = totals.byStore.santiago;
  const g  = totals.global;

  const text = [
    `📊 *RESUMEN DEL DÍA*`,
    `📅 ${dateISO} (${dayName})`,
    ``,
    `🏪 *San Pablo*`,
    `💶 Efectivo: ${formatMoney(sp.cash)}`,
    `💳 Tarjeta: ${formatMoney(sp.card)}`,
    `🧾 Total: ${formatMoney(sp.total)}`,
    ``,
    `🏪 *San Lesmes*`,
    `💶 Efectivo: ${formatMoney(sl.cash)}`,
    `💳 Tarjeta: ${formatMoney(sl.card)}`,
    `🧾 Total: ${formatMoney(sl.total)}`,
    ``,
    `🏪 *Santiago*`,
    `💶 Efectivo: ${formatMoney(sa.cash)}`,
    `💳 Tarjeta: ${formatMoney(sa.card)}`,
    `🧾 Total: ${formatMoney(sa.total)}`,
    ``,
    `🌍 *GLOBAL (3 tiendas)*`,
    `💶 Efectivo global: ${formatMoney(g.cash)}`,
    `💳 Tarjeta global: ${formatMoney(g.card)}`,
    `🧾 Total global: ${formatMoney(g.total)}`
  ].join("\n");

  const url = "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

function sendWhatsAppReport(){
  const type = reportType.value;     // daily/weekly/monthly
  const store = reportStore.value;   // global/tienda

  const rows = buildReport(type, store);
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

  const lastRows = rows.slice(-10);
  const first = rows[0].periodLabel;
  const last = rows[rows.length - 1].periodLabel;

  const lines = [];
  lines.push(`📈 *REPORTE ${titleType}*`);
  lines.push(`🏷️ ${titleStore}`);
  lines.push(``);
  lines.push(`💶 Efectivo: ${formatMoney(sum.cash)}`);
  lines.push(`💳 Tarjeta: ${formatMoney(sum.card)}`);
  lines.push(`🧾 TOTAL: ${formatMoney(sum.total)}`);
  lines.push(``);
  lines.push(`🗂️ *Últimos ${lastRows.length} periodos*:`);

  for (const r of lastRows){
    lines.push(`• ${r.periodLabel} — Efe ${formatMoney(r.cash)} · Tar ${formatMoney(r.card)} · Total ${formatMoney(r.total)}`);
  }

  lines.push(``);
  lines.push(`📌 Rango: ${first} → ${last}`);

  const url = "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(lines.join("\n"));
  window.open(url, "_blank");
}

/* -------------------------
   BACKUP
------------------------- */
function exportBackup(){
  const payload = {
    meta: { app: "ARSLAN_FACTURACION_V1", exportedAt: new Date().toISOString() },
    state,
    settings: { ...settings, isLogged: false }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
        settings = { ...settings, ...payload.settings, isLogged: true, theme: keepTheme };
        saveSettings();
      }

      initDateDefault();
      fillEntryIfExists();
      renderTodaySummary();
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

/* -------------------------
   UTILS
------------------------- */
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

