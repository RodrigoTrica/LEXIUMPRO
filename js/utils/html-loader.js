/**
 * Carga fragmentos HTML (partials) y los inyecta en un contenedor.
 * Debe ejecutarse al inicio para que los modales estén en el DOM antes de init().
 */
(function () {
    'use strict';

    const MODALS_PARTIALS = [
        'views/partials/modal-nuevo-usuario.html',
        'views/partials/modal-plantilla.html',
        'views/partials/modal-plantilla-texto.html'
    ];

    /**
     * Carga un partial por fetch e inyecta su HTML en el contenedor.
     * @param {string} url
     * @param {HTMLElement} container
     * @returns {Promise<void>}
     */
    function loadPartial(url, container) {
        return fetch(url)
            .then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
                return res.text();
            })
            .then(function (html) {
                var wrap = document.createElement('div');
                wrap.innerHTML = html.trim();
                while (wrap.firstChild) {
                    container.appendChild(wrap.firstChild);
                }
            });
    }

    /**
     * Carga todos los modales parciales en #modals-container y dispara el evento modals-loaded.
     * @returns {Promise<void>}
     */
    window.loadModalsPartials = function () {
        var container = document.getElementById('modals-container');
        if (!container) {
            console.warn('[html-loader] #modals-container no encontrado');
            window.dispatchEvent(new CustomEvent('modals-loaded'));
            return Promise.resolve();
        }
        return Promise.all(MODALS_PARTIALS.map(function (url) { return loadPartial(url, container); }))
            .then(function () {
                window.dispatchEvent(new CustomEvent('modals-loaded'));
            })
            .catch(function (err) {
                console.error('[html-loader] Error cargando modales:', err);
                window.dispatchEvent(new CustomEvent('modals-loaded'));
            });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            window.loadModalsPartials();
        });
    } else {
        window.loadModalsPartials();
    }
})();
