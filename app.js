/* =========================
   ARSLAN — Ventas 3 tiendas (Cloud + Local)
   - Cloud: Firebase RTDB + Email/Password
   - Multi-dispositivo seguro:
     * NUNCA pisa nube si local está vacío
     * Pull + Merge por updatedAt
     * Push solo tras cambios o si local tiene datos y nube vacía
   - Diferencia correcta: (Efe+Tar) - Ticket
   - Semáforo:
     Verde |dif|<=10, Amarillo <=20, Rojo >20 (con advertencia)
========================= */

const APP_KEY = "ARSLAN_VENTAS_V1_STATE";
const SETTINGS_KEY = "ARSLAN_VENTAS_V1_SETTINGS";

const STORES = [
  { id: "san_pablo", name: "San Pablo" },
  { id: "san_lesmes", name: "San Lesmes" },
  { id: "santiago", name: "Santiago" }
];

const $ = (id) => document.getElementById(id);

/* ---------- DOM ---------- */
const cloudGate = $("cloudGate");
const cloudEmail = $("cloudEmail");
const cloudPass = $("cloudPass");
const btnCloudLogin = $("btnCloudLogin");
const btnCloudRegister = $("btnCloudRegister");
const btnLocalOnly = $("btnLocalOnly");
const cloudGateMsg = $("cloudGateMsg");
const btnThemeGate = $("btnThemeGate");

const appView = $("appView");
const cloudStatus = $("cloudStatus");
const btnTheme = $("btnTheme");
const btnCloudLogout = $("btnCloudLogout");
const btnLogoutApp = $("btnLogoutApp");

const mobileTabs = $("mobileTabs");
const tabButtons = mobileTabs ? Array.from(mobileTabs.querySelectorAll(".tab")) : [];
const tabSections = Array.from(document.querySelectorAll(".tab-section"));

const dateInput = $("dateInput");
const storeInput = $("storeInput");
const btnToday = $("btnToday");
const btnYesterday = $("btnYesterday");

const cashInput = $("cashInput");
const cardInput = $("cardInput");
const expensesInput = $("expensesInput");
const ticketInput = $("ticketInput");

const totalBox = $("totalBox");
const diffBox = $("diffBox");
const diffWarn = $("diffWarn");

const btnSave = $("btnSave");
const btnClear = $("btnClear");
const btnDelete = $("btnDelete");
const saveMsg = $("saveMsg");

const dayList = $("dayList");
const dayHint = $("dayHint");
const btnCopyDay = $("btnCopyDay");

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
const rangeFrom = $("rangeFrom");
const rangeTo = $("rangeTo");
const btnRefresh = $("btnRefresh");
const btnExportCSV = $("btnExportCSV");
const btnToggleCharts = $("btnToggleCharts");

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

const btnBackup = $("btnBackup");
const importFile = $("importFile");

const btnScrollTop = $("btnScrollTop");

/* ---------- Charts ---------- */
let chartTotal = null;
let chartMix = null;
let chartTicket = null;

/* ---------- State ---------- */
let state = loadState();      // { entries: { "YYYY-MM-DD__store": {...} } }
let settings = loadSettings();// { theme, appAuthed:boolean, cloud:{enabled:boolean,lastEmail?:string} }

applyTheme(settings.theme || "light");

/* ---------- Cloud ---------- */
let cloud = {
  enabled: false,
  ready: false,
  uid: null,
  email: null,
  refs: null,
  remoteLoadedOnce: false,
  suppressPush: false
};

function setCloudBadge(type, text){
  if (!cloudStatus) return;
  cloudStatus.classList.remove("ok","warn","bad");
  if (type) cloudStatus.classList.add(type);
  cloudStatus.textContent = text;
}

/* =========================
   INIT
========================= */
bindGateEvents();
bindAppEvents();
initMobileTabs();
initDefaults();
initUX();

/* Primera vista: gate */
showGate();

/* =========================
   GATE (Login Cloud)
========================= */
function showGate(){
  cloudGate.classList.remove("hidden");
  appView.classList.add("hidden");
  cloudGateMsg.textContent = "";
  cloudGateMsg.className = "msg";
  cloudEmail.value = settings?.cloud?.lastEmail || "";
  cloudPass.value = "";
  try { cloudEmail.focus(); } catch {}
}

function showApp(){
  cloudGate.classList.add("hidden");
  appView.classList.remove("hidden");

  setCloudBadge(cloud.ready ? "ok" : (cloud.enabled ? "warn" : "warn"),
               cloud.ready ? "☁️ Nube: online" : (cloud.enabled ? "☁️ Nube: conectando…" : "☁️ Nube: local"));

  refreshAllUI();
  try { highlightStoreQuick(storeInput.value); } catch {}
}

function bindGateEvents(){
  btnThemeGate?.addEventListener("click", toggleTheme);
  btnCloudLogin?.addEventListener("click", cloudLogin);
  btnCloudRegister?.addEventListener("click", cloudRegister);
  btnLocalOnly?.addEventListener("click", () => {
    settings.appAuthed = true;
    settings.cloud = settings.cloud || {};
    settings.cloud.enabled = false;
    saveSettings();
    cloud.enabled = false;
    cloud.ready = false;
    showApp();
  });

  cloudPass?.addEventListener("keydown", (e)=>{
    if (e.key === "Enter") cloudLogin();
  });
}

async function cloudLogin(){
  try{
    if (!window.__firebase?.auth || !window.__firebase?.db){
      toast(cloudGateMsg, "Firebase no está configurado en index.html.", false);
      return;
    }

    const email = (cloudEmail.value || "").trim();
    const pass = (cloudPass.value || "").trim();
    if (!email || !pass){
      toast(cloudGateMsg, "Escribe email y contraseña.", false);
      return;
    }

    toast(cloudGateMsg, "Conectando a la nube…", true);

    cloud.enabled = true;
    setCloudBadge("warn","☁️ Nube: conectando…");

    const { auth } = window.__firebase;
    await auth.signInWithEmailAndPassword(email, pass);

    settings.appAuthed = true;
    settings.cloud = settings.cloud || {};
    settings.cloud.enabled = true;
    settings.cloud.lastEmail = email;
    saveSettings();

    toast(cloudGateMsg, "Sesión iniciada ✅", true);

    await initCloudAfterAuth(email);
    showApp();
  }catch(err){
    console.error(err);
    toast(cloudGateMsg, "Error login: " + (err?.code || err?.message || "error"), false);
    setCloudBadge("bad","☁️ Nube: error login");
  }
}

async function cloudRegister(){
  try{
    if (!window.__firebase?.auth){
      toast(cloudGateMsg, "Firebase no está configurado.", false);
      return;
    }
    const email = (cloudEmail.value || "").trim();
    const pass = (cloudPass.value || "").trim();
    if (!email || !pass){
      toast(cloudGateMsg, "Escribe email y contraseña para crear usuario.", false);
      return;
    }

    toast(cloudGateMsg, "Creando usuario…", true);
    const { auth } = window.__firebase;
    await auth.createUserWithEmailAndPassword(email, pass);

    toast(cloudGateMsg, "Usuario creado ✅ Ahora entrando…", true);
    await initCloudAfterAuth(email);

    settings.appAuthed = true;
    settings.cloud = settings.cloud || {};
    settings.cloud.enabled = true;
    settings.cloud.lastEmail = email;
    saveSettings();

    showApp();
  }catch(err){
    console.error(err);
    toast(cloudGateMsg, "Error registro: " + (err?.code || err?.message || "error"), false);
  }
}

/* =========================
   Cloud init AFTER auth
========================= */
async function initCloudAfterAuth(email){
  const { auth, db, serverTimestamp } = window.__firebase;

  // Estado actual
  const user = auth.currentUser;
  if (!user){
    cloud.ready = false;
    setCloudBadge("bad","☁️ Nube: sin sesión");
    return;
  }

  cloud.email = email || user.email || null;
  cloud.uid = user.uid;
  cloud.ready = true;

  const basePath = "arslan_ventas_v1/" + cloud.uid;
  const baseRef = db.ref(basePath);

  cloud.refs = {
    baseRef,
    stateRef: baseRef.child("state"),
    metaRef: baseRef.child("meta"),
    serverTimestamp
  };

  setCloudBadge("warn","☁️ Nube: sincronizando…");

  // 1) Pull inicial + merge (NO push todavía)
  cloud.suppressPush = true;
  await cloudPullAndMergeOnce();
  cloud.suppressPush = false;

  // 2) Listener remoto (merge incremental)
  cloud.refs.stateRef.on("value", (snap)=>{
    const remote = snap.val();
    if (!remote?.entries) return;
    cloudMergeRemoteIntoLocal(remote.entries, false);
  }, (err)=>{
    console.error("RTDB listener error:", err);
    setCloudBadge("bad","☁️ DB: " + (err?.code || "error"));
  });

  setCloudBadge("ok","☁️ Nube: online");

  // 3) Si la nube estaba vacía y local tiene datos → subimos (una vez)
  //    (Esto cumple: dispositivo con datos NO pierde datos; dispositivo vacío NO pisa nube)
  if (cloud.remoteLoadedOnce === true && cloud._remoteWasEmpty === true){
    const localCount = Object.keys(state.entries || {}).length;
    if (localCount > 0){
      await cloudPushAll("initial-local-to-empty-cloud");
    }
  }
}

async function cloudPullAndMergeOnce(){
  try{
    if (!cloud.ready || !cloud.refs) return;
    const snap = await cloud.refs.stateRef.get();
    cloud.remoteLoadedOnce = true;

    if (!snap.exists()){
      cloud._remoteWasEmpty = true;
      return;
    }

    const remote = snap.val();
    const remoteEntries = remote?.entries || null;
    if (!remoteEntries || Object.keys(remoteEntries).length === 0){
      cloud._remoteWasEmpty = true;
      return;
    }

    cloud._remoteWasEmpty = false;
    cloudMergeRemoteIntoLocal(remoteEntries, true);
  }catch(err){
    console.error("cloud pull error:", err);
    setCloudBadge("warn","☁️ Nube: offline (local)");
  }
}

function cloudMergeRemoteIntoLocal(remoteEntries, silent){
  if (!remoteEntries) return;

  if (!state.entries) state.entries = {};
  let changed = false;

  for (const [k, rv] of Object.entries(remoteEntries)){
    const lv = state.entries[k];

    const rt = Date.parse(rv?.updatedAt || 0) || 0;
    const lt = Date.parse(lv?.updatedAt || 0) || 0;

    if (!lv || rt > lt){
      state.entries[k] = rv;
      changed = true;
    }
  }

  if (changed){
    saveState();
    if (!silent){
      refreshAllUI();
    }
  }
}

async function cloudPushAll(reason="change"){
  try{
    if (!cloud.enabled || !cloud.ready || !cloud.refs) return;
    if (cloud.suppressPush) return;

    setCloudBadge("warn","☁️ Nube: subiendo…");

    const payload = {
      entries: state.entries || {},
      updatedAt: new Date().toISOString(),
      serverAt: cloud.refs.serverTimestamp,
      reason
    };

    await cloud.refs.stateRef.set(payload);

    setCloudBadge("ok","☁️ Nube: online");
  }catch(err){
    console.error("cloud push error:", err);
    setCloudBadge("warn","☁️ Nube: offline (local)");
  }
}

/* =========================
   App events
========================= */
function bindAppEvents(){
  btnTheme?.addEventListener("click", toggleTheme);

  btnCloudLogout?.addEventListener("click", async ()=>{
    try{
      if (window.__firebase?.auth) await window.__firebase.auth.signOut();
    }catch(e){}
    cloud.enabled = false;
    cloud.ready = false;
    cloud.uid = null;
    cloud.refs = null;

    settings.cloud = settings.cloud || {};
    settings.cloud.enabled = false;
    saveSettings();

    setCloudBadge("warn","☁️ Nube: local");
  });

  btnLogoutApp?.addEventListener("click", ()=>{
    settings.appAuthed = false;
    saveSettings();
    showGate();
  });

  btnToday?.addEventListener("click", ()=> setDateISO(toISODate(new Date())));
  btnYesterday?.addEventListener("click", ()=> setDateISO(addDaysISO(dateInput.value, -1)));

  dateInput?.addEventListener("change", refreshAllUI);

  storeInput?.addEventListener("change", ()=>{
    fillEntryIfExists();
    highlightStoreQuick(storeInput.value);
  });

  document.querySelectorAll(".storebtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const v = btn.dataset.store;
      if (!v) return;
      storeInput.value = v;
      highlightStoreQuick(v);
      fillEntryIfExists();
      cashInput?.focus();
    });
  });

  const moneyInputs = [cashInput, cardInput, expensesInput, ticketInput];
  for (const el of moneyInputs){
    el?.addEventListener("input", ()=>{
      normalizeMoneyInput(el);
      updateComputedBoxes();
    });
    el?.addEventListener("blur", ()=>{
      // formateo suave en blur (no molesta al escribir)
      const n = round2(parseMoney(el.value));
      el.value = n ? String(n).replace(".", ",") : "";
      updateComputedBoxes();
    });
  }

  btnSave?.addEventListener("click", onSave);
  btnClear?.addEventListener("click", clearEntry);
  btnDelete?.addEventListener("click", onDelete);

  btnCopyDay?.addEventListener("click", async ()=>{
    const txt = buildDayText(dateInput.value);
    await copyToClipboard(txt);
    toast(saveMsg, "Copiado ✅", true);
  });

  btnRefresh?.addEventListener("click", refreshReports);
  btnExportCSV?.addEventListener("click", exportCSV);

  btnToggleCharts?.addEventListener("click", ()=>{
    const chartsEl = document.querySelector(".charts");
    chartsEl?.classList.toggle("hide-secondary");
  });

  btnBackup?.addEventListener("click", exportBackup);
  importFile?.addEventListener("change", importBackup);

  btnScrollTop?.addEventListener("click", () => {
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { window.scrollTo(0,0); }
  });
}

/* =========================
   Tabs
========================= */
function initMobileTabs(){
  if (!mobileTabs) return;

  function activateTab(id){
    tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === id));
    tabSections.forEach(s => s.classList.toggle("active", s.id === id));
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  }
  tabButtons.forEach(btn => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));
  activateTab("tab-entry");
}

/* =========================
   UX
========================= */
function initUX(){
  document.querySelectorAll("input.money").forEach(inp=>{
    inp.addEventListener("focus", () => { try { inp.select(); } catch {} });
  });

  window.addEventListener("scroll", () => {
    if (!btnScrollTop) return;
    const show = window.scrollY > 500;
    btnScrollTop.classList.toggle("show", show);
  });

  // En móvil: por defecto ocultar charts extra
  const chartsEl = document.querySelector(".charts");
  if (chartsEl) chartsEl.classList.add("hide-secondary");
}

function highlightStoreQuick(storeId){
  document.querySelectorAll(".storebtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.store === storeId);
  });
}

/* =========================
   Defaults + Views
========================= */
function initDefaults(){
  const today = toISODate(new Date());
  if (!dateInput.value) dateInput.value = today;

  const firstDay = today.slice(0,7) + "-01";
  if (!rangeFrom.value) rangeFrom.value = firstDay;
  if (!rangeTo.value) rangeTo.value = today;

  storeInput.value = storeInput.value || "san_pablo";
  highlightStoreQuick(storeInput.value);
}

function setDateISO(iso){
  dateInput.value = iso;
  refreshAllUI();
}

function refreshAllUI(){
  fillEntryIfExists();
  renderDayHistory();
  renderTodaySummary();
  refreshReports();
}

function showAppIfAllowed(){
  if (settings.appAuthed) showApp();
  else showGate();
}

/* =========================
   Theme
========================= */
function toggleTheme(){
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = (current === "dark") ? "light" : "dark";
  applyTheme(next);
  settings.theme = next;
  saveSettings();
  refreshReports();
}
function applyTheme(theme){
  if (theme === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

/* =========================
   Storage
========================= */
function loadState(){
  try{
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return { entries:{} };
    const parsed = JSON.parse(raw);
    if (!parsed.entries) parsed.entries = {};
    return parsed;
  }catch{
    return { entries:{} };
  }
}
function saveState(){ localStorage.setItem(APP_KEY, JSON.stringify(state)); }

function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { theme:"light", appAuthed:false, cloud:{ enabled:false, lastEmail:"" } };
    const s = JSON.parse(raw);
    if (!s.theme) s.theme = "light";
    if (typeof s.appAuthed !== "boolean") s.appAuthed = false;
    if (!s.cloud) s.cloud = { enabled:false, lastEmail:"" };
    return s;
  }catch{
    return { theme:"light", appAuthed:false, cloud:{ enabled:false, lastEmail:"" } };
  }
}
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

/* =========================
   Helpers
========================= */
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
function formatMoney(n){
  const v = Number(n || 0);
  return v.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
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
function storeName(id){ return STORES.find(s => s.id === id)?.name || id; }
function keyOf(dateISO, storeId){ return `${dateISO}__${storeId}`; }
function getEntry(dateISO, storeId){ return state.entries[keyOf(dateISO, storeId)] || null; }

function setEntry(dateISO, storeId, payload){
  state.entries[keyOf(dateISO, storeId)] = {
    date: dateISO,
    store: storeId,
    cash: payload.cash || 0,
    card: payload.card || 0,
    expenses: payload.expenses || 0,
    ticket: payload.ticket || 0,
    updatedAt: new Date().toISOString()
  };
  saveState();
}
function deleteEntry(dateISO, storeId){
  delete state.entries[keyOf(dateISO, storeId)];
  saveState();
}

/* =========================
   Semáforo thresholds
========================= */
function semaClass(diff){
  const a = Math.abs(Number(diff || 0));
  if (a <= 10) return "ok";      // verde
  if (a <= 20) return "warn";    // amarillo
  return "bad";                  // rojo
}

function semaText(diff){
  const v = Number(diff || 0);
  const abs = Math.abs(v).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});
  if (Math.abs(v) <= 0.01) return "Cuadra ✅";
  if (v < 0) return `Faltan ${abs} €`;
  return `Sobran ${abs} €`;
}

/* =========================
   Computed boxes (Entrada)
   Diferencia CORRECTA:
   diff = (cash+card) - ticket
========================= */
function updateComputedBoxes(){
  const cash = round2(parseMoney(cashInput.value));
  const card = round2(parseMoney(cardInput.value));
  const expenses = round2(parseMoney(expensesInput.value));
  const ticket = round2(parseMoney(ticketInput.value));

  const total = round2(cash + card);
  const diff = round2(total - ticket);

  totalBox.textContent = `${formatMoney(total)}  (Efe ${formatMoney(cash)} + Tar ${formatMoney(card)})`;

  diffBox.textContent = `${semaText(diff)}  · Dif ${formatSigned(diff)}  (Total ${formatMoney(total)} − Ticket ${formatMoney(ticket)})`;

  diffBox.classList.remove("ok","warn","bad");
  diffBox.classList.add(semaClass(diff));

  // Advertencia roja
  if (semaClass(diff) === "bad"){
    diffWarn.textContent = `⚠️ DIFERENCIA GRANDE: ${semaText(diff)} — revisa ticket o cobros.`;
    diffWarn.classList.remove("hidden");
  } else {
    diffWarn.classList.add("hidden");
    diffWarn.textContent = "";
  }

  // Gastos no entra en diff (pero queda guardado)
  void expenses;
}

function formatSigned(n){
  const v = Number(n || 0);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
}

/* =========================
   Entry UI
========================= */
function fillEntryIfExists(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;
  const e = getEntry(dateISO, storeId);

  if (e){
    cashInput.value = e.cash ? String(e.cash).replace(".", ",") : "";
    cardInput.value = e.card ? String(e.card).replace(".", ",") : "";
    expensesInput.value = e.expenses ? String(e.expenses).replace(".", ",") : "";
    ticketInput.value = e.ticket ? String(e.ticket).replace(".", ",") : "";
  } else {
    cashInput.value = "";
    cardInput.value = "";
    expensesInput.value = "";
    ticketInput.value = "";
  }

  updateComputedBoxes();
  saveMsg.textContent = "";
  saveMsg.className = "msg";
}

function clearEntry(){
  cashInput.value = "";
  cardInput.value = "";
  expensesInput.value = "";
  ticketInput.value = "";
  updateComputedBoxes();
  toast(saveMsg, "", true);
}

async function onSave(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;
  if (!dateISO){
    toast(saveMsg, "Selecciona una fecha.", false);
    return;
  }

  const payload = {
    cash: round2(parseMoney(cashInput.value)),
    card: round2(parseMoney(cardInput.value)),
    expenses: round2(parseMoney(expensesInput.value)),
    ticket: round2(parseMoney(ticketInput.value))
  };

  setEntry(dateISO, storeId, payload);

  const total = round2(payload.cash + payload.card);
  const diff = round2(total - payload.ticket);

  toast(saveMsg, `Guardado ✅ ${storeName(storeId)} · Total ${formatMoney(total)} · Ticket ${formatMoney(payload.ticket)} · ${semaText(diff)}`, true);

  renderDayHistory();
  renderTodaySummary();
  refreshReports();

  await cloudPushAll("save");
}

async function onDelete(){
  const dateISO = dateInput.value;
  const storeId = storeInput.value;

  const e = getEntry(dateISO, storeId);
  if (!e){
    toast(saveMsg, "No existe registro para borrar.", false);
    return;
  }

  const ok = confirm(
    `⚠️ Vas a borrar este registro:\n\n` +
    `Fecha: ${dateISO}\nTienda: ${storeName(storeId)}\n\n` +
    `Esto se borrará del sistema en TODOS los dispositivos (si estás en nube).\n\n¿Continuar?`
  );
  if (!ok) return;

  deleteEntry(dateISO, storeId);
  toast(saveMsg, "Registro borrado ✅", true);

  fillEntryIfExists();
  renderDayHistory();
  renderTodaySummary();
  refreshReports();

  await cloudPushAll("delete");
}

/* =========================
   Day totals + Summary
========================= */
function computeDay(dateISO){
  const byStore = {};
  let gCash=0, gCard=0, gTicket=0, gExpenses=0;

  for (const s of STORES){
    const e = getEntry(dateISO, s.id);
    const cash = Number(e?.cash || 0);
    const card = Number(e?.card || 0);
    const ticket = Number(e?.ticket || 0);
    const expenses = Number(e?.expenses || 0);

    const total = round2(cash + card);
    const diff = round2(total - ticket);

    byStore[s.id] = { cash, card, ticket, expenses, total, diff };

    gCash += cash; gCard += card; gTicket += ticket; gExpenses += expenses;
  }

  const gTotal = round2(gCash + gCard);
  const gDiff = round2(gTotal - gTicket);

  return {
    byStore,
    global: { cash:gCash, card:gCard, ticket:gTicket, expenses:gExpenses, total:gTotal, diff:gDiff }
  };
}

function renderTodaySummary(){
  const d = dateInput.value;
  const t = computeDay(d);

  const sp = t.byStore.san_pablo;
  const sl = t.byStore.san_lesmes;
  const sa = t.byStore.santiago;
  const g  = t.global;

  sumSP.textContent = formatMoney(sp.total);
  sumSP2.textContent = `Efe ${formatMoney(sp.cash)} · Tar ${formatMoney(sp.card)} · Gastos ${formatMoney(sp.expenses)} · Ticket ${formatMoney(sp.ticket)} · ${semaText(sp.diff)} (${formatSigned(sp.diff)})`;

  sumSL.textContent = formatMoney(sl.total);
  sumSL2.textContent = `Efe ${formatMoney(sl.cash)} · Tar ${formatMoney(sl.card)} · Gastos ${formatMoney(sl.expenses)} · Ticket ${formatMoney(sl.ticket)} · ${semaText(sl.diff)} (${formatSigned(sl.diff)})`;

  sumSA.textContent = formatMoney(sa.total);
  sumSA2.textContent = `Efe ${formatMoney(sa.cash)} · Tar ${formatMoney(sa.card)} · Gastos ${formatMoney(sa.expenses)} · Ticket ${formatMoney(sa.ticket)} · ${semaText(sa.diff)} (${formatSigned(sa.diff)})`;

  sumGlobal.textContent = formatMoney(g.total);
  sumGlobal2.textContent = `Efe ${formatMoney(g.cash)} · Tar ${formatMoney(g.card)} · Gastos ${formatMoney(g.expenses)} · Ticket ${formatMoney(g.ticket)} · ${semaText(g.diff)} (${formatSigned(g.diff)})`;
}

/* =========================
   Day history list
========================= */
function renderDayHistory(){
  const dateISO = dateInput.value;
  dayList.innerHTML = "";

  const items = STORES.map(s => {
    const e = getEntry(dateISO, s.id);
    const cash = Number(e?.cash || 0);
    const card = Number(e?.card || 0);
    const ticket = Number(e?.ticket || 0);
    const expenses = Number(e?.expenses || 0);
    const total = round2(cash + card);
    const diff = round2(total - ticket);
    return { store:s.id, name:s.name, cash, card, ticket, expenses, total, diff, exists: !!e };
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
          Total ${formatMoney(it.total)} · Ticket ${formatMoney(it.ticket)} · ${semaText(it.diff)}
          · Gastos ${formatMoney(it.expenses)}
        </div>
      </div>
      <div class="v">${formatMoney(it.total)}</div>
    `;
    div.addEventListener("click", () => {
      storeInput.value = it.store;
      highlightStoreQuick(it.store);
      fillEntryIfExists();
      cashInput?.focus();
    });
    dayList.appendChild(div);
  }
}

function buildDayText(dateISO){
  const t = computeDay(dateISO);
  const g = t.global;
  return [
    `📊 *RESUMEN DEL DÍA*`,
    `📅 ${dateISO} (${weekdayES(dateISO)})`,
    ``,
    `🏪 *San Pablo* — Total ${formatMoney(t.byStore.san_pablo.total)} · Ticket ${formatMoney(t.byStore.san_pablo.ticket)} · ${semaText(t.byStore.san_pablo.diff)}`,
    `🏪 *San Lesmes* — Total ${formatMoney(t.byStore.san_lesmes.total)} · Ticket ${formatMoney(t.byStore.san_lesmes.ticket)} · ${semaText(t.byStore.san_lesmes.diff)}`,
    `🏪 *Santiago* — Total ${formatMoney(t.byStore.santiago.total)} · Ticket ${formatMoney(t.byStore.santiago.ticket)} · ${semaText(t.byStore.santiago.diff)}`,
    ``,
    `🌍 *GLOBAL* — Total ${formatMoney(g.total)} · Ticket ${formatMoney(g.ticket)} · ${semaText(g.diff)}`
  ].join("\n");
}

/* =========================
   Reports
========================= */
function refreshReports(){
  const type = reportType.value;
  const store = reportStore.value;
  const from = rangeFrom.value || null;
  const to = rangeTo.value || null;

  const rows = buildReport(type, store, from, to);

  const sum = rows.reduce((acc,r)=>({
    cash: acc.cash + r.cash,
    card: acc.card + r.card,
    expenses: acc.expenses + r.expenses,
    total: acc.total + r.total,
    ticket: acc.ticket + r.ticket
  }), {cash:0, card:0, expenses:0, total:0, ticket:0});

  const diff = round2(sum.total - sum.ticket);
  const daysCount = estimateDaysCovered(rows, type);
  const avg = (daysCount > 0) ? (sum.total / daysCount) : 0;

  kpiCash.textContent = formatMoney(sum.cash);
  kpiCard.textContent = formatMoney(sum.card);
  kpiTotal.textContent = formatMoney(sum.total);
  kpiTicket.textContent = formatMoney(sum.ticket);
  kpiDiff.textContent = `${formatSigned(diff)} · ${semaText(diff)}`;
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
      <td>${formatSigned(r.diff)} · ${semaText(r.diff)}</td>
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
    const expenses = Number(e.expenses || 0);
    const ticket = Number(e.ticket || 0);

    let period, periodLabel;
    if (type === "daily"){
      period = date;
      periodLabel = `${date} (${weekdayES(date)})`;
    } else if (type === "weekly"){
      period = isoWeekLabel(date);
      periodLabel = weekRangeLabel(date);
    } else {
      period = monthLabel(date);
      periodLabel = monthPrettyLabel(date);
    }

    const prev = map.get(period) || {
      period, periodLabel,
      cash:0, card:0, expenses:0, total:0, ticket:0,
      sortKey: periodSortKey(type, date)
    };

    prev.cash += cash;
    prev.card += card;
    prev.expenses += expenses;
    prev.total += (cash + card);
    prev.ticket += ticket;
    prev.sortKey = Math.min(prev.sortKey, periodSortKey(type, date));

    map.set(period, prev);
  }

  const rows = Array.from(map.values());
  rows.sort((a,b)=> a.sortKey - b.sortKey);

  return rows.map(r => {
    const diff = round2(r.total - r.ticket);
    return {
      period: r.period,
      periodLabel: r.periodLabel,
      cash: round2(r.cash),
      card: round2(r.card),
      expenses: round2(r.expenses),
      total: round2(r.total),
      ticket: round2(r.ticket),
      diff,
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

/* =========================
   Charts
========================= */
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

function baseChartOptions(){
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const labelColor = isDark ? "#eaf0ff" : "#101828";
  const gridColor = isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";
  return {
    responsive: true,
    plugins: { legend: { labels: { color: labelColor } } },
    scales: {
      x: { ticks: { color: labelColor }, grid: { color: gridColor } },
      y: { ticks: { color: labelColor }, grid: { color: gridColor } }
    }
  };
}

/* =========================
   Ranking
========================= */
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

/* =========================
   CSV + Backup JSON
========================= */
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

  const header = ["Periodo","Efectivo","Tarjeta","Gastos","Total","Ticket","Diferencia_Total_menos_Ticket"];
  const lines = [header.join(";")];

  for (const r of rows){
    lines.push([
      `"${r.periodLabel.replaceAll('"','""')}"`,
      r.cash.toFixed(2).replace(".", ","),
      r.card.toFixed(2).replace(".", ","),
      r.expenses.toFixed(2).replace(".", ","),
      r.total.toFixed(2).replace(".", ","),
      r.ticket.toFixed(2).replace(".", ","),
      r.diff.toFixed(2).replace(".", ",")
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

function exportBackup(){
  const payload = {
    meta: { app: "ARSLAN_VENTAS_V1", exportedAt: new Date().toISOString() },
    state,
    settings: { ...settings, appAuthed:false } // no exportamos sesión
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_arslan_ventas_${toISODate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(){
  const file = importFile.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const payload = JSON.parse(reader.result);
      if (!payload?.state?.entries) throw new Error("Formato no válido.");

      // Merge local con import: gana el más reciente por updatedAt
      const imported = payload.state.entries || {};
      if (!state.entries) state.entries = {};

      for (const [k, v] of Object.entries(imported)){
        const lv = state.entries[k];
        const it = Date.parse(v?.updatedAt || 0) || 0;
        const lt = Date.parse(lv?.updatedAt || 0) || 0;
        if (!lv || it > lt) state.entries[k] = v;
      }

      saveState();
      refreshAllUI();
      alert("Importado y fusionado ✅");

      await cloudPushAll("import");
    }catch(err){
      alert("Error importando: " + err.message);
    }finally{
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

/* =========================
   Toast + Clipboard
========================= */
function toast(el, text, ok=true){
  if (!el) return;
  el.className = "msg " + (ok ? "ok" : "err");
  el.textContent = text || "";
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

/* =========================
   Boot (Gate must be first)
========================= */
if (settings.appAuthed){
  // si el usuario dejó la app abierta antes:
  // volvemos a gate igualmente si no hay nube activa; pero permitimos local.
  if (settings.cloud?.enabled){
    // Mostramos gate para login nube explícito (tu requisito “pregunte antes que todo”)
    showGate();
  } else {
    showApp();
  }
} else {
  showGate();
}

/* =========================================================
   ✅ APPEND PRO: HERO "VENTAS HOY" (Global + semáforo)
   NO toca tus funciones, solo las usa.
========================================================= */
(function(){
  const heroDate = document.getElementById("ventasHeroDate");
  const heroStore = document.getElementById("ventasHeroStore");
  const heroTotal = document.getElementById("ventasHeroTotal");
  const heroCash = document.getElementById("ventasHeroCash");
  const heroCard = document.getElementById("ventasHeroCard");
  const heroTicket = document.getElementById("ventasHeroTicket");
  const heroDiff = document.getElementById("ventasHeroDiff");
  const heroDiffChip = document.getElementById("ventasHeroDiffChip");

  function syncHero(){
    try{
      const d = document.getElementById("dateInput")?.value;
      const s = document.getElementById("storeInput")?.value;

      if (heroDate) heroDate.textContent = d ? `${d} (${weekdayES(d)})` : "—";
      if (heroStore) heroStore.textContent = s ? storeName(s) : "—";

      if (!d){
        if (heroTotal) heroTotal.textContent = "—";
        if (heroCash) heroCash.textContent = "—";
        if (heroCard) heroCard.textContent = "—";
        if (heroTicket) heroTicket.textContent = "—";
        if (heroDiff) heroDiff.textContent = "—";
        if (heroDiffChip) heroDiffChip.classList.remove("ok","warn","bad");
        return;
      }

      const t = computeDay(d);
      const g = t.global;

      if (heroTotal) heroTotal.textContent = formatMoney(g.total);
      if (heroCash) heroCash.textContent = formatMoney(g.cash);
      if (heroCard) heroCard.textContent = formatMoney(g.card);
      if (heroTicket) heroTicket.textContent = formatMoney(g.ticket);

      const diff = Number(g.diff || 0);
      if (heroDiff) heroDiff.textContent = `${semaText(diff)} · ${formatSigned(diff)}`;

      if (heroDiffChip){
        heroDiffChip.classList.remove("ok","warn","bad");
        heroDiffChip.classList.add(semaClass(diff));
      }
    }catch(e){}
  }

  window.addEventListener("load", syncHero);
  document.getElementById("dateInput")?.addEventListener("change", syncHero);
  document.getElementById("storeInput")?.addEventListener("change", syncHero);
  document.getElementById("btnSave")?.addEventListener("click", ()=> setTimeout(syncHero, 0));
  document.getElementById("btnDelete")?.addEventListener("click", ()=> setTimeout(syncHero, 0));
  document.getElementById("btnClear")?.addEventListener("click", ()=> setTimeout(syncHero, 0));

  document.querySelectorAll(".storebtn").forEach(b=>{
    b.addEventListener("click", ()=> setTimeout(syncHero, 0));
  });

  syncHero();
})();
