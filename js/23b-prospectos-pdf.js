/**
 * LEXIUM - Prospectos PDF Generator
 * Módulo 4: Generador de HTML para PDF via Puppeteer
 */

(function () {
    // ── Estilos CSS Base compartidos para los PDF ────────────────────────────
    const cssStyle = `
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            
            :root {
                --primary: #0f3460;
                --accent: #06b6d4;
                --text: #1a1a2e;
                --text-light: #475569;
                --bg-light: #f8fafc;
                --border: #e2e8f0;
            }

            body {
                font-family: 'Inter', sans-serif;
                color: var(--text);
                font-size: 12px;
                line-height: 1.5;
                margin: 0;
                padding: 0;
                background-color: white;
            }

            .container {
                max-width: 800px;
                margin: 0 auto;
            }

            /* Header */
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid var(--primary);
                padding-bottom: 20px;
                margin-bottom: 30px;
            }

            .logo-area h1 {
                margin: 0;
                color: var(--primary);
                font-size: 24px;
                font-weight: 700;
                letter-spacing: 1px;
            }

            .logo-area p {
                margin: 5px 0 0 0;
                color: var(--text-light);
                font-size: 10px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }

            .abogado-info {
                text-align: right;
                font-size: 10px;
                color: var(--text-light);
            }

            .abogado-info strong {
                color: var(--primary);
                font-size: 12px;
                display: block;
                margin-bottom: 4px;
            }

            /* Títulos */
            h2.doc-title {
                color: var(--primary);
                font-size: 18px;
                text-align: center;
                margin: 0 0 5px 0;
                text-transform: uppercase;
            }

            .doc-subtitle {
                text-align: center;
                color: var(--text-light);
                font-size: 11px;
                margin-bottom: 30px;
            }

            h3.section-title {
                color: var(--primary);
                font-size: 14px;
                border-bottom: 1px solid var(--accent);
                padding-bottom: 5px;
                margin: 25px 0 15px 0;
            }

            /* Grillas de datos */
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
                background: var(--bg-light);
                padding: 15px;
                border-radius: 6px;
                border: 1px solid var(--border);
            }

            .info-item {
                display: flex;
                flex-direction: column;
            }

            .info-label {
                font-size: 10px;
                color: var(--accent);
                text-transform: uppercase;
                font-weight: 600;
                margin-bottom: 3px;
            }

            .info-value {
                font-size: 12px;
                font-weight: 600;
            }

            /* Textos generales */
            .text-block {
                text-align: justify;
                margin-bottom: 20px;
                white-space: pre-wrap;
            }

            /* Tablas */
            table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }

            th {
                background-color: var(--primary);
                color: white;
                font-weight: 600;
                text-align: left;
                padding: 10px;
                font-size: 11px;
                text-transform: uppercase;
            }

            td {
                padding: 10px;
                border-bottom: 1px solid var(--border);
                font-size: 12px;
            }

            tr:nth-child(even) {
                background-color: var(--bg-light);
            }

            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total-row td {
                font-weight: 700;
                color: var(--primary);
                background-color: #f1f5f9;
                border-top: 2px solid var(--primary);
            }

            /* Box de Vigencia */
            .vigencia-box {
                margin-top: 40px;
                padding: 15px;
                border-left: 4px solid var(--accent);
                background-color: var(--bg-light);
                font-weight: 600;
                color: var(--primary);
            }

            /* Footer */
            .footer {
                margin-top: 50px;
                padding-top: 20px;
                border-top: 1px solid var(--border);
                display: flex;
                justify-content: space-between;
                font-size: 9px;
                color: var(--text-light);
            }

            /* Badges */
            .badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 600;
                color: white;
                background-color: var(--primary);
            }
        </style>
    `;

    // ── Helper functions compartidas ─────────────────────────────────────────
    const formatearDinero = (monto) => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(monto || 0);
    };

    const formatearFecha = (fechaStr) => {
        if (!fechaStr) return '';
        try {
            const date = new Date(fechaStr + 'T00:00:00'); // Tratar como fecha local sin offset para evitar desfases
            return isNaN(date.getTime()) ? fechaStr : date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return fechaStr; }
    };

    const generarHeader = (config) => `
        <div class="header">
            <div class="logo-area">
                <h1>LEXIUM</h1>
                <p>Legal Intelligence</p>
            </div>
            <div class="abogado-info">
                <strong>${config.nombreAbogado || 'Abogado Titular'}</strong>
                ${config.rutAbogado ? `<div>RUT: ${config.rutAbogado}</div>` : ''}
                ${config.emailAbogado ? `<div>${config.emailAbogado}</div>` : ''}
                ${config.telefonoAbogado ? `<div>${config.telefonoAbogado}</div>` : ''}
            </div>
        </div>
    `;

    const generarFooter = (id, fecha) => `
        <div class="footer">
            <div>Generado por LEXIUM · Legal Intelligence</div>
            <div>Ref: ${id} | Emisión: ${formatearFecha(fecha || new Date().toISOString().split('T')[0])}</div>
        </div>
    `;

    // ═════════════════════════════════════════════════════════════════════════
    // FUNCIÓN 1: Propuesta Económica
    // ═════════════════════════════════════════════════════════════════════════
    window.pdfHTMLPropuesta = function (prospecto, propuesta, config) {

        let cuotasHtml = '';
        if (propuesta.formaPago === 'cuotas' && propuesta.fechasPago && propuesta.fechasPago.length > 0) {
            cuotasHtml = `
            <h3 class="section-title">CALENDARIO DE PAGOS</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 20%">Cuota</th>
                        <th style="width: 40%">Fecha de Vencimiento</th>
                        <th class="text-right" style="width: 40%">Monto</th>
                    </tr>
                </thead>
                <tbody>
                    ${propuesta.fechasPago.map((fecha, idx) => `
                    <tr>
                        <td># ${idx + 1} de ${propuesta.numeroCuotas}</td>
                        <td>${formatearFecha(fecha)}</td>
                        <td class="text-right">${formatearDinero(propuesta.montoCuota || (propuesta.montoTotal / propuesta.numeroCuotas))}</td>
                    </tr>`).join('')}
                    <tr class="total-row">
                        <td colspan="2" class="text-right">Total Acordado:</td>
                        <td class="text-right">${formatearDinero(propuesta.montoTotal)}</td>
                    </tr>
                </tbody>
            </table>`;
        }

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Propuesta - ${prospecto.nombre}</title>
            ${cssStyle}
        </head>
        <body>
            <div class="container">
                ${generarHeader(config)}

                <h2 class="doc-title">PROPUESTA DE SERVICIOS JURÍDICOS</h2>
                <div class="doc-subtitle">Referencia: ${propuesta.id.replace('prop_', 'PROP-')} | Fecha: ${formatearFecha(propuesta.fechaEmision)}</div>

                <h3 class="section-title">1. ANTECEDENTES DEL CLIENTE</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Nombre / Razón Social</span>
                        <span class="info-value">${prospecto.nombre}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">RUT</span>
                        <span class="info-value">${prospecto.rut || 'No informado'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Email</span>
                        <span class="info-value">${prospecto.email || 'No informado'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Teléfono</span>
                        <span class="info-value">${prospecto.telefono || 'No informado'}</span>
                    </div>
                </div>

                <h3 class="section-title">2. MATERIA Y ESTRATEGIA PROPUESTA</h3>
                <div class="info-grid" style="grid-template-columns: 1fr; margin-bottom: 15px;">
                    <div class="info-item">
                        <span class="info-label">Materia</span>
                        <span class="info-value" style="text-transform: capitalize;">${prospecto.materia || 'General'}</span>
                    </div>
                </div>
                
                <div class="text-block"><strong>Descripción del caso:</strong><br>${prospecto.descripcion || 'Sin descripción detallada.'}</div>
                <div class="text-block"><strong>Estrategia Jurídica sugerida:</strong><br>${prospecto.estrategia || 'Gestión y tramitación estándar según requerimiento.'}</div>

                <h3 class="section-title">3. HONORARIOS Y CONDICIONES</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 30%">Concepto</th>
                            <th style="width: 40%">Detalle</th>
                            <th class="text-right" style="width: 30%">Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Tipo de Honorarios</td>
                            <td>${propuesta.tipoHonorarios === 'variable' ? 'Variable (Porcentaje sobre resultados)' : 'Honorarios Fijos'}</td>
                            <td class="text-right">-</td>
                        </tr>
                        ${propuesta.tipoHonorarios === 'variable' ? `
                        <tr>
                            <td>Cuantía Estimada</td>
                            <td>Base de cálculo para el porcentaje</td>
                            <td class="text-right">${formatearDinero(propuesta.cuantiaLitigio)}</td>
                        </tr>
                        <tr>
                            <td>Porcentaje Acordado</td>
                            <td>${propuesta.porcentaje}% sobre los resultados obtenidos</td>
                            <td class="text-right">-</td>
                        </tr>
                        ` : ''}
                        <tr>
                            <td>Forma de Pago</td>
                            <td style="text-transform: capitalize;">${propuesta.formaPago === 'cuotas' ? (propuesta.numeroCuotas + ' Cuotas mensuales') : 'Pago al Contado'}</td>
                            <td class="text-right">-</td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="2" class="text-right">MONTO TOTAL DE HONORARIOS:</td>
                            <td class="text-right">${formatearDinero(propuesta.montoTotal)}</td>
                        </tr>
                    </tbody>
                </table>

                ${cuotasHtml}

                <div class="vigencia-box">
                    ⚠️ Esta propuesta económica tiene validez hasta el ${formatearFecha(propuesta.fechaVigencia)}. Pasada esta fecha, las condiciones podrían estar sujetas a reevaluación.
                </div>

                ${generarFooter(propuesta.id.replace('prop_', 'PROP-'), propuesta.fechaEmision)}
            </div>
        </body>
        </html>
        `;
    };

    // ═════════════════════════════════════════════════════════════════════════
    // FUNCIÓN 2: Informe Consolidado de Causa
    // ═════════════════════════════════════════════════════════════════════════
    window.pdfHTMLInforme = function (causa, config) {

        // Historial Documental procesado
        const dCli = (causa.docsCliente || []).length;
        const dTri = (causa.docsTribunal || []).length;
        const dTra = (causa.docsTramites || []).length;
        const dTot = dCli + dTri + dTra;

        // Estado de Cuenta procesado
        const estadoCta = causa.estadoCuenta || { montoTotal: 0, pagos: [], totalPagado: 0, saldoPendiente: 0 };
        const pagos = estadoCta.pagos || [];

        // Etapas procesales (traer las ultimas 5, invertidas para mostrar la mas nueva primero)
        const etapas = [...(causa.etapasProcesales || [])].reverse().slice(0, 5);

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Informe - ${causa.caratula}</title>
            ${cssStyle}
        </head>
        <body>
            <div class="container">
                ${generarHeader(config)}

                <h2 class="doc-title">INFORME CONSOLIDADO DE CAUSA</h2>
                <div class="doc-subtitle">Carátula: ${causa.caratula} | Referencia interna: ${causa.id} | Generado el: ${new Date().toLocaleDateString('es-CL')}</div>

                <h3 class="section-title">1. ESTADO PROCESAL ACTUAL</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Estado General</span>
                        <span class="info-value"><span class="badge" style="background:${causa.estadoGeneral === 'Finalizada' ? '#0d7a5f' : 'var(--accent)'}">${causa.estadoGeneral || 'En tramitación'}</span></span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Progreso</span>
                        <span class="info-value">${causa.porcentajeAvance || 0}% de avance global</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Juzgado / Tribunal</span>
                        <span class="info-value">${causa.juzgado || 'Por definir / Trámite Administrativo'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Rama Jurídica</span>
                        <span class="info-value" style="text-transform: capitalize;">${causa.rama || 'General'}</span>
                    </div>
                </div>

                ${etapas.length > 0 ? `
                <h3 class="section-title">2. ÚLTIMOS AVANCES DEL EXPEDIENTE</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 20%">Fecha</th>
                            <th style="width: 80%">Trámite / Etapa</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${etapas.map(e => `
                        <tr>
                            <td>${formatearFecha(e.fecha.split('T')[0])}</td>
                            <td>${e.nombre}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
                ` : '<div class="text-block"><i>No hay etapas procesales registradas aún.</i></div>'}

                <h3 class="section-title">3. RESUMEN DOCUMENTAL</h3>
                <div class="info-grid" style="grid-template-columns: 1fr 1fr 1fr;">
                    <div class="info-item text-center">
                        <span class="info-label">Docs. Cliente</span>
                        <span class="info-value" style="font-size: 18px;">${dCli}</span>
                    </div>
                    <div class="info-item text-center">
                        <span class="info-label">Docs. Tribunal</span>
                        <span class="info-value" style="font-size: 18px;">${dTri}</span>
                    </div>
                    <div class="info-item text-center">
                        <span class="info-label">Otros Trámites</span>
                        <span class="info-value" style="font-size: 18px;">${dTra}</span>
                    </div>
                </div>
                <div class="text-block" style="text-align: right; margin-top: 5px; font-size: 10px; color: var(--text-light);">
                    Total de documentos custodiados de forma encriptada: <strong>${dTot}</strong>
                </div>

                <h3 class="section-title">4. ESTADO DE CUENTA FINANCIERO</h3>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 20%">Fecha Pago</th>
                            <th style="width: 40%">Método</th>
                            <th class="text-right" style="width: 40%">Monto Abonado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagos.length === 0 ? '<tr><td colspan="3" class="text-center"><i>No hay pagos registrados activos.</i></td></tr>' : ''}
                        ${pagos.map(p => `
                        <tr>
                            <td>${formatearFecha(p.fecha)}</td>
                            <td style="text-transform: capitalize;">${p.metodo || 'No especificado'} ${p.nota ? `<i>(${p.nota})</i>` : ''}</td>
                            <td class="text-right" style="color: #0d7a5f; font-weight: 600;">+ ${formatearDinero(p.monto)}</td>
                        </tr>`).join('')}
                        <tr class="total-row">
                            <td colspan="2" class="text-right">Total Acordado:</td>
                            <td class="text-right">${formatearDinero(estadoCta.montoTotal)}</td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="2" class="text-right">Total Pagado a la Fecha:</td>
                            <td class="text-right" style="color: #0d7a5f;">${formatearDinero(estadoCta.totalPagado)}</td>
                        </tr>
                        <tr class="total-row">
                            <td colspan="2" class="text-right">SALDO PENDIENTE:</td>
                            <td class="text-right" style="color: ${estadoCta.saldoPendiente > 0 ? '#c0392b' : '#0d7a5f'};">
                                ${formatearDinero(estadoCta.saldoPendiente)}
                            </td>
                        </tr>
                    </tbody>
                </table>

                ${generarFooter(`INF-${causa.id}`, new Date().toISOString().split('T')[0])}
            </div>
        </body>
        </html>
        `;
    };

})();
