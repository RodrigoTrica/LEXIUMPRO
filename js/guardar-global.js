/**
 * AppBogado — js/guardar-global.js
 * Botón Guardar Global, atajo Ctrl+S, indicador modo almacenamiento y estado dirty.
 */

// ── Botón Guardar Global ──────────────────────────────────────────────────
async function guardarCambiosGlobal() {
    const btn = document.getElementById('btn-guardar-global');
    try {
        // Guardar datos en memoria → store
        if (typeof save === 'function') save();

        // Si estamos en Electron: flush inmediato al disco
        if (window.DiskStorage && window.DiskStorage.isElectron) {
            const res = await window.DiskStorage.flush();
            console.info(`[Guardar] Flush al disco: ${res.claves} claves guardadas.`);
        }

        // Quitar estado dirty y feedback visual
        if (btn) {
            btn.classList.remove('dirty');
            btn.setAttribute('title', 'Todos los cambios guardados ✓');
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> <span>¡Guardado!</span>';
            btn.style.background = '#16a34a';
            btn.disabled = true;
            setTimeout(() => {
                btn.innerHTML = original;
                btn.style.background = '';
                btn.disabled = false;
                btn.setAttribute('title', 'Guardar todos los cambios en el almacenamiento local (Ctrl+S)');
            }, 2000);
        }
    } catch(e) {
        console.error('[Guardar] Error:', e);
        if (btn) {
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>Error</span>';
            btn.style.background = '#dc2626';
            setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 2500);
        }
    }
}

// ── Atajo de teclado Ctrl+S / Cmd+S ──────────────────────────────────────
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        guardarCambiosGlobal();
    }
});

// ── Botón Guardar: tooltip, icono y modo almacenamiento ───────────────────
window.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-guardar-global');
    if (btn) {
        btn.setAttribute('title', 'Guardar todos los cambios en el almacenamiento local (Ctrl+S)');
        if (!btn.querySelector('i')) {
            btn.innerHTML = '<i class="fas fa-save"></i> <span>Guardar</span>';
        }
    }
    setTimeout(() => {
        const badge = document.getElementById('storage-text');
        if (badge && window.DiskStorage) {
            if (window.DiskStorage.isElectron) {
                badge.textContent = '🔒 Disco';
                badge.parentElement.title = 'Datos cifrados en disco (Electron)';
            } else {
                badge.textContent = '🌐 Local';
                badge.parentElement.title = 'Datos en localStorage del navegador';
            }
        }
    }, 500);
});
