/* =========================
   ARSLAN — Facturación Diaria
   3 tiendas + PIN + Reportes + Gráficos
   Guardado localStorage
========================= */

const APP_KEY = "ARSLAN_FACTURACION_V1";
const SETTINGS_KEY = "ARSLAN_FACTURACION_SETTINGS_V1";

// Cambia aquí el PIN si quieres
const DEFAULT_PIN = "1234";

const STORES = [
  { id: "san_pablo", name: "San Pablo" },
  { id: "san_lesmes", name: "San Lesmes" },
  { id: "santiago", name: "Santiago" },
];

let state = loadState();
let settings = loadSettings();

const $ = (id) => document.getElementById(id);

const loginView = $("loginView");
const appView = $("appView");

const pinInput = $("pinInput");
const btnLogin = $("btnLogin");
const loginMsg = $("loginMsg");

const dateInput = $("dateInput");
const storeInput = $("storeInput");
const cashInput = $("cashInput");
const cardInput = $("cardInput");
const btnSave = $("btnSave");
const btnClear = $("btnClear");
const btnDelete = $("btnDelete");
const saveMsg = $("saveMsg");

const sumSP = $("sumSP");
const sumSP2 = $("sumSP2");
const sumSL = $("sumSL");
const sumSL2 = $("sumSL2");
const sumSA = $("sumSA");
const sumSA2 = $("sumSA2");
const sumGlobal = $("sumGlobal");
const sumGlobal2 = $("sumGlobal2");

const reportType = $("reportType");
const reportStore = $("reportStore");
const btnRefresh = $("btnRefresh");

const kpiCash = $("kpiCash");
const kpiCard = $("kpiCard");
const kpiTotal = $("kpiTotal");
const kpiAvg = $("kpiAvg");

const reportTable = $("reportTable").querySelector("tbody");
const tableHint = $("tableHint");

const btnLogout = $("btnLogout");
const btnBackup = $("btnBackup");
const importFile = $("importFile");

const btnTheme = $("btnTheme");
const btnThemeLogin = $("btnThemeLogin");

let chartTotal = null;
let chartMix = null;

/* -------------------------
   Init
------------------------- */
applyTheme(settings.theme || "dark");
initDateDefault();
renderTodaySummary();
refreshReports();

btnLogin.addEventListener("click", doLogin);
pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

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

btnRefresh.addEventListener("click", refreshReports);

btnBackup.addEventListener("click", exportBackup);
importFile.addEventListener("change", importBackup);

dateInput.addEventListener("change", () => {
  renderTodaySummary();
  fillEntryIfExists();
});
storeInput.addEventListener("change", fillEntryIfExists);

cashInput.addEventListener("input", () => normalizeMoneyInput(cashInput));
cardInput.addEventListener("input", () => normalizeMoneyInput(cardInput));

/* Auto-login si estaba logueado */
if (settings.isLogged) showApp();
else showLogin();

/* -------------------------
   Views
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
   Login
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
   Theme
------------------------- */
function toggleTheme(){
  const next = (document.documentElement.getAttribute("data-theme") === "light") ? "dark" : "light";
  applyTheme(next);
  settings.theme = next;
  saveSettings();
}

function applyTheme(theme){
  document.documentElement.setAttribute("data-theme", theme);
}

/* -------------------------
   State (Storage)
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
   Helpers
------------------------- */
function initDateDefault(){
  const today = new Date();
  dateInput.value = toISODate(today);
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
  // Permite coma o punto, y limpia caracteres raros
  const v = inputEl.value;
  const clean = v.replace(/[^\d,.-]/g,"");
  inputEl.value = clean;
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
   Entry form
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

function round2(n){
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* -------------------------
   Today Summary (per store + global)
------------------------- */
function renderTodaySummary(){
  const dateISO = dateInput.value;
  const totals = computeDayTotals(dateISO);

  // Por tienda: mostrar TOTAL y debajo mix efectivo/tarjeta
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

/* -------------------------
   Reports
------------------------- */
function refreshReports(){
  const type = reportType.value;
  const store = reportStore.value;

  const rows = buildReport(type, store);

  // KPIs
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

  // Table
  reportTable.innerHTML = "";
  for (const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.period)}</td>
      <td>${formatMoney(r.cash)}</td>
      <td>${formatMoney(r.card)}</td>
      <td><b>${formatMoney(r.total)}</b></td>
    `;
    reportTable.appendChild(tr);
  }

  tableHint.textContent = rows.length
    ? `Mostrando ${rows.length} periodos.`
    : "No hay datos aún. Empieza guardando ventas.";

  // Charts
  renderCharts(rows);
}

function buildReport(type, store){
  // Recolectar entradas -> agrupar por periodo
  const all = Object.values(state.entries || []);
  if (!all.length) return [];

  const filtered = all.filter(e => store === "global" ? true : e.store === store);

  const map = new Map();

  for (const e of filtered){
    const date = e.date; // YYYY-MM-DD
    const cash = Number(e.cash || 0);
    const card = Number(e.card || 0);

    const period = (type === "daily")
      ? date
      : (type === "weekly")
        ? isoWeekLabel(date)
        : monthLabel(date);

    const prev = map.get(period) || { period, cash:0, card:0, total:0, sortKey: periodSortKey(type, date) };
    prev.cash += cash;
    prev.card += card;
    prev.total += (cash + card);

    // sortKey (para ordenar cronológico)
    prev.sortKey = Math.min(prev.sortKey, periodSortKey(type, date));
    map.set(period, prev);
  }

  const rows = Array.from(map.values());
  rows.sort((a,b)=> a.sortKey - b.sortKey);
  // redondeo
  return rows.map(r => ({
    period: r.period,
    cash: round2(r.cash),
    card: round2(r.card),
    total: round2(r.total),
    sortKey: r.sortKey
  }));
}

function periodSortKey(type, dateISO){
  // clave numérica para ordenar
  const d = new Date(dateISO + "T00:00:00");
  if (type === "daily") return d.getTime();
  if (type === "weekly"){
    const wk = isoWeek(d);
    return new Date(wk.mondayISO + "T00:00:00").getTime();
  }
  // monthly
  return (d.getFullYear() * 100 + (d.getMonth()+1)) * 100; // aprox
}

function estimateDaysCovered(rows, type){
  if (!rows.length) return 0;
  if (type === "daily") return rows.length;
  if (type === "weekly") return rows.length * 7;
  if (type === "monthly") return rows.length * 30; // aproximación para KPI promedio
  return rows.length;
}

/* -------------------------
   Week / Month labels
------------------------- */
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
  // ISO week number + monday date
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  const year = d.getUTCFullYear();

  // monday of that week
  const d2 = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day2 = d2.getUTCDay() || 7;
  d2.setUTCDate(d2.getUTCDate() - (day2 - 1));
  const mondayISO = `${d2.getUTCFullYear()}-${String(d2.getUTCMonth()+1).padStart(2,"0")}-${String(d2.getUTCDate()).padStart(2,"0")}`;

  return { year, week: weekNo, mondayISO };
}

/* -------------------------
   Charts
------------------------- */
function renderCharts(rows){
  const labels = rows.map(r => r.period);
  const totals = rows.map(r => r.total);
  const cash = rows.map(r => r.cash);
  const card = rows.map(r => r.card);

  // Total line
  if (chartTotal) chartTotal.destroy();
  chartTotal = new Chart($("chartTotal"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Total", data: totals, tension: 0.3 }
      ]
    },
    options: baseChartOptions()
  });

  // Mix bar
  if (chartMix) chartMix.destroy();
  chartMix = new Chart($("chartMix"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Efectivo", data: cash },
        { label: "Tarjeta", data: card },
      ]
    },
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
   Backup (Export/Import)
------------------------- */
function exportBackup(){
  const payload = {
    meta: {
      app: "ARSLAN_FACTURACION_V1",
      exportedAt: new Date().toISOString()
    },
    state,
    settings: { ...settings, isLogged: false } // no exportar sesión
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

      // settings opcional
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
   Utils
------------------------- */
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
