const cfg = window.ATELIE_CONFIG || {};
const sb = window.supabase.createClient(cfg.supaUrl || '', cfg.supaKey || '');
const $ = (id) => document.getElementById(id);

const BRL = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (iso) => (iso ? new Date(iso + (iso.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR') : '-');
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; const v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }));
const escH = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const STATUS = { novo: { label: 'Novo pedido', cls: 'st-novo' }, producao: { label: 'Em produção', cls: 'st-producao' }, pronto: { label: 'Pronto', cls: 'st-pronto' }, entregue: { label: 'Entregue', cls: 'st-entregue' }, cancelado: { label: 'Cancelado', cls: 'st-cancelado' } };

const state = {
  orders: [],
  products: [],
  formItems: [],
  currentUserEmail: '',
  orderFilter: 'all',
  prodCategory: 'all',
  finBasis: localStorage.getItem('atelie_finBasis') || 'pago',
  selMonth: new Date().getMonth(),
  selYear: new Date().getFullYear(),
  finCache: []
};

let toastTimer = null;
function toast(msg, kind = 'info') {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = kind === 'error' ? '#c77982' : kind === 'success' ? '#6e9d7a' : '#3d2a2e';
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(10px)';
  }, 2800);
}

function setLoading(on) {
  const el = $('appLoading');
  if (el) el.style.display = on ? 'flex' : 'none';
}

function dbToOrder(r) {
  return {
    id: r.id,
    cliente: r.cliente || '',
    whatsapp: r.whatsapp || '',
    origem: r.origem || 'Instagram',
    status: r.status || 'novo',
    itens: Array.isArray(r.itens) ? r.itens : [],
    valor: Number(r.valor || 0),
    custo: Number(r.custo || 0),
    despesas: Number(r.despesas || 0),
    desconto: Number(r.desconto || 0),
    descontoTipo: r.desconto_tipo || 'percent',
    pagamento: r.pagamento || 'Pix',
    pago: r.pago || 'pendente',
    entrega: r.entrega || '',
    obs: r.obs || '',
    criado: r.criado || new Date().toISOString(),
    pagoEm: r.pago_em || null,
    valorPago: Number(r.valor_pago || 0)
  };
}
function dbToProduct(r) {
  return {
    id: r.id,
    nome: r.nome || '',
    categoria: r.categoria || 'Laco infantil',
    descricao: r.descricao || '',
    preco: Number(r.preco || 0),
    custo: Number(r.custo || 0),
    estoque: Number(r.estoque || 0),
    estoqueMin: Number(r.estoque_min || 3),
    obs: r.obs || '',
    criado: r.criado || new Date().toISOString()
  };
}
function orderToDb(o) {
  return {
    id: o.id,
    cliente: o.cliente || '',
    whatsapp: o.whatsapp || '',
    origem: o.origem || 'Instagram',
    status: o.status || 'novo',
    itens: o.itens || [],
    valor: Number(o.valor || 0),
    custo: Number(o.custo || 0),
    despesas: Number(o.despesas || 0),
    desconto: Number(o.desconto || 0),
    desconto_tipo: o.descontoTipo || 'percent',
    pagamento: o.pagamento || 'Pix',
    pago: o.pago || 'pendente',
    entrega: o.entrega || null,
    obs: o.obs || '',
    criado: o.criado || new Date().toISOString(),
    pago_em: o.pagoEm || null,
    valor_pago: Number(o.valorPago || 0)
  };
}
function productToDb(p) {
  return {
    id: p.id,
    nome: p.nome || '',
    categoria: p.categoria || 'Laco infantil',
    descricao: p.descricao || '',
    preco: Number(p.preco || 0),
    custo: Number(p.custo || 0),
    estoque: Number(p.estoque || 0),
    estoque_min: Number(p.estoqueMin || 3),
    obs: p.obs || '',
    criado: p.criado || new Date().toISOString()
  };
}

async function loadAll() {
  setLoading(true);
  const [ordersRes, productsRes] = await Promise.all([
    sb.from('orders').select('*').order('criado', { ascending: false }),
    sb.from('products').select('*').order('nome')
  ]);
  if (ordersRes.error) console.error(ordersRes.error);
  if (productsRes.error) console.error(productsRes.error);
  state.orders = (ordersRes.data || []).map(dbToOrder);
  state.products = (productsRes.data || []).map(dbToProduct);
  setLoading(false);
}

async function saveOrder(o) {
  const { error } = await sb.from('orders').upsert(orderToDb(o));
  if (error) { toast('Erro ao salvar pedido: ' + error.message, 'error'); return false; }
  return true;
}
async function deleteOrder(id) {
  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) { toast('Erro ao excluir pedido', 'error'); return false; }
  return true;
}
async function saveProduct(p) {
  const { error } = await sb.from('products').upsert(productToDb(p));
  if (error) { toast('Erro ao salvar produto: ' + error.message, 'error'); return false; }
  return true;
}
async function deleteProduct(id) {
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) { toast('Erro ao excluir produto', 'error'); return false; }
  return true;
}

function showApp() {
  $('loginScreen').style.display = 'none';
  $('loginInfo').textContent = 'Logado como: ' + state.currentUserEmail;
}
function showLogin() {
  $('loginScreen').style.display = 'flex';
  setTimeout(() => $('loginEmail').focus(), 100);
}

async function checkAuth() {
  setLoading(true);
  const { data: { session } } = await sb.auth.getSession();
  setLoading(false);
  if (session) {
    state.currentUserEmail = session.user.email;
    showApp();
    await loadAll();
    renderAll();
  } else {
    showLogin();
  }
}

async function doLogin() {
  const email = $('loginEmail').value.trim();
  const pass = $('loginPass').value;
  if (!email || !pass) { $('loginError').textContent = 'Preencha email e senha'; return; }
  const btn = $('loginBtn');
  btn.disabled = true; btn.textContent = 'Entrando...';
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.disabled = false; btn.textContent = 'Entrar';
  if (error) { $('loginError').textContent = 'Email ou senha incorretos'; $('loginPass').value = ''; return; }
  $('loginError').textContent = '';
  state.currentUserEmail = data.user.email;
  showApp();
  await loadAll();
  renderAll();
}

async function doLogout() {
  const ok = await showDialog({ title: 'Sair do sistema', message: 'Deseja realmente sair?', okText: 'Sair', cancelText: 'Cancelar' });
  if (!ok) return;
  await sb.auth.signOut();
  state.currentUserEmail = '';
  $('loginEmail').value = '';
  $('loginPass').value = '';
  $('loginError').textContent = '';
  showLogin();
}

function showDialog({ title, message, okText = 'OK', cancelText, danger } = {}) {
  return new Promise((resolve) => {
    const modal = $('chgPwdModal');
    const card = modal.querySelector('.modal-card');
    card.innerHTML = `
      <h3>${escH(title || 'Confirmar')}</h3>
      <p style="margin:0 0 16px; color:var(--text); line-height:1.5">${escH(message || '')}</p>
      <button class="btn btn-primary btn-full" id="dialogOk">${escH(okText)}</button>
      ${cancelText ? '<button class="btn btn-outline btn-full" id="dialogCancel" style="margin-top:8px">' + escH(cancelText) + '</button>' : ''}
    `;
    modal.classList.remove('hidden');
    const ok = $('#dialogOk');
    const cancel = $('#dialogCancel');
    const close = (value) => { modal.classList.add('hidden'); resolve(value); };
    ok.onclick = () => close(true);
    if (cancel) cancel.onclick = () => close(false);
    if (danger) ok.classList.add('btn-danger');
  });
}

function goTo(pageId) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  $(pageId).classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === pageId));
  if (pageId === 'pgDash') renderDashboard();
  if (pageId === 'pgPedidos') renderOrders();
  if (pageId === 'pgProdutos') renderProducts();
  if (pageId === 'pgFinanceiro') renderFinanceiro();
  if (pageId === 'pgMais') renderClientes();
}

function orderSubtotal(o) {
  if (o.itens?.length) return o.itens.reduce((s, i) => s + Number(i.precoUnit || 0) * Number(i.qtd || 1), 0);
  return Number(o.valor || 0);
}
function currentOrderTotalFromForm() {
  const subtotal = state.formItems.reduce((s, i) => s + Number(i.precoUnit || 0) * Number(i.qtd || 1), 0);
  const desconto = Number($('oDesconto').value || 0);
  const tipo = $('oDescontoTipo').value || 'percent';
  return desconto > 0 ? (tipo === 'percent' ? subtotal * (1 - Math.min(desconto, 100) / 100) : Math.max(0, subtotal - desconto)) : subtotal;
}
function paidAmount(o) {
  if (o.pago === 'parcial') return Number(o.valorPago || 0);
  if (o.pago === 'pago') return Number(o.valorPago || 0) > 0 ? Number(o.valorPago || 0) : orderTotal(o);
  return 0;
}
function paidDate(o) {
  return o.pagoEm || o.criado || null;
}
function applyDesconto(sub, o) {
  const d = Number(o.desconto || 0);
  if (!d) return sub;
  return o.descontoTipo === 'percent' ? sub * (1 - Math.min(d, 100) / 100) : Math.max(0, sub - d);
}
function orderTotal(o) { return applyDesconto(orderSubtotal(o), o); }
function itensSummary(o) {
  if (o.itens?.length) {
    if (o.itens.length === 1) return `${o.itens[0].qtd}x ${o.itens[0].desc}`;
    const tot = o.itens.reduce((s, i) => s + Number(i.qtd || 1), 0);
    return `${o.itens.length} tipo(s) — ${tot} peça(s)`;
  }
  return o.descricao || '-';
}
function totalPecas(o) {
  if (o.itens?.length) return o.itens.reduce((s, i) => s + Number(i.qtd || 1), 0);
  return Number(o.qtd || 0);
}

function renderDashboard() {
  const now = new Date();
  const mn = now.getMonth();
  const yr = now.getFullYear();
  $('dashSubtitle').textContent = `${MONTHS[mn]} de ${yr}`;
  const thisMonth = state.orders.filter((o) => { const d = new Date(o.criado); return d.getMonth() === mn && d.getFullYear() === yr && o.status !== 'cancelado'; });
  const pagos = state.orders.filter((o) => {
    if ((o.pago !== 'pago' && o.pago !== 'parcial') || o.status === 'cancelado') return false;
    const ref = paidDate(o);
    if (!ref) return false;
    const d = new Date(ref.includes('T') ? ref : `${ref}T12:00:00`);
    return d.getMonth() === mn && d.getFullYear() === yr;
  });
  const fat = pagos.reduce((s, o) => s + paidAmount(o), 0);
  const cus = pagos.reduce((s, o) => s + Number(o.custo || 0) + Number(o.despesas || 0), 0);
  const luc = fat - cus;
  const pendList = state.orders.filter((o) => o.pago !== 'pago' && o.status !== 'cancelado');
  const pendVal = pendList.reduce((s, o) => s + (orderTotal(o) - paidAmount(o)), 0);
  const estBx = state.products.filter((p) => Number(p.estoque || 0) <= Number(p.estoqueMin || 0)).length;
  $('kpiGrid').innerHTML = `
    <div class="kpi kpi-hl"><div class="label">Faturamento</div><div class="value">${BRL(fat)}</div><div class="sub">Recebido este mês</div></div>
    <div class="kpi"><div class="label">Lucro</div><div class="value ${luc >= 0 ? 'profit-pos' : 'profit-neg'}">${BRL(luc)}</div><div class="sub">Receita menos custos</div></div>
    <div class="kpi"><div class="label">Pedidos</div><div class="value">${thisMonth.length}</div><div class="sub">${estBx ? `<span style="color:var(--red)">${estBx} produto(s) em estoque baixo</span>` : 'Este mês'}</div></div>
    <div class="kpi"><div class="label">A receber</div><div class="value ${pendVal > 0 ? 'profit-neg' : ''}">${BRL(pendVal)}</div><div class="sub">${pendList.length} pedido(s) pendente(s)</div></div>
  `;
  const counts = { novo: 0, producao: 0, pronto: 0, entregue: 0 };
  state.orders.forEach((o) => { if (counts[o.status] !== undefined) counts[o.status]++; });
  const maxC = Math.max(1, ...Object.values(counts));
  $('statusChart').innerHTML = Object.entries(counts).map(([k, v]) => `<div class="bar-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="bar-label" style="min-width:90px;font-size:12px;color:var(--muted)">${STATUS[k].label}</span><div class="bar-track" style="flex:1;height:10px;background:var(--soft);border-radius:999px;overflow:hidden"><div class="bar-fill" style="height:100%;width:${(v / maxC) * 100}%;background:linear-gradient(90deg,var(--rose),var(--gold));border-radius:999px"></div></div><span class="bar-val" style="font-size:12px;font-weight:700;min-width:24px;text-align:right">${v}</span></div>`).join('') || '<div class="empty">Nenhum pedido ainda</div>';
  $('monthResult').innerHTML = fat === 0 && cus === 0 ? '<div class="empty">Nenhum dado financeiro este mês</div>' : `<div class="totals-row" style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:var(--soft);font-weight:700;font-size:13px;margin-top:6px"><span>Receita</span><span class="profit-pos">${BRL(fat)}</span></div><div class="totals-row" style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:var(--soft);font-weight:700;font-size:13px;margin-top:6px"><span>Custos + despesas</span><span class="profit-neg">${BRL(cus)}</span></div><div class="totals-row" style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:${luc >= 0 ? '#e7f4eb' : '#fce9eb'};font-weight:700;font-size:13px;margin-top:6px"><span><strong>Resultado</strong></span><span class="${luc >= 0 ? 'profit-pos' : 'profit-neg'}">${BRL(luc)}</span></div>`;
  const up = state.orders.filter((o) => o.status !== 'entregue' && o.status !== 'cancelado' && o.entrega).sort((a, b) => a.entrega.localeCompare(b.entrega)).slice(0, 5);
  $('nextDeliveries').innerHTML = up.length ? up.map((o) => `<div class="list-item" data-id="${o.id}"><div class="head"><strong>${escH(o.cliente)}</strong><span class="status ${STATUS[o.status].cls}">${STATUS[o.status].label}</span></div><div class="small">${escH(itensSummary(o))} — Entrega: ${fmtDate(o.entrega)} — <span class="pago-${o.pago}">${escH(o.pago).toUpperCase()}</span></div></div>`).join('') : '<div class="empty">Nenhuma entrega pendente</div>';
  document.querySelectorAll('#nextDeliveries .list-item').forEach((el) => el.addEventListener('click', () => openOrderForm(el.dataset.id)));
}

function renderOrders() {
  const filter = state.orderFilter;
  const search = norm($('orderSearch')?.value);
  let list = [...state.orders];
  if (filter === 'areceber') list = list.filter((o) => o.pago !== 'pago' && o.status !== 'cancelado');
  else if (filter !== 'all') list = list.filter((o) => o.status === filter);
  if (search) list = list.filter((o) => norm(`${o.cliente} ${itensSummary(o)} ${o.origem} ${o.whatsapp}`).includes(search));
  list.sort((a, b) => new Date(b.criado) - new Date(a.criado));
  $('ordersList').innerHTML = list.length ? list.map((o) => {
    const tot = orderTotal(o);
    const luc = tot - Number(o.custo || 0) - Number(o.despesas || 0);
    const recebido = paidAmount(o);
    const restante = tot - recebido;
    return `<div class="list-item" data-id="${o.id}"><div class="head"><div><strong>${escH(o.cliente)}</strong><div class="small">${fmtDate(o.entrega)} — ${escH(o.origem)}</div></div><span class="status ${STATUS[o.status]?.cls || 'st-novo'}">${escH(STATUS[o.status]?.label || o.status)}</span></div><div class="small" style="margin-bottom:6px">${escH(itensSummary(o))}</div><div style="display:flex;justify-content:space-between;align-items:center"><span><strong>${BRL(tot)}</strong> — <span class="pago-${o.pago}">${escH(o.pago).toUpperCase()}</span></span><span class="small ${luc >= 0 ? 'profit-pos' : 'profit-neg'}">Lucro ${BRL(luc)}</span></div>${o.pago === 'parcial' ? `<div class="small" style="display:flex;justify-content:space-between;margin-top:2px"><span class="profit-pos">Recebido: ${BRL(recebido)}</span><span class="profit-neg">Saldo a receber: ${BRL(restante)}</span></div>` : ''}<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap"><button class="btn btn-soft btn-outline" type="button" data-action="delivered">✓ Entregue</button><button class="btn btn-soft btn-outline" type="button" data-action="paid">💰 Pago</button></div></div>`;
  }).join('') : '<div class="empty">Nenhum pedido encontrado</div>';
  document.querySelectorAll('#ordersList .list-item').forEach((el) => {
    el.querySelector('[data-action="delivered"]')?.addEventListener('click', (ev) => { ev.stopPropagation(); quickMarkDelivered(el.dataset.id); });
    el.querySelector('[data-action="paid"]')?.addEventListener('click', (ev) => { ev.stopPropagation(); quickMarkPaid(el.dataset.id); });
    el.addEventListener('click', () => openOrderForm(el.dataset.id));
  });
}

async function quickMarkDelivered(id) { const o = state.orders.find((x) => x.id === id); if (!o) return; const ok = await showDialog({ title: 'Marcar como entregue', message: `Confirmar entrega do pedido de ${o.cliente}?`, okText: 'Marcar entregue', cancelText: 'Cancelar' }); if (!ok) return; o.status = 'entregue'; if (await saveOrder(o)) { await loadAll(); renderOrders(); toast('Pedido marcado como entregue', 'success'); } }
async function quickMarkPaid(id) { const o = state.orders.find((x) => x.id === id); if (!o) return; const ok = await showDialog({ title: 'Marcar como pago', message: `Confirmar pagamento do pedido de ${o.cliente}?`, okText: 'Marcar pago', cancelText: 'Cancelar' }); if (!ok) return; o.pago = 'pago'; o.valorPago = orderTotal(o); o.pagoEm = o.pagoEm || new Date().toISOString(); if (await saveOrder(o)) { await loadAll(); renderOrders(); toast('Pedido marcado como pago', 'success'); } }

function renderItensForm() {
  const list = $('itensList');
  const footer = $('itensFooter');
  if (!state.formItems.length) {
    list.innerHTML = '<div class="empty" style="margin:0">Nenhum item adicionado</div>';
    footer.style.display = 'none';
    return;
  }
  list.innerHTML = state.formItems.map((it, i) => `
    <div class="item-row">
      <input type="text" value="${escH(it.desc)}" placeholder="Descrição" data-field="desc" data-index="${i}" />
      <input type="number" value="${it.qtd}" min="1" data-field="qtd" data-index="${i}" />
      <input type="number" value="${it.precoUnit || ''}" min="0" step="0.01" placeholder="0,00" data-field="precoUnit" data-index="${i}" />
      <button type="button" class="item-del" data-index="${i}" aria-label="Remover item">×</button>
    </div>
  `).join('');
  list.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => {
    const idx = Number(input.dataset.index);
    const field = input.dataset.field;
    state.formItems[idx][field] = field === 'qtd' || field === 'precoUnit' ? Number(input.value || 0) : input.value;
    recalcTotal();
  }));
  list.querySelectorAll('.item-del').forEach((btn) => btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.index);
    state.formItems.splice(idx, 1);
    renderItensForm();
  }));
  recalcTotal();
  footer.style.display = 'flex';
}
function recalcTotal() {
  const sub = state.formItems.reduce((s, i) => s + Number(i.precoUnit || 0) * Number(i.qtd || 1), 0);
  $('itensTotal').textContent = BRL(sub);
  $('itensFooter').style.display = state.formItems.length ? 'flex' : 'none';
  const d = Number($('oDesconto').value || 0);
  const tipo = $('oDescontoTipo').value || 'percent';
  const final = d > 0 ? (tipo === 'percent' ? sub * (1 - Math.min(d, 100) / 100) : Math.max(0, sub - d)) : sub;
  $('oValorFinal').textContent = `${BRL(final)}${d > 0 ? ` (desc. ${tipo === 'percent' ? d + '%' : BRL(d)})` : ''}`;
  updateValorRestante(final);
}
function updateValorRestante(total) {
  if ($('oPago').value !== 'parcial') return;
  const pago = Number($('oValorPago').value || 0);
  const restante = Math.max(0, (total ?? currentOrderTotalFromForm()) - pago);
  $('oValorRestante').textContent = BRL(restante);
}

function clearOrderForm() {
  $('orderForm').reset();
  $('orderId').value = '';
  state.formItems = [];
  $('partialPaymentRow').style.display = 'none';
  renderItensForm();
  $('productSearchInput').value = '';
  $('productSearchResults').innerHTML = '';
  $('productSearchResults').style.display = 'none';
}
function togglePartialPaymentFields() {
  const status = $('oPago').value;
  const showRow = status === 'parcial' || status === 'pago';
  $('partialPaymentRow').style.display = showRow ? 'grid' : 'none';
  $('oValorPagoGroup').style.display = status === 'parcial' ? 'block' : 'none';
  $('partialRemainingRow').style.display = status === 'parcial' ? 'block' : 'none';
  if (!showRow) {
    $('oValorPago').value = '';
    $('oPagoEm').value = '';
  } else {
    if (!$('oPagoEm').value) $('oPagoEm').value = new Date().toISOString().slice(0, 10);
    updateValorRestante();
  }
}
function openOrderForm(id) {
  const isEdit = !!id;
  $('orderFormTitle').textContent = isEdit ? 'Editar pedido' : 'Novo pedido';
  $('orderSubmitBtn').textContent = isEdit ? 'Atualizar pedido' : 'Salvar pedido';
  $('deleteOrderBtn').style.display = isEdit ? 'block' : 'none';
  if (isEdit) {
    const o = state.orders.find((x) => x.id === id); if (!o) return;
    $('orderId').value = o.id;
    $('oCliente').value = o.cliente || '';
    $('oWhats').value = o.whatsapp || '';
    $('oOrigem').value = o.origem || 'Instagram';
    $('oStatus').value = o.status || 'novo';
    $('oEntrega').value = o.entrega || '';
    $('oCusto').value = o.custo || '';
    $('oDespesas').value = o.despesas || '';
    $('oDesconto').value = o.desconto || '';
    $('oDescontoTipo').value = o.descontoTipo || 'percent';
    $('oPgto').value = o.pagamento || 'Pix';
    $('oPago').value = o.pago || 'pendente';
    $('oValorPago').value = o.valorPago ? String(o.valorPago) : '';
    $('oPagoEm').value = o.pagoEm ? o.pagoEm.slice(0, 10) : '';
    $('oObs').value = o.obs || '';
    state.formItems = o.itens && o.itens.length ? o.itens.map((i) => ({ ...i, id: i.id || uid() })) : [];
  } else {
    clearOrderForm();
  }
  togglePartialPaymentFields();
  renderItensForm();
  recalcTotal();
  goTo('pgOrderForm');
}

function addItemRow() {
  state.formItems.push({ id: uid(), desc: '', qtd: 1, precoUnit: 0 });
  renderItensForm();
}
function addItemFromCatalog(id) {
  const p = state.products.find((x) => x.id === id); if (!p) return;
  state.formItems.push({ id: uid(), desc: p.nome + (p.descricao ? ` — ${p.descricao}` : ''), qtd: 1, precoUnit: Number(p.preco || 0) });
  $('productSearchInput').value = '';
  $('productSearchResults').style.display = 'none';
  renderItensForm();
  toast('Produto adicionado', 'success');
}

function renderProductSearchResults() {
  const q = norm($('productSearchInput').value);
  let list = [...state.products];
  if (q) list = list.filter((p) => norm(`${p.nome} ${p.categoria} ${p.descricao}`).includes(q));
  list.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
  list = list.slice(0, 20);
  const results = $('productSearchResults');
  if (!list.length) { results.innerHTML = '<div class="empty" style="margin:0">Nenhum produto encontrado</div>'; results.style.display = 'block'; return; }
  results.innerHTML = list.map((p) => `<div class="result-item" data-id="${p.id}"><div><strong>${escH(p.nome)}</strong><div class="small">${escH(p.categoria)}</div></div><span class="profit-pos">${BRL(p.preco)}</span></div>`).join('');
  results.querySelectorAll('.result-item').forEach((el) => el.addEventListener('mousedown', (ev) => { ev.preventDefault(); addItemFromCatalog(el.dataset.id); }));
  results.style.display = 'block';
}

async function submitOrder(e) {
  e.preventDefault();
  if (!state.formItems.length) { toast('Adicione pelo menos um item ao pedido', 'error'); return; }
  if (state.formItems.some((i) => !String(i.desc || '').trim())) { toast('Preencha a descrição de todos os itens', 'error'); return; }
  const id = $('orderId').value;
  const btn = $('orderSubmitBtn'); btn.disabled = true; btn.textContent = 'Salvando...';
  const pagoStatus = $('oPago').value;
  const pagoValor = pagoStatus === 'parcial' ? Number($('oValorPago').value || 0) : (pagoStatus === 'pago' ? currentOrderTotalFromForm() : 0);
  const pagoEm = pagoStatus === 'parcial' || pagoStatus === 'pago' ? ($('oPagoEm').value ? `${$('oPagoEm').value}T12:00:00` : new Date().toISOString()) : null;
  const data = {
    cliente: $('oCliente').value.trim(),
    whatsapp: $('oWhats').value.trim(),
    origem: $('oOrigem').value,
    itens: state.formItems.map((i) => ({ id: i.id, desc: String(i.desc || '').trim(), qtd: Number(i.qtd || 1), precoUnit: Number(i.precoUnit || 0) })),
    desconto: Number($('oDesconto').value || 0),
    descontoTipo: $('oDescontoTipo').value,
    custo: Number($('oCusto').value || 0),
    despesas: Number($('oDespesas').value || 0),
    status: $('oStatus').value,
    entrega: $('oEntrega').value,
    pagamento: $('oPgto').value,
    pago: pagoStatus,
    obs: $('oObs').value.trim(),
    valorPago: pagoValor,
    pagoEm: pagoEm
  };
  const order = id ? { ...state.orders.find((o) => o.id === id), ...data } : { id: uid(), ...data, criado: new Date().toISOString() };
  const ok = await saveOrder(order);
  btn.disabled = false; btn.textContent = id ? 'Atualizar pedido' : 'Salvar pedido';
  if (!ok) return;
  await loadAll();
  goTo('pgPedidos');
  toast(id ? 'Pedido atualizado' : 'Pedido salvo', 'success');
}

function renderProductCatTabs() {
  const bar = $('prodCatTabs');
  const cats = [...new Set(state.products.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  bar.innerHTML = `<button class="${state.prodCategory === 'all' ? 'active' : ''}" data-cat="all">Todas</button>${cats.map((c) => `<button class="${state.prodCategory === c ? 'active' : ''}" data-cat="${escH(c)}">${escH(c)}</button>`).join('')}`;
  bar.querySelectorAll('button').forEach((btn) => btn.addEventListener('click', () => { state.prodCategory = btn.dataset.cat; renderProducts(); }));
}
function renderProducts() {
  renderProductCatTabs();
  const s = norm($('prodSearch').value);
  let list = [...state.products];
  if (state.prodCategory !== 'all') list = list.filter((p) => p.categoria === state.prodCategory);
  if (s) list = list.filter((p) => norm(`${p.nome} ${p.categoria}`).includes(s));
  list.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  $('productsList').innerHTML = list.length ? list.map((p) => {
    const m = p.preco && p.custo ? Math.round(((p.preco - p.custo) / p.preco) * 100) : 0;
    return `<div class="product-card" data-id="${p.id}"><div class="head"><div><strong>${escH(p.nome)}</strong><div class="small">${escH(p.categoria)}</div></div><span class="stock-badge ${Number(p.estoque || 0) === 0 ? 'st-zero' : Number(p.estoque || 0) <= Number(p.estoqueMin || 0) ? 'st-low' : 'st-ok'}">${p.estoque} un — ${Number(p.estoque || 0) === 0 ? 'Sem estoque' : Number(p.estoque || 0) <= Number(p.estoqueMin || 0) ? 'Estoque baixo' : 'Em estoque'}</span></div>${p.descricao ? `<div class="small">${escH(p.descricao)}</div>` : ''}<div class="info-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px"><div><span class="small">Venda</span><div><strong>${BRL(p.preco)}</strong></div></div><div><span class="small">Custo</span><div><strong>${BRL(p.custo)}</strong></div></div><div><span class="small">Margem</span><div class="${m >= 0 ? 'profit-pos' : 'profit-neg'}"><strong>${m}%</strong></div></div></div></div>`;
  }).join('') : '<div class="empty">Nenhum produto cadastrado ainda</div>';
  document.querySelectorAll('#productsList .product-card').forEach((el) => el.addEventListener('click', () => openProdForm(el.dataset.id)));
}
function openProdForm(id) {
  const isEdit = !!id;
  $('prodFormTitle').textContent = isEdit ? 'Editar produto' : 'Novo produto';
  $('prodSubmitBtn').textContent = isEdit ? 'Atualizar produto' : 'Salvar produto';
  $('deleteProdBtn').style.display = isEdit ? 'block' : 'none';
  if (isEdit) {
    const p = state.products.find((x) => x.id === id); if (!p) return;
    $('prodId').value = p.id;
    $('pNome').value = p.nome || '';
    $('pCategoria').value = p.categoria || 'Laco infantil';
    $('pDesc').value = p.descricao || '';
    $('pPreco').value = p.preco || '';
    $('pCusto').value = p.custo || '';
    $('pEstoque').value = p.estoque || 0;
    $('pEstoqueMin').value = p.estoqueMin || 3;
    $('pObs').value = p.obs || '';
  } else {
    $('prodForm').reset();
    $('prodId').value = '';
    $('pEstoque').value = 0;
    $('pEstoqueMin').value = 3;
  }
  goTo('pgProdForm');
}
async function submitProd(e) {
  e.preventDefault();
  const id = $('prodId').value;
  const btn = $('prodSubmitBtn'); btn.disabled = true; btn.textContent = 'Salvando...';
  const data = {
    nome: $('pNome').value.trim(),
    categoria: $('pCategoria').value,
    descricao: $('pDesc').value.trim(),
    preco: Number($('pPreco').value || 0),
    custo: Number($('pCusto').value || 0),
    estoque: Number($('pEstoque').value || 0),
    estoqueMin: Number($('pEstoqueMin').value || 0),
    obs: $('pObs').value.trim()
  };
  const product = id ? { ...state.products.find((p) => p.id === id), ...data } : { id: uid(), ...data, criado: new Date().toISOString() };
  const ok = await saveProduct(product);
  btn.disabled = false; btn.textContent = id ? 'Atualizar produto' : 'Salvar produto';
  if (!ok) return;
  await loadAll();
  goTo('pgProdutos');
  toast(id ? 'Produto atualizado' : 'Produto salvo', 'success');
}

function changeMonth(delta) {
  state.selMonth += delta;
  if (state.selMonth > 11) { state.selMonth = 0; state.selYear++; }
  if (state.selMonth < 0) { state.selMonth = 11; state.selYear--; }
  renderFinanceiro();
}
function renderFinanceiro() {
  $('monthLabel').textContent = `${MONTHS[state.selMonth]} ${state.selYear}`;
  document.querySelectorAll('#finBasis button').forEach((b) => b.classList.toggle('active', b.dataset.basis === state.finBasis));
  const inPeriod = (o) => {
    const ref = state.finBasis === 'entrega' ? (o.entrega || o.criado) : (state.finBasis === 'pago' ? (o.pagoEm || o.criado) : o.criado);
    if (!ref) return false;
    const d = new Date(ref.includes('T') ? ref : `${ref}T12:00:00`);
    return d.getMonth() === state.selMonth && d.getFullYear() === state.selYear;
  };
  const mo = state.orders.filter((o) => inPeriod(o) && o.status !== 'cancelado');
  state.finCache = mo;
  const ent = mo.filter((o) => o.status === 'entregue');
  const rec = ent.reduce((s, o) => s + orderTotal(o), 0);
  const cust = mo.reduce((s, o) => s + Number(o.custo || 0), 0);
  const desp = mo.reduce((s, o) => s + Number(o.despesas || 0), 0);
  const luc = rec - cust - desp;
  const tk = ent.length ? rec / ent.length : 0;
  const mg = rec ? Math.round((luc / rec) * 100) : 0;
  $('finKpis').innerHTML = `
    <div class="kpi kpi-hl"><div class="label">Receita</div><div class="value">${BRL(rec)}</div><div class="sub">${ent.length} entregues</div></div>
    <div class="kpi"><div class="label">Custos totais</div><div class="value">${BRL(cust + desp)}</div><div class="sub">Material + despesas</div></div>
    <div class="kpi"><div class="label">Lucro</div><div class="value ${luc >= 0 ? 'profit-pos' : 'profit-neg'}">${BRL(luc)}</div><div class="sub">Margem ${mg}%</div></div>
    <div class="kpi"><div class="label">Ticket médio</div><div class="value">${BRL(tk)}</div><div class="sub">${mo.filter((o) => o.pago !== 'pago').length} pendente(s)</div></div>
  `;
  $('finResultado').innerHTML = mo.length === 0 ? '<div class="empty">Nenhum pedido neste mês</div>' : `<div class="totals-row" style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:var(--soft);font-weight:700;font-size:13px;margin-top:6px"><span>Receita (entregues)</span><span class="profit-pos">${BRL(rec)}</span></div><div class="totals-row" style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:var(--soft);font-weight:700;font-size:13px;margin-top:6px"><span>Custo de material</span><span>${BRL(cust)}</span></div><div class="totals-row" style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:var(--soft);font-weight:700;font-size:13px;margin-top:6px"><span>Outras despesas</span><span>${BRL(desp)}</span></div><div class="totals-row" style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:${luc >= 0 ? '#e7f4eb' : '#fce9eb'};font-weight:700;font-size:13px;margin-top:6px"><span><strong>Lucro líquido</strong></span><span class="${luc >= 0 ? 'profit-pos' : 'profit-neg'}">${BRL(luc)}</span></div>`;
  const bySrc = {};
  mo.forEach((o) => { bySrc[o.origem] = (bySrc[o.origem] || 0) + orderTotal(o); });
  const maxS = Math.max(1, ...Object.values(bySrc));
  $('finSources').innerHTML = Object.keys(bySrc).length ? Object.entries(bySrc).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="bar-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span class="bar-label" style="min-width:90px;font-size:12px;color:var(--muted)">${escH(k)}</span><div class="bar-track" style="flex:1;height:10px;background:var(--soft);border-radius:999px;overflow:hidden"><div class="bar-fill" style="height:100%;width:${(v / maxS) * 100}%;background:linear-gradient(90deg,var(--rose),var(--gold));border-radius:999px"></div></div><span class="bar-val" style="font-size:12px;font-weight:700;min-width:40px;text-align:right">${BRL(v)}</span></div>`).join('') : '<div class="empty">Sem dados de origem</div>';
  renderFinOrders();
}
function renderFinOrders() {
  const s = norm($('finSearch').value);
  const list = s ? state.finCache.filter((o) => norm(o.cliente).includes(s)) : state.finCache;
  $('finOrders').innerHTML = list.length ? list.map((o) => {
    const t = orderTotal(o);
    const l = t - Number(o.custo || 0) - Number(o.despesas || 0);
    return `<div class="list-item"><div class="head"><strong>${escH(o.cliente)}</strong><span class="pago-${o.pago}">${escH(o.pago).toUpperCase()}</span></div>${(o.itens || []).map((i) => `<div class="small">• ${Number(i.qtd || 0)}x ${escH(i.desc)} = ${BRL(Number(i.precoUnit || 0) * Number(i.qtd || 1))}</div>`).join('')}<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px"><div><span class="small">Receita</span><div style="font-weight:700">${BRL(t)}</div></div><div><span class="small">Custos</span><div style="font-weight:700;color:var(--red)">${BRL(Number(o.custo || 0) + Number(o.despesas || 0))}</div></div><div><span class="small">Lucro</span><div class="${l >= 0 ? 'profit-pos' : 'profit-neg'}" style="font-weight:700">${BRL(l)}</div></div></div></div>`;
  }).join('') : '<div class="empty">Nenhum pedido neste mês</div>';
}

function renderClientes() {
  const s = norm($('clientSearch').value);
  const map = {};
  state.orders.forEach((o) => {
    const nome = (o.cliente || '').trim();
    if (!nome) return;
    const k = norm(nome);
    if (!map[k]) map[k] = { nome, whatsapp: o.whatsapp, origem: o.origem, pedidos: 0, total: 0, pecas: 0, ultimo: o.criado };
    map[k].pedidos += 1;
    map[k].total += orderTotal(o);
    map[k].pecas += totalPecas(o);
    map[k].ultimo = o.criado > map[k].ultimo ? o.criado : map[k].ultimo;
    if (o.whatsapp) map[k].whatsapp = o.whatsapp;
  });
  let list = Object.values(map).sort((a, b) => b.total - a.total);
  if (s) list = list.filter((c) => norm(c.nome).includes(s));
  $('clientsList').innerHTML = list.length ? list.map((c) => `<div class="list-item"><div class="head"><strong>${escH(c.nome)}</strong><span class="small">${c.pedidos} pedido(s) — ${c.pecas} peça(s)</span></div><div class="small">${escH(c.whatsapp || 'Sem WhatsApp')} — ${escH(c.origem)} — Último: ${fmtDate(c.ultimo.slice(0, 10))}</div><div class="totals-row" style="display:flex;justify-content:space-between;padding:10px 12px;border-radius:12px;background:var(--soft);font-weight:700;font-size:13px;margin-top:8px"><span>Total gasto</span><span>${BRL(c.total)}</span></div></div>`).join('') : '<div class="empty">Nenhum cliente ainda</div>';
}

function exportData() {
  const blob = new Blob([JSON.stringify({ orders: state.orders, products: state.products, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `atelie-laco-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
async function importData() {
  const file = $('importFile').files[0];
  if (!file) { toast('Selecione um arquivo', 'error'); return; }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const newOrders = (Array.isArray(data.orders) ? data.orders : []).filter((o) => o && o.id && (o.cliente || '').trim());
      const newProducts = (Array.isArray(data.products) ? data.products : []).filter((p) => p && p.id && (p.nome || '').trim());
      if (!newOrders.length && !newProducts.length) { toast('Arquivo vazio ou inválido', 'error'); return; }
      const ok = await showDialog({ title: 'Importar backup', message: `Serão adicionados/sobrescritos ${newOrders.length} pedidos e ${newProducts.length} produtos. Continuar?`, okText: 'Importar', cancelText: 'Cancelar' });
      if (!ok) return;
      setLoading(true);
      if (newOrders.length) {
        const { error } = await sb.from('orders').upsert(newOrders.map(orderToDb));
        if (error) { toast('Erro ao importar pedidos', 'error'); setLoading(false); return; }
      }
      if (newProducts.length) {
        const { error } = await sb.from('products').upsert(newProducts.map(productToDb));
        if (error) { toast('Erro ao importar produtos', 'error'); setLoading(false); return; }
      }
      await loadAll();
      setLoading(false);
      renderAll();
      toast('Backup importado com sucesso', 'success');
    } catch (err) {
      toast(err.message || 'Erro na importação', 'error');
    }
  };
  reader.readAsText(file);
}
async function resetAll() {
  const first = await showDialog({ title: 'Apagar tudo', message: 'Isso apaga todos os pedidos e produtos permanentemente. Deseja continuar?', okText: 'Apagar tudo', cancelText: 'Cancelar', danger: true });
  if (!first) return;
  const second = await showDialog({ title: 'Confirmar exclusão total', message: 'Tem certeza absoluta? Todos os dados serão apagados para sempre.', okText: 'Sim, apagar tudo', cancelText: 'Cancelar', danger: true });
  if (!second) return;
  setLoading(true);
  await Promise.all([
    sb.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    sb.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  ]);
  state.orders = [];
  state.products = [];
  setLoading(false);
  goTo('pgDash');
  renderAll();
  toast('Todos os dados foram removidos', 'success');
}

function renderAll() {
  renderDashboard();
  renderOrders();
  renderProducts();
  renderFinanceiro();
  renderClientes();
}

function bindEvents() {
  document.querySelectorAll('.bottom-nav button').forEach((btn) => btn.addEventListener('click', () => goTo(btn.dataset.page)));
  document.querySelectorAll('#orderTabs button').forEach((btn) => btn.addEventListener('click', () => { document.querySelectorAll('#orderTabs button').forEach((x) => x.classList.remove('active')); btn.classList.add('active'); state.orderFilter = btn.dataset.filter; renderOrders(); }));
  $('orderSearch')?.addEventListener('input', renderOrders);
  $('prodSearch')?.addEventListener('input', renderProducts);
  $('finSearch')?.addEventListener('input', renderFinOrders);
  $('clientSearch')?.addEventListener('input', renderClientes);
  $('newOrderBtn')?.addEventListener('click', () => openOrderForm());
  $('newProductBtn')?.addEventListener('click', () => openProdForm());
  $('addItemBtn')?.addEventListener('click', addItemRow);
  $('productSearchInput')?.addEventListener('input', renderProductSearchResults);
  $('productSearchInput')?.addEventListener('focus', renderProductSearchResults);
  $('productSearchInput')?.addEventListener('blur', () => setTimeout(() => { $('productSearchResults').style.display = 'none'; }, 160));
  $('oDesconto')?.addEventListener('input', recalcTotal);
  $('oDescontoTipo')?.addEventListener('change', recalcTotal);
  $('oPago')?.addEventListener('change', togglePartialPaymentFields);
  $('oValorPago')?.addEventListener('input', () => updateValorRestante());
  $('orderForm')?.addEventListener('submit', submitOrder);
  $('prodForm')?.addEventListener('submit', submitProd);
  $('deleteOrderBtn')?.addEventListener('click', async () => { const id = $('orderId').value; if (!id) return; const ok = await showDialog({ title: 'Excluir pedido', message: 'Tem certeza que deseja excluir este pedido?', okText: 'Excluir', cancelText: 'Cancelar', danger: true }); if (!ok) return; const deleted = await deleteOrder(id); if (!deleted) return; await loadAll(); goTo('pgPedidos'); toast('Pedido excluído', 'success'); });
  $('deleteProdBtn')?.addEventListener('click', async () => { const id = $('prodId').value; if (!id) return; const ok = await showDialog({ title: 'Excluir produto', message: 'Tem certeza que deseja excluir este produto?', okText: 'Excluir', cancelText: 'Cancelar', danger: true }); if (!ok) return; const deleted = await deleteProduct(id); if (!deleted) return; await loadAll(); goTo('pgProdutos'); toast('Produto excluído', 'success'); });
  $('cancelOrderBtn')?.addEventListener('click', () => goTo('pgPedidos'));
  $('cancelProdBtn')?.addEventListener('click', () => goTo('pgProdutos'));
  $('prevMonthBtn')?.addEventListener('click', () => changeMonth(-1));
  $('nextMonthBtn')?.addEventListener('click', () => changeMonth(1));
  document.querySelectorAll('#finBasis button').forEach((btn) => btn.addEventListener('click', () => { state.finBasis = btn.dataset.basis; localStorage.setItem('atelie_finBasis', state.finBasis); renderFinanceiro(); }));
  $('loginBtn')?.addEventListener('click', doLogin);
  $('logoutBtn')?.addEventListener('click', doLogout);
  $('changePwdBtn')?.addEventListener('click', async () => { $('pwdNova').value = ''; $('pwdConfirm').value = ''; $('pwdError').textContent = ''; $('chgPwdModal').classList.remove('hidden'); });
  $('pwdCancelBtn')?.addEventListener('click', () => $('chgPwdModal').classList.add('hidden'));
  $('pwdSaveBtn')?.addEventListener('click', async () => {
    const nova = $('pwdNova').value.trim();
    const conf = $('pwdConfirm').value.trim();
    if (nova.length < 6) { $('pwdError').textContent = 'Nova senha deve ter pelo menos 6 caracteres'; return; }
    if (nova !== conf) { $('pwdError').textContent = 'As senhas não conferem'; return; }
    const btn = $('pwdSaveBtn'); btn.disabled = true; btn.textContent = 'Salvando...';
    const { error } = await sb.auth.updateUser({ password: nova });
    btn.disabled = false; btn.textContent = 'Salvar nova senha';
    if (error) { $('pwdError').textContent = 'Erro ao alterar senha'; return; }
    $('chgPwdModal').classList.add('hidden');
    toast('Senha alterada com sucesso', 'success');
  });
  $('forgotPwdLink')?.addEventListener('click', async (e) => { e.preventDefault(); const email = $('loginEmail').value.trim(); if (!email) { $('loginError').textContent = 'Digite o email acima para recuperar'; return; } const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname }); if (error) { $('loginError').textContent = 'Não foi possível enviar o link'; return; } $('loginError').textContent = 'Link enviado para o seu email'; });
  $('exportBtn')?.addEventListener('click', exportData);
  $('importBtn')?.addEventListener('click', importData);
  $('resetBtn')?.addEventListener('click', resetAll);
  $('loginEmail')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginPass').focus(); });
  $('loginPass')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}

window.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  checkAuth();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
