import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import './index.css';

const CLINICS = ['OC', 'RO'];

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

const TAB_KEYS = ['home', 'estoque', 'uso', 'pedidos', 'relatorio'];

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
  const [tab, setTab] = useState(tabFromHash);
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pending, setPending] = useState([]);
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
  const [allFamilies, setAllFamilies] = useState(['HE', 'GM', 'NGM']);
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
    const [s, p, o, u] = await Promise.all([
      api.summary(),
      api.products({ q: query, family, status }),
      api.orders(),
      api.pendingUsage(),
    ]);
    setSummary(s);
    setProducts(p);
    setOrders(o);
    setPending(u);
  }

  useEffect(() => {
    refreshAll().catch((e) => showToast(e.message));
    setInstalled(isStandalone());
  }, []);

  useEffect(() => {
    const desired = tab === 'home' ? '' : `#${tab}`;
    if (window.location.hash !== desired) {
      window.history.replaceState(null, '', desired || window.location.pathname);
    }
  }, [tab]);

  useEffect(() => {
    function onHash() {
      setTab(tabFromHash());
    }
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    api.products({ q: query, family, status })
      .then(setProducts)
      .catch((e) => showToast(e.message));
  }, [query, family, status]);

  useEffect(() => {
    api.products()
      .then((rows) => setAllFamilies([...new Set(rows.map((p) => p.family))]))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault();
      setInstallEvent(e);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      showToast('Impla instalado no celular');
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
    if (tab !== 'relatorio') return;
    const [year, month] = reportMonth.split('-').map(Number);
    api.monthlyUsage({ year, month, clinic: reportClinic || undefined })
      .then(setReport)
      .catch((e) => showToast(e.message));
  }, [tab, reportMonth, reportClinic]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
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
      await api.registerUsage({ clinic, items: cartItems, note: `Uso clínica ${clinic}` });
      setCart({});
      await refreshAll();
      showToast(`Uso registrado em ${clinic}`);
      setTab('pedidos');
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
      setOrderDetail(await api.order(res.order.id));
      showToast(`Pedido gerado para ${clinic}`);
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
      setOrderDetail(await api.order(res.order.id));
      showToast('Pedido por mínimo gerado');
    } catch (e) {
      showToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function receiveSelectedOrder() {
    if (!orderDetail) return;
    setLoading(true);
    try {
      await api.receiveOrder(orderDetail.id);
      await refreshAll();
      setOrderDetail(null);
      showToast('Pedido recebido — estoque atualizado');
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
    const lines = [`Impla — Uso ${report.label}`, `Total: ${report.totalUnits} unidades`, ''];
    for (const c of report.clinics) {
      lines.push(`Clínica ${c.clinic}: ${c.totalUnits} un.`);
      const families = Object.entries(c.byFamily).map(([k, v]) => `${k} ${v}`).join(' · ');
      if (families) lines.push(`  ${families}`);
      for (const item of c.items) {
        lines.push(`  ${item.code} ${item.name} → ${item.quantity}`);
      }
      lines.push('');
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

  return (
    <div className="app-shell">
      {tab === 'home' && (
        <>
          <section className="hero">
            <div className="brand-mark" style={{ opacity: 0.85, marginBottom: 10, fontSize: '0.95rem' }}>
              Impla
            </div>
            <h1>Estoque vivo por clínica</h1>
            <p>Registre o uso em OC ou RO e compre exatamente o que foi utilizado.</p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => { setStatus(''); setTab('uso'); }}>Registrar uso</button>
              <button className="btn btn-ghost" onClick={() => setTab('relatorio')}>Relatório</button>
            </div>
          </section>

          {showInstall && (
            <section className="install-banner section">
              <div>
                <strong>Instalar no celular</strong>
                <p>
                  {installEvent
                    ? 'Adicione o Impla à tela inicial e use como app.'
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
                      <div className="title">Clínica {c}</div>
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
        </>
      )}

      {tab === 'estoque' && (
        <section className="section" style={{ marginTop: 0 }}>
          <h2 className="brand-mark" style={{ fontSize: '1.8rem', marginBottom: 4 }}>Estoque</h2>
          <p className="lede">Código + quantidade. Toque para entrada ou saída.</p>
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
                onClick={() => { setSelected(p); setAdjustQty(1); }}
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
          <p className="lede">Baixa o estoque e acumula o que a clínica precisa comprar.</p>

          <div className="clinic-switch">
            {CLINICS.map((c) => (
              <button
                key={c}
                className={`clinic-btn ${clinic === c ? 'active' : ''}`}
                onClick={() => setClinic(c)}
              >
                Clínica {c}
              </button>
            ))}
          </div>

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
              Confirmar uso · {cartTotal} un. · {clinic}
            </button>
          </div>
        </section>
      )}

      {tab === 'pedidos' && (
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
                Clínica {c}
              </button>
            ))}
          </div>

          <div className="panel" style={{ marginBottom: 12 }}>
            <strong>Uso pendente · {clinic}</strong>
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
                onClick={async () => {
                  try {
                    setOrderDetail(await api.order(o.id));
                  } catch (e) {
                    showToast(e.message);
                  }
                }}
              >
                <div>
                  <div className="title">{o.clinic} · {o.total_units || 0} un.</div>
                  <div className="meta">{formatDate(o.created_at)} · {o.source} · {o.status}</div>
                </div>
                <span className={`badge ${o.status === 'aberto' ? 'buy' : 'ok'}`}>{o.status}</span>
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
            <button className={`chip ${!reportClinic ? 'active' : ''}`} onClick={() => setReportClinic('')}>Todas</button>
            {CLINICS.map((c) => (
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
                      <strong>Clínica {c.clinic}</strong>
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

              {report.daily.length > 0 && (
                <div className="panel" style={{ marginBottom: 12 }}>
                  <strong>Por dia</strong>
                  <div className="daily-list">
                    {report.daily.map((d) => (
                      <div key={`${d.day}-${d.clinic}`} className="report-item">
                        <span>{formatDay(d.day)} · {d.clinic}</span>
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

      <nav className="bottom-nav bottom-nav-5">
        <button className={`nav-item ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          <IconHome /> Início
        </button>
        <button className={`nav-item ${tab === 'estoque' ? 'active' : ''}`} onClick={() => setTab('estoque')}>
          <IconBox /> Estoque
        </button>
        <button className={`nav-item ${tab === 'uso' ? 'active' : ''}`} onClick={() => { setStatus(''); setTab('uso'); }}>
          <IconUse /> Uso
        </button>
        <button className={`nav-item ${tab === 'pedidos' ? 'active' : ''}`} onClick={() => setTab('pedidos')}>
          <IconOrders /> Pedidos
        </button>
        <button className={`nav-item ${tab === 'relatorio' ? 'active' : ''}`} onClick={() => setTab('relatorio')}>
          <IconReport /> Relat.
        </button>
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
            <div className="sheet-actions">
              <button className="btn btn-solid" disabled={loading} onClick={() => doAdjust('entrada')}>Entrada (+)</button>
              <button className="btn btn-outline" disabled={loading || selected.quantity < adjustQty} onClick={() => doAdjust('saida')}>Saída (−)</button>
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {orderDetail && (
        <div className="modal-backdrop" onClick={() => setOrderDetail(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h3>Pedido {orderDetail.id}</h3>
            <div className="meta">
              {orderDetail.clinic} · {orderDetail.status} · {formatDate(orderDetail.created_at)}
            </div>
            <div className="panel">
              <pre>{orderDetail.text}</pre>
            </div>
            <div className="sheet-actions">
              {orderDetail.status === 'aberto' && orderDetail.items?.length > 0 && (
                <button className="btn btn-accent" disabled={loading} onClick={receiveSelectedOrder}>
                  Marcar como recebido (entra no estoque)
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setOrderDetail(null)}>Fechar</button>
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
