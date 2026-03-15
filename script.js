class CountdownTimer {
    constructor() {
        this.targetDate = null;
        this.eventName = '';
        this.timerInterval = null;
        this.isCelebrating = false;
        this.particles = [];
        this.fireworks = [];
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.eventManager = null;
        this.originalTargetDate = null;
        this.originalEventName = '';
        this.isEventCountdownMode = false;
        
        this.mouse = {
            x: null,
            y: null,
            radius: 200,
            isAttracting: true,
            lastX: null,
            lastY: null
        };
        this.burstParticles = [];
        this.connectionDistance = 120;
        this.mouseConnectionDistance = 200;
        
        this.forceConfig = {
            baseForce: 2.5,
            maxForce: 6.0,
            falloffPower: 1.5,
            dampingFactor: 0.97,
            minSpeed: 0.1,
            maxSpeed: 8,
            returnForce: 0.002
        };
        
        this.perfConfig = {
            targetFPS: 120,
            maxParticles: 120,
            minParticles: 40,
            connectionDistanceSq: 120 * 120,
            mouseConnectionDistanceSq: 200 * 200,
            mouseRadiusSq: 200 * 200,
            adaptiveQuality: true,
            lastFrameTime: 0,
            frameCount: 0,
            fpsHistory: [],
            currentFPS: 60,
            qualityLevel: 1.0,
            skipFrames: 0
        };
        
        this.particlePool = [];
        this.burstPool = [];
        this.fireworkPool = [];
        this.offscreenCanvas = null;
        this.offscreenCtx = null;
        this.gradientCache = new Map();
        this.lastTime = 0;
        this.deltaTime = 0;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupPerformanceOptimizations();
        this.setupEventListeners();
        this.loadTheme();
        this.loadCustomSettings();
        this.loadThemeSettingsOnStart();
        this.startCountdown();
        this.updateTargetYear();
        this.updateCurrentYear();
        this.updateYearProgress();
        this.startParticleSystem();
        this.initEventManager();
        this.initShareManager();
        this.startFPSMonitor();
    }

    setupPerformanceOptimizations() {
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { 
            alpha: true,
            desynchronized: true,
            willReadFrequently: false
        });
        
        this.ctx.imageSmoothingEnabled = false;
        
        const perfConfig = this.perfConfig;
        perfConfig.connectionDistanceSq = this.connectionDistance * this.connectionDistance;
        perfConfig.mouseConnectionDistanceSq = this.mouseConnectionDistance * this.mouseConnectionDistance;
        perfConfig.mouseRadiusSq = this.mouse.radius * this.mouse.radius;
        
        this.initObjectPools();
        
        this.detectDevicePerformance();
    }

    initObjectPools() {
        this.burstPool = [];
        this.fireworkPool = [];
        
        const poolSize = 200;
        for (let i = 0; i < poolSize; i++) {
            this.burstPool.push(this.createBurstParticleTemplate());
        }
        
        for (let i = 0; i < 100; i++) {
            this.fireworkPool.push(this.createFireworkParticleTemplate());
        }
    }

    createBurstParticleTemplate() {
        return {
            x: 0, y: 0,
            speedX: 0, speedY: 0,
            size: 0,
            color: '#FFD700',
            opacity: 1,
            life: 0,
            maxLife: 80,
            gravity: 0.02,
            friction: 0.98,
            active: false
        };
    }

    createFireworkParticleTemplate() {
        return {
            x: 0, y: 0,
            speedX: 0, speedY: 0,
            size: 0,
            color: '#FFD700',
            opacity: 1,
            gravity: 0.05,
            life: 0,
            active: false
        };
    }

    getBurstParticleFromPool() {
        for (let i = 0; i < this.burstPool.length; i++) {
            if (!this.burstPool[i].active) {
                return this.burstPool[i];
            }
        }
        const newParticle = this.createBurstParticleTemplate();
        this.burstPool.push(newParticle);
        return newParticle;
    }

    getFireworkParticleFromPool() {
        for (let i = 0; i < this.fireworkPool.length; i++) {
            if (!this.fireworkPool[i].active) {
                return this.fireworkPool[i];
            }
        }
        const newParticle = this.createFireworkParticleTemplate();
        this.fireworkPool.push(newParticle);
        return newParticle;
    }

    detectDevicePerformance() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        let gpuTier = 1;
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                if (renderer.includes('NVIDIA') || renderer.includes('AMD') || renderer.includes('Radeon')) {
                    gpuTier = 3;
                } else if (renderer.includes('Intel')) {
                    gpuTier = 2;
                }
            }
        }
        
        const cores = navigator.hardwareConcurrency || 4;
        const memory = navigator.deviceMemory || 4;
        
        const score = (cores * 10) + (memory * 20) + (gpuTier * 30);
        
        if (score >= 100) {
            this.perfConfig.maxParticles = 150;
            this.perfConfig.qualityLevel = 1.0;
        } else if (score >= 60) {
            this.perfConfig.maxParticles = 100;
            this.perfConfig.qualityLevel = 0.8;
        } else {
            this.perfConfig.maxParticles = 60;
            this.perfConfig.qualityLevel = 0.6;
        }
        
        if (window.innerWidth < 768) {
            this.perfConfig.maxParticles = Math.min(this.perfConfig.maxParticles, 80);
        }
    }

    startFPSMonitor() {
        let lastTime = performance.now();
        let frameCount = 0;
        let fpsHistory = [];
        
        const updateFPS = (currentTime) => {
            frameCount++;
            const elapsed = currentTime - lastTime;
            
            if (elapsed >= 1000) {
                const fps = Math.round((frameCount * 1000) / elapsed);
                fpsHistory.push(fps);
                if (fpsHistory.length > 10) fpsHistory.shift();
                
                this.perfConfig.currentFPS = fps;
                this.perfConfig.fpsHistory = fpsHistory;
                
                this.adaptQuality(fps);
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
    }

    adaptQuality(currentFPS) {
        if (!this.perfConfig.adaptiveQuality) return;
        
        const avgFPS = this.perfConfig.fpsHistory.reduce((a, b) => a + b, 0) / this.perfConfig.fpsHistory.length;
        
        if (avgFPS < 55 && this.perfConfig.qualityLevel > 0.4) {
            this.perfConfig.qualityLevel -= 0.1;
            this.perfConfig.maxParticles = Math.max(
                this.perfConfig.minParticles,
                Math.floor(this.perfConfig.maxParticles * 0.9)
            );
            this.rebuildParticles();
        } else if (avgFPS > 100 && this.perfConfig.qualityLevel < 1.0) {
            this.perfConfig.qualityLevel += 0.05;
            this.perfConfig.maxParticles = Math.min(150, this.perfConfig.maxParticles + 5);
        }
    }

    rebuildParticles() {
        const currentCount = this.particles.length;
        const targetCount = this.perfConfig.maxParticles;
        
        if (currentCount > targetCount) {
            this.particles.length = targetCount;
        } else if (currentCount < targetCount) {
            for (let i = currentCount; i < targetCount; i++) {
                this.particles.push(this.createParticle());
            }
        }
    }

    loadThemeSettingsOnStart() {
        const savedFontSize = localStorage.getItem('fontSize');
        if (savedFontSize) {
            this.applyFontSize(parseInt(savedFontSize));
        }
    }

    initEventManager() {
        this.eventManager = new EventManager(this);
    }

    initShareManager() {
        this.shareManager = new ShareManager(this);
    }

    loadCustomSettings() {
        const savedDate = localStorage.getItem('countdownTargetDate');
        const savedEventName = localStorage.getItem('countdownEventName');
        
        if (savedDate) {
            this.targetDate = new Date(savedDate);
            this.eventName = savedEventName || '';
            
            if (this.targetDate <= new Date()) {
                this.targetDate = this.getNextNewYear();
                this.eventName = '';
                localStorage.removeItem('countdownTargetDate');
                localStorage.removeItem('countdownEventName');
            }
        } else {
            this.targetDate = this.getNextNewYear();
            this.eventName = '';
        }
    }

    setupCanvas() {
        this.canvas = document.getElementById('particleCanvas');
        this.ctx = this.canvas.getContext('2d', { 
            alpha: true,
            desynchronized: true,
            willReadFrequently: false
        });
        this.resizeCanvas();
        
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            if (this.offscreenCanvas) {
                this.offscreenCanvas.width = this.canvas.width;
                this.offscreenCanvas.height = this.canvas.height;
            }
        });
        
        this.setupMouseInteraction();
    }

    setupMouseInteraction() {
        this.canvas.addEventListener('mousemove', (e) => {
            this.mouse.lastX = this.mouse.x;
            this.mouse.lastY = this.mouse.y;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        this.canvas.addEventListener('click', (e) => {
            this.createBurstParticles(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.mouse.isAttracting = !this.mouse.isAttracting;
            console.log(`模式切换: ${this.mouse.isAttracting ? '吸引' : '排斥'}`);
        });
        
        document.addEventListener('mousemove', (e) => {
            this.mouse.lastX = this.mouse.x;
            this.mouse.lastY = this.mouse.y;
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && 
                e.target.tagName !== 'INPUT' && 
                e.target.tagName !== 'A' &&
                !e.target.closest('button') &&
                !e.target.closest('a') &&
                !e.target.closest('.settings-panel') &&
                !e.target.closest('.events-panel')) {
                this.createBurstParticles(e.clientX, e.clientY);
            }
        });
        
        document.addEventListener('contextmenu', (e) => {
            if (e.target.tagName !== 'INPUT' && 
                e.target.tagName !== 'TEXTAREA' &&
                !e.target.closest('button') &&
                !e.target.closest('a')) {
                e.preventDefault();
                this.mouse.isAttracting = !this.mouse.isAttracting;
                console.log(`模式切换: ${this.mouse.isAttracting ? '吸引' : '排斥'}`);
            }
        });
    }

    createBurstParticles(x, y) {
        const burstCount = Math.floor(30 * this.perfConfig.qualityLevel);
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF69B4'];
        
        for (let i = 0; i < burstCount; i++) {
            const angle = (Math.PI * 2 / burstCount) * i + Math.random() * 0.5;
            const speed = Math.random() * 4 + 2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            const particle = this.getBurstParticleFromPool();
            particle.x = x;
            particle.y = y;
            particle.speedX = Math.cos(angle) * speed;
            particle.speedY = Math.sin(angle) * speed;
            particle.size = Math.random() * 4 + 2;
            particle.color = color;
            particle.opacity = 1;
            particle.life = 80;
            particle.maxLife = 80;
            particle.gravity = 0.02;
            particle.friction = 0.98;
            particle.active = true;
            
            this.burstParticles.push(particle);
        }
    }

    resizeCanvas() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        this.ctx.scale(dpr, dpr);
        
        if (this.offscreenCanvas) {
            this.offscreenCanvas.width = this.canvas.width;
            this.offscreenCanvas.height = this.canvas.height;
            this.offscreenCtx.scale(dpr, dpr);
        }
    }

    getNextNewYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const nextYear = currentYear + 1;
        return new Date(`January 1, ${nextYear} 00:00:00`);
    }

    updateTargetYear() {
        const targetYear = this.targetDate.getFullYear();
        const month = this.targetDate.getMonth() + 1;
        const day = this.targetDate.getDate();
        const targetElement = document.getElementById('targetYear');
        const titleElement = document.getElementById('countdownTitle');
        const siteTitleElement = document.getElementById('siteTitle');
        
        if (this.eventName) {
            titleElement.textContent = `距离${this.eventName}还有`;
            targetElement.textContent = `${targetYear}年${month}月${day}日`;
            siteTitleElement.textContent = `🎊 ${this.eventName}倒计时`;
            document.title = `${this.eventName}倒计时`;
        } else {
            titleElement.textContent = '距离新年还有';
            targetElement.textContent = `${targetYear}年${month}月${day}日`;
            siteTitleElement.textContent = '🎊 跨年倒计时';
            document.title = '跨年倒计时 - 迎接新年';
        }
    }

    updateCurrentYear() {
        const currentYear = new Date().getFullYear();
        document.getElementById('currentYear').textContent = currentYear;
    }

    updateYearProgress() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
        const progress = ((now - startOfYear) / (endOfYear - startOfYear)) * 100;
        
        const progressBar = document.getElementById('yearProgress');
        const progressPercent = document.getElementById('progressPercent');
        const progressText = document.getElementById('progressText');
        
        if (progressBar && progressPercent) {
            progressBar.style.width = `${progress.toFixed(2)}%`;
            progressPercent.textContent = `${progress.toFixed(1)}%`;
            
            const daysPassed = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24));
            const totalDays = Math.floor((endOfYear - startOfYear) / (1000 * 60 * 60 * 24));
            progressText.textContent = `${daysPassed} / ${totalDays} 天`;
        }
    }

    startCountdown() {
        this.updateDisplay();
        this.timerInterval = setInterval(() => this.updateDisplay(), 1000);
    }

    updateDisplay() {
        const now = new Date();
        const difference = this.targetDate - now;

        if (difference <= 0) {
            this.handleCountdownComplete();
            return;
        }

        this.handleFinalCountdown(difference);

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        this.updateNumber('days', days);
        this.updateNumber('hours', hours);
        this.updateNumber('minutes', minutes);
        this.updateNumber('seconds', seconds);
    }

    handleFinalCountdown(difference) {
        const container = document.getElementById('countdownContainer');
        const title = document.getElementById('countdownTitle');
        const secondsLeft = Math.ceil(difference / 1000);
        
        if (difference <= 10000 && difference > 0) {
            container.classList.add('final-countdown');
            document.body.classList.add('countdown-urgent');
            title.classList.add('urgent-text');
            
            if (difference <= 3000) {
                container.classList.add('critical');
            } else {
                container.classList.remove('critical');
            }
            
            if (secondsLeft <= 10) {
                title.textContent = `还有 ${secondsLeft} 秒！`;
            }
        } else {
            container.classList.remove('final-countdown', 'critical');
            document.body.classList.remove('countdown-urgent');
            title.classList.remove('urgent-text');
            
            if (this.eventName) {
                title.textContent = `距离${this.eventName}还有`;
            } else {
                title.textContent = '距离新年还有';
            }
        }
    }

    updateNumber(id, value) {
        const element = document.getElementById(id);
        const formattedValue = String(value).padStart(2, '0');
        
        if (element.textContent !== formattedValue) {
            const flipElement = document.getElementById(`${id}Flip`);
            
            if (flipElement) {
                flipElement.classList.add('flipping');
                
                setTimeout(() => {
                    element.textContent = formattedValue;
                }, 300);
                
                setTimeout(() => {
                    flipElement.classList.remove('flipping');
                }, 800);
            } else {
                element.textContent = formattedValue;
                element.classList.add('number-change');
                setTimeout(() => element.classList.remove('number-change'), 300);
            }
        }
    }

    handleCountdownComplete() {
        clearInterval(this.timerInterval);
        
        if (!this.isCelebrating) {
            this.isCelebrating = true;
            this.showCelebration();
            this.startFireworks();
        }
    }

    showCelebration() {
        const countdownContainer = document.getElementById('countdownContainer');
        const celebrationContainer = document.getElementById('celebrationContainer');
        const celebrationTitle = document.getElementById('celebrationTitle');
        const celebrationMessage = document.getElementById('celebrationMessage');
        
        if (this.eventName) {
            celebrationTitle.textContent = `🎉 ${this.eventName}到了！`;
            celebrationMessage.textContent = `祝您${this.eventName}快乐，万事如意！`;
        } else {
            celebrationTitle.textContent = '🎉 新年快乐！';
            celebrationMessage.textContent = '祝您新年快乐，万事如意！';
        }
        
        countdownContainer.classList.add('hidden');
        celebrationContainer.classList.remove('hidden');
        
        document.getElementById('days').textContent = '00';
        document.getElementById('hours').textContent = '00';
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
    }

    resetCountdown() {
        this.isCelebrating = false;
        this.loadCustomSettings();
        this.fireworks = [];
        
        const countdownContainer = document.getElementById('countdownContainer');
        const celebrationContainer = document.getElementById('celebrationContainer');
        
        celebrationContainer.classList.add('hidden');
        countdownContainer.classList.remove('hidden');
        
        this.updateTargetYear();
        this.startCountdown();
    }

    startParticleSystem() {
        this.createParticles();
        this.lastTime = performance.now();
        this.animate();
    }

    createParticle() {
        const shapes = ['circle', 'star', 'diamond'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];
        return {
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            size: Math.random() * 4 + 1,
            speedX: (Math.random() - 0.5) * 0.8,
            speedY: (Math.random() - 0.5) * 0.8,
            opacity: Math.random() * 0.6 + 0.2,
            twinkleSpeed: Math.random() * 0.03 + 0.01,
            twinkleDirection: 1,
            shape: shape,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.02,
            hue: Math.random() * 60 + 30
        };
    }

    createParticles() {
        const particleCount = this.perfConfig.maxParticles;
        this.particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push(this.createParticle());
        }
    }

    animate(currentTime = performance.now()) {
        this.deltaTime = Math.min(currentTime - this.lastTime, 32);
        this.lastTime = currentTime;
        
        const ctx = this.ctx;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        ctx.fillStyle = 'rgba(10, 5, 15, 0.12)';
        ctx.fillRect(0, 0, width, height);
        
        if (this.perfConfig.qualityLevel >= 0.6) {
            this.drawParticleConnectionsOptimized();
        }
        
        if (this.mouse.x !== null && this.perfConfig.qualityLevel >= 0.7) {
            this.drawMouseConnectionsOptimized();
        }
        
        this.updateAndDrawParticlesOptimized();
        this.updateAndDrawFireworksOptimized();
        this.updateAndDrawBurstParticlesOptimized();
        
        this.animationId = requestAnimationFrame((t) => this.animate(t));
    }

    drawParticleConnectionsOptimized() {
        const particles = this.particles;
        const len = particles.length;
        const maxDistSq = this.perfConfig.connectionDistanceSq;
        const connectionDist = this.connectionDistance;
        const ctx = this.ctx;
        
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
        ctx.lineWidth = 0.5;
        
        let pathStarted = false;
        
        for (let i = 0; i < len; i++) {
            const p1 = particles[i];
            for (let j = i + 1; j < len; j++) {
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq < maxDistSq) {
                    if (!pathStarted) {
                        ctx.beginPath();
                        pathStarted = true;
                    }
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                }
            }
        }
        
        if (pathStarted) {
            ctx.stroke();
        }
    }

    drawMouseConnectionsOptimized() {
        const mx = this.mouse.x;
        const my = this.mouse.y;
        const maxDistSq = this.perfConfig.mouseConnectionDistanceSq;
        const mouseDist = this.mouseConnectionDistance;
        const particles = this.particles;
        const len = particles.length;
        const ctx = this.ctx;
        
        const isAttracting = this.mouse.isAttracting;
        ctx.strokeStyle = isAttracting ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 107, 107, 0.3)';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
            const p = particles[i];
            const dx = mx - p.x;
            const dy = my - p.y;
            const distSq = dx * dx + dy * dy;
            
            if (distSq < maxDistSq) {
                ctx.moveTo(mx, my);
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.stroke();
    }

    updateAndDrawBurstParticlesOptimized() {
        const particles = this.burstParticles;
        const len = particles.length;
        const ctx = this.ctx;
        
        let writeIdx = 0;
        
        for (let i = 0; i < len; i++) {
            const p = particles[i];
            
            p.x += p.speedX;
            p.y += p.speedY;
            p.speedY += p.gravity;
            p.speedX *= p.friction;
            p.speedY *= p.friction;
            p.life--;
            p.opacity = p.life / p.maxLife;
            
            if (p.life > 0) {
                particles[writeIdx++] = p;
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.globalAlpha = p.opacity;
                ctx.fill();
            } else {
                p.active = false;
            }
        }
        
        ctx.globalAlpha = 1;
        particles.length = writeIdx;
    }

    updateAndDrawParticlesOptimized() {
        const config = this.forceConfig;
        const perfConfig = this.perfConfig;
        const mouseRadiusSq = perfConfig.mouseRadiusSq;
        const mouseRadius = this.mouse.radius;
        const particles = this.particles;
        const len = particles.length;
        const ctx = this.ctx;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        const mx = this.mouse.x;
        const my = this.mouse.y;
        const hasMouse = mx !== null && my !== null;
        const isAttracting = this.mouse.isAttracting;
        
        for (let i = 0; i < len; i++) {
            const p = particles[i];
            
            if (hasMouse) {
                const dx = mx - p.x;
                const dy = my - p.y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq < mouseRadiusSq && distSq > 1) {
                    const distance = Math.sqrt(distSq);
                    const normalizedDistance = distance / mouseRadius;
                    const falloffFactor = Math.pow(1 - normalizedDistance, config.falloffPower);
                    let forceMagnitude = Math.min(config.baseForce * falloffFactor, config.maxForce);
                    const forceDirection = isAttracting ? 1 : -1;
                    const invDist = 1 / distance;
                    const forceX = dx * invDist * forceMagnitude * forceDirection;
                    const forceY = dy * invDist * forceMagnitude * forceDirection;
                    
                    p.speedX += forceX;
                    p.speedY += forceY;
                }
            }
            
            p.speedX *= config.dampingFactor;
            p.speedY *= config.dampingFactor;
            
            const speedSq = p.speedX * p.speedX + p.speedY * p.speedY;
            
            if (speedSq > config.maxSpeed * config.maxSpeed) {
                const scale = config.maxSpeed / Math.sqrt(speedSq);
                p.speedX *= scale;
                p.speedY *= scale;
            } else if (speedSq < config.minSpeed * config.minSpeed) {
                const angle = Math.random() * Math.PI * 2;
                p.speedX += Math.cos(angle) * config.minSpeed * 0.5;
                p.speedY += Math.sin(angle) * config.minSpeed * 0.5;
            }
            
            p.x += p.speedX;
            p.y += p.speedY;
            p.rotation += p.rotationSpeed;
            
            p.opacity += p.twinkleSpeed * p.twinkleDirection;
            if (p.opacity >= 0.7 || p.opacity <= 0.2) {
                p.twinkleDirection *= -1;
            }
            
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
            
            this.drawParticleFast(p, ctx);
        }
    }

    drawParticleFast(p, ctx) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        
        const size = p.size;
        const hue = p.hue;
        
        ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
        
        switch(p.shape) {
            case 'star':
                this.drawStarFast(ctx, size);
                break;
            case 'diamond':
                this.drawDiamondFast(ctx, size);
                break;
            default:
                ctx.beginPath();
                ctx.arc(0, 0, size, 0, Math.PI * 2);
                ctx.fill();
        }
        
        ctx.restore();
    }

    drawStarFast(ctx, size) {
        const spikes = 5;
        const outerRadius = size;
        const innerRadius = size * 0.5;
        let rot = -Math.PI / 2;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(0, -outerRadius);
        
        for (let i = 0; i < spikes; i++) {
            ctx.lineTo(
                Math.cos(rot) * outerRadius,
                Math.sin(rot) * outerRadius
            );
            rot += step;
            ctx.lineTo(
                Math.cos(rot) * innerRadius,
                Math.sin(rot) * innerRadius
            );
            rot += step;
        }
        
        ctx.closePath();
        ctx.fill();
    }

    drawDiamondFast(ctx, size) {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.7, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.7, 0);
        ctx.closePath();
        ctx.fill();
    }

    startFireworks() {
        setInterval(() => {
            if (this.isCelebrating) {
                this.createFirework();
            }
        }, 500);
    }

    createFirework() {
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * (window.innerHeight * 0.6);
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const particleCount = Math.floor(50 * this.perfConfig.qualityLevel);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 / particleCount) * i;
            const speed = Math.random() * 3 + 2;
            
            const particle = this.getFireworkParticleFromPool();
            particle.x = x;
            particle.y = y;
            particle.speedX = Math.cos(angle) * speed;
            particle.speedY = Math.sin(angle) * speed;
            particle.size = Math.random() * 3 + 2;
            particle.color = color;
            particle.opacity = 1;
            particle.gravity = 0.05;
            particle.life = 100;
            particle.active = true;
            
            this.fireworks.push(particle);
        }
    }

    updateAndDrawFireworksOptimized() {
        const fireworks = this.fireworks;
        const len = fireworks.length;
        const ctx = this.ctx;
        
        let writeIdx = 0;
        
        for (let i = 0; i < len; i++) {
            const f = fireworks[i];
            
            f.x += f.speedX;
            f.y += f.speedY;
            f.speedY += f.gravity;
            f.opacity -= 0.01;
            f.life--;
            
            if (f.opacity > 0 && f.life > 0) {
                fireworks[writeIdx++] = f;
                
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
                ctx.fillStyle = f.color;
                ctx.globalAlpha = f.opacity;
                ctx.fill();
            } else {
                f.active = false;
            }
        }
        
        ctx.globalAlpha = 1;
        fireworks.length = writeIdx;
    }

    setupEventListeners() {
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetCountdown());
        }

        const musicPlayerToggle = document.getElementById('musicPlayerToggle');
        const musicPlayerContent = document.getElementById('musicPlayerContent');
        const musicPlayerArrow = document.getElementById('musicPlayerArrow');
        
        if (musicPlayerToggle && musicPlayerContent) {
            musicPlayerToggle.addEventListener('click', () => {
                const isExpanded = !musicPlayerContent.classList.contains('hidden');
                
                if (isExpanded) {
                    musicPlayerContent.classList.add('hidden');
                    musicPlayerArrow.classList.remove('expanded');
                } else {
                    musicPlayerContent.classList.remove('hidden');
                    musicPlayerArrow.classList.add('expanded');
                }
            });
            
            document.addEventListener('click', (e) => {
                if (!musicPlayerToggle.contains(e.target) && !musicPlayerContent.contains(e.target)) {
                    musicPlayerContent.classList.add('hidden');
                    musicPlayerArrow.classList.remove('expanded');
                }
            });
        }

        const settingsBtn = document.getElementById('settingsBtn');
        const settingsPanel = document.getElementById('settingsPanel');
        const closeSettings = document.getElementById('closeSettings');
        const saveSettings = document.getElementById('saveSettings');
        
        if (settingsBtn && settingsPanel) {
            settingsBtn.addEventListener('click', () => this.openSettings());
            closeSettings.addEventListener('click', () => this.closeSettings());
            settingsPanel.addEventListener('click', (e) => {
                if (e.target === settingsPanel) {
                    this.closeSettings();
                }
            });
            saveSettings.addEventListener('click', () => this.saveSettings());
        }
        
        this.setupSettingsTabs();
        this.setupThemeSettings();

        this.setupKeyboardShortcuts();
    }

    setupSettingsTabs() {
        const settingsTabs = document.querySelectorAll('.settings-tab');
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                settingsTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const tabName = tab.dataset.tab;
                document.querySelectorAll('.settings-tab-content').forEach(content => {
                    content.classList.add('hidden');
                });
                
                const targetTab = document.getElementById(`${tabName}SettingsTab`);
                if (targetTab) {
                    targetTab.classList.remove('hidden');
                }
            });
        });
    }

    setupThemeSettings() {
        const colorThemeBtns = document.querySelectorAll('.color-theme-btn');
        colorThemeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                colorThemeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedColorTheme = btn.dataset.theme;
                this.updateThemePreview();
            });
        });
        
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const fontSizeValue = document.getElementById('fontSizeValue');
        if (fontSizeSlider && fontSizeValue) {
            fontSizeSlider.addEventListener('input', (e) => {
                const value = e.target.value;
                fontSizeValue.textContent = `${value}%`;
                this.selectedFontSize = parseInt(value);
                this.updateThemePreview();
            });
        }
        
        const saveThemeSettings = document.getElementById('saveThemeSettings');
        if (saveThemeSettings) {
            saveThemeSettings.addEventListener('click', () => this.applyThemeSettings());
        }
        
        this.loadThemeSettings();
    }

    loadThemeSettings() {
        const savedColorTheme = localStorage.getItem('countdownTheme') || 'festival';
        const savedFontSize = parseInt(localStorage.getItem('fontSize')) || 100;
        
        this.selectedColorTheme = savedColorTheme;
        this.selectedFontSize = savedFontSize;
        
        const colorThemeBtns = document.querySelectorAll('.color-theme-btn');
        colorThemeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === savedColorTheme);
        });
        
        const fontSizeSlider = document.getElementById('fontSizeSlider');
        const fontSizeValue = document.getElementById('fontSizeValue');
        if (fontSizeSlider) {
            fontSizeSlider.value = savedFontSize;
        }
        if (fontSizeValue) {
            fontSizeValue.textContent = `${savedFontSize}%`;
        }
        
        this.applyFontSize(savedFontSize);
        this.updateThemePreview();
    }

    updateThemePreview() {
        const previewBox = document.querySelector('.theme-preview-box');
        if (previewBox) {
            const theme = this.selectedColorTheme || 'festival';
            previewBox.className = `theme-preview-box theme-${theme}`;
        }
    }

    applyThemeSettings() {
        if (this.selectedColorTheme) {
            this.changeTheme(this.selectedColorTheme);
        }
        
        if (this.selectedFontSize) {
            localStorage.setItem('fontSize', this.selectedFontSize);
            this.applyFontSize(this.selectedFontSize);
        }
        
        this.closeSettings();
    }

    applyFontSize(size) {
        document.documentElement.style.fontSize = `${size}%`;
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            const musicPlayerContent = document.getElementById('musicPlayerContent');
            const musicPlayerArrow = document.getElementById('musicPlayerArrow');
            
            switch(e.key.toLowerCase()) {
                case 'm':
                    if (musicPlayerContent) {
                        const isExpanded = !musicPlayerContent.classList.contains('hidden');
                        if (isExpanded) {
                            musicPlayerContent.classList.add('hidden');
                            musicPlayerArrow?.classList.remove('expanded');
                        } else {
                            musicPlayerContent.classList.remove('hidden');
                            musicPlayerArrow?.classList.add('expanded');
                        }
                    }
                    break;
                case 's':
                    this.openSettings();
                    break;
                case 'e':
                    if (this.eventManager) {
                        this.eventManager.openEventsPanel();
                    }
                    break;
                case 'p':
                case 'share':
                    if (this.shareManager) {
                        this.shareManager.openSharePanel();
                    }
                    break;
                case 'escape':
                    this.closeSettings();
                    if (this.shareManager) {
                        this.shareManager.closeSharePanel();
                    }
                    break;
            }
        });
    }

    openSettings() {
        const settingsPanel = document.getElementById('settingsPanel');
        const targetDateInput = document.getElementById('targetDateInput');
        const eventNameInput = document.getElementById('eventNameInput');
        
        const dateStr = this.targetDate.toISOString().split('T')[0];
        targetDateInput.value = dateStr;
        eventNameInput.value = this.eventName;
        
        targetDateInput.min = new Date().toISOString().split('T')[0];
        
        this.loadThemeSettings();
        
        settingsPanel.classList.remove('hidden');
    }

    closeSettings() {
        const settingsPanel = document.getElementById('settingsPanel');
        settingsPanel.classList.add('hidden');
    }

    saveSettings() {
        const targetDateInput = document.getElementById('targetDateInput');
        const eventNameInput = document.getElementById('eventNameInput');
        
        const newDate = new Date(targetDateInput.value);
        const newEventName = eventNameInput.value.trim();
        
        if (isNaN(newDate.getTime())) {
            alert('请选择有效的日期');
            return;
        }
        
        if (newDate <= new Date()) {
            alert('请选择未来的日期');
            return;
        }
        
        this.targetDate = newDate;
        this.eventName = newEventName;
        
        localStorage.setItem('countdownTargetDate', newDate.toISOString());
        localStorage.setItem('countdownEventName', newEventName);
        
        this.updateTargetYear();
        this.closeSettings();
        
        if (this.isCelebrating) {
            this.resetCountdown();
        }
    }

    resetToDefault() {
        const targetDateInput = document.getElementById('targetDateInput');
        const eventNameInput = document.getElementById('eventNameInput');
        
        const nextNewYear = this.getNextNewYear();
        
        this.targetDate = nextNewYear;
        this.eventName = '';
        
        localStorage.removeItem('countdownTargetDate');
        localStorage.removeItem('countdownEventName');
        
        targetDateInput.value = nextNewYear.toISOString().split('T')[0];
        eventNameInput.value = '';
        
        this.updateTargetYear();
        this.closeSettings();
        
        if (this.isCelebrating) {
            this.resetCountdown();
        }
    }

    switchToEventCountdown(event) {
        if (!this.originalTargetDate) {
            this.originalTargetDate = this.targetDate;
            this.originalEventName = this.eventName;
        }
        
        const eventDateTime = new Date(event.date + (event.time ? ' ' + event.time : ' 00:00'));
        
        this.targetDate = eventDateTime;
        this.eventName = event.title;
        this.isEventCountdownMode = true;
        
        this.updateTargetYear();
        
        if (this.isCelebrating) {
            this.resetCountdown();
        }
        
        this.showEventCountdownIndicator();
    }

    restoreOriginalCountdown() {
        if (this.originalTargetDate) {
            this.targetDate = this.originalTargetDate;
            this.eventName = this.originalEventName;
        } else {
            this.loadCustomSettings();
        }
        
        this.isEventCountdownMode = false;
        this.updateTargetYear();
        
        if (this.isCelebrating) {
            this.resetCountdown();
        }
        
        this.hideEventCountdownIndicator();
    }

    showEventCountdownIndicator() {
        let indicator = document.getElementById('eventCountdownIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'eventCountdownIndicator';
            indicator.className = 'event-countdown-indicator';
            indicator.innerHTML = `
                <span class="indicator-text">📅 事件倒计时模式</span>
                <button id="exitEventCountdown" class="exit-btn" title="返回原倒计时">✕</button>
            `;
            
            const mainContainer = document.querySelector('main');
            if (mainContainer) {
                mainContainer.insertBefore(indicator, mainContainer.firstChild);
            }
            
            document.getElementById('exitEventCountdown')?.addEventListener('click', () => {
                this.restoreOriginalCountdown();
                if (this.eventManager) {
                    this.eventManager.clearCountdownMode();
                }
            });
        }
        
        indicator.classList.remove('hidden');
    }

    hideEventCountdownIndicator() {
        const indicator = document.getElementById('eventCountdownIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    changeTheme(theme, event) {
        if (this.themeChanging) return;
        this.themeChanging = true;
        
        const rippleConfig = {
            duration: this.rippleConfig?.duration || 800,
            rippleCount: this.rippleConfig?.rippleCount || 1,
            effect: this.rippleConfig?.effect || 'gradient',
            scale: this.rippleConfig?.scale || 4,
            startOpacity: this.rippleConfig?.startOpacity || 0.9,
            midOpacity: this.rippleConfig?.midOpacity || 0.5,
            staggerDelay: this.rippleConfig?.staggerDelay || 100
        };
        
        const body = document.body;
        body.classList.add('theme-changing');
        
        const container = this.getOrCreateRippleContainer();
        
        const x = event ? event.clientX : window.innerWidth / 2;
        const y = event ? event.clientY : window.innerHeight / 2;
        
        const maxDistance = Math.max(
            Math.hypot(x, y),
            Math.hypot(window.innerWidth - x, y),
            Math.hypot(x, window.innerHeight - y),
            Math.hypot(window.innerWidth - x, window.innerHeight - y)
        );
        
        const rippleSize = maxDistance * 2.5;
        
        const themeColors = {
            festival: { primary: '#7C3AED', secondary: '#F97316' },
            neon: { primary: '#7C3AED', secondary: '#F43F5E' },
            luxury: { primary: '#CA8A04', secondary: '#FBBF24' },
            space: { primary: '#3B82F6', secondary: '#F8FAFC' },
            soft: { primary: '#F472B6', secondary: '#22C55E' },
            red: { primary: '#C41E3A', secondary: '#FFD700' },
            blue: { primary: '#1E3A8A', secondary: '#60A5FA' },
            purple: { primary: '#7C3AED', secondary: '#C4B5FD' },
            gold: { primary: '#D4AF37', secondary: '#FFF8DC' },
            emerald: { primary: '#10B981', secondary: '#6EE7B7' },
            black: { primary: '#2d2d2d', secondary: '#808080' }
        };
        
        const colors = themeColors[theme] || themeColors.red;
        
        const ripples = [];
        
        for (let i = 0; i < rippleConfig.rippleCount; i++) {
            const ripple = document.createElement('div');
            const effectClass = rippleConfig.effect === 'double' ? 'ripple-double' : 
                               rippleConfig.effect === 'glow' ? 'ripple-glow' : 
                               rippleConfig.effect === 'gradient' ? 'ripple-gradient' : 'animating';
            
            ripple.className = `theme-ripple ${effectClass}`;
            
            ripple.style.cssText = `
                left: ${x}px;
                top: ${y}px;
                width: ${rippleSize}px;
                height: ${rippleSize}px;
                background: ${rippleConfig.effect === 'gradient' ? '' : 
                    `radial-gradient(circle, ${colors.secondary}66 0%, ${colors.primary}33 50%, transparent 70%)`};
                --ripple-duration: ${rippleConfig.duration}ms;
                --ripple-scale: ${rippleConfig.scale};
                --ripple-start-opacity: ${rippleConfig.startOpacity};
                --ripple-mid-opacity: ${rippleConfig.midOpacity};
                --ripple-color: ${colors.secondary}4D;
                --ripple-center-color: ${colors.secondary}CC;
                --ripple-mid-color: ${colors.primary}66;
            `;
            
            ripples.push({ element: ripple, delay: i * rippleConfig.staggerDelay });
        }
        
        const startTime = performance.now();
        
        const scheduleRipple = (rippleData, currentTime) => {
            if (currentTime - startTime >= rippleData.delay) {
                container.appendChild(rippleData.element);
                
                requestAnimationFrame(() => {
                    rippleData.element.classList.add('animating');
                });
                
                setTimeout(() => {
                    rippleData.element.remove();
                }, rippleConfig.duration + 100);
                
                return true;
            }
            return false;
        };
        
        const animateRipples = (currentTime) => {
            let allStarted = true;
            
            for (const rippleData of ripples) {
                if (!rippleData.started) {
                    const started = scheduleRipple(rippleData, currentTime);
                    if (started) {
                        rippleData.started = true;
                    } else {
                        allStarted = false;
                    }
                }
            }
            
            if (!allStarted) {
                requestAnimationFrame(animateRipples);
            }
        };
        
        requestAnimationFrame(animateRipples);
        
        const themeChangeDelay = rippleConfig.duration * 0.3;
        
        setTimeout(() => {
            body.classList.remove('theme-festival', 'theme-neon', 'theme-luxury', 'theme-space', 'theme-soft', 'theme-blue', 'theme-purple', 'theme-gold', 'theme-emerald', 'theme-black');
            
            if (theme !== 'red') {
                body.classList.add(`theme-${theme}`);
            }
            
            this.updateActiveThemeButton(theme);
            this.saveTheme(theme);
        }, themeChangeDelay);
        
        setTimeout(() => {
            body.classList.remove('theme-changing');
            this.themeChanging = false;
            container.innerHTML = '';
        }, rippleConfig.duration + 150);
    }

    getOrCreateRippleContainer() {
        let container = document.getElementById('rippleContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'rippleContainer';
            container.className = 'ripple-container';
            document.body.appendChild(container);
        }
        return container;
    }

    configureRipple(options = {}) {
        this.rippleConfig = {
            duration: options.duration ?? 800,
            rippleCount: options.rippleCount ?? 1,
            effect: options.effect ?? 'gradient',
            scale: options.scale ?? 4,
            startOpacity: options.startOpacity ?? 0.9,
            midOpacity: options.midOpacity ?? 0.5,
            staggerDelay: options.staggerDelay ?? 100
        };
        return this.rippleConfig;
    }

    updateActiveThemeButton(activeTheme) {
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.theme === activeTheme) {
                button.classList.add('active');
            }
        });
    }

    saveTheme(theme) {
        localStorage.setItem('countdownTheme', theme);
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('countdownTheme') || 'festival';
        this.changeTheme(savedTheme);
    }
}

class EventManager {
    constructor(countdownTimer) {
        this.countdownTimer = countdownTimer;
        this.events = [];
        this.selectedEventId = null;
        this.reminderTimeouts = new Map();
        this.storageKey = 'countdownEvents';
        this.countdownModeEventId = null;
        
        this.categoryLabels = {
            work: '工作',
            personal: '个人',
            study: '学习',
            health: '健康',
            social: '社交',
            birthday: '生日',
            other: '其他'
        };
        
        this.priorityLabels = {
            high: '高',
            medium: '中',
            low: '低'
        };
        
        this.statusLabels = {
            active: '进行中',
            completed: '已完成',
            archived: '已归档'
        };
        
        this.reminderLabels = {
            0: '事件开始时',
            5: '提前5分钟',
            15: '提前15分钟',
            30: '提前30分钟',
            60: '提前1小时',
            1440: '提前1天'
        };
        
        this.init();
    }

    init() {
        this.loadEvents();
        this.setupEventListeners();
        this.setupReminders();
        this.requestNotificationPermission();
    }

    loadEvents() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try {
                this.events = JSON.parse(saved);
            } catch (e) {
                this.events = [];
            }
        }
    }

    saveEvents() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    setupEventListeners() {
        const eventsBtn = document.getElementById('eventsBtn');
        const eventsPanel = document.getElementById('eventsPanel');
        const closeEvents = document.getElementById('closeEvents');
        const addEventBtn = document.getElementById('addEventBtn');
        const eventForm = document.getElementById('eventForm');
        const cancelEventBtn = document.getElementById('cancelEventBtn');
        const eventReminder = document.getElementById('eventReminder');
        const reminderSettings = document.getElementById('reminderSettings');
        const eventSearchInput = document.getElementById('eventSearchInput');
        const eventFilterCategory = document.getElementById('eventFilterCategory');
        const eventFilterPriority = document.getElementById('eventFilterPriority');
        const eventFilterStatus = document.getElementById('eventFilterStatus');
        const editEventBtn = document.getElementById('editEventBtn');
        const deleteEventBtn = document.getElementById('deleteEventBtn');
        const completeEventBtn = document.getElementById('completeEventBtn');
        const archiveEventBtn = document.getElementById('archiveEventBtn');
        const resetToNewYear = document.getElementById('resetToNewYear');

        if (eventsBtn) {
            eventsBtn.addEventListener('click', () => this.openEventsPanel());
        }

        if (closeEvents) {
            closeEvents.addEventListener('click', () => this.closeEventsPanel());
        }

        if (eventsPanel) {
            eventsPanel.addEventListener('click', (e) => {
                if (e.target === eventsPanel) {
                    this.closeEventsPanel();
                }
            });
        }

        if (resetToNewYear) {
            resetToNewYear.addEventListener('click', () => this.resetToNewYear());
        }

        if (addEventBtn) {
            addEventBtn.addEventListener('click', () => this.showAddEventForm());
        }

        if (eventForm) {
            eventForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveEvent();
            });
        }

        if (cancelEventBtn) {
            cancelEventBtn.addEventListener('click', () => this.cancelEventForm());
        }

        if (eventReminder && reminderSettings) {
            eventReminder.addEventListener('change', () => {
                reminderSettings.classList.toggle('hidden', !eventReminder.checked);
            });
        }

        if (eventSearchInput) {
            eventSearchInput.addEventListener('input', () => this.renderEventsList());
        }

        if (eventFilterCategory) {
            eventFilterCategory.addEventListener('change', () => this.renderEventsList());
        }

        if (eventFilterPriority) {
            eventFilterPriority.addEventListener('change', () => this.renderEventsList());
        }

        if (eventFilterStatus) {
            eventFilterStatus.addEventListener('change', () => this.renderEventsList());
        }

        if (editEventBtn) {
            editEventBtn.addEventListener('click', () => this.editSelectedEvent());
        }

        if (deleteEventBtn) {
            deleteEventBtn.addEventListener('click', () => this.deleteSelectedEvent());
        }

        if (completeEventBtn) {
            completeEventBtn.addEventListener('click', () => this.toggleCompleteEvent());
        }

        if (archiveEventBtn) {
            archiveEventBtn.addEventListener('click', () => this.toggleArchiveEvent());
        }

        const countdownModeBtn = document.getElementById('countdownModeBtn');
        if (countdownModeBtn) {
            countdownModeBtn.addEventListener('click', () => this.toggleCountdownMode());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEventsPanel();
            }
        });
    }

    openEventsPanel() {
        const eventsPanel = document.getElementById('eventsPanel');
        if (eventsPanel) {
            eventsPanel.classList.remove('hidden');
            this.renderEventsList();
            this.showNoEventSelected();
        }
    }

    closeEventsPanel() {
        const eventsPanel = document.getElementById('eventsPanel');
        if (eventsPanel) {
            eventsPanel.classList.add('hidden');
            this.selectedEventId = null;
        }
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    showAddEventForm() {
        this.selectedEventId = null;
        this.resetForm();
        
        const formContainer = document.getElementById('eventFormContainer');
        const detailContainer = document.getElementById('eventDetailContainer');
        const noEventSelected = document.getElementById('noEventSelected');
        const formTitle = document.getElementById('eventFormTitle');
        
        if (formContainer) formContainer.classList.remove('hidden');
        if (detailContainer) detailContainer.classList.add('hidden');
        if (noEventSelected) noEventSelected.classList.add('hidden');
        if (formTitle) formTitle.textContent = '添加新事件';
        
        const eventDate = document.getElementById('eventDate');
        if (eventDate) {
            eventDate.min = new Date().toISOString().split('T')[0];
        }
    }

    resetForm() {
        const form = document.getElementById('eventForm');
        if (form) form.reset();
        
        const eventId = document.getElementById('eventId');
        if (eventId) eventId.value = '';
        
        const reminderSettings = document.getElementById('reminderSettings');
        if (reminderSettings) reminderSettings.classList.add('hidden');
        
        const eventPriority = document.getElementById('eventPriority');
        if (eventPriority) eventPriority.value = 'medium';
        
        const eventCategory = document.getElementById('eventCategory');
        if (eventCategory) eventCategory.value = 'work';
    }

    showEditEventForm(event) {
        const formContainer = document.getElementById('eventFormContainer');
        const detailContainer = document.getElementById('eventDetailContainer');
        const noEventSelected = document.getElementById('noEventSelected');
        const formTitle = document.getElementById('eventFormTitle');
        
        if (formContainer) formContainer.classList.remove('hidden');
        if (detailContainer) detailContainer.classList.add('hidden');
        if (noEventSelected) noEventSelected.classList.add('hidden');
        if (formTitle) formTitle.textContent = '编辑事件';
        
        document.getElementById('eventId').value = event.id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventTime').value = event.time || '';
        document.getElementById('eventCategory').value = event.category;
        document.getElementById('eventPriority').value = event.priority;
        document.getElementById('eventTags').value = event.tags ? event.tags.join(', ') : '';
        document.getElementById('eventDescription').value = event.description || '';
        
        const eventReminder = document.getElementById('eventReminder');
        const reminderSettings = document.getElementById('reminderSettings');
        
        if (event.reminder && event.reminder.enabled) {
            eventReminder.checked = true;
            reminderSettings.classList.remove('hidden');
            document.getElementById('reminderTime').value = event.reminder.minutesBefore;
        } else {
            eventReminder.checked = false;
            reminderSettings.classList.add('hidden');
        }
    }

    saveEvent() {
        const eventId = document.getElementById('eventId').value;
        const title = document.getElementById('eventTitle').value.trim();
        const date = document.getElementById('eventDate').value;
        const time = document.getElementById('eventTime').value;
        const category = document.getElementById('eventCategory').value;
        const priority = document.getElementById('eventPriority').value;
        const tagsInput = document.getElementById('eventTags').value;
        const description = document.getElementById('eventDescription').value.trim();
        const reminderEnabled = document.getElementById('eventReminder').checked;
        const reminderMinutes = parseInt(document.getElementById('reminderTime').value);

        if (!title || !date) {
            alert('请填写事件名称和日期');
            return;
        }

        const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

        const eventData = {
            id: eventId || this.generateId(),
            title,
            date,
            time,
            category,
            priority,
            tags,
            description,
            status: 'active',
            reminder: reminderEnabled ? {
                enabled: true,
                minutesBefore: reminderMinutes
            } : { enabled: false },
            createdAt: eventId ? this.events.find(e => e.id === eventId)?.createdAt : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (eventId) {
            const index = this.events.findIndex(e => e.id === eventId);
            if (index !== -1) {
                eventData.status = this.events[index].status;
                this.events[index] = eventData;
            }
        } else {
            this.events.push(eventData);
        }

        this.saveEvents();
        this.renderEventsList();
        this.showEventDetail(eventData.id);
        this.setupReminders();
    }

    cancelEventForm() {
        const formContainer = document.getElementById('eventFormContainer');
        if (formContainer) formContainer.classList.add('hidden');
        
        if (this.selectedEventId) {
            this.showEventDetail(this.selectedEventId);
        } else {
            this.showNoEventSelected();
        }
    }

    deleteSelectedEvent() {
        if (!this.selectedEventId) return;
        
        if (confirm('确定要删除这个事件吗？')) {
            this.events = this.events.filter(e => e.id !== this.selectedEventId);
            this.saveEvents();
            this.selectedEventId = null;
            this.renderEventsList();
            this.showNoEventSelected();
        }
    }

    editSelectedEvent() {
        if (!this.selectedEventId) return;
        
        const event = this.events.find(e => e.id === this.selectedEventId);
        if (event) {
            this.showEditEventForm(event);
        }
    }

    toggleCompleteEvent() {
        if (!this.selectedEventId) return;
        
        const event = this.events.find(e => e.id === this.selectedEventId);
        if (event) {
            event.status = event.status === 'completed' ? 'active' : 'completed';
            event.updatedAt = new Date().toISOString();
            this.saveEvents();
            this.renderEventsList();
            this.showEventDetail(event.id);
        }
    }

    toggleArchiveEvent() {
        if (!this.selectedEventId) return;
        
        const event = this.events.find(e => e.id === this.selectedEventId);
        if (event) {
            event.status = event.status === 'archived' ? 'active' : 'archived';
            event.updatedAt = new Date().toISOString();
            this.saveEvents();
            this.renderEventsList();
            this.showEventDetail(event.id);
        }
    }

    getFilteredEvents() {
        const searchInput = document.getElementById('eventSearchInput')?.value.toLowerCase() || '';
        const categoryFilter = document.getElementById('eventFilterCategory')?.value || '';
        const priorityFilter = document.getElementById('eventFilterPriority')?.value || '';
        const statusFilter = document.getElementById('eventFilterStatus')?.value || '';

        return this.events.filter(event => {
            const matchesSearch = !searchInput || 
                event.title.toLowerCase().includes(searchInput) ||
                (event.description && event.description.toLowerCase().includes(searchInput)) ||
                (event.tags && event.tags.some(tag => tag.toLowerCase().includes(searchInput)));
            
            const matchesCategory = !categoryFilter || event.category === categoryFilter;
            const matchesPriority = !priorityFilter || event.priority === priorityFilter;
            const matchesStatus = !statusFilter || event.status === statusFilter;

            return matchesSearch && matchesCategory && matchesPriority && matchesStatus;
        }).sort((a, b) => {
            const dateA = new Date(a.date + (a.time ? ' ' + a.time : ''));
            const dateB = new Date(b.date + (b.time ? ' ' + b.time : ''));
            return dateA - dateB;
        });
    }

    renderEventsList() {
        const eventsList = document.getElementById('eventsList');
        if (!eventsList) return;

        const filteredEvents = this.getFilteredEvents();

        if (filteredEvents.length === 0) {
            eventsList.innerHTML = `
                <div class="empty-events">
                    <div class="empty-events-icon">📭</div>
                    <p>暂无事件</p>
                </div>
            `;
            return;
        }

        eventsList.innerHTML = filteredEvents.map(event => {
            const dateStr = this.formatEventDate(event.date, event.time);
            const isActive = event.id === this.selectedEventId;
            
            return `
                <div class="event-item ${isActive ? 'active' : ''} ${event.status}" data-id="${event.id}">
                    <div class="event-item-title">${this.escapeHtml(event.title)}</div>
                    <div class="event-item-date">${dateStr}</div>
                    <div class="event-item-badges">
                        <span class="event-badge category-${event.category}">${this.categoryLabels[event.category]}</span>
                        <span class="event-badge priority-${event.priority}">${this.priorityLabels[event.priority]}</span>
                    </div>
                </div>
            `;
        }).join('');

        eventsList.querySelectorAll('.event-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                this.showEventDetail(id);
            });
        });
    }

    showNoEventSelected() {
        const formContainer = document.getElementById('eventFormContainer');
        const detailContainer = document.getElementById('eventDetailContainer');
        const noEventSelected = document.getElementById('noEventSelected');

        if (formContainer) formContainer.classList.add('hidden');
        if (detailContainer) detailContainer.classList.add('hidden');
        if (noEventSelected) noEventSelected.classList.remove('hidden');
        
        this.selectedEventId = null;
        this.renderEventsList();
    }

    formatEventDate(date, time) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        const weekday = weekdays[d.getDay()];
        
        let result = `${year}年${month}月${day}日 ${weekday}`;
        if (time) {
            result += ` ${time}`;
        }
        return result;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupReminders() {
        this.reminderTimeouts.forEach(timeout => clearTimeout(timeout));
        this.reminderTimeouts.clear();

        const now = new Date();

        this.events.forEach(event => {
            if (event.reminder && event.reminder.enabled && event.status === 'active') {
                const eventDateTime = new Date(event.date + (event.time ? ' ' + event.time : ' 00:00'));
                const reminderTime = new Date(eventDateTime.getTime() - event.reminder.minutesBefore * 60 * 1000);

                if (reminderTime > now) {
                    const delay = reminderTime.getTime() - now.getTime();
                    const timeoutId = setTimeout(() => {
                        this.showReminder(event);
                    }, delay);
                    this.reminderTimeouts.set(event.id, timeoutId);
                }
            }
        });
    }

    showReminder(event) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('📅 事件提醒', {
                body: `${event.title}\n${this.formatEventDate(event.date, event.time)}`,
                icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📅</text></svg>'
            });
        }

        alert(`📅 事件提醒\n\n${event.title}\n${this.formatEventDate(event.date, event.time)}`);
    }

    toggleCountdownMode() {
        if (!this.selectedEventId) return;

        const event = this.events.find(e => e.id === this.selectedEventId);
        if (!event) return;

        const countdownModeBtn = document.getElementById('countdownModeBtn');
        const countdownModeText = document.getElementById('countdownModeText');

        if (this.countdownModeEventId === this.selectedEventId) {
            this.clearCountdownMode();
        } else {
            this.countdownModeEventId = this.selectedEventId;
            countdownModeBtn.classList.add('active');
            countdownModeText.textContent = '退出倒计时';
            
            this.countdownTimer.switchToEventCountdown(event);
            
            const eventsPanel = document.getElementById('eventsPanel');
            if (eventsPanel) {
                eventsPanel.classList.add('hidden');
            }
        }
    }

    clearCountdownMode() {
        this.countdownModeEventId = null;
        
        const countdownModeBtn = document.getElementById('countdownModeBtn');
        const countdownModeText = document.getElementById('countdownModeText');
        
        if (countdownModeBtn) {
            countdownModeBtn.classList.remove('active');
        }
        if (countdownModeText) {
            countdownModeText.textContent = '倒计时模式';
        }
        
        this.countdownTimer.restoreOriginalCountdown();
    }

    resetToNewYear() {
        this.clearCountdownMode();
        this.countdownTimer.resetToDefault();
        this.closeEventsPanel();
    }

    showEventDetail(eventId) {
        const event = this.events.find(e => e.id === eventId);
        if (!event) return;

        this.selectedEventId = eventId;
        this.renderEventsList();

        const formContainer = document.getElementById('eventFormContainer');
        const detailContainer = document.getElementById('eventDetailContainer');
        const noEventSelected = document.getElementById('noEventSelected');

        if (formContainer) formContainer.classList.add('hidden');
        if (detailContainer) detailContainer.classList.remove('hidden');
        if (noEventSelected) noEventSelected.classList.add('hidden');

        document.getElementById('detailTitle').textContent = event.title;
        document.getElementById('detailDateTime').textContent = this.formatEventDate(event.date, event.time);
        
        const categoryEl = document.getElementById('detailCategory');
        categoryEl.textContent = this.categoryLabels[event.category];
        categoryEl.className = `event-badge category-${event.category}`;

        const priorityEl = document.getElementById('detailPriority');
        priorityEl.textContent = '优先级: ' + this.priorityLabels[event.priority];
        priorityEl.className = `event-badge priority-${event.priority}`;

        const statusEl = document.getElementById('detailStatus');
        statusEl.textContent = this.statusLabels[event.status];
        statusEl.className = `event-badge status-${event.status}`;

        const tagsContainer = document.getElementById('detailTags');
        if (event.tags && event.tags.length > 0) {
            tagsContainer.innerHTML = event.tags.map(tag => 
                `<span class="tag-badge">${this.escapeHtml(tag)}</span>`
            ).join('');
            document.getElementById('detailTagsContainer').style.display = 'flex';
        } else {
            tagsContainer.innerHTML = '';
            document.getElementById('detailTagsContainer').style.display = 'none';
        }

        const descContainer = document.getElementById('detailDescriptionContainer');
        if (event.description) {
            document.getElementById('detailDescription').textContent = event.description;
            descContainer.classList.remove('hidden');
        } else {
            descContainer.classList.add('hidden');
        }

        const reminderContainer = document.getElementById('detailReminderContainer');
        if (event.reminder && event.reminder.enabled) {
            document.getElementById('detailReminder').textContent = 
                '提醒: ' + this.reminderLabels[event.reminder.minutesBefore];
            reminderContainer.classList.remove('hidden');
        } else {
            reminderContainer.classList.add('hidden');
        }

        const completeBtn = document.getElementById('completeEventBtn');
        const archiveBtn = document.getElementById('archiveEventBtn');
        
        if (event.status === 'completed') {
            completeBtn.textContent = '↩️ 恢复进行中';
        } else {
            completeBtn.textContent = '✓ 标记完成';
        }
        
        if (event.status === 'archived') {
            archiveBtn.textContent = '📤 取消归档';
        } else {
            archiveBtn.textContent = '📦 归档';
        }

        const countdownModeBtn = document.getElementById('countdownModeBtn');
        const countdownModeText = document.getElementById('countdownModeText');
        
        if (this.countdownModeEventId === eventId) {
            countdownModeBtn.classList.add('active');
            countdownModeText.textContent = '退出倒计时';
        } else {
            countdownModeBtn.classList.remove('active');
            countdownModeText.textContent = '倒计时模式';
        }
    }
}

class ShareManager {
    constructor(countdownTimer) {
        this.countdownTimer = countdownTimer;
        this.qrcodeCanvas = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.generateQRCode();
    }

    setupEventListeners() {
        const shareBtn = document.getElementById('shareBtn');
        const sharePanel = document.getElementById('sharePanel');
        const closeShare = document.getElementById('closeShare');
        const copyShareUrl = document.getElementById('copyShareUrl');
        const copyShareText = document.getElementById('copyShareText');
        const refreshQRCode = document.getElementById('refreshQRCode');
        const platformBtns = document.querySelectorAll('.share-platform-btn');

        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.openSharePanel());
        }

        if (closeShare) {
            closeShare.addEventListener('click', () => this.closeSharePanel());
        }

        if (sharePanel) {
            sharePanel.addEventListener('click', (e) => {
                if (e.target === sharePanel) {
                    this.closeSharePanel();
                }
            });
        }

        if (copyShareUrl) {
            copyShareUrl.addEventListener('click', () => this.copyShareUrl());
        }

        if (copyShareText) {
            copyShareText.addEventListener('click', () => this.copyShareText());
        }

        if (refreshQRCode) {
            refreshQRCode.addEventListener('click', () => this.generateQRCode());
        }

        platformBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const platform = btn.dataset.platform;
                this.shareToPlatform(platform);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSharePanel();
            }
        });
    }

    openSharePanel() {
        const sharePanel = document.getElementById('sharePanel');
        if (sharePanel) {
            sharePanel.classList.remove('hidden');
            this.updateShareContent();
            this.generateQRCode();
        }
    }

    closeSharePanel() {
        const sharePanel = document.getElementById('sharePanel');
        if (sharePanel) {
            sharePanel.classList.add('hidden');
        }
    }

    updateShareContent() {
        const days = document.getElementById('days')?.textContent || '00';
        const hours = document.getElementById('hours')?.textContent || '00';
        const minutes = document.getElementById('minutes')?.textContent || '00';
        const seconds = document.getElementById('seconds')?.textContent || '00';
        
        const eventName = this.countdownTimer.eventName || '跨年倒计时';
        const targetDate = this.countdownTimer.targetDate;
        
        document.getElementById('shareEventName').textContent = eventName;
        document.getElementById('shareDays').textContent = days;
        document.getElementById('shareHours').textContent = hours;
        document.getElementById('shareMinutes').textContent = minutes;
        document.getElementById('shareTargetDate').textContent = targetDate ? 
            `目标: ${targetDate.toLocaleDateString('zh-CN')}` : '';
        
        const shareUrl = window.location.href;
        const shareUrlInput = document.getElementById('shareUrlInput');
        if (shareUrlInput) {
            shareUrlInput.value = shareUrl;
        }
        
        const shareText = document.getElementById('shareText');
        if (shareText) {
            const text = `🎊 ${eventName}\n⏰ 距离目标还有 ${days}天 ${hours}时 ${minutes}分\n📅 ${targetDate ? targetDate.toLocaleDateString('zh-CN') : ''}\n\n来一起倒计时吧！\n${shareUrl}`;
            shareText.value = text;
        }
    }

    generateQRCode() {
        const canvas = document.getElementById('qrcodeCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const size = 150;
        const url = window.location.href;
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        this.drawQRCode(ctx, url, size);
    }

    drawQRCode(ctx, text, size) {
        const moduleCount = 25;
        const moduleSize = size / moduleCount;
        const qrMatrix = this.generateQRMatrix(text, moduleCount);
        
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, size, size);
        
        ctx.fillStyle = '#7C3AED';
        
        for (let row = 0; row < moduleCount; row++) {
            for (let col = 0; col < moduleCount; col++) {
                if (qrMatrix[row][col]) {
                    const x = col * moduleSize;
                    const y = row * moduleSize;
                    ctx.beginPath();
                    ctx.roundRect(x + 0.5, y + 0.5, moduleSize - 1, moduleSize - 1, 1);
                    ctx.fill();
                }
            }
        }
        
        this.drawFinderPattern(ctx, 0, 0, moduleSize);
        this.drawFinderPattern(ctx, moduleCount - 7, 0, moduleSize);
        this.drawFinderPattern(ctx, 0, moduleCount - 7, moduleSize);
    }

    drawFinderPattern(ctx, startX, startY, moduleSize) {
        const x = startX * moduleSize;
        const y = startY * moduleSize;
        
        ctx.fillStyle = '#7C3AED';
        ctx.beginPath();
        ctx.roundRect(x, y, moduleSize * 7, moduleSize * 7, 4);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(x + moduleSize, y + moduleSize, moduleSize * 5, moduleSize * 5, 3);
        ctx.fill();
        
        ctx.fillStyle = '#7C3AED';
        ctx.beginPath();
        ctx.roundRect(x + moduleSize * 2, y + moduleSize * 2, moduleSize * 3, moduleSize * 3, 2);
        ctx.fill();
    }

    generateQRMatrix(text, size) {
        const matrix = [];
        const hash = this.simpleHash(text);
        
        for (let i = 0; i < size; i++) {
            matrix[i] = [];
            for (let j = 0; j < size; j++) {
                if (i < 8 && j < 8) {
                    matrix[i][j] = this.getFinderPattern(i, j);
                } else if (i < 8 && j >= size - 8) {
                    matrix[i][j] = this.getFinderPattern(i, j - (size - 8));
                } else if (i >= size - 8 && j < 8) {
                    matrix[i][j] = this.getFinderPattern(i - (size - 8), j);
                } else {
                    const seed = hash + i * size + j;
                    matrix[i][j] = (seed * 1103515245 + 12345) % 2 === 0;
                }
            }
        }
        
        return matrix;
    }

    getFinderPattern(row, col) {
        if (row === 0 || row === 6 || col === 0 || col === 6) return true;
        if (row >= 2 && row <= 4 && col >= 2 && col <= 4) return true;
        return false;
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    copyShareUrl() {
        const shareUrlInput = document.getElementById('shareUrlInput');
        if (shareUrlInput) {
            navigator.clipboard.writeText(shareUrlInput.value).then(() => {
                this.showToast('✓ 链接已复制到剪贴板');
                const copyBtn = document.getElementById('copyShareUrl');
                if (copyBtn) {
                    copyBtn.classList.add('copied');
                    copyBtn.textContent = '✓ 已复制';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.textContent = '复制';
                    }, 2000);
                }
            }).catch(() => {
                this.fallbackCopy(shareUrlInput);
            });
        }
    }

    copyShareText() {
        const shareText = document.getElementById('shareText');
        if (shareText) {
            navigator.clipboard.writeText(shareText.value).then(() => {
                this.showToast('✓ 文案已复制到剪贴板');
                const copyBtn = document.getElementById('copyShareText');
                if (copyBtn) {
                    copyBtn.classList.add('copied');
                    copyBtn.textContent = '✓ 已复制';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.textContent = '📋 复制文案';
                    }, 2000);
                }
            }).catch(() => {
                this.fallbackCopy(shareText);
            });
        }
    }

    fallbackCopy(element) {
        element.select();
        document.execCommand('copy');
        this.showToast('✓ 已复制到剪贴板');
    }

    shareToPlatform(platform) {
        const shareUrl = window.location.href;
        const eventName = this.countdownTimer.eventName || '跨年倒计时';
        const days = document.getElementById('days')?.textContent || '00';
        const hours = document.getElementById('hours')?.textContent || '00';
        const minutes = document.getElementById('minutes')?.textContent || '00';
        
        const title = `🎊 ${eventName}`;
        const text = `距离目标还有 ${days}天 ${hours}时 ${minutes}分，来一起倒计时吧！`;
        
        let shareLink = '';
        
        switch (platform) {
            case 'wechat':
                this.showToast('请截图后分享到微信');
                return;
            case 'weibo':
                shareLink = `https://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title + ' ' + text)}`;
                break;
            case 'qq':
                shareLink = `https://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(text)}`;
                break;
            case 'qzone':
                shareLink = `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(text)}`;
                break;
        }
        
        if (shareLink) {
            window.open(shareLink, '_blank', 'width=600,height=500');
        }
    }

    showToast(message) {
        const existingToast = document.querySelector('.share-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        const toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CountdownTimer();
});
