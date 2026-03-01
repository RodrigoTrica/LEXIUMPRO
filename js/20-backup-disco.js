/**
 * BackupDisco — Fachada para exportar backup a disco.
 * - En Electron: usa electronAPI.backup.exportar → diálogo "Guardar como" y guarda .json.
 * - En navegador: descarga el archivo vía <a download> (modo compatibilidad).
 * Referencias: index.html (hacerAhora), 01-db-auth.js (iniciar), 21-doc-fisico.js (_setRootHandle).
 */
(function () {
    'use strict';

    function _getSnapshot() {
        if (typeof Store !== 'undefined' && typeof Store.snapshot === 'function') {
            return Store.snapshot();
        }
        if (typeof DB !== 'undefined' && DB !== null) {
            return JSON.parse(JSON.stringify(DB));
        }
        return null;
    }

    function _buildBackupPayload() {
        const datos = _getSnapshot();
        if (!datos) return null;
        const backup = {
            version: '3.9.5',
            fechaExportacion: new Date().toISOString(),
            motivo: 'manual',
            checksum: Date.now().toString(36),
            datos: datos
        };
        if (typeof AppConfig !== 'undefined' && typeof AppConfig.exportar === 'function') {
            backup._appConfig = AppConfig.exportar();
        }
        return backup;
    }

    function _notificar(mensaje, esError) {
        if (typeof showSuccess === 'function' && !esError) {
            showSuccess(mensaje);
            return;
        }
        if (typeof showError === 'function' && esError) {
            showError(mensaje);
            return;
        }
        if (typeof showInfo === 'function' && !esError) {
            showInfo(mensaje);
            return;
        }
        alert(mensaje);
    }

    /**
     * Exporta backup usando Electron (diálogo Guardar) o descarga en navegador.
     * @param {string} tipo - Ej. 'manual' (solo informativo en el payload).
     */
    async function hacerAhora(tipo) {
        const payload = _buildBackupPayload();
        if (!payload) {
            _notificar('No hay datos de base de datos disponibles para exportar.', true);
            return;
        }
        const jsonString = JSON.stringify(payload, null, 2);
        const nombreSugerido = `backup_lexium_${new Date().toISOString().split('T')[0]}.json`;

        if (window.electronAPI && typeof window.electronAPI.backup !== 'undefined' && typeof window.electronAPI.backup.exportar === 'function') {
            try {
                const result = await window.electronAPI.backup.exportar(jsonString);
                if (result && result.cancelado) {
                    _notificar('Exportación cancelada.');
                    return;
                }
                if (result && result.error) {
                    _notificar('Error al guardar backup: ' + result.error, true);
                    return;
                }
                if (result && result.ok && result.ruta) {
                    if (typeof registrarEvento === 'function') {
                        registrarEvento('Backup manual exportado a disco: ' + result.ruta);
                    }
                    _notificar('Backup guardado correctamente en:\n' + result.ruta);
                    return;
                }
            } catch (e) {
                _notificar('Error al exportar backup: ' + (e.message || e), true);
                return;
            }
        }

        // Modo compatibilidad: descarga vía enlace en el navegador
        try {
            const blob = new Blob([jsonString], { type: 'application/json; charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombreSugerido;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            if (typeof registrarEvento === 'function') {
                registrarEvento('Backup manual descargado: ' + nombreSugerido);
            }
            _notificar('Backup descargado correctamente: ' + nombreSugerido);
        } catch (e) {
            _notificar('Error al descargar backup: ' + (e.message || e), true);
        }
    }

    function iniciar() {
        // Opcional: lógica de inicio (p. ej. sincronizar con carpeta si se usa _setRootHandle)
    }

    function _setRootHandle(/* handle */) {
        // Reservado para integración con DocFisico: usar la misma carpeta raíz para backups.
    }

    const BackupDisco = {
        hacerAhora: hacerAhora,
        iniciar: iniciar,
        _setRootHandle: _setRootHandle
    };

    window.BackupDisco = BackupDisco;
    console.info('[BackupDisco] Módulo cargado — exportar backup a disco o descarga.');
})();
