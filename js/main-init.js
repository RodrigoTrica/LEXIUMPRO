(function () {
    'use strict';

    // Respetar prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.getElementById('login-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // â”€â”€ Paleta restringida: solo blancos/azules con opacidad baja â”€â”€
    const C = {
        node: 'rgba(255,255,255,0.09)',
        nodeDot: 'rgba(6,182,212,0.22)',
        edge: 'rgba(6,182,212,0.07)',
        particle: 'rgba(255,255,255,0.13)',
        scale: 'rgba(6,182,212,0.13)',
        scaleFill: 'rgba(6,182,212,0.05)',
    };

    // â”€â”€ Estado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let scaleAngle = 0;
    let scaleDir = 1;
    const SCALE_SPEED = 0.004;
    const SCALE_MAX = 0.09; // ~5 grados
    let W, H, raf, nodes, particles;
    const NODE_COUNT = 28;
    const PARTICLE_COUNT = 40;
    const CONNECT_DIST = 140;   // px: máxima distancia para trazar arista
    const NODE_SPEED = 0.12;  // muy lento
    const PART_SPEED = 0.18;

    // â”€â”€ Inicializar / redimensionar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        W = canvas.width = rect.width || canvas.offsetWidth;
        H = canvas.height = rect.height || canvas.offsetHeight;
        init();
    }

    function init() {
        nodes = Array.from({ length: NODE_COUNT }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * NODE_SPEED,
            vy: (Math.random() - 0.5) * NODE_SPEED,
            r: 1.2 + Math.random() * 1.4,
        }));
        particles = Array.from({ length: PARTICLE_COUNT }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            vx: (Math.random() - 0.5) * PART_SPEED,
            vy: (Math.random() - 0.5) * PART_SPEED * 0.6 - 0.05,
            r: 0.8 + Math.random() * 1.2,
            alpha: 0.06 + Math.random() * 0.10,
        }));
    }

    // â”€â”€ Balanza jurídica wireframe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Dibujada como geometría pura: trazo fino, muy baja opacidad.
    function drawScale(cx, cy, size, angle) {
        const s = size;
        ctx.save();
        ctx.strokeStyle = C.scale;
        ctx.fillStyle = C.scaleFill;
        ctx.lineWidth = 0.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Pie (poste central)
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * 0.55);
        ctx.lineTo(cx, cy - s * 0.30);
        ctx.stroke();

        // Base
        ctx.beginPath();
        ctx.moveTo(cx - s * 0.25, cy + s * 0.55);
        ctx.lineTo(cx + s * 0.25, cy + s * 0.55);
        ctx.stroke();

        // Travesaño horizontal â€” animado con angle
        const armLen = s * 0.44;
        const armY = cy - s * 0.12;
        const ang = angle || 0;

        // Extremos del brazo rotado
        const lx = cx - armLen * Math.cos(ang);
        const ly = armY - armLen * Math.sin(ang);
        const rx = cx + armLen * Math.cos(ang);
        const ry = armY + armLen * Math.sin(ang);

        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.stroke();

        // Punto central (balancín)
        ctx.beginPath();
        ctx.arc(cx, armY, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = C.nodeDot;
        ctx.fill();

        // Cadenas + platillos
        const chainLen = s * 0.26;
        const platW = s * 0.22;
        const platH = s * 0.045;

        // Izquierdo â€” cuelga del extremo rotado izquierdo
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly + chainLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(lx, ly + chainLen, platW, platH, 0, 0, Math.PI * 2);
        ctx.fillStyle = C.scaleFill;
        ctx.fill();
        ctx.stroke();

        // Derecho â€” cuelga del extremo rotado derecho
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx, ry + chainLen);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(rx, ry + chainLen, platW, platH, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Rayo de luz bajo el travesaño
        const grad = ctx.createLinearGradient(lx, ly, rx, ry);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, 'rgba(6,182,212,0.08)');
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(rx, ry);
        ctx.stroke();

        ctx.restore();
    }

    // â”€â”€ Tick principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function tick() {
        // Solo renderizar si login-screen es visible
        const screen = document.getElementById('login-screen');
        if (!screen || screen.style.display === 'none') {
            cancelAnimationFrame(raf);
            return;
        }

        ctx.clearRect(0, 0, W, H);

        // â€” Aristas del mesh â€”
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[i].x - nodes[j].x;
                const dy = nodes[i].y - nodes[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < CONNECT_DIST) {
                    const alpha = (1 - d / CONNECT_DIST) * 0.10;
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(6,182,212,${alpha.toFixed(3)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(nodes[i].x, nodes[i].y);
                    ctx.lineTo(nodes[j].x, nodes[j].y);
                    ctx.stroke();
                }
            }
        }

        // â€” Nodos â€”
        for (const n of nodes) {
            // Mover
            n.x += n.vx;
            n.y += n.vy;
            // Rebotar suavemente en los bordes
            if (n.x < 0 || n.x > W) n.vx *= -1;
            if (n.y < 0 || n.y > H) n.vy *= -1;
            n.x = Math.max(0, Math.min(W, n.x));
            n.y = Math.max(0, Math.min(H, n.y));

            // Punto exterior (halo)
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r + 2, 0, Math.PI * 2);
            ctx.fillStyle = C.node;
            ctx.fill();
            // Punto interior (núcleo)
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
            ctx.fillStyle = C.nodeDot;
            ctx.fill();
        }

        // â€” Partículas flotantes â€”
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            // Reciclar si salen del canvas
            if (p.x < -5) p.x = W + 5;
            if (p.x > W + 5) p.x = -5;
            if (p.y < -5) p.y = H + 5;
            if (p.y > H + 5) p.y = -5;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${p.alpha.toFixed(3)})`;
            ctx.fill();
        }

        // â€” Balanza wireframe (centrada en el panel, zona superior-media) â€”
        // Actualizar ángulo de oscilación de la balanza
        scaleAngle += SCALE_SPEED * scaleDir;
        if (Math.abs(scaleAngle) >= SCALE_MAX) scaleDir *= -1;

        // Balanza: más a la derecha, más grande â€” como en Lovable
        drawScale(W * 0.63, H * 0.44, Math.min(W, H) * 0.36, scaleAngle);

        raf = requestAnimationFrame(tick);
    }

    // â”€â”€ Arrancar cuando el DOM esté listo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    function start() {
        resize();
        // Observar cambios de tamaño del panel
        if (typeof ResizeObserver !== 'undefined') {
            new ResizeObserver(resize).observe(canvas.parentElement);
        } else {
            window.addEventListener('resize', resize);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
