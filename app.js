/**
 * Character Painter Clock
 * A clock where an artist character erases and paints the hands.
 */

const canvas = document.getElementById('clockCanvas');
const ctx = canvas.getContext('2d');

let width, height, centerX, centerY, radius;

// Configuration
const CONFIG = {
    eraseDuration: 10000, // 10 seconds
    paintDuration: 10000, // 10 seconds
    prepareDuration: 2000, // 2 seconds to move to position
    handColors: {
        hour: '#f8fafc',
        minute: '#f8fafc',
        second: '#ef4444'
    },
    characterColor: '#38bdf8'
};

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    centerX = width / 2;
    centerY = height / 2;
    radius = 250; // Match CSS clock face size
    
    // Scale for high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
}

window.addEventListener('resize', resize);
resize();

class Hand {
    constructor(type, length, width, color) {
        this.type = type;
        this.length = length;
        this.width = width;
        this.color = color;
        this.angle = 0;
        this.targetAngle = 0;
        this.currentPoints = []; // For hand-drawn look
        this.isPainting = false;
        this.isErasing = false;
        this.progress = 1; // 0 to 1
    }

    update(targetAngle) {
        this.targetAngle = targetAngle;
    }

    generatePoints(angle, length) {
        const points = [];
        const step = 5;
        const jitter = 1.5;
        for (let d = 0; d <= length; d += step) {
            const x = Math.sin(angle) * d + (Math.random() - 0.5) * jitter;
            const y = -Math.cos(angle) * d + (Math.random() - 0.5) * jitter;
            points.push({ x, y });
        }
        return points;
    }

    draw(ctx) {
        if (this.progress <= 0) return;

        ctx.save();
        ctx.translate(centerX, centerY);
        
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const drawStroke = (pts, width, alpha) => {
            ctx.beginPath();
            ctx.strokeStyle = this.color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = width;
            
            const pointsToDraw = Math.floor(pts.length * this.progress);
            if (this.isPainting || this.isErasing) {
                if (pointsToDraw > 0) {
                    ctx.moveTo(0, 0);
                    for (let i = 0; i < pointsToDraw; i++) {
                        ctx.lineTo(pts[i].x, pts[i].y);
                    }
                }
            } else {
                ctx.moveTo(0, 0);
                for (const p of pts) {
                    ctx.lineTo(p.x, p.y);
                }
            }
            
            if (pointsToDraw > 0 || (!this.isPainting && !this.isErasing)) {
                ctx.stroke();
            }
        };

        // Main stroke
        if (this.currentPoints.length === 0) {
            this.currentPoints = this.generatePoints(this.angle, this.length);
        }

        // Multiple passes for brush effect
        drawStroke(this.currentPoints, this.width, 0.8);
        
        // Slightly offset thin lines for texture
        for (let i = 0; i < 3; i++) {
            const offsetPts = this.currentPoints.map(p => ({
                x: p.x + (Math.random() - 0.5) * 2,
                y: p.y + (Math.random() - 0.5) * 2
            }));
            drawStroke(offsetPts, this.width * 0.3, 0.4);
        }

        ctx.restore();
    }
}

class Artist {
    constructor() {
        this.activeHand = null;
    }

    drawSponge(ctx, x, y, w, h) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        
        // Base light yellow
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(x, y, w, h);
        
        // Dark yellow stripes
        ctx.fillStyle = '#eab308';
        const stripeWidth = Math.max(2, w / 4);
        for (let i = -h; i < w + h; i += stripeWidth * 2) {
            ctx.beginPath();
            ctx.moveTo(x + i, y);
            ctx.lineTo(x + i + stripeWidth, y);
            ctx.lineTo(x + i - h + stripeWidth, y + h);
            ctx.lineTo(x + i - h, y + h);
            ctx.fill();
        }
        ctx.restore();
    }

    drawPen(ctx, x, y, length, thickness, angle, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);

        const tipLen = length * 0.15;
        const coneLen = length * 0.15;
        const bodyLen = length * 0.60;
        const capLen = length * 0.10;
        const w = thickness / 2;
        
        // Pen tip (ink color)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tipLen, -w * 0.5);
        ctx.lineTo(tipLen, w * 0.5);
        ctx.closePath();
        ctx.fill();
        
        // Wooden/Metal cone part
        ctx.fillStyle = '#94a3b8'; // Slate 400
        ctx.beginPath();
        ctx.moveTo(tipLen, -w * 0.5);
        ctx.lineTo(tipLen + coneLen, -w);
        ctx.lineTo(tipLen + coneLen, w);
        ctx.lineTo(tipLen, w * 0.5);
        ctx.closePath();
        ctx.fill();

        // Pen Body
        ctx.fillStyle = '#ef4444'; // Red 500
        ctx.beginPath();
        ctx.rect(tipLen + coneLen, -w, bodyLen, w * 2);
        ctx.fill();

        // End cap
        ctx.fillStyle = '#1e293b'; // Slate 800
        ctx.beginPath();
        ctx.rect(tipLen + coneLen + bodyLen, -w, capLen, w * 2);
        ctx.fill();

        ctx.restore();
    }

    draw(ctx) {
        ctx.save();
        
        // Base position (bottom of the clock face)
        const baseX = centerX;
        const baseY = centerY + radius;
        
        // Artist dimensions
        // Height is 2/3 of the dial diameter (radius * 2)
        const artistHeight = (radius * 2) * (2 / 3);
        const scale = artistHeight / 120; // Original height was 120, use this to scale proportions harmoniously
        
        const headRadius = 15 * scale;
        const shoulderY = baseY - artistHeight + headRadius * 2.5;
        const headY = baseY - artistHeight + headRadius;

        // Draw Artist Body (Silhouette)
        ctx.fillStyle = CONFIG.characterColor;
        
        // Legs
        ctx.beginPath();
        // Left leg
        ctx.moveTo(baseX - 20 * scale, baseY);
        ctx.lineTo(baseX - 10 * scale, baseY - 40 * scale);
        // Right leg
        ctx.lineTo(baseX + 10 * scale, baseY - 40 * scale);
        ctx.lineTo(baseX + 20 * scale, baseY);
        // Crotch
        ctx.lineTo(baseX, baseY - 30 * scale);
        ctx.fill();

        // Torso
        ctx.beginPath();
        ctx.moveTo(baseX - 15 * scale, shoulderY);
        ctx.lineTo(baseX + 15 * scale, shoulderY);
        ctx.lineTo(baseX + 10 * scale, baseY - 40 * scale);
        ctx.lineTo(baseX - 10 * scale, baseY - 40 * scale);
        ctx.fill();

        // Head
        ctx.beginPath();
        ctx.arc(baseX, headY, headRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw Arm(s)
        const leftShoulderX = baseX - 15 * scale;
        const rightShoulderX = baseX + 15 * scale;
        
        const leftIdleEndX = baseX - 25 * scale;
        const leftIdleEndY = shoulderY + 40 * scale;
        
        const rightIdleEndX = baseX + 25 * scale;
        const rightIdleEndY = shoulderY + 40 * scale;

        const lineWidth = 8 * scale;
        const brushRadius = 8 * scale;
        const spongeW = 20 * scale;
        const spongeH = 15 * scale;

        if (this.activeHand) {
            const handAngle = this.activeHand.angle;
            const d = this.activeHand.length * this.activeHand.progress;
            const tipX = centerX + Math.sin(handAngle) * d;
            const tipY = centerY - Math.cos(handAngle) * d;
            
            const isErasing = this.activeHand.isErasing;

            // Add jitter only during erasing
            const jitter = isErasing ? (Math.random() - 0.5) * 6 * scale : 0;
            const scrubX = tipX + jitter;
            const scrubY = tipY + jitter;

            // Draw the IDLE arm
            ctx.strokeStyle = CONFIG.characterColor;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            
            if (isErasing) {
                // Right arm is idle (painting arm)
                ctx.beginPath();
                ctx.moveTo(rightShoulderX, shoulderY);
                ctx.lineTo(rightIdleEndX, rightIdleEndY);
                ctx.stroke();
                // Draw idle brush
                this.drawPen(ctx, rightIdleEndX, rightIdleEndY, spongeW, spongeW * 0.25, -Math.PI / 4, this.activeHand.color);
            } else {
                // Left arm is idle (erasing arm)
                ctx.beginPath();
                ctx.moveTo(leftShoulderX, shoulderY);
                ctx.lineTo(leftIdleEndX, leftIdleEndY);
                ctx.stroke();
                // Draw idle sponge
                this.drawSponge(ctx, leftIdleEndX - spongeW/2, leftIdleEndY - spongeH/3, spongeW, spongeH);
            }

            // Draw the ACTIVE arm
            ctx.strokeStyle = CONFIG.characterColor;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            
            const activeShoulderX = isErasing ? leftShoulderX : rightShoulderX;
            ctx.moveTo(activeShoulderX, shoulderY);
            
            // Dynamic curving arm
            const cpX = activeShoulderX + (scrubX - activeShoulderX) * 0.3 + (isErasing ? -40 * scale : 40 * scale); 
            const cpY = shoulderY + (scrubY - shoulderY) * 0.5;
            ctx.quadraticCurveTo(cpX, cpY, scrubX, scrubY);
            ctx.stroke();
            
            // Draw active tool
            if (isErasing) {
                this.drawSponge(ctx, scrubX - spongeW/2, scrubY - spongeW/2, spongeW, spongeW);
            } else {
                this.drawPen(ctx, scrubX, scrubY, spongeW, spongeW * 0.25, -Math.PI / 4, this.activeHand.color);
            }
        } else {
            // Both arms idle
            ctx.strokeStyle = CONFIG.characterColor;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            
            // Left arm (Erasing Arm)
            ctx.beginPath();
            ctx.moveTo(leftShoulderX, shoulderY);
            ctx.lineTo(leftIdleEndX, leftIdleEndY);
            ctx.stroke();
            // Idle sponge
            this.drawSponge(ctx, leftIdleEndX - spongeW/2, leftIdleEndY - spongeH/3, spongeW, spongeH);
            
            // Right arm (Painting Arm)
            ctx.beginPath();
            ctx.moveTo(rightShoulderX, shoulderY);
            ctx.lineTo(rightIdleEndX, rightIdleEndY);
            ctx.stroke();
            // Idle brush
            this.drawPen(ctx, rightIdleEndX, rightIdleEndY, spongeW, spongeW * 0.25, -Math.PI / 4, CONFIG.handColors.minute);
        }

        ctx.restore();
    }
}

const hourHand = new Hand('hour', radius * 0.5, 8, CONFIG.handColors.hour);
const minuteHand = new Hand('minute', radius * 0.8, 5, CONFIG.handColors.minute);
const artist = new Artist();

let lastMinute = -1;
let lastHour = -1;

function update() {
    const now = new Date();
    const s = now.getSeconds();
    const ms = now.getMilliseconds();
    const m = now.getMinutes();
    const h = now.getHours();

    const mTargetAngle = (m + s / 60) * (Math.PI * 2 / 60);
    const hTargetAngle = ((h % 12) + m / 60) * (Math.PI * 2 / 12);

    // Initial set
    if (lastMinute === -1) {
        minuteHand.angle = m * (Math.PI * 2 / 60);
        minuteHand.currentPoints = minuteHand.generatePoints(minuteHand.angle, minuteHand.length);
        lastMinute = m;
    }
    if (lastHour === -1) {
        hourHand.angle = (h % 12 + m / 60) * (Math.PI * 2 / 12);
        hourHand.currentPoints = hourHand.generatePoints(hourHand.angle, hourHand.length);
        lastHour = h;
    }

    // Logic for Minute Hand Change
    const sWithMs = s + ms / 1000;
    
    if (sWithMs >= 31 && lastMinute === m) {
        if (!minuteHand.isErasing && !minuteHand.isPainting) {
            minuteHand.isErasing = true;
            artist.activeHand = minuteHand;
        }
        minuteHand.progress = (60 - sWithMs) / 29;
        if (minuteHand.progress <= 0) minuteHand.progress = 0;
    } else if (lastMinute !== m) {
        if (!minuteHand.isPainting) {
            minuteHand.isPainting = true;
            minuteHand.isErasing = false;
            minuteHand.angle = m * (Math.PI * 2 / 60);
            minuteHand.currentPoints = minuteHand.generatePoints(minuteHand.angle, minuteHand.length);
            artist.activeHand = minuteHand;
        }
        minuteHand.progress = sWithMs / 29;
        if (minuteHand.progress >= 1) {
            minuteHand.progress = 1;
            minuteHand.isPainting = false;
            lastMinute = m;
            if (artist.activeHand === minuteHand) artist.activeHand = null;
        }
    }

    // Logic for Hour Hand Change
    // We only erase/paint hour hand when m=59 and s>=31 (before new hour)
    // and paint when m=0 and s<29 (after new hour)
    if (m === 59 && sWithMs >= 31 && lastHour === h) {
        if (!hourHand.isErasing && !hourHand.isPainting) {
            hourHand.isErasing = true;
            artist.activeHand = hourHand;
        }
        hourHand.progress = (60 - sWithMs) / 29;
        if (hourHand.progress <= 0) hourHand.progress = 0;
    } else if (lastHour !== h) {
        if (!hourHand.isPainting) {
            hourHand.isPainting = true;
            hourHand.isErasing = false;
            hourHand.angle = ((h % 12) + m / 60) * (Math.PI * 2 / 12);
            hourHand.currentPoints = hourHand.generatePoints(hourHand.angle, hourHand.length);
            artist.activeHand = hourHand;
        }
        hourHand.progress = sWithMs / 29;
        if (hourHand.progress >= 1) {
            hourHand.progress = 1;
            hourHand.isPainting = false;
            lastHour = h;
            if (artist.activeHand === hourHand) artist.activeHand = null;
        }
    }

    // Second hand (regular sweep for reference, but subtle)
    const sAngle = (s + ms / 1000) * (Math.PI * 2 / 60);
    
    draw(sAngle);
    requestAnimationFrame(update);
}

function draw(sAngle) {
    ctx.clearRect(0, 0, width, height);

    // Draw Dial Numbers
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.font = '24px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 1; i <= 12; i++) {
        const a = i * (Math.PI * 2 / 12);
        const x = Math.sin(a) * (radius - 40);
        const y = -Math.cos(a) * (radius - 40);
        ctx.fillText(i.toString(), x, y);
    }
    ctx.restore();

    // Draw Artist Behind
    artist.draw(ctx);

    // Draw Hands
    hourHand.draw(ctx);
    minuteHand.draw(ctx);

    // Draw Second Hand (Thin and simple)
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(sAngle);
    ctx.strokeStyle = CONFIG.handColors.second;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.lineTo(0, -radius + 20);
    ctx.stroke();
    ctx.restore();
}

update();
