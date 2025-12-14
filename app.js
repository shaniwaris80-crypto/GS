/* ==========================================================
   FACTURAS + REMESAS SEPA (LOCAL)
   - localStorage: datos (clientes, facturas, remesas, audit)
   - IndexedDB: PDFs
   - PDF.js: lectura de texto
   - Tesseract.js: OCR si PDF escaneado
   - Crear factura desde PDF + extracción automática
   - Búsqueda por texto del PDF
   - XML pain.008 agrupado por SeqTp (FRST/RCUR/OOFF/FNAL)
========================================================== */

const LS_KEY = "INV_SEPA_APP_V2_FULL";

/* ---------- Helpers ---------- */
const uid = () => (crypto?.randomUUID ? crypto.randomUUID() : ("id-" + Math.random().toString(16).slice(2) + Date.now()));
const nowISO = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0,10);

function money(n){
  const x = Number(n || 0);
  return x.toLocaleString("es-ES", { style:"currency", currency:"EUR" });
}

function escXml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&apos;");
}

function normalizeIban(v){
  return String(v||"").toUpperCase().replace(/\s+/g,"").trim();
}

/* IBAN full checksum validation */
function isValidIban(iban){
  const x = normalizeIban(iban);
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(x)) return false;
  // Move first 4 to end
  const rearr = x.slice(4) + x.slice(0,4);
  // Convert letters to numbers A=10..Z=35
  let expanded = "";
  for (const ch of rearr){
    if(ch >= "A" && ch <= "Z") expanded += String(ch.charCodeAt(0) - 55);
    else expanded += ch;
  }
  // mod 97
  let remainder = 0;
  for (let i=0; i<expanded.length; i++){
    const digit = expanded.charCodeAt(i) - 48;
    if (digit < 0 || digit > 9) return false;
    remainder = (remainder * 10 + digit) % 97;
  }
  return remainder === 1;
}

function downloadText(filename, text, mime="application/xml"){
  const blob = new Blob([text], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeLower(s){ return String(s||"").toLowerCase(); }

/* ---------- State ---------- */
function loadState(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw){
    return {
      config: {
        creditorName: "",
        creditorIban: "",
        creditorCI: "",
        creditorBic: "",
        creditorAddr: "",
      },
      clients: [],
      mandates: [],
      invoices: [],
      batches: [],
      batchItems: [],
      audit: [],
    };
  }
  try { return JSON.parse(raw); } catch { return null; }
}

let state = loadState();
if(!state){
  alert("Error leyendo datos locales. Se reiniciará el almacenamiento.");
  localStorage.removeItem(LS_KEY);
  state = loadState();
}

function saveState(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function audit(entity, entityId, action, beforeObj, afterObj){
  state.audit.unshift({
    id: uid(),
    at: nowISO(),
    entity,
    entityId,
    action,
    before: beforeObj ?? null,
    after: afterObj ?? null,
  });
  state.audit = state.audit.slice(0, 500);
  saveState();
}

let selectedClientId = null;
let selectedInvoiceId = null;
let selectedBatchId = null;

/* ==========================================================
   IndexedDB for PDFs
========================================================== */
const PDF_DB = "INVOICE_PDFS_DB";
const PDF_STORE = "pdfs";

function openPdfDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(PDF_DB, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(PDF_STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function savePdfFile(file){
  const db = await openPdfDB();
  const id = uid();
  const tx = db.transaction(PDF_STORE, "readwrite");
  tx.objectStore(PDF_STORE).put({ id, name: file.name, blob: file, created_at: nowISO() });
  return id;
}

async function getPdfFile(id){
  const db = await openPdfDB();
  return new Promise(res=>{
    const tx = db.transaction(PDF_STORE, "readonly");
    const req = tx.objectStore(PDF_STORE).get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => res(null);
  });
}

async function deletePdfFile(id){
  const db = await openPdfDB();
  const tx = db.transaction(PDF_STORE, "readwrite");
  tx.objectStore(PDF_STORE).delete(id);
}

/* ==========================================================
   PDF extraction (PDF.js + OCR fallback)
========================================================== */
async function extractTextFromPdf(blob){
  // pdfjsLib available via CDN
  const buf = await blob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = "";
  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    text += c.items.map(x=>x.str).join(" ") + "\n";
  }
  return text.trim();
}

async function extractTextOCR(blob){
  const r = await Tesseract.recognize(blob, "spa+eng");
  return (r?.data?.text || "").trim();
}

/* Parser mejorado ES */
function parseInvoiceData(text){
  const t = String(text || "");

  const invoiceNo =
    t.match(/(?:N[ºo]\s*Factura|N[ºo]\s*|Factura|Invoice)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/]{2,})/i)?.[1] ||
    t.match(/\b([A-Z]{1,5}-\d{3,}[\w\-\/]*)\b/i)?.[1] ||
    "";

  const date =
    t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)?.[1] ||
    t.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1] ||
    "";

  // Convert date to yyyy-mm-dd if dd/mm/yyyy
  let dateNorm = date;
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(date)){
    const [dd,mm,yyyy] = date.split("/");
    dateNorm = `${yyyy}-${mm}-${dd}`;
  }

  const amountRaw =
    t.match(/(?:TOTAL\s*(?:FACTURA)?|IMPORTE\s*TOTAL|TOTAL\s*A\s*PAGAR)\s*[:€]?\s*([0-9][0-9\.\,]{1,})/i)?.[1] ||
    t.match(/\bTotal\b[^\d]{0,10}([0-9][0-9\.\,]{1,})/i)?.[1] ||
    "";

  let amount = "";
  if(amountRaw){
    // 1.234,56 -> 1234.56 ; 1,234.56 -> 1234.56
    const s = amountRaw.trim();
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");
    let normalized = s;
    if(hasComma && hasDot){
      // assume dot thousands, comma decimals (ES)
      normalized = s.replace(/\./g,"").replace(",",".");
    }else if(hasComma && !hasDot){
      normalized = s.replace(",",".");
    }else{
      // only dot
      normalized = s;
    }
    const n = Number(normalized);
    if(Number.isFinite(n)) amount = Number(n.toFixed(2));
  }

  return {
    invoice_no: invoiceNo,
    date: dateNorm,
    amount
  };
}

function pdfStatusBadge(inv){
  if(!inv.pdf_id) return "";
  const s = inv.extracted?.status || "MANUAL";
  if(s === "OK") return `<span class="badge ok">PDF OK</span>`;
  if(s === "EXTRACTED") return `<span class="badge warn">Extraído</span>`;
  return `<span class="badge">Manual</span>`;
}

/* Attach pdf to existing invoice */
async function attachPdfToInvoice(inv, file){
  const before = structuredClone(inv);
  if(inv.pdf_id){
    // replace old file
    try { await deletePdfFile(inv.pdf_id); } catch {}
  }
  const pdfId = await savePdfFile(file);
  inv.pdf_id = pdfId;
  inv.pdf_name = file.name;
  inv.pdf_text = "";
  inv.extracted = { invoice_no:"", date:"", amount:"", confidence:0, status:"MANUAL" };
  inv.updated_at = nowISO();
  audit("invoice", inv.id, "attach_pdf", before, { pdf_id: inv.pdf_id, pdf_name: inv.pdf_name });
  saveState();
}

/* Create invoice from PDF (auto) */
async function createInvoiceFromPdf(file){
  const pdfId = await savePdfFile(file);
  const inv = {
    id: uid(),
    invoice_no: "",
    invoice_date: today(),
    collection_date: today(),
    tag: "",
    amount: "",
    currency: "EUR",
    client_id: null,
    mandate_id: null,
    status: "PENDING",
    notes: "",
    pdf_id: pdfId,
    pdf_name: file.name,
    pdf_text: "",
    extracted: { invoice_no:"", date:"", amount:"", confidence:0, status:"MANUAL" },
    created_at: nowISO(),
    updated_at: nowISO(),
  };
  state.invoices.unshift(inv);
  audit("invoice", inv.id, "create_from_pdf", null, { pdf_name: file.name });
  saveState();
  await extractAndApplyPdf(inv);
}

/* Extract and apply */
async function extractAndApplyPdf(inv){
  if(!inv.pdf_id) return;
  const pdf = await getPdfFile(inv.pdf_id);
  if(!pdf?.blob) return;

  let text = "";
  try{
    text = await extractTextFromPdf(pdf.blob);
  }catch{
    text = "";
  }
  if((text || "").length < 60){
    try{
      text = await extractTextOCR(pdf.blob);
    }catch{
      text = text || "";
    }
  }

  inv.pdf_text = text || "";
  const data = parseInvoiceData(inv.pdf_text);

  const before = structuredClone(inv);

  if(data.invoice_no) inv.invoice_no = data.invoice_no;
  if(data.date) inv.invoice_date = data.date;
  if(data.amount) inv.amount = data.amount;

  const ok = !!(data.invoice_no && data.amount);
  inv.extracted = {
    ...data,
    confidence: (inv.pdf_text.length > 350 ? 0.9 : (inv.pdf_text.length > 150 ? 0.75 : 0.6)),
    status: ok ? "OK" : "EXTRACTED"
  };
  inv.updated_at = nowISO();

  audit("invoice", inv.id, "pdf_extracted", before, inv.extracted);
  saveState();
}

/* View PDF */
async function viewPdfByInvoice(inv){
  if(!inv.pdf_id) return alert("No hay PDF adjunto.");
  const pdf = await getPdfFile(inv.pdf_id);
  if(!pdf?.blob) return alert("PDF no encontrado en IndexedDB.");
  const url = URL.createObjectURL(pdf.blob);
  window.open(url, "_blank");
}

/* ==========================================================
   Tabs
========================================================== */
const tabs = document.getElementById("tabs");
tabs.addEventListener("click", (e)=>{
  const btn = e.target.closest(".tab");
  if(!btn) return;
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");

  const key = btn.dataset.tab;
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  document.getElementById("tab-"+key).classList.add("active");

  if(key==="reportes") renderReports();
  if(key==="ajustes"){ renderConfig(); renderAudit(); }
});

/* ==========================================================
   CLIENTES
========================================================== */
const clientList = document.getElementById("clientList");
const clientSearch = document.getElementById("clientSearch");
const clientFormWrap = document.getElementById("clientFormWrap");

document.getElementById("btnNewClient").addEventListener("click", ()=>{
  selectedClientId = null;
  renderClientForm({ id:null, name:"", tax_id:"", iban:"", email:"", phone:"" }, null);
});

clientSearch.addEventListener("input", ()=> renderClients());

function renderClients(){
  const q = safeLower(clientSearch.value).trim();
  const rows = state.clients
    .filter(c => !q || safeLower(c.name).includes(q) || safeLower(c.tax_id).includes(q))
    .sort((a,b)=> (a.name||"").localeCompare(b.name||""));

  clientList.innerHTML = rows.map(c=>{
    const active = c.id===selectedClientId ? "active":"";
    const ok = c.iban ? (isValidIban(c.iban) ? "ok":"warn") : "warn";
    const label = c.iban ? (isValidIban(c.iban) ? "IBAN OK" : "IBAN?") : "Sin IBAN";
    return `
      <div class="item ${active}" data-id="${c.id}">
        <div class="top">
          <span>${escXml(c.name||"(sin nombre)")}</span>
          <span class="badge ${ok}">${label}</span>
        </div>
        <div class="sub">${escXml(c.tax_id||"")}${c.tax_id ? " · ":""}${escXml(c.iban||"")}</div>
      </div>
    `;
  }).join("") || `<div class="muted small">No hay clientes.</div>`;

  clientList.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      selectedClientId = el.dataset.id;
      const c = state.clients.find(x=>x.id===selectedClientId);
      const m = state.mandates.find(x=>x.client_id===selectedClientId && x.is_active) || null;
      renderClientForm(c, m);
      renderClients();
    });
  });

  if(selectedClientId){
    const c = state.clients.find(x=>x.id===selectedClientId);
    const m = state.mandates.find(x=>x.client_id===selectedClientId && x.is_active) || null;
    if(c) renderClientForm(c, m);
  }
}

function renderClientForm(client, mandate){
  const c = client || { id:null, name:"", tax_id:"", iban:"", email:"", phone:"" };
  const m = mandate || {
    id:null,
    client_id: c.id,
    scheme:"CORE",
    mandate_id:"",
    signed_at: today(),
    sequence_default:"RCUR",
    is_active:true
  };

  clientFormWrap.innerHTML = `
    <div class="row">
      <div class="field">
        <label>Nombre fiscal</label>
        <input class="input" id="c_name" value="${escXml(c.name||"")}" placeholder="Ej. Restaurante X, S.L." />
      </div>
      <div class="field">
        <label>NIF/CIF (opcional)</label>
        <input class="input" id="c_tax" value="${escXml(c.tax_id||"")}" placeholder="B123..." />
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>IBAN deudor</label>
        <input class="input" id="c_iban" value="${escXml(c.iban||"")}" placeholder="ES..." />
      </div>
      <div class="field">
        <label>Email (opcional)</label>
        <input class="input" id="c_email" value="${escXml(c.email||"")}" placeholder="cliente@email.com" />
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Teléfono (opcional)</label>
        <input class="input" id="c_phone" value="${escXml(c.phone||"")}" placeholder="+34..." />
      </div>
      <div class="field">
        <label>Esquema mandato</label>
        <select class="input" id="m_scheme">
          <option value="CORE" ${m.scheme==="CORE"?"selected":""}>CORE</option>
          <option value="B2B" ${m.scheme==="B2B"?"selected":""}>B2B</option>
        </select>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Mandate ID</label>
        <input class="input" id="m_id" value="${escXml(m.mandate_id||"")}" placeholder="Ej. MND-00001" />
      </div>
      <div class="field">
        <label>Fecha firma mandato</label>
        <input class="input" id="m_signed" type="date" value="${escXml((m.signed_at||today()).slice(0,10))}" />
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Secuencia por defecto</label>
        <select class="input" id="m_seq">
          <option value="FRST" ${m.sequence_default==="FRST"?"selected":""}>FRST (primer cobro)</option>
          <option value="RCUR" ${m.sequence_default==="RCUR"?"selected":""}>RCUR (recurrente)</option>
          <option value="OOFF" ${m.sequence_default==="OOFF"?"selected":""}>OOFF (único)</option>
          <option value="FNAL" ${m.sequence_default==="FNAL"?"selected":""}>FNAL (final)</option>
        </select>
      </div>
      <div class="field">
        <label>Mandato activo</label>
        <select class="input" id="m_active">
          <option value="true" ${m.is_active ? "selected":""}>Sí</option>
          <option value="false" ${!m.is_active ? "selected":""}>No</option>
        </select>
      </div>
    </div>

    <div class="panel-actions" style="margin-top:12px">
      <button class="btn" id="btnSaveClient">${c.id ? "Guardar" : "Crear"}</button>
      ${c.id ? `<button class="btn danger" id="btnDeleteClient">Eliminar</button>` : ``}
    </div>

    <p class="muted small" style="margin-top:10px">
      Consejo: usa Mandate ID estable por cliente. En SEPA es crítico.
    </p>
  `;

  document.getElementById("btnSaveClient").addEventListener("click", ()=>{
    const before = c.id ? structuredClone(state.clients.find(x=>x.id===c.id)) : null;

    const newClient = {
      id: c.id || uid(),
      name: document.getElementById("c_name").value.trim(),
      tax_id: document.getElementById("c_tax").value.trim(),
      iban: normalizeIban(document.getElementById("c_iban").value),
      email: document.getElementById("c_email").value.trim(),
      phone: document.getElementById("c_phone").value.trim(),
      created_at: c.id ? (c.created_at||nowISO()) : nowISO()
    };

    if(!newClient.name) return alert("Falta el nombre del cliente.");
    if(newClient.iban && !isValidIban(newClient.iban)) {
      if(!confirm("El IBAN es inválido (checksum). ¿Guardar igualmente?")) return;
    }

    const idx = state.clients.findIndex(x=>x.id===newClient.id);
    if(idx>=0) state.clients[idx]=newClient;
    else state.clients.unshift(newClient);

    audit("client", newClient.id, idx>=0?"update":"create", before, newClient);

    const mandateObj = {
      id: m.id || uid(),
      client_id: newClient.id,
      scheme: document.getElementById("m_scheme").value,
      mandate_id: document.getElementById("m_id").value.trim(),
      signed_at: document.getElementById("m_signed").value || today(),
      sequence_default: document.getElementById("m_seq").value,
      is_active: document.getElementById("m_active").value === "true",
      created_at: m.id ? (m.created_at||nowISO()) : nowISO()
    };

    if(!mandateObj.mandate_id && mandateObj.is_active){
      if(!confirm("Mandate ID vacío. Muchos bancos lo exigen. ¿Guardar igualmente?")) return;
    }

    // disable other mandates if active
    if(mandateObj.is_active){
      state.mandates.forEach(mm=>{
        if(mm.client_id===newClient.id && mm.id!==mandateObj.id) mm.is_active=false;
      });
    }

    const midx = state.mandates.findIndex(x=>x.id===mandateObj.id);
    const beforeM = midx>=0 ? structuredClone(state.mandates[midx]) : null;
    if(midx>=0) state.mandates[midx]=mandateObj;
    else state.mandates.unshift(mandateObj);

    audit("mandate", mandateObj.id, midx>=0?"update":"create", beforeM, mandateObj);

    saveState();
    selectedClientId = newClient.id;
    renderClients();
    renderInvoices();
    renderBatches();
  });

  const delBtn = document.getElementById("btnDeleteClient");
  if(delBtn){
    delBtn.addEventListener("click", ()=>{
      if(!confirm("¿Eliminar cliente? Mandatos se borran. Facturas quedan sin cliente.")) return;
      const beforeC = structuredClone(state.clients.find(x=>x.id===c.id));
      state.clients = state.clients.filter(x=>x.id!==c.id);
      state.mandates = state.mandates.filter(x=>x.client_id!==c.id);
      audit("client", c.id, "delete", beforeC, null);

      state.invoices.forEach(inv=>{
        if(inv.client_id===c.id){
          const beforeI = structuredClone(inv);
          inv.client_id = null;
          inv.mandate_id = null;
          inv.updated_at = nowISO();
          audit("invoice", inv.id, "update", beforeI, inv);
        }
      });

      saveState();
      selectedClientId = null;
      clientFormWrap.innerHTML = `<div class="muted">Selecciona un cliente o crea uno nuevo.</div>`;
      renderClients();
      renderInvoices();
      renderBatches();
    });
  }
}

/* ==========================================================
   FACTURAS
========================================================== */
const invoiceList = document.getElementById("invoiceList");
const invoiceSearch = document.getElementById("invoiceSearch");
const invoiceStatusFilter = document.getElementById("invoiceStatusFilter");
const invoiceFormWrap = document.getElementById("invoiceFormWrap");

document.getElementById("btnNewInvoice").addEventListener("click", ()=>{
  selectedInvoiceId = null;
  renderInvoiceForm({
    id:null,
    invoice_no:"",
    invoice_date: today(),
    collection_date: today(),
    tag:"",
    amount: "",
    currency:"EUR",
    client_id: selectedClientId || "",
    mandate_id: "",
    status:"PENDING",
    notes:"",
    pdf_id: null,
    pdf_name: null,
    pdf_text: "",
    extracted: { invoice_no:"", date:"", amount:"", confidence:0, status:"MANUAL" }
  });
});

invoiceSearch.addEventListener("input", renderInvoices);
invoiceStatusFilter.addEventListener("change", renderInvoices);

function statusBadge(status){
  switch(status){
    case "PENDING": return {label:"Pendiente", cls:"warn"};
    case "IN_BATCH": return {label:"En remesa", cls:"ok"};
    case "PAID": return {label:"Cobrada", cls:"ok"};
    case "RETURNED": return {label:"Devuelta", cls:"danger"};
    case "CANCELLED": return {label:"Anulada", cls:"danger"};
    default: return {label: status, cls:"badge"};
  }
}

function renderInvoices(){
  const q = safeLower(invoiceSearch.value).trim();
  const st = invoiceStatusFilter.value || "";

  const rows = state.invoices
    .filter(inv => !st || inv.status===st)
    .filter(inv => {
      if(!q) return true;
      const client = state.clients.find(c=>c.id===inv.client_id);
      const hay = [
        inv.invoice_no,
        inv.tag,
        client?.name,
        inv.pdf_name,
        inv.pdf_text
      ].join(" ").toLowerCase();
      return hay.includes(q);
    })
    .sort((a,b)=> (b.invoice_date||"").localeCompare(a.invoice_date||"") || (b.created_at||"").localeCompare(a.created_at||""));

  invoiceList.innerHTML = rows.map(inv=>{
    const active = inv.id===selectedInvoiceId ? "active":"";
    const client = state.clients.find(c=>c.id===inv.client_id);
    const badge = statusBadge(inv.status);
    return `
      <div class="item ${active}" data-id="${inv.id}">
        <div class="top">
          <span>${escXml(inv.invoice_no || "(sin nº)")}</span>
          <div style="display:flex; gap:6px; align-items:center;">
            ${pdfStatusBadge(inv)}
            <span class="badge ${badge.cls}">${badge.label}</span>
          </div>
        </div>
        <div class="sub">${escXml(inv.invoice_date||"")} · ${escXml(inv.tag||"")} · ${escXml(client?.name||"—")} · <b>${money(inv.amount)}</b>${inv.pdf_name ? ` · 📎 ${escXml(inv.pdf_name)}` : ""}</div>
      </div>
    `;
  }).join("") || `<div class="muted small">No hay facturas.</div>`;

  invoiceList.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      selectedInvoiceId = el.dataset.id;
      const inv = state.invoices.find(x=>x.id===selectedInvoiceId);
      if(inv) renderInvoiceForm(inv);
      renderInvoices();
    });
  });

  if(selectedInvoiceId){
    const inv = state.invoices.find(x=>x.id===selectedInvoiceId);
    if(inv) renderInvoiceForm(inv);
  }
}

function renderInvoiceForm(inv){
  const clientOptions = state.clients
    .slice()
    .sort((a,b)=> (a.name||"").localeCompare(b.name||""))
    .map(c=> `<option value="${c.id}" ${c.id===inv.client_id?"selected":""}>${escXml(c.name||"")}</option>`)
    .join("");

  const mandatesForClient = state.mandates
    .filter(m=>m.client_id===inv.client_id)
    .sort((a,b)=> (b.is_active?1:0)-(a.is_active?1:0));

  const mandateOptions = mandatesForClient.map(m=>{
    const label = `${m.mandate_id || "(sin MandateID)"} · ${m.scheme} ${m.is_active ? "· activo":""} · ${m.sequence_default||"RCUR"}`;
    return `<option value="${m.id}" ${m.id===inv.mandate_id?"selected":""}>${escXml(label)}</option>`;
  }).join("");

  invoiceFormWrap.innerHTML = `
    <div class="row">
      <div class="field">
        <label>Nº factura</label>
        <input class="input" id="i_no" value="${escXml(inv.invoice_no||"")}" placeholder="FA-20251212-1200" />
      </div>
      <div class="field">
        <label>Fecha factura</label>
        <input class="input" id="i_date" type="date" value="${escXml((inv.invoice_date||today()).slice(0,10))}" />
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Tag</label>
        <input class="input" id="i_tag" value="${escXml(inv.tag||"")}" placeholder="Ej. Braseros / Obra X / Tienda..." />
      </div>
      <div class="field">
        <label>Importe (€)</label>
        <input class="input" id="i_amount" inputmode="decimal" value="${escXml(inv.amount)}" placeholder="Ej. 120.90" />
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Cliente</label>
        <select class="input" id="i_client">
          <option value="">— Selecciona —</option>
          ${clientOptions}
        </select>
      </div>
      <div class="field">
        <label>Mandato (del cliente)</label>
        <select class="input" id="i_mandate">
          <option value="">— Automático (mandato activo) —</option>
          ${mandateOptions}
        </select>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Fecha de cargo (si va por banco)</label>
        <input class="input" id="i_coll" type="date" value="${escXml((inv.collection_date||today()).slice(0,10))}" />
      </div>
      <div class="field">
        <label>Estado</label>
        <select class="input" id="i_status">
          <option value="PENDING" ${inv.status==="PENDING"?"selected":""}>Pendiente</option>
          <option value="IN_BATCH" ${inv.status==="IN_BATCH"?"selected":""}>En remesa</option>
          <option value="PAID" ${inv.status==="PAID"?"selected":""}>Cobrada</option>
          <option value="RETURNED" ${inv.status==="RETURNED"?"selected":""}>Devuelta</option>
          <option value="CANCELLED" ${inv.status==="CANCELLED"?"selected":""}>Anulada</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label>Notas (opcional)</label>
      <input class="input" id="i_notes" value="${escXml(inv.notes||"")}" placeholder="Observaciones..." />
    </div>

    <div class="sep"></div>

    <div class="field">
      <label>Adjuntar PDF</label>
      <input class="input" type="file" id="i_pdf" accept="application/pdf" />
      <div class="muted small" style="margin-top:6px;">
        ${inv.pdf_name ? `📎 PDF actual: <b>${escXml(inv.pdf_name)}</b> · ${pdfStatusBadge(inv)}` : "No hay PDF adjunto."}
      </div>
    </div>

    <div class="dropzone" id="pdfDrop" style="margin-top:10px;">
      Arrastra aquí el PDF de esta factura
    </div>

    <div class="panel-actions" style="margin-top:12px">
      <button class="btn" id="btnSaveInvoice">${inv.id ? "Guardar" : "Crear"}</button>
      ${inv.id ? `<button class="btn ghost" id="btnExtractPdf" ${inv.pdf_id ? "" : "disabled"}>Extraer datos del PDF</button>` : ``}
      ${inv.id ? `<button class="btn ghost" id="btnViewPdf" ${inv.pdf_id ? "" : "disabled"}>Ver PDF</button>` : ``}
      ${inv.id ? `<button class="btn ghost" id="btnMarkPaid">Marcar cobrada</button>` : ``}
      ${inv.id ? `<button class="btn danger" id="btnDeleteInvoice">Eliminar</button>` : ``}
    </div>

    <div class="sep"></div>
    <div class="field">
      <label>Texto PDF (para búsqueda) — vista rápida</label>
      <textarea class="input mono" rows="6" readonly>${escXml((inv.pdf_text||"").slice(0, 1200))}${(inv.pdf_text||"").length>1200 ? "\n...\n(Recortado)" : ""}</textarea>
      <div class="muted small" style="margin-top:6px;">La búsqueda en Facturas incluye el contenido del PDF.</div>
    </div>
  `;

  document.getElementById("i_client").addEventListener("change", ()=>{
    const updated = structuredClone(inv);
    updated.client_id = document.getElementById("i_client").value;
    updated.mandate_id = "";
    renderInvoiceForm(updated);
  });

  const pdfInput = document.getElementById("i_pdf");
  if(pdfInput){
    pdfInput.addEventListener("change", async (e)=>{
      const file = e.target.files?.[0];
      if(!file) return;
      const realInv = state.invoices.find(x=>x.id===inv.id);
      if(!realInv) return;
      await attachPdfToInvoice(realInv, file);
      await extractAndApplyPdf(realInv);
      renderInvoiceForm(realInv);
      renderInvoices();
    });
  }

  const dz = document.getElementById("pdfDrop");
  if(dz){
    dz.ondragover = (e)=>{ e.preventDefault(); dz.classList.add("drag"); };
    dz.ondragleave = ()=> dz.classList.remove("drag");
    dz.ondrop = async (e)=>{
      e.preventDefault();
      dz.classList.remove("drag");
      const file = [...e.dataTransfer.files].find(f=>f.type==="application/pdf");
      if(!file) return;
      const realInv = state.invoices.find(x=>x.id===inv.id);
      if(!realInv) return;
      await attachPdfToInvoice(realInv, file);
      await extractAndApplyPdf(realInv);
      renderInvoiceForm(realInv);
      renderInvoices();
    };
  }

  const btnExtract = document.getElementById("btnExtractPdf");
  if(btnExtract){
    btnExtract.addEventListener("click", async ()=>{
      const realInv = state.invoices.find(x=>x.id===inv.id);
      if(!realInv) return;
      await extractAndApplyPdf(realInv);
      renderInvoiceForm(realInv);
      renderInvoices();
      alert("Extracción completada. Revisa y guarda si quieres ajustar algo.");
    });
  }

  const btnView = document.getElementById("btnViewPdf");
  if(btnView){
    btnView.addEventListener("click", async ()=>{
      const realInv = state.invoices.find(x=>x.id===inv.id);
      if(!realInv) return;
      await viewPdfByInvoice(realInv);
    });
  }

  document.getElementById("btnSaveInvoice").addEventListener("click", ()=>{
    const before = inv.id ? structuredClone(state.invoices.find(x=>x.id===inv.id)) : null;

    const invoice_no = document.getElementById("i_no").value.trim();
    const amountRaw = String(document.getElementById("i_amount").value).replace(",", ".").trim();
    const amount = Number(amountRaw);

    if(!invoice_no) return alert("Falta Nº factura.");
    if(!Number.isFinite(amount) || amount<=0) return alert("Importe inválido.");

    const dup = state.invoices.find(x=>x.invoice_no===invoice_no && x.id!==inv.id);
    if(dup) return alert("Ya existe una factura con ese Nº.");

    const client_id = document.getElementById("i_client").value || null;
    const mandatePick = document.getElementById("i_mandate").value || null;

    let mandate_id = mandatePick;
    if(client_id && !mandate_id){
      const active = state.mandates.find(m=>m.client_id===client_id && m.is_active);
      mandate_id = active?.id || null;
    }

    const newInv = {
      ...inv,
      id: inv.id || uid(),
      invoice_no,
      invoice_date: document.getElementById("i_date").value || today(),
      collection_date: document.getElementById("i_coll").value || today(),
      tag: document.getElementById("i_tag").value.trim(),
      amount: Number(amount.toFixed(2)),
      currency: "EUR",
      client_id,
      mandate_id,
      status: document.getElementById("i_status").value,
      notes: document.getElementById("i_notes").value.trim(),
      created_at: inv.id ? (inv.created_at||nowISO()) : nowISO(),
      updated_at: nowISO(),
      pdf_id: inv.pdf_id || null,
      pdf_name: inv.pdf_name || null,
      pdf_text: inv.pdf_text || "",
      extracted: inv.extracted || { invoice_no:"", date:"", amount:"", confidence:0, status:"MANUAL" }
    };

    const idx = state.invoices.findIndex(x=>x.id===newInv.id);
    if(idx>=0) state.invoices[idx]=newInv;
    else state.invoices.unshift(newInv);

    // If user manually confirmed fields, upgrade status to OK if has pdf
    if(newInv.pdf_id){
      const ok = !!(newInv.invoice_no && newInv.amount);
      newInv.extracted = newInv.extracted || {};
      newInv.extracted.status = ok ? "OK" : (newInv.extracted.status || "EXTRACTED");
    }

    audit("invoice", newInv.id, idx>=0?"update":"create", before, newInv);

    saveState();
    selectedInvoiceId = newInv.id;
    renderInvoices();
    renderBatches();
  });

  document.getElementById("btnMarkPaid").addEventListener("click", ()=>{
    const i = state.invoices.find(x=>x.id===inv.id);
    if(!i) return;
    const before = structuredClone(i);
    i.status = "PAID";
    i.updated_at = nowISO();
    audit("invoice", i.id, "status_change", before, i);
    saveState();
    renderInvoices();
    renderBatches();
  });

  const delBtn = document.getElementById("btnDeleteInvoice");
  if(delBtn){
    delBtn.addEventListener("click", async ()=>{
      if(!confirm("¿Eliminar factura?")) return;
      const before = structuredClone(state.invoices.find(x=>x.id===inv.id));

      const realInv = state.invoices.find(x=>x.id===inv.id);
      if(realInv?.pdf_id){
        try { await deletePdfFile(realInv.pdf_id); } catch {}
      }

      state.invoices = state.invoices.filter(x=>x.id!==inv.id);
      state.batchItems = state.batchItems.filter(bi=>bi.invoice_id!==inv.id);
      audit("invoice", inv.id, "delete", before, null);

      saveState();
      selectedInvoiceId = null;
      invoiceFormWrap.innerHTML = `<div class="muted">Selecciona una factura o crea una nueva.</div>`;
      renderInvoices();
      renderBatches();
    });
  }
}

/* Bulk upload */
document.getElementById("bulkPdf").addEventListener("change", async (e)=>{
  const files = [...(e.target.files||[])].filter(f => f.type==="application/pdf");
  if(!files.length) return;
  for(const f of files){
    await createInvoiceFromPdf(f);
  }
  renderInvoices();
  e.target.value = "";
});

/* Global dropzone area */
const globalDrop = document.getElementById("globalPdfDrop");
globalDrop.ondragover = (e)=>{ e.preventDefault(); globalDrop.classList.add("drag"); };
globalDrop.ondragleave = ()=> globalDrop.classList.remove("drag");
globalDrop.ondrop = async (e)=>{
  e.preventDefault();
  globalDrop.classList.remove("drag");
  const files = [...e.dataTransfer.files].filter(f => f.type==="application/pdf");
  if(!files.length) return;
  for(const f of files){
    await createInvoiceFromPdf(f);
  }
  renderInvoices();
};

/* Also allow dropping anywhere */
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("drop", async e => {
  // avoid interfering with internal dropzones (handled already)
  const isInside = e.target?.closest?.("#pdfDrop, #globalPdfDrop");
  if(isInside) return;
  e.preventDefault();
  const files = [...e.dataTransfer.files].filter(f => f.type==="application/pdf");
  if(!files.length) return;
  for(const f of files){
    await createInvoiceFromPdf(f);
  }
  renderInvoices();
});

/* ==========================================================
   REMESAS
========================================================== */
const batchList = document.getElementById("batchList");
const batchWrap = document.getElementById("batchWrap");

document.getElementById("btnNewBatch").addEventListener("click", ()=>{
  selectedBatchId = null;
  renderBatchEditor(null);
});

function renderBatches(){
  const rows = state.batches
    .slice()
    .sort((a,b)=> (b.created_at||"").localeCompare(a.created_at||""));

  batchList.innerHTML = rows.map(b=>{
    const active = b.id===selectedBatchId ? "active":"";
    return `
      <div class="item ${active}" data-id="${b.id}">
        <div class="top">
          <span>${escXml(b.batch_no)}</span>
          <span class="badge ok">${escXml(b.scheme)}</span>
        </div>
        <div class="sub">Cargo: ${escXml(b.collection_date)} · Ops: ${b.total_count} · Total: <b>${money(b.total_amount)}</b></div>
      </div>
    `;
  }).join("") || `<div class="muted small">Aún no hay remesas.</div>`;

  batchList.querySelectorAll(".item").forEach(el=>{
    el.addEventListener("click", ()=>{
      selectedBatchId = el.dataset.id;
      renderBatchEditor(selectedBatchId);
      renderBatches();
    });
  });

  if(selectedBatchId) renderBatchEditor(selectedBatchId);
}

function validateInvoicesForBatch(invoices, scheme){
  const probs = [];
  invoices.forEach(inv=>{
    if(inv.status!=="PENDING") probs.push(`${inv.invoice_no}: no está pendiente`);
    const client = state.clients.find(c=>c.id===inv.client_id);
    if(!client) probs.push(`${inv.invoice_no}: sin cliente`);
    else {
      if(!client.iban) probs.push(`${inv.invoice_no}: cliente sin IBAN`);
      else if(!isValidIban(client.iban)) probs.push(`${inv.invoice_no}: IBAN cliente inválido`);
    }
    const mandate = state.mandates.find(m=>m.id===inv.mandate_id);
    if(!mandate) probs.push(`${inv.invoice_no}: sin mandato asociado`);
    else {
      if(!mandate.is_active) probs.push(`${inv.invoice_no}: mandato no activo`);
      if(mandate.scheme !== scheme) probs.push(`${inv.invoice_no}: mandato ${mandate.scheme} pero remesa ${scheme}`);
      if(!mandate.mandate_id) probs.push(`${inv.invoice_no}: mandato sin MandateID`);
      if(!mandate.signed_at) probs.push(`${inv.invoice_no}: mandato sin fecha firma`);
    }
  });
  return probs;
}

function validateBatchReady(batch, invoices){
  const probs = [];
  if(!state.config.creditorName) probs.push("Falta Nombre del acreedor (Ajustes).");
  if(!state.config.creditorIban) probs.push("Falta IBAN del acreedor (Ajustes).");
  if(state.config.creditorIban && !isValidIban(state.config.creditorIban)) probs.push("IBAN del acreedor inválido.");
  if(!state.config.creditorCI) probs.push("Falta Creditor Identifier (CI) (Ajustes).");
  if(!batch.collection_date) probs.push("Falta fecha de cargo.");
  probs.push(...validateInvoicesForBatch(invoices, batch.scheme));
  return probs;
}

function renderBatchEditor(batchId){
  if(!batchId){
    const pending = state.invoices.filter(i=>i.status==="PENDING");
    batchWrap.innerHTML = `
      <div class="row">
        <div class="field">
          <label>Esquema</label>
          <select class="input" id="b_scheme">
            <option value="CORE">CORE</option>
            <option value="B2B">B2B</option>
          </select>
        </div>
        <div class="field">
          <label>Fecha de cargo</label>
          <input class="input" id="b_date" type="date" value="${today()}" />
        </div>
      </div>

      <div class="field">
        <label>Selecciona facturas pendientes</label>
        <div class="list" id="b_inv_pick" style="max-height:300px"></div>
      </div>

      <div class="panel-actions">
        <button class="btn" id="btnCreateBatch">Crear remesa</button>
      </div>

      <p class="muted small">
        Solo aparecen facturas en estado <b>Pendiente</b>.
      </p>
    `;

    const pick = document.getElementById("b_inv_pick");
    pick.innerHTML = pending
      .slice()
      .sort((a,b)=> (a.collection_date||"").localeCompare(b.collection_date||"") || (a.invoice_date||"").localeCompare(b.invoice_date||""))
      .map(inv=>{
        const client = state.clients.find(c=>c.id===inv.client_id);
        return `
          <label class="item" style="cursor:default; display:block">
            <div class="top">
              <span><input type="checkbox" class="chk" data-id="${inv.id}" /> ${escXml(inv.invoice_no||"(sin nº)")}</span>
              <span class="badge warn">${money(inv.amount)}</span>
            </div>
            <div class="sub">${escXml(inv.collection_date||"")} · ${escXml(inv.tag||"")} · ${escXml(client?.name||"—")} ${pdfStatusBadge(inv)}</div>
          </label>
        `;
      }).join("") || `<div class="muted small">No hay facturas pendientes.</div>`;

    document.getElementById("btnCreateBatch").addEventListener("click", ()=>{
      const scheme = document.getElementById("b_scheme").value;
      const collection_date = document.getElementById("b_date").value || today();
      const selected = [...pick.querySelectorAll(".chk:checked")].map(x=>x.dataset.id);

      if(selected.length===0) return alert("Selecciona al menos 1 factura.");

      const invs = selected.map(id => state.invoices.find(i=>i.id===id)).filter(Boolean);
      const problems = validateInvoicesForBatch(invs, scheme);
      if(problems.length){
        alert("No se puede crear la remesa:\n\n- " + problems.join("\n- "));
        return;
      }

      const batch = {
        id: uid(),
        batch_no: `REM-${new Date().toISOString().replace(/[-:]/g,"").slice(0,13)}`,
        scheme,
        collection_date,
        created_at: nowISO(),
        status: "GENERATED",
        total_count: invs.length,
        total_amount: Number(invs.reduce((s,i)=>s+Number(i.amount||0),0).toFixed(2)),
        xml_text: ""
      };
      state.batches.unshift(batch);

      invs.forEach(inv=>{
        const before = structuredClone(inv);
        inv.status = "IN_BATCH";
        inv.updated_at = nowISO();
        audit("invoice", inv.id, "status_change", before, inv);

        state.batchItems.unshift({
          id: uid(),
          batch_id: batch.id,
          invoice_id: inv.id,
          end_to_end_id: inv.invoice_no || inv.id,
          amount: inv.amount
        });
      });

      audit("batch", batch.id, "create", null, batch);

      saveState();
      selectedBatchId = batch.id;
      renderBatches();
      renderBatchEditor(batch.id);
      renderInvoices();
    });

    return;
  }

  const batch = state.batches.find(b=>b.id===batchId);
  if(!batch) return;

  const items = state.batchItems.filter(bi=>bi.batch_id===batch.id);
  const invs = items.map(it => state.invoices.find(i=>i.id===it.invoice_id)).filter(Boolean);

  batchWrap.innerHTML = `
    <div class="row">
      <div class="field">
        <label>ID remesa</label>
        <input class="input" value="${escXml(batch.batch_no)}" disabled />
      </div>
      <div class="field">
        <label>Fecha cargo</label>
        <input class="input" value="${escXml(batch.collection_date)}" disabled />
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Esquema</label>
        <input class="input" value="${escXml(batch.scheme)}" disabled />
      </div>
      <div class="field">
        <label>Totales</label>
        <input class="input" value="Ops: ${batch.total_count} · Total: ${money(batch.total_amount)}" disabled />
      </div>
    </div>

    <div class="field">
      <label>Facturas incluidas</label>
      <div class="list" style="max-height:260px">
        ${invs.map(inv=>{
          const client = state.clients.find(c=>c.id===inv.client_id);
          const mandate = state.mandates.find(m=>m.id===inv.mandate_id);
          return `
            <div class="item" style="cursor:default">
              <div class="top">
                <span>${escXml(inv.invoice_no||"(sin nº)")}</span>
                <span class="badge ok">${money(inv.amount)}</span>
              </div>
              <div class="sub">${escXml(client?.name||"—")} · ${escXml(inv.tag||"")} · cargo ${escXml(inv.collection_date||batch.collection_date)} · Seq ${escXml(mandate?.sequence_default||"RCUR")} ${pdfStatusBadge(inv)}</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <div class="panel-actions">
      <button class="btn" id="btnGenXml">Generar XML (pain.008)</button>
      <button class="btn ghost" id="btnDownloadXml" ${batch.xml_text ? "" : "disabled"}>Descargar XML</button>
      <button class="btn danger" id="btnDeleteBatch">Eliminar remesa</button>
    </div>

    <div class="sep"></div>
    <div class="field">
      <label>Vista XML (solo lectura)</label>
      <textarea class="input mono" id="xmlView" rows="10" readonly>${escXml(batch.xml_text||"")}</textarea>
    </div>
  `;

  document.getElementById("btnGenXml").addEventListener("click", ()=>{
    const problems = validateBatchReady(batch, invs);
    if(problems.length){
      alert("No se puede generar XML:\n\n- " + problems.join("\n- "));
      return;
    }

    const xml = buildPain008(batch, invs);
    const before = structuredClone(batch);
    batch.xml_text = xml;
    audit("batch", batch.id, "update", before, batch);
    saveState();
    renderBatchEditor(batch.id);
    renderBatches();
  });

  document.getElementById("btnDownloadXml").addEventListener("click", ()=>{
    if(!batch.xml_text) return;
    downloadText(`${batch.batch_no}.xml`, batch.xml_text, "application/xml");
  });

  document.getElementById("btnDeleteBatch").addEventListener("click", ()=>{
    if(!confirm("¿Eliminar remesa? Las facturas volverán a Pendiente.")) return;

    const invIds = state.batchItems.filter(x=>x.batch_id===batch.id).map(x=>x.invoice_id);
    invIds.forEach(id=>{
      const inv = state.invoices.find(i=>i.id===id);
      if(inv && inv.status==="IN_BATCH"){
        const before = structuredClone(inv);
        inv.status = "PENDING";
        inv.updated_at = nowISO();
        audit("invoice", inv.id, "status_change", before, inv);
      }
    });

    const beforeB = structuredClone(batch);
    state.batches = state.batches.filter(b=>b.id!==batch.id);
    state.batchItems = state.batchItems.filter(bi=>bi.batch_id!==batch.id);
    audit("batch", batch.id, "delete", beforeB, null);

    saveState();
    selectedBatchId = null;
    batchWrap.innerHTML = `<div class="muted">Crea una remesa para generar el XML.</div>`;
    renderBatches();
    renderInvoices();
  });
}

/* ---------- pain.008 builder (group by SeqTp) ---------- */
function buildPain008(batch, invoices){
  const cfg = state.config;

  const msgId = batch.batch_no;
  const creDtTm = new Date().toISOString().slice(0,19);
  const reqCollDt = batch.collection_date;

  const cdtrNm = cfg.creditorName;
  const cdtrIban = normalizeIban(cfg.creditorIban);
  const cdtrCI = cfg.creditorCI;
  const cdtrBic = (cfg.creditorBic||"").trim();
  const lclInstrm = batch.scheme === "B2B" ? "B2B" : "CORE";

  const groups = new Map(); // seqTp -> invoices[]
  for(const inv of invoices){
    const mandate = state.mandates.find(m=>m.id===inv.mandate_id);
    const seq = mandate?.sequence_default || "RCUR";
    if(!groups.has(seq)) groups.set(seq, []);
    groups.get(seq).push(inv);
  }

  const allNbTxs = String(invoices.length);
  const allCtrlSum = Number(invoices.reduce((s,i)=>s+Number(i.amount||0),0)).toFixed(2);

  const cdtrAgt = cdtrBic ? `
      <CdtrAgt><FinInstnId><BIC>${escXml(cdtrBic)}</BIC></FinInstnId></CdtrAgt>
  `.trim() : `
      <CdtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></CdtrAgt>
  `.trim();

  const pmtInfos = [...groups.entries()].map(([seqTp, invs], idx)=>{
    const nbTxs = String(invs.length);
    const ctrlSum = Number(invs.reduce((s,i)=>s+Number(i.amount||0),0)).toFixed(2);
    const pmtInfId = `PMT-${msgId}-${seqTp}-${idx+1}`;

    const txs = invs.map(inv=>{
      const client = state.clients.find(c=>c.id===inv.client_id);
      const mandate = state.mandates.find(m=>m.id===inv.mandate_id);

      const dbtrNm = client?.name || "";
      const dbtrIban = normalizeIban(client?.iban || "");
      const mndtId = mandate?.mandate_id || "";
      const dtOfSgntr = (mandate?.signed_at || today()).slice(0,10);

      const endToEndId = inv.invoice_no || inv.id;
      const ustrd = `Factura ${inv.invoice_no || inv.id}${inv.tag ? " | "+inv.tag : ""}`;

      return `
        <DrctDbtTxInf>
          <PmtId><EndToEndId>${escXml(endToEndId)}</EndToEndId></PmtId>
          <InstdAmt Ccy="EUR">${Number(inv.amount).toFixed(2)}</InstdAmt>
          <DrctDbtTx>
            <MndtRltdInf>
              <MndtId>${escXml(mndtId)}</MndtId>
              <DtOfSgntr>${escXml(dtOfSgntr)}</DtOfSgntr>
              <AmdmntInd>false</AmdmntInd>
            </MndtRltdInf>
          </DrctDbtTx>
          <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>
          <Dbtr><Nm>${escXml(dbtrNm)}</Nm></Dbtr>
          <DbtrAcct><Id><IBAN>${escXml(dbtrIban)}</IBAN></Id></DbtrAcct>
          <RmtInf><Ustrd>${escXml(ustrd)}</Ustrd></RmtInf>
        </DrctDbtTxInf>
      `.trim();
    }).join("\n");

    return `
      <PmtInf>
        <PmtInfId>${escXml(pmtInfId)}</PmtInfId>
        <PmtMtd>DD</PmtMtd>
        <NbOfTxs>${escXml(nbTxs)}</NbOfTxs>
        <CtrlSum>${escXml(ctrlSum)}</CtrlSum>
        <PmtTpInf>
          <SvcLvl><Cd>SEPA</Cd></SvcLvl>
          <LclInstrm><Cd>${escXml(lclInstrm)}</Cd></LclInstrm>
          <SeqTp>${escXml(seqTp)}</SeqTp>
        </PmtTpInf>
        <ReqdColltnDt>${escXml(reqCollDt)}</ReqdColltnDt>
        <Cdtr><Nm>${escXml(cdtrNm)}</Nm></Cdtr>
        ${cdtrAgt}
        <CdtrAcct><Id><IBAN>${escXml(cdtrIban)}</IBAN></Id></CdtrAcct>
        <CdtrSchmeId>
          <Id>
            <PrvtId>
              <Othr>
                <Id>${escXml(cdtrCI)}</Id>
                <SchmeNm><Prtry>SEPA</Prtry></SchmeNm>
              </Othr>
            </PrvtId>
          </Id>
        </CdtrSchmeId>
        ${txs}
      </PmtInf>
    `.trim();
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escXml(msgId)}</MsgId>
      <CreDtTm>${escXml(creDtTm)}</CreDtTm>
      <NbOfTxs>${escXml(allNbTxs)}</NbOfTxs>
      <CtrlSum>${escXml(allCtrlSum)}</CtrlSum>
      <InitgPty><Nm>${escXml(cdtrNm)}</Nm></InitgPty>
    </GrpHdr>
    ${pmtInfos}
  </CstmrDrctDbtInitn>
</Document>`.trim();
}

/* ==========================================================
   REPORTES
========================================================== */
document.getElementById("btnRefreshReports").addEventListener("click", renderReports);

function renderReports(){
  const pending = state.invoices.filter(i=>i.status==="PENDING");
  const inBatch = state.invoices.filter(i=>i.status==="IN_BATCH");
  const paid = state.invoices.filter(i=>i.status==="PAID");
  const returned = state.invoices.filter(i=>i.status==="RETURNED");

  const sum = arr => Number(arr.reduce((s,i)=>s+Number(i.amount||0),0).toFixed(2));

  document.getElementById("kpis").innerHTML = `
    <div class="kpi"><div class="label">Pendiente</div><div class="value">${money(sum(pending))}</div></div>
    <div class="kpi"><div class="label">En remesa</div><div class="value">${money(sum(inBatch))}</div></div>
    <div class="kpi"><div class="label">Cobrada</div><div class="value">${money(sum(paid))}</div></div>
    <div class="kpi"><div class="label">Devuelta</div><div class="value">${money(sum(returned))}</div></div>
  `;

  const byTag = new Map();
  pending.forEach(i=>{
    const k = (i.tag||"(sin tag)").trim() || "(sin tag)";
    byTag.set(k, (byTag.get(k)||0) + Number(i.amount||0));
  });
  const tagRows = [...byTag.entries()].sort((a,b)=>b[1]-a[1]);
  document.getElementById("byTag").innerHTML = tagRows.map(([k,v])=>`
    <div class="item" style="cursor:default">
      <div class="top"><span>${escXml(k)}</span><span class="badge warn">${money(v)}</span></div>
    </div>
  `).join("") || `<div class="muted small">Sin datos.</div>`;

  const todayD = new Date(today());
  const buckets = [
    {name:"0–7 días", min:0, max:7, total:0},
    {name:"8–30 días", min:8, max:30, total:0},
    {name:"31–60 días", min:31, max:60, total:0},
    {name:"+60 días", min:61, max:99999, total:0},
  ];
  pending.forEach(i=>{
    const d = new Date(i.invoice_date || today());
    const days = Math.floor((todayD - d) / (1000*60*60*24));
    const b = buckets.find(x=>days>=x.min && days<=x.max);
    if(b) b.total += Number(i.amount||0);
  });
  document.getElementById("aging").innerHTML = buckets.map(b=>`
    <div class="item" style="cursor:default">
      <div class="top"><span>${escXml(b.name)}</span><span class="badge warn">${money(b.total)}</span></div>
    </div>
  `).join("");
}

/* ==========================================================
   AJUSTES + BACKUP
========================================================== */
document.getElementById("btnSaveConfig").addEventListener("click", ()=>{
  const before = structuredClone(state.config);

  state.config.creditorName = document.getElementById("cfgCreditorName").value.trim();
  state.config.creditorIban = normalizeIban(document.getElementById("cfgCreditorIban").value);
  state.config.creditorCI = document.getElementById("cfgCreditorCI").value.trim();
  state.config.creditorBic = document.getElementById("cfgCreditorBic").value.trim();
  state.config.creditorAddr = document.getElementById("cfgCreditorAddr").value.trim();

  audit("config", "global", "update", before, structuredClone(state.config));
  saveState();

  if(state.config.creditorIban && !isValidIban(state.config.creditorIban)){
    alert("Ajustes guardados. OJO: IBAN acreedor inválido (checksum).");
  } else {
    alert("Ajustes guardados.");
  }
});

function renderConfig(){
  document.getElementById("cfgCreditorName").value = state.config.creditorName || "";
  document.getElementById("cfgCreditorIban").value = state.config.creditorIban || "";
  document.getElementById("cfgCreditorCI").value = state.config.creditorCI || "";
  document.getElementById("cfgCreditorBic").value = state.config.creditorBic || "";
  document.getElementById("cfgCreditorAddr").value = state.config.creditorAddr || "";
}

document.getElementById("btnExport").addEventListener("click", ()=>{
  const payload = {
    exported_at: nowISO(),
    app: "INV-SEPA-LOCAL-V2-FULL",
    data: state
  };
  downloadText(`backup-facturas-sepa-${today()}.json`, JSON.stringify(payload, null, 2), "application/json");
});

document.getElementById("importFile").addEventListener("change", async (e)=>{
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const txt = await file.text();
    const json = JSON.parse(txt);
    const data = json.data || json;
    if(!data || !data.invoices || !data.clients) throw new Error("Formato inválido");
    if(!confirm("¿Importar backup? Esto reemplaza tus datos actuales.")) return;

    const before = structuredClone(state);
    state = data;
    audit("system", "import", "import_backup", before, { imported_at: nowISO() });
    saveState();
    selectedClientId = null;
    selectedInvoiceId = null;
    selectedBatchId = null;
    initRender();
    alert("Backup importado.");
  }catch(err){
    alert("Error importando backup: " + err.message);
  }finally{
    e.target.value = "";
  }
});

document.getElementById("btnReset").addEventListener("click", ()=>{
  if(!confirm("¿Seguro? Esto borra TODO del navegador (datos + PDFs).")) return;
  localStorage.removeItem(LS_KEY);
  // también borrar PDF DB (opcional)
  try { indexedDB.deleteDatabase(PDF_DB); } catch {}
  location.reload();
});

function renderAudit(){
  const wrap = document.getElementById("auditList");
  const rows = state.audit.slice(0, 80);
  wrap.innerHTML = rows.map(a=>`
    <div class="item" style="cursor:default">
      <div class="top">
        <span>${escXml(a.entity)} · ${escXml(a.action)}</span>
        <span class="badge">${new Date(a.at).toLocaleString("es-ES")}</span>
      </div>
      <div class="sub">${escXml(a.entityId || "")}</div>
    </div>
  `).join("") || `<div class="muted small">Sin eventos aún.</div>`;
}

/* ==========================================================
   INIT
========================================================== */
function initRender(){
  renderConfig();
  renderClients();
  renderInvoices();
  renderBatches();
  renderReports();
  renderAudit();
}

initRender();
