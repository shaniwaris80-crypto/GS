/* =========================
   ARSLAN — Facturación Diaria PRO (Pack C)
   - Login hash + fallback
   - 3 tiendas
   - Ventas + Ticket + Dif ticket
   - Caja real: gastos/retiradas/ingresos extra + contado + dif caja
   - Últimos 7 días: edición/borrado rápido
   - WhatsApp día + WhatsApp semana (lunes→domingo)
   - Reportes: incluye Ticket y Dif ticket
   - Objetivos por tienda + global + semáforo
========================= */

const APP_KEY = "ARSLAN_FACTURACION_PACKC_V1";
const SETTINGS_KEY = "ARSLAN_FACTURACION_PACKC_SETTINGS_V1";

const WA_PHONE = "34631667893";

// PIN (no se muestra): 7392
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
const loginView = $("loginView");
const appView = $("appView");

const pinInput = $("pinInput");
const btnLogin = $("btnLogin");
const loginMsg = $("loginMsg");

const dateInput = $("dateInput");
const storeInput = $("storeInput");
const cashInput = $("cashInput");
const cardInput = $("cardInput");
const ticketInput = $("ticketInput");
const diffBox = $("diffBox");

const expensesInput = $("expensesInput");
const withdrawalsInput = $("withdrawalsInput");
const extraIncomeInput = $("extraIncomeInput");
const cashCountedInput = $("cashCountedInput");
const notesInput = $("notesInput");
const expectedCashBox = $("expectedCashBox");
const cashDiffBox = $("cashDiffBox");

const btnSave = $("btnSave");
const btnClear = $("btnClear");
const btnDelete = $("btnDelete");
const btnWhatsAppDay = $("btnWhatsAppDay");
const btnCopyDay = $("btnCopyDay");

const dayList = $("dayList");
const dayHint = $("dayHint");
const saveMsg = $("saveMsg");

const sumSP = $("sumSP");
const sumSP2 = $("sumSP2");
const sumSL = $("sumSL");
const sumSL2 = $("sumSL2");
const sumSA = $("sumSA");
const sumSA2 = $("sumSA2");
const sumGlobal = $("sumGlobal");
const sumGlobal2 = $("sumGlobal2");

const semSP = $("semSP");
const semSL = $("semSL");
const semSA = $("semSA");
const semGlobal = $("semGlobal");

const goalDailySP = $("goalDailySP");
const goalMonthlySP = $("goalMonthlySP");
const goalDailySL = $("goalDailySL");
const goalMonthlySL = $("goalMonthlySL");
const goalDailySA = $("goalDailySA");
const goalMonthlySA = $("goalMonthlySA");
const goalDailyG = $("goalDailyG");
const goalMonthlyG = $("goalMonthlyG");
const btnSaveGoals = $("btnSaveGoals");
const goalTodayPct = $("goalTodayPct");
const goalTodayTxt = $("goalTodayTxt");
const goalMonthPct = $("goalMonthPct");
const goalMonthTxt = $("goalMonthTxt");

const btnRefresh7 = $("btnRefresh7");
const btnWhatsAppWeek = $("btnWhatsAppWeek");
const table7Body = $("table7").querySelector("tbody");
const hint7 = $("hint7");

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
const kpiTicket = $("kpiTicket");
const kpiDiff = $("kpiDiff");
const kpiAvg = $("kpiAvg");

const reportTableBody = $("reportTable").querySelector("tbody");
const tableHint = $("tableHint");

const rankList = $("rankList");
const bestStore = $("bestStore");
const bestStoreTxt = $("bestStoreTxt");
const worstStore = $("worstStore");
const worstStoreTxt = $("worstStoreTxt");

const btnLogout = $("btnLogout");
const btnBackup = $("btnBackup");
const importFile = $("importFile");
const btnTheme = $("btnTheme");
const btnThemeLogin = $("btnThemeLogin");

let chartTotal = null;
let chartMix = null;

/* ---------- INIT ---------- */
applyTheme(settings.theme || "dark");
initDefaults();
bindEvents();

if (settings.isLogged) showApp();
else showLogin();

/* ---------- Events ---------- */
function bindEvents(){
  btnLogin.addEventListener("click", doLogin);
  pinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });

  btnTheme.addEventListener("click", toggleTheme);
  btnThemeLogin.addEventListener("click", toggleTheme);

  btnLogout.addEventListener("click", () => {
    settings.isLogged = false;
    saveSettings();
    showLogin();
  });

  dateInput.addEventListener("change", () => {
    fillEntryIfExists();
    renderTodaySummary();
    renderDayHistory();
    renderGoals();
    refresh7Days();
    refreshReports();
  });
  storeInput.addEventListener("change", fillEntryIfExists);

  const moneyInputs = [cashInput, cardInput, ticketInput, expensesInput, withdrawalsInput, extraIncomeInput, cashCountedInput];
  for (const el of moneyInputs){
    el.addEventListener("input", () => { normalizeMoneyInput(el); updateDiffBoxes(); });
  }

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

  btnRefresh7.addEventListener("click", refresh7Days);
  btnWhatsAppWeek.addEventListener("click", () => openWhatsApp(buildWhatsAppWeekText(getSelectedDate())));

  btnRefresh.addEventListener("click", refreshReports);
  btnWhatsAppReport.addEventListener("click", () => sendWhatsAppReport(false));
  btnWhatsAppReportFull.addEventListener("click", () => sendWhatsAppReport(true));
  btnExportCSV.addEventListener("click", exportCSV);

  btnBackup.addEventListener("click", exportBackup);
  importFile.addEventListener("change", importBackup);
}

/* ---------- Defaults ---------- */
function initDefaults(){
  const today = toISODate(new Date());

  if (!settings.goals) {
    settings.goals = {
      san_pablo:{daily:0, monthly:0},
      san_lesmes:{daily:0, monthly:0},
      santiago:{daily:0, monthly:0},
      global:{daily:0, monthly:0},
    };
    saveSettings();
  }

  const firstDay = today.slice(0,7) + "-01";
  dateInput.value = today;
  rangeFrom.value = firstDay;
  rangeTo.value = today;

  // fill goal inputs
  goalDailySP.value = fmtInput(settings.goals.san_pablo.daily);
  goalMonthlySP.value = fmtInput(settings.goals.san_pablo.monthly);
  goalDailySL.value = fmtInput(settings.goals.san_lesmes.daily);
  goalMonthlySL.value = fmtInput(settings.goals.san_lesmes.monthly);
  goalDailySA.value = fmtInput(settings.goals.santiago.daily);
  goalMonthlySA.value = fmtInput(settings.goals.santiago.monthly);
  goalDailyG.value = fmtInput(settings.goals.global.daily);
  goalMonthlyG.value = fmtInput(settings.goals.global.monthly);
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
  refresh7Days();
  refreshReports();
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

/* ---------- Login ---------- */
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
  try{
    if (crypto?.subtle?.digest){
      const enc = new TextEncoder();
      const data = enc.encode(text);
      const hashBuf = await crypto.subtle.digest("SHA-256", data);
      const hashArr = Array.from(new Uint8Array(hashBuf));
      return hashArr.map(b => b.toString(16).padStart(2,"0")).join("");
    }
  }catch(e){}
  return sha256Fallback(text);
}

/* SHA-256 fallback JS puro (file://) */
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
    if (!raw) return { isLogged:false, theme:"dark", pinHash: DEFAULT_PIN_HASH, goals:null };
    const parsed = JSON.parse(raw);
    if (typeof parsed.isLogged !== "boolean") parsed.isLogged = false;
    if (!parsed.theme) parsed.theme = "dark";
    if (!parsed.pinHash || String(parsed.pinHash).length !== 64) parsed.pinHash = DEFAULT_PIN_HASH;
    return parsed;
  }catch{
    return { isLogged:false, theme:"dark", pinHash: DEFAULT_PIN_HASH, goals:null };
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
function fmtInput(n){
  const v = Number(n||0);
  return v ? String(v).replace(".", ",") : "";
}
function normalizeMoneyInput(el){
  el.value = String(el.value || "").replace(/[^\d,.-]/g,"");
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function weekdayES(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const days = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  return days[d.getDay()];
}
function dailyLabelWithWeekday(dateISO){
  return `${dateISO} (${weekdayES(dateISO)})`;
}
function storeName(id){ return STORES.find(s => s.id === id)?.name || id; }

function diffValue(ticket, total){ return round2((ticket || 0) - (total || 0)); }
function formatDiff(d){
  const v = Number(d || 0);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
}

function keyOf(dateISO, storeId){ return `${dateISO}__${storeId}`; }
function getEntry(dateISO, storeId){ return state.entries[keyOf(dateISO, storeId)] || null; }

function setEntry(dateISO, storeId, payload){
  state.entries[keyOf(dateISO, storeId)] = {
    date: dateISO,
    store: storeId,
    cash: payload.cash || 0,
    card: payload.card || 0,
    ticket: payload.ticket || 0,
    expenses: payload.expenses || 0,
    withdrawals: payload.withdrawals || 0,
    extraIncome: payload.extraIncome || 0,
    cashCounted: payload.cashCounted || 0,
    notes: payload.notes || "",
    updatedAt: new Date().toISOString()
  };
  saveState();
}
function deleteEntry(dateISO, storeId){
  delete state.entries[keyOf(dateISO, storeId)];
  saveState();
}

/* ---------- Calculations (Caja) ---------- */
function calcExpectedCash(e){
  // efectivo esperado = efectivo declarado - gastos - retiradas + ingresos extra
  const cash = Number(e?.cash || 0);
  const expenses = Number(e?.expenses || 0);
  const withdrawals = Number(e?.withdrawals || 0);
  const extraIncome = Number(e?.extraIncome || 0);
  return round2(cash - expenses - withdrawals + extraIncome);
}
function calcCashDiff(e){
  const counted = Number(e?.cashCounted || 0);
  return round2(counted - calcExpectedCash(e));
}

/* ---------- Entry UI ---------- */
function fillEntryIfExists(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;
  const e = getEntry(dateISO, storeId);

  if (e){
    cashInput.value = fmtInput(e.cash);
    cardInput.value = fmtInput(e.card);
    ticketInput.value = fmtInput(e.ticket);
    expensesInput.value = fmtInput(e.expenses);
    withdrawalsInput.value = fmtInput(e.withdrawals);
    extraIncomeInput.value = fmtInput(e.extraIncome);
    cashCountedInput.value = fmtInput(e.cashCounted);
    notesInput.value = e.notes || "";
  } else {
    cashInput.value = "";
    cardInput.value = "";
    ticketInput.value = "";
    expensesInput.value = "";
    withdrawalsInput.value = "";
    extraIncomeInput.value = "";
    cashCountedInput.value = "";
    notesInput.value = "";
  }

  updateDiffBoxes();
  saveMsg.textContent = "";
  saveMsg.className = "msg";
}

function updateDiffBoxes(){
  const cash = round2(parseMoney(cashInput.value));
  const card = round2(parseMoney(cardInput.value));
  const ticket = round2(parseMoney(ticketInput.value));
  const total = cash + card;

  const dt = diffValue(ticket, total);
  diffBox.textContent = (!ticketInput.value && !cashInput.value && !cardInput.value)
    ? "—"
    : `${formatDiff(dt)}  (Ticket ${formatMoney(ticket)} - Total ${formatMoney(total)})`;

  const tmp = {
    cash,
    expenses: round2(parseMoney(expensesInput.value)),
    withdrawals: round2(parseMoney(withdrawalsInput.value)),
    extraIncome: round2(parseMoney(extraIncomeInput.value)),
    cashCounted: round2(parseMoney(cashCountedInput.value))
  };
  const expected = round2(tmp.cash - tmp.expenses - tmp.withdrawals + tmp.extraIncome);
  const cd = round2(tmp.cashCounted - expected);

  expectedCashBox.textContent = `${formatMoney(expected)}  (Efe ${formatMoney(tmp.cash)} - Gastos ${formatMoney(tmp.expenses)} - Ret ${formatMoney(tmp.withdrawals)} + Extra ${formatMoney(tmp.extraIncome)})`;
  cashDiffBox.textContent = `${formatDiff(cd)}  (Contado ${formatMoney(tmp.cashCounted)} - Esperado ${formatMoney(expected)})`;
}

function clearEntry(){
  cashInput.value = "";
  cardInput.value = "";
  ticketInput.value = "";
  expensesInput.value = "";
  withdrawalsInput.value = "";
  extraIncomeInput.value = "";
  cashCountedInput.value = "";
  notesInput.value = "";
  updateDiffBoxes();
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

  const payload = {
    cash: round2(parseMoney(cashInput.value)),
    card: round2(parseMoney(cardInput.value)),
    ticket: round2(parseMoney(ticketInput.value)),
    expenses: round2(parseMoney(expensesInput.value)),
    withdrawals: round2(parseMoney(withdrawalsInput.value)),
    extraIncome: round2(parseMoney(extraIncomeInput.value)),
    cashCounted: round2(parseMoney(cashCountedInput.value)),
    notes: (notesInput.value || "").trim()
  };

  setEntry(dateISO, storeId, payload);

  const e = getEntry(dateISO, storeId);
  const total = round2(e.cash + e.card);
  const dt = diffValue(e.ticket, total);
  const expected = calcExpectedCash(e);
  const cd = calcCashDiff(e);

  toast(
    saveMsg,
    `Guardado ✅ (${storeName(storeId)} — Total ${formatMoney(total)} · Ticket ${formatMoney(e.ticket)} · DifT ${formatDiff(dt)} · Esperado ${formatMoney(expected)} · DifCaja ${formatDiff(cd)})`,
    true
  );

  renderTodaySummary();
  renderDayHistory();
  renderGoals();
  refresh7Days();
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
  refresh7Days();
  refreshReports();
}

/* ---------- Day totals ---------- */
function computeDayTotals(dateISO){
  const byStore = {};
  let gCash=0, gCard=0, gTicket=0;
  let gExpected=0, gCounted=0;

  for (const s of STORES){
    const e = getEntry(dateISO, s.id) || null;

    const cash = e?.cash || 0;
    const card = e?.card || 0;
    const ticket = e?.ticket || 0;
    const total = cash + card;
    const diffT = diffValue(ticket, total);

    const expected = e ? calcExpectedCash(e) : 0;
    const counted = e?.cashCounted || 0;
    const diffC = e ? calcCashDiff(e) : 0;

    byStore[s.id] = { cash, card, ticket, total, diffT, expected, counted, diffC };

    gCash += cash; gCard += card; gTicket += ticket;
    gExpected += expected; gCounted += counted;
  }

  const gTotal = gCash + gCard;
  const gDiffT = diffValue(gTicket, gTotal);
  const gDiffC = round2(gCounted - gExpected);

  return {
    byStore,
    global: {
      cash:gCash, card:gCard, ticket:gTicket,
      total:gTotal, diffT:gDiffT,
      expected:gExpected, counted:gCounted, diffC:gDiffC
    }
  };
}

/* ---------- Render summary + semáforo ---------- */
function renderTodaySummary(){
  const dateISO = dateInput.value;
  const totals = computeDayTotals(dateISO);

  const sp = totals.byStore.san_pablo;
  const sl = totals.byStore.san_lesmes;
  const sa = totals.byStore.santiago;
  const g  = totals.global;

  sumSP.textContent = formatMoney(sp.total);
  sumSP2.textContent = `Efe: ${formatMoney(sp.cash)} · Tar: ${formatMoney(sp.card)} · Ticket: ${formatMoney(sp.ticket)} · DifT: ${formatDiff(sp.diffT)} · Esperado: ${formatMoney(sp.expected)} · DifCaja: ${formatDiff(sp.diffC)}`;

  sumSL.textContent = formatMoney(sl.total);
  sumSL2.textContent = `Efe: ${formatMoney(sl.cash)} · Tar: ${formatMoney(sl.card)} · Ticket: ${formatMoney(sl.ticket)} · DifT: ${formatDiff(sl.diffT)} · Esperado: ${formatMoney(sl.expected)} · DifCaja: ${formatDiff(sl.diffC)}`;

  sumSA.textContent = formatMoney(sa.total);
  sumSA2.textContent = `Efe: ${formatMoney(sa.cash)} · Tar: ${formatMoney(sa.card)} · Ticket: ${formatMoney(sa.ticket)} · DifT: ${formatDiff(sa.diffT)} · Esperado: ${formatMoney(sa.expected)} · DifCaja: ${formatDiff(sa.diffC)}`;

  sumGlobal.textContent = formatMoney(g.total);
  sumGlobal2.textContent = `Efectivo: ${formatMoney(g.cash)} · Tarjeta: ${formatMoney(g.card)} · Ticket: ${formatMoney(g.ticket)} · DifT: ${formatDiff(g.diffT)} · Esperado: ${formatMoney(g.expected)} · DifCaja: ${formatDiff(g.diffC)}`;

  // semáforo por tienda y global (hoy)
  renderSemaforoRow(semSP, sp.total, settings.goals.san_pablo.daily);
  renderSemaforoRow(semSL, sl.total, settings.goals.san_lesmes.daily);
  renderSemaforoRow(semSA, sa.total, settings.goals.santiago.daily);
  renderSemaforoRow(semGlobal, g.total, settings.goals.global.daily);
}

function renderSemaforoRow(el, value, goal){
  el.innerHTML = "";
  const g = Number(goal || 0);
  if (!g){
    el.appendChild(tag("Define objetivo", "—"));
    return;
  }
  const pct = (value / g) * 100;
  if (pct >= 100) el.appendChild(tag("✅ OK", `${pct.toFixed(0)}%`));
  else if (pct >= 85) el.appendChild(tag("⚠️ Medio", `${pct.toFixed(0)}%`));
  else el.appendChild(tag("❌ Bajo", `${pct.toFixed(0)}%`));
}

function tag(title, value){
  const d = document.createElement("div");
  d.className = "tag";
  d.textContent = `${title} · ${value}`;
  return d;
}

/* ---------- Day history list ---------- */
function renderDayHistory(){
  const dateISO = dateInput.value;
  dayList.innerHTML = "";

  const items = STORES.map(s => {
    const e = getEntry(dateISO, s.id);
    const cash = e?.cash || 0;
    const card = e?.card || 0;
    const ticket = e?.ticket || 0;
    const total = cash + card;
    const diffT = diffValue(ticket, total);
    const expected = e ? calcExpectedCash(e) : 0;
    const counted = e?.cashCounted || 0;
    const diffC = e ? calcCashDiff(e) : 0;
    return { store:s.id, name:s.name, total, ticket, diffT, expected, counted, diffC, exists: !!e };
  });

  const existsCount = items.filter(x => x.exists).length;
  dayHint.textContent = `${dateISO} (${weekdayES(dateISO)}) · registros: ${existsCount}/3`;

  for (const it of items){
    const div = document.createElement("div");
    div.className = "dayitem";
    div.innerHTML = `
      <div>
        <div class="k">${escapeHtml(it.name)}</div>
        <div class="muted small">
          Total ${formatMoney(it.total)} · Ticket ${formatMoney(it.ticket)} · DifT ${formatDiff(it.diffT)}
          · Esperado ${formatMoney(it.expected)} · Contado ${formatMoney(it.counted)} · DifCaja ${formatDiff(it.diffC)}
        </div>
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
  settings.goals = {
    san_pablo: { daily: round2(parseMoney(goalDailySP.value)), monthly: round2(parseMoney(goalMonthlySP.value)) },
    san_lesmes:{ daily: round2(parseMoney(goalDailySL.value)), monthly: round2(parseMoney(goalMonthlySL.value)) },
    santiago:  { daily: round2(parseMoney(goalDailySA.value)), monthly: round2(parseMoney(goalMonthlySA.value)) },
    global:    { daily: round2(parseMoney(goalDailyG.value)), monthly: round2(parseMoney(goalMonthlyG.value)) },
  };
  saveSettings();
  renderGoals();
  renderTodaySummary();
  toast(saveMsg, "Objetivos guardados ✅", true);
}

function renderGoals(){
  const dateISO = dateInput.value;
  const todayTotals = computeDayTotals(dateISO).global.total;

  const monthKey = dateISO.slice(0,7);
  const monthRows = buildReport("daily", "global", monthKey + "-01", monthKey + "-31");
  const monthTotal = monthRows.reduce((a,r)=>a + r.total, 0);

  const gd = Number(settings.goals?.global?.daily || 0);
  if (gd > 0){
    const pct = Math.max(0, Math.min(100, (todayTotals / gd) * 100));
    goalTodayPct.textContent = pct.toFixed(1) + "%";
    goalTodayTxt.textContent = `${formatMoney(todayTotals)} / ${formatMoney(gd)}`;
  } else {
    goalTodayPct.textContent = "—";
    goalTodayTxt.textContent = "Define objetivo diario global";
  }

  const gm = Number(settings.goals?.global?.monthly || 0);
  if (gm > 0){
    const pct = Math.max(0, Math.min(100, (monthTotal / gm) * 100));
    goalMonthPct.textContent = pct.toFixed(1) + "%";
    goalMonthTxt.textContent = `${formatMoney(monthTotal)} / ${formatMoney(gm)}`;
  } else {
    goalMonthPct.textContent = "—";
    goalMonthTxt.textContent = "Define objetivo mensual global";
  }
}

/* ---------- Últimos 7 días ---------- */
function refresh7Days(){
  const base = dateInput.value || toISODate(new Date());
  const days = [];
  for (let i=0;i<7;i++){
    days.push(addDaysISO(base, -i));
  }

  const rows = [];
  for (const d of days){
    for (const s of STORES){
      const e = getEntry(d, s.id);
      if (!e) continue;
      const total = round2((e.cash||0) + (e.card||0));
      const diffT = diffValue(e.ticket||0, total);
      const expected = calcExpectedCash(e);
      const diffC = calcCashDiff(e);
      rows.push({
        date:d, store:s.id, storeName:s.name,
        cash:e.cash||0, card:e.card||0, total,
        ticket:e.ticket||0, diffT,
        expected, counted:e.cashCounted||0, diffC
      });
    }
  }

  // ordenar por fecha desc
  rows.sort((a,b)=> (a.date < b.date ? 1 : -1));

  table7Body.innerHTML = "";
  for (const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.date)}</td>
      <td>${escapeHtml(r.storeName)}</td>
      <td>${formatMoney(r.cash)}</td>
      <td>${formatMoney(r.card)}</td>
      <td><b>${formatMoney(r.total)}</b></td>
      <td>${formatMoney(r.ticket)}</td>
      <td>${formatDiff(r.diffT)}</td>
      <td>${formatMoney(r.expected)}</td>
      <td>${formatMoney(r.counted)}</td>
      <td>${formatDiff(r.diffC)}</td>
      <td>
        <button class="btn-mini danger" data-del="1" data-date="${r.date}" data-store="${r.store}">Borrar</button>
      </td>
    `;
    tr.addEventListener("click", (ev) => {
      if (ev.target?.dataset?.del) return;
      dateInput.value = r.date;
      storeInput.value = r.store;
      fillEntryIfExists();
      renderTodaySummary();
      renderDayHistory();
      renderGoals();
    });
    tr.querySelector("button")?.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const d = ev.target.dataset.date;
      const s = ev.target.dataset.store;
      deleteEntry(d, s);
      refresh7Days();
      if (dateInput.value === d) {
        fillEntryIfExists();
        renderTodaySummary();
        renderDayHistory();
      }
      refreshReports();
    });
    table7Body.appendChild(tr);
  }

  hint7.textContent = rows.length ? `Mostrando ${rows.length} registros en los últimos 7 días.` : "Sin registros en los últimos 7 días.";
}

/* ---------- WhatsApp (Día + Semana) ---------- */
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
    `🧾 Total: ${formatMoney(sp.total)} · Ticket: ${formatMoney(sp.ticket)} · DifT: ${formatDiff(sp.diffT)}`,
    `💶 Efe: ${formatMoney(sp.cash)} · 💳 Tar: ${formatMoney(sp.card)}`,
    `📦 Caja: Esperado ${formatMoney(sp.expected)} · Contado ${formatMoney(sp.counted)} · DifCaja ${formatDiff(sp.diffC)}`,
    ``,
    `🏪 *San Lesmes*`,
    `🧾 Total: ${formatMoney(sl.total)} · Ticket: ${formatMoney(sl.ticket)} · DifT: ${formatDiff(sl.diffT)}`,
    `💶 Efe: ${formatMoney(sl.cash)} · 💳 Tar: ${formatMoney(sl.card)}`,
    `📦 Caja: Esperado ${formatMoney(sl.expected)} · Contado ${formatMoney(sl.counted)} · DifCaja ${formatDiff(sl.diffC)}`,
    ``,
    `🏪 *Santiago*`,
    `🧾 Total: ${formatMoney(sa.total)} · Ticket: ${formatMoney(sa.ticket)} · DifT: ${formatDiff(sa.diffT)}`,
    `💶 Efe: ${formatMoney(sa.cash)} · 💳 Tar: ${formatMoney(sa.card)}`,
    `📦 Caja: Esperado ${formatMoney(sa.expected)} · Contado ${formatMoney(sa.counted)} · DifCaja ${formatDiff(sa.diffC)}`,
    ``,
    `🌍 *GLOBAL*`,
    `🧾 Total: ${formatMoney(g.total)} · Ticket: ${formatMoney(g.ticket)} · DifT: ${formatDiff(g.diffT)}`,
    `💶 Efe: ${formatMoney(g.cash)} · 💳 Tar: ${formatMoney(g.card)}`,
    `📦 Caja: Esperado ${formatMoney(g.expected)} · Contado ${formatMoney(g.counted)} · DifCaja ${formatDiff(g.diffC)}`
  ].join("\n");
}

function buildWhatsAppWeekText(anyDateISO){
  const { mondayISO, sundayISO } = weekRange(anyDateISO);

  // arma resumen por tienda sumando días de lunes a domingo
  const perStore = {};
  for (const s of STORES){
    perStore[s.id] = { cash:0, card:0, total:0, ticket:0, diffT:0 };
  }
  const g = { cash:0, card:0, total:0, ticket:0, diffT:0 };

  const all = Object.values(state.entries || []);
  for (const e of all){
    if (e.date < mondayISO || e.date > sundayISO) continue;
    const s = e.store;
    const cash = Number(e.cash||0);
    const card = Number(e.card||0);
    const total = cash + card;
    const ticket = Number(e.ticket||0);

    perStore[s].cash += cash;
    perStore[s].card += card;
    perStore[s].total += total;
    perStore[s].ticket += ticket;

    g.cash += cash;
    g.card += card;
    g.total += total;
    g.ticket += ticket;
  }

  // difT semanal = ticket - total
  for (const s of STORES){
    perStore[s.id].diffT = diffValue(perStore[s.id].ticket, perStore[s.id].total);
  }
  g.diffT = diffValue(g.ticket, g.total);

  return [
    `📅 *RESUMEN SEMANAL*`,
    `🗓️ ${mondayISO} → ${sundayISO}`,
    ``,
    `🏪 *San Pablo* — Total ${formatMoney(perStore.san_pablo.total)} · Ticket ${formatMoney(perStore.san_pablo.ticket)} · DifT ${formatDiff(perStore.san_pablo.diffT)}`,
    `🏪 *San Lesmes* — Total ${formatMoney(perStore.san_lesmes.total)} · Ticket ${formatMoney(perStore.san_lesmes.ticket)} · DifT ${formatDiff(perStore.san_lesmes.diffT)}`,
    `🏪 *Santiago* — Total ${formatMoney(perStore.santiago.total)} · Ticket ${formatMoney(perStore.santiago.ticket)} · DifT ${formatDiff(perStore.santiago.diffT)}`,
    ``,
    `🌍 *GLOBAL* — Total ${formatMoney(g.total)} · Ticket ${formatMoney(g.ticket)} · DifT ${formatDiff(g.diffT)}`,
    `💶 Efe ${formatMoney(g.cash)} · 💳 Tar ${formatMoney(g.card)}`
  ].join("\n");
}

function weekRange(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const day = d.getDay(); // 0 dom, 1 lun ...
  const diffToMonday = (day === 0) ? -6 : (1 - day);
  const monday = new Date(d);
  monday.setDate(monday.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  return { mondayISO: toISODate(monday), sundayISO: toISODate(sunday) };
}

function openWhatsApp(text){
  const url = "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

/* ---------- Reports (incluye ticket y difT) ---------- */
function refreshReports(){
  const type = reportType.value;
  const store = reportStore.value;
  const from = rangeFrom.value || null;
  const to = rangeTo.value || null;

  const rows = buildReport(type, store, from, to);

  const sum = rows.reduce((acc,r)=>({
    cash: acc.cash + r.cash,
    card: acc.card + r.card,
    total: acc.total + r.total,
    ticket: acc.ticket + r.ticket,
  }), {cash:0, card:0, total:0, ticket:0});

  const diffT = diffValue(sum.ticket, sum.total);
  const daysCount = estimateDaysCovered(rows, type);
  const avg = (daysCount > 0) ? (sum.total / daysCount) : 0;

  kpiCash.textContent = formatMoney(sum.cash);
  kpiCard.textContent = formatMoney(sum.card);
  kpiTotal.textContent = formatMoney(sum.total);
  kpiTicket.textContent = formatMoney(sum.ticket);
  kpiDiff.textContent = formatDiff(diffT);
  kpiAvg.textContent = formatMoney(avg);

  reportTableBody.innerHTML = "";
  for (const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.periodLabel)}</td>
      <td>${formatMoney(r.cash)}</td>
      <td>${formatMoney(r.card)}</td>
      <td><b>${formatMoney(r.total)}</b></td>
      <td>${formatMoney(r.ticket)}</td>
      <td>${formatDiff(r.diffT)}</td>
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
    const ticket = Number(e.ticket || 0);

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
      cash:0, card:0, total:0, ticket:0,
      sortKey: periodSortKey(type, date)
    };

    prev.cash += cash;
    prev.card += card;
    prev.total += (cash + card);
    prev.ticket += ticket;
    prev.sortKey = Math.min(prev.sortKey, periodSortKey(type, date));

    map.set(period, prev);
  }

  const rows = Array.from(map.values());
  rows.sort((a,b)=> a.sortKey - b.sortKey);

  return rows.map(r => {
    const diffT = diffValue(r.ticket, r.total);
    return {
      period: r.period,
      periodLabel: r.periodLabel,
      cash: round2(r.cash),
      card: round2(r.card),
      total: round2(r.total),
      ticket: round2(r.ticket),
      diffT: diffT,
      sortKey: r.sortKey
    };
  });
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

/* Labels */
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

/* ---------- WhatsApp report ---------- */
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
    total: acc.total + r.total,
    ticket: acc.ticket + r.ticket,
  }), {cash:0, card:0, total:0, ticket:0});

  const diffT = diffValue(sum.ticket, sum.total);

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
  lines.push(`🧾 Ticket: ${formatMoney(sum.ticket)} · DifT: ${formatDiff(diffT)}`);
  lines.push(``);
  lines.push(`🗂️ *${full ? "Reporte completo" : "Últimos " + list.length + " periodos"}*:`);

  for (const r of list){
    lines.push(`• ${r.periodLabel} — Total ${formatMoney(r.total)} · Ticket ${formatMoney(r.ticket)} · DifT ${formatDiff(r.diffT)}`);
  }

  lines.push(``);
  lines.push(`📌 Periodos: ${first} → ${last}`);

  openWhatsApp(lines.join("\n"));
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

  const header = ["Periodo","Efectivo","Tarjeta","Total","Ticket","DifTicket"];
  const lines = [header.join(";")];

  for (const r of rows){
    lines.push([
      `"${r.periodLabel.replaceAll('"','""')}"`,
      r.cash.toFixed(2).replace(".", ","),
      r.card.toFixed(2).replace(".", ","),
      r.total.toFixed(2).replace(".", ","),
      r.ticket.toFixed(2).replace(".", ","),
      r.diffT.toFixed(2).replace(".", ",")
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
    meta: { app: "ARSLAN_FACTURACION_PACKC_V1", exportedAt: new Date().toISOString() },
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
        const keepPinHash = settings.pinHash || DEFAULT_PIN_HASH;
        settings = { ...settings, ...payload.settings, isLogged:false, theme:keepTheme, pinHash: keepPinHash };
        saveSettings();
      }

      initDefaults();
      fillEntryIfExists();
      renderTodaySummary();
      renderDayHistory();
      renderGoals();
      refresh7Days();
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
