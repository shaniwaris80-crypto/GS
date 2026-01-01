/* =========================
   ARSLAN — Ventas 3 Tiendas (Mobile PRO)
   - Inicio simple (Hoy + 3 tarjetas)
   - Vistas: Tienda (SP/SL/SA) + Global
   - Gráficos mejorados: line + bar (responsive)
   - Datos localStorage + Export/Import
   - WhatsApp: resumen día (home/store/global)
   - PIN hash (no se muestra) + fallback SHA
========================= */

const APP_KEY = "ARSLAN_SALES_MOBILE_V1";
const SETTINGS_KEY = "ARSLAN_SALES_MOBILE_SETTINGS_V1";
const WA_PHONE = "34631667893";

// PIN real NO se muestra. PIN actual: 7392
// SHA-256("7392") = fa68d2ed5f32f14746be3ce92a07e5dcc7431b3ac4e7717b6947a4054fae5c18
const DEFAULT_PIN_HASH = "fa68d2ed5f32f14746be3ce92a07e5dcc7431b3ac4e7717b6947a4054fae5c18";

const STORES = [
  { id: "san_pablo", short:"Pablo", name:"San Pablo" },
  { id: "san_lesmes", short:"Lesmes", name:"San Lesmes" },
  { id: "santiago", short:"Santiago", name:"Santiago" },
];

let state = loadState();
let settings = loadSettings();

const $ = (id)=>document.getElementById(id);

/* ---------- DOM ---------- */
const loginView = $("loginView");
const appView = $("appView");

const pinInput = $("pinInput");
const btnLogin = $("btnLogin");
const loginMsg = $("loginMsg");

const btnTheme = $("btnTheme");
const btnThemeLogin = $("btnThemeLogin");
const btnLogout = $("btnLogout");
const btnBackup = $("btnBackup");
const importFile = $("importFile");

const topSub = $("topSub");

const viewHome = $("viewHome");
const viewStore = $("viewStore");
const viewGlobal = $("viewGlobal");

const homeDate = $("homeDate");
const btnWAHomeDay = $("btnWAHomeDay");
const homeCards = $("homeCards");
const homeGlobalTotal = $("homeGlobalTotal");
const homeGlobalBreak = $("homeGlobalBreak");
const homeGlobalFlags = $("homeGlobalFlags");

const chartHome7Canvas = $("chartHome7");

const storeTitle = $("storeTitle");
const storeDate = $("storeDate");
const btnWAStoreDay = $("btnWAStoreDay");
const storeFlags = $("storeFlags");
const storeEntryHint = $("storeEntryHint");

const inCash = $("inCash");
const inCard = $("inCard");
const inTicket = $("inTicket");
const boxDiffTicket = $("boxDiffTicket");

const inExpenses = $("inExpenses");
const inWithdraw = $("inWithdraw");
const inExtra = $("inExtra");
const inCounted = $("inCounted");
const boxExpected = $("boxExpected");
const boxDiffCash = $("boxDiffCash");
const inNotes = $("inNotes");

const btnSaveEntry = $("btnSaveEntry");
const btnClearEntry = $("btnClearEntry");
const btnDeleteEntry = $("btnDeleteEntry");
const storeMsg = $("storeMsg");

const kStoreTotal = $("kStoreTotal");
const kStoreCash = $("kStoreCash");
const kStoreCard = $("kStoreCard");
const kStoreTicket = $("kStoreTicket");
const kStoreDiff = $("kStoreDiff");
const kStoreAvg = $("kStoreAvg");
const storeRangeLabel = $("storeRangeLabel");

const chartStoreTotalCanvas = $("chartStoreTotal");
const chartStoreMixCanvas = $("chartStoreMix");

const btnRefreshStoreList = $("btnRefreshStoreList");
const storeTableBody = $("storeTable").querySelector("tbody");

const globalPeriod = $("globalPeriod");
const btnWAGlobal = $("btnWAGlobal");
const kGTotal = $("kGTotal");
const kGCash = $("kGCash");
const kGCard = $("kGCard");
const kGTicket = $("kGTicket");
const kGDiff = $("kGDiff");
const kGAvg = $("kGAvg");
const globalRangeLabel = $("globalRangeLabel");

const chartGlobalBarsCanvas = $("chartGlobalBars");
const chartGlobalLineCanvas = $("chartGlobalLine");
const globalRanking = $("globalRanking");

/* nav */
const navBtns = Array.from(document.querySelectorAll(".navBtn"));

/* chips */
const homeChips = Array.from(document.querySelectorAll("[data-home7]"));
const storePeriodChips = Array.from(document.querySelectorAll("[data-store-period]"));

/* charts instances */
let chartHome7 = null;
let chartStoreTotal = null;
let chartStoreMix = null;
let chartGlobalBars = null;
let chartGlobalLine = null;

/* current view/store */
let currentStoreId = "san_pablo";
let homeSeriesMode = "total"; // total/cash/card
let storePeriodMode = "7d";   // 7d/30d/month

/* ---------- INIT ---------- */
applyTheme(settings.theme || "dark");
bindEvents();
initDates();

if (settings.isLogged) showApp();
else showLogin();

/* ---------- Events ---------- */
function bindEvents(){
  btnLogin.addEventListener("click", doLogin);
  pinInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter") doLogin(); });

  btnTheme.addEventListener("click", toggleTheme);
  btnThemeLogin.addEventListener("click", toggleTheme);

  btnLogout.addEventListener("click", ()=>{
    settings.isLogged = false;
    saveSettings();
    showLogin();
  });

  btnBackup.addEventListener("click", exportBackup);
  importFile.addEventListener("change", importBackup);

  homeDate.addEventListener("change", ()=>{
    topSub.textContent = labelHome();
    renderHome();
    renderGlobal(); // refresca global por coherencia
  });
  btnWAHomeDay.addEventListener("click", ()=> openWhatsApp(buildWhatsAppDayText(homeDate.value)));

  for(const c of homeChips){
    c.addEventListener("click", ()=>{
      homeChips.forEach(x=>x.classList.remove("active"));
      c.classList.add("active");
      homeSeriesMode = c.dataset.home7;
      renderHomeChart7();
    });
  }

  storeDate.addEventListener("change", ()=>{
    fillStoreEntry();
    renderStoreKPIsAndCharts();
    renderStoreList();
  });

  const moneyInputs = [inCash,inCard,inTicket,inExpenses,inWithdraw,inExtra,inCounted];
  for(const el of moneyInputs){
    el.addEventListener("input", ()=>{ normalizeMoneyInput(el); updateStoreBoxes(); });
  }

  btnSaveEntry.addEventListener("click", saveStoreEntry);
  btnClearEntry.addEventListener("click", clearStoreEntry);
  btnDeleteEntry.addEventListener("click", deleteStoreEntry);
  btnWAStoreDay.addEventListener("click", ()=> openWhatsApp(buildWhatsAppStoreDayText(currentStoreId, storeDate.value)));

  btnRefreshStoreList.addEventListener("click", renderStoreList);

  for(const c of storePeriodChips){
    c.addEventListener("click", ()=>{
      storePeriodChips.forEach(x=>x.classList.remove("active"));
      c.classList.add("active");
      storePeriodMode = c.dataset.storePeriod;
      renderStoreKPIsAndCharts();
    });
  }

  globalPeriod.addEventListener("change", renderGlobal);
  btnWAGlobal.addEventListener("click", ()=> openWhatsApp(buildWhatsAppGlobalText()));

  navBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      navBtns.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      const nav = btn.dataset.nav;
      if (nav === "home") openHome();
      if (nav === "global") openGlobal();
      if (nav === "sp") openStore("san_pablo");
      if (nav === "sl") openStore("san_lesmes");
      if (nav === "sa") openStore("santiago");
    });
  });
}

/* ---------- Dates ---------- */
function initDates(){
  const today = toISODate(new Date());
  homeDate.value = today;
  storeDate.value = today;
  topSub.textContent = labelHome();
}

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
  openHome();
}

function openHome(){
  viewHome.classList.remove("hidden");
  viewStore.classList.add("hidden");
  viewGlobal.classList.add("hidden");
  topSub.textContent = labelHome();
  renderHome();
}

function openStore(storeId){
  currentStoreId = storeId;
  viewHome.classList.add("hidden");
  viewStore.classList.remove("hidden");
  viewGlobal.classList.add("hidden");
  storeTitle.textContent = storeName(storeId);
  topSub.textContent = `Tienda: ${storeName(storeId)}`;
  fillStoreEntry();
  renderStoreKPIsAndCharts();
  renderStoreList();
}

function openGlobal(){
  viewHome.classList.add("hidden");
  viewStore.classList.add("hidden");
  viewGlobal.classList.remove("hidden");
  topSub.textContent = "Global";
  renderGlobal();
}

/* ---------- Theme ---------- */
function toggleTheme(){
  const next = (document.documentElement.getAttribute("data-theme")==="light") ? "dark" : "light";
  applyTheme(next);
  settings.theme = next;
  saveSettings();
  // redibuja charts para colores correctos
  if(!viewHome.classList.contains("hidden")) renderHome();
  if(!viewStore.classList.contains("hidden")) renderStoreKPIsAndCharts();
  if(!viewGlobal.classList.contains("hidden")) renderGlobal();
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
      const arr = Array.from(new Uint8Array(hashBuf));
      return arr.map(b=>b.toString(16).padStart(2,"0")).join("");
    }
  }catch{}
  return sha256Fallback(text);
}

/* fallback SHA-256 para file:// */
function sha256Fallback(ascii){
  function rightRotate(v,a){return (v>>>a)|(v<<(32-a));}
  const maxWord = Math.pow(2,32);
  let result="";

  const words=[];
  const asciiBitLength=ascii.length*8;
  let hash = sha256Fallback.h = sha256Fallback.h || [];
  let k = sha256Fallback.k = sha256Fallback.k || [];
  let primeCounter = k.length;

  const isComposite={};
  for(let candidate=2; primeCounter<64; candidate++){
    if(!isComposite[candidate]){
      for(let i=0;i<313;i+=candidate) isComposite[i]=candidate;
      hash[primeCounter]=(Math.pow(candidate,.5)*maxWord)|0;
      k[primeCounter++]=(Math.pow(candidate,1/3)*maxWord)|0;
    }
  }

  ascii+="\x80";
  while(ascii.length%64-56) ascii+="\x00";
  for(let i=0;i<ascii.length;i++){
    const j=ascii.charCodeAt(i);
    words[i>>2]|=j<<((3-i)%4)*8;
  }
  words[words.length]=((asciiBitLength/maxWord)|0);
  words[words.length]=asciiBitLength;

  for(let j=0;j<words.length;){
    const w=words.slice(j,j+=16);
    const oldHash=hash.slice(0);

    for(let i=0;i<64;i++){
      const w15=w[i-15], w2=w[i-2];
      const a=hash[0], e=hash[4];
      const temp1=(hash[7]
        + (rightRotate(e,6)^rightRotate(e,11)^rightRotate(e,25))
        + ((e&hash[5])^((~e)&hash[6]))
        + k[i]
        + (w[i]=(i<16)?w[i]:(w[i-16]
          + (rightRotate(w15,7)^rightRotate(w15,18)^(w15>>>3))
          + w[i-7]
          + (rightRotate(w2,17)^rightRotate(w2,19)^(w2>>>10))
        )|0)
      )|0;
      const temp2=((rightRotate(a,2)^rightRotate(a,13)^rightRotate(a,22))
        + ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]))
      )|0;

      hash=[(temp1+temp2)|0].concat(hash);
      hash[4]=(hash[4]+temp1)|0;
      hash.pop();
    }

    for(let i=0;i<8;i++) hash[i]=(hash[i]+oldHash[i])|0;
  }

  for(let i=0;i<8;i++){
    for(let j=3;j+1;j--){
      const b=(hash[i]>>(j*8))&255;
      result+=((b<16)?"0":"")+b.toString(16);
    }
  }
  return result;
}

/* ---------- Storage ---------- */
function loadState(){
  try{
    const raw = localStorage.getItem(APP_KEY);
    if(!raw) return { entries:{} };
    const p = JSON.parse(raw);
    if(!p.entries) p.entries = {};
    return p;
  }catch{
    return { entries:{} };
  }
}
function saveState(){ localStorage.setItem(APP_KEY, JSON.stringify(state)); }

function loadSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if(!raw) return { isLogged:false, theme:"dark", pinHash:DEFAULT_PIN_HASH };
    const p = JSON.parse(raw);
    if(typeof p.isLogged !== "boolean") p.isLogged=false;
    if(!p.theme) p.theme="dark";
    if(!p.pinHash || String(p.pinHash).length!==64) p.pinHash=DEFAULT_PIN_HASH;
    return p;
  }catch{
    return { isLogged:false, theme:"dark", pinHash:DEFAULT_PIN_HASH };
  }
}
function saveSettings(){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

/* ---------- Helpers ---------- */
function toISODate(d){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const day=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${day}`;
}
function parseMoney(str){
  if(!str) return 0;
  const clean = String(str).replace(/\./g,"").replace(",",".").replace(/[^\d.-]/g,"");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}
function round2(n){ return Math.round((n + Number.EPSILON) * 100) / 100; }
function formatMoney(n){
  return Number(n||0).toLocaleString("es-ES",{style:"currency",currency:"EUR"});
}
function formatDiff(n){
  const v = Number(n||0);
  const sign = v>0 ? "+" : "";
  return `${sign}${v.toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2})} €`;
}
function normalizeMoneyInput(el){
  el.value = String(el.value||"").replace(/[^\d,.-]/g,"");
}
function storeName(id){ return STORES.find(s=>s.id===id)?.name || id; }
function storeShort(id){ return STORES.find(s=>s.id===id)?.short || id; }
function keyOf(dateISO, storeId){ return `${dateISO}__${storeId}`; }
function getEntry(dateISO, storeId){ return state.entries[keyOf(dateISO, storeId)] || null; }
function setEntry(dateISO, storeId, payload){
  state.entries[keyOf(dateISO, storeId)] = {
    date: dateISO, store: storeId,
    cash: payload.cash||0,
    card: payload.card||0,
    ticket: payload.ticket||0,
    expenses: payload.expenses||0,
    withdrawals: payload.withdrawals||0,
    extraIncome: payload.extraIncome||0,
    cashCounted: payload.cashCounted||0,
    notes: payload.notes||"",
    updatedAt: new Date().toISOString()
  };
  saveState();
}
function delEntry(dateISO, storeId){
  delete state.entries[keyOf(dateISO, storeId)];
  saveState();
}
function labelHome(){
  const d = homeDate.value;
  return `Fecha: ${d}`;
}

/* ---------- Business calculations ---------- */
function totalOf(e){ return round2((e?.cash||0) + (e?.card||0)); }
function diffTicket(e){ return round2((e?.ticket||0) - totalOf(e)); }
function expectedCash(e){
  return round2((e?.cash||0) - (e?.expenses||0) - (e?.withdrawals||0) + (e?.extraIncome||0));
}
function diffCash(e){
  return round2((e?.cashCounted||0) - expectedCash(e));
}
function flagsForEntry(e){
  const flags=[];
  if(!e) return flags;
  const dt = diffTicket(e);
  const dc = diffCash(e);
  if (Math.abs(dt) > 0.009) flags.push({t:"⚠️ Ticket", v: formatDiff(dt)});
  else flags.push({t:"✅ Ticket", v:"OK"});
  if (Math.abs(dc) > 0.009) flags.push({t:"❌ Caja", v: formatDiff(dc)});
  else flags.push({t:"✅ Caja", v:"OK"});
  return flags;
}

/* ---------- HOME ---------- */
function renderHome(){
  renderHomeCards();
  renderHomeGlobal();
  renderHomeChart7();
}

function computeDayTotals(dateISO){
  const byStore = {};
  let gCash=0,gCard=0,gTicket=0,gTotal=0;
  for(const s of STORES){
    const e = getEntry(dateISO, s.id);
    const cash = e?.cash||0;
    const card = e?.card||0;
    const ticket = e?.ticket||0;
    const total = cash+card;
    byStore[s.id] = { cash, card, ticket, total, e };
    gCash += cash; gCard += card; gTicket += ticket; gTotal += total;
  }
  return {
    byStore,
    global:{
      cash:gCash, card:gCard, ticket:gTicket, total:gTotal,
      diffT: round2(gTicket - gTotal)
    }
  };
}

function renderHomeCards(){
  const dateISO = homeDate.value;
  const t = computeDayTotals(dateISO);

  homeCards.innerHTML = "";
  for(const s of STORES){
    const d = t.byStore[s.id];
    const flags = flagsForEntry(d.e);

    const div = document.createElement("div");
    div.className = "storeCard";
    div.innerHTML = `
      <div class="row space">
        <div class="name">🏪 ${s.name}</div>
        <div class="muted small">${storeShort(s.id)}</div>
      </div>
      <div class="total">${formatMoney(d.total)}</div>
      <div class="sub">💶 ${formatMoney(d.cash)} · 💳 ${formatMoney(d.card)} · 🧾 Ticket ${formatMoney(d.ticket)}</div>
      <div class="row space wrap" style="margin-top:10px">
        <div class="tags">
          ${flags.map(f=>`<div class="tag">${f.t} · ${f.v}</div>`).join("")}
        </div>
        <button class="btn primary" data-open="${s.id}">Entrar</button>
      </div>
    `;
    div.querySelector("[data-open]").addEventListener("click", (ev)=>{
      ev.stopPropagation();
      navToStore(s.id);
    });
    div.addEventListener("click", ()=> navToStore(s.id));
    homeCards.appendChild(div);
  }
}

function navToStore(storeId){
  // set nav active
  navBtns.forEach(b=>b.classList.remove("active"));
  const map = { san_pablo:"sp", san_lesmes:"sl", santiago:"sa" };
  document.querySelector(`.navBtn[data-nav="${map[storeId]}"]`)?.classList.add("active");

  storeDate.value = homeDate.value;
  openStore(storeId);
}

function renderHomeGlobal(){
  const dateISO = homeDate.value;
  const t = computeDayTotals(dateISO).global;
  homeGlobalTotal.textContent = formatMoney(t.total);
  homeGlobalBreak.textContent = `💶 ${formatMoney(t.cash)} · 💳 ${formatMoney(t.card)} · 🧾 Ticket ${formatMoney(t.ticket)} · DifT ${formatDiff(t.diffT)}`;

  homeGlobalFlags.innerHTML = "";
  if (Math.abs(t.diffT) > 0.009) {
    homeGlobalFlags.appendChild(makeTag(`⚠️ Dif ticket`, formatDiff(t.diffT)));
  } else {
    homeGlobalFlags.appendChild(makeTag(`✅ Dif ticket`, "OK"));
  }
}

function renderHomeChart7(){
  const dateISO = homeDate.value;
  const days = [];
  for(let i=6;i>=0;i--) days.push(addDaysISO(dateISO, -i));

  const labels = days.map(d=>d.slice(5));
  const totals = days.map(d=>{
    const t = computeDayTotals(d).global;
    if (homeSeriesMode === "cash") return t.cash;
    if (homeSeriesMode === "card") return t.card;
    return t.total;
  });

  const isLight = document.documentElement.getAttribute("data-theme")==="light";

  if(chartHome7) chartHome7.destroy();
  chartHome7 = new Chart(chartHome7Canvas, {
    type:"line",
    data:{
      labels,
      datasets:[{
        label: homeSeriesMode === "total" ? "Total" : homeSeriesMode === "cash" ? "Efectivo" : "Tarjeta",
        data: totals,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 6,
        fill: true
      }]
    },
    options: chartOptions(isLight, true)
  });
}

/* ---------- STORE ---------- */
function fillStoreEntry(){
  const dateISO = storeDate.value;
  const e = getEntry(dateISO, currentStoreId);

  inCash.value = e ? fmtInput(e.cash) : "";
  inCard.value = e ? fmtInput(e.card) : "";
  inTicket.value = e ? fmtInput(e.ticket) : "";
  inExpenses.value = e ? fmtInput(e.expenses) : "";
  inWithdraw.value = e ? fmtInput(e.withdrawals) : "";
  inExtra.value = e ? fmtInput(e.extraIncome) : "";
  inCounted.value = e ? fmtInput(e.cashCounted) : "";
  inNotes.value = e ? (e.notes||"") : "";

  storeEntryHint.textContent = `${storeDate.value} · ${currentStoreId}`;
  updateStoreBoxes();
  renderStoreFlags(e);
  storeMsg.textContent = "";
  storeMsg.className = "msg";
}

function fmtInput(n){
  const v = Number(n||0);
  return v ? String(v).replace(".", ",") : "";
}

function renderStoreFlags(e){
  storeFlags.innerHTML = "";
  const flags = flagsForEntry(e);
  if (!flags.length){
    storeFlags.appendChild(makeTag("—", "Sin datos"));
    return;
  }
  for(const f of flags) storeFlags.appendChild(makeTag(f.t, f.v));
}

function updateStoreBoxes(){
  const tmp = getEntryFromInputs();
  const dt = round2(tmp.ticket - (tmp.cash + tmp.card));
  boxDiffTicket.textContent = `${formatDiff(dt)}  (Ticket ${formatMoney(tmp.ticket)} - Total ${formatMoney(tmp.cash+tmp.card)})`;

  const exp = round2(tmp.cash - tmp.expenses - tmp.withdrawals + tmp.extraIncome);
  const dc = round2(tmp.cashCounted - exp);
  boxExpected.textContent = `${formatMoney(exp)}`;
  boxDiffCash.textContent = `${formatDiff(dc)}`;
}

function getEntryFromInputs(){
  return {
    cash: round2(parseMoney(inCash.value)),
    card: round2(parseMoney(inCard.value)),
    ticket: round2(parseMoney(inTicket.value)),
    expenses: round2(parseMoney(inExpenses.value)),
    withdrawals: round2(parseMoney(inWithdraw.value)),
    extraIncome: round2(parseMoney(inExtra.value)),
    cashCounted: round2(parseMoney(inCounted.value)),
    notes: (inNotes.value||"").trim()
  };
}

function saveStoreEntry(){
  const dateISO = storeDate.value;
  const payload = getEntryFromInputs();
  setEntry(dateISO, currentStoreId, payload);
  const e = getEntry(dateISO, currentStoreId);

  renderStoreFlags(e);
  storeMsg.className = "msg ok";
  storeMsg.textContent = `Guardado ✅ Total ${formatMoney(totalOf(e))} · DifT ${formatDiff(diffTicket(e))} · DifCaja ${formatDiff(diffCash(e))}`;

  // refresca home/global si el usuario vuelve
  renderStoreKPIsAndCharts();
  renderStoreList();
}

function clearStoreEntry(){
  inCash.value="";
  inCard.value="";
  inTicket.value="";
  inExpenses.value="";
  inWithdraw.value="";
  inExtra.value="";
  inCounted.value="";
  inNotes.value="";
  updateStoreBoxes();
  storeFlags.innerHTML="";
  storeFlags.appendChild(makeTag("—","Sin datos"));
  storeMsg.textContent="";
  storeMsg.className="msg";
}

function deleteStoreEntry(){
  const dateISO = storeDate.value;
  const e = getEntry(dateISO, currentStoreId);
  if(!e){
    storeMsg.className="msg err";
    storeMsg.textContent="No hay registro para borrar.";
    return;
  }
  delEntry(dateISO, currentStoreId);
  fillStoreEntry();
  renderStoreKPIsAndCharts();
  renderStoreList();
  storeMsg.className="msg ok";
  storeMsg.textContent="Borrado ✅";
}

function storeRange(){
  const d = storeDate.value;
  const now = new Date(d+"T00:00:00");
  if(storePeriodMode==="7d"){
    const from = new Date(now); from.setDate(from.getDate()-6);
    return { from: toISODate(from), to: d, label:`${toISODate(from)} → ${d}` };
  }
  if(storePeriodMode==="30d"){
    const from = new Date(now); from.setDate(from.getDate()-29);
    return { from: toISODate(from), to: d, label:`${toISODate(from)} → ${d}` };
  }
  // month
  const from = d.slice(0,7)+"-01";
  const to = d;
  return { from, to, label:`${from} → ${to}` };
}

function renderStoreKPIsAndCharts(){
  const {from,to,label} = storeRange();
  storeRangeLabel.textContent = label;

  const rows = buildDailyRows(currentStoreId, from, to);
  const sum = sumRows(rows);
  const diffT = round2(sum.ticket - sum.total);
  const avg = rows.length ? (sum.total / rows.length) : 0;

  kStoreTotal.textContent = formatMoney(sum.total);
  kStoreCash.textContent = formatMoney(sum.cash);
  kStoreCard.textContent = formatMoney(sum.card);
  kStoreTicket.textContent = formatMoney(sum.ticket);
  kStoreDiff.textContent = formatDiff(diffT);
  kStoreAvg.textContent = formatMoney(avg);

  // charts
  const labels = rows.map(r=>r.date.slice(5));
  const totals = rows.map(r=>r.total);
  const cash = rows.map(r=>r.cash);
  const card = rows.map(r=>r.card);

  const isLight = document.documentElement.getAttribute("data-theme")==="light";

  if(chartStoreTotal) chartStoreTotal.destroy();
  chartStoreTotal = new Chart(chartStoreTotalCanvas, {
    type:"line",
    data:{ labels, datasets:[{
      label:"Total",
      data: totals,
      tension:0.35,
      borderWidth:2,
      pointRadius:3,
      pointHoverRadius:6,
      fill:true
    }]},
    options: chartOptions(isLight, true)
  });

  if(chartStoreMix) chartStoreMix.destroy();
  chartStoreMix = new Chart(chartStoreMixCanvas, {
    type:"bar",
    data:{ labels, datasets:[
      { label:"Efectivo", data: cash, borderWidth:1 },
      { label:"Tarjeta", data: card, borderWidth:1 }
    ]},
    options: chartOptions(isLight, false)
  });
}

function renderStoreList(){
  const {from,to} = storeRange();
  const rows = buildDailyRows(currentStoreId, from, to).slice(-12).reverse(); // últimos 12

  storeTableBody.innerHTML = "";
  for(const r of rows){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td><b>${formatMoney(r.total)}</b></td>
      <td>${formatMoney(r.ticket)}</td>
      <td>${formatDiff(round2(r.ticket - r.total))}</td>
      <td>${formatDiff(r.diffCash)}</td>
    `;
    tr.addEventListener("click", ()=>{
      storeDate.value = r.date;
      fillStoreEntry();
    });
    storeTableBody.appendChild(tr);
  }
}

/* ---------- GLOBAL ---------- */
function globalRange(){
  const today = homeDate.value;
  const now = new Date(today+"T00:00:00");

  if(globalPeriod.value==="7d"){
    const from = new Date(now); from.setDate(from.getDate()-6);
    return { from: toISODate(from), to: today, label:`${toISODate(from)} → ${today}` };
  }
  if(globalPeriod.value==="30d"){
    const from = new Date(now); from.setDate(from.getDate()-29);
    return { from: toISODate(from), to: today, label:`${toISODate(from)} → ${today}` };
  }
  const from = today.slice(0,7)+"-01";
  const to = today;
  return { from, to, label:`${from} → ${to}` };
}

function renderGlobal(){
  const {from,to,label} = globalRange();
  globalRangeLabel.textContent = label;

  const globalRows = buildDailyRows("global", from, to);
  const sum = sumRows(globalRows);
  const diffT = round2(sum.ticket - sum.total);
  const avg = globalRows.length ? (sum.total / globalRows.length) : 0;

  kGTotal.textContent = formatMoney(sum.total);
  kGCash.textContent = formatMoney(sum.cash);
  kGCard.textContent = formatMoney(sum.card);
  kGTicket.textContent = formatMoney(sum.ticket);
  kGDiff.textContent = formatDiff(diffT);
  kGAvg.textContent = formatMoney(avg);

  // bars per store
  const storeTotals = STORES.map(s=>{
    const rows = buildDailyRows(s.id, from, to);
    const ssum = sumRows(rows);
    return { id:s.id, name:s.name, total:ssum.total };
  });

  const isLight = document.documentElement.getAttribute("data-theme")==="light";

  if(chartGlobalBars) chartGlobalBars.destroy();
  chartGlobalBars = new Chart(chartGlobalBarsCanvas, {
    type:"bar",
    data:{
      labels: storeTotals.map(x=>x.name),
      datasets:[{ label:"Total", data: storeTotals.map(x=>x.total), borderWidth:1 }]
    },
    options: chartOptions(isLight, false)
  });

  // global line
  if(chartGlobalLine) chartGlobalLine.destroy();
  chartGlobalLine = new Chart(chartGlobalLineCanvas, {
    type:"line",
    data:{
      labels: globalRows.map(r=>r.date.slice(5)),
      datasets:[{
        label:"Total global",
        data: globalRows.map(r=>r.total),
        tension:0.35,
        borderWidth:2,
        pointRadius:3,
        pointHoverRadius:6,
        fill:true
      }]
    },
    options: chartOptions(isLight, true)
  });

  // ranking
  const ranked = [...storeTotals].sort((a,b)=>b.total-a.total);
  globalRanking.innerHTML = "";
  ranked.forEach((it, idx)=>{
    const div = document.createElement("div");
    div.className = "rankItem";
    div.innerHTML = `<div><b>#${idx+1} ${it.name}</b></div><div>${formatMoney(it.total)}</div>`;
    globalRanking.appendChild(div);
  });
}

/* ---------- Data builder ---------- */
function buildDailyRows(storeId, from, to){
  // devuelve filas por fecha (daily) con cash/card/total/ticket/diffCash
  const days = listDays(from, to);
  const rows = [];

  for(const d of days){
    if(storeId==="global"){
      let cash=0, card=0, total=0, ticket=0, diffC=0;
      for(const s of STORES){
        const e = getEntry(d, s.id);
        if(!e) continue;
        cash += e.cash||0;
        card += e.card||0;
        total += (e.cash||0)+(e.card||0);
        ticket += e.ticket||0;
        diffC += diffCash(e);
      }
      rows.push({ date:d, cash:round2(cash), card:round2(card), total:round2(total), ticket:round2(ticket), diffCash:round2(diffC) });
    } else {
      const e = getEntry(d, storeId);
      const cash = e?.cash||0;
      const card = e?.card||0;
      const total = cash+card;
      const ticket = e?.ticket||0;
      const dc = e ? diffCash(e) : 0;
      rows.push({ date:d, cash:round2(cash), card:round2(card), total:round2(total), ticket:round2(ticket), diffCash:round2(dc) });
    }
  }

  // recorta trailing zeros para gráficos más limpios (pero conserva al menos 2 días)
  const nonEmpty = rows.filter(r=>r.total>0 || r.ticket>0 || r.cash>0 || r.card>0);
  return nonEmpty.length >= 2 ? nonEmpty : rows;
}

function sumRows(rows){
  return rows.reduce((a,r)=>({
    cash: a.cash + r.cash,
    card: a.card + r.card,
    total: a.total + r.total,
    ticket: a.ticket + r.ticket
  }), {cash:0,card:0,total:0,ticket:0});
}

function listDays(from,to){
  const out=[];
  const d1 = new Date(from+"T00:00:00");
  const d2 = new Date(to+"T00:00:00");
  for(let d = new Date(d1); d<=d2; d.setDate(d.getDate()+1)){
    out.push(toISODate(d));
  }
  return out;
}

function addDaysISO(dateISO, days){
  const d = new Date(dateISO+"T00:00:00");
  d.setDate(d.getDate()+days);
  return toISODate(d);
}

/* ---------- Charts options (improved) ---------- */
function chartOptions(isLight, fill){
  const text = isLight ? "#101828" : "#eaf0ff";
  const grid = isLight ? "rgba(16,24,40,.10)" : "rgba(255,255,255,.08)";

  return {
    responsive:true,
    maintainAspectRatio:false,
    plugins:{
      legend:{ labels:{ color:text, font:{ family:"Poppins", weight:"800" } } },
      tooltip:{
        enabled:true,
        callbacks:{
          label:(ctx)=>{
            const v = ctx.parsed.y ?? ctx.parsed;
            return `${ctx.dataset.label}: ${formatMoney(v)}`;
          }
        }
      }
    },
    scales:{
      x:{
        ticks:{ color:text, maxRotation:0, autoSkip:true },
        grid:{ color:grid }
      },
      y:{
        ticks:{
          color:text,
          callback:(v)=> {
            // muestra 0, 500, 1.000...
            return Number(v).toLocaleString("es-ES");
          }
        },
        grid:{ color:grid }
      }
    },
    elements:{
      line:{ fill },
    }
  };
}

/* ---------- WhatsApp texts ---------- */
function buildWhatsAppDayText(dateISO){
  const t = computeDayTotals(dateISO);
  const g = t.global;

  const lines = [];
  lines.push(`📊 *RESUMEN DÍA*`);
  lines.push(`📅 ${dateISO}`);
  lines.push("");
  for(const s of STORES){
    const d = t.byStore[s.id];
    const e = d.e;
    const dt = e ? diffTicket(e) : 0;
    const dc = e ? diffCash(e) : 0;
    lines.push(`🏪 *${s.name}* — Total ${formatMoney(d.total)} (Efe ${formatMoney(d.cash)} · Tar ${formatMoney(d.card)})`);
    lines.push(`🧾 Ticket ${formatMoney(d.ticket)} · DifT ${formatDiff(dt)} · DifCaja ${formatDiff(dc)}`);
    lines.push("");
  }
  lines.push(`🌍 *GLOBAL* — Total ${formatMoney(g.total)} (Efe ${formatMoney(g.cash)} · Tar ${formatMoney(g.card)})`);
  lines.push(`🧾 Ticket ${formatMoney(g.ticket)} · DifT ${formatDiff(g.diffT)}`);
  return lines.join("\n");
}

function buildWhatsAppStoreDayText(storeId, dateISO){
  const e = getEntry(dateISO, storeId);
  const cash = e?.cash||0;
  const card = e?.card||0;
  const total = cash+card;
  const ticket = e?.ticket||0;

  const dt = e ? diffTicket(e) : 0;
  const exp = e ? expectedCash(e) : 0;
  const dc = e ? diffCash(e) : 0;

  return [
    `🏪 *${storeName(storeId)}*`,
    `📅 ${dateISO}`,
    ``,
    `🧾 Total: ${formatMoney(total)}`,
    `💶 Efectivo: ${formatMoney(cash)}`,
    `💳 Tarjeta: ${formatMoney(card)}`,
    `🧾 Ticket: ${formatMoney(ticket)} · DifT: ${formatDiff(dt)}`,
    ``,
    `📦 Caja esperado: ${formatMoney(exp)}`,
    `📦 Caja contado: ${formatMoney(e?.cashCounted||0)}`,
    `❌/✅ Dif caja: ${formatDiff(dc)}`,
    ``,
    e?.notes ? `📝 Obs: ${e.notes}` : `📝 Obs: —`
  ].join("\n");
}

function buildWhatsAppGlobalText(){
  const {from,to,label} = globalRange();
  const rows = buildDailyRows("global", from, to);
  const sum = sumRows(rows);
  const diffT = round2(sum.ticket - sum.total);

  const storeTotals = STORES.map(s=>{
    const r = buildDailyRows(s.id, from, to);
    const ssum = sumRows(r);
    return { name:s.name, total:ssum.total };
  }).sort((a,b)=>b.total-a.total);

  const lines = [];
  lines.push(`🌍 *RENDIMIENTO GLOBAL*`);
  lines.push(`📌 ${label}`);
  lines.push("");
  lines.push(`🧾 Total: ${formatMoney(sum.total)} · Ticket: ${formatMoney(sum.ticket)} · DifT: ${formatDiff(diffT)}`);
  lines.push(`💶 Efe: ${formatMoney(sum.cash)} · 💳 Tar: ${formatMoney(sum.card)}`);
  lines.push("");
  lines.push(`🏆 *Ranking*`);
  storeTotals.forEach((it,i)=> lines.push(`#${i+1} ${it.name}: ${formatMoney(it.total)}`));
  return lines.join("\n");
}

function openWhatsApp(text){
  const url = "https://wa.me/" + WA_PHONE + "?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

/* ---------- UI helpers ---------- */
function makeTag(t,v){
  const d = document.createElement("div");
  d.className = "tag";
  d.textContent = `${t} · ${v}`;
  return d;
}

/* ---------- Export / Import ---------- */
function exportBackup(){
  const payload = {
    meta:{ app:"ARSLAN_SALES_MOBILE_V1", exportedAt:new Date().toISOString() },
    state,
    settings:{ theme: settings.theme, pinHash: settings.pinHash } // no exporta sesión
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:"application/json"});
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
  reader.onload = ()=>{
    try{
      const payload = JSON.parse(reader.result);
      if(!payload?.state?.entries) throw new Error("Formato no válido.");
      state = payload.state;
      saveState();

      // mantiene PIN actual y tema si existe
      if(payload.settings?.theme){
        settings.theme = payload.settings.theme;
        applyTheme(settings.theme);
      }
      saveSettings();

      // refresca vista actual
      if(!viewHome.classList.contains("hidden")) renderHome();
      if(!viewStore.classList.contains("hidden")) { fillStoreEntry(); renderStoreKPIsAndCharts(); renderStoreList(); }
      if(!viewGlobal.classList.contains("hidden")) renderGlobal();

      alert("Importado ✅");
    }catch(e){
      alert("Error importando: " + e.message);
    }finally{
      importFile.value = "";
    }
  };
  reader.readAsText(file);
}

/* ---------- App start content ---------- */
function renderAll(){
  renderHome();
  fillStoreEntry();
  renderStoreKPIsAndCharts();
  renderStoreList();
  renderGlobal();
}

/* ---------- Boot home render ---------- */
function computeDayTotals(dateISO){ // override safe if already defined in scope
  const byStore = {};
  let gCash=0,gCard=0,gTicket=0,gTotal=0;
  for(const s of STORES){
    const e = getEntry(dateISO, s.id);
    const cash = e?.cash||0;
    const card = e?.card||0;
    const ticket = e?.ticket||0;
    const total = cash+card;
    byStore[s.id] = { cash, card, ticket, total, e };
    gCash += cash; gCard += card; gTicket += ticket; gTotal += total;
  }
  return { byStore, global:{ cash:gCash, card:gCard, ticket:gTicket, total:gTotal, diffT: round2(gTicket - gTotal) } };
}
