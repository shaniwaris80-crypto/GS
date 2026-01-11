/* =========================
   ARSLAN — Facturación Cloud (Email/Password)
   - Multi-dispositivo real
   - PULL + MERGE primero (no borra nube si local vacío)
   - Diferencia ticket: (Efe + Tar) - Ticket  => negativo = falta
   - Semáforo: |dif|<=10 verde, <=20 amarillo, >20 rojo + advertencia
========================= */

const STORES = [
  { id: "san_pablo", name: "San Pablo" },
  { id: "san_lesmes", name: "San Lesmes" },
  { id: "santiago", name: "Santiago" },
];

const LOCAL_KEY_PREFIX = "ARSLAN_FACT_CLOUD_V1__"; // + uid
const LOCAL_SETTINGS_PREFIX = "ARSLAN_FACT_CLOUD_SETTINGS_V1__"; // + uid

const WA_PHONE = "34631667893"; // tu número WhatsApp (como antes)

/* ---------- DOM ---------- */
const $ = (id) => document.getElementById(id);

const authView = $("authView");
const appView = $("appView");

const emailInput = $("emailInput");
const passInput = $("passInput");
const btnSignIn = $("btnSignIn");
const btnResetPass = $("btnResetPass");
const btnThemeAuth = $("btnThemeAuth");
const authMsg = $("authMsg");

const cloudStatus = $("cloudStatus");
const cloudStatusTop = $("cloudStatusTop");

const tabs = $("tabs");
const tabButtons = tabs ? Array.from(tabs.querySelectorAll(".tab")) : [];
const tabSections = Array.from(document.querySelectorAll(".tab-section"));

const dateInput = $("dateInput");
const btnToday = $("btnToday");
const btnYesterday = $("btnYesterday");

const storeInput = $("storeInput");
const storeQuick = $("storeQuick");

const cashInput = $("cashInput");
const cardInput = $("cardInput");
const ticketInput = $("ticketInput");
const expensesInput = $("expensesInput");
const cashCountedInput = $("cashCountedInput");
const notesInput = $("notesInput");

const totalBox = $("totalBox");
const diffBox = $("diffBox");
const diffWarn = $("diffWarn");
const cashDiffBox = $("cashDiffBox");
const cashWarn = $("cashWarn");

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

/* Reports */
const reportType = $("reportType");
const reportStore = $("reportStore");
const rangeFrom = $("rangeFrom");
const rangeTo = $("rangeTo");
const btnRefresh = $("btnRefresh");

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

/* Menu */
const btnMenu = $("btnMenu");
const menuOverlay = $("menuOverlay");
const btnCloseMenu = $("btnCloseMenu");
const btnTheme = $("btnTheme");
const btnExportJSON = $("btnExportJSON");
const importFile = $("importFile");
const btnExportCSV = $("btnExportCSV");
const btnWhatsAppReport = $("btnWhatsAppReport");
const btnWhatsAppReportFull = $("btnWhatsAppReportFull");
const btnSignOut = $("btnSignOut");

/* Confirm */
const confirmOverlay = $("confirmOverlay");
const confirmTitle = $("confirmTitle");
const confirmText = $("confirmText");
const btnConfirmClose = $("btnConfirmClose");
const btnConfirmCancel = $("btnConfirmCancel");
const btnConfirmOk = $("btnConfirmOk");

/* Charts */
let chartTotal = null;
let chartMix = null;
let chartTicket = null;

/* ---------- State ---------- */
let UID = null;
let state = { entries: {} };
let settings = {
  theme: "light",
  goals: null
};

let cloud = {
  ready: false,
  stateRef: null,
  settingsRef: null,
  unsubState: null,
  unsubSettings: null,
  pushing: false,
  lastRemoteHash: null
};

/* ============== Helpers ============== */
function toISODate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function addDaysISO(dateISO, days){
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
function parseMoney(str){
  if (!str) return 0;
  const clean = String(str).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}
function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
function fmtInput(n){
  const v = Number(n||0);
  return v ? String(v).replace(".", ",") : "";
}
function formatMoney(n){
  const v = Number(n || 0);
  return v.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
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
function normalizeMoneyInput(el){ el.value = String(el.value || "").replace(/[^\d,.-]/g,""); }

function keyOf(dateISO, storeId){ return `${dateISO}__${storeId}`; }
function getEntry(dateISO, storeId){ return state.entries[keyOf(dateISO, storeId)] || null; }

function calcTotal(e){ return round2(Number(e?.cash||0) + Number(e?.card||0)); }
// ✅ DIF TICKET (correcto): total - ticket  => negativo = falta
function calcTicketDiff(e){ return round2(calcTotal(e) - Number(e?.ticket||0)); }
// Caja simplificada: esperado = efectivo - gastos
function calcExpectedCash(e){ return round2(Number(e?.cash||0) - Number(e?.expenses||0)); }
function calcCashDiff(e){
  const counted = Number(e?.cashCounted||0);
  return round2(counted - calcExpectedCash(e));
}

function diffHuman(d){
  const v = round2(Number(d||0));
  const abs = Math.abs(v).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
  if (Math.abs(v) <= 0.01) return "✅ CUADRA";
  if (v < 0) return `❌ FALTAN ${abs} €`;
  return `⚠️ SOBRAN ${abs} €`;
}

function diffLevel(d){
  const v = Math.abs(Number(d||0));
  if (v <= 10) return "ok";
  if (v <= 20) return "warn";
  return "bad";
}

function setBoxSemaforo(boxEl, warnEl, diff, contextLabel){
  boxEl.classList.remove("ok","warn","bad");
  warnEl.classList.remove("ok","warn","bad");

  if (boxEl.classList.contains("readonly") === false) boxEl.classList.add("readonly");

  const level = diffLevel(diff);
  boxEl.classList.add(level);
  warnEl.classList.add(level);

  if (level === "ok"){
    warnEl.textContent = "";
  } else if (level === "warn"){
    warnEl.textContent = `⚠️ Aviso: ${contextLabel} ${diffHuman(diff)}`;
  } else {
    warnEl.textContent = `🚨 ALERTA: ${contextLabel} ${diffHuman(diff)} (más de 20€)`;
  }
}

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

/* ============== Theme ============== */
function applyTheme(theme){
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}
function toggleTheme(){
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = (current === "dark") ? "light" : "dark";
  settings.theme = next;
  applyTheme(next);
  saveSettings();
  refreshReports();
}

/* ============== Tabs ============== */
function activateTab(id){
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  tabSections.forEach(s => s.classList.toggle("active", s.id === id));
  try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
}

/* ============== Local storage ============== */
function stateKey(){ return LOCAL_KEY_PREFIX + (UID || "NOUID"); }
function settingsKey(){ return LOCAL_SETTINGS_PREFIX + (UID || "NOUID"); }

function loadState(){
  try{
    const raw = localStorage.getItem(stateKey());
    if (!raw) return { entries:{} };
    const parsed = JSON.parse(raw);
    if (!parsed.entries) parsed.entries = {};
    return parsed;
  }catch{
    return { entries:{} };
  }
}
function saveState(){
  localStorage.setItem(stateKey(), JSON.stringify(state));
}
function loadSettings(){
  try{
    const raw = localStorage.getItem(settingsKey());
    if (!raw) return { theme:"light", goals:null };
    const parsed = JSON.parse(raw);
    if (!parsed.theme) parsed.theme = "light";
    return parsed;
  }catch{
    return { theme:"light", goals:null };
  }
}
function saveSettings(){
  localStorage.setItem(settingsKey(), JSON.stringify(settings));
}

/* ============== Cloud badge ============== */
function setCloudBadge(type, text){
  [cloudStatus, cloudStatusTop].forEach(el=>{
    if(!el) return;
    el.classList.remove("ok","warn","bad");
    if(type) el.classList.add(type);
    el.textContent = text;
  });
}

/* ============== Firebase Auth ============== */
function getFirebase(){
  if (!window.__firebase || !window.__firebase.auth || !window.__firebase.db) return null;
  return window.__firebase;
}

async function signInEmailPassword(email, pass){
  const fb = getFirebase();
  if(!fb) throw new Error("Firebase no configurado.");
  return fb.auth.signInWithEmailAndPassword(email, pass);
}

async function resetPassword(email){
  const fb = getFirebase();
  if(!fb) throw new Error("Firebase no configurado.");
  return fb.auth.sendPasswordResetEmail(email);
}

async function signOut(){
  const fb = getFirebase();
  if(!fb) return;
  await fb.auth.signOut();
}

/* ============== Cloud Sync (PULL + MERGE safe) ============== */
function hashObj(obj){
  try{
    return JSON.stringify(obj);
  }catch{
    return String(Date.now());
  }
}

function mergeEntries(localEntries, remoteEntries){
  const out = { ...(localEntries || {}) };
  const r = remoteEntries || {};

  let changed = false;
  for (const [k, v] of Object.entries(r)){
    const lv = out[k];
    const rt = Date.parse(v?.updatedAt || 0) || 0;
    const lt = Date.parse(lv?.updatedAt || 0) || 0;
    if (!lv || rt > lt){
      out[k] = v;
      changed = true;
    }
  }
  return { merged: out, changed };
}

async function cloudInitAfterAuth(user){
  const fb = getFirebase();
  if(!fb) return;

  UID = user.uid;

  // cargar local por uid
  state = loadState();
  settings = loadSettings();
  applyTheme(settings.theme || "light");

  // defaults
  ensureDefaults();

  cloud.stateRef = fb.db.ref("arslan_facturacion/" + UID + "/state");
  cloud.settingsRef = fb.db.ref("arslan_facturacion/" + UID + "/settings");

  setCloudBadge("warn","☁️ Nube: sincronizando…");

  // 1) PULL inicial
  let remoteState = null;
  let remoteSettings = null;

  try{
    const [s1, s2] = await Promise.all([ cloud.stateRef.get(), cloud.settingsRef.get() ]);
    remoteState = s1.exists() ? s1.val() : null;
    remoteSettings = s2.exists() ? s2.val() : null;
  }catch(e){
    setCloudBadge("warn","☁️ Nube: offline (local)");
    cloud.ready = false;
    showApp();
    renderAll();
    return;
  }

  // settings: solo goals + metadatos (theme es local)
  if (remoteSettings?.goals){
    settings.goals = remoteSettings.goals;
    saveSettings();
  }

  const localCount = Object.keys(state.entries || {}).length;
  const remoteCount = Object.keys(remoteState?.entries || {}).length;

  // ✅ regla anti-borrado:
  // - Si local vacío y nube tiene datos => bajar nube y NO subir vacío
  // - Si nube vacía y local tiene datos => subir local
  // - Si ambos tienen => merge y subir merge
  if (remoteCount > 0 && localCount === 0){
    state.entries = remoteState.entries || {};
    saveState();
  } else if (remoteCount === 0 && localCount > 0){
    // subimos local a nube
    await cloudPushAll();
  } else if (remoteCount > 0 && localCount > 0){
    const m = mergeEntries(state.entries, remoteState.entries);
    state.entries = m.merged;
    saveState();
    await cloudPushAll(); // asegura que el merge queda en nube
  } else {
    // ambos vacíos => nada
  }

  cloud.ready = true;
  setCloudBadge("ok","☁️ Nube: online");

  // 2) LISTENER realtime: merge seguro (nunca pisa local si local es más nuevo)
  cloud.stateRef.on("value", (snap)=>{
    const remote = snap.val();
    if(!remote?.entries) return;

    const remoteHash = hashObj(remote.entries);
    if (cloud.lastRemoteHash === remoteHash) return; // evita loops
    cloud.lastRemoteHash = remoteHash;

    const m = mergeEntries(state.entries, remote.entries);
    if (m.changed){
      state.entries = m.merged;
      saveState();
      renderAll();
    }
  }, (err)=>{
    console.error(err);
    setCloudBadge("warn","☁️ Nube: offline (local)");
  });

  cloud.settingsRef.on("value", (snap)=>{
    const remote = snap.val();
    if(!remote?.goals) return;
    settings.goals = remote.goals;
    saveSettings();
    renderGoals();
    renderTodaySummary();
    refreshReports();
  });

  showApp();
  renderAll();
}

async function cloudPushAll(){
  const fb = getFirebase();
  if(!fb || !cloud.stateRef || !cloud.settingsRef || !UID) return;
  if (cloud.pushing) return;

  try{
    cloud.pushing = true;
    setCloudBadge("warn","☁️ Nube: subiendo…");

    const payloadState = {
      entries: state.entries || {},
      updatedAt: new Date().toISOString(),
      serverAt: fb.serverTimestamp
    };
    const payloadSettings = {
      goals: settings.goals || null,
      updatedAt: new Date().toISOString(),
      serverAt: fb.serverTimestamp
    };

    await Promise.all([
      cloud.stateRef.set(payloadState),
      cloud.settingsRef.set(payloadSettings)
    ]);

    setCloudBadge("ok","☁️ Nube: online");
  }catch(e){
    console.error("push error", e);
    setCloudBadge("warn","☁️ Nube: offline (local)");
  }finally{
    cloud.pushing = false;
  }
}

let pushTimer = null;
function cloudPushDebounced(){
  if (!cloud.ready) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(()=> cloudPushAll(), 600);
}

/* ============== Defaults + UI ============== */
function ensureDefaults(){
  const today = toISODate(new Date());

  if (!settings.goals){
    settings.goals = {
      san_pablo:{daily:0, monthly:0},
      san_lesmes:{daily:0, monthly:0},
      santiago:{daily:0, monthly:0},
      global:{daily:0, monthly:0},
    };
    saveSettings();
  }

  if (!dateInput.value) dateInput.value = today;
  if (!rangeTo.value) rangeTo.value = today;
  if (!rangeFrom.value) rangeFrom.value = today.slice(0,7) + "-01";

  // goals inputs
  goalDailySP.value = fmtInput(settings.goals.san_pablo.daily);
  goalMonthlySP.value = fmtInput(settings.goals.san_pablo.monthly);
  goalDailySL.value = fmtInput(settings.goals.san_lesmes.daily);
  goalMonthlySL.value = fmtInput(settings.goals.san_lesmes.monthly);
  goalDailySA.value = fmtInput(settings.goals.santiago.daily);
  goalMonthlySA.value = fmtInput(settings.goals.santiago.monthly);
  goalDailyG.value = fmtInput(settings.goals.global.daily);
  goalMonthlyG.value = fmtInput(settings.goals.global.monthly);

  highlightStoreQuick(storeInput.value || "san_pablo");
}

function highlightStoreQuick(storeId){
  document.querySelectorAll(".storebtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.store === storeId);
  });
}

function showApp(){
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
}

function showAuth(){
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
}

/* ============== Entry ops ============== */
function setEntry(dateISO, storeId, payload){
  state.entries[keyOf(dateISO, storeId)] = {
    date: dateISO,
    store: storeId,
    cash: payload.cash || 0,
    card: payload.card || 0,
    ticket: payload.ticket || 0,
    expenses: payload.expenses || 0,
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

function fillEntryIfExists(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;
  const e = getEntry(dateISO, storeId);

  if (e){
    cashInput.value = fmtInput(e.cash);
    cardInput.value = fmtInput(e.card);
    ticketInput.value = fmtInput(e.ticket);
    expensesInput.value = fmtInput(e.expenses);
    cashCountedInput.value = fmtInput(e.cashCounted);
    notesInput.value = e.notes || "";
  } else {
    cashInput.value = "";
    cardInput.value = "";
    ticketInput.value = "";
    expensesInput.value = "";
    cashCountedInput.value = "";
    notesInput.value = "";
  }
  updateBoxes();
  saveMsg.textContent = "";
  saveMsg.className = "msg";
}

function updateBoxes(){
  const cash = round2(parseMoney(cashInput.value));
  const card = round2(parseMoney(cardInput.value));
  const ticket = round2(parseMoney(ticketInput.value));
  const expenses = round2(parseMoney(expensesInput.value));
  const counted = round2(parseMoney(cashCountedInput.value));

  const total = round2(cash + card);
  totalBox.textContent = formatMoney(total);

  const dt = round2(total - ticket); // ✅ correcto
  diffBox.textContent = (!cashInput.value && !cardInput.value && !ticketInput.value)
    ? "—"
    : `${dt.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})} € · ${diffHuman(dt)}`;

  setBoxSemaforo(diffBox, diffWarn, dt, "Ticket:");

  // Caja: esperado = efectivo - gastos
  const expected = round2(cash - expenses);
  const cd = round2(counted - expected);

  cashDiffBox.textContent = (!cashCountedInput.value && !cashInput.value && !expensesInput.value)
    ? "—"
    : `${cd.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})} € · ${diffHuman(cd)}`;

  setBoxSemaforo(cashDiffBox, cashWarn, cd, "Caja:");

  // Si no hay contado, deja warning vacío
  if (!cashCountedInput.value){
    cashWarn.textContent = "";
    cashWarn.classList.remove("ok","warn","bad");
    cashDiffBox.classList.remove("ok","warn","bad");
  }
}

function clearEntry(){
  cashInput.value = "";
  cardInput.value = "";
  ticketInput.value = "";
  expensesInput.value = "";
  cashCountedInput.value = "";
  notesInput.value = "";
  updateBoxes();
  toast(saveMsg, "", true);
}

function computeDayTotals(dateISO){
  const byStore = {};
  let gCash=0, gCard=0, gTicket=0;

  for (const s of STORES){
    const e = getEntry(dateISO, s.id) || null;
    const cash = e?.cash || 0;
    const card = e?.card || 0;
    const ticket = e?.ticket || 0;

    const total = round2(cash + card);
    const diffT = round2(total - ticket); // ✅

    byStore[s.id] = { cash, card, ticket, total, diffT };
    gCash += cash; gCard += card; gTicket += ticket;
  }

  const gTotal = round2(gCash + gCard);
  const gDiffT = round2(gTotal - gTicket);

  return {
    byStore,
    global: { cash:gCash, card:gCard, ticket:gTicket, total:gTotal, diffT:gDiffT }
  };
}

/* ============== Summary + Goals ============== */
function tagEl(title, value){
  const d = document.createElement("div");
  d.className = "tag";
  d.textContent = `${title} · ${value}`;
  return d;
}

function renderSemaforoRow(el, value, goal){
  el.innerHTML = "";
  const g = Number(goal || 0);
  if (!g){
    el.appendChild(tagEl("Define objetivo", "—"));
    return;
  }
  const pct = (value / g) * 100;
  if (pct >= 100) el.appendChild(tagEl("✅ OK", `${pct.toFixed(0)}%`));
  else if (pct >= 85) el.appendChild(tagEl("⚠️ Medio", `${pct.toFixed(0)}%`));
  else el.appendChild(tagEl("❌ Bajo", `${pct.toFixed(0)}%`));
}

function renderTodaySummary(){
  const dateISO = dateInput.value;
  const totals = computeDayTotals(dateISO);

  const sp = totals.byStore.san_pablo;
  const sl = totals.byStore.san_lesmes;
  const sa = totals.byStore.santiago;
  const g  = totals.global;

  sumSP.textContent = formatMoney(sp.total);
  sumSP2.textContent = `Efe: ${formatMoney(sp.cash)} · Tar: ${formatMoney(sp.card)} · Ticket: ${formatMoney(sp.ticket)} · Dif: ${sp.diffT.toFixed(2)}€`;

  sumSL.textContent = formatMoney(sl.total);
  sumSL2.textContent = `Efe: ${formatMoney(sl.cash)} · Tar: ${formatMoney(sl.card)} · Ticket: ${formatMoney(sl.ticket)} · Dif: ${sl.diffT.toFixed(2)}€`;

  sumSA.textContent = formatMoney(sa.total);
  sumSA2.textContent = `Efe: ${formatMoney(sa.cash)} · Tar: ${formatMoney(sa.card)} · Ticket: ${formatMoney(sa.ticket)} · Dif: ${sa.diffT.toFixed(2)}€`;

  sumGlobal.textContent = formatMoney(g.total);
  sumGlobal2.textContent = `Efectivo: ${formatMoney(g.cash)} · Tarjeta: ${formatMoney(g.card)} · Ticket: ${formatMoney(g.ticket)} · Dif: ${g.diffT.toFixed(2)}€`;

  renderSemaforoRow(semSP, sp.total, settings.goals.san_pablo.daily);
  renderSemaforoRow(semSL, sl.total, settings.goals.san_lesmes.daily);
  renderSemaforoRow(semSA, sa.total, settings.goals.santiago.daily);
  renderSemaforoRow(semGlobal, g.total, settings.goals.global.daily);
}

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
  cloudPushDebounced();
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

/* ============== Day history + WhatsApp ============== */
function renderDayHistory(){
  const dateISO = dateInput.value;
  dayList.innerHTML = "";

  const items = STORES.map(s => {
    const e = getEntry(dateISO, s.id);
    const cash = e?.cash || 0;
    const card = e?.card || 0;
    const ticket = e?.ticket || 0;
    const total = round2(cash + card);
    const diffT = round2(total - ticket);
    return { store:s.id, name:s.name, total, ticket, diffT, exists: !!e };
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
          Total ${formatMoney(it.total)} · Ticket ${formatMoney(it.ticket)} · Dif ${it.diffT.toFixed(2)}€
          (${diffHuman(it.diffT)})
        </div>
      </div>
      <div class="v">${formatMoney(it.total)}</div>
    `;
    div.addEventListener("click", () => {
      storeInput.value = it.store;
      highlightStoreQuick(it.store);
      fillEntryIfExists();
      cashInput.focus();
    });
    dayList.appendChild(div);
  }
}

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
    `Total: ${formatMoney(sp.total)} · Ticket: ${formatMoney(sp.ticket)} · Dif: ${sp.diffT.toFixed(2)}€ (${diffHuman(sp.diffT)})`,
    `Efe: ${formatMoney(sp.cash)} · Tar: ${formatMoney(sp.card)}`,
    ``,
    `🏪 *San Lesmes*`,
    `Total: ${formatMoney(sl.total)} · Ticket: ${formatMoney(sl.ticket)} · Dif: ${sl.diffT.toFixed(2)}€ (${diffHuman(sl.diffT)})`,
    `Efe: ${formatMoney(sl.cash)} · Tar: ${formatMoney(sl.card)}`,
    ``,
    `🏪 *Santiago*`,
    `Total: ${formatMoney(sa.total)} · Ticket: ${formatMoney(sa.ticket)} · Dif: ${sa.diffT.toFixed(2)}€ (${diffHuman(sa.diffT)})`,
    `Efe: ${formatMoney(sa.cash)} · Tar: ${formatMoney(sa.card)}`,
    ``,
    `🌍 *GLOBAL*`,
    `Total: ${formatMoney(g.total)} · Ticket: ${formatMoney(g.ticket)} · Dif: ${g.diffT.toFixed(2)}€ (${diffHuman(g.diffT)})`,
    `Efe: ${formatMoney(g.cash)} · Tar: ${formatMoney(g.card)}`
  ].join("\n");
}

function openWhatsApp(text){
  const url = "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

/* ============== Reports ============== */
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

function buildReport(type, store, from=null, to=null){
  const all = Object.values(state.entries || {});
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

  return rows.map(r => ({
    period: r.period,
    periodLabel: r.periodLabel,
    cash: round2(r.cash),
    card: round2(r.card),
    total: round2(r.total),
    ticket: round2(r.ticket),
    diffT: round2(r.total - r.ticket), // ✅
    sortKey: r.sortKey
  }));
}

function baseChartOptions(){
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const labelColor = isDark ? "#eaf0ff" : "#101828";
  const gridColor = isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";
  return {
    responsive: true,
    plugins: { legend: { labels: { color: labelColor } } },
    scales: {
      x: { ticks: { color: labelColor }, grid: { color: gridColor } },
      y: { ticks: { color: labelColor }, grid: { color: gridColor } },
    }
  };
}

function movingAverage(arr, w){
  const out = [];
  for (let i=0;i<arr.length;i++){
    const start = Math.max(0, i - (w - 1));
    const slice = arr.slice(start, i+1);
    const avg = slice.reduce((a,b)=>a+b,0) / slice.length;
    out.push(round2(avg));
  }
  return out;
}

function renderCharts(rows){
  const labels = rows.map(r => r.periodLabel);
  const totals = rows.map(r => r.total);
  const cash = rows.map(r => r.cash);
  const card = rows.map(r => r.card);
  const tickets = rows.map(r => r.ticket);
  const ma = movingAverage(totals, 3);

  if (chartTotal) chartTotal.destroy();
  chartTotal = new Chart($("chartTotal"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Total", data: totals, tension: 0.25, borderWidth: 2, pointRadius: 2 },
        { label: "Media (3)", data: ma, tension: 0.25, borderWidth: 2, pointRadius: 0 }
      ]
    },
    options: baseChartOptions()
  });

  if (chartMix) chartMix.destroy();
  chartMix = new Chart($("chartMix"), {
    type: "bar",
    data: { labels, datasets: [{ label: "Efectivo", data: cash }, { label: "Tarjeta", data: card }] },
    options: baseChartOptions()
  });

  if (chartTicket) chartTicket.destroy();
  chartTicket = new Chart($("chartTicket"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Total", data: totals, tension: 0.25, borderWidth: 2, pointRadius: 2 },
        { label: "Ticket", data: tickets, tension: 0.25, borderWidth: 2, pointRadius: 2 }
      ]
    },
    options: baseChartOptions()
  });
}

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

  const diffT = round2(sum.total - sum.ticket);
  const daysCount = estimateDaysCovered(rows, type);
  const avg = (daysCount > 0) ? (sum.total / daysCount) : 0;

  kpiCash.textContent = formatMoney(sum.cash);
  kpiCard.textContent = formatMoney(sum.card);
  kpiTotal.textContent = formatMoney(sum.total);
  kpiTicket.textContent = formatMoney(sum.ticket);
  kpiDiff.textContent = `${diffT.toFixed(2)}€ (${diffHuman(diffT)})`;
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
      <td>${r.diffT.toFixed(2)}€</td>
    `;
    reportTableBody.appendChild(tr);
  }

  tableHint.textContent = rows.length
    ? `Mostrando ${rows.length} periodos. Rango: ${from || "—"} → ${to || "—"}`
    : "No hay datos en ese rango.";

  renderCharts(rows);
  renderRanking(from, to);
}

/* ============== Export/Import/CSV/WhatsApp report ============== */
function exportJSON(){
  const payload = {
    meta: { app: "ARSLAN_FACT_CLOUD_V1", uid: UID, exportedAt: new Date().toISOString() },
    state,
    settings: { goals: settings.goals }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_arslan_fact_${toISODate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(){
  const file = importFile.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const payload = JSON.parse(reader.result);
      if (!payload?.state?.entries) throw new Error("Formato no válido.");

      // merge, no reemplazo ciego
      const m = mergeEntries(state.entries, payload.state.entries);
      state.entries = m.merged;
      saveState();

      if (payload.settings?.goals){
        settings.goals = payload.settings.goals;
        saveSettings();
      }

      ensureDefaults();
      renderAll();

      alert("Importado y fusionado ✅");
      cloudPushDebounced();
    }catch(err){
      alert("Error importando: " + err.message);
    }finally{
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

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

  const diffT = round2(sum.total - sum.ticket);

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
  lines.push(`🧾 Ticket: ${formatMoney(sum.ticket)} · Dif: ${diffT.toFixed(2)}€ (${diffHuman(diffT)})`);
  lines.push(``);
  lines.push(`🗂️ *${full ? "Reporte completo" : "Últimos " + list.length + " periodos"}*:`);

  for (const r of list){
    lines.push(`• ${r.periodLabel} — Total ${formatMoney(r.total)} · Ticket ${formatMoney(r.ticket)} · Dif ${r.diffT.toFixed(2)}€`);
  }

  lines.push(``);
  lines.push(`📌 Periodos: ${first} → ${last}`);

  openWhatsApp(lines.join("\n"));
}

/* ============== Confirm modal ============== */
let confirmCb = null;
function openConfirm(title, text, okText="Sí, borrar", cb=null){
  confirmTitle.textContent = title;
  confirmText.textContent = text;
  btnConfirmOk.textContent = okText;
  confirmCb = cb;
  confirmOverlay.classList.remove("hidden");
}
function closeConfirm(){
  confirmOverlay.classList.add("hidden");
  confirmCb = null;
}

/* ============== Render all ============== */
function renderAll(){
  fillEntryIfExists();
  renderTodaySummary();
  renderDayHistory();
  renderGoals();
  refreshReports();
}

/* ============== Events ============== */
function bindEvents(){
  // auth
  btnSignIn.addEventListener("click", async ()=>{
    const email = (emailInput.value||"").trim();
    const pass = (passInput.value||"").trim();
    if(!email || !pass){
      toast(authMsg, "Introduce email y contraseña.", false);
      return;
    }

    try{
      setCloudBadge("warn","☁️ Nube: conectando…");
      toast(authMsg, "Conectando…", true);
      await signInEmailPassword(email, pass);
      toast(authMsg, "Login correcto ✅", true);
    }catch(e){
      console.error(e);
      toast(authMsg, "Error login: " + (e?.message || "error"), false);
      setCloudBadge("bad","☁️ Nube: error login");
    }
  });

  btnResetPass.addEventListener("click", async ()=>{
    const email = (emailInput.value||"").trim();
    if(!email){
      toast(authMsg, "Escribe tu email para recuperar.", false);
      return;
    }
    try{
      await resetPassword(email);
      toast(authMsg, "Te envié un email para cambiar la contraseña ✅", true);
    }catch(e){
      toast(authMsg, "Error: " + (e?.message || "error"), false);
    }
  });

  btnThemeAuth.addEventListener("click", toggleTheme);

  // tabs
  tabButtons.forEach(btn => btn.addEventListener("click", ()=> activateTab(btn.dataset.tab)));

  // theme
  btnTheme.addEventListener("click", toggleTheme);

  // menu
  btnMenu.addEventListener("click", ()=> menuOverlay.classList.remove("hidden"));
  btnCloseMenu.addEventListener("click", ()=> menuOverlay.classList.add("hidden"));
  menuOverlay.addEventListener("click", (e)=>{
    if (e.target === menuOverlay) menuOverlay.classList.add("hidden");
  });

  btnExportJSON.addEventListener("click", exportJSON);
  importFile.addEventListener("change", importJSON);
  btnExportCSV.addEventListener("click", exportCSV);
  btnWhatsAppReport.addEventListener("click", ()=> sendWhatsAppReport(false));
  btnWhatsAppReportFull.addEventListener("click", ()=> sendWhatsAppReport(true));

  btnSignOut.addEventListener("click", async ()=>{
    openConfirm(
      "Salir de la nube",
      "Vas a cerrar sesión. Tus datos quedan guardados en nube. ¿Continuar?",
      "Sí, salir",
      async ()=>{
        closeConfirm();
        await signOut();
      }
    );
  });

  // confirm modal
  btnConfirmClose.addEventListener("click", closeConfirm);
  btnConfirmCancel.addEventListener("click", closeConfirm);
  btnConfirmOk.addEventListener("click", async ()=>{
    if (confirmCb) await confirmCb();
    closeConfirm();
  });
  confirmOverlay.addEventListener("click",(e)=>{ if(e.target===confirmOverlay) closeConfirm(); });

  // date
  btnToday.addEventListener("click", ()=> { dateInput.value = toISODate(new Date()); renderAll(); });
  btnYesterday.addEventListener("click", ()=> { dateInput.value = addDaysISO(dateInput.value, -1); renderAll(); });

  dateInput.addEventListener("change", ()=> renderAll());

  // store quick
  storeQuick.querySelectorAll(".storebtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const v = btn.dataset.store;
      storeInput.value = v;
      highlightStoreQuick(v);
      fillEntryIfExists();
    });
  });

  storeInput.addEventListener("change", ()=>{
    highlightStoreQuick(storeInput.value);
    fillEntryIfExists();
  });

  // inputs
  const moneyInputs = [cashInput, cardInput, ticketInput, expensesInput, cashCountedInput];
  for (const el of moneyInputs){
    el.addEventListener("input", ()=>{
      normalizeMoneyInput(el);
      updateBoxes();
    });
    el.addEventListener("focus", ()=>{ try{ el.select(); }catch{} });
  }
  notesInput.addEventListener("input", ()=>{ /* no-op */ });

  // save
  btnSave.addEventListener("click", ()=>{
    const dateISO = dateInput.value;
    const storeId = storeInput.value;

    const payload = {
      cash: round2(parseMoney(cashInput.value)),
      card: round2(parseMoney(cardInput.value)),
      ticket: round2(parseMoney(ticketInput.value)),
      expenses: round2(parseMoney(expensesInput.value)),
      cashCounted: round2(parseMoney(cashCountedInput.value)),
      notes: (notesInput.value || "").trim()
    };

    setEntry(dateISO, storeId, payload);

    const e = getEntry(dateISO, storeId);
    const total = calcTotal(e);
    const dt = calcTicketDiff(e);

    toast(saveMsg, `Guardado ✅ (${storeName(storeId)} — Total ${formatMoney(total)} · Dif ${dt.toFixed(2)}€)`, true);

    renderAll();
    cloudPushDebounced();
  });

  btnClear.addEventListener("click", clearEntry);

  // delete (confirm global)
  btnDelete.addEventListener("click", ()=>{
    const dateISO = dateInput.value;
    const storeId = storeInput.value;
    const e = getEntry(dateISO, storeId);
    if(!e){
      toast(saveMsg, "No existe registro para borrar.", false);
      return;
    }

    openConfirm(
      "Borrar registro (GLOBAL)",
      "Esto borrará el registro en ESTE dispositivo y también en la NUBE (afecta a TODOS los dispositivos). ¿Seguro?",
      "Sí, borrar en todos",
      async ()=>{
        deleteEntry(dateISO, storeId);
        toast(saveMsg, "Registro borrado ✅", true);
        renderAll();
        cloudPushDebounced();
      }
    );
  });

  btnWhatsAppDay.addEventListener("click", ()=> openWhatsApp(buildWhatsAppDayText(dateInput.value)));

  btnCopyDay.addEventListener("click", async ()=>{
    const txt = buildWhatsAppDayText(dateInput.value);
    await copyToClipboard(txt);
    toast(saveMsg, "Copiado ✅", true);
  });

  btnSaveGoals.addEventListener("click", onSaveGoals);
  btnRefresh.addEventListener("click", refreshReports);
}

/* ============== Boot ============== */
(function boot(){
  // Tema inicial (sin UID todavía, usa light)
  applyTheme("light");

  bindEvents();
  activateTab("tab-entry");

  // Init date defaults
  dateInput.value = toISODate(new Date());
  rangeFrom.value = dateInput.value.slice(0,7) + "-01";
  rangeTo.value = dateInput.value;

  highlightStoreQuick(storeInput.value);

  // Auth state listener
  const fb = getFirebase();
  if(!fb){
    setCloudBadge("bad","☁️ Firebase no configurado");
    toast(authMsg, "Firebase no configurado.", false);
    return;
  }

  fb.auth.onAuthStateChanged(async (user)=>{
    if(!user){
      UID = null;
      cloud.ready = false;
      setCloudBadge("warn","☁️ Nube: esperando login…");
      showAuth();
      return;
    }

    try{
      await cloudInitAfterAuth(user);
    }catch(e){
      console.error(e);
      setCloudBadge("warn","☁️ Nube: offline (local)");
      showApp();
      renderAll();
    }
  });
})();
