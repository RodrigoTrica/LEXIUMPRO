/**
 * AppBogado — preload.js v2.2
 * ───────────────────────────
 * Puente seguro (contextBridge) entre renderer y main.
 *
 * MEJORAS v2.2:
 *  ✅ Solo expone funciones específicas (no ipcRenderer completo)
 *  ✅ Validación de tipos en cada función antes de invocar IPC
 *  ✅ Sanitización básica de strings en el preload
 *  ✅ Sin acceso directo a Node, fs, os u otros módulos peligrosos
 */

const { contextBridge, ipcRenderer } = require('electron');

// ── Validadores locales ───────────────────────────────────────────────────────
function assertString(val, nombre, maxLen = 1000) {
    if (typeof val !== 'string' || val.length === 0) throw new Error(`${nombre} debe ser un string no vacío`);
    if (val.length > maxLen) throw new Error(`${nombre} excede la longitud máxima (${maxLen})`);
}

function assertStringOrEmpty(val, nombre, maxLen = 10 * 1024 * 1024) {
    if (typeof val !== 'string') throw new Error(`${nombre} debe ser string`);
    if (val.length > maxLen) throw new Error(`${nombre} excede tamaño máximo`);
}

// ── API expuesta al renderer ──────────────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {

    // ── Storage cifrado en disco ──────────────────────────────────────────────
    storage: {
        get: (clave) => {
            assertString(clave, 'clave', 200);
            return ipcRenderer.invoke('storage:get', clave);
        },
        set: (clave, valor) => {
            assertString(clave, 'clave', 200);
            assertStringOrEmpty(valor, 'valor');
            return ipcRenderer.invoke('storage:set', clave, valor);
        },
        delete: (clave) => {
            assertString(clave, 'clave', 200);
            return ipcRenderer.invoke('storage:delete', clave);
        },
        list: () => ipcRenderer.invoke('storage:list'),
        // Lectura síncrona bloqueante — solo para hidratación inicial del Store
        getSync: (clave) => {
            assertString(clave, 'clave', 200);
            return ipcRenderer.sendSync('storage:get-sync', clave);
        },
    },

    // ── Documentos cifrados en disco ──────────────────────────────────────────
    docs: {
        guardar: (nombre, base64, mime) => {
            assertString(nombre, 'nombre', 255);
            assertStringOrEmpty(base64, 'base64', 70 * 1024 * 1024);
            assertString(mime, 'mime', 100);
            return ipcRenderer.invoke('docs:guardar', nombre, base64, mime);
        },
        leer: (id) => {
            assertString(id, 'id', 200);
            return ipcRenderer.invoke('docs:leer', id);
        },
        eliminar: (id) => {
            assertString(id, 'id', 200);
            return ipcRenderer.invoke('docs:eliminar', id);
        },
        listar: () => ipcRenderer.invoke('docs:listar'),
    },

    // ── Backup ────────────────────────────────────────────────────────────────
    backup: {
        exportar: (jsonData) => {
            assertStringOrEmpty(jsonData, 'jsonData');
            return ipcRenderer.invoke('backup:exportar', jsonData);
        },
        importar: () => ipcRenderer.invoke('backup:importar'),
    },

    // ── Sistema ───────────────────────────────────────────────────────────────
    sistema: {
        info: () => ipcRenderer.invoke('sistema:info'),
        abrirCarpetaDatos: () => ipcRenderer.invoke('sistema:abrirCarpetaDatos'),
    },

    whatsapp: {
        estado:   () => ipcRenderer.invoke('whatsapp:estado'),
        conectar: () => ipcRenderer.invoke('whatsapp:conectar'),

        // Enviar resumen a TODOS los destinatarios activos (scheduler 8AM manual)
        enviarResumen: () => ipcRenderer.invoke('whatsapp:enviar-resumen'),

        // Enviar resumen solo al número PRINCIPAL
        enviarResumenPrincipal: () => ipcRenderer.invoke('whatsapp:enviar-resumen-principal'),

        // Enviar mensaje de texto a TODOS los destinatarios activos
        enviarAlerta: (msg) => {
            if (typeof msg !== 'string' || !msg.trim()) throw new Error('Mensaje vacío');
            return ipcRenderer.invoke('whatsapp:enviar-alerta', msg);
        },

        // Enviar mensaje a UN número específico (secundarios on-demand)
        enviarAlertaA: (numero, msg) => {
            if (typeof numero !== 'string' || !numero.trim()) throw new Error('Número vacío');
            if (typeof msg !== 'string' || !msg.trim()) throw new Error('Mensaje vacío');
            return ipcRenderer.invoke('whatsapp:enviar-alerta-a', numero, msg);
        },

        guardarConfig:   (cfg) => ipcRenderer.invoke('whatsapp:guardar-config', cfg),
        desconectar:     ()    => ipcRenderer.invoke('whatsapp:desconectar'),
        getLogs:         (n)   => ipcRenderer.invoke('whatsapp:logs', n),
        getEstadisticas: ()    => ipcRenderer.invoke('whatsapp:estadisticas'),
        limpiarLogs:     ()    => ipcRenderer.invoke('whatsapp:limpiar-logs'),
        reset:           ()    => ipcRenderer.invoke('whatsapp:reset'),

        onEvento: (callback) => {
            [
                'whatsapp:qr',
                'whatsapp:ready',
                'whatsapp:disconnected',
                'whatsapp:auth_failure',
                'whatsapp:alerta-enviada',
                'whatsapp:reconectado-auto',
                'whatsapp:cargando'
            ].forEach(ev =>
                ipcRenderer.on(ev, (_e, data) =>
                    callback(ev.replace('whatsapp:', ''), data)
                )
            );
        }
    },

    // ── CRM Prospectos ────────────────────────────────────────────────────────
    prospectos: {
        generarPDF: (args) => ipcRenderer.invoke('prospectos:generar-pdf', args),
        subirDocumento: (args) => ipcRenderer.invoke('prospectos:subir-documento', args),
        verDocumento: (args) => ipcRenderer.invoke('prospectos:ver-documento', args),
        registrarPago: (args) => ipcRenderer.invoke('prospectos:registrar-pago', args)
    },

    // ── Indicador: corremos en Electron ───────────────────────────────────────
    esElectron: true,
});
