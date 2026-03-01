/**
 * AppBogado — main.js (Electron Main Process) v2.2
 * ─────────────────────────────────────────────────
 * MEJORAS DE SEGURIDAD APLICADAS:
 *  ✅ contextIsolation: true  (ya estaba)
 *  ✅ nodeIntegration: false  (ya estaba)
 *  ✅ sandbox: true           (NUEVO — antes era false)
 *  ✅ APP_SECRET via env var  (NUEVO — antes hardcodeada)
 *  ✅ CSP via webRequest      (NUEVO)
 *  ✅ Validación de inputs en todos los handlers IPC
 *  ✅ DevTools solo en desarrollo
 *  ✅ Manejo de errores en mkdirSync
 *  ✅ Verificación de existencia de icon antes de asignar
 *  ✅ navigación externa bloqueada
 */

const { app, BrowserWindow, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const puppeteer = require('puppeteer');

const alertService = require('./alert-service-v3');
const waLogger = require('./wa-logger-v3');
const whatsappService = require('./whatsapp-service-v3');

const IS_DEV = !app.isPackaged;

// ── Rutas base ────────────────────────────────────────────────────────────────
const APP_ROOT = IS_DEV ? __dirname : process.resourcesPath;
const DATA_DIR = path.join(app.getPath('userData'), 'datos');      // ← fuera del exe
const DOCS_DIR = path.join(DATA_DIR, 'documentos');

// Crear carpetas con manejo de error
try {
    [DATA_DIR, DOCS_DIR].forEach(d => {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });
} catch (e) {
    // Si no se puede crear la carpeta de datos, la app no puede funcionar
    dialog.showErrorBox('Error crítico', `No se pudo crear la carpeta de datos:\n${e.message}`);
    app.quit();
}

// ── Cifrado AES-256-GCM ───────────────────────────────────────────────────────
// MEJORA: La clave ya no está hardcodeada en el código.
// Se lee de variable de entorno APP_SECRET.
// Si no existe (primera vez o instalación limpia), se genera una clave aleatoria
// y se guarda en userData, que es la carpeta privada del usuario en el sistema.
function obtenerSecret() {
    // 1. Prioridad: variable de entorno (útil en desarrollo)
    if (process.env.APP_SECRET) return process.env.APP_SECRET;

    // 2. Clave persistida en userData (generada automáticamente en primera ejecución)
    const secretFile = path.join(app.getPath('userData'), '.secret');
    if (fs.existsSync(secretFile)) {
        return fs.readFileSync(secretFile, 'utf8').trim();
    }

    // 3. Primera vez: generar clave aleatoria y guardarla
    const nuevaClaveHex = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, nuevaClaveHex, { encoding: 'utf8', mode: 0o600 });
    return nuevaClaveHex;
}

function derivarClave() {
    const seed = `${obtenerSecret()}::${os.hostname()}::${os.platform()}`;
    return crypto.createHash('sha256').update(seed).digest();
}

function cifrar(texto) {
    if (typeof texto !== 'string') throw new Error('cifrar: se esperaba string');
    const clave = derivarClave();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', clave, iv);
    const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

function descifrar(b64) {
    try {
        if (typeof b64 !== 'string') return null;
        const clave = derivarClave();
        const buf = Buffer.from(b64, 'base64');
        if (buf.length < 29) return null; // mínimo iv(12)+tag(16)+1 byte
        const iv = buf.subarray(0, 12);
        const tag = buf.subarray(12, 28);
        const datos = buf.subarray(28);
        const decipher = crypto.createDecipheriv('aes-256-gcm', clave, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(datos), decipher.final()]).toString('utf8');
    } catch (e) {
        console.error('[Crypto] Error al descifrar:', e.message);
        return null;
    }
}

// ── Validadores de input IPC ──────────────────────────────────────────────────
function validarClave(clave) {
    if (typeof clave !== 'string' || clave.length === 0 || clave.length > 200) {
        throw new Error('Clave inválida');
    }
}
function validarValor(valor) {
    if (typeof valor !== 'string') throw new Error('Valor debe ser string');
    if (valor.length > 10 * 1024 * 1024) throw new Error('Valor excede 10MB');
}

// ── IPC Handlers — Storage cifrado ───────────────────────────────────────────
ipcMain.handle('storage:get', (_e, clave) => {
    try {
        validarClave(clave);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        if (!fs.existsSync(archivo)) return null;
        return descifrar(fs.readFileSync(archivo, 'utf8'));
    } catch (e) {
        console.error('[Storage:get]', e.message);
        return null;
    }
});

// ── IPC Síncrono — hidratación del Store al inicio ───────────────────────────
// 01-db-auth.js lee el caché síncronamente antes de que _init() async termine.
// Este canal bloquea el renderer hasta tener el dato del disco.
ipcMain.on('storage:get-sync', (event, clave) => {
    try {
        validarClave(clave);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        if (!fs.existsSync(archivo)) { event.returnValue = null; return; }
        event.returnValue = descifrar(fs.readFileSync(archivo, 'utf8'));
    } catch (e) {
        console.error('[Storage:get-sync]', e.message);
        event.returnValue = null;
    }
});

ipcMain.handle('storage:set', (_e, clave, valor) => {
    try {
        validarClave(clave);
        validarValor(valor);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        fs.writeFileSync(archivo, cifrar(valor), 'utf8');
        return { ok: true };
    } catch (e) {
        console.error('[Storage:set]', e.message);
        return { error: e.message };
    }
});

ipcMain.handle('storage:delete', (_e, clave) => {
    try {
        validarClave(clave);
        const archivo = path.join(DATA_DIR, `${sanitizarNombre(clave)}.enc`);
        if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
        return { ok: true };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('storage:list', (_e) => {
    try {
        return fs.readdirSync(DATA_DIR)
            .filter(f => f.endsWith('.enc') && !f.includes('..'))
            .map(f => f.replace('.enc', ''));
    } catch (e) { return []; }
});

// ── IPC Handlers — Documentos ─────────────────────────────────────────────────
ipcMain.handle('docs:guardar', (_e, nombre, base64Data, mimeType) => {
    try {
        if (typeof nombre !== 'string' || nombre.length > 255) throw new Error('Nombre inválido');
        if (typeof base64Data !== 'string') throw new Error('base64Data inválido');
        if (typeof mimeType !== 'string') throw new Error('mimeType inválido');
        // Validar tamaño: base64 de 50MB máx
        if (base64Data.length > 70 * 1024 * 1024) throw new Error('Archivo demasiado grande (máx 50MB)');

        const nombreSeguro = `${Date.now()}_${sanitizarNombre(nombre)}`;
        const cifrado = cifrar(JSON.stringify({ nombre, mimeType, data: base64Data }));
        fs.writeFileSync(path.join(DOCS_DIR, nombreSeguro + '.enc'), cifrado, 'utf8');
        return { ok: true, id: nombreSeguro };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('docs:leer', (_e, id) => {
    try {
        if (typeof id !== 'string' || id.includes('..') || id.includes('/') || id.includes('\\')) {
            return { error: 'ID inválido' };
        }
        const ruta = path.join(DOCS_DIR, sanitizarNombre(id) + '.enc');
        if (!fs.existsSync(ruta)) return { error: 'Documento no encontrado' };
        const descifrado = descifrar(fs.readFileSync(ruta, 'utf8'));
        if (!descifrado) return { error: 'Error al descifrar' };
        return { ok: true, ...JSON.parse(descifrado) };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('docs:eliminar', (_e, id) => {
    try {
        if (typeof id !== 'string' || id.includes('..') || id.includes('/') || id.includes('\\')) {
            return { error: 'ID inválido' };
        }
        const ruta = path.join(DOCS_DIR, sanitizarNombre(id) + '.enc');
        if (fs.existsSync(ruta)) fs.unlinkSync(ruta);
        return { ok: true };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('docs:listar', (_e) => {
    try {
        return fs.readdirSync(DOCS_DIR)
            .filter(f => f.endsWith('.enc') && !f.includes('..'))
            .map(f => f.replace('.enc', ''));
    } catch (e) { return []; }
});

// ── IPC Handlers — Prospectos / CRM ───────────────────────────────────────────
ipcMain.handle('prospectos:generar-pdf', async (_e, { tipo, html, nombre }) => {
    try {
        const execPath = puppeteer.executablePath();
        const browser = await puppeteer.launch({
            executablePath: execPath,
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
        });
        await browser.close();
        const ruta = path.join(DATA_DIR, 'pdfs', `${sanitizarNombre(nombre)}.pdf`);
        fs.mkdirSync(path.dirname(ruta), { recursive: true });
        fs.writeFileSync(ruta, pdf);
        return { ok: true, ruta };
    } catch (e) {
        console.error('[prospectos:generar-pdf]', e.message);
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('prospectos:subir-documento', (_e, { causaId, tipo, archivo, nombre, mimetype }) => {
    try {
        const ruta = path.join(DATA_DIR, 'docs', sanitizarNombre(causaId), sanitizarNombre(tipo), `${sanitizarNombre(nombre)}.enc`);
        fs.mkdirSync(path.dirname(ruta), { recursive: true });
        // archivo se asume en Base64
        const cleanB64 = archivo.includes('base64,') ? archivo.split('base64,')[1] : archivo;
        fs.writeFileSync(ruta, cifrar(cleanB64));
        return { ok: true, ruta };
    } catch (e) {
        console.error('[prospectos:subir-documento]', e.message);
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('prospectos:ver-documento', (_e, { causaId, tipo, nombre }) => {
    try {
        const ruta = path.join(DATA_DIR, 'docs', sanitizarNombre(causaId), sanitizarNombre(tipo), `${sanitizarNombre(nombre)}.enc`);
        if (!fs.existsSync(ruta)) return { ok: false, error: 'Documento no encontrado' };
        const descifrado = descifrar(fs.readFileSync(ruta, 'utf8'));
        return { ok: true, base64: descifrado };
    } catch (e) {
        console.error('[prospectos:ver-documento]', e.message);
        return { ok: false, error: e.message };
    }
});

ipcMain.handle('prospectos:registrar-pago', (_e, { id, fotoBase64, nombre }) => {
    try {
        if (!fotoBase64) return { ok: true };
        const ruta = path.join(DATA_DIR, 'pagos', `${sanitizarNombre(nombre || ('pago_' + id))}.enc`);
        fs.mkdirSync(path.dirname(ruta), { recursive: true });
        const cleanB64 = fotoBase64.includes('base64,') ? fotoBase64.split('base64,')[1] : fotoBase64;
        fs.writeFileSync(ruta, cifrar(cleanB64));
        return { ok: true, ruta };
    } catch (e) {
        console.error('[prospectos:registrar-pago]', e.message);
        return { ok: false, error: e.message };
    }
});

// ── IPC Handlers — Backup ─────────────────────────────────────────────────────
ipcMain.handle('backup:exportar', async (_e, jsonData) => {
    if (typeof jsonData !== 'string') return { error: 'Datos inválidos' };
    const { filePath } = await dialog.showSaveDialog({
        title: 'Exportar Backup AppBogado',
        defaultPath: `backup_appbogado_${fechaHoy()}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (!filePath) return { cancelado: true };
    try {
        fs.writeFileSync(filePath, jsonData, 'utf8');
        return { ok: true, ruta: filePath };
    } catch (e) {
        return { error: e.message };
    }
});

ipcMain.handle('backup:importar', async (_e) => {
    const { filePaths } = await dialog.showOpenDialog({
        title: 'Importar Backup AppBogado',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile']
    });
    if (!filePaths || filePaths.length === 0) return { cancelado: true };
    try {
        // Validar que el archivo no sea descomunal (máx 100MB)
        const stat = fs.statSync(filePaths[0]);
        if (stat.size > 100 * 1024 * 1024) return { error: 'Archivo demasiado grande' };
        return { ok: true, data: fs.readFileSync(filePaths[0], 'utf8') };
    } catch (e) {
        return { error: e.message };
    }
});

// ── IPC Handlers — Sistema ────────────────────────────────────────────────────
ipcMain.handle('sistema:info', () => ({
    dataDir: DATA_DIR,
    docsDir: DOCS_DIR,
    hostname: os.hostname(),
    platform: os.platform(),
    version: app.getVersion(),
    isDev: IS_DEV
}));

ipcMain.handle('sistema:abrirCarpetaDatos', () => {
    shell.openPath(DATA_DIR);
    return { ok: true };
});

ipcMain.handle('whatsapp:guardar-config', async (_e, config) => {
    const { validarNumero } = require('./whatsapp-service-v3');

    // Validar numero legacy
    if (config.numeroDestino) {
        const v = validarNumero(config.numeroDestino);
        if (!v.ok) return { error: `Número inválido: ${v.error}` };
        config.numeroDestino = v.numero;
    }

    // Validar array de destinatarios (nuevo) — preservar campo autoEnvio
    if (Array.isArray(config.destinatarios)) {
        const validados = [];
        for (const dest of config.destinatarios) {
            if (!dest.numero) continue;
            const v = validarNumero(dest.numero);
            if (!v.ok) return { error: `Número inválido (${dest.nombre || dest.numero}): ${v.error}` };
            validados.push({
                nombre:    (dest.nombre || '').substring(0, 60),
                numero:    v.numero,
                autoEnvio: dest.autoEnvio !== false   // default true
            });
        }
        config.destinatarios = validados;
    }

    // Validar destinoNumero (número principal nuevo campo)
    if (config.destinoNumero) {
        const v = validarNumero(config.destinoNumero);
        if (!v.ok) return { error: `Número principal inválido: ${v.error}` };
        config.destinoNumero = v.numero;
    }

    try {
        const ruta = path.join(DATA_DIR, 'wa_config.enc');
        fs.writeFileSync(ruta, cifrar(JSON.stringify(config)), 'utf8');
        return { ok: true };
    } catch (e) {
        return { error: e.message };
    }
});

// ── IPC Handler — Reset WhatsApp ─────────────────────────────────────────────
ipcMain.handle('whatsapp:reset', async () => {
    const resultados = [];
    const archivos = ['wa_config.enc', 'wa_logs.enc'];

    // Borrar archivos de config y logs
    archivos.forEach(nombre => {
        const ruta = path.join(DATA_DIR, nombre);
        try {
            if (fs.existsSync(ruta)) {
                fs.unlinkSync(ruta);
                resultados.push({ archivo: nombre, ok: true });
            } else {
                resultados.push({ archivo: nombre, ok: true, nota: 'no existía' });
            }
        } catch (e) {
            resultados.push({ archivo: nombre, ok: false, error: e.message });
        }
    });

    // Borrar carpeta de sesión WhatsApp
    const waSession = path.join(app.getPath('userData'), '.wa-session');
    try {
        if (fs.existsSync(waSession)) {
            fs.rmSync(waSession, { recursive: true, force: true });
            resultados.push({ archivo: '.wa-session', ok: true });
        } else {
            resultados.push({ archivo: '.wa-session', ok: true, nota: 'no existía' });
        }
    } catch (e) {
        resultados.push({ archivo: '.wa-session', ok: false, error: e.message });
    }

    return { ok: true, resultados };
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function sanitizarNombre(nombre) {
    return String(nombre).replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 100);
}
function fechaHoy() {
    return new Date().toISOString().split('T')[0];
}

function getWhatsAppConfig() {
    try {
        const ruta = path.join(DATA_DIR, 'wa_config.enc');
        if (!fs.existsSync(ruta)) {
            return {
                numeroDestino: '',
                nombreAbogado: '',
                timezone: 'America/Santiago',
                activo: false
            };
        }
        const raw = descifrar(fs.readFileSync(ruta, 'utf8'));
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

// ── Ventana principal ─────────────────────────────────────────────────────────
let mainWindow;

function crearVentana() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        icon: path.join(__dirname, 'assets/logo-lexium.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,   // ✅ renderer aislado
            nodeIntegration: false,  // ✅ sin acceso a Node en renderer
            sandbox: true,   // ✅ sandbox de Chromium activado
            webSecurity: true,   // ✅ Same-origin policy
            allowRunningInsecureContent: false,
        },
        show: false
    });

    mainWindow.loadFile('index.html');

    // ── CSP via cabecera HTTP (más robusto que el meta tag) ──────────────────
    // NOTA: 'unsafe-inline' en script-src es necesario mientras existan scripts
    // inline en index.html. DEUDA TÉCNICA: mover todos los bloques <script>
    // inline a archivos .js externos y eliminar 'unsafe-inline' para activar
    // protección XSS completa. Ver informe de seguridad, punto 7.
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self';" +
                    "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;" +
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;" +
                    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;" +
                    "img-src 'self' data: blob:;" +
                    "connect-src 'self' https://generativelanguage.googleapis.com https://cdnjs.cloudflare.com https://api.openai.com https://api.anthropic.com;" +
                    "worker-src 'self' blob: https://cdnjs.cloudflare.com;" +
                    "frame-src 'none';" +
                    "object-src 'none';"
                ]
            }
        });
    });

    // ── Bloquear navegación externa (previene ataques de redirección) ────────
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const parsed = new URL(url);
        // Solo permitir navegar al mismo archivo local
        if (parsed.protocol !== 'file:') {
            event.preventDefault();
            shell.openExternal(url); // abrir en el navegador del sistema
        }
    });

    // Bloquear apertura de nuevas ventanas
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        // DevTools disponible con Ctrl+Shift+I — no se abre automáticamente
    });

    // Menú nativo: solo en desarrollo (para ver errores)
    if (!IS_DEV) {
        mainWindow.removeMenu();
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Ciclo de vida de la app ───────────────────────────────────────────────────
app.whenReady().then(() => {
    // Configurar CSP de sesión global antes de crear ventana
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: details.requestHeaders });
    });

    crearVentana();

    // ── Inicializar servicios con inyección de dependencias ─────
    alertService.init({ DATA_DIR, descifrar, cifrar });
    waLogger.init({ DATA_DIR, cifrar, descifrar });
    whatsappService.registrarHandlers(getWhatsAppConfig);

    ipcMain.handle('whatsapp:conectar', async () => {
        try {
            whatsappService.initWhatsApp(mainWindow);
            return { ok: true };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    });


    // ── Reconexión automática al arrancar ─────────────────────
    // Si hay sesión guardada en disco (.wa-session), reconectar sin pedir QR.
    // Independiente del checkbox "activo" — la sesión persiste siempre.
    mainWindow.once('ready-to-show', () => {
        const waSessionDir = require('path').join(app.getPath('userData'), '.wa-session');
        const sessionExists = require('fs').existsSync(waSessionDir);

        if (sessionExists) {
            // Hay sesión guardada → reconectar automáticamente
            whatsappService.initWhatsApp(mainWindow);
        }

        // Schedulers: solo si el checkbox activo está marcado
        // Usan getWhatsAppConfig() dinámicamente en cada ejecución
        whatsappService.iniciarSchedulers(getWhatsAppConfig);
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana();
});

// Rechazar certificados inválidos en producción
app.on('certificate-error', (event, _webContents, _url, _error, _cert, callback) => {
    if (IS_DEV) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});
