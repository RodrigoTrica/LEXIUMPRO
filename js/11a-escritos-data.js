        // ████████████████████████████████████████████████████████████████████
        // JS — MÓDULO 11a: CAPA DE DATOS — ESCRITOS
        // Responsabilidad: SÓLO acceso y mutación de datos en DB.
        // Sin DOM, sin render, sin innerHTML.
        //
        // Separado de 11b-escritos-ui.js para facilitar la migración a API
        // en Fase 2 (reemplazar DB.historialEscritos / DB.plantillasEscritos
        // por llamadas REST sin tocar la UI).
        //
        // Dependencias: 01-db-auth.js (DB, save, uid)
        // ████████████████████████████████████████████████████████████████████

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 1 — INICIALIZACIÓN DE COLECCIONES
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Inicializa las colecciones de escritos en DB si no existen.
         * Se ejecuta una sola vez al cargar el módulo.
         * En Fase 2: reemplazar por petición GET /api/escritos/init.
         * @internal
         */
        (function _inicializarEscritos() {
            if (!DB.historialEscritos)  DB.historialEscritos  = [];
            if (!DB.plantillasEscritos) DB.plantillasEscritos = [];
        })();

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 2 — CATÁLOGO AMPLIADO DE TIPOS DE ESCRITO
        // Complementa TIPOS_ESCRITOS de 09-app-core con materias:
        //   penal · tributario · contencioso-administrativo
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Catálogo extendido de tipos de escrito por materia.
         * Cada entrada: { id, label, prompt_extra }.
         * Se fusiona con TIPOS_ESCRITOS (09-app-core) en _fusionarCatalogos().
         * @type {Object.<string, Array<{id:string, label:string, prompt_extra:string}>>}
         */
        const TIPOS_ESCRITOS_EXTRA = {
            penal: [
                { id: 'querella_penal', label: 'Querella Criminal',
                  prompt_extra: 'Art. 111 y ss. CPP. Tribunal: Juzgado de Garantía. Indicar: (1) Hechos constitutivos de delito con fecha, lugar y circunstancias. (2) Calificación jurídica del delito (citar tipo penal del Código Penal). (3) Imputado si se conoce. (4) Diligencias de investigación solicitadas. (5) Petición: tener por interpuesta querella, admitirla a tramitación, ordenar investigación del Ministerio Público. La víctima puede querellar aunque el fiscal archive o no persevere.' },
                { id: 'recurso_amparo', label: 'Recurso de Amparo (Hábeas Corpus)',
                  prompt_extra: 'Art. 21 Constitución + Art. 95 CPP. Ante la Corte de Apelaciones respectiva. Urgente — tramitación preferente. Indicar: (1) Persona privada de libertad o amenazada. (2) Autoridad o persona que ejecuta la privación ilegal o arbitraria. (3) Fundamentos de la ilegalidad o arbitrariedad. (4) Petición: ordenar libertad inmediata o regularización de la detención. El tribunal puede actuar de oficio y sin formalidades.' },
                { id: 'recurso_nulidad_penal', label: 'Recurso de Nulidad Penal',
                  prompt_extra: 'Art. 372 y ss. CPP. Plazo 10 días desde notificación de sentencia definitiva. Ante el tribunal que dictó la sentencia, para ser conocido por la Corte de Apelaciones (o Corte Suprema si causal Art. 373 a). Causales: Art. 373 a) infracción garantías constitucionales o tratados internacionales; Art. 373 b) errónea aplicación del derecho con influencia sustancial; Art. 374 vicios formales expresamente listados. Efecto: nulidad del juicio oral y eventual reenvío.' },
                { id: 'acuerdo_reparatorio', label: 'Solicitud de Acuerdo Reparatorio',
                  prompt_extra: 'Art. 241 y ss. CPP. Solo para delitos que afectan bienes jurídicos disponibles de carácter patrimonial o lesiones menos graves. Requiere acuerdo imputado–víctima. Indicar: (1) Partes del acuerdo. (2) Delito imputado y su calificación. (3) Contenido del acuerdo (monto, forma de pago, otras condiciones). (4) Petición: homologar el acuerdo y sobreseer definitivamente la causa. El juez de garantía verifica que sea libre y voluntario.' },
                { id: 'suspension_condicional', label: 'Solicitud de Suspensión Condicional del Procedimiento',
                  prompt_extra: 'Art. 237 y ss. CPP. El fiscal puede solicitar al juez de garantía la suspensión a condición de que el imputado cumpla condiciones. Requisitos: pena en concreto no superior a 3 años, sin condena previa por crimen o simple delito, acuerdo fiscal–imputado. Indicar condiciones propuestas (Art. 238 CPP): residencia, trabajo, abstención de drogas, etc. Plazo: 1 a 3 años. Si se cumple: sobreseimiento definitivo.' },
                { id: 'sobreseimiento_definitivo', label: 'Solicitud de Sobreseimiento Definitivo',
                  prompt_extra: 'Art. 250 CPP. Causales: a) hecho no constitutivo de delito; b) participación del imputado no acreditada; c) extinción responsabilidad penal (prescripción, muerte, amnistía, indulto); d) cosa juzgada. El imputado o su defensor pueden solicitarlo al juez de garantía en cualquier estado. Indicar causal exacta y su acreditación. Efecto: equivale a sentencia absolutoria firme.' },
            ],
            tributario: [
                { id: 'reclamacion_sii', label: 'Reclamación Tributaria (TTA)',
                  prompt_extra: 'Art. 123 y ss. Código Tributario. Plazo: 90 días hábiles desde notificación de liquidación, giro o resolución. Tribunal: Tribunal Tributario y Aduanero (TTA) competente según domicilio del contribuyente. Indicar: (1) Acto reclamado (número de liquidación/giro/resolución y fecha). (2) Hechos que se controvierten. (3) Derecho: errónea aplicación de la ley tributaria, errónea calificación de hechos o procedimiento. (4) Peticiones concretas: dejar sin efecto, reducir o anular el acto impugnado. Mencionar si se pide suspensión del cobro Art. 147 CT.' },
                { id: 'reposicion_administrativa_sii', label: 'Recurso de Reposición Administrativa (SII)',
                  prompt_extra: 'Art. 123 bis Código Tributario. Antes de reclamar ante TTA, el contribuyente puede reponer ante el propio SII. Plazo: 15 días hábiles desde notificación. El SII debe resolver en 50 días hábiles, si no, el recurso se entiende rechazado. Indicar: (1) Acto impugnado. (2) Vicios o errores de hecho y derecho. (3) Documentación que acredita los argumentos. (4) Petición concreta. La reposición no suspende el plazo para reclamar ante TTA.' },
                { id: 'apelacion_tta', label: 'Apelación contra Sentencia TTA',
                  prompt_extra: 'Art. 143 Código Tributario. Plazo: 15 días hábiles desde notificación sentencia definitiva TTA. Ante la Corte de Apelaciones del domicilio del TTA. Indicar: (1) Sentencia apelada. (2) Hechos y considerandos que se impugnan. (3) Normas tributarias infringidas y modo de infracción. (4) Petición: revocar o enmendar la sentencia. Si cuantía > 200 UTM puede recurrir luego de casación en el fondo ante Corte Suprema.' },
                { id: 'denuncia_infraccion_tributaria', label: 'Descargos ante Infracción Tributaria',
                  prompt_extra: 'Art. 161 Código Tributario (procedimiento infracciones). Si SII notifica infracción al contribuyente, este tiene derecho a presentar descargos ante el Director Regional. Plazo: fijado en la citación (usualmente 10 días hábiles). Indicar: (1) Infracción imputada y artículo. (2) Hechos que la desvirtúan. (3) Documentación de respaldo. (4) Petición: sobreseer o rebajar sanción. El Director Regional resuelve; en contra cabe reclamación ante TTA.' },
            ],
            contencioso: [
                { id: 'recurso_ilegalidad', label: 'Recurso de Ilegalidad (Art. 151 LOCM)',
                  prompt_extra: 'Art. 151 Ley 18.695 (LOCM). Ante la Corte de Apelaciones del domicilio de la Municipalidad. Plazo: 30 días desde la publicación, notificación o conocimiento del acto impugnado. Legitimados: particulares agraviados y el Alcalde contra acuerdos del Concejo. Causales: actos u omisiones ilegales de la Municipalidad que afecten derechos o intereses del recurrente. Indicar: (1) Acto u omisión impugnada. (2) Norma legal infringida. (3) Perjuicio concreto. (4) Petición: declarar la ilegalidad y ordenar medidas de reparación.' },
                { id: 'recurso_proteccion', label: 'Recurso de Protección (Art. 20 CPR)',
                  prompt_extra: 'Art. 20 Constitución Política. Ante la Corte de Apelaciones del domicilio del recurrente o donde ocurrió el acto. Plazo: 30 días corridos desde la ejecución del acto o desde que el afectado tomó conocimiento. Garantías protegidas: enumeradas en Art. 20 (incluye Art. 19 N°s 1,2,3 inc.4,4,5,6,9 inc.final,11,12,13,15,16,19,21,22,23,24 y 25 CPR). Indicar: (1) Acto u omisión arbitrario o ilegal. (2) Garantía constitucional vulnerada (número exacto). (3) Nexo causal. (4) Petición: dejar sin efecto el acto y restablecer el derecho. Tribunal puede decretar medidas cautelares inmediatas.' },
                { id: 'reclamo_organ_estado', label: 'Reclamo de Ilegalidad contra Órgano del Estado',
                  prompt_extra: 'Recurso administrativo ante el órgano superior jerárquico (reposición o jerárquico) o directamente ante los tribunales en los casos que la ley lo permita. Indicar: (1) Acto administrativo impugnado (número, fecha, órgano que lo dictó). (2) Vicios de legalidad: competencia, procedimiento, forma, motivación, finalidad o proporcionalidad. (3) Derechos o intereses afectados. (4) Petición: declarar nulidad de derecho público (Art. 7 CPR) u otro remedio específico. Mencionar si se invoca responsabilidad del Estado Art. 38 inc.2 CPR.' },
                { id: 'reclamacion_expropiacion', label: 'Reclamación de Expropiación',
                  prompt_extra: 'DL 2.186 Ley Orgánica de Expropiaciones. Si el expropiado no está conforme con el monto de la indemnización provisional, puede reclamar ante el juez civil competente. Plazo: 30 días desde notificación de toma de posesión material. También puede reclamar la legalidad del acto expropiatorio ante el tribunal competente. Indicar: (1) Acto expropiatorio (decreto, ministerio, fecha). (2) Bien expropiado y su avalúo. (3) Fundamento de la impugnación (valor o legalidad). (4) Petición: indemnización justa o nulidad del acto.' },
            ],
        };

        /**
         * Fusiona TIPOS_ESCRITOS_EXTRA con el catálogo principal TIPOS_ESCRITOS
         * definido en 09-app-core.js. Ejecutado con guard por si 09 aún no cargó.
         * @internal
         */
        (function _fusionarCatalogos() {
            if (typeof TIPOS_ESCRITOS !== 'undefined') {
                Object.assign(TIPOS_ESCRITOS, TIPOS_ESCRITOS_EXTRA);
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    if (typeof TIPOS_ESCRITOS !== 'undefined') {
                        Object.assign(TIPOS_ESCRITOS, TIPOS_ESCRITOS_EXTRA);
                    }
                });
            }
        })();

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 3 — HISTORIAL DE ESCRITOS — CAPA DE DATOS
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Guarda un escrito nuevo en el historial del despacho (DB.historialEscritos).
         * Mantiene un máximo de 200 entradas (FIFO sobre las más antiguas).
         *
         * En Fase 2: reemplazar body por POST /api/escritos/historial.
         *
         * @param {object} params
         * @param {string} params.causaId   - ID de la causa asociada.
         * @param {string} params.tipo      - ID del tipo de escrito (e.g. 'demanda_civil').
         * @param {string} params.tipoLabel - Etiqueta legible del tipo.
         * @param {string} params.texto     - Texto completo del escrito.
         * @param {'ia'|'plantilla'|'catalogo'|'manual'} params.origen - Cómo fue generado.
         * @returns {string} ID de la entrada creada.
         */
        function historialGuardarEscrito({ causaId, tipo, tipoLabel, texto, origen }) {
            const causa = DB.causas.find(c => c.id === causaId);
            const entrada = {
                id:        uid(),
                causaId,
                caratula:  causa ? causa.caratula : '—',
                tipo,
                tipoLabel: tipoLabel || tipo,
                texto,
                origen:    origen || 'manual',
                autor:     DB.usuarioActual || 'admin',
                fecha:     new Date().toISOString(),
                favorito:  false,
                tags:      [],
            };
            DB.historialEscritos.unshift(entrada);
            if (DB.historialEscritos.length > 200) DB.historialEscritos.length = 200;
            if (typeof markAppDirty === "function") markAppDirty(); save();
            return entrada.id;
        }

        /**
         * Elimina una entrada del historial por su ID y persiste.
         *
         * En Fase 2: DELETE /api/escritos/historial/:id.
         *
         * @param {string} id - ID del escrito a eliminar.
         */
        function historialEliminarEscritoData(id) {
            DB.historialEscritos = DB.historialEscritos.filter(e => e.id !== id);
            if (typeof markAppDirty === "function") markAppDirty(); save();
        }

        /**
         * Alterna el flag `favorito` de una entrada del historial.
         *
         * En Fase 2: PATCH /api/escritos/historial/:id/favorito.
         *
         * @param {string} id - ID del escrito.
         * @returns {boolean|null} Nuevo valor de favorito, o null si no se encontró.
         */
        function historialToggleFavoritoData(id) {
            const e = DB.historialEscritos.find(x => x.id === id);
            if (!e) return null;
            e.favorito = !e.favorito;
            if (typeof markAppDirty === "function") markAppDirty(); save();
            return e.favorito;
        }

        /**
         * Obtiene una entrada del historial por ID.
         *
         * En Fase 2: GET /api/escritos/historial/:id.
         *
         * @param {string} id
         * @returns {object|undefined}
         */
        function historialObtenerEscrito(id) {
            return DB.historialEscritos.find(x => x.id === id);
        }

        /**
         * Devuelve el historial filtrado según los parámetros indicados.
         * No toca el DOM — retorna el array limpio para que la UI lo consuma.
         *
         * En Fase 2: GET /api/escritos/historial?texto=&origen=&favoritos=.
         *
         * @param {object} [filtro]
         * @param {string}  [filtro.texto]     - Búsqueda libre sobre tipoLabel, caratula y texto.
         * @param {string}  [filtro.origen]    - Filtro exacto de origen ('ia','plantilla', etc.).
         * @param {boolean} [filtro.favoritos] - Si true, sólo devuelve favoritos.
         * @returns {Array<object>} Lista filtrada, orden más-reciente-primero.
         */
        function historialFiltrarData({ texto = '', origen = '', favoritos = false } = {}) {
            let lista = [...DB.historialEscritos];
            if (favoritos) lista = lista.filter(e => e.favorito);
            if (origen)    lista = lista.filter(e => e.origen === origen);
            if (texto) {
                const q = texto.toLowerCase();
                lista = lista.filter(e =>
                    (e.tipoLabel || '').toLowerCase().includes(q) ||
                    (e.caratula  || '').toLowerCase().includes(q) ||
                    (e.texto     || '').toLowerCase().includes(q)
                );
            }
            return lista;
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 3b — VERSIONES POR ESCRITO — CAPA DE DATOS
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Guarda una nueva versión textual de un escrito existente en el historial.
         * Si la entrada aún no tiene versiones, crea la v1 con el texto original.
         * Siempre actualiza entrada.texto al texto más reciente.
         *
         * En Fase 2: POST /api/escritos/historial/:id/versiones.
         *
         * @param {string} escritoId    - ID de la entrada del historial.
         * @param {string} textoNuevo   - Nuevo texto a persistir.
         * @param {string} [notaVersion] - Nota descriptiva de la versión.
         * @returns {number|undefined}  Número de versión creado, o undefined si no existe la entrada.
         */
        function historialGuardarVersion(escritoId, textoNuevo, notaVersion) {
            const entrada = DB.historialEscritos.find(e => e.id === escritoId);
            if (!entrada) return;

            if (!entrada.versiones) {
                entrada.versiones = [{
                    v:     1,
                    texto: entrada.texto,
                    fecha: entrada.fecha,
                    nota:  'Versión original',
                    autor: entrada.autor,
                }];
            }

            const numV = entrada.versiones.length + 1;
            entrada.versiones.push({
                v:     numV,
                texto: textoNuevo,
                fecha: new Date().toISOString(),
                nota:  notaVersion || `Versión ${numV}`,
                autor: DB.usuarioActual || 'admin',
            });

            entrada.texto = textoNuevo;
            if (typeof markAppDirty === "function") markAppDirty(); save();
            return numV;
        }

        /**
         * Restaura el texto de una versión anterior de un escrito.
         * Guarda el texto actual como nueva versión antes de restaurar (no se pierde nada).
         *
         * En Fase 2: POST /api/escritos/historial/:id/versiones/:v/restaurar.
         *
         * @param {string} escritoId  - ID de la entrada del historial.
         * @param {number} numVersion - Número de versión (campo `v`) a restaurar.
         * @returns {{ exito: boolean, textoRestaurado?: string, nota?: string }}
         */
        function historialRestaurarVersionData(escritoId, numVersion) {
            const entrada = DB.historialEscritos.find(e => e.id === escritoId);
            if (!entrada || !entrada.versiones) return { exito: false };
            const ver = entrada.versiones.find(v => v.v === numVersion);
            if (!ver) return { exito: false };

            historialGuardarVersion(escritoId, ver.texto, `Restauración desde v${numVersion}`);
            return { exito: true, textoRestaurado: ver.texto, nota: ver.nota };
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 3c — VARIABLES DINÁMICAS — CAPA DE DATOS
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Mapa de variables → función extractora del valor a partir del objeto causa.
         * Clave: nombre de la variable tal como aparece entre corchetes en el texto ([CLAVE]).
         * @type {Object.<string, function(object): string>}
         */
        const VAR_MAP = {
            // Causa
            'CARATULA':        c => c.caratula || '',
            'RIT':             c => c.rit || c.rol || '',
            'ROL':             c => c.rol || c.rit || '',
            'TRIBUNAL':        c => c.juzgado || '',
            'JUZGADO':         c => c.juzgado || '',
            'PROCEDIMIENTO':   c => c.tipoProcedimiento || '',
            'RAMA':            c => c.rama || '',
            'ESTADO':          c => c.estadoGeneral || '',
            // Partes
            'DEMANDANTE':      c => (c.partes || []).find(p => p.rol === 'Demandante')?.nombre || '[DEMANDANTE]',
            'DEMANDADO':       c => (c.partes || []).find(p => p.rol === 'Demandado')?.nombre  || '[DEMANDADO]',
            'RUT_DEMANDANTE':  c => (c.partes || []).find(p => p.rol === 'Demandante')?.rut     || '[RUT]',
            'RUT_DEMANDADO':   c => (c.partes || []).find(p => p.rol === 'Demandado')?.rut      || '[RUT]',
            // Cliente
            'CLIENTE':         c => { const cl = DB.clientes?.find(x => x.id === c.clienteId); return cl?.nombre || ''; },
            'RUT_CLIENTE':     c => { const cl = DB.clientes?.find(x => x.id === c.clienteId); return cl?.rut    || ''; },
            'EMAIL_CLIENTE':   c => { const cl = DB.clientes?.find(x => x.id === c.clienteId); return cl?.email  || ''; },
            // Fecha
            'FECHA_HOY':       _ => new Date().toLocaleDateString('es-CL'),
            'FECHA_HOY_LARGA': _ => new Date().toLocaleDateString('es-CL', {weekday:'long', day:'numeric', month:'long', year:'numeric'}),
            'ANIO':            _ => String(new Date().getFullYear()),
            'MES':             _ => new Date().toLocaleString('es-CL', { month: 'long' }),
        };

        /**
         * Reemplaza todas las ocurrencias de [VARIABLE] en el texto con los valores
         * reales extraídos de la causa. Las variables no reconocidas se dejan intactas.
         * Función pura — no modifica estado global.
         *
         * En Fase 2: esta lógica puede moverse al backend sin cambios.
         *
         * @param {string} texto  - Texto del escrito con marcadores [VARIABLE].
         * @param {object} causa  - Objeto causa de DB.causas.
         * @returns {{ texto: string, reemplazos: Array<{var: string, valor: string}> }}
         *   `texto`: texto con variables sustituidas.
         *   `reemplazos`: lista de las sustituciones realizadas.
         */
        function aplicarVariablesDinamicas(texto, causa) {
            if (!texto || !causa) return { texto, reemplazos: [] };
            const reemplazos = [];

            const resultado = texto.replace(/\[([A-Z_]+)\]/g, (match, varName) => {
                const fn = VAR_MAP[varName];
                if (!fn) return match;
                const valor = fn(causa);
                if (valor) reemplazos.push({ var: varName, valor });
                return valor || match;
            });

            return { texto: resultado, reemplazos };
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 4 — PLANTILLAS PERSONALIZADAS — CAPA DE DATOS
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Crea una nueva plantilla de escrito y la persiste en DB.plantillasEscritos.
         *
         * En Fase 2: POST /api/escritos/plantillas.
         *
         * @param {object} datos
         * @param {string}   datos.nombre         - Nombre legible (requerido).
         * @param {string}   datos.materia         - Materia jurídica ('civil','laboral',etc.).
         * @param {string}   [datos.descripcion]
         * @param {string}   [datos.instrucciones] - Prompt extra para IA.
         * @param {string}   [datos.cuerpo]        - Texto base de la plantilla.
         * @param {string[]} [datos.tags]
         * @returns {string} ID de la plantilla creada.
         */
        function plantillaCrearData(datos) {
            const { nombre, materia = 'civil', descripcion = '', instrucciones = '', cuerpo = '', tags = [] } = datos;
            const nueva = {
                id:                uid(),
                nombre,
                materia,
                descripcion,
                instrucciones,
                cuerpo,
                tags,
                autor:             DB.usuarioActual || 'admin',
                fechaCreacion:     new Date().toISOString(),
                fechaModificacion: new Date().toISOString(),
                usosCount:         0,
            };
            DB.plantillasEscritos.push(nueva);
            if (typeof markAppDirty === "function") markAppDirty(); save();
            return nueva.id;
        }

        /**
         * Actualiza los datos de una plantilla existente.
         *
         * En Fase 2: PUT /api/escritos/plantillas/:id.
         *
         * @param {string} id    - ID de la plantilla a actualizar.
         * @param {object} datos - Campos a modificar (parcial o total).
         * @returns {boolean} `true` si se encontró y actualizó, `false` si no existía.
         */
        function plantillaActualizarData(id, datos) {
            const p = DB.plantillasEscritos.find(x => x.id === id);
            if (!p) return false;
            Object.assign(p, datos, { fechaModificacion: new Date().toISOString() });
            if (typeof markAppDirty === "function") markAppDirty(); save();
            return true;
        }

        /**
         * Elimina una plantilla del store.
         *
         * En Fase 2: DELETE /api/escritos/plantillas/:id.
         *
         * @param {string} id - ID de la plantilla a eliminar.
         */
        function plantillaEliminarData(id) {
            DB.plantillasEscritos = DB.plantillasEscritos.filter(x => x.id !== id);
            if (typeof markAppDirty === "function") markAppDirty(); save();
        }

        /**
         * Obtiene una plantilla por ID.
         *
         * En Fase 2: GET /api/escritos/plantillas/:id.
         *
         * @param {string} id
         * @returns {object|undefined}
         */
        function plantillaObtenerData(id) {
            return DB.plantillasEscritos.find(x => x.id === id);
        }

        /**
         * Incrementa el contador de usos de una plantilla.
         *
         * En Fase 2: PATCH /api/escritos/plantillas/:id/uso.
         *
         * @param {string} id - ID de la plantilla usada.
         */
        function plantillaRegistrarUsoData(id) {
            const p = DB.plantillasEscritos.find(x => x.id === id);
            if (!p) return;
            p.usosCount = (p.usosCount || 0) + 1;
            if (typeof markAppDirty === "function") markAppDirty(); save();
        }

        // ═══════════════════════════════════════════════════════════════════
        // SECCIÓN 5 — DETECCIÓN DE ORIGEN DEL ESCRITO
        // ═══════════════════════════════════════════════════════════════════

        /**
         * Detecta el origen real del escrito actual según el tipo seleccionado
         * en el DOM y si el modo IA está activo.
         * Esta función lee el DOM sólo para la detección; no escribe nada.
         *
         * @returns {'ia'|'plantilla'|'catalogo'}
         */
        function detectarOrigenEscrito() {
            const modoIA  = document.getElementById('esc-modo-ia')?.checked || false;
            const tipoVal = document.getElementById('esc-tipo')?.value       || '';
            if (modoIA)                           return 'ia';
            if (tipoVal.startsWith('plantilla__')) return 'plantilla';
            return 'catalogo';
        }
