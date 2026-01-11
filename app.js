/* =========================
   app.js
   ARSLAN — Ventas 3 tiendas
   ✅ Email/Password obligatorio
   ✅ Multi-dispositivo real (misma cuenta => mismos datos)
   ✅ NUNCA borra la nube si un dispositivo está vacío
   ✅ Sync seguro: merge por registro + updatedAt
   ✅ Borrado con confirmación + sincronizado en todos (tombstone deletedAt)
========================= */

/* ---------- Constantes ---------- */
const APP_KEY = "ARSLAN_SALES_V1_LOCAL";
const SETTINGS_KEY = "ARSLAN_SALES_V1_SETTINGS";
const WA_PHONE = "34631667893"; // cambia si quieres

const STORES = [
  { id: "san_pablo", name: "San Pablo" },
  { id: "san_lesmes", name: "San Lesmes" },
  { id: "santiago", name: "Santiago" }
];

/* ---------- Helpers DOM ---------- */
const $ = (id) => document.getElementById(id);

/* ---------- Vistas ---------- */
const loginView = $("loginView");
const appView = $("appView");

/* Login */
const emailInput = $("emailInput");
const passInput = $("passInput");
const btnLogin = $("btnLogin");
const btnResetPass = $("btnResetPass");
const loginMsg = $("loginMsg");

/* Topbar */
const cloudStatus = $("cloudStatus");
const btnTheme = $("btnTheme");
const btnThemeLogin = $("btnThemeLogin");
const btnLogout = $("btnLogout");
const btnExport = $("btnExport");
const importFile = $("importFile");

/* Tabs */
const tabs = $("tabs");
const tabButtons = tabs ? Array.from(tabs.querySelectorAll(".tab")) : [];
const tabSections = Array.from(document.querySelectorAll(".tab-section"));

/* Mobile head */
const mobileHead = $("mobileHead");
const dateInput = $("dateInput");
const btnToday = $("btnToday");
const btnYesterday = $("btnYesterday");
const btnTomorrow = $("btnTomorrow");

/* Desktop date/store */
const dateInputDesk = $("dateInputDesk");
const btnTodayDesk = $("btnTodayDesk");
const btnYesterdayDesk = $("btnYesterdayDesk");
const btnTomorrowDesk = $("btnTomorrowDesk");
const storeInput = $("storeInput");

/* Entry fields */
const cashInput = $("cashInput");
const cardInput = $("cardInput");
const expensesInput = $("expensesInput");
const ticketInput = $("ticketInput");
const totalBox = $("totalBox");
const diffBox = $("diffBox");
const btnSave = $("btnSave");
const btnClear = $("btnClear");
const btnDelete = $("btnDelete");
const btnGoSummary = $("btnGoSummary");
const saveMsg = $("saveMsg");

/* Day summary */
const sumSP = $("sumSP");
const sumSP2 = $("sumSP2");
const sumSL = $("sumSL");
const sumSL2 = $("sumSL2");
const sumSA = $("sumSA");
const sumSA2 = $("sumSA2");
const sumG = $("sumG");
const sumG2 = $("sumG2");
const dayHint = $("dayHint");
const dayList = $("dayList");
const btnCopyDay = $("btnCopyDay");
const btnWhatsDay = $("btnWhatsDay");

/* Reports */
const reportType = $("reportType");
const reportStore = $("reportStore");
const rangeFrom = $("rangeFrom");
const rangeTo = $("rangeTo");
const btnRefresh = $("btnRefresh");
const btnWhatsReport = $("btnWhatsReport");
const btnExportCSV = $("btnExportCSV");

const kCash = $("kCash");
const kCard = $("kCard");
const kTotal = $("kTotal");
const kExp = $("kExp");
const kTicket = $("kTicket");
const kDiff = $("kDiff");

const repTableBody = $("repTable").querySelector("tbody");
const repHint = $("repHint");

const rankList = $("rankList");
const rankHint = $("rankHint");
const pctSP = $("pctSP");
const pctSP2 = $("pctSP2");
const pctSL = $("pctSL");
const pctSL2 = $("pctSL2");
const pctSA = $("pctSA");
const pctSA2 = $("pctSA2");

/* Charts */
let chTotal = null;
let chMix = null;
let chTicket = null;

/* FAB */
const btnTop = $("btnTop");

/* ---------- Estado local ---------- */
let state = loadState();
let settings = loadSettings();

/* ---------- Cloud state ---------- */
let cloud = {
  enabled: false,
  ready: false,
  uid: null,
  entriesRef: null,
  unsubscribed: false,
  applyingRemote: false
};

/* =========================
   INIT
========================= */
applyTheme(settings.theme || "light");
initDates();
bindEvents();
initTabs();
initFAB();

showLogin();

/* =========================
   EVENTS
========================= */
function bindEvents(){
  btnTheme?.addEventListener("click", toggleTheme);
  btnThemeLogin?.addEventListener("click", toggleTheme);

  btnLogin?.addEventListener("click", doLogin);
  passInput?.addEventListener("keydown", (e)=>{ if(e.key==="Enter") doLogin(); });

  btnResetPass?.addEventListener("click", resetPassword);

  btnLogout?.addEventListener("click", async ()=>{
    try{
      await window.__firebase?.auth?.signOut();
    }catch(e){}
    cloudReset();
    showLogin();
  });

  // Date buttons (mobile + desk)
  btnToday?.addEventListener("click", ()=> setSelectedDate(toISODate(new Date())));
  btnYesterday?.addEventListener("click", ()=> setSelectedDate(addDaysISO(getSelectedDate(), -1)));
  btnTomorrow?.addEventListener("click", ()=> setSelectedDate(addDaysISO(getSelectedDate(),  1)));

  btnTodayDesk?.addEventListener("click", ()=> setSelectedDate(toISODate(new Date())));
  btnYesterdayDesk?.addEventListener("click", ()=> setSelectedDate(addDaysISO(getSelectedDate(), -1)));
  btnTomorrowDesk?.addEventListener("click", ()=> setSelectedDate(addDaysISO(getSelectedDate(),  1)));

  dateInput?.addEventListener("change", ()=> onDateOrStoreChange());
  dateInputDesk?.addEventListener("change", ()=> onDateOrStoreChange());
  storeInput?.addEventListener("change", ()=> onDateOrStoreChange());

  // Store quick buttons
  document.querySelectorAll(".storebtn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const s = btn.dataset.store;
      if(!s) return;
      storeInput.value = s;
      highlightStoreQuick(s);
      fillEntry();
      updateComputed();
    });
  });

  // Money inputs
  [cashInput, cardInput, expensesInput, ticketInput].forEach(el=>{
    el.addEventListener("input", ()=>{
      normalizeMoneyInput(el);
      updateComputed();
    });
  });

  btnSave?.addEventListener("click", onSave);
  btnClear?.addEventListener("click", onClear);
  btnDelete?.addEventListener("click", onDelete);

  btnGoSummary?.addEventListener("click", ()=> activateTab("tab-day"));

  btnCopyDay?.addEventListener("click", async ()=>{
    const text = buildDayText(getSelectedDate());
    await copyToClipboard(text);
    toast(saveMsg, "Copiado ✅", true);
  });

  btnWhatsDay?.addEventListener("click", ()=>{
    openWhatsApp(buildDayText(getSelectedDate()));
  });

  btnRefresh?.addEventListener("click", refreshReports);
  btnWhatsReport?.addEventListener("click", ()=> openWhatsApp(buildReportText()));
  btnExportCSV?.addEventListener("click", exportCSV);

  btnExport?.addEventListener("click", exportBackup);
  importFile?.addEventListener("change", importBackup);
}

function initTabs(){
  function activate(btn){
    tabButtons.forEach(b => b.classList.toggle("active", b === btn));
    tabSections.forEach(s => s.classList.toggle("active", s.id === btn.dataset.tab));
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
  }
  tabButtons.forEach(btn => btn.addEventListener("click", ()=> activate(btn)));
}
function activateTab(id){
  const btn = tabButtons.find(b=>b.dataset.tab===id);
  if(btn) btn.click();
}

function initFAB(){
  window.addEventListener("scroll", ()=>{
    const show = window.scrollY > 500;
    btnTop?.classList.toggle("show", show);
  });
  btnTop?.addEventListener("click", ()=>{
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { window.scrollTo(0,0); }
  });
}

/* =========================
   THEME
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
  if (theme === "dark") document.documentElement.setAttribute("data-theme","dark");
  else document.documentElement.removeAttribute("data-theme");
}

/* =========================
   DATES / STORE
========================= */
function initDates(){
  const today = toISODate(new Date());
  setSelectedDate(today);
  storeInput.value = "san_pablo";
  highlightStoreQuick("san_pablo");

  // default report range = month to today
  const firstDay = today.slice(0,7) + "-01";
  rangeFrom.value = firstDay;
  rangeTo.value = today;
}

function setSelectedDate(iso){
  if(dateInput) dateInput.value = iso;
  if(dateInputDesk) dateInputDesk.value = iso;
  onDateOrStoreChange();
}
function getSelectedDate(){
  return (dateInput && dateInput.value) || (dateInputDesk && dateInputDesk.value) || toISODate(new Date());
}
function onDateOrStoreChange(){
  fillEntry();
  updateComputed();
  renderDaySummary();
  refreshReports();
}
function highlightStoreQuick(storeId){
  document.querySelectorAll(".storebtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.store === storeId);
  });
}

/* =========================
   LOGIN + CLOUD INIT (Email/Password)
========================= */
function showLogin(){
  loginView.classList.remove("hidden");
  appView.classList.add("hidden");
  setCloudBadge("warn","☁️ Nube: desconectada");
  showMsg(loginMsg, "", null);
  passInput.value = "";
  // emailInput no lo limpio para comodidad
  emailInput.focus();
}

function showApp(){
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  fillEntry();
  updateComputed();
  renderDaySummary();
  refreshReports();
}

async function doLogin(){
  showMsg(loginMsg, "Conectando…", "ok");

  if(!window.__firebase?.auth || !window.__firebase?.db){
    showMsg(loginMsg, "Firebase no está configurado en index.html.", "err");
    return;
  }

  const email = (emailInput.value || "").trim();
  const pass = (passInput.value || "").trim();

  if(!email || !pass){
    showMsg(loginMsg, "Rellena email y contraseña.", "err");
    return;
  }

  try{
    setCloudBadge("warn","☁️ Nube: iniciando sesión…");
    const cred = await window.__firebase.auth.signInWithEmailAndPassword(email, pass);

    const user = cred.user;
    if(!user){
      showMsg(loginMsg, "No se pudo iniciar sesión.", "err");
      setCloudBadge("bad","☁️ Nube: sin sesión");
      return;
    }

    settings.lastEmail = email;
    saveSettings();

    await initCloudForUser(user.uid);
    showMsg(loginMsg, "Acceso correcto ✅", "ok");
    showApp();
  }catch(err){
    console.error(err);
    const code = err?.code || "";
    if(code.includes("auth/wrong-password") || code.includes("auth/invalid-credential")){
      showMsg(loginMsg, "Contraseña incorrecta.", "err");
    }else if(code.includes("auth/user-not-found")){
      showMsg(loginMsg, "Usuario no encontrado. Revisa el email.", "err");
    }else if(code.includes("auth/too-many-requests")){
      showMsg(loginMsg, "Demasiados intentos. Espera y prueba otra vez.", "err");
    }else{
      showMsg(loginMsg, "Error: " + (err?.message || code || "desconocido"), "err");
    }
    setCloudBadge("bad","☁️ Nube: error login");
  }
}

async function resetPassword(){
  const email = (emailInput.value || "").trim();
  if(!email){
    showMsg(loginMsg, "Escribe tu email para enviar el reset.", "err");
    return;
  }
  try{
    await window.__firebase.auth.sendPasswordResetEmail(email);
    showMsg(loginMsg, "Email de recuperación enviado ✅", "ok");
  }catch(err){
    showMsg(loginMsg, "Error reset: " + (err?.message || err?.code || "desconocido"), "err");
  }
}

function cloudReset(){
  cloud.enabled = false;
  cloud.ready = false;
  cloud.uid = null;
  cloud.entriesRef = null;
  cloud.unsubscribed = false;
  cloud.applyingRemote = false;
}

/* ==============
   Cloud init:
   - ruta por usuario (UID)
   - PULL inicial (no pisa local si nube vacía)
   - Listener en entries
   - Push seguro solo por registro (update)
============== */
async function initCloudForUser(uid){
  cloudReset();

  cloud.enabled = true;
  cloud.uid = uid;

  const db = window.__firebase.db;
  const base = db.ref("arslan_facturacion/users/" + uid);
  const entriesRef = base.child("entries");
  cloud.entriesRef = entriesRef;

  setCloudBadge("warn","☁️ Nube: sincronizando…");

  // 1) PULL inicial
  try{
    const snap = await entriesRef.get();
    if(snap.exists()){
      const remoteEntries = snap.val() || {};
      applyRemoteEntries(remoteEntries, true);
    }
  }catch(e){
    console.warn("Cloud pull failed:", e);
    setCloudBadge("warn","☁️ Nube: offline (local)");
    return;
  }

  // 2) Listener realtime
  entriesRef.on("child_added", (snap)=> applyRemoteOne(snap.key, snap.val()), (err)=> cloudListenerError(err));
  entriesRef.on("child_changed", (snap)=> applyRemoteOne(snap.key, snap.val()), (err)=> cloudListenerError(err));
  // child_removed no lo usamos porque nosotros no borramos físicamente; usamos deletedAt.

  cloud.ready = true;
  setCloudBadge("ok","☁️ Nube: online");

  // 3) Push “solo si local tiene cambios más nuevos”
  pushLocalNewerOnly().catch(()=>{});
}

function cloudListenerError(err){
  console.error("Cloud listener error:", err);
  setCloudBadge("bad","☁️ DB: " + (err?.code || "error"));
}

/* =========================
   STORAGE
========================= */
function loadState(){
  try{
    const raw = localStorage.getItem(APP_KEY);
    if(!raw) return { entries:{} };
    const parsed = JSON.parse(raw);
    if(!parsed.entries) parsed.entries = {};
    return parsed;
  }catch{
    return { entries:{} };
  }
}
function saveState(){
  localStorage.setItem(APP_KEY, JSON.stringify(state));
}

function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if(!raw) return { theme:"light", lastEmail:"" };
    const parsed = JSON.parse(raw);
    if(!parsed.theme) parsed.theme = "light";
    return parsed;
  }catch{
    return { theme:"light", lastEmail:"" };
  }
}
function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* =========================
   ENTRY MODEL
========================= */
function entryId(dateISO, storeId){
  return `${dateISO}__${storeId}`;
}
function getEntry(dateISO, storeId){
  const id = entryId(dateISO, storeId);
  const e = state.entries[id] || null;
  if(e && e.deletedAt) return null; // hide deleted
  return e;
}
function getEntryRaw(id){
  return state.entries[id] || null;
}

function setEntryLocal(dateISO, storeId, payload){
  const id = entryId(dateISO, storeId);
  const now = Date.now();
  state.entries[id] = {
    id,
    date: dateISO,
    store: storeId,
    cash: payload.cash || 0,
    card: payload.card || 0,
    expenses: payload.expenses || 0,
    ticket: payload.ticket || 0,
    deletedAt: payload.deletedAt || 0,
    updatedAt: payload.updatedAt || now
  };
  saveState();
}
function markDeletedLocal(dateISO, storeId){
  const id = entryId(dateISO, storeId);
  const now = Date.now();
  const prev = state.entries[id] || { id, date:dateISO, store:storeId };
  state.entries[id] = { ...prev, deletedAt: now, updatedAt: now };
  saveState();
}

/* =========================
   CLOUD MERGE
========================= */
function applyRemoteEntries(remoteEntries, silent){
  cloud.applyingRemote = true;
  try{
    let changed = false;
    for(const [id, remote] of Object.entries(remoteEntries || {})){
      if(!remote || !remote.id) continue;
      const local = getEntryRaw(id);
      const rU = Number(remote.updatedAt || 0);
      const lU = Number(local?.updatedAt || 0);
      if(!local || rU > lU){
        state.entries[id] = remote;
        changed = true;
      }
    }
    if(changed) saveState();
  }finally{
    cloud.applyingRemote = false;
  }
  if(!silent){
    fillEntry();
    updateComputed();
    renderDaySummary();
    refreshReports();
  }
}

function applyRemoteOne(id, remote){
  if(!id || !remote) return;

  cloud.applyingRemote = true;
  try{
    const local = getEntryRaw(id);
    const rU = Number(remote.updatedAt || 0);
    const lU = Number(local?.updatedAt || 0);

    // Si remoto es más nuevo -> aplicar
    if(!local || rU > lU){
      state.entries[id] = remote;
      saveState();
    } else {
      // Si local es más nuevo -> re-push (evita divergencias)
      // (solo si estamos online y no en medio de apply)
      if(cloud.ready && cloud.enabled){
        pushOneToCloud(local).catch(()=>{});
      }
    }
  }finally{
    cloud.applyingRemote = false;
  }

  fillEntry();
  updateComputed();
  renderDaySummary();
  refreshReports();
}

async function pushLocalNewerOnly(){
  if(!cloud.ready || !cloud.entriesRef) return;

  // para no ser agresivos: solo revisa algunos (pero aquí hacemos todo; suele ser poco)
  const snap = await cloud.entriesRef.get();
  const remoteMap = snap.exists() ? (snap.val() || {}) : {};

  const updates = {};
  for(const [id, local] of Object.entries(state.entries || {})){
    if(!local || !local.id) continue;
    const remote = remoteMap[id];
    const lU = Number(local.updatedAt || 0);
    const rU = Number(remote?.updatedAt || 0);
    if(!remote || lU > rU){
      updates[id] = local;
    }
  }
  if(Object.keys(updates).length){
    // update por mapa = merge, no pisa el árbol entero
    await cloud.entriesRef.update(updates);
  }
}

async function pushOneToCloud(entryObj){
  if(!cloud.ready || !cloud.entriesRef || !entryObj?.id) return;
  await cloud.entriesRef.child(entryObj.id).set(entryObj);
}

/* =========================
   ENTRY UI
========================= */
function fillEntry(){
  const d = getSelectedDate();
  const s = storeInput.value;
  highlightStoreQuick(s);

  const e = getEntry(d, s);
  if(e){
    cashInput.value = fmtInput(e.cash);
    cardInput.value = fmtInput(e.card);
    expensesInput.value = fmtInput(e.expenses);
    ticketInput.value = fmtInput(e.ticket);
  }else{
    cashInput.value = "";
    cardInput.value = "";
    expensesInput.value = "";
    ticketInput.value = "";
  }
  hideMsg(saveMsg);
}

function updateComputed(){
  const cash = round2(parseMoney(cashInput.value));
  const card = round2(parseMoney(cardInput.value));
  const exp  = round2(parseMoney(expensesInput.value));
  const tick = round2(parseMoney(ticketInput.value));
  const total = round2(cash + card);
  const diff = round2(tick - total);

  totalBox.textContent = `${formatMoney(total)}  (Efe ${formatMoney(cash)} + Tar ${formatMoney(card)})`;
  diffBox.textContent = (tick===0 && total===0) ? "—" : `${formatDiff(diff)}  (Ticket ${formatMoney(tick)} - Total ${formatMoney(total)})`;

  setStatusClass(diffBox, diff);

  // gastos solo informativo, no afecta total
  // (si quieres que afecte, dímelo y lo cambio)
  return { cash, card, expenses: exp, ticket: tick, total, diff };
}

function onClear(){
  cashInput.value = "";
  cardInput.value = "";
  expensesInput.value = "";
  ticketInput.value = "";
  updateComputed();
  hideMsg(saveMsg);
}

async function onSave(){
  const dateISO = getSelectedDate();
  const storeId = storeInput.value;
  if(!dateISO){
    toast(saveMsg, "Selecciona una fecha.", false);
    return;
  }

  const calc = updateComputed();
  const now = Date.now();
  const payload = {
    cash: calc.cash,
    card: calc.card,
    expenses: calc.expenses,
    ticket: calc.ticket,
    deletedAt: 0,
    updatedAt: now
  };

  setEntryLocal(dateISO, storeId, payload);
  toast(saveMsg, `Guardado ✅ (${storeName(storeId)} · Total ${formatMoney(calc.total)} · Ticket ${formatMoney(calc.ticket)} · Dif ${formatDiff(calc.diff)})`, true);

  renderDaySummary();
  refreshReports();

  // push seguro (solo este registro)
  if(cloud.ready && cloud.entriesRef && !cloud.applyingRemote){
    try{
      await cloud.entriesRef.child(entryId(dateISO, storeId)).set(state.entries[entryId(dateISO, storeId)]);
    }catch(e){
      console.warn("Cloud push failed:", e);
      setCloudBadge("warn","☁️ Nube: offline (local)");
    }
  }
}

async function onDelete(){
  const dateISO = getSelectedDate();
  const storeId = storeInput.value;

  const e = getEntry(dateISO, storeId);
  if(!e){
    toast(saveMsg, "No existe registro para borrar.", false);
    return;
  }

  const msg1 = `⚠️ Vas a borrar: ${storeName(storeId)} · ${dateISO}\n\nEsto se borrará en TODOS los dispositivos con esta cuenta.\n\n¿Continuar?`;
  if(!confirm(msg1)) return;

  const msg2 = `CONFIRMACIÓN FINAL:\nSe borrará en todos los dispositivos.\n\n¿Seguro 100%?`;
  if(!confirm(msg2)) return;

  // tombstone local
  markDeletedLocal(dateISO, storeId);

  toast(saveMsg, "Borrado ✅ (sincronizado)", true);

  fillEntry();
  updateComputed();
  renderDaySummary();
  refreshReports();

  // push tombstone
  if(cloud.ready && cloud.entriesRef){
    try{
      await cloud.entriesRef.child(entryId(dateISO, storeId)).set(state.entries[entryId(dateISO, storeId)]);
    }catch(e){
      console.warn("Cloud delete push failed:", e);
      setCloudBadge("warn","☁️ Nube: offline (local)");
    }
  }
}

/* =========================
   DAY SUMMARY
========================= */
function computeDay(dateISO){
  const out = {
    byStore: {},
    global: { cash:0, card:0, expenses:0, ticket:0, total:0, diff:0 }
  };

  for(const s of STORES){
    const e = getEntry(dateISO, s.id);
    const cash = Number(e?.cash || 0);
    const card = Number(e?.card || 0);
    const exp = Number(e?.expenses || 0);
    const ticket = Number(e?.ticket || 0);
    const total = cash + card;
    const diff = round2(ticket - total);

    out.byStore[s.id] = { cash, card, expenses: exp, ticket, total, diff, exists: !!e };

    out.global.cash += cash;
    out.global.card += card;
    out.global.expenses += exp;
    out.global.ticket += ticket;
    out.global.total += total;
  }
  out.global.diff = round2(out.global.ticket - out.global.total);
  return out;
}

function renderDaySummary(){
  const d = getSelectedDate();
  const day = computeDay(d);

  const sp = day.byStore.san_pablo;
  const sl = day.byStore.san_lesmes;
  const sa = day.byStore.santiago;
  const g  = day.global;

  sumSP.textContent = formatMoney(sp.total);
  sumSP2.textContent = `Efe ${formatMoney(sp.cash)} · Tar ${formatMoney(sp.card)} · Gastos ${formatMoney(sp.expenses)} · Ticket ${formatMoney(sp.ticket)} · Dif ${formatDiff(sp.diff)}`;

  sumSL.textContent = formatMoney(sl.total);
  sumSL2.textContent = `Efe ${formatMoney(sl.cash)} · Tar ${formatMoney(sl.card)} · Gastos ${formatMoney(sl.expenses)} · Ticket ${formatMoney(sl.ticket)} · Dif ${formatDiff(sl.diff)}`;

  sumSA.textContent = formatMoney(sa.total);
  sumSA2.textContent = `Efe ${formatMoney(sa.cash)} · Tar ${formatMoney(sa.card)} · Gastos ${formatMoney(sa.expenses)} · Ticket ${formatMoney(sa.ticket)} · Dif ${formatDiff(sa.diff)}`;

  sumG.textContent = formatMoney(g.total);
  sumG2.textContent = `Efe ${formatMoney(g.cash)} · Tar ${formatMoney(g.card)} · Gastos ${formatMoney(g.expenses)} · Ticket ${formatMoney(g.ticket)} · Dif ${formatDiff(g.diff)}`;

  const count = [sp,sl,sa].filter(x=>x.exists).length;
  dayHint.textContent = `${d} (${weekdayES(d)}) · registros: ${count}/3`;

  // list
  dayList.innerHTML = "";
  for(const s of STORES){
    const it = day.byStore[s.id];
    const div = document.createElement("div");
    div.className = "dayitem";
    div.innerHTML = `
      <div>
        <div class="k">${escapeHtml(s.name)}</div>
        <div class="muted small">Total ${formatMoney(it.total)} · Ticket ${formatMoney(it.ticket)} · Dif ${formatDiff(it.diff)} · Gastos ${formatMoney(it.expenses)}</div>
      </div>
      <div class="v">${it.exists ? "✅" : "—"}</div>
    `;
    div.addEventListener("click", ()=>{
      storeInput.value = s.id;
      highlightStoreQuick(s.id);
      fillEntry();
      updateComputed();
      activateTab("tab-entry");
      cashInput.focus();
    });
    dayList.appendChild(div);
  }
}

/* =========================
   REPORTS (daily/weekly/monthly)
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

  const diff = round2(sum.ticket - sum.total);

  kCash.textContent = formatMoney(sum.cash);
  kCard.textContent = formatMoney(sum.card);
  kExp.textContent  = formatMoney(sum.expenses);
  kTotal.textContent = formatMoney(sum.total);
  kTicket.textContent = formatMoney(sum.ticket);
  kDiff.textContent = formatDiff(diff);

  // table
  repTableBody.innerHTML = "";
  for(const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.periodLabel)}</td>
      <td>${formatMoney(r.cash)}</td>
      <td>${formatMoney(r.card)}</td>
      <td><b>${formatMoney(r.total)}</b></td>
      <td>${formatMoney(r.expenses)}</td>
      <td>${formatMoney(r.ticket)}</td>
      <td>${formatDiff(r.diff)}</td>
    `;
    repTableBody.appendChild(tr);
  }

  repHint.textContent = rows.length
    ? `Mostrando ${rows.length} periodos · Rango: ${from || "—"} → ${to || "—"}`
    : "No hay datos en ese rango.";

  renderCharts(rows);
  renderRankingAndPercents(from, to);
}

function buildReport(type, store, from=null, to=null){
  const all = Object.values(state.entries || {})
    .filter(e => e && e.id && !e.deletedAt);

  if(!all.length) return [];

  const filtered = all.filter(e=>{
    if(store !== "global" && e.store !== store) return false;
    if(from && e.date < from) return false;
    if(to && e.date > to) return false;
    return true;
  });

  const map = new Map();

  for(const e of filtered){
    const cash = Number(e.cash||0);
    const card = Number(e.card||0);
    const exp = Number(e.expenses||0);
    const ticket = Number(e.ticket||0);
    const total = cash + card;

    let period, periodLabel, sortKey;
    if(type === "daily"){
      period = e.date;
      periodLabel = `${e.date} (${weekdayES(e.date)})`;
      sortKey = new Date(e.date + "T00:00:00").getTime();
    }else if(type === "weekly"){
      const w = weekMeta(e.date);
      period = `${w.year}-W${String(w.week).padStart(2,"0")}`;
      periodLabel = `Semana ${period} (${w.mondayISO}→${addDaysISO(w.mondayISO,6)})`;
      sortKey = new Date(w.mondayISO + "T00:00:00").getTime();
    }else{
      const m = e.date.slice(0,7);
      period = m;
      periodLabel = `Mes ${m}`;
      sortKey = Number(m.replace("-","")) * 100;
    }

    const prev = map.get(period) || { period, periodLabel, cash:0, card:0, expenses:0, total:0, ticket:0, sortKey };
    prev.cash += cash;
    prev.card += card;
    prev.expenses += exp;
    prev.total += total;
    prev.ticket += ticket;
    prev.sortKey = Math.min(prev.sortKey, sortKey);

    map.set(period, prev);
  }

  const rows = Array.from(map.values()).sort((a,b)=>a.sortKey - b.sortKey);
  return rows.map(r=>{
    const diff = round2(r.ticket - r.total);
    return {
      period: r.period,
      periodLabel: r.periodLabel,
      cash: round2(r.cash),
      card: round2(r.card),
      expenses: round2(r.expenses),
      total: round2(r.total),
      ticket: round2(r.ticket),
      diff
    };
  });
}

/* Charts */
function renderCharts(rows){
  const labels = rows.map(r=>r.periodLabel);
  const totals = rows.map(r=>r.total);
  const cash = rows.map(r=>r.cash);
  const card = rows.map(r=>r.card);
  const ticket = rows.map(r=>r.ticket);

  const ma = movingAverage(totals, 3);

  if(chTotal) chTotal.destroy();
  chTotal = new Chart($("chTotal"), {
    type:"line",
    data:{
      labels,
      datasets:[
        { label:"Total", data: totals, tension:0.25, borderWidth:2, pointRadius:2 },
        { label:"Media (3)", data: ma, tension:0.25, borderWidth:2, pointRadius:0 }
      ]
    },
    options: baseChartOptions()
  });

  if(chMix) chMix.destroy();
  chMix = new Chart($("chMix"), {
    type:"bar",
    data:{ labels, datasets:[ { label:"Efectivo", data: cash }, { label:"Tarjeta", data: card } ] },
    options: baseChartOptions()
  });

  if(chTicket) chTicket.destroy();
  chTicket = new Chart($("chTicket"), {
    type:"line",
    data:{
      labels,
      datasets:[
        { label:"Total", data: totals, tension:0.25, borderWidth:2, pointRadius:2 },
        { label:"Ticket", data: ticket, tension:0.25, borderWidth:2, pointRadius:2 }
      ]
    },
    options: baseChartOptions()
  });
}

function baseChartOptions(){
  const isDark = document.documentElement.getAttribute("data-theme")==="dark";
  const labelColor = isDark ? "#eaf0ff" : "#101828";
  const gridColor  = isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";
  return {
    responsive:true,
    plugins:{ legend:{ labels:{ color: labelColor } } },
    scales:{
      x:{ ticks:{ color: labelColor }, grid:{ color: gridColor } },
      y:{ ticks:{ color: labelColor }, grid:{ color: gridColor } }
    }
  };
}

function movingAverage(arr, w){
  const out = [];
  for(let i=0;i<arr.length;i++){
    const start = Math.max(0, i-(w-1));
    const slice = arr.slice(start, i+1);
    const avg = slice.reduce((a,b)=>a+b,0)/slice.length;
    out.push(round2(avg));
  }
  return out;
}

/* Ranking + Percents (global) */
function renderRankingAndPercents(from, to){
  const sums = STORES.map(s=>{
    const rows = buildReport("daily", s.id, from, to);
    const total = rows.reduce((a,r)=>a+r.total,0);
    return { id:s.id, name:s.name, total: round2(total) };
  }).sort((a,b)=>b.total-a.total);

  const global = sums.reduce((a,x)=>a+x.total,0);
  const pct = (v)=> global>0 ? (v/global*100) : 0;

  rankList.innerHTML = "";
  sums.forEach((it, idx)=>{
    const div = document.createElement("div");
    div.className = "rankitem";
    div.innerHTML = `
      <div class="left"><div class="dot"></div><div><b>${escapeHtml(it.name)}</b></div></div>
      <div>${formatMoney(it.total)} · ${pct(it.total).toFixed(1)}%</div>
    `;
    rankList.appendChild(div);
  });

  rankHint.textContent = global>0 ? `Total global del rango: ${formatMoney(global)}` : "Sin datos.";

  pctSP.textContent = pct(sums.find(x=>x.id==="san_pablo")?.total||0).toFixed(1) + "%";
  pctSL.textContent = pct(sums.find(x=>x.id==="san_lesmes")?.total||0).toFixed(1) + "%";
  pctSA.textContent = pct(sums.find(x=>x.id==="santiago")?.total||0).toFixed(1) + "%";

  pctSP2.textContent = `Importe: ${formatMoney(sums.find(x=>x.id==="san_pablo")?.total||0)}`;
  pctSL2.textContent = `Importe: ${formatMoney(sums.find(x=>x.id==="san_lesmes")?.total||0)}`;
  pctSA2.textContent = `Importe: ${formatMoney(sums.find(x=>x.id==="santiago")?.total||0)}`;
}

/* =========================
   WhatsApp / CSV / Backup
========================= */
function buildDayText(dateISO){
  const t = computeDay(dateISO);
  const sp = t.byStore.san_pablo;
  const sl = t.byStore.san_lesmes;
  const sa = t.byStore.santiago;
  const g  = t.global;

  return [
    `📊 *RESUMEN DEL DÍA*`,
    `📅 ${dateISO} (${weekdayES(dateISO)})`,
    ``,
    `🏪 *San Pablo*`,
    `🧾 Total ${formatMoney(sp.total)} · Ticket ${formatMoney(sp.ticket)} · Dif ${formatDiff(sp.diff)} · Gastos ${formatMoney(sp.expenses)}`,
    `💶 Efe ${formatMoney(sp.cash)} · 💳 Tar ${formatMoney(sp.card)}`,
    ``,
    `🏪 *San Lesmes*`,
    `🧾 Total ${formatMoney(sl.total)} · Ticket ${formatMoney(sl.ticket)} · Dif ${formatDiff(sl.diff)} · Gastos ${formatMoney(sl.expenses)}`,
    `💶 Efe ${formatMoney(sl.cash)} · 💳 Tar ${formatMoney(sl.card)}`,
    ``,
    `🏪 *Santiago*`,
    `🧾 Total ${formatMoney(sa.total)} · Ticket ${formatMoney(sa.ticket)} · Dif ${formatDiff(sa.diff)} · Gastos ${formatMoney(sa.expenses)}`,
    `💶 Efe ${formatMoney(sa.cash)} · 💳 Tar ${formatMoney(sa.card)}`,
    ``,
    `🌍 *GLOBAL*`,
    `🧾 Total ${formatMoney(g.total)} · Ticket ${formatMoney(g.ticket)} · Dif ${formatDiff(g.diff)} · Gastos ${formatMoney(g.expenses)}`,
    `💶 Efe ${formatMoney(g.cash)} · 💳 Tar ${formatMoney(g.card)}`
  ].join("\n");
}

function buildReportText(){
  const type = reportType.value;
  const store = reportStore.value;
  const from = rangeFrom.value || "—";
  const to = rangeTo.value || "—";
  const rows = buildReport(type, store, rangeFrom.value || null, rangeTo.value || null);

  if(!rows.length) return `No hay datos para este reporte (${type}).`;

  const titleType = type==="daily" ? "DIARIO" : type==="weekly" ? "SEMANAL" : "MENSUAL";
  const titleStore = store==="global" ? "GLOBAL" : storeName(store);

  const sum = rows.reduce((acc,r)=>({
    cash: acc.cash+r.cash,
    card: acc.card+r.card,
    expenses: acc.expenses+r.expenses,
    total: acc.total+r.total,
    ticket: acc.ticket+r.ticket
  }), {cash:0, card:0, expenses:0, total:0, ticket:0});

  const diff = round2(sum.ticket - sum.total);

  const last = rows.slice(-10);

  const lines = [];
  lines.push(`📈 *REPORTE ${titleType}*`);
  lines.push(`🏷️ ${titleStore}`);
  lines.push(`📌 Rango: ${from} → ${to}`);
  lines.push(``);
  lines.push(`💶 Efectivo: ${formatMoney(sum.cash)}`);
  lines.push(`💳 Tarjeta: ${formatMoney(sum.card)}`);
  lines.push(`🧾 TOTAL: ${formatMoney(sum.total)}`);
  lines.push(`🧾 Ticket: ${formatMoney(sum.ticket)} · Dif: ${formatDiff(diff)}`);
  lines.push(`💸 Gastos: ${formatMoney(sum.expenses)}`);
  lines.push(``);
  lines.push(`🗂️ *Últimos ${last.length} periodos*:`);

  for(const r of last){
    lines.push(`• ${r.periodLabel} — Total ${formatMoney(r.total)} · Ticket ${formatMoney(r.ticket)} · Dif ${formatDiff(r.diff)}`);
  }

  return lines.join("\n");
}

function openWhatsApp(text){
  const url = "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

function exportCSV(){
  const type = reportType.value;
  const store = reportStore.value;
  const from = rangeFrom.value || null;
  const to = rangeTo.value || null;

  const rows = buildReport(type, store, from, to);
  if(!rows.length){
    alert("No hay datos para exportar.");
    return;
  }

  const header = ["Periodo","Efectivo","Tarjeta","Total","Gastos","Ticket","DifTicket"];
  const lines = [header.join(";")];

  for(const r of rows){
    lines.push([
      `"${String(r.periodLabel).replaceAll('"','""')}"`,
      r.cash.toFixed(2).replace(".",","),
      r.card.toFixed(2).replace(".",","),
      r.total.toFixed(2).replace(".",","),
      r.expenses.toFixed(2).replace(".",","),
      r.ticket.toFixed(2).replace(".",","),
      r.diff.toFixed(2).replace(".",",")
    ].join(";"));
  }

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
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
    meta: { app:"ARSLAN_SALES_V1", exportedAt: new Date().toISOString() },
    state,
    settings: { ...settings }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `backup_arslan_sales_${toISODate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(){
  const file = importFile.files?.[0];
  if(!file) return;

  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const payload = JSON.parse(reader.result);
      if(!payload?.state?.entries) throw new Error("Formato no válido.");

      // merge seguro: no borra datos existentes, añade/actualiza por updatedAt
      const incoming = payload.state.entries || {};
      let changed = false;

      for(const [id, inc] of Object.entries(incoming)){
        if(!inc || !inc.id) continue;
        const local = state.entries[id];
        const iU = Number(inc.updatedAt||0);
        const lU = Number(local?.updatedAt||0);
        if(!local || iU > lU){
          state.entries[id] = inc;
          changed = true;
        }
      }

      if(changed) saveState();

      // settings: mantenemos theme actual
      const keepTheme = settings.theme;
      if(payload.settings){
        settings = { ...settings, ...payload.settings, theme: keepTheme };
        saveSettings();
      }

      fillEntry();
      updateComputed();
      renderDaySummary();
      refreshReports();

      alert("Importado correctamente ✅");

      // subir a nube solo lo que sea más nuevo
      if(cloud.ready) await pushLocalNewerOnly();

    }catch(err){
      alert("Error importando: " + (err?.message || "desconocido"));
    }finally{
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

/* =========================
   UI Utils
========================= */
function setCloudBadge(type, text){
  if(!cloudStatus) return;
  cloudStatus.classList.remove("ok","warn","bad");
  if(type) cloudStatus.classList.add(type);
  cloudStatus.textContent = text;
}
function showMsg(el, text, type){
  if(!el) return;
  if(!text){
    el.className = "msg";
    el.textContent = "";
    el.classList.remove("show","ok","err");
    return;
  }
  el.textContent = text;
  el.className = "msg show " + (type==="err" ? "err" : "ok");
}
function hideMsg(el){
  if(!el) return;
  el.classList.remove("show","ok","err");
  el.textContent = "";
}
function toast(el, text, ok=true){
  if(!el) return;
  el.textContent = text;
  el.className = "msg show " + (ok ? "ok" : "err");
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
   Formatting / Math
========================= */
function parseMoney(str){
  if(!str) return 0;
  const clean = String(str).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}
function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
function formatMoney(n){
  const v = Number(n||0);
  return v.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
}
function fmtInput(n){
  const v = Number(n||0);
  return v ? String(v).replace(".",",") : "";
}
function normalizeMoneyInput(el){
  el.value = String(el.value||"").replace(/[^\d,.-]/g,"");
}
function formatDiff(d){
  const v = Number(d||0);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
}
function setStatusClass(el, value){
  if(!el) return;
  el.classList.remove("ok","warn","bad");
  const v = Math.abs(Number(value||0));
  if(v <= 0.01) el.classList.add("ok");
  else if(v <= 10) el.classList.add("warn");
  else el.classList.add("bad");
}
function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function storeName(id){ return STORES.find(s=>s.id===id)?.name || id; }

/* Dates */
function toISODate(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function addDaysISO(dateISO, days){
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate()+days);
  return toISODate(d);
}
function weekdayES(dateISO){
  const d = new Date(dateISO + "T00:00:00");
  const days = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  return days[d.getDay()];
}
function weekMeta(dateISO){
  const date = new Date(dateISO + "T00:00:00");
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
   Import file handler wiring
========================= */
importFile?.addEventListener("change", importBackup);

/* =========================
   Prefill last email
========================= */
if(settings.lastEmail && emailInput){
  emailInput.value = settings.lastEmail;
}

/* =========================
   Small UX: Enter focus
========================= */
[emailInput, passInput, cashInput, cardInput, expensesInput, ticketInput].forEach((el)=>{
  el?.addEventListener("focus", ()=>{ try{ el.select(); }catch{} });
});

/* =========================
   Cloud badge initial
========================= */
setCloudBadge("warn","☁️ Nube: desconectada");
