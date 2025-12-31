class CountdownTimer {
    constructor() {
        this.targetDate = this.getNextNewYear();
        this.timerInterval = null;
        this.isCelebrating = false;
        this.particles = [];
        this.fireworks = [];
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isPlaying = false;
        this.audio = null;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.loadTheme();
        this.setupMusic();
        this.startCountdown();
        this.updateTargetYear();
        this.updateCurrentYear();
        this.startParticleSystem();
    }

    setupCanvas() {
        this.canvas = document.getElementById('particleCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    getNextNewYear() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const nextYear = currentYear + 1;
        return new Date(`January 1, ${nextYear} 00:00:00`);
    }

    updateTargetYear() {
        const targetYear = this.targetDate.getFullYear();
        document.getElementById('targetYear').textContent = `${targetYear}年1月1日`;
    }

    updateCurrentYear() {
        const currentYear = new Date().getFullYear();
        document.getElementById('currentYear').textContent = currentYear;
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

        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        this.updateNumber('days', days);
        this.updateNumber('hours', hours);
        this.updateNumber('minutes', minutes);
        this.updateNumber('seconds', seconds);
    }

    updateNumber(id, value) {
        const element = document.getElementById(id);
        const formattedValue = String(value).padStart(2, '0');
        
        if (element.textContent !== formattedValue) {
            element.textContent = formattedValue;
            element.classList.add('number-change');
            setTimeout(() => element.classList.remove('number-change'), 300);
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
        
        countdownContainer.classList.add('hidden');
        celebrationContainer.classList.remove('hidden');
        
        document.getElementById('days').textContent = '00';
        document.getElementById('hours').textContent = '00';
        document.getElementById('minutes').textContent = '00';
        document.getElementById('seconds').textContent = '00';
    }

    resetCountdown() {
        this.isCelebrating = false;
        this.targetDate = this.getNextNewYear();
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
        this.animate();
    }

    createParticles() {
        const particleCount = 100;
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * 3 + 1,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
                opacity: Math.random() * 0.5 + 0.2,
                twinkleSpeed: Math.random() * 0.02 + 0.01,
                twinkleDirection: 1
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.updateAndDrawParticles();
        this.updateAndDrawFireworks();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    updateAndDrawParticles() {
        this.particles.forEach(particle => {
            particle.x += particle.speedX;
            particle.y += particle.speedY;
            
            particle.opacity += particle.twinkleSpeed * particle.twinkleDirection;
            
            if (particle.opacity >= 0.7 || particle.opacity <= 0.2) {
                particle.twinkleDirection *= -1;
            }
            
            if (particle.x < 0) particle.x = this.canvas.width;
            if (particle.x > this.canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = this.canvas.height;
            if (particle.y > this.canvas.height) particle.y = 0;
            
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
            this.ctx.fill();
        });
    }

    startFireworks() {
        setInterval(() => {
            if (this.isCelebrating) {
                this.createFirework();
            }
        }, 500);
    }

    createFirework() {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * (this.canvas.height * 0.6);
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 / particleCount) * i;
            const speed = Math.random() * 3 + 2;
            
            this.fireworks.push({
                x: x,
                y: y,
                speedX: Math.cos(angle) * speed,
                speedY: Math.sin(angle) * speed,
                size: Math.random() * 3 + 2,
                color: color,
                opacity: 1,
                gravity: 0.05,
                life: 100
            });
        }
    }

    updateAndDrawFireworks() {
        this.fireworks = this.fireworks.filter(firework => {
            firework.x += firework.speedX;
            firework.y += firework.speedY;
            firework.speedY += firework.gravity;
            firework.opacity -= 0.01;
            firework.life--;
            
            if (firework.opacity <= 0 || firework.life <= 0) {
                return false;
            }
            
            this.ctx.beginPath();
            this.ctx.arc(firework.x, firework.y, firework.size, 0, Math.PI * 2);
            this.ctx.fillStyle = firework.color.replace(')', `, ${firework.opacity})`).replace('rgb', 'rgba');
            this.ctx.fill();
            
            return true;
        });
    }

    setupEventListeners() {
        const themeButtons = document.querySelectorAll('.theme-btn');
        themeButtons.forEach(button => {
            button.addEventListener('click', (e) => this.changeTheme(e.target.dataset.theme));
        });

        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetCountdown());
        }

        const musicToggle = document.getElementById('musicToggle');
        if (musicToggle) {
            musicToggle.addEventListener('click', () => this.toggleMusic());
        }
    }

    setupMusic() {
        this.audio = new Audio();
        this.audio.src = 'http://music.163.com/song/media/outer/url?id=3320179802.mp3';
        this.audio.loop = true;
        this.audio.volume = 0.3;
        this.audio.preload = 'auto';
    }

    toggleMusic() {
        if (this.isPlaying) {
            this.audio.pause();
            this.isPlaying = false;
        } else {
            this.audio.play().catch(error => {
                console.log('Audio play failed:', error);
            });
            this.isPlaying = true;
        }
        this.updateMusicButton();
    }

    updateMusicButton() {
        const musicIcon = document.getElementById('musicIcon');
        const musicText = document.getElementById('musicText');
        
        if (this.isPlaying) {
            musicIcon.textContent = '🔊';
            musicText.textContent = '暂停音乐';
        } else {
            musicIcon.textContent = '🔇';
            musicText.textContent = '播放音乐';
        }
    }

    changeTheme(theme) {
        const body = document.body;
        
        body.classList.remove('theme-blue', 'theme-purple');
        
        if (theme === 'blue') {
            body.classList.add('theme-blue');
        } else if (theme === 'purple') {
            body.classList.add('theme-purple');
        }
        
        this.updateActiveThemeButton(theme);
        this.saveTheme(theme);
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
        const savedTheme = localStorage.getItem('countdownTheme') || 'red';
        this.changeTheme(savedTheme);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CountdownTimer();
});