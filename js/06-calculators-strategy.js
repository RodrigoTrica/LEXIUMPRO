
        // ─── UI PUENTE BLOQUE 9 ──────────────────────────────────────────

        // ═══════════════════════════════════════════════════════════════
        // MÓDULO 1 — SEMÁFORO DE PLAZOS CRÍTICOS
        // ═══════════════════════════════════════════════════════════════

        function renderSemaforoPlazos() {
            const el = document.getElementById('semaforo-plazos');
            const elGlobal = document.getElementById('semaforo-global-bar');
            if (!el) return;

            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            const plazos = [];

            // Recolectar todos los plazos activos
            DB.documentos.forEach(d => {
                if (!d.generaPlazo || !d.fechaVencimiento) return;
                const causa = DB.causas.find(c => c.id === d.causaId);
                const fv = new Date(d.fechaVencimiento + 'T12:00:00');
                const dias = Math.ceil((fv - hoy) / 86400000);
                plazos.push({
                    titulo: d.descripcion || d.nombreOriginal || d.nombreSistema || 'Documento sin nombre',
                    causa: causa?.caratula || '—',
                    dias,
                    fecha: fv.toLocaleDateString('es-CL')
                });
            });

            DB.alertas.filter(a => a.estado === 'activa' && a.tipo === 'plazo').forEach(a => {
                const causa = DB.causas.find(c => c.id === a.causaId);
                const fv = new Date(a.fechaObjetivo);
                const dias = Math.ceil((fv - hoy) / 86400000);
                plazos.push({
                    titulo: a.mensaje,
                    causa: causa?.caratula || '—',
                    dias,
                    fecha: fv.toLocaleDateString('es-CL')
                });
            });

            plazos.sort((a, b) => a.dias - b.dias);

            // Semáforo global
            const criticos = plazos.filter(p => p.dias >= 0 && p.dias <= 3).length;
            const urgentes = plazos.filter(p => p.dias > 3 && p.dias <= 10).length;
            const vencidos = plazos.filter(p => p.dias < 0).length;
            const ok = plazos.filter(p => p.dias > 10).length;

            if (elGlobal) {
                const verde = elGlobal.querySelector('#sg-verde');
                const amarillo = elGlobal.querySelector('#sg-amarillo');
                const rojo = elGlobal.querySelector('#sg-rojo');
                const texto = elGlobal.querySelector('#sg-texto');
                const cuenta = elGlobal.querySelector('#sg-cuenta');

                verde.classList.toggle('inactiva', criticos > 0 || urgentes > 0 || vencidos > 0);
                amarillo.classList.toggle('inactiva', criticos > 0 || vencidos > 0);
                rojo.classList.toggle('inactiva', criticos === 0 && vencidos === 0);

                if (vencidos > 0) {
                    texto.innerHTML = `<strong style="color:var(--d)">⚠️ ${vencidos} plazo(s) VENCIDO(S)</strong> — Requiere atención inmediata`;
                    cuenta.style.color = 'var(--d)';
                    cuenta.textContent = `+${criticos + vencidos} críticos`;
                } else if (criticos > 0) {
                    texto.innerHTML = `<strong style="color:var(--d)">${criticos} plazo(s) crítico(s)</strong> (≤3 días) — Acción urgente requerida`;
                    cuenta.style.color = 'var(--d)';
                    cuenta.textContent = `${criticos} urgente(s)`;
                } else if (urgentes > 0) {
                    texto.innerHTML = `<strong style="color:var(--w)">${urgentes} plazo(s) próximo(s)</strong> (≤10 días) — Revisar agenda`;
                    cuenta.style.color = 'var(--w)';
                    cuenta.textContent = `${urgentes} pendiente(s)`;
                } else if (ok > 0) {
                    texto.innerHTML = `<span style="color:var(--s)">✓ ${ok} plazo(s) bajo control</span> — Despacho en orden`;
                    cuenta.style.color = 'var(--s)';
                    cuenta.textContent = '';
                } else {
                    texto.textContent = 'Sin plazos activos registrados';
                    cuenta.textContent = '';
                }
            }

            if (!plazos.length) {
                el.innerHTML = '<div class="empty-state" style="padding:20px;"><i class="fas fa-check-circle" style="color:var(--s)"></i><p>Sin plazos activos.</p></div>';
                return;
            }

            el.innerHTML = plazos.slice(0, 10).map(p => {
                const clase = p.dias < 0 ? 'vencido' : p.dias <= 3 ? 'rojo' : p.dias <= 10 ? 'amarillo' : 'verde';
                const pct = p.dias < 0 ? 100 : Math.max(0, Math.min(100, 100 - (p.dias / 30) * 100));
                const label = p.dias < 0 ? `VENCIDO hace ${Math.abs(p.dias)}d` : p.dias === 0 ? 'VENCE HOY' : `${p.dias} día(s)`;
                return `<div class="semaforo-item ${clase}">
            <div class="semaforo-dot"></div>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; font-size:0.85rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escHtml(p.titulo)}</div>
                <div style="font-size:0.73rem; opacity:0.75;">${escHtml(p.causa)} · ${p.fecha}</div>
            </div>
            <div class="semaforo-dias" style="color:${p.dias < 0 ? '#fca5a5' : p.dias <= 3 ? 'var(--d)' : p.dias <= 10 ? 'var(--w)' : 'var(--s)'};">${label}</div>
            <div class="semaforo-bar" style="width:${pct}%;"></div>
        </div>`;
            }).join('');
        }

        // ═══════════════════════════════════════════════════════════════
        // MÓDULO 2 — CUANTÍA DINÁMICA CON IPC E INTERESES
        // ═══════════════════════════════════════════════════════════════

        // IPC mensual promedio Chile (referencial histórico últimos años, no usar para cálculos oficiales)
        const IPC_MENSUAL_REF = 0.0045; // ~0.45% mensual promedio referencial
        const UF_ACTUAL_REF = 37800; // valor UF referencial, actualizar según Banco Central

        function calcularCuantia() {
            const monto = parseFloat(document.getElementById('cq-monto').value) || 0;
            const fecha = document.getElementById('cq-fecha').value;
            const tipo = document.getElementById('cq-tipo').value;
            const honTipo = document.getElementById('cq-hon-tipo').value;
            const honVal = parseFloat(document.getElementById('cq-hon-val').value) || 0;
            const el = document.getElementById('cq-resultado');
            const elGrafico = document.getElementById('cq-grafico');

            if (!monto || !fecha) {
                el.innerHTML = '<p style="color:var(--t2); font-size:0.83rem;">Ingrese monto y fecha para calcular.</p>';
                if (elGrafico) elGrafico.innerHTML = '';
                return;
            }

            const hoy = new Date();
            const inicio = new Date(fecha + 'T12:00:00');
            const mesesTranscurridos = Math.max(0, Math.floor((hoy - inicio) / (30.44 * 24 * 3600 * 1000)));

            let montoAjustado = monto;
            let factorTotal = 1;
            let descripcion = '';
            let tasaMensual = 0;

            switch (tipo) {
                case 'ipc':
                    tasaMensual = IPC_MENSUAL_REF;
                    factorTotal = Math.pow(1 + IPC_MENSUAL_REF, mesesTranscurridos);
                    montoAjustado = monto * factorTotal;
                    descripcion = `IPC referencial ${(IPC_MENSUAL_REF * 100).toFixed(2)}%/mes · ${mesesTranscurridos} mes(es)`;
                    break;
                case 'interes_legal':
                    tasaMensual = 0.005;
                    factorTotal = 1 + (0.005 * mesesTranscurridos);
                    montoAjustado = monto * factorTotal;
                    descripcion = `Interés legal 0.5%/mes · ${mesesTranscurridos} mes(es)`;
                    break;
                case 'interes_corriente':
                    tasaMensual = 0.012;
                    factorTotal = Math.pow(1 + 0.012, mesesTranscurridos);
                    montoAjustado = monto * factorTotal;
                    descripcion = `Interés corriente ~1.2%/mes · ${mesesTranscurridos} mes(es)`;
                    break;
                case 'ipc_interes':
                    tasaMensual = IPC_MENSUAL_REF + 0.005;
                    factorTotal = Math.pow(1 + IPC_MENSUAL_REF, mesesTranscurridos) * (1 + 0.005 * mesesTranscurridos);
                    montoAjustado = monto * factorTotal;
                    descripcion = `IPC + Interés legal · ${mesesTranscurridos} mes(es)`;
                    break;
                case 'uf':
                    const montoenUF = monto / UF_ACTUAL_REF;
                    montoAjustado = montoenUF * UF_ACTUAL_REF * (1 + IPC_MENSUAL_REF * mesesTranscurridos);
                    factorTotal = montoAjustado / monto;
                    descripcion = `Equivalente a ${montoenUF.toFixed(2)} UF (ref. $${UF_ACTUAL_REF.toLocaleString('es-CL')}/UF)`;
                    break;
            }

            const incremento = montoAjustado - monto;
            const pctIncremento = ((factorTotal - 1) * 100).toFixed(1);

            // Calcular honorario
            let honorario = 0;
            let honDesc = '';
            if (honVal > 0) {
                if (honTipo === 'pct') {
                    honorario = montoAjustado * (honVal / 100);
                    honDesc = `${honVal}% sobre monto ajustado`;
                } else if (honTipo === 'fijo') {
                    honorario = honVal;
                    honDesc = 'Monto fijo';
                } else {
                    honorario = calcularHonorarioEscala(montoAjustado);
                    honDesc = 'Escala escalonada sobre monto ajustado';
                }
            }

            el.innerHTML = `
        <div class="cuantia-resultado">
            <h3>Monto Original</h3>
            <div style="font-family:'IBM Plex Mono',monospace; color:#93c5fd; margin-bottom:8px;">$${monto.toLocaleString('es-CL')}</div>
            <h3>Monto Ajustado a Hoy</h3>
            <div class="cuantia-monto">$${Math.round(montoAjustado).toLocaleString('es-CL')}</div>
            <div class="ipc-badge"><i class="fas fa-arrow-up"></i> +${pctIncremento}% · +$${Math.round(incremento).toLocaleString('es-CL')}</div>
            <table class="cuantia-tabla" style="margin-top:12px;">
                <thead><tr><th>Concepto</th><th>Valor</th></tr></thead>
                <tbody>
                    <tr><td>Método</td><td>${escHtml(descripcion)}</td></tr>
                    <tr><td>Meses transcurridos</td><td>${mesesTranscurridos}</td></tr>
                    <tr><td>Factor de ajuste</td><td>${factorTotal.toFixed(4)}x</td></tr>
                    ${honorario > 0 ? `<tr><td>Honorario estimado (${escHtml(honDesc)})</td><td style="color:#34d399;">$${Math.round(honorario).toLocaleString('es-CL')}</td></tr>` : ''}
                    ${honorario > 0 ? `<tr><td><strong>Total estimado (cuantía + honorario)</strong></td><td><strong>$${Math.round(montoAjustado + honorario).toLocaleString('es-CL')}</strong></td></tr>` : ''}
                </tbody>
            </table>
        </div>`;

            // Gráfico de barras en SVG simple
            if (elGrafico && mesesTranscurridos > 0) {
                const puntos = [];
                const pasos = Math.min(mesesTranscurridos, 12);
                for (let i = 0; i <= pasos; i++) {
                    const m = Math.floor((mesesTranscurridos / pasos) * i);
                    let val;
                    switch (tipo) {
                        case 'ipc': val = monto * Math.pow(1 + IPC_MENSUAL_REF, m); break;
                        case 'interes_legal': val = monto * (1 + 0.005 * m); break;
                        case 'interes_corriente': val = monto * Math.pow(1 + 0.012, m); break;
                        case 'ipc_interes': val = monto * Math.pow(1 + IPC_MENSUAL_REF, m) * (1 + 0.005 * m); break;
                        default: val = monto * (1 + IPC_MENSUAL_REF * m);
                    }
                    puntos.push({ m, val });
                }
                const maxVal = Math.max(...puntos.map(p => p.val));
                const W = 100, H = 120, pad = 10;
                const barW = (W - pad * 2) / puntos.length - 1;
                const barColor = i => i === puntos.length - 1 ? '#60a5fa' : '#1e3a5f';
                const svg = `<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" style="width:100%; height:160px;">
            <rect width="100" height="130" fill="#0a0f1e" rx="6"/>
            ${puntos.map((p, i) => {
                    const bh = Math.max(2, ((p.val / maxVal) * (H - pad)));
                    const x = pad + i * ((W - pad * 2) / puntos.length);
                    const y = H - bh + pad;
                    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${barColor(i)}" rx="1"/>`;
                }).join('')}
            <text x="50" y="126" text-anchor="middle" font-size="4" fill="#64748b">Evolución mensual (mes 0 → ${mesesTranscurridos})</text>
        </svg>`;
                elGrafico.innerHTML = svg;
            } else if (elGrafico) {
                elGrafico.innerHTML = '<p style="color:var(--t2); font-size:0.82rem; padding:20px;">El gráfico aparece cuando hay meses transcurridos.</p>';
            }
        }

        // ─── Calculadora Pro Logic ────────────────────────────────────────
        function cpRecalcular() {
            const monto = parseFloat(document.getElementById('cp-monto').value) || 0;
            const moneda = document.getElementById('cp-moneda').value;
            const fecha = document.getElementById('cp-fecha-inicio').value;
            const reajuste = document.getElementById('cp-reajuste').value;

            const uf = parseFloat(document.getElementById('cp-uf-valor').value) || UF_ACTUAL_REF;
            const utm = parseFloat(document.getElementById('cp-utm-valor').value) || 65000;
            const ipcNominal = parseFloat(document.getElementById('cp-ipc-valor').value) / 100 || 0.0045;
            const intLegal = parseFloat(document.getElementById('cp-int-valor').value) / 100 || 0.005;

            const resEl = document.getElementById('cp-resultado');
            if (!monto) {
                resEl.innerHTML = '<p style="text-align:center; color:var(--text-3); padding:20px; background:var(--bg); border-radius:8px;">Ingrese monto para calcular</p>';
                return;
            }

            let montoCLP = monto;
            if (moneda === 'uf') montoCLP = monto * uf;
            if (moneda === 'utm') montoCLP = monto * utm;

            let montoAjustado = montoCLP;
            let meses = 0;
            let glosa = '';

            if (fecha) {
                const hoy = new Date();
                const inicio = new Date(fecha + 'T12:00:00');
                meses = Math.max(0, Math.floor((hoy - inicio) / (30.44 * 24 * 3600 * 1000)));

                switch (reajuste) {
                    case 'ipc':
                        montoAjustado = montoCLP * Math.pow(1 + ipcNominal, meses);
                        glosa = `Reajuste IPC (${(ipcNominal * 100).toFixed(2)}% mes)`;
                        break;
                    case 'interes_legal':
                        montoAjustado = montoCLP * (1 + (intLegal * meses));
                        glosa = `Interés Legal (${(intLegal * 100).toFixed(1)}% mensual)`;
                        break;
                    case 'interes_corriente':
                        montoAjustado = montoCLP * Math.pow(1 + 0.012, meses);
                        glosa = `Interés Corriente (1.2% mensual)`;
                        break;
                    case 'mix':
                        montoAjustado = montoCLP * Math.pow(1 + ipcNominal, meses) * (1 + (intLegal * meses));
                        glosa = `IPC + Interés Legal`;
                        break;
                }
            }

            resEl.innerHTML = `
                <div style="text-align:center; padding:15px; background:var(--bg); border-radius:12px; border:1px solid var(--border);">
                    <div style="font-size:0.75rem; color:var(--text-3); text-transform:uppercase; letter-spacing:0.05em; margin-bottom:4px;">Equivalente hoy</div>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--cyan);">$${Math.round(montoAjustado).toLocaleString('es-CL')}</div>
                    <div style="margin-top:10px; font-size:0.85rem; color:var(--text-2);">
                        ${glosa ? `<strong>${glosa}</strong><br>` : ''}
                        Monto original: $${Math.round(montoCLP).toLocaleString('es-CL')} 
                        ${moneda !== 'clp' ? `(${monto} ${moneda.toUpperCase()})` : ''}
                    </div>
                    ${meses > 0 ? `<div style="margin-top:5px; font-size:0.78rem; color:var(--text-3);">${meses} meses transcurridos</div>` : ''}
                </div>
            `;
        }

        function calcularHonorarioEscala(monto) {
            const tramos = [
                { hasta: 10000000, pct: 0.20 },
                { hasta: 50000000, pct: 0.15 },
                { hasta: 200000000, pct: 0.10 },
                { hasta: Infinity, pct: 0.07 }
            ];
            let hon = 0, restante = monto, prev = 0;
            for (const t of tramos) {
                if (restante <= 0) break;
                const tramo = Math.min(restante, t.hasta - prev);
                hon += tramo * t.pct;
                restante -= tramo; prev = t.hasta;
            }
            return hon;
        }

        // ═══════════════════════════════════════════════════════════════
        // MÓDULO 3 — IA DE CATEGORIZACIÓN MEJORADA
        // ═══════════════════════════════════════════════════════════════

        // Extender IA_PHRASES con más patrones y autoselección de etapa procesal
        const IA_EXTRA_PHRASES = [
            { re: /demanda|escrito.inici|deduccion|libelo/i, etapa: 'Demanda interpuesta', plazo: 15, tipo: 'Escrito', msg: '📋 Demanda detectada → Etapa: Discusión · Plazo contestación: 15 días hábiles (Art. 258 CPC)' },
            { re: /contestacion|respuesta.demanda|defensa/i, etapa: 'Contestación', plazo: null, tipo: 'Escrito', msg: '📋 Contestación detectada → Etapa: Discusión completada' },
            { re: /resolucion|sentencia.interl|auto/i, etapa: 'Resolución recibida', plazo: 5, tipo: 'Resolución', msg: '⚖️ Resolución detectada → Plazo reposición: 5 días (Art. 181 CPC)' },
            { re: /sentencia.definitiva|fallo.definitivo/i, etapa: 'Sentencia definitiva', plazo: 10, tipo: 'Sentencia', msg: '🏛️ Sentencia definitiva → Plazo apelación: 10 días (Art. 189 CPC)' },
            { re: /apelacion|recurso.ape/i, etapa: 'Recurso interpuesto', plazo: null, tipo: 'Escrito', msg: '📎 Recurso de apelación detectado → Etapa: Segunda instancia' },
            { re: /prueba|probat|peritaje|perito/i, etapa: 'Recepción a prueba', plazo: 20, tipo: 'Prueba', msg: '🔍 Documento probatorio → Etapa: Prueba · Término ordinario: 20 días (Art. 328 CPC)' },
            { re: /notificacion|cedula|receptor/i, etapa: 'Notificación', plazo: null, tipo: 'Notificación', msg: '📬 Notificación detectada → Registrar fecha para cómputo de plazos' },
            { re: /laboral|despido|finiquito|contrato.trabajo/i, etapa: 'Demanda interpuesta', plazo: 60, tipo: 'Escrito', msg: '👷 Materia laboral → Plazo prescripción acción: 60 días (Art. 510 CT)' },
            { re: /cautelar|medida.precautoria|embargo/i, etapa: 'Medida cautelar', plazo: null, tipo: 'Resolución', msg: '🔒 Medida cautelar → Verificar notificación y alzamiento' },
            { re: /avenimiento|conciliacion|mediacion|acuerdo/i, etapa: 'Conciliación', plazo: null, tipo: 'Resolución', msg: '🤝 Acuerdo/conciliación → Verificar aprobación judicial' },
        ];

        function gaIAHintFromNameV2(fname) {
            const lower = fname.toLowerCase();
            const hint = document.getElementById('ga-ia-hint');
            const text = document.getElementById('ga-ia-text');
            if (!hint || !text) return;

            for (const ph of IA_EXTRA_PHRASES) {
                if (ph.re.test(lower)) {
                    hint.classList.add('visible');
                    const chips = `
                <div style="margin-bottom:6px; font-weight:600; font-size:0.82rem;">${ph.msg}</div>
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
                    ${ph.etapa ? `<span class="ia-chip" onclick="gaAplicarSugerencia('etapa','${escHtml(ph.etapa)}')">📌 Etapa: ${escHtml(ph.etapa)}</span>` : ''}
                    ${ph.tipo ? `<span class="ia-chip" onclick="gaAplicarSugerencia('tipo','${escHtml(ph.tipo)}')">🗂️ Tipo: ${escHtml(ph.tipo)}</span>` : ''}
                    ${ph.plazo ? `<span class="ia-chip" onclick="gaAplicarSugerencia('plazo',${ph.plazo})">⏱️ Sugerir plazo: ${ph.plazo}d</span>` : ''}
                </div>`;
                    text.innerHTML = chips;
                    return;
                }
            }

            // Fallback al sistema original si existe
            if (typeof IA_PHRASES !== 'undefined') {
                for (const ph of IA_PHRASES) {
                    const match = lower.match(ph.re);
                    if (match) {
                        hint.classList.add('visible');
                        text.innerHTML = `<strong>Sugerencia IA:</strong> ${ph.msg(match)}`;
                        if (ph.dias) {
                            document.getElementById('ga-genera-plazo').checked = true;
                            document.getElementById('ga-plazo-extra').classList.add('visible');
                            document.getElementById('ga-dias').value = ph.dias;
                            if (typeof gaPreviewPlazo === 'function') gaPreviewPlazo();
                        }
                        return;
                    }
                }
            }
            hint.classList.remove('visible');
        }

        function gaAplicarSugerencia(campo, valor) {
            const chips = document.querySelectorAll('.ia-chip');
            chips.forEach(c => { if (c.onclick?.toString().includes(valor)) c.classList.add('applied'); });

            if (campo === 'etapa') {
                const etapaEl = document.getElementById('ga-etapa');
                if (etapaEl) etapaEl.value = valor;
            } else if (campo === 'tipo') {
                const tipoEl = document.getElementById('ga-tipo');
                if (tipoEl) tipoEl.value = valor;
            } else if (campo === 'plazo') {
                const genPlazo = document.getElementById('ga-genera-plazo');
                const diasEl = document.getElementById('ga-dias');
                if (genPlazo) { genPlazo.checked = true; if (typeof gaTogglePlazo === 'function') gaTogglePlazo(); }
                if (diasEl) { diasEl.value = valor; if (typeof gaPreviewPlazo === 'function') gaPreviewPlazo(); }
            }
        }

        // Sobreescribir gaIAHintFromName con la versión mejorada
        window.gaIAHintFromName = gaIAHintFromNameV2;

        // ═══════════════════════════════════════════════════════════════
        // MÓDULO 4 — FICHAS DE ESTRATEGIA
        // ═══════════════════════════════════════════════════════════════

        let _fichaTagsActivos = { hechos: [], derecho: [], evidencia: [] };

        function toggleTag(el, categoria) {
            const val = el.dataset.val;
            const idx = _fichaTagsActivos[categoria].indexOf(val);
            if (idx >= 0) {
                _fichaTagsActivos[categoria].splice(idx, 1);
                el.classList.remove('activo');
            } else {
                _fichaTagsActivos[categoria].push(val);
                el.classList.add('activo');
            }
            calcularProbabilidad();
        }

        function calcularProbabilidad() {
            const hechos = document.getElementById('fe-hechos')?.value.trim() || '';
            const derecho = document.getElementById('fe-derecho')?.value.trim() || '';
            const evidencia = document.getElementById('fe-evidencia')?.value.trim() || '';
            const riesgos = document.getElementById('fe-riesgos')?.value.trim() || '';

            if (!hechos && !derecho && !evidencia) {
                const fill = document.getElementById('fe-prob-fill');
                const valor = document.getElementById('fe-prob-valor');
                const label = document.getElementById('fe-prob-label');
                if (fill) fill.style.width = '0%';
                if (valor) valor.textContent = '—';
                if (label) label.textContent = 'Complete la ficha para calcular';
                return;
            }

            // Sistema de puntuación ponderado
            let puntaje = 0;
            const factores = [];

            // Hechos (25 pts)
            if (hechos.length > 50) { puntaje += 10; factores.push({ label: 'Hechos descritos', pts: 10, max: 25, color: 'var(--s)' }); }
            if (_fichaTagsActivos.hechos.includes('documentados')) { puntaje += 8; factores.push({ label: 'Hechos documentados', pts: 8, max: 25 }); }
            if (_fichaTagsActivos.hechos.includes('testigos')) { puntaje += 4; }
            if (_fichaTagsActivos.hechos.includes('cronologia_clara')) { puntaje += 3; }

            // Derecho (30 pts)
            if (derecho.length > 50) { puntaje += 10; factores.push({ label: 'Fundamento jurídico', pts: 10, max: 30 }); }
            if (_fichaTagsActivos.derecho.includes('norma_expresa')) { puntaje += 8; factores.push({ label: 'Norma expresa aplicable', pts: 8, max: 30 }); }
            if (_fichaTagsActivos.derecho.includes('jurisprudencia_favor')) { puntaje += 7; factores.push({ label: 'Jurisprudencia favorable', pts: 7, max: 30 }); }
            if (_fichaTagsActivos.derecho.includes('doctrina_uniforme')) { puntaje += 5; }

            // Evidencia (30 pts)
            if (evidencia.length > 30) { puntaje += 10; factores.push({ label: 'Medios probatorios', pts: 10, max: 30 }); }
            if (_fichaTagsActivos.evidencia.includes('prueba_documental')) { puntaje += 10; factores.push({ label: 'Prueba documental', pts: 10, max: 30 }); }
            if (_fichaTagsActivos.evidencia.includes('prueba_pericial')) { puntaje += 7; }
            if (_fichaTagsActivos.evidencia.includes('prueba_testimonial')) { puntaje += 5; }

            // Penalización por riesgos (hasta -15 pts)
            if (riesgos.length > 20) { puntaje -= 5; }
            if (riesgos.length > 100) { puntaje -= 10; }

            const prob = Math.max(5, Math.min(95, puntaje));

            const colorProb = prob >= 70 ? 'var(--s)' : prob >= 45 ? 'var(--w)' : 'var(--d)';
            const labelProb = prob >= 70 ? '🟢 Alta probabilidad de éxito' : prob >= 45 ? '🟡 Probabilidad moderada' : '🔴 Probabilidad baja — reforzar argumentos';

            const fill = document.getElementById('fe-prob-fill');
            const valor = document.getElementById('fe-prob-valor');
            const label = document.getElementById('fe-prob-label');
            const detalle = document.getElementById('fe-prob-detalle');
            const factoresEl = document.getElementById('fe-factores');

            if (fill) { fill.style.width = prob + '%'; fill.style.background = colorProb; }
            if (valor) { valor.textContent = prob + '%'; valor.style.color = colorProb; }
            if (label) label.textContent = labelProb;
            if (detalle) detalle.innerHTML = `<span style="color:${colorProb}; font-weight:600;">${prob}% estimado</span> basado en ${factores.length} factor(es) evaluados. Valor referencial — no constituye pronóstico legal.`;

            if (factoresEl && factores.length) {
                factoresEl.innerHTML = `<div style="font-size:0.75rem; color:var(--t2); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.06em;">Factores positivos</div>` +
                    factores.map(f => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0; font-size:0.78rem; border-bottom:1px solid #f1f5f9;">
                <span style="color:var(--t1);">${escHtml(f.label)}</span>
                <span style="font-family:'IBM Plex Mono',monospace; color:var(--s); font-weight:700;">+${f.pts} pts</span>
            </div>`).join('');
            }
        }

        function cargarFichaEstrategia() {
            const causaId = parseInt(document.getElementById('fe-causa-sel')?.value);
            if (!causaId) return;
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa?.estrategia?.ficha) return;
            const f = causa.estrategia.ficha;
            if (document.getElementById('fe-hechos')) document.getElementById('fe-hechos').value = f.hechos || '';
            if (document.getElementById('fe-derecho')) document.getElementById('fe-derecho').value = f.derecho || '';
            if (document.getElementById('fe-evidencia')) document.getElementById('fe-evidencia').value = f.evidencia || '';
            if (document.getElementById('fe-riesgos')) document.getElementById('fe-riesgos').value = f.riesgos || '';
            _fichaTagsActivos = f.tags || { hechos: [], derecho: [], evidencia: [] };
            // Restaurar tags activos
            document.querySelectorAll('.ficha-tag').forEach(t => {
                const cat = t.onclick?.toString().match(/'(\w+)'\)/)?.[1];
                if (cat && _fichaTagsActivos[cat]?.includes(t.dataset.val)) t.classList.add('activo');
                else t.classList.remove('activo');
            });
            calcularProbabilidad();
        }

        function guardarFichaEstrategia() {
            const causaId = parseInt(document.getElementById('fe-causa-sel')?.value);
            if (!causaId) { showError('Seleccione una causa.'); return; }
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;
            if (!causa.estrategia) causa.estrategia = {};

            // Calcular prob para guardar
            const probEl = document.getElementById('fe-prob-valor');
            const prob = probEl ? parseInt(probEl.textContent) || 0 : 0;

            causa.estrategia.ficha = {
                hechos: document.getElementById('fe-hechos')?.value || '',
                derecho: document.getElementById('fe-derecho')?.value || '',
                evidencia: document.getElementById('fe-evidencia')?.value || '',
                riesgos: document.getElementById('fe-riesgos')?.value || '',
                tags: JSON.parse(JSON.stringify(_fichaTagsActivos)),
                probabilidadExito: prob,
                fechaActualizacion: new Date().toISOString()
            };

            save();
            registrarEvento(`Ficha de estrategia guardada: ${causa.caratula} · Prob. éxito: ${prob}%`);
            renderFichasGuardadas();
            renderAll();

            // Feedback visual
            const btn = document.querySelector('[onclick="guardarFichaEstrategia()"]');
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Guardado';
                btn.style.background = 'var(--s)';
                setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 2000);
            }
        }

        function renderFichasGuardadas() {
            const el = document.getElementById('fe-lista');
            if (!el) return;
            const conFicha = DB.causas.filter(c => c.estrategia?.ficha?.hechos);
            if (!conFicha.length) {
                el.innerHTML = '<div class="empty-state" style="padding:16px;"><i class="fas fa-chess-knight"></i><p>Sin fichas guardadas.</p></div>';
                return;
            }
            el.innerHTML = conFicha.map(c => {
                const f = c.estrategia.ficha;
                const prob = f.probabilidadExito || 0;
                const color = prob >= 70 ? 'var(--s)' : prob >= 45 ? 'var(--w)' : 'var(--d)';
                return `<div style="padding:10px 12px; border-radius:8px; border:1px solid var(--border); margin-bottom:8px; cursor:pointer;" onclick="document.getElementById('fe-causa-sel').value=${c.id}; cargarFichaEstrategia();">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="font-size:0.85rem;">${escHtml(c.caratula)}</strong>
                <span style="font-family:'IBM Plex Mono',monospace; font-weight:700; color:${color};">${prob}%</span>
            </div>
            <div style="font-size:0.73rem; color:var(--t2); margin-top:3px;">
                Actualizado: ${new Date(f.fechaActualizacion).toLocaleDateString('es-CL')}
            </div>
            <div class="prob-exito-bar" style="margin-top:6px; height:4px;">
                <div class="prob-exito-fill" style="width:${prob}%; background:${color};"></div>
            </div>
        </div>`;
            }).join('');
        }

        function exportarFichaEstrategia() {
            const causaId = parseInt(document.getElementById('fe-causa-sel')?.value);
            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) { showError('Seleccione y guarde primero una ficha.'); return; }
            const f = causa.estrategia?.ficha;
            if (!f) { showError('Guarde la ficha antes de exportar.'); return; }

            let txt = `FICHA DE ESTRATEGIA — TEORÍA DEL CASO\n${'='.repeat(50)}\n`;
            txt += `Causa: ${causa.caratula}\n`;
            txt += `Procedimiento: ${causa.tipoProcedimiento}\n`;
            txt += `Probabilidad de Éxito Estimada: ${f.probabilidadExito}%\n`;
            txt += `Fecha: ${new Date(f.fechaActualizacion).toLocaleDateString('es-CL')}\n\n`;
            txt += `I. HECHOS\n${'-'.repeat(30)}\n${f.hechos}\nFortalezas: ${f.tags?.hechos?.join(', ') || 'ninguna seleccionada'}\n\n`;
            txt += `II. DERECHO\n${'-'.repeat(30)}\n${f.derecho}\nBase: ${f.tags?.derecho?.join(', ') || 'ninguna seleccionada'}\n\n`;
            txt += `III. EVIDENCIA\n${'-'.repeat(30)}\n${f.evidencia}\nTipos: ${f.tags?.evidencia?.join(', ') || 'ninguna seleccionada'}\n\n`;
            txt += `IV. RIESGOS Y DEBILIDADES\n${'-'.repeat(30)}\n${f.riesgos}\n\n`;
            txt += `${'='.repeat(50)}\nAVISO: Documento de uso interno. No constituye pronóstico legal.\n`;

            const blob = new Blob([txt], { type: 'text/plain; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FichaEstrategia_${(causa.caratula).replace(/\s+/g, '_')}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            registrarEvento(`Ficha de estrategia exportada: ${causa.caratula}`);
        }

        // ═══════════════════════════════════════════════════════════════
        // INTEGRACIÓN — Extender renderAll e init
        // ═══════════════════════════════════════════════════════════════

        // Registrar nuevas secciones en tab()
        // ═══ LÓGICA DE TAB V6 INTEGRADA EN tab() PRINCIPAL (ver línea 1577) ═══
        // ═══ LÓGICA DE RENDERALL V6 INTEGRADA EN renderAll() PRINCIPAL ═══

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 1 — SCORE DE SALUD DEL DESPACHO
        // ═══════════════════════════════════════════════════════════════════════

        function calcularSaludDespacho() {
            let score = 100;
            const factores = [];
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

            // -20 por cada plazo vencido
            const vencidos = DB.documentos.filter(d => {
                if (!d.generaPlazo || !d.fechaVencimiento) return false;
                return new Date(d.fechaVencimiento + 'T12:00:00') < hoy;
            });
            if (vencidos.length) {
                const pen = Math.min(35, vencidos.length * 12);
                score -= pen;
                factores.push({ label: `${vencidos.length} plazo(s) vencido(s)`, tipo: 'crit', pen });
            } else {
                factores.push({ label: 'Sin plazos vencidos', tipo: 'ok', pen: 0 });
            }

            // -10 por causas sin movimiento >30 días
            const dormidas = detectarCausasDormidas(30);
            if (dormidas.length) {
                const pen = Math.min(20, dormidas.length * 7);
                score -= pen;
                factores.push({ label: `${dormidas.length} causa(s) dormida(s) >30d`, tipo: dormidas.length > 3 ? 'crit' : 'warn', pen });
            } else {
                factores.push({ label: 'Todas las causas con actividad', tipo: 'ok', pen: 0 });
            }

            // -15 por honorarios impagos >60 días
            const honImpagos = DB.causas.filter(c => {
                if (!c.honorarios?.base) return false;
                const pagado = (c.honorarios.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
                return (c.honorarios.base - pagado) > 0;
            });
            if (honImpagos.length) {
                const pen = Math.min(25, honImpagos.length * 8);
                score -= pen;
                factores.push({ label: `${honImpagos.length} causa(s) con honorarios pendientes`, tipo: 'warn', pen });
            } else {
                factores.push({ label: 'Honorarios al día', tipo: 'ok', pen: 0 });
            }

            // -5 por alertas críticas activas
            const alertasCrit = DB.alertas.filter(a => a.estado === 'activa' && a.prioridad === 'alta');
            if (alertasCrit.length) {
                const pen = Math.min(15, alertasCrit.length * 5);
                score -= pen;
                factores.push({ label: `${alertasCrit.length} alerta(s) crítica(s) sin resolver`, tipo: alertasCrit.length > 3 ? 'crit' : 'warn', pen });
            } else {
                factores.push({ label: 'Sin alertas críticas activas', tipo: 'ok', pen: 0 });
            }

            score = Math.max(0, Math.min(100, score));
            return { score, factores };
        }

        function renderSaludDespacho() {
            const el = document.getElementById('salud-widget');
            if (!el) return;
            const { score, factores } = calcularSaludDespacho();

            const color = score >= 75 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';
            const label = score >= 75 ? '🟢 Salud óptima' : score >= 45 ? '🟡 Riesgo operativo' : '🔴 Riesgo crítico';
            const r = 34, circ = 2 * Math.PI * r;
            const dash = (score / 100) * circ;

            el.innerHTML = `
        <div class="salud-dial">
            <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="6"/>
                <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-width="6"
                    stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
                    stroke-linecap="round" style="transition:stroke-dasharray 0.7s ease;"/>
            </svg>
            <div class="salud-dial-num">
                <span style="color:${color};">${score}</span>
                <small>/100</small>
            </div>
        </div>
        <div class="salud-info">
            <div class="salud-label" style="color:${color};">${label}</div>
            <div style="font-size:0.75rem; color:var(--t2); margin-bottom:8px;">Índice de salud operacional del despacho</div>
            <div class="salud-factores">
                ${factores.map(f => `<span class="salud-factor sf-${f.tipo}">${f.tipo === 'ok' ? '✓' : '⚠'} ${escHtml(f.label)}</span>`).join('')}
            </div>
        </div>`;
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 2 — MATRIZ DE PRIORIDAD INTELIGENTE
        // ═══════════════════════════════════════════════════════════════════════

        function calcularIndicePrioridad(causa) {
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            let score = 0;

            // 40% — Cercanía de plazo
            let diasMin = 999;
            DB.documentos.filter(d => d.causaId === causa.id && d.generaPlazo && d.fechaVencimiento).forEach(d => {
                const diff = Math.ceil((new Date(d.fechaVencimiento + 'T12:00:00') - hoy) / 86400000);
                if (diff < diasMin) diasMin = diff;
            });
            DB.alertas.filter(a => a.causaId === causa.id && a.estado === 'activa').forEach(a => {
                const diff = Math.ceil((new Date(a.fechaObjetivo) - hoy) / 86400000);
                if (diff < diasMin) diasMin = diff;
            });
            let plazoScore = 0;
            if (diasMin <= 0) plazoScore = 40;
            else if (diasMin <= 3) plazoScore = 36;
            else if (diasMin <= 7) plazoScore = 28;
            else if (diasMin <= 15) plazoScore = 18;
            else if (diasMin <= 30) plazoScore = 10;
            else plazoScore = 3;
            score += plazoScore;

            // 25% — Monto en disputa
            const monto = causa.honorarios?.base || 0;
            const maxMonto = Math.max(...DB.causas.map(c => c.honorarios?.base || 0), 1);
            score += Math.round((monto / maxMonto) * 25);

            // 20% — Complejidad (riesgo)
            const r = causa.riesgo || {};
            const complejidad = [r.procesal, r.probatorio, r.estrategico].filter(v => v === 'Alto').length * 2 +
                [r.procesal, r.probatorio, r.estrategico].filter(v => v === 'Medio').length;
            score += Math.round((complejidad / 9) * 20);

            // 15% — Prob. éxito inversa (menor éxito = más urgente)
            const prob = causa.estrategia?.ficha?.probabilidadExito || 50;
            score += Math.round(((100 - prob) / 100) * 15);

            return Math.min(100, Math.max(0, score));
        }

        function renderMatrizPrioridad() {
            const tbody = document.getElementById('matriz-tbody');
            if (!tbody) return;

            const causasOrdenadas = DB.causas
                .filter(c => c.estadoGeneral !== 'Finalizada')
                .map(c => ({ ...c, indice: calcularIndicePrioridad(c) }))
                .sort((a, b) => b.indice - a.indice);

            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

            tbody.innerHTML = causasOrdenadas.map((c, i) => {
                const cls = c.indice >= 75 ? 'pi-critico' : c.indice >= 50 ? 'pi-alto' : c.indice >= 25 ? 'pi-medio' : 'pi-bajo';
                const r = c.riesgo || {};
                const compLevel = [r.procesal, r.probatorio].filter(v => v === 'Alto').length > 0 ? 'Alta' :
                    [r.procesal, r.probatorio].filter(v => v === 'Medio').length > 0 ? 'Media' : 'Baja';
                const prob = c.estrategia?.ficha?.probabilidadExito;
                const monto = c.honorarios?.base;

                // Próximo plazo
                let diasMin = null;
                DB.documentos.filter(d => d.causaId === c.id && d.generaPlazo && d.fechaVencimiento).forEach(d => {
                    const diff = Math.ceil((new Date(d.fechaVencimiento + 'T12:00:00') - hoy) / 86400000);
                    if (diasMin === null || diff < diasMin) diasMin = diff;
                });

                const plazoLabel = diasMin === null ? '<span style="color:var(--t2)">—</span>' :
                    diasMin <= 0 ? '<span style="color:var(--d); font-weight:700;">VENCIDO</span>' :
                        diasMin <= 3 ? `<span style="color:var(--d); font-weight:700;">${diasMin}d ⚠</span>` :
                            diasMin <= 10 ? `<span style="color:var(--w); font-weight:600;">${diasMin}d</span>` :
                                `<span style="color:var(--s);">${diasMin}d</span>`;

                return `<tr>
            <td>
                <div class="prioridad-idx ${cls}">${c.indice}</div>
                <div class="prioridad-barra"><div class="prioridad-barra-fill" style="width:${c.indice}%; background:${c.indice >= 75 ? 'var(--d)' : c.indice >= 50 ? 'var(--w)' : c.indice >= 25 ? 'var(--a)' : 'var(--s)'};"></div></div>
            </td>
            <td>
                <div style="font-weight:600; font-size:0.85rem;">${escHtml(c.caratula)}</div>
                <div style="font-size:0.7rem; color:var(--t2);">${escHtml(c.tipoProcedimiento || '')} · ${escHtml(c.estadoGeneral || '')}</div>
            </td>
            <td>${plazoLabel}</td>
            <td><span style="font-size:0.78rem; color:${compLevel === 'Alta' ? 'var(--d)' : compLevel === 'Media' ? 'var(--w)' : 'var(--s)'};">${compLevel}</span></td>
            <td>${prob !== undefined ? `<span style="font-family:'IBM Plex Mono',monospace; font-weight:600; color:${prob >= 60 ? 'var(--s)' : prob >= 40 ? 'var(--w)' : 'var(--d)'};">${prob}%</span>` : '<span style="color:var(--t2)">—</span>'}</td>
            <td>${monto ? `<span style="font-family:'IBM Plex Mono',monospace; font-size:0.78rem;">$${Math.round(monto).toLocaleString('es-CL')}</span>` : '<span style="color:var(--t2)">—</span>'}</td>
            <td>
                <button class="btn btn-p btn-sm" onclick="abrirDetalleCausa(${c.id})"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm" style="background:var(--bg-2,var(--bg));" onclick="tab('ficha-estrategia'); document.getElementById('fe-causa-sel').value=${c.id}; cargarFichaEstrategia();"><i class="fas fa-chess-knight"></i></button>
            </td>
        </tr>`;
            }).join('') || '<tr><td colspan="7" style="text-align:center; color:var(--t2); padding:20px;">Sin causas activas.</td></tr>';
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 3 — DETECTOR DE CAUSAS DORMIDAS
        // ═══════════════════════════════════════════════════════════════════════

        function detectarCausasDormidas(diasUmbral = 30) {
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            return DB.causas.filter(c => {
                if (c.estadoGeneral === 'Finalizada') return false;
                // Último documento de esta causa
                const docs = DB.documentos.filter(d => d.causaId === c.id);
                const ultimaFecha = docs.length
                    ? Math.max(...docs.map(d => new Date(d.fechaDocumento || d.fechaCreacion || 0).getTime()))
                    : new Date(c.fechaCreacion || 0).getTime();
                const dias = Math.floor((hoy - ultimaFecha) / 86400000);
                c._diasSinActividad = dias;
                return dias >= diasUmbral;
            });
        }

        function renderCausasDormidas() {
            const card = document.getElementById('causas-dormidas-card');
            const lista = document.getElementById('causas-dormidas-lista');
            const count = document.getElementById('dormidas-count');
            if (!card || !lista) return;

            const dormidas = detectarCausasDormidas(30);
            if (!dormidas.length) { card.style.display = 'none'; return; }

            card.style.display = 'block';
            if (count) count.textContent = `(${dormidas.length} causa${dormidas.length > 1 ? 's' : ''})`;

            lista.innerHTML = dormidas.sort((a, b) => b._diasSinActividad - a._diasSinActividad).map(c => `
        <div class="dormida-card">
            <div class="dormida-dias">${c._diasSinActividad}d</div>
            <div class="dormida-info">
                <div style="font-weight:600; font-size:0.85rem;">${escHtml(c.caratula)}</div>
                <div style="font-size:0.72rem; color:var(--t2);">${escHtml(c.tipoProcedimiento || '')} · Avance: ${c.porcentajeAvance || 0}%</div>
            </div>
            <span class="dormida-badge">SIN ACTIVIDAD</span>
            <button class="btn btn-p btn-sm" style="flex-shrink:0;" onclick="abrirDetalleCausa(${c.id})"><i class="fas fa-eye"></i></button>
        </div>`).join('');
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 4 — MOTOR DE COHERENCIA ESTRATÉGICA
        // ═══════════════════════════════════════════════════════════════════════

        function analizarCoherencia() {
            const sel = document.getElementById('coh-causa-sel');
            const el = document.getElementById('coh-resultado');
            if (!sel || !el) return;
            const causaId = parseInt(sel.value);
            if (!causaId) { el.innerHTML = ''; return; }

            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) { el.innerHTML = ''; return; }

            const alertas = [];
            const fortalezas = [];
            const f = causa.estrategia?.ficha;
            const jurisAsociada = (causa.jurisprudenciaAsociada || []).map(jid => DB.jurisprudencia.find(j => j.id === jid)).filter(Boolean);
            const docsCount = DB.documentos.filter(d => d.causaId === causaId).length;
            const tags = f?.tags || {};

            // 1. Ficha sin completar
            if (!f?.hechos) alertas.push({ tipo: 'danger', msg: 'Sin teoría del caso definida — La ficha de estrategia está vacía.' });
            else if (f.hechos.length < 100) alertas.push({ tipo: 'warn', msg: 'Teoría del caso incompleta — Los hechos son muy breves (menos de 100 caracteres).' });

            // 2. Evidencia insuficiente
            if (!docsCount) alertas.push({ tipo: 'danger', msg: 'Sin documentos indexados — No hay evidencia registrada en el sistema.' });
            else if (docsCount < 3) alertas.push({ tipo: 'warn', msg: `Evidencia escasa — Solo ${docsCount} documento(s) registrado(s). Se recomienda fortalecer el acervo probatorio.` });
            else fortalezas.push(`${docsCount} documentos indexados como evidencia.`);

            // 3. Jurisprudencia desfavorable
            const jurisDesfavorable = jurisAsociada.filter(j => j.tendencia === 'Desfavorable');
            const jurisFavorable = jurisAsociada.filter(j => j.tendencia === 'Favorable');
            if (jurisDesfavorable.length > jurisFavorable.length && jurisAsociada.length > 0) {
                alertas.push({ tipo: 'danger', msg: `Jurisprudencia mayoritariamente desfavorable — ${jurisDesfavorable.length} de ${jurisAsociada.length} fallos asociados van en contra de la posición de la parte.` });
            } else if (!jurisAsociada.length) {
                alertas.push({ tipo: 'warn', msg: 'Sin jurisprudencia asociada — Se recomienda indexar fallos relevantes en la sección de Jurisprudencia.' });
            } else {
                fortalezas.push(`${jurisFavorable.length}/${jurisAsociada.length} fallos asociados son favorables.`);
            }

            // 4. Tags de evidencia sin documentación
            if (f && tags.evidencia?.includes('prueba_pericial') && !DB.documentos.find(d => d.causaId === causaId && /perit/i.test(d.tipo || d.descripcion || ''))) {
                alertas.push({ tipo: 'warn', msg: 'Se declaró prueba pericial en la ficha pero no hay documentos de peritos registrados.' });
            }

            // 5. Base jurídica sin norma expresa
            if (f?.derecho && !tags.derecho?.includes('norma_expresa') && !tags.derecho?.includes('jurisprudencia_favor')) {
                alertas.push({ tipo: 'warn', msg: 'Fundamento jurídico sin respaldo — No se ha marcado norma expresa ni jurisprudencia favorable en la ficha.' });
            } else if (tags.derecho?.includes('norma_expresa')) {
                fortalezas.push('Base jurídica respaldada por norma expresa.');
            }

            // 6. Riesgo alto sin estrategia
            const r = causa.riesgo || {};
            if (r.procesal === 'Alto' && !f?.hechos) {
                alertas.push({ tipo: 'danger', msg: 'Riesgo procesal ALTO sin estrategia definida — Urgente completar ficha de estrategia.' });
            }

            // Calcular score coherencia
            const totalChecks = 6;
            const alertasCrit = alertas.filter(a => a.tipo === 'danger').length;
            const alertasWarn = alertas.filter(a => a.tipo === 'warn').length;
            const scoreCoherencia = Math.max(0, Math.round(100 - (alertasCrit * 20) - (alertasWarn * 8)));
            const colorScore = scoreCoherencia >= 70 ? 'var(--s)' : scoreCoherencia >= 40 ? 'var(--w)' : 'var(--d)';

            el.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:14px; background:var(--bg); border-radius:8px; margin-bottom:14px;">
            <div>
                <div style="font-weight:700; font-size:0.9rem;">${escHtml(causa.caratula)}</div>
                <div style="font-size:0.75rem; color:var(--t2);">Análisis de coherencia estratégica</div>
            </div>
            <div style="text-align:center;">
                <div style="font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:1.8rem; color:${colorScore};">${scoreCoherencia}</div>
                <div style="font-size:0.65rem; color:var(--t2);">score /100</div>
            </div>
        </div>
        ${alertas.map(a => `
        <div class="coherencia-alerta co-${a.tipo}">
            <i class="fas ${a.tipo === 'danger' ? 'fa-times-circle' : a.tipo === 'warn' ? 'fa-exclamation-triangle' : 'fa-check-circle'} co-icon"></i>
            <div>${escHtml(a.msg)}</div>
        </div>`).join('')}
        ${fortalezas.length ? `
        <div style="margin-top:10px; padding:10px 14px; background:#f0fdf4; border-radius:6px; border-left:3px solid var(--s);">
            <div style="font-size:0.75rem; font-weight:700; color:var(--s); margin-bottom:6px;">✓ Fortalezas detectadas</div>
            ${fortalezas.map(f => `<div style="font-size:0.78rem; color:#166534; margin-bottom:3px;">• ${escHtml(f)}</div>`).join('')}
        </div>` : ''}
        ${!alertas.length && fortalezas.length ? `<div class="coherencia-alerta co-ok"><i class="fas fa-check-circle co-icon"></i><div>Coherencia estratégica completa — No se detectaron inconsistencias.</div></div>` : ''}`;

            // Actualizar score en causa
            if (!causa.estrategia) causa.estrategia = {};
            causa.estrategia.scoreCoherencia = scoreCoherencia;
            save();
        }

        function renderCoherenciaGlobal() {
            const el = document.getElementById('coh-resumen-global');
            if (!el) return;

            if (!DB.causas.length) {
                el.innerHTML = '<div class="empty-state"><i class="fas fa-project-diagram"></i><p>Sin causas registradas.</p></div>';
                return;
            }

            el.innerHTML = DB.causas.filter(c => c.estadoGeneral !== 'Finalizada').map(c => {
                const score = c.estrategia?.scoreCoherencia;
                const color = score === undefined ? 'var(--t2)' : score >= 70 ? 'var(--s)' : score >= 40 ? 'var(--w)' : 'var(--d)';
                const label = score === undefined ? 'No analizada' : score >= 70 ? 'Alta coherencia' : score >= 40 ? 'Coherencia media' : 'Baja coherencia';
                return `<div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #f1f5f9;">
            <div style="flex:1; font-size:0.82rem; font-weight:500;">${escHtml(c.caratula)}</div>
            <div style="font-size:0.72rem; color:var(--t2);">${escHtml(c.tipoProcedimiento || '')}</div>
            <div style="text-align:right; min-width:100px;">
                <div style="font-family:'IBM Plex Mono',monospace; font-weight:700; color:${color};">${score !== undefined ? score + '/100' : '—'}</div>
                <div style="font-size:0.65rem; color:${color};">${label}</div>
            </div>
            <button class="btn btn-sm" style="background:var(--bg-2,var(--bg)); flex-shrink:0;" onclick="tab('coherencia'); document.getElementById('coh-causa-sel').value=${c.id}; analizarCoherencia();">Analizar</button>
        </div>`;
            }).join('') || '<p style="color:var(--t2); font-size:0.82rem;">Sin causas activas para analizar.</p>';
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 5 — MAPA ECONÓMICO DEL ESTUDIO
        // ═══════════════════════════════════════════════════════════════════════

        function renderMapaEconomico() {
            const kpisEl = document.getElementById('mapa-eco-kpis');
            const proyEl = document.getElementById('mapa-eco-proyeccion');
            const causasEl = document.getElementById('mapa-eco-causas');
            const mesEl = document.getElementById('mapa-eco-proyeccion-mes');
            if (!kpisEl) return;

            let totalBase = 0, totalPagado = 0;
            DB.causas.forEach(c => {
                if (!c.honorarios?.base) return;
                totalBase += c.honorarios.base;
                totalPagado += (c.honorarios.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
            });
            const totalPendiente = totalBase - totalPagado;
            const modoEstudio = DB.configuracion?.modoEstudio;

            // KPIs
            kpisEl.innerHTML = `
        <div class="eco-celda">
            <div class="eco-label">Facturado Total</div>
            <div class="eco-valor" style="color:var(--a);">$${Math.round(totalBase).toLocaleString('es-CL')}</div>
            <div class="eco-delta" style="color:var(--t2);">${DB.causas.filter(c => c.honorarios?.base).length} causa(s)</div>
        </div>
        <div class="eco-celda">
            <div class="eco-label">Cobrado / Pagado</div>
            <div class="eco-valor" style="color:var(--s);">$${Math.round(totalPagado).toLocaleString('es-CL')}</div>
            <div class="eco-delta" style="color:var(--s);">${totalBase > 0 ? Math.round((totalPagado / totalBase) * 100) : 0}% del total</div>
        </div>
        <div class="eco-celda">
            <div class="eco-label">Pendiente de Cobro</div>
            <div class="eco-valor" style="color:${totalPendiente > 0 ? 'var(--w)' : 'var(--s)'};">$${Math.round(totalPendiente).toLocaleString('es-CL')}</div>
            <div class="eco-delta" style="color:var(--t2);">${DB.causas.filter(c => (c.honorarios?.base || 0) - (c.honorarios?.pagos || []).reduce((s, p) => s + (p.monto || 0), 0) > 0).length} causa(s)</div>
        </div>
        <div class="eco-celda" style="${modoEstudio ? '' : 'opacity:0.5;'}">
            <div class="eco-label">Causas ${modoEstudio ? '(Estudio)' : '(Personal)'}</div>
            <div class="eco-valor">${DB.causas.length}</div>
            <div class="eco-delta" style="color:var(--t2);">${DB.clientes.length} cliente(s)</div>
        </div>`;

            // Proyección
            const mensual = totalBase / Math.max(1, DB.causas.length) * 1.2;
            const anual = mensual * 12;
            if (proyEl) proyEl.innerHTML = `
        <div style="font-size:0.75rem; color:rgba(255,255,255,0.5); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:6px;">Proyección estimada</div>
        <div style="font-family:'IBM Plex Mono',monospace; font-size:0.7rem; color:rgba(255,255,255,0.3); margin-bottom:8px;">Basado en ritmo actual del portafolio</div>
        <div class="eco-proy-grid">
            <div class="eco-proy-item"><label>Mensual</label><span>$${Math.round(mensual).toLocaleString('es-CL')}</span></div>
            <div class="eco-proy-item"><label>Anual</label><span>$${Math.round(anual).toLocaleString('es-CL')}</span></div>
            <div class="eco-proy-item"><label>Pendiente total</label><span style="color:#fca5a5;">$${Math.round(totalPendiente).toLocaleString('es-CL')}</span></div>
            <div class="eco-proy-item"><label>Cobro efectivo</label><span style="color:#86efac;">${totalBase > 0 ? Math.round((totalPagado / totalBase) * 100) : 0}%</span></div>
        </div>`;

            // Por causa
            if (causasEl) {
                const conHon = DB.causas.filter(c => c.honorarios?.base).sort((a, b) => (b.honorarios.base || 0) - (a.honorarios.base || 0));
                causasEl.innerHTML = conHon.length ? conHon.map(c => {
                    const base = c.honorarios.base || 0;
                    const pagado = (c.honorarios.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
                    const pct = base > 0 ? Math.round((pagado / base) * 100) : 0;
                    return `<div style="margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; margin-bottom:4px;">
                    <span style="font-weight:600; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(c.caratula)}</span>
                    <span style="font-family:'IBM Plex Mono',monospace; font-size:0.75rem; margin-left:8px; flex-shrink:0;">$${Math.round(base).toLocaleString('es-CL')}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex:1; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:${pct >= 100 ? 'var(--s)' : pct >= 50 ? 'var(--a)' : 'var(--w)'}; border-radius:3px; transition:width 0.5s;"></div>
                    </div>
                    <span style="font-size:0.68rem; font-family:'IBM Plex Mono',monospace; color:${pct >= 100 ? 'var(--s)' : pct >= 50 ? 'var(--a)' : 'var(--w)'}; min-width:35px; text-align:right;">${pct}%</span>
                </div>
            </div>`;
                }).join('') : '<div class="empty-state" style="padding:16px;"><i class="fas fa-coins"></i><p>Sin honorarios registrados.</p></div>';
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 6 — CONTROL DE INSTANCIAS
        // ═══════════════════════════════════════════════════════════════════════

        function renderInstancias() {
            const sel = document.getElementById('inst-causa-sel');
            const el = document.getElementById('inst-timeline');
            if (!sel || !el) return;
            const causaId = parseInt(sel.value);
            if (!causaId) { el.innerHTML = ''; renderInstanciasGlobal(); return; }

            const causa = DB.causas.find(c => c.id === causaId);
            if (!causa) return;

            const instancias = causa.instanciasHistorial || [];
            if (!instancias.length) {
                // Crear desde instancia actual
                if (causa.instancia) instancias.push({ id: uid(), nombre: causa.instancia, estado: 'activo', fechaInicio: causa.fechaCreacion, observaciones: '' });
            }

            el.innerHTML = `<div class="instancia-timeline">
        ${instancias.map(inst => `
        <div class="instancia-nodo ${inst.estado}">
            <div class="instancia-titulo">${escHtml(inst.nombre)} <span style="font-size:0.7rem; color:var(--t2); font-weight:400;">(${inst.estado === 'activo' ? 'En curso' : 'Finalizada'})</span></div>
            <div class="instancia-meta">${inst.fechaInicio ? 'Desde: ' + new Date(inst.fechaInicio).toLocaleDateString('es-CL') : ''}${inst.fechaFin ? ' · Hasta: ' + new Date(inst.fechaFin).toLocaleDateString('es-CL') : ''}</div>
            ${inst.recurso ? `<div class="instancia-recurso">⚖ Recurso: ${escHtml(inst.recurso)}${inst.plazoRecurso ? ' · Plazo: ' + inst.plazoRecurso + 'd' : ''}</div>` : ''}
            ${inst.observaciones ? `<div style="font-size:0.75rem; color:var(--t2); margin-top:4px;">${escHtml(inst.observaciones)}</div>` : ''}
        </div>`).join('')}
    </div>
    <div style="margin-top:14px; padding:12px; background:#f8fafc; border-radius:8px; font-size:0.8rem; color:var(--t2);">
        <strong>Instancia actual:</strong> ${escHtml(causa.instancia || 'Primera')} · 
        <strong>Estado:</strong> ${escHtml(causa.estadoGeneral || 'En tramitación')}
    </div>`;
            renderInstanciasGlobal();
        }

        function uiAgregarInstancia() {
            const causaId = parseInt(document.getElementById('inst-causa-sel')?.value);
            if (!causaId) { showError('Seleccione una causa.'); return; }
            const tipos = ['Primera Instancia', 'Segunda Instancia (Apelación)', 'Casación en la Forma', 'Casación en el Fondo', 'Recurso de Amparo', 'Recurso de Protección', 'Corte Suprema'];

            migAbrir({
                titulo: '<i class="fas fa-sitemap"></i> Agregar Instancia Procesal',
                btnOk: 'Agregar Instancia',
                campos: [
                    {
                        id: 'mig-inst-tipo',
                        label: 'Tipo de instancia',
                        tipo: 'select',
                        opciones: tipos.map(t => ({ value: t, label: t })),
                        valor: tipos[0]
                    },
                    {
                        id: 'mig-inst-fecha',
                        label: 'Fecha de inicio',
                        tipo: 'date',
                        valor: new Date().toISOString().split('T')[0]
                    }
                ],
                onOk: (vals) => {
                    const tipoSel = vals['mig-inst-tipo'];
                    if (!tipoSel?.trim()) return;
                    const causa = DB.causas.find(c => c.id === causaId);
                    if (!causa) return;
                    if (!causa.instanciasHistorial) causa.instanciasHistorial = [];
                    if (causa.instanciasHistorial.length) {
                        const ultima = causa.instanciasHistorial[causa.instanciasHistorial.length - 1];
                        ultima.estado = 'cerrado'; ultima.fechaFin = new Date();
                    }
                    causa.instanciasHistorial.push({ id: uid(), nombre: tipoSel.trim(), estado: 'activo', fechaInicio: vals['mig-inst-fecha'] || new Date(), observaciones: '' });
                    causa.instancia = tipoSel.trim();
                    registrarEvento(`Nueva instancia agregada: ${tipoSel.trim()} en ${causa.caratula}`);
                    save(); renderInstancias();
                }
            });
        }

        function renderInstanciasGlobal() {
            const el = document.getElementById('inst-resumen-global');
            if (!el) return;
            el.innerHTML = DB.causas.map(c => {
                const instActual = c.instancia || 'Primera Instancia';
                const recursos = (c.recursos || []).length;
                return `<div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid #f1f5f9;">
            <div style="flex:1;"><div style="font-weight:600; font-size:0.82rem;">${escHtml(c.caratula)}</div>
            <div style="font-size:0.72rem; color:var(--t2);">${escHtml(instActual)}</div></div>
            ${recursos ? `<span style="font-size:0.7rem; background:#fff3cd; color:#856404; padding:2px 8px; border-radius:4px;">${recursos} recurso(s)</span>` : ''}
            <span style="font-size:0.7rem; background:${c.estadoGeneral === 'Finalizada' ? '#d1fae5' : '#dbeafe'}; color:${c.estadoGeneral === 'Finalizada' ? '#065f46' : '#1e40af'}; padding:2px 8px; border-radius:4px;">${escHtml(c.estadoGeneral || 'Activa')}</span>
        </div>`;
            }).join('') || '<p style="color:var(--t2);">Sin causas.</p>';
        }

        // ═══════════════════════════════════════════════════════════════════════
        // MÓDULO 7 — EXPORTACIÓN PDF (simulada con ventana de impresión enriquecida)
