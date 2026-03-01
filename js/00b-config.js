        // ████████████████████████████████████████████████████████████████████
        // JS — MÓDULO 00b: CONFIGURACIÓN CENTRAL (AppConfig)
        // Una sola clave en localStorage: APPBOGADO_CONFIG_V1
        // Reemplaza las 13 claves dispersas con un objeto unificado.
        //
        // Claves que centraliza:
        //   usuarios, biblioteca, tramites, ia_provider, ia_keys, ia_models,
        //   ia_salt, drive_config, drive_sync_meta, backup_carpeta,
        //   backup_ultimo, docfisico_raiz, backup_history
        //
        // Las claves de DATOS (causas, clientes, etc.) permanecen en
        // APPBOGADO_DATA_V395 ya que son gestionadas por Store.
        //
        // Uso:
        //   AppConfig.get('usuarios')        → array de usuarios
        //   AppConfig.set('usuarios', lista) → guarda y persiste
        //   AppConfig.getAll()               → objeto completo
        // ████████████████████████████████████████████████████████████████████

        const AppConfig = (() => {
            const CONFIG_KEY = 'APPBOGADO_CONFIG_V1';

            // Claves legadas a migrar en el primer arranque
            const LEGACY_KEYS = {
                usuarios:        'APPBOGADO_USERS_V2',
                biblioteca:      'APPBOGADO_BIBLIOTECA_V1',
                tramites:        'APPBOGADO_TRAMITES_V1',
                ia_provider:     'APPBOGADO_IA_PROVIDER',
                ia_keys:         'APPBOGADO_IA_KEYS',
                ia_models:       'APPBOGADO_IA_MODELS',
                ia_salt:         'APPBOGADO_IA_SALT',
                drive_config:    'APPBOGADO_DRIVE_CONFIG_V1',
                drive_sync_meta: 'APPBOGADO_DRIVE_SYNC_META',
                backup_carpeta:  'APPBOGADO_BACKUP_DIR_HANDLE',
                backup_ultimo:   'APPBOGADO_LAST_BACKUP_DISCO',
                docfisico_raiz:  'APPBOGADO_ROOT_DIR_HANDLE_NAME',
                tema:            'APPBOGADO_THEME',
                gemini_key_old:  'APPBOGADO_GEMINI_KEY',
                gemini_model_old:'APPBOGADO_GEMINI_MODEL',
            };

            // Valores por defecto de cada sección
            const DEFAULTS = {
                usuarios:        [],
                biblioteca:      [],
                tramites:        [],
                ia_provider:     'gemini',
                ia_keys:         {},
                ia_models:       {},
                ia_salt:         null,
                drive_config:    {},
                drive_sync_meta: {},
                backup_carpeta:  null,
                backup_ultimo:   null,
                docfisico_raiz:  null,
                backup_history:  [],
                tema:            'light',
                _version:        1,
                _migrado:        false,
            };

            let _cache = null; // cache en memoria

            // ── Leer desde DiskStorage (Electron) o localStorage (navegador) ──
            function _leer() {
                try {
                    const _store = (window.DiskStorage && window.DiskStorage.isElectron) ? window.DiskStorage : localStorage;
                    const raw = _store.getItem(CONFIG_KEY);
                    return raw ? JSON.parse(raw) : null;
                } catch (e) {
                    console.error('[AppConfig] Error leyendo config:', e);
                    return null;
                }
            }

            // ── Escribir a DiskStorage (Electron) o localStorage (navegador) ──
            function _escribir(data) {
                try {
                    const _store = (window.DiskStorage && window.DiskStorage.isElectron) ? window.DiskStorage : localStorage;
                    _store.setItem(CONFIG_KEY, JSON.stringify(data));
                    return true;
                } catch (e) {
                    console.error('[AppConfig] Error guardando config:', e);
                    return false;
                }
            }

            // ── Migrar claves legadas al objeto unificado ────────────────
            function _migrar(config) {
                if (config._migrado) return config; // ya migrado

                let migradas = 0;
                for (const [campo, claveLegada] of Object.entries(LEGACY_KEYS)) {
                    try {
                        const val = localStorage.getItem(claveLegada);
                        if (val === null) continue;

                        // Solo migrar si el campo aún está vacío/por defecto
                        const defaultVal = JSON.stringify(DEFAULTS[campo] ?? null);
                        const currentVal = JSON.stringify(config[campo] ?? DEFAULTS[campo] ?? null);
                        if (currentVal !== defaultVal) continue; // ya tiene valor, no sobreescribir

                        // Intentar parsear como JSON, si falla guardar como string
                        try {
                            config[campo] = JSON.parse(val);
                        } catch {
                            config[campo] = val;
                        }
                        migradas++;
                        console.info(`[AppConfig] Migrado: ${claveLegada} → config.${campo}`);
                    } catch (e) {
                        console.warn(`[AppConfig] Error migrando ${claveLegada}:`, e);
                    }
                }

                config._migrado = true;
                if (migradas > 0) {
                    console.info(`[AppConfig] Migración completada: ${migradas} clave(s) unificadas.`);
                }
                return config;
            }

            // ── Inicializar: leer, migrar si necesario, cachear ──────────
            function _init() {
                if (_cache) return _cache;

                let config = _leer();

                if (!config) {
                    // Primera vez: crear config con defaults
                    config = { ...DEFAULTS };
                    console.info('[AppConfig] Primera ejecución: config creada con valores por defecto.');
                } else {
                    // Asegurar que todos los campos existen (versiones anteriores)
                    for (const [k, v] of Object.entries(DEFAULTS)) {
                        if (config[k] === undefined) config[k] = v;
                    }
                }

                // Migrar claves legadas si no se ha hecho
                config = _migrar(config);

                // Garantizar que siempre existe al menos un admin
                if (!Array.isArray(config.usuarios) || config.usuarios.length === 0) {
                    config.usuarios = []; // se creará el admin en Users.inicializar()
                }

                _escribir(config);
                _cache = config;
                return _cache;
            }

            // ════════════════════════════════════════════════════════════
            // API PÚBLICA
            // ════════════════════════════════════════════════════════════
            return {

                // Inicializar (llamar PRIMERO antes que cualquier módulo)
                init() {
                    _init();
                    console.info('[AppConfig] Listo. Claves activas:', Object.keys(_cache).join(', '));
                },

                // Obtener un valor de configuración
                get(campo) {
                    const cfg = _init();
                    return cfg[campo] ?? DEFAULTS[campo] ?? null;
                },

                // Guardar un valor de configuración (persiste inmediatamente)
                set(campo, valor) {
                    const cfg = _init();
                    cfg[campo] = valor;
                    _escribir(cfg);
                    return true;
                },

                // Obtener todo el objeto de configuración
                getAll() {
                    return { ..._init() };
                },

                // Exportar config completa (para incluir en backups)
                exportar() {
                    const cfg = { ..._init() };
                    // No exportar datos de sesión transitoria
                    delete cfg.backup_ultimo; // se actualiza sola
                    return cfg;
                },

                // Restaurar config desde backup
                restaurar(configImportada) {
                    if (!configImportada || typeof configImportada !== 'object') return false;
                    const cfg = _init();
                    // Restaurar solo campos conocidos, no sobreescribir _version/_migrado
                    const camposRestaurables = ['usuarios','biblioteca','tramites','ia_provider',
                        'ia_keys','ia_models','ia_salt','drive_config','drive_sync_meta'];
                    for (const campo of camposRestaurables) {
                        if (configImportada[campo] !== undefined) {
                            cfg[campo] = configImportada[campo];
                        }
                    }
                    cfg._migrado = true;
                    _escribir(cfg);
                    _cache = cfg;
                    console.info('[AppConfig] Configuración restaurada desde backup.');
                    return true;
                },

                // Forzar recarga desde localStorage (si algo escribió directamente)
                recargar() {
                    _cache = null;
                    return _init();
                },

                // Limpiar cache en memoria (no borra localStorage)
                limpiarCache() {
                    _cache = null;
                },

                // Debug: mostrar estado actual en consola
                debug() {
                    const cfg = _init();
                    console.group('[AppConfig] Estado actual');
                    console.table(Object.entries(cfg).map(([k,v]) => ({
                        campo: k,
                        tipo: Array.isArray(v) ? `array[${v.length}]` : typeof v,
                        valor: typeof v === 'string' ? v.substring(0,50) : Array.isArray(v) ? `[${v.length} items]` : JSON.stringify(v)?.substring(0,50)
                    })));
                    console.groupEnd();
                }
            };
        })();

        // Inicializar inmediatamente — debe ser lo primero antes de cualquier módulo
        AppConfig.init();
