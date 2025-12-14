/* =========================
   Facturas + Remesas SEPA (Local)
   - localStorage
   - Backup/restore JSON
   - XML pain.008 básico (ISO 20022)
========================= */

const LS_KEY = "INV_SEPA_APP_V1";

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
function isValidIban(iban){
  // Validación básica (formato). Se puede mejorar con checksum.
  const x = normalizeIban(iban);
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(x);
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
  state.audit = state.audit.slice(0, 400); // límite
  saveState();
}

let state = loadState();
if(!state){
  alert("Error leyendo datos locales. Se reiniciará el almacenamiento.");
  localStorage.removeItem(LS_KEY);
  state = loadState();
}

let selectedClientId = null;
let selectedInvoiceId = null;
let selectedBatchId = null;

/* =========================
   Tabs
========================= */
const tabs = document.getElementById("tabs");
tabs.addEventListener("click", (e)=>{
  const btn = e.target.closest(".tab");
  if(!btn) return;
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");

  const key = btn.dataset.tab;
  document.querySelectorAll(".panel").forEach(p=>p.classList.remove("active"));
  document.getElementById("tab-"+key).classList.add("active");
  // render puntual
  if(key==="reportes") renderReports();
  if(key==="ajustes") renderAudit();
});

/* =========================
   CLIENTES
========================= */
const clientList = document.getElementById("clientList");
const clientSearch = document.getElementById("clientSearch");
const clientFormWrap = document.getElementById("clientFormWrap");

document.getElementById("btnNewClient").addEventListener("click", ()=>{
  selectedClientId = null;
  renderClientForm({ id:null, name:"", tax_id:"", iban:"", email:"", phone:"" }, null);
});

clientSearch.addEventListener("input", ()=> renderClients());

function renderClients(){
  const q = (clientSearch.value||"").toLowerCase().trim();
  const rows = state.clients
    .filter(c => !q || (c.name||"").toLowerCase().includes(q) || (c.tax_id||"").toLowerCase().includes(q))
    .sort((a,b)=> (a.name||"").localeCompare(b.name||""));

  clientList.innerHTML = rows.map(c=>{
    const active = c.id===selectedClientId ? "active":"";
    const ok = isValidIban(c.iban) ? "ok":"warn";
    return `
      <div class="item ${active}" data-id="${c.id}">
        <div class="top">
          <span>${escXml(c.name||"(sin nombre)")}</span>
          <span class="badge ${ok}">${isValidIban(c.iban) ? "IBAN OK" : "IBAN?"}</span>
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

  // si seleccionado existe
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
        <label>Mandato activo</label>
        <select class="input" id="m_scheme">
          <option value="CORE" ${m.scheme==="CORE"?"selected":""}>CORE</option>
          <option value="B2B" ${m.scheme==="B2B"?"selected":""}>B2B</option>
        </select>
      </div>
    </div>

    <div class="row">
      <div class="field">
        <label>Mandate ID</label>
        <input class="input" id="m_id" value="${escXml(m.mandate_id||"")}" placeholder="Ej. MND-${c.id ? c.id.slice(0,6):"000001"}" />
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
      Consejo: guarda un Mandate ID estable por cliente. Si el banco lo valida, evita rechazos.
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
      if(!confirm("El IBAN parece inválido. ¿Guardar igualmente?")) return;
    }

    // upsert
    const idx = state.clients.findIndex(x=>x.id===newClient.id);
    if(idx>=0) state.clients[idx]=newClient;
    else state.clients.unshift(newClient);

    audit("client", newClient.id, idx>=0?"update":"create", before, newClient);

    // mandato (activo)
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

    // desactivar otros mandatos del cliente si este queda activo
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
    renderInvoices(); // por si cambia nombre en listas
    renderBatches();
  });

  const delBtn = document.getElementById("btnDeleteClient");
  if(delBtn){
    delBtn.addEventListener("click", ()=>{
      if(!confirm("¿Eliminar cliente? También se perderán sus mandatos. (Facturas quedan, pero sin cliente)")) return;
      const beforeC = structuredClone(state.clients.find(x=>x.id===c.id));
      state.clients = state.clients.filter(x=>x.id!==c.id);
      state.mandates = state.mandates.filter(x=>x.client_id!==c.id);
      audit("client", c.id, "delete", beforeC, null);

      // desenlazar facturas
      state.invoices.forEach(inv=>{
        if(inv.client_id===c.id){
          const beforeI = structuredClone(inv);
          inv.client_id = null;
          inv.mandate_id = null;
          audit("invoice", inv.id, "update", beforeI, inv);
        }
      });

      saveState();
      selectedClientId = null;
      clientFormWrap.innerHTML = `<div class="muted">Selecciona un cliente o crea uno nuevo.</div>`;
      renderClients();
      renderInvoices();
    });
  }
}

/* =========================
   FACTURAS
========================= */
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
    notes:""
  });
});

invoiceSearch.addEventListener("input", renderInvoices);
invoiceStatusFilter.addEventListener("change", renderInvoices);

function renderInvoices(){
  const q = (invoiceSearch.value||"").toLowerCase().trim();
  const st = invoiceStatusFilter.value || "";
  const rows = state.invoices
    .filter(inv => !st || inv.status===st)
    .filter(inv => {
      if(!q) return true;
      const client = state.clients.find(c=>c.id===inv.client_id);
      const s = [
        inv.invoice_no,
        inv.tag,
        client?.name
      ].join(" ").toLowerCase();
      return s.includes(q);
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
          <span class="badge ${badge.cls}">${badge.label}</span>
        </div>
        <div class="sub">${escXml(inv.invoice_date||"")} · ${escXml(inv.tag||"")} · ${escXml(client?.name||"—")} · <b>${money(inv.amount)}</b></div>
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

function renderInvoiceForm(inv){
  const clientOptions = state.clients
    .slice()
    .sort((a,b)=> (a.name||"").localeCompare(b.name||""))
    .map(c=> `<option value="${c.id}" ${c.id===inv.client_id?"selected":""}>${escXml(c.name||"")}</option>`)
    .join("");

  const mandatesForClient = state.mandates.filter(m=>m.client_id===inv.client_id).sort((a,b)=> (b.is_active?1:0)-(a.is_active?1:0));
  const mandateOptions = mandatesForClient.map(m=>{
    const label = `${m.mandate_id || "(sin MandateID)"} · ${m.scheme} ${m.is_active ? "· activo":""}`;
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

    <div class="panel-actions" style="margin-top:12px">
      <button class="btn" id="btnSaveInvoice">${inv.id ? "Guardar" : "Crear"}</button>
      ${inv.id ? `<button class="btn ghost" id="btnMarkPaid">Marcar cobrada</button>` : ``}
      ${inv.id ? `<button class="btn danger" id="btnDeleteInvoice">Eliminar</button>` : ``}
    </div>

    <p class="muted small" style="margin-top:10px">
      Recomendado: usa Nº factura como EndToEndId en SEPA para trazabilidad.
    </p>
  `;

  document.getElementById("i_client").addEventListener("change", ()=>{
    // re-render para refrescar mandatos
    const updated = structuredClone(inv);
    updated.client_id = document.getElementById("i_client").value;
    updated.mandate_id = "";
    renderInvoiceForm(updated);
  });

  document.getElementById("btnSaveInvoice").addEventListener("click", ()=>{
    const before = inv.id ? structuredClone(state.invoices.find(x=>x.id===inv.id)) : null;

    const invoice_no = document.getElementById("i_no").value.trim();
    const amountRaw = String(document.getElementById("i_amount").value).replace(",", ".").trim();
    const amount = Number(amountRaw);

    if(!invoice_no) return alert("Falta Nº factura.");
    if(!Number.isFinite(amount) || amount<=0) return alert("Importe inválido.");
    // unique invoice_no
    const dup = state.invoices.find(x=>x.invoice_no===invoice_no && x.id!==inv.id);
    if(dup) return alert("Ya existe una factura con ese Nº.");

    const client_id = document.getElementById("i_client").value || null;
    const mandatePick = document.getElementById("i_mandate").value || null;

    // si no eligió mandato, usar activo del cliente
    let mandate_id = mandatePick;
    if(client_id && !mandate_id){
      const active = state.mandates.find(m=>m.client_id===client_id && m.is_active);
      mandate_id = active?.id || null;
    }

    const newInv = {
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
    };

    const idx = state.invoices.findIndex(x=>x.id===newInv.id);
    if(idx>=0) state.invoices[idx]=newInv;
    else state.invoices.unshift(newInv);

    audit("invoice", newInv.id, idx>=0?"update":"create", before, newInv);

    saveState();
    selectedInvoiceId = newInv.id;
    renderInvoices();
    renderBatches();
  });

  const btnPaid = document.getElementById("btnMarkPaid");
  if(btnPaid){
    btnPaid.addEventListener("click", ()=>{
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
  }

  const delBtn = document.getElementById("btnDeleteInvoice");
  if(delBtn){
    delBtn.addEventListener("click", ()=>{
      if(!confirm("¿Eliminar factura?")) return;
      const before = structuredClone(state.invoices.find(x=>x.id===inv.id));
      state.invoices = state.invoices.filter(x=>x.id!==inv.id);
      // quitar de batchItems
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

/* =========================
   REMESAS
========================= */
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

  if(selectedBatchId){
    renderBatchEditor(selectedBatchId);
  }
}

function renderBatchEditor(batchId){
  if(!batchId){
    // crear remesa
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
        Solo aparecen facturas en estado <b>Pendiente</b>. Al crear remesa pasan a <b>En remesa</b>.
      </p>
    `;

    const pick = document.getElementById("b_inv_pick");
    const items = pending
      .slice()
      .sort((a,b)=> (a.collection_date||"").localeCompare(b.collection_date||"") || (a.invoice_date||"").localeCompare(b.invoice_date||""))
      .map(inv=>{
        const client = state.clients.find(c=>c.id===inv.client_id);
        return `
          <label class="item" style="cursor:default; display:block">
            <div class="top">
              <span><input type="checkbox" class="chk" data-id="${inv.id}" /> ${escXml(inv.invoice_no)}</span>
              <span class="badge warn">${money(inv.amount)}</span>
            </div>
            <div class="sub">${escXml(inv.collection_date||"")} · ${escXml(inv.tag||"")} · ${escXml(client?.name||"—")}</div>
          </label>
        `;
      }).join("");
    pick.innerHTML = items || `<div class="muted small">No hay facturas pendientes.</div>`;

    document.getElementById("btnCreateBatch").addEventListener("click", ()=>{
      const scheme = document.getElementById("b_scheme").value;
      const collection_date = document.getElementById("b_date").value || today();
      const selected = [...pick.querySelectorAll(".chk:checked")].map(x=>x.dataset.id);

      if(selected.length===0) return alert("Selecciona al menos 1 factura.");

      // validar facturas
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

      // add items + update invoice status
      invs.forEach(inv=>{
        const before = structuredClone(inv);
        inv.status = "IN_BATCH";
        inv.updated_at = nowISO();
        audit("invoice", inv.id, "status_change", before, inv);

        state.batchItems.unshift({
          id: uid(),
          batch_id: batch.id,
          invoice_id: inv.id,
          end_to_end_id: inv.invoice_no,
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
          return `
            <div class="item" style="cursor:default">
              <div class="top">
                <span>${escXml(inv.invoice_no)}</span>
                <span class="badge ok">${money(inv.amount)}</span>
              </div>
              <div class="sub">${escXml(client?.name||"—")} · ${escXml(inv.tag||"")} · cargo ${escXml(inv.collection_date||batch.collection_date)}</div>
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
      <textarea class="input" id="xmlView" rows="10" style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;" readonly>${escXml(batch.xml_text||"")}</textarea>
    </div>

    <p class="muted small">
      Si tu banco pide campos extra (versión exacta, IDs, BIC obligatorio, etc.), lo adaptamos cuando me des tus datos.
    </p>
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

    // revert invoices
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
    if(!mandate) probs.push(`${inv.invoice_no}: sin mandato asociado (crea/activa un mandato)`);
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
  // validar facturas contra batch.scheme
  probs.push(...validateInvoicesForBatch(invoices, batch.scheme));
  return probs;
}

/* =========================
   PAIN.008 (XML)
   - Versión base "pain.008.001.02" (muy común)
   - Puede requerir ajustes por banco
========================= */
function buildPain008(batch, invoices){
  const cfg = state.config;

  const msgId = batch.batch_no;
  const creDtTm = new Date().toISOString().slice(0,19);
  const nbTxs = String(invoices.length);
  const ctrlSum = Number(invoices.reduce((s,i)=>s+Number(i.amount||0),0)).toFixed(2);
  const reqCollDt = batch.collection_date;

  // Creditor info
  const cdtrNm = cfg.creditorName;
  const cdtrIban = normalizeIban(cfg.creditorIban);
  const cdtrCI = cfg.creditorCI;
  const cdtrBic = (cfg.creditorBic||"").trim();
  const pmtInfId = `PMT-${msgId}`;

  // Sequence type por factura: por defecto la del mandato
  // Si quieres lógica FRST/RCUR automática por histórico, lo hacemos luego.
  const txs = invoices.map(inv=>{
    const client = state.clients.find(c=>c.id===inv.client_id);
    const mandate = state.mandates.find(m=>m.id===inv.mandate_id);

    const dbtrNm = client?.name || "";
    const dbtrIban = normalizeIban(client?.iban || "");
    const mndtId = mandate?.mandate_id || "";
    const dtOfSgntr = (mandate?.signed_at || today()).slice(0,10);
    const seqTp = mandate?.sequence_default || "RCUR";

    const endToEndId = inv.invoice_no;
    const ustrd = `Factura ${inv.invoice_no}${inv.tag ? " | "+inv.tag : ""}`;

    return `
      <DrctDbtTxInf>
        <PmtId>
          <EndToEndId>${escXml(endToEndId)}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="EUR">${Number(inv.amount).toFixed(2)}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>${escXml(mndtId)}</MndtId>
            <DtOfSgntr>${escXml(dtOfSgntr)}</DtOfSgntr>
            <AmdmntInd>false</AmdmntInd>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <Othr><Id>NOTPROVIDED</Id></Othr>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${escXml(dbtrNm)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id><IBAN>${escXml(dbtrIban)}</IBAN></Id>
        </DbtrAcct>
        <Purp><Prtry>GDDS</Prtry></Purp>
        <RmtInf><Ustrd>${escXml(ustrd)}</Ustrd></RmtInf>
        <PmtTpInf>
          <SvcLvl><Cd>SEPA</Cd></SvcLvl>
          <LclInstrm><Cd>CORE</Cd></LclInstrm>
          <SeqTp>${escXml(seqTp)}</SeqTp>
        </PmtTpInf>
      </DrctDbtTxInf>
    `.trim();
  }).join("\n");

  // Nota: Aquí el LclInstrm está como CORE. Si batch.scheme=B2B, lo ponemos B2B.
  const lclInstrm = batch.scheme === "B2B" ? "B2B" : "CORE";

  // Si el banco exige BIC del acreedor, metemos CdtrAgt/BIC
  const cdtrAgt = cdtrBic ? `
    <CdtrAgt>
      <FinInstnId><BIC>${escXml(cdtrBic)}</BIC></FinInstnId>
    </CdtrAgt>
  `.trim() : `
    <CdtrAgt>
      <FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>
    </CdtrAgt>
  `.trim();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escXml(msgId)}</MsgId>
      <CreDtTm>${escXml(creDtTm)}</CreDtTm>
      <NbOfTxs>${escXml(nbTxs)}</NbOfTxs>
      <CtrlSum>${escXml(ctrlSum)}</CtrlSum>
      <InitgPty>
        <Nm>${escXml(cdtrNm)}</Nm>
      </InitgPty>
    </GrpHdr>

    <PmtInf>
      <PmtInfId>${escXml(pmtInfId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${escXml(nbTxs)}</NbOfTxs>
      <CtrlSum>${escXml(ctrlSum)}</CtrlSum>

      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
        <LclInstrm><Cd>${escXml(lclInstrm)}</Cd></LclInstrm>
      </PmtTpInf>

      <ReqdColltnDt>${escXml(reqCollDt)}</ReqdColltnDt>

      <Cdtr>
        <Nm>${escXml(cdtrNm)}</Nm>
      </Cdtr>

      ${cdtrAgt}

      <CdtrAcct>
        <Id><IBAN>${escXml(cdtrIban)}</IBAN></Id>
      </CdtrAcct>

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
  </CstmrDrctDbtInitn>
</Document>
`.trim();

  return xml;
}

/* =========================
   REPORTES
========================= */
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

  // totales por tag (pendiente)
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

  // aging
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

/* =========================
   AJUSTES + BACKUP
========================= */
document.getElementById("btnSaveConfig").addEventListener("click", ()=>{
  const before = structuredClone(state.config);

  state.config.creditorName = document.getElementById("cfgCreditorName").value.trim();
  state.config.creditorIban = normalizeIban(document.getElementById("cfgCreditorIban").value);
  state.config.creditorCI = document.getElementById("cfgCreditorCI").value.trim();
  state.config.creditorBic = document.getElementById("cfgCreditorBic").value.trim();
  state.config.creditorAddr = document.getElementById("cfgCreditorAddr").value.trim();

  audit("config", "global", "update", before, structuredClone(state.config));
  saveState();
  alert("Ajustes guardados.");
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
    app: "INV-SEPA-LOCAL-V1",
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
    audit("system", "import", "import_backup", before, {imported_at: nowISO()});
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
  if(!confirm("¿Seguro? Esto borra TODO del navegador.")) return;
  localStorage.removeItem(LS_KEY);
  location.reload();
});

function renderAudit(){
  const wrap = document.getElementById("auditList");
  const rows = state.audit.slice(0, 60);
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

/* =========================
   INIT
========================= */
function initRender(){
  renderConfig();
  renderClients();
  renderInvoices();
  renderBatches();
  renderReports();
  renderAudit();
}

// Cargar ajustes al abrir Ajustes
document.querySelector('[data-tab="ajustes"]').addEventListener("click", ()=>{
  renderConfig();
  renderAudit();
});

initRender();
