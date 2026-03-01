function limpiarFiltrosPanel() {
    ['flt-rama', 'flt-estado', 'flt-instancia'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderDashboardPanel();
}

function filtrarCausasPanel() {
    const rama = document.getElementById('flt-rama')?.value || '';
    const estado = document.getElementById('flt-estado')?.value || '';
    const instancia = document.getElementById('flt-instancia')?.value || '';
    return DB.causas.filter(c =>
        (!rama || (c.rama || '') === rama) &&
        (!estado || c.estadoGeneral === estado) &&
        (!instancia || (c.instancia || 'Primera') === instancia)
    );
}

function donutSVG(svgId, segments, total) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const cx = 80, cy = 80, R = 60, r = 38;
    if (!total) {
        svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#e4eaf3" stroke-width="22"/>
            <text x="${cx}" y="${cy + 5}" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="IBM Plex Mono,monospace">–</text>`;
        return;
    }
    let angle = -Math.PI / 2;
    let html = '';
    const gap = 0.03;
    segments.forEach(seg => {
        if (!seg.val) return;
        const frac = seg.val / total;
        const sweep = frac * Math.PI * 2 - gap;
        const x1 = cx + R * Math.cos(angle + gap / 2);
        const y1 = cy + R * Math.sin(angle + gap / 2);
        const x2 = cx + R * Math.cos(angle + sweep + gap / 2);
        const y2 = cy + R * Math.sin(angle + sweep + gap / 2);
        const large = sweep > Math.PI ? 1 : 0;
        html += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z" fill="${seg.color}" opacity="0.15"/>`;
        const ix1 = cx + r * Math.cos(angle + gap / 2);
        const iy1 = cy + r * Math.sin(angle + gap / 2);
        const ix2 = cx + r * Math.cos(angle + sweep + gap / 2);
        const iy2 = cy + r * Math.sin(angle + sweep + gap / 2);
        html += `<path d="M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z" fill="${seg.color}"/>`;
        angle += frac * Math.PI * 2;
    });
    html += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" fill="#0f172a" font-size="20" font-weight="700" font-family="IBM Plex Mono,monospace">${total}</text>
             <text x="${cx}" y="${cy + 12}" text-anchor="middle" fill="#64748b" font-size="9" font-family="IBM Plex Sans,sans-serif">TOTAL</text>`;
    svg.innerHTML = html;
}

function donutLegend(elId, segments, total) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (!total) { el.innerHTML = '<div style="color:#94a3b8;font-size:0.78rem;padding:8px 0;">Sin datos</div>'; return; }
    el.innerHTML = segments.filter(s => s.val > 0).map(s =>
        `<div class="db-donut-legend-item">
            <div class="db-donut-legend-dot" style="background:${s.color}"></div>
            <span class="db-donut-legend-label">${s.label}</span>
            <span class="db-donut-legend-val">${s.val}</span>
            <span class="db-donut-legend-pct">${Math.round(s.val / total * 100)}%</span>
        </div>`
    ).join('');
}

function barRama(causas) {
    const el = document.getElementById('bar-rama');
    if (!el) return;
    const ramas = {};
    causas.forEach(c => {
        const k = c.rama || 'Sin rama';
        if (!ramas[k]) ramas[k] = { activas: 0, fin: 0 };
        if (c.estadoGeneral === 'Finalizada') ramas[k].fin++;
        else ramas[k].activas++;
    });
    const items = Object.entries(ramas).sort((a, b) => (b[1].activas + b[1].fin) - (a[1].activas + a[1].fin));
    const maxVal = Math.max(...items.map(([, v]) => v.activas + v.fin), 1);
    if (!items.length) { el.innerHTML = '<div style="color:#94a3b8;font-size:0.8rem;padding:20px 0;text-align:center;">Sin causas</div>'; return; }
    el.innerHTML = items.map(([rama, v]) => {
        const total = v.activas + v.fin;
        const wA = (v.activas / maxVal * 100).toFixed(1);
        const wB = (v.fin / maxVal * 100).toFixed(1);
        return `<div class="db-bar-row">
            <div class="db-bar-label" title="${rama}">${rama}</div>
            <div class="db-bar-track">
                <div class="db-bar-fill-a" style="width:${wA}%"></div>
                <div class="db-bar-fill-b" style="width:${wB}%"></div>
            </div>
            <div class="db-bar-val">${total}</div>
        </div>`;
    }).join('');
}

function barCuantia(causas) {
    const el = document.getElementById('bar-cuantia');
    if (!el) return;
    const grupos = {};
    causas.forEach(c => {
        const k = c.estadoGeneral || 'Sin estado';
        if (!grupos[k]) grupos[k] = 0;
        grupos[k] += (c.honorarios?.montoBase || 0);
    });
    const items = Object.entries(grupos).sort((a, b) => b[1] - a[1]);
    const maxVal = Math.max(...items.map(([, v]) => v), 1);
    if (!items.length || items.every(([, v]) => !v)) {
        el.innerHTML = '<div style="color:#94a3b8;font-size:0.78rem;padding:10px 0;text-align:center;">Sin honorarios registrados</div>'; return;
    }
    el.innerHTML = items.map(([estado, monto]) => {
        const w = (monto / maxVal * 100).toFixed(1);
        const fmt = monto >= 1000000 ? `$${(monto / 1000000).toFixed(1)}M` : monto >= 1000 ? `$${(monto / 1000).toFixed(0)}K` : `$${monto}`;
        return `<div class="db-bar-row">
            <div class="db-bar-label">${estado}</div>
            <div class="db-bar-track"><div class="db-bar-fill-a" style="width:${w}%"></div></div>
            <div class="db-bar-val">${fmt}</div>
        </div>`;
    }).join('');
}

/**
 * Renderiza el panel principal del dashboard: KPIs, distribución por rama,
 * causas urgentes del día y gráficos SVG nativos de tendencia.
 * Se llama automáticamente en tab('dashboard') y en actualizarSistema().
 * No recibe parámetros: lee toda la data directamente desde Store/DB.
 */
function renderDashboardPanel() {
    const causas = filtrarCausasPanel();
    const total = causas.length;

    // — Fecha —
    const fechaEl = document.getElementById('db-fecha-hoy');
    if (fechaEl) fechaEl.textContent = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // — KPIs —
    const activas = causas.filter(c => c.estadoGeneral !== 'Finalizada').length;
    const alertCrit = DB.alertas.filter(a => a.estado === 'activa' && (a.prioridad === 'critica' || a.prioridad === 'alta')).length;
    const clientes = DB.clientes.length;
    const avance = total ? Math.round(causas.reduce((s, c) => s + (c.porcentajeAvance || 0), 0) / total) : 0;
    const econ = calcularIndicadoresEconomicos();
    const fmtCLP = n => n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : `$${n}`;

    const setKPI = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setKPI('kpi-causas', activas);
    setKPI('kpi-alertas', alertCrit);
    setKPI('kpi-clientes', clientes);
    setKPI('kpi-avance', avance + '%');
    setKPI('kpi-facturado', fmtCLP(econ.totalFacturado));
    setKPI('kpi-pendiente', fmtCLP(econ.totalPendiente || 0));

    // — Legacy stats (otros módulos los usan) —
    setKPI('st-ca', activas);
    setKPI('st-pr', DB.prospectos.length);
    setKPI('st-al', DB.alertas.filter(a => a.estado === 'activa').length);
    setKPI('st-ju', DB.jurisprudencia.length);
    setKPI('st-do', DB.documentos.length);

    // — Donut: Estado —
    const porEstado = {};
    causas.forEach(c => { const k = c.estadoGeneral || 'Sin estado'; porEstado[k] = (porEstado[k] || 0) + 1; });
    const ESTADO_COLORS = { 'En tramitación': ['#1a3a6b', '#2563a8'], 'Finalizada': ['#0d7a5f', '#10b981'], 'Suspendida': ['#b45309', '#f59e0b'] };
    const segsEstado = Object.entries(porEstado).map(([k, v], i) => ({
        label: k, val: v, color: (ESTADO_COLORS[k] || ['#64748b'])[0]
    }));
    donutSVG('donut-estado', segsEstado, total);
    donutLegend('legend-estado', segsEstado, total);

    // — Donut: Instancia —
    const porInstancia = {};
    causas.forEach(c => { const k = c.instancia || 'Primera'; porInstancia[k] = (porInstancia[k] || 0) + 1; });
    const INST_COLORS = { 'Primera': '#1a3a6b', 'Segunda': '#c0392b', 'Casación': '#b45309', 'Corte Suprema': '#0d7a5f' };
    const segsInst = Object.entries(porInstancia).map(([k, v]) => ({ label: k, val: v, color: INST_COLORS[k] || '#64748b' }));
    donutSVG('donut-instancia', segsInst, total);
    donutLegend('legend-instancia', segsInst, total);

    // — Donut: Alertas —
    const alertas = DB.alertas.filter(a => a.estado === 'activa');
    const porPrio = { critica: 0, alta: 0, media: 0, baja: 0 };
    alertas.forEach(a => { if (porPrio[a.prioridad] !== undefined) porPrio[a.prioridad]++; else porPrio.media++; });
    const segsAlert = [
        { label: 'Crítica', val: porPrio.critica, color: '#c0392b' },
        { label: 'Alta', val: porPrio.alta, color: '#e67e22' },
        { label: 'Media', val: porPrio.media, color: '#f59e0b' },
        { label: 'Baja', val: porPrio.baja, color: '#0d7a5f' },
    ];
    donutSVG('donut-alertas', segsAlert, alertas.length);
    donutLegend('legend-alertas', segsAlert, alertas.length);

    // — Barras —
    barRama(causas);
    barCuantia(causas);
}

// ── Parche: init() también llama renderDashboardPanel ──────────────────
// (parche eliminado — init() consolidada abajo)

// ████████████████████████████████████████████████████████████████████
