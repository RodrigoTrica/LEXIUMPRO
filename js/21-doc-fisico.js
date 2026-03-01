        // ████████████████████████████████████████████████████████████████████
        // JS — MÓDULO 21: ALMACENAMIENTO FÍSICO DE DOCUMENTOS EN DISCO
        // Guarda los archivos adjuntos como archivos reales en una carpeta
        // estructurada dentro de la carpeta raíz de la app.
        //
        // Estructura de carpetas generada automáticamente:
        //
        //  [carpeta-raiz]/                  ← elegida por el usuario (una vez)
        //  ├── backups/                     ← backups JSON (BackupDisco)
        //  ├── documentos/
        //  │   ├── [id-causa]_[caratula]/   ← una carpeta por causa
        //  │   │   ├── contrato.pdf
        //  │   │   ├── demanda.docx
        //  │   │   └── ...
        //  │   └── sin-causa/              ← adjuntos sin causa asociada
        //  └── exportaciones/              ← reportes HTML exportados
        //
        // Requiere File System Access API (Chrome/Edge).
        // Si no está disponible, no hace nada (los adjuntos siguen en localStorage).
        // ████████████████████████████████████████████████████████████████████

        const DocFisico = (() => {
            const KEY_ROOT = 'APPBOGADO_ROOT_DIR_HANDLE_NAME';
            let _rootHandle = null; // handle de la carpeta raíz

            // ── Soporte ─────────────────────────────────────────────────────
            function soportaFS() {
                return 'showDirectoryPicker' in window;
            }

            // ── Obtener o crear subcarpeta ───────────────────────────────────
            async function _getDir(parentHandle, nombre) {
                try {
                    return await parentHandle.getDirectoryHandle(nombre, { create: true });
                } catch (e) {
                    console.error('[DocFisico] Error creando carpeta:', nombre, e);
                    return null;
                }
            }

            // ── Sanitizar nombre de carpeta ──────────────────────────────────
            function _sanitizar(texto) {
                return (texto || 'sin-nombre')
                    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
                    .replace(/\s+/g, '_')
                    .substring(0, 50);
            }

            // ── Nombre de carpeta para una causa ────────────────────────────
            function _nombreCarpetaCausa(causa) {
                const id = String(causa.id).substring(0, 8);
                const caratula = _sanitizar(causa.caratula);
                return `${id}_${caratula}`;
            }

            // ── Obtener handle de carpeta de una causa ───────────────────────
            async function _getDirCausa(causa) {
                if (!_rootHandle) return null;
                const docsDir = await _getDir(_rootHandle, 'documentos');
                if (!docsDir) return null;
                const nombre = causa ? _nombreCarpetaCausa(causa) : 'sin-causa';
                return await _getDir(docsDir, nombre);
            }

            // ── Verificar/renovar permiso ────────────────────────────────────
            async function _verificarPermiso() {
                if (!_rootHandle) return false;
                try {
                    const perm = await _rootHandle.queryPermission({ mode: 'readwrite' });
                    if (perm === 'granted') return true;
                    const req = await _rootHandle.requestPermission({ mode: 'readwrite' });
                    return req === 'granted';
                } catch (e) {
                    return false;
                }
            }

            // ── Guardar un archivo en disco ──────────────────────────────────
            async function _escribirArchivo(dirHandle, nombre, base64DataUrl) {
                try {
                    // Convertir base64 data URL a Blob
                    const resp = await fetch(base64DataUrl);
                    const blob = await resp.blob();
                    const fileHandle = await dirHandle.getFileHandle(nombre, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    return true;
                } catch (e) {
                    console.error('[DocFisico] Error escribiendo archivo:', nombre, e);
                    return false;
                }
            }

            // ── Crear estructura de carpetas completa ────────────────────────
            async function _crearEstructura() {
                if (!_rootHandle) return;
                await _getDir(_rootHandle, 'documentos');
                await _getDir(_rootHandle, 'backups');
                await _getDir(_rootHandle, 'exportaciones');
                // Carpeta sin-causa
                const docsDir = await _getDir(_rootHandle, 'documentos');
                if (docsDir) await _getDir(docsDir, 'sin-causa');
            }

            // ── Actualizar indicador visual ──────────────────────────────────
            function _actualizarIndicador() {
                const el = document.getElementById('docfisico-estado');
                if (!el) return;
                const nombre = AppConfig.get('docfisico_raiz');
                if (_rootHandle && nombre) {
                    el.innerHTML = 'Docs en: <strong>' + nombre + '</strong>';
                    el.style.color = '#66bb6a';
                } else if (nombre) {
                    el.innerHTML = 'Carpeta: ' + nombre + ' (reabrir sesion)';
                    el.style.color = '#ffa726';
                } else {
                    el.innerHTML = 'Sin carpeta de docs';
                    el.style.color = '#e57373';
                }
            }

            // ════════════════════════════════════════════════════════════════
            // API PÚBLICA
            // ════════════════════════════════════════════════════════════════
            return {

                // Devuelve si está activo y listo para usar
                activo() { return !!_rootHandle; },

                // Elegir carpeta raíz (se llama una sola vez desde el sidebar)
                async elegirCarpeta() {
                    if (!soportaFS()) {
                        if (typeof showError === 'function')
                            showError('Tu navegador no soporta esta funcion. Usa Chrome o Edge.');
                        return false;
                    }
                    try {
                        _rootHandle = await window.showDirectoryPicker({
                            id: 'appbogado-root',
                            mode: 'readwrite',
                            startIn: 'documents'
                        });
                        AppConfig.set('docfisico_raiz', _rootHandle.name);

                        // Crear estructura de carpetas
                        await _crearEstructura();

                        // Compartir handle con BackupDisco para que use la subcarpeta backups/
                        if (typeof BackupDisco !== 'undefined' && BackupDisco._setRootHandle) {
                            BackupDisco._setRootHandle(_rootHandle);
                        }

                        _actualizarIndicador();
                        if (typeof showSuccess === 'function')
                            showSuccess('Carpeta raiz "' + _rootHandle.name + '" configurada. Estructura creada: /documentos/, /backups/, /exportaciones/');
                        return true;
                    } catch (e) {
                        if (e.name !== 'AbortError') console.error('[DocFisico] Error eligiendo carpeta:', e);
                        return false;
                    }
                },

                // Llamar al iniciar sesión
                iniciar() {
                    _actualizarIndicador();
                    // El handle no persiste entre sesiones del navegador,
                    // pero mostramos el nombre guardado como recordatorio.
                },

                // Guardar UN adjunto recién subido en disco
                async guardarAdjunto(adjunto, causa) {
                    if (!_rootHandle) return false;
                    if (!adjunto?.base64 || !adjunto?.nombre) return false;

                    const tienePermiso = await _verificarPermiso();
                    if (!tienePermiso) return false;

                    const dirCausa = await _getDirCausa(causa || null);
                    if (!dirCausa) return false;

                    const ok = await _escribirArchivo(dirCausa, adjunto.nombre, adjunto.base64);
                    if (ok) console.info('[DocFisico] Archivo guardado:', adjunto.nombre, '→', causa?.caratula || 'sin-causa');
                    return ok;
                },

                // Sincronizar TODOS los adjuntos existentes a disco (uso manual)
                async sincronizarTodo() {
                    if (!_rootHandle) {
                        if (typeof showError === 'function')
                            showError('Primero elige una carpeta raiz con el boton "Carpeta de la app"');
                        return;
                    }

                    const tienePermiso = await _verificarPermiso();
                    if (!tienePermiso) {
                        if (typeof showError === 'function')
                            showError('No hay permiso para escribir en la carpeta. Intenta de nuevo.');
                        return;
                    }

                    let total = 0, errores = 0;
                    const causas = DB.causas || [];

                    for (const causa of causas) {
                        const adjuntos = causa.adjuntos || [];
                        if (!adjuntos.length) continue;

                        const dirCausa = await _getDirCausa(causa);
                        if (!dirCausa) { errores++; continue; }

                        for (const adj of adjuntos) {
                            if (!adj.base64) continue;
                            const ok = await _escribirArchivo(dirCausa, adj.nombre, adj.base64);
                            ok ? total++ : errores++;
                        }
                    }

                    const msg = `Sincronizacion completa: ${total} archivo(s) guardado(s) en disco.` +
                        (errores ? ` ${errores} error(es).` : '');
                    if (typeof showSuccess === 'function') showSuccess(msg);
                    console.info('[DocFisico]', msg);
                },

                // Guardar un reporte/exportacion HTML en /exportaciones/
                async guardarExportacion(nombre, contenidoHTML) {
                    if (!_rootHandle) return false;
                    const tienePermiso = await _verificarPermiso();
                    if (!tienePermiso) return false;
                    const expDir = await _getDir(_rootHandle, 'exportaciones');
                    if (!expDir) return false;
                    try {
                        const blob = new Blob([contenidoHTML], { type: 'text/html; charset=utf-8' });
                        const fileHandle = await expDir.getFileHandle(nombre, { create: true });
                        const writable = await fileHandle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        return true;
                    } catch (e) {
                        console.error('[DocFisico] Error guardando exportacion:', e);
                        return false;
                    }
                },

                // Exponer handle para BackupDisco
                getRootHandle() { return _rootHandle; },
                _actualizarIndicador,
            };
        })();
