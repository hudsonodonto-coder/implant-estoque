import { useEffect, useMemo, useRef, useState } from 'react';
import { api, getToken, setToken } from './api';
import './index.css';

const CLINICS = ['OC', 'RO'];
const CLINIC_LABELS = {
  OC: 'Odonto Center',
  RO: 'Redeorto',
};

function clinicName(code) {
  return CLINIC_LABELS[code] || code || '';
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}
function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 8.5 12 3l9 5.5v7L12 21l-9-5.5v-7Z" />
      <path d="M12 12v9M3 8.5l9 3.5 9-3.5" />
    </svg>
  );
}
function IconUse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M8 4h8v4H8V4Z" />
      <path d="M10 8v12M14 8v12M7 20h10" />
    </svg>
  );
}
function IconOrders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 4h10l2 4H5l2-4Z" />
      <path d="M5 8h14v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8Z" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}
function IconReport() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 19V9M10 19V5M15 19v-7M20 19V8" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M21 19c0-2.2-1.8-4-4-4-.7 0-1.4.2-2 .5" />
    </svg>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDay(isoDay) {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  });
}

const TAB_KEYS = ['home', 'estoque', 'uso', 'pedidos', 'relatorio', 'equipe'];

function tabFromHash() {
  if (typeof window === 'undefined') return 'home';
  const raw = window.location.hash.replace(/^#\/?/, '');
  return TAB_KEYS.includes(raw) ? raw : 'home';
}

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [user, setUser] = useState(null);
  const [authForm, setAuthForm] = useState({ name: '', username: '', password: '' });
  const [tab, setTab] = useState(tabFromHash);
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('');
  const [status, setStatus] = useState('');
  const [clinic, setClinic] = useState('OC');
  const [cart, setCart] = useState({});
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [adjustQty, setAdjustQty] = useState(1);
  const [orderDetail, setOrderDetail] = useState(null);
  const [receiveQtys, setReceiveQtys] = useState({});
  const [allFamilies, setAllFamilies] = useState(['HE', 'GM', 'NGM']);
  const [userForm, setUserForm] = useState({
    name: '', username: '', password: '', clinic: 'OC', role: 'dentist',
  });
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', username: '', password: '', clinic: 'OC',
  });
  const isAdmin = user?.role === 'admin';
  const isDentist = user?.role === 'dentist';
  const [report, setReport] = useState(null);
  const [reportMonth, setReportMonth] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [reportClinic, setReportClinic] = useState('');
  const [installEvent, setInstallEvent] = useState(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [installed, setInstalled] = useState(false);
  const installDismissed = useRef(
    typeof localStorage !== 'undefined' && localStorage.getItem('impla-install-dismissed') === '1',
  );

  async function refreshAll() {
    if (!user) return;
    const tasks = [api.summary(), api.products({ q: query, family, status })];
    if (user.role === 'admin') tasks.push(api.orders(), api.pendingUsage());
    const results = await Promise.all(tasks);
    setSummary(results[0]);
    setProducts(results[1]);
    if (user.role === 'admin') {
      setOrders(results[2]);
      setPending(results[3]);
    } else {
      setOrders([]);
      setPending([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const statusRes = await api.authStatus();
        if (cancelled) return;
        setConfigured(statusRes.configured);
        if (statusRes.configured && getToken()) {
          const me = await api.me();
          if (cancelled) return;
          setUser(me.user);
          if (me.user.role === 'dentist' && me.user.clinic) {
            setClinic(me.user.clinic);
            setReportClinic(me.user.clinic);
          }
        }
      } catch (e) {
        if (e.code === 401) setToken('');
      } finally {
        if (!cancelled) {
          setAuthReady(true);
          setInstalled(isStandalone());
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshAll().catch((e) => {
      if (e.code === 401) {
        setToken('');
        setUser(null);
      } else {
        showToast(e.message);
      }
    });
  }, [user]);

  useEffect(() => {
    const desired = tab === 'home' ? '' : `#${tab}`;
    if (window.location.hash !== desired) {
      window.history.replaceState(null, '', desired || window.location.pathname);
    }
  }, [tab]);

  useEffect(() => {
    function onHash() {
      const next = tabFromHash();
      if (user?.role === 'dentist' && (next === 'pedidos' || next === 'equipe')) {
        setTab('home');
        return;
      }
      setTab(next);
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    api.products({ q: query, family, status })
      .then(setProducts)
      .catch((e) => showToast(e.message));
  }, [query, family, status, user]);

  useEffect(() => {
    if (!user) return;
    api.products()
      .then((rows) => setAllFamilies([...new Set(rows.map((p) => p.family))]))
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || tab !== 'equipe') return;
    api.users().then(setUsers).catch((e) => showToast(e.message));
  }, [user, tab]);

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setInstallEvent(e);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      showToast('App instalado no celular');
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    if (isIos() && !isStandalone() && !installDismissed.current) {
      setShowIosTip(true);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!user || tab !== 'relatorio') return;
    const [year, month] = reportMonth.split('-').map(Number);
    const clinicFilter = user.role === 'dentist' ? user.clinic : (reportClinic || undefined);
    api.monthlyUsage({ year, month, clinic: clinicFilter })
      .then(setReport)
      .catch((e) => showToast(e.message));
  }, [tab, reportMonth, reportClinic, user]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = configured
        ? await api.login({ username: authForm.username, password: authForm.password })
        : await api.setup({
          name: authForm.name || 'Administrador',
          username: authForm.username || 'admin',
          password: authForm.password,
        });
      setToken(result.token);
      setUser(result.user);
      setConfigured(true);
      if (result.user.role === 'dentist' && result.user.clinic) {
        setClinic(result.user.clinic);
        setReportClinic(result.user.clinic);
      }
      setAuthForm({ name: '', username: '', password: '' });
      showToast(`Olá, ${result.user.name}`);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try { await api.logout(); } catch { /* ignore */ }
    setToken('');
    setUser(null);
    setTab('home');
    showToast('Sessão encerrada');
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createUser(userForm);
      setUsers(await api.users());
      setUserForm({ name: '', username: '', password: '', clinic: 'OC', role: 'dentist' });
      showToast('Usuário cadastrado');
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function toggleUserActive(u) {
    setLoading(true);
    try {
      await api.updateUser(u.id, { active: !u.active });
      setUsers(await api.users());
      showToast(u.active ? 'Acesso desativado' : 'Acesso reativado');
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resetUserPassword(u) {
    setEditUser(u);
    setEditForm({
      name: u.name || '',
      username: u.username || '',
      password: '',
      clinic: u.clinic || 'OC',
    });
  }

  async function saveUserEdit(e) {
    e.preventDefault();
    if (!editUser) return;
    setLoading(true);
    try {
      const payload = {
        name: editForm.name,
        username: editForm.username,
        clinic: editForm.clinic,
      };
      if (editForm.password.trim()) payload.password = editForm.password.trim();
      await api.updateUser(editUser.id, payload);
      setUsers(await api.users());
      setEditUser(null);
      showToast('Acesso atualizado');
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  }

  const pendingForClinic = useMemo(
    () => pending.filter((p) => p.clinic === clinic),
    [pending, clinic],
  );

  const cartItems = useMemo(() => (
    Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity }))
  ), [cart]);

  const cartTotal = cartItems.reduce((s, i) => s + i.quantity, 0);
  const showInstall = !installed && !installDismissed.current && (installEvent || showIosTip);

  function bumpCart(productId, delta, max) {
    setCart((prev) => {
      const cur = prev[productId] || 0;
      const next = Math.max(0, Math.min(max, cur + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      return { ...prev, [productId]: next };
    });
  }

  async function submitUsage() {
    if (!cartItems.length) return;
    setLoading(true);
    try {
      const useClinic = isDentist ? user.clinic : clinic;
      await api.registerUsage({ clinic: useClinic, items: cartItems });
      setCart({});
      await refreshAll();
      showToast(`Uso registrado em ${useClinic}`);
      setTab(isAdmin ? 'pedidos' : 'home');
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function createUsageOrder() {
    setLoading(true);
    try {
      const res = await api.orderFromUsage(clinic);
      await refreshAll();
      await openOrder(res.order.id);
      showToast(`Pedido gerado para ${clinicName(clinic)}`);
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function createMinOrder() {
    setLoading(true);
    try {
      const res = await api.orderFromMinimum(clinic);
      await refreshAll();
      await openOrder(res.order.id);
      showToast('Pedido por mínimo gerado');
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openOrder(id) {
    try {
      const order = await api.order(id);
      setOrderDetail(order);
      const qtys = {};
      for (const item of order.items || []) {
        qtys[item.product_id] = item.quantity;
      }
      setReceiveQtys(qtys);
    } catch (e) {
      showToast(e.message);
    }
  }

  function bumpReceiveQty(productId, delta, max) {
    setReceiveQtys((prev) => {
      const cur = prev[productId] || 0;
      return { ...prev, [productId]: Math.max(0, Math.min(max, cur + delta)) };
    });
  }

  async function receiveSelectedOrder() {
    if (!orderDetail) return;
    setLoading(true);
    try {
      const items = (orderDetail.items || []).map((item) => ({
        productId: item.product_id,
        quantity: receiveQtys[item.product_id] ?? item.quantity,
      }));
      const res = await api.receiveOrder(orderDetail.id, { items });
      await refreshAll();
      setOrderDetail(null);
      setReceiveQtys({});
      if (res.order?.status === 'parcial') {
        showToast('Recebido parcial — faltantes voltaram para comprar');
      } else {
        showToast('Pedido recebido — estoque atualizado');
      }
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function cancelSelectedOrder() {
    if (!orderDetail) return;
    if (!window.confirm('Cancelar este pedido? Os usos voltam para pendentes de compra.')) return;
    setLoading(true);
    try {
      await api.cancelOrder(orderDetail.id);
      await refreshAll();
      setOrderDetail(null);
      setReceiveQtys({});
      showToast('Pedido cancelado');
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSelectedOrder() {
    if (!orderDetail) return;
    if (!window.confirm('Excluir este pedido permanentemente?')) return;
    setLoading(true);
    try {
      await api.deleteOrder(orderDetail.id);
      await refreshAll();
      setOrderDetail(null);
      setReceiveQtys({});
      showToast('Pedido excluído');
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function doAdjust(type) {
    if (!selected || adjustQty < 1) return;
    setLoading(true);
    try {
      const body = { items: [{ productId: selected.id, quantity: adjustQty }], note: type };
      if (type === 'entrada') await api.entrada(body);
      else await api.saida(body);
      await refreshAll();
      setSelected(null);
      showToast(type === 'entrada' ? 'Entrada registrada' : 'Saída registrada');
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleInstall() {
    if (installEvent) {
      installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      if (choice.outcome === 'accepted') showToast('Instalando Impla…');
      return;
    }
    setShowIosTip(true);
  }

  function dismissInstall() {
    installDismissed.current = true;
    localStorage.setItem('impla-install-dismissed', '1');
    setInstallEvent(null);
    setShowIosTip(false);
  }

  function shareReportText() {
    if (!report) return '';
    const lines = [`Implantes — Uso ${report.label}`, `Total: ${report.totalUnits} unidades`, ''];
    for (const c of report.clinics) {
      lines.push(`${clinicName(c.clinic)}: ${c.totalUnits} un.`);
      const dentists = Object.entries(c.byDentist || {}).map(([k, v]) => `${k} ${v}`).join(' · ');
      if (dentists) lines.push(`  Dentistas: ${dentists}`);
      const families = Object.entries(c.byFamily).map(([k, v]) => `${k} ${v}`).join(' · ');
      if (families) lines.push(`  ${families}`);
      for (const item of c.items) {
        lines.push(`  ${item.code} ${item.name} → ${item.quantity}`);
      }
      lines.push('');
    }
    if (report.entries?.length) {
      lines.push('Lançamentos:');
      for (const e of report.entries) {
        lines.push(`- ${formatDate(e.created_at)} · ${e.dentist} · ${clinicName(e.clinic)} · ${e.code} ×${e.quantity}`);
      }
    }
    return lines.join('\n');
  }

  async function copyReport() {
    const text = shareReportText();
    try {
      await navigator.clipboard.writeText(text);
      showToast('Relatório copiado');
    } catch {
      showToast('Não foi possível copiar');
    }
  }

  async function deleteUsageEntry(entry) {
    if (!isAdmin) return;
    if (!window.confirm(`Excluir uso de ${entry.dentist}?\n${entry.name} × ${entry.quantity}\nO estoque será devolvido.`)) return;
    setLoading(true);
    try {
      await api.deleteUsage(entry.id);
      await refreshAll();
      const [year, month] = reportMonth.split('-').map(Number);
      const clinicFilter = isDentist ? user.clinic : (reportClinic || undefined);
      setReport(await api.monthlyUsage({ year, month, clinic: clinicFilter }));
      showToast('Lançamento excluído e estoque devolvido');
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (!authReady) {
    return (
      <div className="app-shell">
        <div className="empty">Carregando…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell">
        <section className="hero">
          <div className="brand-mark" style={{ opacity: 0.85, marginBottom: 10, fontSize: '0.95rem' }}>
            Implantes
          </div>
          <h1>{configured ? 'Entrar' : 'Criar acesso admin'}</h1>
          <p>
            {configured
              ? 'Use o login e a senha cadastrados.'
              : 'Primeiro acesso: defina o administrador com acesso total.'}
          </p>
        </section>
        <form className="section panel" onSubmit={handleAuthSubmit}>
          {!configured && (
            <label className="field">
              <span>Seu nome</span>
              <input
                className="search"
                value={authForm.name}
                onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                placeholder="Ex.: Hudson"
              />
            </label>
          )}
          <label className="field">
            <span>Usuário (login)</span>
            <input
              className="search"
              autoCapitalize="none"
              autoCorrect="off"
              value={authForm.username}
              onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
              placeholder="ex.: hudson"
              required
            />
          </label>
          <label className="field">
            <span>Senha</span>
            <input
              className="search"
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              placeholder="mínimo 4 caracteres"
              required
              minLength={4}
            />
          </label>
          <button className="btn btn-solid" disabled={loading} style={{ marginTop: 12 }}>
            {configured ? 'Entrar' : 'Criar administrador'}
          </button>
        </form>
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      {tab === 'home' && (
        <>
          <section className="hero">
            <div className="brand-mark" style={{ opacity: 0.85, marginBottom: 10, fontSize: '0.95rem' }}>
              Implantes
            </div>
            <h1>Estoque atual por clínica</h1>
            <p>
              {isDentist
                ? `Olá, ${user.name}. Registre a baixa dos implantes usados na ${clinicName(user.clinic)}.`
                : 'Registre o uso em OC ou RO e compre exatamente o que foi utilizado.'}
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => { setStatus(''); setTab('uso'); }}>Registrar uso</button>
              <button className="btn btn-ghost" onClick={() => setTab('relatorio')}>Relatório</button>
            </div>
          </section>

          <div className="section panel" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
            <div>
              <strong>{user.name}</strong>
              <div className="meta">
                {isAdmin ? 'Admin · acesso total' : `Dentista · ${clinicName(user.clinic)}`}
              </div>
            </div>
            <button className="btn btn-outline" style={{ width: 'auto', padding: '0 14px' }} onClick={handleLogout}>
              Sair
            </button>
          </div>

          {showInstall && (
            <section className="install-banner section">
              <div>
                <strong>Instalar no celular</strong>
                <p>
                  {installEvent
                    ? 'Adicione o app à tela inicial.'
                    : 'No iPhone: Compartilhar → “Adicionar à Tela de Início”.'}
                </p>
              </div>
              <div className="install-actions">
                {installEvent && (
                  <button className="btn btn-solid" onClick={handleInstall}>Instalar</button>
                )}
                <button className="btn btn-outline" onClick={dismissInstall}>Agora não</button>
              </div>
            </section>
          )}

          <section className="section">
            <h2>Resumo</h2>
            <p className="lede">Visão rápida do estoque compartilhado e do que cada clínica precisa repor.</p>
            {summary && (
              <div className="metro">
                <div className="stat"><strong>{summary.totalUnits}</strong><span>unidades em estoque</span></div>
                <div className={`stat ${summary.alerts ? 'warn' : 'ok'}`}>
                  <strong>{summary.alerts}</strong><span>itens abaixo do mínimo</span>
                </div>
                <div className="stat warn">
                  <strong>{summary.pendingUsageUnits}</strong><span>usos pendentes de compra</span>
                </div>
                <div className="stat">
                  <strong>{summary.totalProducts}</strong><span>códigos cadastrados</span>
                </div>
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="section">
              <h2>Uso por clínica</h2>
              <p className="lede">A clínica compra a quantidade que usou — não só o mínimo.</p>
              <div className="list">
                {CLINICS.map((c) => {
                  const info = summary?.pendingByClinic?.[c];
                  return (
                    <button
                      key={c}
                      className="row"
                      onClick={() => { setClinic(c); setTab('pedidos'); }}
                    >
                      <div>
                        <div className="title">{clinicName(c)}</div>
                        <div className="meta">
                          {info ? `${info.units} un. em ${info.items} itens aguardando pedido` : 'Nenhum uso pendente'}
                        </div>
                      </div>
                      <span className={`badge ${info ? 'buy' : 'ok'}`}>{info ? 'Comprar' : 'OK'}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {tab === 'estoque' && (
        <section className="section" style={{ marginTop: 0 }}>
          <h2 className="brand-mark" style={{ fontSize: '1.8rem', marginBottom: 4 }}>Estoque</h2>
          <p className="lede">
            {isAdmin ? 'Código + quantidade. Toque para entrada ou saída.' : 'Consulta do estoque atual (somente leitura).'}
          </p>
          <div className="toolbar">
            <input
              className="search"
              placeholder="Buscar nome ou código"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="chips" style={{ marginBottom: 12 }}>
            <button className={`chip ${!family ? 'active' : ''}`} onClick={() => setFamily('')}>Todos</button>
            {allFamilies.map((f) => (
              <button key={f} className={`chip ${family === f ? 'active' : ''}`} onClick={() => setFamily(f)}>{f}</button>
            ))}
            <button className={`chip ${status === 'Comprar' ? 'active' : ''}`} onClick={() => setStatus(status === 'Comprar' ? '' : 'Comprar')}>A comprar</button>
          </div>
          <div className="list">
            {products.map((p) => (
              <button
                key={p.id}
                className="row"
                onClick={() => {
                  if (!isAdmin) return;
                  setSelected(p);
                  setAdjustQty(1);
                }}
              >
                <div>
                  <div className="title">{p.name}</div>
                  <div className="meta">Cod. {p.code} · mín. {p.minimum}{p.buy ? ` · faltar ${p.buy}` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="qty">{p.quantity}</div>
                  <span className={`badge ${p.status === 'Comprar' ? 'buy' : 'ok'}`}>{p.status}</span>
                </div>
              </button>
            ))}
            {!products.length && <div className="empty">Nenhum produto encontrado.</div>}
          </div>
        </section>
      )}

      {tab === 'uso' && (
        <section className="section" style={{ marginTop: 0 }}>
          <h2 className="brand-mark" style={{ fontSize: '1.8rem', marginBottom: 4 }}>Registrar uso</h2>
          <p className="lede">
            {isDentist
              ? `Baixa automática na ${clinicName(user.clinic)}.`
              : 'Baixa o estoque e acumula o que a clínica precisa comprar.'}
          </p>

          {isAdmin ? (
            <div className="clinic-switch">
              {CLINICS.map((c) => (
                <button
                  key={c}
                  className={`clinic-btn ${clinic === c ? 'active' : ''}`}
                  onClick={() => setClinic(c)}
                >
                  {clinicName(c)}
                </button>
              ))}
            </div>
          ) : (
            <div className="panel" style={{ marginBottom: 12 }}>
              <strong>{clinicName(user.clinic)}</strong>
              <div className="meta">Seu acesso está vinculado a esta unidade.</div>
            </div>
          )}

          <div className="toolbar">
            <input
              className="search"
              placeholder="Filtrar implante"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="chips" style={{ marginBottom: 12 }}>
            <button className={`chip ${!family ? 'active' : ''}`} onClick={() => setFamily('')}>Todos</button>
            {['HE', 'GM', 'NGM'].map((f) => (
              <button key={f} className={`chip ${family === f ? 'active' : ''}`} onClick={() => setFamily(f)}>{f}</button>
            ))}
          </div>

          <div className="list">
            {products.filter((p) => p.quantity > 0).map((p) => {
              const qty = cart[p.id] || 0;
              return (
                <div key={p.id} className="row">
                  <div>
                    <div className="title">{p.name}</div>
                    <div className="meta">Cod. {p.code} · disponível {p.quantity}</div>
                  </div>
                  <div className="qty-controls">
                    <button onClick={() => bumpCart(p.id, -1, p.quantity)} aria-label="menos">−</button>
                    <span>{qty}</span>
                    <button onClick={() => bumpCart(p.id, 1, p.quantity)} aria-label="mais">+</button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 14, position: 'sticky', bottom: calcSticky(), zIndex: 5 }}>
            <button className="btn btn-accent" disabled={!cartTotal || loading} onClick={submitUsage}>
              Confirmar uso · {cartTotal} un. · {clinicName(isDentist ? user.clinic : clinic)}
            </button>
          </div>
        </section>
      )}

      {tab === 'pedidos' && isAdmin && (
        <section className="section" style={{ marginTop: 0 }}>
          <h2 className="brand-mark" style={{ fontSize: '1.8rem', marginBottom: 4 }}>Pedidos</h2>
          <p className="lede">Gere a compra a partir do uso da clínica, ou pelo mínimo.</p>

          <div className="clinic-switch">
            {CLINICS.map((c) => (
              <button
                key={c}
                className={`clinic-btn ${clinic === c ? 'active' : ''}`}
                onClick={() => setClinic(c)}
              >
                {clinicName(c)}
              </button>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 12 }}>
            <strong>Uso pendente · {clinicName(clinic)}</strong>
            <div className="meta" style={{ margin: '6px 0 10px' }}>
              {pendingForClinic.length
                ? `${pendingForClinic.reduce((s, i) => s + i.quantity, 0)} unidades para comprar`
                : 'Nada pendente — registre usos primeiro'}
            </div>
            {pendingForClinic.map((i) => (
              <div key={`${i.clinic}-${i.product_id}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                <span>{i.name}</span>
                <strong>{i.quantity}</strong>
              </div>
            ))}
            <div className="sheet-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-solid" disabled={!pendingForClinic.length || loading} onClick={createUsageOrder}>
                Gerar pedido pelo uso
              </button>
              <button className="btn btn-outline" disabled={loading} onClick={createMinOrder}>
                Gerar pedido pelo mínimo
              </button>
            </div>
          </div>

          <h2 style={{ marginTop: 18 }}>Histórico</h2>
          <div className="list">
            {orders.map((o) => (
              <button
                key={o.id}
                className="row"
                onClick={() => openOrder(o.id)}
              >
                <div>
                  <div className="title">{clinicName(o.clinic)} · {o.total_units || 0} un.</div>
                  <div className="meta">{formatDate(o.created_at)} · {o.source} · {o.status}</div>
                </div>
                <span className={`badge ${o.status === 'aberto' || o.status === 'parcial' ? 'buy' : 'ok'}`}>{o.status}</span>
              </button>
            ))}
            {!orders.length && <div className="empty">Nenhum pedido ainda.</div>}
          </div>
        </section>
      )}

      {tab === 'relatorio' && (
        <section className="section" style={{ marginTop: 0 }}>
          <h2 className="brand-mark" style={{ fontSize: '1.8rem', marginBottom: 4 }}>Relatório</h2>
          <p className="lede">Uso mensal por clínica — base para a compra do período.</p>

          <div className="toolbar">
            <select
              className="select"
              value={reportMonth}
              onChange={(e) => setReportMonth(e.target.value)}
            >
              {(report?.months || [{ year: Number(reportMonth.slice(0, 4)), month: Number(reportMonth.slice(5)), key: reportMonth }]).map((m) => {
                const label = new Date(Date.UTC(m.year, m.month - 1, 1)).toLocaleDateString('pt-BR', {
                  month: 'long', year: 'numeric', timeZone: 'UTC',
                });
                return <option key={m.key} value={m.key}>{label}</option>;
              })}
            </select>
          </div>

          <div className="chips" style={{ marginBottom: 12 }}>
            {!isDentist && (
              <button className={`chip ${!reportClinic ? 'active' : ''}`} onClick={() => setReportClinic('')}>Todas</button>
            )}
            {(isDentist ? [user.clinic] : CLINICS).map((c) => (
              <button key={c} className={`chip ${reportClinic === c ? 'active' : ''}`} onClick={() => setReportClinic(c)}>
                {c}
              </button>
            ))}
          </div>

          {report && (
            <>
              <div className="metro" style={{ marginBottom: 12 }}>
                <div className="stat">
                  <strong>{report.totalUnits}</strong>
                  <span>unidades no mês</span>
                </div>
                <div className="stat">
                  <strong>{report.clinics.length}</strong>
                  <span>clínicas com uso</span>
                </div>
              </div>

              {!report.clinics.length && (
                <div className="empty">Nenhum uso registrado neste mês.</div>
              )}

              {report.clinics.map((c) => (
                <div key={c.clinic} className="panel report-clinic" style={{ marginBottom: 12 }}>
                  <div className="report-clinic-head">
                    <div>
                      <strong>{clinicName(c.clinic)}</strong>
                      <div className="meta">{c.totalEvents} registros · {c.totalUnits} unidades</div>
                    </div>
                    <span className="qty">{c.totalUnits}</span>
                  </div>
                  <div className="family-bars">
                    {Object.entries(c.byFamily).map(([fam, qty]) => (
                      <div key={fam} className="family-bar">
                        <span>{fam}</span>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${Math.max(8, (qty / c.totalUnits) * 100)}%` }}
                          />
                        </div>
                        <strong>{qty}</strong>
                      </div>
                    ))}
                  </div>
                  {Object.keys(c.byDentist || {}).length > 0 && (
                    <div style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                      {Object.entries(c.byDentist).map(([dentist, qty]) => (
                        <div key={dentist} className="report-item">
                          <span>{dentist}</span>
                          <strong>{qty}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="list" style={{ marginTop: 8 }}>
                    {c.items.map((item) => (
                      <div key={`${c.clinic}-${item.product_id}`} className="report-item">
                        <div>
                          <div className="title">{item.name}</div>
                          <div className="meta">Cod. {item.code} · {item.events}×</div>
                        </div>
                        <strong>{item.quantity}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {report.entries?.length > 0 && (
                <div className="panel" style={{ marginBottom: 12 }}>
                  <strong>Lançamentos por dentista</strong>
                  <div className="meta" style={{ margin: '4px 0 8px' }}>
                    {isAdmin ? 'Admin pode excluir lançamento com erro (devolve ao estoque).' : 'Detalhe do que foi usado no mês.'}
                  </div>
                  <div className="daily-list">
                    {report.entries.map((entry) => (
                      <div key={entry.id} className="report-item" style={{ alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="title">{entry.dentist}</div>
                          <div className="meta">
                            {formatDate(entry.created_at)} · {clinicName(entry.clinic)}
                          </div>
                          <div className="meta">{entry.name} · Cod. {entry.code}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong>{entry.quantity}</strong>
                          {isAdmin && entry.canDelete && (
                            <button
                              className="btn btn-outline"
                              style={{ width: 'auto', minHeight: 32, padding: '0 10px', marginTop: 6, fontSize: '0.75rem' }}
                              disabled={loading}
                              onClick={() => deleteUsageEntry(entry)}
                            >
                              Excluir
                            </button>
                          )}
                          {isAdmin && !entry.canDelete && (
                            <div className="meta">Já recebido</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {report.daily.length > 0 && (
                <div className="panel" style={{ marginBottom: 12 }}>
                  <strong>Por dia</strong>
                  <div className="daily-list">
                    {report.daily.map((d) => (
                      <div key={`${d.day}-${d.clinic}`} className="report-item">
                        <span>{formatDay(d.day)} · {clinicName(d.clinic)}</span>
                        <strong>{d.quantity}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn btn-solid" onClick={copyReport} disabled={!report.totalUnits}>
                Copiar relatório
              </button>
            </>
          )}
        </section>
      )}

      {tab === 'equipe' && isAdmin && (
        <section className="section" style={{ marginTop: 0 }}>
          <h2 className="brand-mark" style={{ fontSize: '1.8rem', marginBottom: 4 }}>Equipe</h2>
          <p className="lede">Cadastre dentistas com senha e clínica para eles darem baixa no uso.</p>

          <form className="panel" onSubmit={handleCreateUser} style={{ marginBottom: 14 }}>
            <strong>Novo acesso</strong>
            <label className="field">
              <span>Nome</span>
              <input className="search" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Login</span>
              <input className="search" autoCapitalize="none" value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} required />
            </label>
            <label className="field">
              <span>Senha</span>
              <input className="search" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required minLength={4} />
            </label>
            <label className="field">
              <span>Clínica</span>
              <select className="select" value={userForm.clinic} onChange={(e) => setUserForm({ ...userForm, clinic: e.target.value })}>
                {CLINICS.map((c) => <option key={c} value={c}>{clinicName(c)}</option>)}
              </select>
            </label>
            <button className="btn btn-solid" disabled={loading} style={{ marginTop: 10 }}>Cadastrar dentista</button>
          </form>

          <div className="list">
            {users.map((u) => (
              <div key={u.id} className="row" style={{ gridTemplateColumns: '1fr' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, width: '100%' }}>
                  <div>
                    <div className="title">{u.name}</div>
                    <div className="meta">
                      @{u.username} · {u.role === 'admin' ? 'admin' : `dentista · ${clinicName(u.clinic)}`}
                      {!u.active ? ' · inativo' : ''}
                    </div>
                  </div>
                  <span className={`badge ${u.active ? 'ok' : 'buy'}`}>{u.active ? 'Ativo' : 'Off'}</span>
                </div>
                {u.role !== 'admin' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, width: '100%' }}>
                    <button className="btn btn-outline" disabled={loading} onClick={() => resetUserPassword(u)}>Editar acesso</button>
                    <button className="btn btn-outline" disabled={loading} onClick={() => toggleUserActive(u)}>
                      {u.active ? 'Desativar' : 'Reativar'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <nav className={`bottom-nav ${isAdmin ? 'bottom-nav-5' : 'bottom-nav-4'}`}>
        <button className={`nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          <IconHome /> Início
        </button>
        <button className={`nav-item ${tab === 'estoque' ? 'active' : ''}`} onClick={() => setTab('estoque')}>
          <IconBox /> Estoque
        </button>
        <button className={`nav-item ${tab === 'uso' ? 'active' : ''}`} onClick={() => { setStatus(''); setTab('uso'); }}>
          <IconUse /> Uso
        </button>
        {isAdmin ? (
          <button className={`nav-item ${tab === 'pedidos' ? 'active' : ''}`} onClick={() => setTab('pedidos')}>
            <IconOrders /> Pedidos
          </button>
        ) : (
          <button className={`nav-item ${tab === 'relatorio' ? 'active' : ''}`} onClick={() => setTab('relatorio')}>
            <IconReport /> Relat.
          </button>
        )}
        {isAdmin ? (
          <button className={`nav-item ${tab === 'equipe' ? 'active' : ''}`} onClick={() => setTab('equipe')}>
            <IconUsers /> Equipe
          </button>
        ) : null}
      </nav>

      {toast && <div className="toast">{toast}</div>}

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>{selected.name}</h3>
            <div className="meta">Cod. {selected.code} · estoque {selected.quantity} · mín. {selected.minimum}</div>
            <div className="qty-controls" style={{ marginBottom: 8 }}>
              <button onClick={() => setAdjustQty((q) => Math.max(1, q - 1))}>−</button>
              <span>{adjustQty}</span>
              <button onClick={() => setAdjustQty((q) => q + 1)}>+</button>
            </div>
            {isAdmin && (
            <div className="sheet-actions">
              <button className="btn btn-solid" disabled={loading} onClick={() => doAdjust('entrada')}>Entrada (+)</button>
              <button className="btn btn-outline" disabled={loading || selected.quantity < adjustQty} onClick={() => doAdjust('saida')}>Saída (−)</button>
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Cancelar</button>
            </div>
          )}
          {!isAdmin && (
            <div className="sheet-actions">
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Fechar</button>
            </div>
          )}
          </div>
        </div>
      )}

      {orderDetail && (
        <div className="modal-backdrop" onClick={() => { setOrderDetail(null); setReceiveQtys({}); }}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Pedido {orderDetail.id}</h3>
            <div className="meta">
              {clinicName(orderDetail.clinic)} · {orderDetail.status} · {formatDate(orderDetail.created_at)}
            </div>

            {orderDetail.status === 'aberto' && orderDetail.items?.length > 0 ? (
              <div className="panel" style={{ marginBottom: 8 }}>
                <strong>Quanto chegou?</strong>
                <div className="meta" style={{ margin: '4px 0 8px' }}>
                  Ajuste se faltar algum implante. O que não chegou volta para “a comprar”.
                </div>
                {orderDetail.items.map((item) => {
                  const received = receiveQtys[item.product_id] ?? item.quantity;
                  return (
                    <div key={item.product_id} className="report-item">
                      <div>
                        <div className="title">{item.name}</div>
                        <div className="meta">Cod. {item.code} · pedido {item.quantity}</div>
                      </div>
                      <div className="qty-controls">
                        <button onClick={() => bumpReceiveQty(item.product_id, -1, item.quantity)}>−</button>
                        <span>{received}</span>
                        <button onClick={() => bumpReceiveQty(item.product_id, 1, item.quantity)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="panel">
                <pre>{orderDetail.text}</pre>
              </div>
            )}

            <div className="sheet-actions">
              {orderDetail.status === 'aberto' && orderDetail.items?.length > 0 && (
                <>
                  <button className="btn btn-accent" disabled={loading} onClick={receiveSelectedOrder}>
                    Confirmar recebimento
                  </button>
                  <button className="btn btn-outline" disabled={loading} onClick={cancelSelectedOrder}>
                    Cancelar pedido
                  </button>
                </>
              )}
              {(orderDetail.status === 'cancelado' || orderDetail.status === 'historico') && (
                <button className="btn btn-outline" disabled={loading} onClick={deleteSelectedOrder}>
                  Excluir pedido
                </button>
              )}
              <button className="btn btn-outline" onClick={() => { setOrderDetail(null); setReceiveQtys({}); }}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calcSticky() {
  return 'calc(var(--nav-h) + var(--safe-bottom) + 8px)';
}
