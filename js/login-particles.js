(function () {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Configurar color base de las partículas según el tema
    // El tema es 'dark' por defecto o cuando data-theme="dark"
    const getParticleColor = () => {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (theme === 'light') {
            return { r: 15, g: 52, b: 96 }; // #0f3460 (Azul marino del Lexium)
        }
        return { r: 6, g: 182, b: 212 }; // #06b6d4 (Cyan del Lexium)
    };

    let W = canvas.width = canvas.offsetWidth;
    let H = canvas.height = canvas.offsetHeight;

    // Reaccionar a cambios de tema
    let pColor = getParticleColor();
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                pColor = getParticleColor();
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true });

    let particles = [];

    function initParticles() {
        // Reducir cantidad en pantallas pequeñas para optimizar
        const particleCount = W < 768 ? 40 : 80;
        particles = Array.from({ length: particleCount }, () => ({
            x: Math.random() * W, y: Math.random() * H,
            r: Math.random() * 2 + 0.5,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4,
            alpha: Math.random() * 0.5 + 0.2
        }));
    }

    initParticles();

    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Actualizar y dibujar partículas
        particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${pColor.r},${pColor.g},${pColor.b},${p.alpha})`;
            ctx.fill();

            p.x += p.dx;
            p.y += p.dy;

            if (p.x < 0 || p.x > W) p.dx *= -1;
            if (p.y < 0 || p.y > H) p.dy *= -1;
        });

        // Dibujar líneas de conexión
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distSq = dx * dx + dy * dy;

                // 10000 = 100^2 (optimización para no usar Math.hypot)
                if (distSq < 10000) {
                    const dist = Math.sqrt(distSq);
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(${pColor.r},${pColor.g},${pColor.b},${0.15 * (1 - dist / 100)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
        W = canvas.width = canvas.offsetWidth;
        H = canvas.height = canvas.offsetHeight;
        // Reinicializar partículas si el tamaño cambia drásticamente
        if (particles.length > 0 &&
            (W < 768 && particles.length > 40) ||
            (W >= 768 && particles.length < 80)) {
            initParticles();
        }
    });

    // Iniciar loop de animación
    requestAnimationFrame(draw);
})();
