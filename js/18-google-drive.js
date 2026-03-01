// ████████████████████████████████████████████████████████████████████
// JS — F13: GOOGLE DRIVE INTEGRATION
// • OAuth2 client-side (sin backend)
// • Sync bidireccional de datos principales
// • Versionado de documentos en Drive
// • Habilita F6, F10 y resuelve el problema de storage
// Requiere: Google Cloud Console client_id configurado en DRIVE_CLIENT_ID
// ████████████████████████████████████████████████████████████████████

const GoogleDrive = (() => {
    // ──────────────────────────────────────────────────────────────
    // CONFIGURACIÓN — El abogado debe ingresar su client_id en la UI
    // Instrucciones en: https://console.cloud.google.com/
    // API habilitada: Google Drive API v3
    // ──────────────────────────────────────────────────────────────
    const DRIVE_CONFIG_KEY = 'APPBOGADO_DRIVE_CONFIG_V1';
    const DRIVE_FOLDER_NAME = 'AppBogado — Despacho';
    const SYNC_META_KEY = 'APPBOGADO_DRIVE_SYNC_META';
    const SCOPES = 'https://www.googleapis.com/auth/drive.file';

    // Estado interno (en memoria — no se persiste el token por seguridad)
    let _accessToken = null;
    let _tokenExpiry = null;   // timestamp ms
    let _folderId = null;   // ID de la carpeta en Drive
    let _tokenClient = null;   // Google OAuth2 token client
    let _isInitialized = false;

    // ── Configuración persistida (solo client_id, NUNCA el token) ──
    function _loadConfig() {
        try { return AppConfig.get('drive_config') || {}; }
        catch (e) { return {}; }
    }

    function _saveConfig(cfg) {
        try { AppConfig.set('drive_config', cfg); }
        catch (e) { console.error('[Drive] Error guardando config:', e); }
    }

    function getClientId() { return _loadConfig().clientId || ''; }
    function isConfigured() { return !!getClientId(); }
    function isConnected() { return !!_accessToken && Date.now() < (_tokenExpiry || 0); }

    // ── Metadatos de sync ──────────────────────────────────────────
    function _loadSyncMeta() {
        try { return AppConfig.get('drive_sync_meta') || {}; }
        catch (e) { return {}; }
    }

    function _saveSyncMeta(meta) {
        try { AppConfig.set('drive_sync_meta', meta); }
        catch (e) { }
    }

    // ── Carga la librería GIS (Google Identity Services) ──────────
    function _loadGIS() {
        return new Promise((resolve, reject) => {
            if (window.google?.accounts?.oauth2) { resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services. Verifica tu conexión.'));
            document.head.appendChild(script);
        });
    }

    // ── Inicializar OAuth2 token client ────────────────────────────
    async function _initTokenClient() {
        const clientId = getClientId();
        if (!clientId) throw new Error('CLIENT_ID no configurado.');
        await _loadGIS();

        return new Promise((resolve, reject) => {
            _tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (response) => {
                    if (response.error) {
                        EventBus.emit('drive:error', { error: response.error });
                        reject(new Error(response.error));
                        return;
                    }
                    _accessToken = response.access_token;
                    // GIS devuelve expires_in en segundos
                    _tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
                    _isInitialized = true;
                    EventBus.emit('drive:connected', { expiry: _tokenExpiry });
                    _driveRenderStatus();
                    resolve(response);
                },
                error_callback: (err) => {
                    EventBus.emit('drive:error', { error: err });
                    reject(new Error(err.message || 'OAuth2 error'));
                }
            });
            resolve(_tokenClient);
        });
    }

    // ── Solicitar token (abre popup Google) ───────────────────────
    async function connect() {
        if (!getClientId()) {
            showError('Configure el Google Client ID en la sección Drive antes de conectar.');
            return;
        }
        try {
            await _initTokenClient();
            // Pedir token (puede mostrar popup si no hay sesión)
            _tokenClient.requestAccessToken({ prompt: 'consent' });
        } catch (e) {
            showError('Error al conectar con Google: ' + e.message);
            console.error('[Drive] connect error:', e);
        }
    }

    // ── Refresh silencioso (sin popup) ────────────────────────────
    async function refreshToken() {
        if (!_tokenClient) await _initTokenClient();
        return new Promise((resolve, reject) => {
            const originalCallback = _tokenClient.callback;
            _tokenClient.callback = (response) => {
                if (response.error) { reject(new Error(response.error)); return; }
                _accessToken = response.access_token;
                _tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
                _tokenClient.callback = originalCallback;
                resolve(response);
            };
            _tokenClient.requestAccessToken({ prompt: '' }); // sin popup
        });
    }

    // ── Revocar token y desconectar ────────────────────────────────
    function disconnect() {
        if (_accessToken) {
            google.accounts.oauth2.revoke(_accessToken, () => { });
        }
        _accessToken = null;
        _tokenExpiry = null;
        _folderId = null;
        _tokenClient = null;
        _isInitialized = false;
        EventBus.emit('drive:disconnected', {});
        _driveRenderStatus();
        showInfo('Desconectado de Google Drive.');
    }

    // ── Helper para llamadas a Drive API v3 ───────────────────────
    async function _driveRequest(path, options = {}) {
        // Auto-refresh si el token está por vencer
        if (_tokenExpiry && Date.now() > _tokenExpiry - 30000) {
            try { await refreshToken(); } catch (e) { /* si falla, el request fallará con 401 */ }
        }
        if (!_accessToken) throw new Error('No hay sesión activa con Google Drive.');

        const url = path.startsWith('http') ? path : `https://www.googleapis.com/drive/v3${path}`;
        const resp = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${_accessToken}`,
                ...(options.headers || {})
            }
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(`Drive API ${resp.status}: ${err?.error?.message || resp.statusText}`);
        }

        return resp.status === 204 ? null : resp.json();
    }

    // ── Obtener/crear carpeta AppBogado en Drive ───────────────────
    async function _getOrCreateFolder() {
        if (_folderId) return _folderId;

        // Buscar carpeta existente
        const search = await _driveRequest(
            `/files?q=name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`
        );

        if (search.files?.length > 0) {
            _folderId = search.files[0].id;
            return _folderId;
        }

        // Crear carpeta nueva
        const created = await _driveRequest('/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: DRIVE_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder'
            })
        });

        _folderId = created.id;
        return _folderId;
    }

    // ── Subir o actualizar un archivo en Drive ─────────────────────
    async function uploadFile(filename, content, mimeType = 'application/json', existingFileId = null) {
        const folderId = await _getOrCreateFolder();
        const metadata = { name: filename, parents: existingFileId ? undefined : [folderId] };
        const boundary = '-------AppBogadoBoundary';
        const body = [
            `--${boundary}`,
            'Content-Type: application/json; charset=UTF-8',
            '',
            JSON.stringify(metadata),
            `--${boundary}`,
            `Content-Type: ${mimeType}`,
            '',
            typeof content === 'string' ? content : JSON.stringify(content),
            `--${boundary}--`
        ].join('\r\n');

        const endpoint = existingFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

        return _driveRequest(endpoint, {
            method: existingFileId ? 'PATCH' : 'POST',
            headers: { 'Content-Type': `multipart/related; boundary="${boundary}"` },
            body
        });
    }

    // ── Leer un archivo de Drive ───────────────────────────────────
    async function downloadFile(fileId) {
        const text = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { 'Authorization': `Bearer ${_accessToken}` } }
        ).then(r => r.text());
        return JSON.parse(text);
    }

    // ── Buscar un archivo por nombre en la carpeta AppBogado ────────
    async function findFile(filename) {
        const folderId = await _getOrCreateFolder();
        const res = await _driveRequest(
            `/files?q=name='${filename}' and '${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime,size)`
        );
        return res.files?.[0] || null;
    }

    // ═══════════════════════════════════════════════════════════════
    // SYNC — Sincronización de datos de la app
    // ═══════════════════════════════════════════════════════════════

    // Nombre del archivo principal de datos en Drive
    const MAIN_DATA_FILE = 'appbogado-datos.json';

    /**
     * pushToCloud — Sube el snapshot completo de Store a Drive.
     * Usar después de operaciones CRUD importantes.
     * Para guardados frecuentes (cada 5 min) usar pushAutoSync.
     */
    async function pushToCloud(motivo = 'manual') {
        if (!isConnected()) throw new Error('No conectado a Drive.');

        const snapshot = Store.snapshot();
        const meta = _loadSyncMeta();
        const existing = await findFile(MAIN_DATA_FILE);

        // ── Incluir módulos con almacenamiento propio ──────────────────
        // Desde v15, Doctrina está integrada en Store (no requiere merge manual).
        // Solo Trámites mantiene almacenamiento aislado.
        try {
            const rawTram = localStorage.getItem('APPBOGADO_TRAMITES_V1');
            if (rawTram) snapshot._tramites = JSON.parse(rawTram);
        } catch (e) {
            console.warn('[Drive] No se pudieron incluir Trámites en el snapshot:', e.message);
        }

        const uploaded = await uploadFile(
            MAIN_DATA_FILE,
            { snapshot, exportedAt: new Date().toISOString(), version: 14, motivo },
            'application/json',
            existing?.id || null
        );

        // Actualizar metadatos de sync
        meta.lastPush = new Date().toISOString();
        meta.driveFileId = uploaded.id;
        meta.motivo = motivo;
        _saveSyncMeta(meta);

        EventBus.emit('drive:pushed', { motivo, fileId: uploaded.id });
        _driveRenderStatus();
        return uploaded;
    }

    /**
     * pullFromCloud — Descarga datos desde Drive y los restaura en Store.
     * Usar para sincronizar entre dispositivos.
     */
    async function pullFromCloud() {
        if (!isConnected()) throw new Error('No conectado a Drive.');

        const meta = _loadSyncMeta();
        const fileId = meta.driveFileId;
        if (!fileId) {
            showInfo('No hay datos en Drive para este despacho. Suba primero desde otro dispositivo.');
            return null;
        }

        const data = await downloadFile(fileId);
        if (!data?.snapshot) throw new Error('Archivo Drive inválido o corrupto.');

        // Validación mínima de integridad
        if (!Array.isArray(data.snapshot.causas)) {
            throw new Error('Snapshot de Drive inválido: campo causas ausente o corrupto. Restauración abortada.');
        }

        // Crear backup local antes de restaurar
        AutoBackup?.crearSnapshot('pre-drive-pull');
        Store.restaurar(data.snapshot);

        // ── Restaurar módulos con almacenamiento propio ────────────────
        // Desde v15, Doctrina se restaura vía Store.restaurar() (ya está en el snapshot).
        // Para snapshots versión < 15 con _doctrina fuera del Store, migramos aquí.
        try {
            if (Array.isArray(data.snapshot._doctrina) && data.snapshot._doctrina.length > 0) {
                // Compatibilidad: si vino en el snapshot, Store.restaurar() ya lo incluyó.
                // Si por alguna razón no está en Store tras restaurar, forzamos la migración.
                if (!Store._doctrina.length) {
                    Store._ref._doctrina = data.snapshot._doctrina;
                    Store.save();
                }
            }
            if (Array.isArray(data.snapshot._tramites)) {
                localStorage.setItem('APPBOGADO_TRAMITES_V1', JSON.stringify(data.snapshot._tramites));
            }
        } catch (e) {
            console.warn('[Drive] No se pudieron restaurar módulos auxiliares:', e.message);
        }

        meta.lastPull = new Date().toISOString();
        _saveSyncMeta(meta);

        EventBus.emit('drive:pulled', { exportedAt: data.exportedAt });
        if (typeof renderAll === 'function') renderAll();

        return data;
    }

    /**
     * syncVersion — Guarda una versión nombrada de un documento en Drive.
     * Implementa F6 (versionado) sin llenar localStorage.
     */
    async function syncVersion(docId, docNombre, contenido, versionTag = '') {
        if (!isConnected()) throw new Error('No conectado a Drive.');

        const folderId = await _getOrCreateFolder();
        const tag = versionTag || new Date().toISOString().split('T')[0];
        const fname = `doc-${docId}-${tag}.json`;

        // Buscar versiones previas de este doc
        const search = await _driveRequest(
            `/files?q=name contains 'doc-${docId}-' and '${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc`
        );
        const versiones = search.files || [];

        // Mantener máximo 10 versiones en Drive (rotar)
        if (versiones.length >= 10) {
            const oldest = versiones.slice(9);
            for (const v of oldest) {
                await _driveRequest(`/files/${v.id}`, { method: 'DELETE' });
            }
        }

        return uploadFile(fname, { docId, docNombre, contenido, savedAt: new Date().toISOString(), tag }, 'application/json');
    }

    /**
     * listVersions — Lista versiones de un documento guardadas en Drive.
     */
    async function listVersions(docId) {
        if (!isConnected()) return [];
        const folderId = await _getOrCreateFolder();
        const search = await _driveRequest(
            `/files?q=name contains 'doc-${docId}-' and '${folderId}' in parents and trashed=false&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`
        );
        return search.files || [];
    }

    // ═══════════════════════════════════════════════════════════════
    // AUTO-SYNC — Sync periódico en background
    // ═══════════════════════════════════════════════════════════════
    let _syncTimer = null;

    function startAutoSync(intervalMs = 10 * 60 * 1000) {  // default: cada 10 min
        if (_syncTimer) clearInterval(_syncTimer);
        _syncTimer = setInterval(async () => {
            if (!isConnected()) return;
            try {
                await pushToCloud('auto-sync');
                console.info('[Drive] Auto-sync completado:', new Date().toLocaleTimeString('es-CL'));
            } catch (e) {
                console.warn('[Drive] Auto-sync falló:', e.message);
            }
        }, intervalMs);
    }

    function stopAutoSync() {
        if (_syncTimer) { clearInterval(_syncTimer); _syncTimer = null; }
    }

    // ═══════════════════════════════════════════════════════════════
    // UI — Render del panel de configuración de Drive
    // ═══════════════════════════════════════════════════════════════
    function _driveRenderStatus() {
        const container = document.getElementById('drive-status-container');
        if (!container) return;

        const meta = _loadSyncMeta();
        const connected = isConnected();
        const config = isConfigured();

        if (!config) {
            container.innerHTML = `
                        <div style="text-align:center; padding:20px; color:var(--t2);">
                            <i class="fab fa-google-drive" style="font-size:2rem; color:#94a3b8; margin-bottom:12px;"></i>
                            <p style="font-size:0.85rem; margin-bottom:12px;">Google Drive no configurado.</p>
                            <p style="font-size:0.78rem; color:#94a3b8;">Ingresa tu Client ID arriba para activar la sincronización.</p>
                        </div>`;
            return;
        }

        const lastPush = meta.lastPush ? new Date(meta.lastPush).toLocaleString('es-CL') : '—';
        const lastPull = meta.lastPull ? new Date(meta.lastPull).toLocaleString('es-CL') : '—';
        const statusColor = connected ? '#059669' : '#dc2626';
        const statusText = connected ? '🟢 Conectado' : '🔴 No conectado';

        container.innerHTML = `
                    <div style="display:flex; flex-direction:column; gap:12px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px;
                            background:${connected ? '#f0fdf4' : '#fef2f2'}; border-radius:10px;
                            border:1px solid ${connected ? '#bbf7d0' : '#fecaca'};">
                            <div>
                                <div style="font-weight:700; font-size:0.9rem; color:${statusColor};">${statusText}</div>
                                <div style="font-size:0.75rem; color:var(--t2); margin-top:2px;">
                                    Carpeta: ${DRIVE_FOLDER_NAME}
                                </div>
                            </div>
                            ${connected
                ? `<button onclick="GoogleDrive.disconnect()" class="btn btn-sm" style="background:#fef2f2; color:#dc2626; border:1px solid #fecaca;">
                                    <i class="fas fa-unlink"></i> Desconectar</button>`
                : `<button onclick="GoogleDrive.connect()" class="btn btn-p btn-sm">
                                    <i class="fab fa-google"></i> Conectar</button>`
            }
                        </div>

                        ${connected ? `
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                            <div style="background:var(--bg-2,#f8fafc); border-radius:8px; padding:12px; font-size:0.78rem;">
                                <div style="color:var(--t2); margin-bottom:4px;"><i class="fas fa-cloud-upload-alt"></i> Último push</div>
                                <div style="font-weight:600; color:var(--t);">${lastPush}</div>
                            </div>
                            <div style="background:var(--bg-2,#f8fafc); border-radius:8px; padding:12px; font-size:0.78rem;">
                                <div style="color:var(--t2); margin-bottom:4px;"><i class="fas fa-cloud-download-alt"></i> Último pull</div>
                                <div style="font-weight:600; color:var(--t);">${lastPull}</div>
                            </div>
                        </div>

                        <div style="display:flex; gap:8px; flex-wrap:wrap;">
                            <button onclick="GoogleDrive.pushToCloud('manual').then(() => showSuccess('✅ Datos sincronizados con Drive.')).catch(e => showError(e.message))"
                                class="btn btn-p" style="flex:1; min-width:120px;">
                                <i class="fas fa-cloud-upload-alt"></i> Subir a Drive
                            </button>
                            <button onclick="driveConfirmPull()" class="btn" style="flex:1; min-width:120px; background:var(--bg-2,#f8fafc); border:1px solid var(--border);">
                                <i class="fas fa-cloud-download-alt"></i> Descargar de Drive
                            </button>
                        </div>

                        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:10px 12px; font-size:0.76rem; color:#92400e;">
                            <i class="fas fa-info-circle"></i>
                            Auto-sync activo cada 10 min. Los archivos se guardan en tu Google Drive personal,
                            bajo tu cuenta — no en servidores de AppBogado.
                        </div>
                        ` : ''}
                    </div>`;
    }

    // Confirmación antes de pull (destructivo)
    function confirmPull() {
        const meta = _loadSyncMeta();
        const fecha = meta.lastPush ? new Date(meta.lastPush).toLocaleString('es-CL') : 'desconocida';
        showConfirm(
            'Descargar desde Drive',
            `Esto reemplazará TODOS los datos locales con los de Drive (subidos el ${fecha}). Se creará un backup local antes.`,
            async () => {
                try {
                    const data = await pullFromCloud();
                    if (data) showSuccess(`✅ Datos restaurados desde Drive (exportados: ${new Date(data.exportedAt).toLocaleString('es-CL')})`);
                } catch (e) { showError(e.message); }
            },
            'danger'
        );
    }

    // Render del panel de configuración (tab config-ia o nueva tab)
    function renderConfigPanel() {
        const container = document.getElementById('drive-config-panel');
        if (!container) return;

        const cfg = _loadConfig();
        container.innerHTML = `
                    <div class="card" style="box-shadow:var(--sh-2); border-top: 4px solid #4285f4; margin-top: 20px;">
                        <h3 style="margin:0 0 16px; font-size:1.1rem; color:var(--text); display:flex; align-items:center; gap:10px;">
                            <div style="background:#4285f415; padding:8px; border-radius:8px; display:flex;">
                                <i class="fab fa-google-drive" style="color:#4285f4;"></i>
                            </div>
                            Google Drive <span style="font-weight:400; color:var(--text-3); margin-left:5px;">— Nube Personal</span>
                        </h3>

                        <div style="background:var(--info-bg); border:1px solid var(--info-border); border-radius:var(--r-lg); padding:16px; margin-bottom:20px; font-size:13px; color:var(--info); display:flex; gap:14px; align-items:flex-start;">
                            <i class="fas fa-cloud-upload-alt" style="font-size:1.5rem; margin-top:2px;"></i>
                            <div>
                                <strong style="display:block; margin-bottom:4px;">Almacenamiento Descentralizado</strong>
                                Sus archivos se guardan en su propia cuenta de Drive bajo la carpeta 
                                <code style="background:rgba(0,0,0,0.05); padding:2px 6px; border-radius:4px; font-family:monospace; font-weight:700;">${DRIVE_FOLDER_NAME}</code>. 
                                Privacidad total garantizada por Google OAuth2.
                            </div>
                        </div>

                        <div style="margin-bottom:20px; background:var(--bg); border:1px solid var(--border); padding:20px; border-radius:var(--r-lg);">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <label style="font-size:12.5px; font-weight:700; color:var(--text);">
                                    Google OAuth2 Client ID
                                </label>
                                <a href="https://console.cloud.google.com/apis/credentials" target="_blank"
                                    style="font-size:11.5px; color:var(--cyan); font-weight:600; text-decoration:none;">
                                    <i class="fas fa-external-link-alt"></i> Guía de Configuración
                                </a>
                            </div>
                            <div style="display:flex; gap:10px;">
                                <input id="drive-client-id-input" type="text"
                                    value="${escHtml(cfg.clientId || '')}"
                                    placeholder="123456789-abc....apps.googleusercontent.com"
                                    style="flex:1; font-family:'IBM Plex Mono',monospace; font-size:13px; padding:10px 14px;"
                                >
                                <button onclick="GoogleDrive.saveClientId()" class="btn btn-p" style="padding:0 20px;">
                                    <i class="fas fa-save" style="margin-right:6px;"></i> Guardar
                                </button>
                            </div>
                            <div style="font-size:11.5px; color:var(--text-3); margin-top:8px; font-style:italic;">
                                <i class="fas fa-clock"></i> Requiere configuración única de ~10 min en Google Cloud Console.
                            </div>
                        </div>

                        <div id="drive-status-container" style="padding:10px 0;"></div>
                    </div>`;

        _driveRenderStatus();
    }

    function saveClientId() {
        const input = document.getElementById('drive-client-id-input');
        if (!input) return;
        const clientId = input.value.trim();
        if (!clientId) { showError('El Client ID no puede estar vacío.'); return; }
        if (!clientId.includes('.apps.googleusercontent.com')) {
            showError('El Client ID no parece válido. Debe terminar en .apps.googleusercontent.com');
            return;
        }
        _saveConfig({ clientId });
        registrarEvento('Google Drive Client ID configurado.');
        showSuccess('✅ Client ID guardado. Ahora puedes conectar con Google.');
        _driveRenderStatus();
    }

    // Suscribirse a eventos relevantes
    EventBus.on('drive:connected', async () => {
        startAutoSync();
        showSuccess('🟢 Conectado a Google Drive. Auto-sync activo.');

        // Obtener email del usuario autenticado en Google
        try {
            const resp = await fetch(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                { headers: { 'Authorization': `Bearer ${_accessToken}` } }
            );
            if (resp.ok) {
                const info = await resp.json();
                const emailEl = document.getElementById('topbar-email');
                if (emailEl && info.email) emailEl.textContent = info.email;
                const nameEl = document.getElementById('topbar-name');
                if (nameEl && info.name) nameEl.textContent = info.name;
            }
        } catch (e) {
            console.warn('[Drive] No se pudo obtener perfil de usuario:', e);
        }
    });

    EventBus.on('storage:critical', async () => {
        if (!isConnected() && isConfigured()) {
            showInfo('⚠️ Almacenamiento crítico. Conecta Google Drive para liberar espacio.');
        } else if (isConnected()) {
            // Auto-push si hay crisis de storage y Drive está conectado
            try { await pushToCloud('storage-critical'); } catch (e) { }
        }
    });

    // ── uploadBinaryFile — sube ArrayBuffer binario (PDF, etc.) ───
    // Expuesto en la API pública para que DocPdfIndexer lo use sin
    // acceder directamente a _accessToken (que es privado del closure).
    // @param {ArrayBuffer} arrayBuffer — contenido binario del archivo
    // @param {string}      filename    — nombre a usar en Drive
    // @param {string}      mimeType    — MIME type (ej: 'application/pdf')
    // @returns {Promise<{id, name, webViewLink}>}
    async function uploadBinaryFile(arrayBuffer, filename, mimeType = 'application/pdf') {
        if (!isConnected()) throw new Error('No conectado a Drive. Conecta primero en Configurar IA & Drive.');

        const folderId = await _getOrCreateFolder();

        // Construir cuerpo multipart con datos binarios reales
        const boundary = '-------AppBogadoPDFBoundary' + Date.now();
        const metadata = JSON.stringify({ name: filename, parents: [folderId] });

        const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
        const dataPart = `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
        const endPart = `\r\n--${boundary}--`;

        const enc = new TextEncoder();
        const metaB = enc.encode(metaPart);
        const dataB = enc.encode(dataPart);
        const endB = enc.encode(endPart);
        const pdfB = new Uint8Array(arrayBuffer);

        const body = new Uint8Array(metaB.length + dataB.length + pdfB.length + endB.length);
        let off = 0;
        body.set(metaB, off); off += metaB.length;
        body.set(dataB, off); off += dataB.length;
        body.set(pdfB, off); off += pdfB.length;
        body.set(endB, off);

        // Usar _driveRequest con endpoint de upload multipart
        const uploadUrl = `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`;
        const resp = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${_accessToken}`,
                'Content-Type': `multipart/related; boundary="${boundary}"`,
            },
            body: body.buffer
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(`Drive upload error ${resp.status}: ${err?.error?.message || resp.statusText}`);
        }

        return resp.json();  // { id, name, webViewLink }
    }

    // ── downloadBinaryFile — descarga un archivo como ArrayBuffer ──
    // Usado por re-análisis de PDFs ya subidos a Drive.
    async function downloadBinaryFile(fileId) {
        if (!isConnected()) throw new Error('No conectado a Drive.');
        const resp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            { headers: { 'Authorization': `Bearer ${_accessToken}` } }
        );
        if (!resp.ok) throw new Error(`Drive download error ${resp.status}: ${resp.statusText}`);
        return resp.arrayBuffer();
    }

    return {
        connect, disconnect, isConnected, isConfigured, getClientId, saveClientId,
        pushToCloud, pullFromCloud, confirmPull,
        syncVersion, listVersions,
        startAutoSync, stopAutoSync,
        renderConfigPanel,
        _driveRenderStatus,
        uploadBinaryFile,
        downloadBinaryFile,
    };
})();

window.GoogleDrive = GoogleDrive;

// Alias de función para botones en HTML
function driveConnect() { GoogleDrive.connect(); }
function driveConfirmPull() { GoogleDrive.confirmPull(); }
function drivePush() { GoogleDrive.pushToCloud('manual').then(() => showSuccess('✅ Sincronizado con Drive.')).catch(e => showError(e.message)); }

console.info('[AppBogado v13] GoogleDrive F13 ✓');
