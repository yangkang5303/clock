/**
 * Sleepless Cell Clock (不眠室磨砂玻璃时钟)
 * Concept: The thick frosted-glass exterior window of a tiny 24/7 confinement room.
 * Behind the cold etched glass, a permanent desk, chair, and eternally lit gooseneck
 * lamp remain completely fixed. A weary silhouette sits at the desk—writing, reading,
 * or resting their head in fatigue—then pushes off, stands up, walks step-by-step
 * with real bipedal gait (foot-plant, knee-lift, weight-shift, arm counter-swing,
 * turning) up to the glass, wipes away the old ink time, paints the new time, turns
 * around, walks heavily back to the chair, pivots, and sits back down.
 */

const wrapper = document.getElementById('clockWrapper');
const canvas = document.getElementById('clockCanvas');
const ctx = canvas.getContext('2d');
const demoBtn = document.getElementById('demoBtn');
const activityBtn = document.getElementById('activityBtn');

let width = 620;
let height = 620;
let centerX = 310;
let centerY = 310;
let radius = 272;

// Configuration
const CONFIG = {
    putDownDuration: 650,      // ms to pause, set pen/book down & brace on desk
    standUpDuration: 920,      // ms to push off desk & rise heavily to standing
    walkForwardDuration: 2150, // ms for 3.5 deliberate footsteps from chair to glass wall
    prepareDuration: 650,      // ms to raise arm smoothly into glass contact
    eraseDuration: 3600,       // ms to wipe old ink with wide languid arcs
    paintDuration: 3600,       // ms to paint new ink hand steadily
    admireDuration: 700,       // ms brief weary pause before turning back
    walkBackDuration: 2250,    // ms to turn & trudge 3.5 footsteps back to the chair
    sitDownDuration: 1100,     // ms to pivot toward desk, bend knees & sink onto chair
    handColors: {
        hour: '#111317',
        minute: '#13161b',
        second: '#9e2f28'
    }
};

const IDLE_ACTIVITIES = ['writing', 'reading', 'weary'];
const IDLE_LABELS = {
    writing: '状态：伏案写字',
    reading: '状态：桌前翻书',
    weary: '状态：撑头疲惫'
};

// --- Math & Easing Helpers ---
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

function lerpAngle(a, b, t) {
    let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
}

/**
 * Step-pulsed progression curve:
 * Converts linear t in [0..1] across `steps` footsteps into a realistic bipedal
 * velocity profile (accelerates on push-off, slows gently at each heel-strike footplant)
 * instead of constant-speed "skateboard gliding".
 */
function computeSteppedProgress(t, steps) {
    const clamped = clamp(t, 0, 1);
    const u = clamped * steps;
    const idx = Math.floor(u);
    const frac = u - idx;
    const pulsedFrac = lerp(frac, easeInOutSine(frac), 0.72);
    return clamp((idx + pulsedFrac) / steps, 0, 1);
}

/**
 * Pole-Vector 2-Bone IK Solver (guarantees anatomically valid elbow & knee bending).
 */
function solvePoleIK(sx, sy, tx, ty, l1, l2, poleX, poleY) {
    const dx = tx - sx;
    const dy = ty - sy;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const maxReach = l1 + l2;

    let effL1 = l1;
    let effL2 = l2;
    let endX = tx;
    let endY = ty;
    if (dist > maxReach * 0.975) {
        const stretch = Math.min(1.07, dist / (maxReach * 0.975));
        effL1 = l1 * stretch;
        effL2 = l2 * stretch;
        const maxDist = (effL1 + effL2) * 0.988;
        if (dist > maxDist) {
            endX = sx + (dx / dist) * maxDist;
            endY = sy + (dy / dist) * maxDist;
        }
    }

    const rdx = endX - sx;
    const rdy = endY - sy;
    const rDist = clamp(Math.hypot(rdx, rdy), Math.abs(effL1 - effL2) + 0.01, effL1 + effL2 - 0.01);
    const cosA = clamp(
        (effL1 * effL1 + rDist * rDist - effL2 * effL2) / (2 * effL1 * rDist),
        -1,
        1
    );
    const baseAngle = Math.atan2(rdy, rdx);
    const offset = Math.acos(cosA);

    const e1x = sx + Math.cos(baseAngle + offset) * effL1;
    const e1y = sy + Math.sin(baseAngle + offset) * effL1;
    const e2x = sx + Math.cos(baseAngle - offset) * effL1;
    const e2y = sy + Math.sin(baseAngle - offset) * effL1;

    const d1 = (e1x - poleX) ** 2 + (e1y - poleY) ** 2;
    const d2 = (e2x - poleX) ** 2 + (e2y - poleY) ** 2;

    return d1 <= d2
        ? { elbowX: e1x, elbowY: e1y, endX, endY }
        : { elbowX: e2x, elbowY: e2y, endX, endY };
}

/**
 * Draws a single continuous, organic clothed limb silhouette along S -> J -> E.
 */
function drawContinuousLimb(ctx, sx, sy, jx, jy, ex, ey, radii, softness = 0.56) {
    const samples = 14;
    const pts = [];

    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        let lx, ly;
        if (t <= 0.5) {
            const u = t * 2;
            lx = lerp(sx, jx, u);
            ly = lerp(sy, jy, u);
        } else {
            const u = (t - 0.5) * 2;
            lx = lerp(jx, ex, u);
            ly = lerp(jy, ey, u);
        }
        const inv = 1 - t;
        const qx = inv * inv * sx + 2 * inv * t * jx + t * t * ex;
        const qy = inv * inv * sy + 2 * inv * t * jy + t * t * ey;

        const x = lerp(lx, qx, softness);
        const y = lerp(ly, qy, softness);

        const rIdx = t * (radii.length - 1);
        const r0 = Math.floor(rIdx);
        const r1 = Math.min(radii.length - 1, r0 + 1);
        const r = lerp(radii[r0], radii[r1], rIdx - r0);
        pts.push({ x, y, r });
    }

    const leftSide = [];
    const rightSide = [];
    for (let i = 0; i < pts.length; i++) {
        const prev = pts[Math.max(0, i - 1)];
        const next = pts[Math.min(pts.length - 1, i + 1)];
        const dx = next.x - prev.x;
        const dy = next.y - prev.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        leftSide.push({ x: pts[i].x + nx * pts[i].r, y: pts[i].y + ny * pts[i].r });
        rightSide.push({ x: pts[i].x - nx * pts[i].r, y: pts[i].y - ny * pts[i].r });
    }

    ctx.beginPath();
    ctx.moveTo(leftSide[0].x, leftSide[0].y);
    for (let i = 1; i < leftSide.length; i++) {
        ctx.lineTo(leftSide[i].x, leftSide[i].y);
    }

    const last = pts[pts.length - 1];
    const prevLast = pts[pts.length - 2];
    const endAngle = Math.atan2(last.y - prevLast.y, last.x - prevLast.x);
    ctx.arc(last.x, last.y, last.r, endAngle + Math.PI / 2, endAngle - Math.PI / 2, true);

    for (let i = rightSide.length - 1; i >= 0; i--) {
        ctx.lineTo(rightSide[i].x, rightSide[i].y);
    }

    const first = pts[0];
    const second = pts[1];
    const startAngle = Math.atan2(second.y - first.y, second.x - first.x);
    ctx.arc(first.x, first.y, first.r, startAngle - Math.PI / 2, startAngle + Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
}

function drawTaperedBar(ctx, x1, y1, x2, y2, r1, r2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const a1 = Math.atan2(ny, nx);
    const a2 = a1 + Math.PI;
    ctx.beginPath();
    ctx.arc(x1, y1, r1, a2, a1, false);
    ctx.arc(x2, y2, r2, a1, a2, false);
    ctx.closePath();
    ctx.fill();
}

function drawOrganicHand(ctx, wx, wy, angle, scale, relaxed = true) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(angle);
    const len = (relaxed ? 18 : 15) * scale;
    const w = (relaxed ? 6.0 : 6.6) * scale;

    ctx.beginPath();
    ctx.moveTo(0, -w * 0.65);
    ctx.quadraticCurveTo(len * 0.45, -w * 1.05, len, -w * 0.32);
    ctx.quadraticCurveTo(len * 1.12, 0, len * 0.90, w * 0.48);
    ctx.quadraticCurveTo(len * 0.45, w * 0.92, 0, w * 0.65);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/**
 * Draws an understated shoe/foot silhouette pointing in `dirSign` (+1 right, -1 left)
 * with ankle tilt so heel-strike and toe-off are clearly readable through the frosted glass.
 */
function drawFootSilhouette(ctx, ax, ay, tiltAngle, dirSign, scale) {
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(tiltAngle);
    ctx.scale(dirSign >= 0 ? 1 : -1, 1);

    const heelBack = 9 * scale;
    const toeFwd = 24 * scale;
    const soleY = 9 * scale;

    ctx.beginPath();
    ctx.moveTo(-heelBack, -2 * scale);
    ctx.quadraticCurveTo(4 * scale, -4 * scale, toeFwd * 0.72, 1 * scale);
    ctx.quadraticCurveTo(toeFwd, 4 * scale, toeFwd * 0.92, soleY);
    ctx.lineTo(-heelBack * 0.92, soleY);
    ctx.quadraticCurveTo(-heelBack * 1.12, soleY * 0.45, -heelBack, -2 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// --- Pre-baked Heavy Etched Frosted Glass Texture ---
let glassGrainPattern = null;

function createGlassGrainPattern() {
    const tile = document.createElement('canvas');
    tile.width = 160;
    tile.height = 160;
    const tctx = tile.getContext('2d');
    const img = tctx.createImageData(160, 160);
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
        const v = 140 + Math.floor(Math.random() * 95);
        data[i] = v - 2;
        data[i + 1] = v + 1;
        data[i + 2] = v;
        data[i + 3] = Math.floor(Math.random() * 24);
    }
    tctx.putImageData(img, 0, 0);
    return ctx.createPattern(tile, 'repeat');
}

// --- Lingering Damp Wipe Smudges & Ink Droplets on the Glass ---
class GlassTraceSystem {
    constructor() {
        this.traces = [];
        this.maxTraces = 75;
    }

    addWipeSmudge(x, y, angle, scale) {
        if (this.traces.length >= this.maxTraces) this.traces.shift();
        this.traces.push({
            type: 'smudge',
            x: x + (Math.random() - 0.5) * 8 * scale,
            y: y + (Math.random() - 0.5) * 8 * scale,
            angle,
            rx: (13 + Math.random() * 9) * scale,
            ry: (6 + Math.random() * 4) * scale,
            alpha: 0.11 + Math.random() * 0.05,
            life: 0,
            maxLife: 2.8 + Math.random() * 1.6
        });
    }

    addInkFleck(x, y, color, scale) {
        if (this.traces.length >= this.maxTraces) this.traces.shift();
        const a = Math.random() * Math.PI * 2;
        const spd = (3 + Math.random() * 9) * scale;
        this.traces.push({
            type: 'ink',
            x: x + (Math.random() - 0.5) * 3 * scale,
            y: y + (Math.random() - 0.5) * 3 * scale,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            size: (0.9 + Math.random() * 1.6) * scale,
            alpha: 0.4,
            life: 0,
            maxLife: 0.35 + Math.random() * 0.28,
            color
        });
    }

    update(dt) {
        for (let i = this.traces.length - 1; i >= 0; i--) {
            const p = this.traces[i];
            p.life += dt;
            if (p.life >= p.maxLife) {
                this.traces.splice(i, 1);
                continue;
            }
            if (p.type === 'ink') {
                p.vx *= Math.exp(-4.5 * dt);
                p.vy *= Math.exp(-4.5 * dt);
                p.x += p.vx * dt;
                p.y += p.vy * dt;
            }
        }
    }

    draw(ctx) {
        if (this.traces.length === 0) return;
        ctx.save();
        for (const p of this.traces) {
            const t = p.life / p.maxLife;
            const fade = (1 - t) * (1 - t);
            ctx.globalAlpha = p.alpha * fade;
            if (p.type === 'smudge') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.fillStyle = 'rgba(20, 24, 28, 0.75)';
                ctx.beginPath();
                ctx.ellipse(0, 0, p.rx * (0.92 + t * 0.25), p.ry * (0.92 + t * 0.25), 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(0.4, p.size * (1 - t * 0.4)), 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

// --- Sumi-Ink / Charcoal Hand-Painted Clock Hands ---
class InkHand {
    constructor(type, lengthRatio, baseWidth, color) {
        this.type = type;
        this.lengthRatio = lengthRatio;
        this.baseWidth = baseWidth;
        this.color = color;
        this.angle = 0;
        this.progress = 0;
        this.seed = Math.random() * 1000;
        this.strokes = [];
    }

    get length() {
        return radius * this.lengthRatio;
    }

    get strokeWidth() {
        return this.baseWidth * (radius / 272);
    }

    generateStrokes(angle, seed = Math.random() * 1000) {
        this.angle = angle;
        this.seed = seed;
        const len = this.length;
        const step = Math.max(3, len / 48);
        const dirX = Math.sin(angle);
        const dirY = -Math.cos(angle);
        const perpX = Math.cos(angle);
        const perpY = Math.sin(angle);
        const scale = radius / 272;

        const buildPass = (passIdx, amp, freq, lenMul = 1) => {
            const pts = [];
            const pLen = len * lenMul;
            const phase1 = seed * 1.29 + passIdx * 2.3;
            const phase2 = seed * 3.17 + passIdx * 4.1;
            const count = Math.ceil(pLen / step);

            for (let i = 0; i <= count; i++) {
                const frac = i / count;
                const d = frac * pLen;
                const env = Math.sin(frac * Math.PI) * 0.8 + frac * 0.2;
                const wobble =
                    (Math.sin(frac * Math.PI * freq + phase1) * 0.65 +
                        Math.sin(frac * Math.PI * (freq * 2.2) + phase2) * 0.35) *
                    amp *
                    env;
                pts.push({
                    x: dirX * d + perpX * wobble,
                    y: dirY * d + perpY * wobble
                });
            }
            return pts;
        };

        this.strokes = [
            { pts: buildPass(0, 1.35 * scale, 2.0, 1.0), widthMul: 1.0, alpha: 0.90 },
            { pts: buildPass(1, 2.2 * scale, 2.9, 0.98), widthMul: 0.45, alpha: 0.38 },
            { pts: buildPass(2, 2.6 * scale, 3.6, 0.95), widthMul: 0.30, alpha: 0.28 },
            { pts: buildPass(3, 1.6 * scale, 4.4, 1.01), widthMul: 0.22, alpha: 0.24 }
        ];
    }

    getPointAtProgress(progress = this.progress) {
        const clamped = clamp(progress, 0, 1);
        if (this.strokes.length === 0) {
            this.generateStrokes(this.angle, this.seed);
        }
        const pts = this.strokes[0].pts;
        const exactIdx = clamped * (pts.length - 1);
        const i0 = Math.floor(exactIdx);
        const i1 = Math.min(pts.length - 1, i0 + 1);
        const frac = exactIdx - i0;
        return {
            x: centerX + lerp(pts[i0].x, pts[i1].x, frac),
            y: centerY + lerp(pts[i0].y, pts[i1].y, frac)
        };
    }

    draw(ctx) {
        if (this.progress <= 0.002) return;
        if (this.strokes.length === 0) {
            this.generateStrokes(this.angle, this.seed);
        }

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = this.color;

        const baseW = this.strokeWidth;
        for (const stroke of this.strokes) {
            const pts = stroke.pts;
            const exactIdx = clamp(this.progress, 0, 1) * (pts.length - 1);
            const lastFullIdx = Math.floor(exactIdx);
            const frac = exactIdx - lastFullIdx;
            if (exactIdx <= 0.001) continue;

            ctx.beginPath();
            ctx.globalAlpha = stroke.alpha;
            ctx.lineWidth = Math.max(1, baseW * stroke.widthMul);
            ctx.moveTo(pts[0].x, pts[0].y);

            for (let i = 1; i <= lastFullIdx; i++) {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
            if (lastFullIdx < pts.length - 1 && frac > 0) {
                const p0 = pts[lastFullIdx];
                const p1 = pts[lastFullIdx + 1];
                ctx.lineTo(lerp(p0.x, p1.x, frac), lerp(p0.y, p1.y, frac));
            }
            ctx.stroke();
        }
        ctx.restore();
    }
}

// --- Captive Sleepless Silhouette with Real Bipedal Gait ---
class CaptiveTimekeeper {
    constructor() {
        this.time = 0;
        this.idleActivity = 'writing'; // 'writing' | 'reading' | 'weary'

        // Spatial & posture state
        this.depth = 0;         // 0 = seated at desk in back, 1 = close against frosted glass
        this.standAmount = 0;   // 0 = seated, 1 = standing
        // Signed profile facing: +1 = facing right (toward desk / walking forward-right),
        // 0 = facing straight into glass, -1 = facing left (walking back toward chair!)
        this.profileDir = 1;
        this.posOffsetX = -0.31;
        this.walkStartX = -0.31;
        this.crouchOffset = 0;
        this.sitStandLean = 0;

        // Real bipedal gait state
        this.gaitTheta = 0;      // advances by PI per footstep!
        this.walkEnvelope = 0;   // 0 = still, 1 = full stride
        this.walkDir = 1;        // +1 walking right-forward, -1 walking left-back
        this.shoulderRoll = 0;

        // Upper-body expression
        this.leanX = 0;
        this.headTilt = 0;
        this.headNod = 0;
        this.leftShoulderLift = 0;
        this.rightShoulderLift = 0;
        this.bookHoldBlend = 0;

        this.pageTurnTimer = 3.5;
        this.pageTurnProgress = -1;
        this.writePhase = 0;

        // Smoothed wrist & spring-damped elbow positions
        this.leftHand = { x: 0, y: 0, angle: 0, initialized: false };
        this.rightHand = { x: 0, y: 0, angle: 0, initialized: false };
        this.leftElbow = { x: 0, y: 0, initialized: false };
        this.rightElbow = { x: 0, y: 0, initialized: false };

        this.directive = {
            mode: 'seated',
            phaseProgress: 0,
            targetX: 0,
            targetY: 0,
            handAngle: 0,
            paintColor: CONFIG.handColors.minute
        };

        this.traceTimer = 0;
    }

    setIdleActivity(activity) {
        this.idleActivity = activity;
        this.pageTurnProgress = -1;
        this.pageTurnTimer = 3.4;
    }

    cycleIdleActivity() {
        const idx = IDLE_ACTIVITIES.indexOf(this.idleActivity);
        const next = IDLE_ACTIVITIES[(idx + 1) % IDLE_ACTIVITIES.length];
        this.setIdleActivity(next);
        return next;
    }

    /**
     * PERMANENT, IMMUTABLE CELL ROOM GEOMETRY (NEVER fades, moves, or jumps).
     */
    getCellLayout() {
        const s = radius / 272;
        const seatX = centerX - radius * 0.31;
        const floorY = centerY + radius * 0.88; // keeps feet & footsteps clearly visible inside glass!
        const seatY = centerY + radius * 0.54;
        const deskY = centerY + radius * 0.43;
        const deskLeftX = centerX - radius * 0.13;
        const deskRightX = centerX + radius * 0.62;
        const lampBaseX = deskLeftX + 128 * s;
        const lampHeadX = lampBaseX - 24 * s;
        const lampHeadY = deskY - 64 * s;
        return {
            s,
            seatX,
            floorY,
            seatY,
            deskY,
            deskLeftX,
            deskRightX,
            lampBaseX,
            lampHeadX,
            lampHeadY
        };
    }

    /**
     * Evaluates realistic stance/swing kinematics for a single leg given gait angle `legPhi`.
     */
    computeWalkingLeg(legPhi, hipX, hipY, floorY, pScale, thighLen, calfLen) {
        const phi = ((legPhi % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const env = this.walkEnvelope;
        const dir = this.walkDir;

        // Visible stride length & foot lift scaled by perspective & walk envelope
        const strideAmp = 42 * pScale * env;
        const liftAmp = 24 * pScale * env;

        let footOffsetX = 0;
        let footLiftY = 0;
        let footTilt = 0;

        if (phi < Math.PI) {
            // STANCE PHASE: foot planted firmly on the floor as body passes forward over it
            const u = phi / Math.PI; // 0 = front heel-strike, 1 = back toe-off
            footOffsetX = dir * lerp(strideAmp, -strideAmp, u);
            footLiftY = 0;
            // Heel strike (toe slightly up) -> flat mid-stance -> heel peels up at push-off
            footTilt = dir * lerp(-0.20, 0.28, u) * env;
        } else {
            // SWING PHASE: foot lifts off floor, knee bends & swings forward to next step
            const u = (phi - Math.PI) / Math.PI;
            footOffsetX = dir * lerp(-strideAmp, strideAmp, easeInOutSine(u));
            footLiftY = Math.sin(u * Math.PI) * liftAmp;
            footTilt = dir * lerp(0.32, -0.22, u) * env;
        }

        const ankleX = hipX + footOffsetX;
        const ankleY = floorY - 8 * pScale - footLiftY;

        // Knee always bends anatomically FORWARD in the direction of walking (`dir`)!
        const kneePoleX = hipX + dir * 110 * pScale;
        const kneePoleY = lerp(hipY, ankleY, 0.45) - footLiftY * 0.4;

        const ik = solvePoleIK(hipX, hipY, ankleX, ankleY, thighLen, calfLen, kneePoleX, kneePoleY);

        return {
            hipX,
            hipY,
            kneeX: ik.elbowX,
            kneeY: ik.elbowY,
            ankleX: ik.endX,
            ankleY: ik.endY,
            footLiftY,
            footTilt
        };
    }

    computeBodyGeometry() {
        const layout = this.getCellLayout();
        const s = layout.s;

        // Perspective scaling: 0.56x back at desk -> 1.0x close against glass
        const pScale = lerp(0.56, 1.0, easeInOutSine(this.depth)) * s;

        // Real bipedal gait body mechanics:
        // - Vertical bounce: LOWEST at foot contact (cos(2*theta) = +1), HIGHEST at mid-stance passing (-1)!
        // - Lateral weight transfer: shifts torso onto whichever foot is currently planted!
        const env = this.walkEnvelope;
        const walkContactDipY = Math.cos(2 * this.gaitTheta) * 7.5 * pScale * env;
        const walkWeightShiftX = Math.sin(this.gaitTheta) * 9.0 * pScale * env;

        // Slow weary breathing
        const breath = Math.sin(this.time * 1.15) * 1.6 * pScale;

        const baseX = centerX + this.posOffsetX * radius + walkWeightShiftX;

        // Keep floor & striding feet visible through most of the walk, only dipping below glass on final close step!
        const closeZoom = Math.pow(clamp(this.depth, 0, 1), 1.65);
        const floorY = lerp(layout.floorY, centerY + radius * 1.34, closeZoom);

        const thighLen = 96 * pScale;
        const calfLen = 94 * pScale;

        const seatedHipY = layout.seatY - 4 * s;
        const standingHipY = floorY - (thighLen + calfLen - 8 * pScale) + walkContactDipY + this.crouchOffset;
        const hipY = lerp(seatedHipY, standingHipY, easeInOutCubic(this.standAmount));

        const torsoLen = 142 * pScale;
        const wearySlump = (1 - this.standAmount) * (this.idleActivity === 'weary' ? 9 : 4) * pScale;
        const shoulderY = hipY - torsoLen + breath + wearySlump;

        // Forward pitch: seated desk lean + slight forward lean while trudging forward + sit/stand counterbalance
        const activityLean =
            this.idleActivity === 'writing' ? 25 :
            this.idleActivity === 'weary' ? 30 : 12;
        const seatedLean = (1 - this.standAmount) * activityLean * pScale;
        const walkFwdLean = this.walkDir * 11 * pScale * env;
        const torsoTopX = baseX + this.leanX + seatedLean + walkFwdLean + this.sitStandLean * 26 * pScale;

        // Foreshortened shoulder width when turned in profile (left OR right!)
        const absProf = Math.abs(this.profileDir);
        const facingWidthFactor = lerp(1.0, 0.52, absProf);
        const shoulderHalfW = 46 * pScale * facingWidthFactor;

        const tiltDrop = Math.sin(this.shoulderRoll) * shoulderHalfW;
        const leftShoulderX = torsoTopX - shoulderHalfW;
        const rightShoulderX = torsoTopX + shoulderHalfW;
        const leftShoulderY = shoulderY - this.leftShoulderLift + tiltDrop;
        const rightShoulderY = shoulderY - this.rightShoulderLift - tiltDrop;

        const neckLen = 20 * pScale;
        const headRx = 22.5 * pScale;
        const headRy = 28.5 * pScale;
        const headX = torsoTopX + this.profileDir * 8 * pScale + this.leanX * 0.14;
        const headY = shoulderY - neckLen - headRy * 0.70 + this.headNod + breath * 0.35 + walkContactDipY * 0.25;

        return {
            layout,
            s,
            pScale,
            baseX,
            floorY,
            hipY,
            thighLen,
            calfLen,
            torsoTopX,
            shoulderY,
            leftShoulderX,
            rightShoulderX,
            leftShoulderY,
            rightShoulderY,
            headX,
            headY,
            headRx,
            headRy,
            upperArmLen: 95 * pScale,
            foreArmLen: 91 * pScale
        };
    }

    update(dt, traces) {
        this.time += dt;
        const d = this.directive;
        const mode = d.mode;
        const p = clamp(d.phaseProgress, 0, 1);

        const seatedX = -0.31;
        const isLeftWork = mode === 'approach-erase' || mode === 'erasing';
        const isRightWork = mode === 'approach-paint' || mode === 'painting';

        let standWorkX = clamp((d.targetX - centerX) / radius, -0.42, 0.42) * 0.46;
        if (isLeftWork) {
            standWorkX = clamp((d.targetX - centerX) / radius + 0.12, -0.36, 0.36);
        } else if (isRightWork) {
            standWorkX = clamp((d.targetX - centerX) / radius - 0.12, -0.36, 0.36);
        }

        let targetDepth = 0;
        let targetStand = 0;
        let targetProfileDir = 1;
        let targetPosX = seatedX;
        let targetWalkEnv = 0;
        let targetSitStandLean = 0;
        let targetBookHold = this.idleActivity === 'reading' ? 1 : 0;
        let targetCrouch = 0;
        let targetShoulderRoll = 0;

        const WALK_STEPS = 3.5; // 3.5 visible, deliberate footsteps across the room!

        if (mode === 'seated') {
            targetDepth = 0;
            targetStand = 0;
            targetProfileDir = 1;
            targetPosX = seatedX;
        } else if (mode === 'put-down') {
            targetDepth = 0;
            targetStand = 0;
            targetProfileDir = 1;
            targetPosX = seatedX;
            targetBookHold = 0;
            targetSitStandLean = easeInOutSine(p) * 0.90;
        } else if (mode === 'stand-up') {
            const rise = easeInOutCubic(p);
            targetDepth = lerp(0, 0.06, rise);
            targetStand = rise;
            targetProfileDir = lerp(1.0, 0.88, rise);
            targetPosX = lerp(seatedX, seatedX + 0.04, rise);
            targetBookHold = 0;
            targetSitStandLean = Math.sin(p * Math.PI) * 0.95;
            this.walkStartX = seatedX + 0.04;
            this.gaitTheta = 0;
        } else if (mode === 'walk-forward') {
            // REAL STEP-PULSED WALK: 3.5 distinct footsteps diagonally from chair -> glass wall!
            const stepped = computeSteppedProgress(p, WALK_STEPS);
            this.walkDir = 1;
            this.gaitTheta = p * WALK_STEPS * Math.PI;

            targetDepth = lerp(0.06, 1.0, stepped);
            targetStand = 1;
            targetPosX = lerp(this.walkStartX, standWorkX, stepped);

            // Walk in readable 3/4 right-forward profile for the first 72% of steps,
            // then smoothly square shoulders to face the frosted glass on the final settle step!
            targetProfileDir = p < 0.72 ? 0.85 : lerp(0.85, 0.0, easeInOutSine((p - 0.72) / 0.28));

            // Full stride envelope ramping in cleanly on step 1 and settling onto both feet at the glass
            targetWalkEnv = Math.pow(Math.sin(p * Math.PI), 0.55);
            targetShoulderRoll = -Math.sin(this.gaitTheta) * 0.065 * targetWalkEnv;
            targetBookHold = 0;
        } else if (isLeftWork || isRightWork || mode === 'admiring') {
            targetDepth = 1;
            targetStand = 1;
            targetProfileDir = 0;
            targetPosX = mode === 'admiring' ? standWorkX * 0.55 : standWorkX;
            targetBookHold = 0;
            this.walkStartX = this.posOffsetX;

            if (mode !== 'admiring' && d.targetY > centerY + radius * 0.32) {
                const lowFactor = clamp((d.targetY - (centerY + radius * 0.32)) / (radius * 0.45), 0, 1);
                targetCrouch = lowFactor * 28 * (radius / 272);
            }
        } else if (mode === 'walk-back') {
            // TURN LEFT away from glass & trudge 3.5 visible footsteps back to the chair!
            // First 14% of phase = turning body away from glass before taking first step back!
            const turnT = clamp(p / 0.16, 0, 1);
            const walkP = clamp((p - 0.12) / 0.88, 0, 1);
            const stepped = computeSteppedProgress(walkP, WALK_STEPS);

            this.walkDir = -1;
            this.gaitTheta = walkP * WALK_STEPS * Math.PI;

            targetDepth = lerp(1.0, 0.06, stepped);
            targetStand = 1;
            targetPosX = lerp(this.walkStartX, seatedX + 0.04, stepped);
            // Smoothly turns LEFT (-0.88) to walk back — NO backward moonwalking!
            targetProfileDir = lerp(0.0, -0.88, easeInOutSine(turnT));
            targetWalkEnv = walkP > 0 ? Math.pow(Math.sin(walkP * Math.PI), 0.55) : 0;
            targetShoulderRoll = -Math.sin(this.gaitTheta) * 0.065 * targetWalkEnv;
            targetBookHold = 0;
        } else if (mode === 'sit-down') {
            // Pivot cleanly from facing left (-0.88) -> facing right (+1.0 toward desk), then sink onto chair!
            const pivotT = clamp(p / 0.38, 0, 1);
            const sinkT = clamp((p - 0.22) / 0.78, 0, 1);
            const sit = easeInOutCubic(sinkT);

            targetDepth = lerp(0.06, 0, sit);
            targetStand = 1 - sit;
            targetProfileDir = lerp(-0.88, 1.0, easeInOutSine(pivotT));
            targetPosX = lerp(seatedX + 0.04, seatedX, easeInOutSine(p));
            targetSitStandLean = Math.sin(sinkT * Math.PI) * 0.88;
            targetBookHold = p > 0.76 && this.idleActivity === 'reading' ? (p - 0.76) / 0.24 : 0;
        }

        const isDirectPhase =
            mode === 'stand-up' || mode === 'walk-forward' || mode === 'walk-back' || mode === 'sit-down';

        this.depth = damp(this.depth, targetDepth, isDirectPhase ? 16 : 6, dt);
        this.standAmount = damp(this.standAmount, targetStand, isDirectPhase ? 14 : 6, dt);
        this.profileDir = damp(this.profileDir, targetProfileDir, 8.5, dt);
        this.posOffsetX = damp(this.posOffsetX, targetPosX, isDirectPhase ? 16 : 3.6, dt);
        this.walkEnvelope = damp(this.walkEnvelope, targetWalkEnv, 11, dt);
        this.shoulderRoll = damp(this.shoulderRoll, targetShoulderRoll, 10, dt);
        this.sitStandLean = damp(this.sitStandLean, targetSitStandLean, 8.5, dt);
        this.bookHoldBlend = damp(this.bookHoldBlend, targetBookHold, 6.5, dt);
        this.crouchOffset = damp(this.crouchOffset, targetCrouch, 4.2, dt);

        const g = this.computeBodyGeometry();
        const layout = g.layout;

        if (!this.leftHand.initialized) {
            this.leftHand.x = layout.deskLeftX + 28 * g.s;
            this.leftHand.y = layout.deskY - 3 * g.s;
            this.leftHand.initialized = true;
        }
        if (!this.rightHand.initialized) {
            this.rightHand.x = layout.deskLeftX + 64 * g.s;
            this.rightHand.y = layout.deskY - 4 * g.s;
            this.rightHand.initialized = true;
        }

        // --- Natural Hand, Shoulder, & Head Targets ---
        let targetLeftX = g.leftShoulderX - 22 * g.pScale;
        let targetLeftY = g.shoulderY + 146 * g.pScale;
        let targetLeftAngle = 0;

        let targetRightX = g.rightShoulderX + 22 * g.pScale;
        let targetRightY = g.shoulderY + 146 * g.pScale;
        let targetRightAngle = -0.6;

        let targetLeanX = 0;
        let targetHeadTilt = 0;
        let targetHeadNod = 0;
        let targetLeftLift = 0;
        let targetRightLift = 0;

        const deskY = layout.deskY;
        const paperX = layout.deskLeftX + 54 * g.s;

        if (mode === 'seated' || mode === 'put-down' || (mode === 'sit-down' && this.standAmount < 0.35)) {
            if (mode === 'put-down') {
                targetLeftX = paperX - 28 * g.s;
                targetLeftY = deskY - 2 * g.s;
                targetRightX = paperX + 10 * g.s;
                targetRightY = deskY - 2 * g.s;
                targetHeadTilt = 0.14;
                targetHeadNod = 3 * g.pScale;
            } else if (this.idleActivity === 'reading') {
                const bx = paperX - 4 * g.s;
                const by = deskY - 22 * g.s + Math.sin(this.time * 1.15) * 1.8 * g.pScale;

                targetLeftX = lerp(paperX - 26 * g.s, bx - 18 * g.s, this.bookHoldBlend);
                targetLeftY = lerp(deskY - 2 * g.s, by + 6 * g.s, this.bookHoldBlend);
                targetRightX = lerp(paperX + 12 * g.s, bx + 20 * g.s, this.bookHoldBlend);
                targetRightY = lerp(deskY - 2 * g.s, by + 4 * g.s, this.bookHoldBlend);

                targetHeadTilt = lerp(0.10, 0.27 + Math.sin(this.time * 0.6) * 0.03, this.bookHoldBlend);
                targetHeadNod = lerp(3, 9, this.bookHoldBlend) * g.pScale;

                if (mode === 'seated') {
                    if (this.pageTurnProgress < 0) {
                        this.pageTurnTimer -= dt;
                        if (this.pageTurnTimer <= 0) this.pageTurnProgress = 0;
                    } else {
                        this.pageTurnProgress += dt / 1.35;
                        const pt = clamp(this.pageTurnProgress, 0, 1);
                        const arc = Math.sin(pt * Math.PI);
                        if (pt < 0.66) {
                            const p1 = easeInOutSine(pt / 0.66);
                            targetRightX = lerp(bx + 22 * g.s, bx - 16 * g.s, p1);
                            targetRightY = by + 2 * g.s - arc * 28 * g.s;
                        } else {
                            const p2 = easeInOutSine((pt - 0.66) / 0.34);
                            targetRightX = lerp(bx - 16 * g.s, bx + 20 * g.s, p2);
                            targetRightY = by + 4 * g.s - Math.sin(p2 * Math.PI) * 10 * g.s;
                        }
                        if (this.pageTurnProgress >= 1) {
                            this.pageTurnProgress = -1;
                            this.pageTurnTimer = 4.6 + Math.random() * 4.2;
                        }
                    }
                }
            } else if (this.idleActivity === 'weary') {
                const sigh = Math.sin(this.time * 0.85);
                targetLeftX = paperX - 18 * g.s;
                targetLeftY = deskY - 2 * g.s;
                targetRightX = g.headX + 12 * g.pScale;
                targetRightY = g.headY + 6 * g.pScale + sigh * 2 * g.pScale;
                targetHeadTilt = 0.34 + sigh * 0.04;
                targetHeadNod = (14 + sigh * 2.5) * g.pScale;
            } else {
                this.writePhase += dt;
                targetLeftX = paperX - 28 * g.s;
                targetLeftY = deskY - 2 * g.s;

                const cycle = this.writePhase % 8.2;
                const isFatiguedPause = cycle > 6.0;
                if (isFatiguedPause) {
                    const pt = (cycle - 6.0) / 2.2;
                    targetRightX = paperX + 14 * g.s;
                    targetRightY = deskY - 10 * g.s - Math.sin(pt * Math.PI) * 7 * g.s;
                    targetHeadTilt = 0.14;
                    targetHeadNod = 3 * g.pScale;
                } else {
                    const lineP = (cycle * 0.48) % 1;
                    const sweep = lerp(-14, 30, easeInOutSine(lineP)) * g.s;
                    const microX = Math.sin(this.writePhase * 13) * 2.2 * g.s;
                    const microY = Math.cos(this.writePhase * 17) * 1.7 * g.s;
                    targetRightX = paperX + sweep + microX;
                    targetRightY = deskY - 4 * g.s + microY;
                    targetHeadTilt = 0.30 + Math.sin(this.writePhase * 0.9) * 0.025;
                    targetHeadNod = 10 * g.pScale;
                }
            }
        } else if (isLeftWork) {
            let tx = d.targetX;
            let ty = d.targetY;

            if (mode === 'erasing') {
                const sweepFreq = 5.4;
                const perpX = Math.cos(d.handAngle);
                const perpY = Math.sin(d.handAngle);
                const alongX = Math.sin(d.handAngle);
                const alongY = -Math.cos(d.handAngle);

                const lateral = Math.sin(this.time * sweepFreq) * 18 * g.s;
                const longitudinal = Math.cos(this.time * sweepFreq) * 8 * g.s;
                tx += perpX * lateral + alongX * longitudinal;
                ty += perpY * lateral + alongY * longitudinal;

                this.traceTimer += dt;
                if (this.traceTimer >= 0.095) {
                    this.traceTimer = 0;
                    traces.addWipeSmudge(this.leftHand.x, this.leftHand.y, d.handAngle + Math.sin(this.time * sweepFreq) * 0.4, g.s);
                }
            }

            targetLeftX = tx;
            targetLeftY = ty;
            targetLeftAngle = d.handAngle + (mode === 'erasing' ? Math.sin(this.time * 5.4 - 0.5) * 0.35 : 0);

            const reachHigh = clamp((g.shoulderY - ty) / (radius * 0.78), 0, 1);
            targetLeftLift = reachHigh * 15 * g.pScale;

            targetRightX = g.rightShoulderX + 22 * g.pScale;
            targetRightY = g.shoulderY + 146 * g.pScale;

            const dx = tx - g.torsoTopX;
            const dy = ty - g.headY;
            targetLeanX = clamp(dx * 0.11, -24 * g.s, 24 * g.s);
            targetHeadTilt = clamp(dx / (radius * 2.5), -0.22, 0.22);
            targetHeadNod = clamp(dy * 0.03, -9 * g.s, 9 * g.s);
        } else if (isRightWork) {
            let tx = d.targetX;
            let ty = d.targetY;

            if (mode === 'painting') {
                const perpX = Math.cos(d.handAngle);
                const perpY = Math.sin(d.handAngle);
                const sway = Math.sin(this.time * 3.8) * 1.4 * g.s;
                tx += perpX * sway;
                ty += perpY * sway;

                this.traceTimer += dt;
                if (this.traceTimer >= 0.085) {
                    this.traceTimer = 0;
                    traces.addInkFleck(tx, ty, d.paintColor, g.s);
                }
            }

            const brushAngle = Math.atan2(g.rightShoulderY + 48 * g.pScale - ty, g.rightShoulderX - tx);
            targetRightAngle = brushAngle;
            const gripOffset = 22 * g.pScale;
            targetRightX = tx + Math.cos(brushAngle) * gripOffset;
            targetRightY = ty + Math.sin(brushAngle) * gripOffset;

            const reachHigh = clamp((g.shoulderY - ty) / (radius * 0.78), 0, 1);
            targetRightLift = reachHigh * 15 * g.pScale;

            targetLeftX = g.leftShoulderX - 22 * g.pScale;
            targetLeftY = g.shoulderY + 146 * g.pScale;

            const dx = tx - g.torsoTopX;
            const dy = ty - g.headY;
            targetLeanX = clamp(dx * 0.11, -24 * g.s, 24 * g.s);
            targetHeadTilt = clamp(dx / (radius * 2.5), -0.22, 0.22);
            targetHeadNod = clamp(dy * 0.03, -9 * g.s, 9 * g.s);
        } else if (mode === 'walk-forward' || mode === 'walk-back') {
            // NATURAL COUNTER-SWINGING ARMS (opposite the striding legs!)
            // Left leg is at gaitTheta, right leg at gaitTheta + PI ->
            // Left arm swings forward when right leg swings forward (-cos(gaitTheta))
            const swingVal = -Math.cos(this.gaitTheta) * this.walkEnvelope;
            const dir = this.walkDir;
            const swingAmp = 34 * g.pScale;

            // Left arm swings forward/back along walk direction with gentle arc lift
            const leftSwing = dir * swingVal * swingAmp;
            const rightSwing = -dir * swingVal * swingAmp;

            targetLeftX = g.leftShoulderX - 10 * g.pScale * (1 - Math.abs(this.profileDir)) + leftSwing;
            targetLeftY = g.shoulderY + 144 * g.pScale - Math.max(0, swingVal) * 14 * g.pScale;

            targetRightX = g.rightShoulderX + 10 * g.pScale * (1 - Math.abs(this.profileDir)) + rightSwing;
            targetRightY = g.shoulderY + 144 * g.pScale - Math.max(0, -swingVal) * 14 * g.pScale;

            // Slight weary forward head inclination during trudging steps
            targetHeadTilt = dir * 0.07 * this.walkEnvelope;
            targetHeadNod = 5 * g.pScale * this.walkEnvelope;
        } else {
            // Standing up / Admiring / Turning to sit
            targetLeftX = g.leftShoulderX - 18 * g.pScale;
            targetLeftY = g.shoulderY + 148 * g.pScale;
            targetRightX = g.rightShoulderX + 18 * g.pScale;
            targetRightY = g.shoulderY + 148 * g.pScale;
            targetHeadTilt = mode === 'admiring' ? 0.07 : 0;
            targetHeadNod = mode === 'admiring' ? 4 * g.pScale : 0;
        }

        const leftSpeed = mode === 'erasing' ? 11.5 : (mode === 'walk-forward' || mode === 'walk-back') ? 10.5 : 5.6;
        const rightSpeed = mode === 'painting' ? 13.5 : (mode === 'walk-forward' || mode === 'walk-back') ? 10.5 : 5.6;

        this.leftHand.x = damp(this.leftHand.x, targetLeftX, leftSpeed, dt);
        this.leftHand.y = damp(this.leftHand.y, targetLeftY, leftSpeed, dt);
        this.leftHand.angle = lerpAngle(this.leftHand.angle, targetLeftAngle, 1 - Math.exp(-8.5 * dt));

        this.rightHand.x = damp(this.rightHand.x, targetRightX, rightSpeed, dt);
        this.rightHand.y = damp(this.rightHand.y, targetRightY, rightSpeed, dt);
        this.rightHand.angle = lerpAngle(this.rightHand.angle, targetRightAngle, 1 - Math.exp(-9.0 * dt));

        // Solve pole-vector elbows & apply smooth inertia follow-through
        const leftSX = g.leftShoulderX + 4 * g.pScale;
        const leftSY = g.leftShoulderY + 12 * g.pScale;
        const rightSX = g.rightShoulderX - 4 * g.pScale;
        const rightSY = g.rightShoulderY + 12 * g.pScale;

        const isWalking = mode === 'walk-forward' || mode === 'walk-back';
        // When walking in profile, elbows naturally bend slightly BACKWARD (-walkDir) & DOWNWARD!
        const leftOut = isWalking
            ? -this.walkDir * 44 * g.pScale
            : this.standAmount > 0.45 ? -56 * g.pScale : -34 * g.pScale;
        const rightOut = isWalking
            ? -this.walkDir * 44 * g.pScale
            : this.standAmount > 0.45 ? 56 * g.pScale : -26 * g.pScale;

        const rawLeftIK = solvePoleIK(
            leftSX, leftSY, this.leftHand.x, this.leftHand.y,
            g.upperArmLen, g.foreArmLen,
            leftSX + leftOut, leftSY + 148 * g.pScale
        );

        const rightPoleX = mode === 'seated' && this.idleActivity === 'weary'
            ? paperX + 10 * g.s
            : rightSX + rightOut;
        const rightPoleY = mode === 'seated' && this.idleActivity === 'weary'
            ? deskY - 2 * g.s
            : rightSY + 148 * g.pScale;

        const rawRightIK = solvePoleIK(
            rightSX, rightSY, this.rightHand.x, this.rightHand.y,
            g.upperArmLen, g.foreArmLen,
            rightPoleX, rightPoleY
        );

        if (!this.leftElbow.initialized) {
            this.leftElbow.x = rawLeftIK.elbowX;
            this.leftElbow.y = rawLeftIK.elbowY;
            this.leftElbow.initialized = true;
        }
        if (!this.rightElbow.initialized) {
            this.rightElbow.x = rawRightIK.elbowX;
            this.rightElbow.y = rawRightIK.elbowY;
            this.rightElbow.initialized = true;
        }

        this.leftElbow.x = damp(this.leftElbow.x, rawLeftIK.elbowX, 9.5, dt);
        this.leftElbow.y = damp(this.leftElbow.y, rawLeftIK.elbowY, 9.5, dt);
        this.rightElbow.x = damp(this.rightElbow.x, rawRightIK.elbowX, 9.5, dt);
        this.rightElbow.y = damp(this.rightElbow.y, rawRightIK.elbowY, 9.5, dt);

        this.leanX = damp(this.leanX, targetLeanX, 3.8, dt);
        this.headTilt = damp(this.headTilt, targetHeadTilt, 4.5, dt);
        this.headNod = damp(this.headNod, targetHeadNod, 4.5, dt);
        this.leftShoulderLift = damp(this.leftShoulderLift, targetLeftLift, 5.5, dt);
        this.rightShoulderLift = damp(this.rightShoulderLift, targetRightLift, 5.5, dt);
    }

    /**
     * PERMANENT CELL INTERIOR: concrete room corners, floor plane, chair, heavy desk,
     * eternal gooseneck lamp, books & mug. NEVER fades, pops, or moves!
     */
    drawPermanentCellRoom(ctx) {
        const layout = this.getCellLayout();
        const s = layout.s;

        // 1. Recessed concrete walls & floor plane
        ctx.save();
        ctx.filter = `blur(${(15 * s).toFixed(1)}px)`;
        ctx.fillStyle = 'rgba(12, 15, 18, 0.16)';
        ctx.fillRect(centerX - radius, centerY - radius, radius * 0.42, radius * 2);
        ctx.fillStyle = 'rgba(12, 15, 18, 0.12)';
        ctx.fillRect(centerX + radius * 0.62, centerY - radius, radius * 0.45, radius * 2);
        ctx.fillStyle = 'rgba(10, 12, 16, 0.25)';
        ctx.fillRect(centerX - radius, layout.floorY - 4 * s, radius * 2, radius * 0.5);
        ctx.restore();

        // 2. Permanent Chair, Desk, & Eternally Lit Gooseneck Lamp
        ctx.save();
        ctx.filter = `blur(${(10.5 * s).toFixed(1)}px)`;
        ctx.fillStyle = 'rgba(14, 17, 21, 0.44)';

        const chairX = layout.seatX - 22 * s;
        const seatY = layout.seatY + 10 * s;

        ctx.beginPath();
        ctx.moveTo(chairX - 18 * s, seatY - 68 * s);
        ctx.quadraticCurveTo(chairX - 9 * s, seatY - 70 * s, chairX - 6 * s, seatY - 6 * s);
        ctx.lineTo(chairX + 44 * s, seatY - 5 * s);
        ctx.quadraticCurveTo(chairX + 49 * s, seatY + 2 * s, chairX + 42 * s, seatY + 9 * s);
        ctx.lineTo(chairX - 16 * s, seatY + 9 * s);
        ctx.quadraticCurveTo(chairX - 26 * s, seatY - 30 * s, chairX - 18 * s, seatY - 68 * s);
        ctx.closePath();
        ctx.fill();

        drawTaperedBar(ctx, chairX - 8 * s, seatY + 8 * s, chairX - 14 * s, layout.floorY, 4.2 * s, 2.5 * s);
        drawTaperedBar(ctx, chairX + 36 * s, seatY + 8 * s, chairX + 40 * s, layout.floorY, 4.2 * s, 2.5 * s);

        // Desk
        ctx.beginPath();
        ctx.roundRect(layout.deskLeftX, layout.deskY, layout.deskRightX - layout.deskLeftX, 11 * s, 3 * s);
        ctx.fill();
        drawTaperedBar(ctx, layout.deskLeftX + 16 * s, layout.deskY + 9 * s, layout.deskLeftX + 13 * s, layout.floorY, 4.8 * s, 3.2 * s);
        drawTaperedBar(ctx, layout.deskRightX - 26 * s, layout.deskY + 9 * s, layout.deskRightX - 23 * s, layout.floorY, 4.8 * s, 3.2 * s);

        // Books & mug
        ctx.beginPath();
        ctx.roundRect(layout.deskLeftX + 148 * s, layout.deskY - 14 * s, 30 * s, 14 * s, 2 * s);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(layout.deskLeftX + 94 * s, layout.deskY - 11 * s, 10 * s, 11 * s, 2 * s);
        ctx.fill();

        // Permanent Gooseneck Lamp
        const lx = layout.lampBaseX;
        const ly = layout.deskY;
        ctx.beginPath();
        ctx.roundRect(lx - 11 * s, ly - 5 * s, 24 * s, 6 * s, 3 * s);
        ctx.fill();
        drawTaperedBar(ctx, lx, ly - 4 * s, lx + 16 * s, ly - 48 * s, 3.2 * s, 2.4 * s);
        drawTaperedBar(ctx, lx + 16 * s, ly - 48 * s, lx - 6 * s, ly - 76 * s, 2.6 * s, 2.0 * s);
        ctx.beginPath();
        ctx.moveTo(lx - 4 * s, ly - 80 * s);
        ctx.lineTo(lx - 31 * s, ly - 63 * s);
        ctx.lineTo(lx - 6 * s, ly - 53 * s);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    /**
     * Sculpted human head silhouette supporting seamless signed turning:
     * profileDir > 0 faces right, profileDir < 0 faces left, 0 is perfectly symmetric front/back!
     */
    drawSculptedHead(ctx, g) {
        const rx = g.headRx;
        const ry = g.headRy;
        const absP = Math.abs(this.profileDir);
        const flipX = this.profileDir < 0 ? -1 : 1;

        ctx.save();
        ctx.translate(g.headX, g.headY);
        ctx.rotate(this.headTilt);
        ctx.scale(flipX, 1);

        drawTaperedBar(ctx, 0, ry * 0.52, -absP * 3 * g.pScale, ry * 1.48, rx * 0.44, rx * 0.64);

        // Symmetric at absP=0 so crossing 0 when turning left<->right has zero pop!
        ctx.beginPath();
        ctx.moveTo(0, -ry);
        ctx.bezierCurveTo(
            rx * (0.95 + absP * 0.10), -ry * 0.92,
            rx * (1.00 + absP * 0.16), -ry * 0.25,
            rx * (0.96 + absP * 0.22), ry * 0.04
        );
        ctx.bezierCurveTo(
            rx * (0.94 + absP * 0.12), ry * 0.48,
            rx * (0.64 + absP * 0.16), ry * 0.94,
            rx * (absP * 0.18), ry * 1.02
        );
        ctx.bezierCurveTo(
            -rx * (0.64 + absP * 0.04), ry * 0.94,
            -rx * (0.94 + absP * 0.14), ry * 0.48,
            -rx * (0.96 + absP * 0.16), ry * 0.04
        );
        ctx.bezierCurveTo(
            -rx * (1.00 + absP * 0.12), -ry * 0.25,
            -rx * (0.95 + absP * 0.06), -ry * 0.92,
            0, -ry
        );
        ctx.closePath();
        ctx.fill();

        // Soft tousled hair volume at back of crown
        ctx.beginPath();
        ctx.ellipse(
            -rx * (absP * 0.30),
            -ry * 0.22,
            rx * 0.94,
            ry * 0.78,
            -0.18 * absP,
            0,
            Math.PI * 2
        );
        ctx.fill();

        ctx.restore();
    }

    drawBookSilhouette(ctx, g) {
        if (this.bookHoldBlend < 0.08) return;
        const bx = (this.leftHand.x + this.rightHand.x) * 0.5 + 6 * g.pScale;
        const by = (this.leftHand.y + this.rightHand.y) * 0.5 - 5 * g.pScale;
        const bw = 62 * g.pScale;
        const bh = 36 * g.pScale;

        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(-0.14);

        ctx.beginPath();
        ctx.moveTo(-bw * 0.52, -bh * 0.14);
        ctx.quadraticCurveTo(-bw * 0.24, -bh * 0.46, 0, -bh * 0.06);
        ctx.quadraticCurveTo(bw * 0.26, -bh * 0.48, bw * 0.55, -bh * 0.10);
        ctx.lineTo(bw * 0.46, bh * 0.52);
        ctx.quadraticCurveTo(bw * 0.22, bh * 0.28, 0, bh * 0.54);
        ctx.quadraticCurveTo(-bw * 0.24, bh * 0.28, -bw * 0.45, bh * 0.52);
        ctx.closePath();
        ctx.fill();

        if (this.pageTurnProgress >= 0 && this.pageTurnProgress <= 0.72) {
            const pt = clamp(this.pageTurnProgress / 0.72, 0, 1);
            const flipAngle = lerp(0.45, -2.55, easeInOutSine(pt));
            const pageLen = bw * 0.48;
            const px = Math.cos(flipAngle) * pageLen;
            const py = Math.sin(flipAngle) * pageLen * 0.75;

            ctx.beginPath();
            ctx.moveTo(0, -bh * 0.06);
            ctx.quadraticCurveTo(px * 0.55, py - 14 * g.pScale, px, py);
            ctx.lineTo(px * 0.84, py + bh * 0.44);
            ctx.lineTo(0, bh * 0.42);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    drawClothTool(ctx, x, y, angle, scale) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        const w = 32 * scale;
        const h = 22 * scale;
        ctx.beginPath();
        ctx.moveTo(-w * 0.5, -h * 0.30);
        ctx.quadraticCurveTo(0, -h * 0.62, w * 0.52, -h * 0.24);
        ctx.quadraticCurveTo(w * 0.60, h * 0.36, w * 0.36, h * 0.50);
        ctx.quadraticCurveTo(-w * 0.10, h * 0.64, -w * 0.48, h * 0.32);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    drawInkBrushTool(ctx, tipX, tipY, angle, scale) {
        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(angle);
        const len = 54 * scale;
        const w = 3.5 * scale;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.14, -w * 1.15, len * 0.25, -w * 0.72);
        ctx.lineTo(len, -w * 0.42);
        ctx.lineTo(len, w * 0.42);
        ctx.lineTo(len * 0.25, w * 0.72);
        ctx.quadraticCurveTo(len * 0.14, w * 1.15, 0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    draw(ctx) {
        const g = this.computeBodyGeometry();
        const mode = this.directive.mode;

        const bodyBlur = lerp(11.0, 3.2, easeInOutSine(this.depth)) * g.s;
        const bodyOpacity = lerp(0.50, 0.82, easeInOutSine(this.depth));

        // --- 1. Compute Exact Seated-to-Walking Leg Positions ---
        const stand = easeInOutCubic(this.standAmount);
        const absProf = Math.abs(this.profileDir);
        const hipSpread = lerp(19, 8, absProf) * g.pScale;

        const leftHipX = g.baseX - hipSpread;
        const rightHipX = g.baseX + hipSpread;
        const hipAnchorY = g.hipY + 4 * g.pScale;

        // Seated legs (facing right toward desk)
        const seatKneeX = g.baseX + 74 * g.pScale;
        const seatKneeY = g.hipY + 8 * g.pScale;
        const seatAnkleX = seatKneeX + 6 * g.pScale;
        const seatAnkleY = g.floorY - 8 * g.pScale;

        // Real bipedal walking legs (stance foot planted on floor, swing foot lifted + knee bent!)
        const walkLeft = this.computeWalkingLeg(
            this.gaitTheta,
            leftHipX,
            hipAnchorY,
            g.floorY,
            g.pScale,
            g.thighLen,
            g.calfLen
        );
        const walkRight = this.computeWalkingLeg(
            this.gaitTheta + Math.PI,
            rightHipX,
            hipAnchorY,
            g.floorY,
            g.pScale,
            g.thighLen,
            g.calfLen
        );

        const leftLeg = {
            hipX: lerp(g.baseX - 4 * g.pScale, walkLeft.hipX, stand),
            hipY: hipAnchorY,
            kneeX: lerp(seatKneeX - 10 * g.pScale, walkLeft.kneeX, stand),
            kneeY: lerp(seatKneeY + 5 * g.pScale, walkLeft.kneeY, stand),
            ankleX: lerp(seatAnkleX - 12 * g.pScale, walkLeft.ankleX, stand),
            ankleY: lerp(seatAnkleY, walkLeft.ankleY, stand),
            footLiftY: lerp(0, walkLeft.footLiftY, stand),
            footTilt: lerp(0, walkLeft.footTilt, stand)
        };

        const rightLeg = {
            hipX: lerp(g.baseX + 4 * g.pScale, walkRight.hipX, stand),
            hipY: hipAnchorY,
            kneeX: lerp(seatKneeX + 4 * g.pScale, walkRight.kneeX, stand),
            kneeY: lerp(seatKneeY, walkRight.kneeY, stand),
            ankleX: lerp(seatAnkleX + 4 * g.pScale, walkRight.ankleX, stand),
            ankleY: lerp(seatAnkleY, walkRight.ankleY, stand),
            footLiftY: lerp(0, walkRight.footLiftY, stand),
            footTilt: lerp(0, walkRight.footTilt, stand)
        };

        const footFacingSign = this.standAmount < 0.3 ? 1 : (this.profileDir < -0.05 ? -1 : 1);

        // --- 2. Ground Contact Shadows Under Feet (Anchors Every Footstep to the Cell Floor!) ---
        if (this.depth < 0.85) {
            ctx.save();
            ctx.filter = `blur(${(bodyBlur * 0.85).toFixed(1)}px)`;
            const drawFloorShadow = (leg) => {
                const liftFactor = clamp(1 - leg.footLiftY / (28 * g.pScale), 0.18, 1);
                const shadowAlpha = 0.34 * liftFactor * (1 - clamp((this.depth - 0.55) / 0.3, 0, 1));
                ctx.fillStyle = `rgba(8, 10, 13, ${shadowAlpha.toFixed(3)})`;
                ctx.beginPath();
                ctx.ellipse(
                    leg.ankleX + footFacingSign * 6 * g.pScale,
                    g.floorY + 2 * g.pScale,
                    (22 + (1 - liftFactor) * 8) * g.pScale,
                    5.5 * g.pScale,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            };
            drawFloorShadow(leftLeg);
            drawFloorShadow(rightLeg);
            ctx.restore();
        }

        // --- 3. Main Blurred Silhouette Body ---
        ctx.save();
        ctx.filter = `blur(${bodyBlur.toFixed(1)}px)`;
        ctx.fillStyle = `rgba(12, 15, 19, ${bodyOpacity.toFixed(3)})`;

        const legRadii = [21 * g.pScale, 17.5 * g.pScale, 14 * g.pScale, 12.2 * g.pScale, 8.2 * g.pScale];

        // Back leg + foot
        drawContinuousLimb(
            ctx,
            leftLeg.hipX, leftLeg.hipY,
            leftLeg.kneeX, leftLeg.kneeY,
            leftLeg.ankleX, leftLeg.ankleY,
            legRadii,
            0.42 // crisp anatomical knee bend during stride!
        );
        drawFootSilhouette(ctx, leftLeg.ankleX, leftLeg.ankleY, leftLeg.footTilt, footFacingSign, g.pScale);

        // Front leg + foot
        drawContinuousLimb(
            ctx,
            rightLeg.hipX, rightLeg.hipY,
            rightLeg.kneeX, rightLeg.kneeY,
            rightLeg.ankleX, rightLeg.ankleY,
            legRadii,
            0.42
        );
        drawFootSilhouette(ctx, rightLeg.ankleX, rightLeg.ankleY, rightLeg.footTilt, footFacingSign, g.pScale);

        // --- 4. Draped Weary Coat / Tunic Torso Silhouette ---
        const hipHalfW = lerp(30, 42, stand) * lerp(1, 0.72, absProf) * g.pScale;
        const coatHemY = g.hipY + lerp(20, 42, stand) * g.pScale;
        const waistX = lerp(g.baseX, g.torsoTopX, 0.45);
        const waistY = lerp(g.hipY, g.shoulderY, 0.42);
        const waistHalfW = lerp(24, 33, stand) * lerp(1, 0.72, absProf) * g.pScale;

        ctx.beginPath();
        ctx.moveTo(g.leftShoulderX, g.leftShoulderY + 4 * g.pScale);
        ctx.quadraticCurveTo(
            g.torsoTopX,
            Math.min(g.leftShoulderY, g.rightShoulderY) - 18 * g.pScale,
            g.rightShoulderX,
            g.rightShoulderY + 4 * g.pScale
        );
        ctx.bezierCurveTo(
            g.rightShoulderX + 6 * g.pScale, (g.rightShoulderY + waistY) * 0.5,
            waistX + waistHalfW, waistY,
            g.baseX + hipHalfW, coatHemY
        );
        ctx.quadraticCurveTo(g.baseX, coatHemY + 6 * g.pScale, g.baseX - hipHalfW, coatHemY);
        ctx.bezierCurveTo(
            waistX - waistHalfW, waistY,
            g.leftShoulderX - 6 * g.pScale, (g.leftShoulderY + waistY) * 0.5,
            g.leftShoulderX, g.leftShoulderY + 4 * g.pScale
        );
        ctx.closePath();
        ctx.fill();

        // --- 5. Sculpted Head & Neck ---
        this.drawSculptedHead(ctx, g);

        // --- 6. Continuous Fluid Sleeved Arms (Smoothed Elbows) ---
        const isErasingActive = mode === 'approach-erase' || mode === 'erasing';
        const isPaintingActive = mode === 'approach-paint' || mode === 'painting';

        const armRadii = [
            16.5 * g.pScale,
            13.8 * g.pScale,
            11.8 * g.pScale,
            9.8 * g.pScale,
            5.8 * g.pScale
        ];

        const leftSX = g.leftShoulderX + 4 * g.pScale;
        const leftSY = g.leftShoulderY + 12 * g.pScale;
        drawContinuousLimb(
            ctx,
            leftSX, leftSY,
            this.leftElbow.x, this.leftElbow.y,
            this.leftHand.x, this.leftHand.y,
            armRadii,
            0.58
        );
        drawOrganicHand(
            ctx,
            this.leftHand.x,
            this.leftHand.y,
            Math.atan2(this.leftHand.y - this.leftElbow.y, this.leftHand.x - this.leftElbow.x),
            g.pScale,
            !isErasingActive
        );

        const rightSX = g.rightShoulderX - 4 * g.pScale;
        const rightSY = g.rightShoulderY + 12 * g.pScale;
        drawContinuousLimb(
            ctx,
            rightSX, rightSY,
            this.rightElbow.x, this.rightElbow.y,
            this.rightHand.x, this.rightHand.y,
            armRadii,
            0.58
        );
        drawOrganicHand(
            ctx,
            this.rightHand.x,
            this.rightHand.y,
            Math.atan2(this.rightHand.y - this.rightElbow.y, this.rightHand.x - this.rightElbow.x),
            g.pScale,
            !isPaintingActive
        );

        // --- 7. Seated Props at Desk (Book or Pen) ---
        if (this.standAmount < 0.35) {
            if (this.idleActivity === 'reading') {
                this.drawBookSilhouette(ctx, g);
            } else if (this.idleActivity === 'writing') {
                this.drawInkBrushTool(ctx, this.rightHand.x, this.rightHand.y, -0.78, g.pScale * 0.78);
            }
        }

        ctx.restore();

        // --- 8. Glass-Contact Focused Shadow Layer ---
        const isTouchingErase = isErasingActive && this.depth > 0.72;
        const isTouchingPaint = isPaintingActive && this.depth > 0.72;

        if (isTouchingErase || isTouchingPaint) {
            const contactAlpha = clamp((this.depth - 0.72) / 0.28, 0, 1) * 0.88;
            ctx.save();
            ctx.filter = `blur(${(1.0 * g.s).toFixed(1)}px)`;
            ctx.fillStyle = `rgba(12, 15, 19, ${contactAlpha.toFixed(3)})`;

            if (isTouchingErase) {
                this.drawClothTool(ctx, this.leftHand.x, this.leftHand.y, this.leftHand.angle, g.s);
                drawOrganicHand(ctx, this.leftHand.x, this.leftHand.y, this.leftHand.angle + Math.PI * 0.5, g.s * 0.86, false);
            } else {
                const gripOffset = 22 * g.pScale;
                const tipX = this.rightHand.x - Math.cos(this.rightHand.angle) * gripOffset;
                const tipY = this.rightHand.y - Math.sin(this.rightHand.angle) * gripOffset;
                this.drawInkBrushTool(ctx, tipX, tipY, this.rightHand.angle, g.s);
                drawOrganicHand(ctx, this.rightHand.x, this.rightHand.y, this.rightHand.angle + Math.PI, g.s * 0.86, false);
            }
            ctx.restore();
        }
    }
}

// --- Multi-Stage Choreography Director ---
const hourHand = new InkHand('hour', 0.50, 8.8, CONFIG.handColors.hour);
const minuteHand = new InkHand('minute', 0.74, 5.4, CONFIG.handColors.minute);
const keeper = new CaptiveTimekeeper();
const traces = new GlassTraceSystem();

const taskQueue = [];
let activeTask = null;
let lastTrackedMinute = -1;
let lastTrackedHour = -1;
let scheduledEraseForMinute = -1;
let scheduledEraseForHour = -1;
let demoRunning = false;
let completedWorkSessions = 0;

function getMinuteAngle(m) {
    return m * ((Math.PI * 2) / 60);
}

function getHourAngle(h, m) {
    return ((h % 12) + m / 60) * ((Math.PI * 2) / 12);
}

function enqueueTask(task) {
    taskQueue.push({ elapsed: 0, ...task });
}

function enqueueApproachSequence(targetHand) {
    enqueueTask({ type: 'put-down', hand: targetHand, duration: CONFIG.putDownDuration });
    enqueueTask({ type: 'stand-up', hand: targetHand, duration: CONFIG.standUpDuration });
    enqueueTask({ type: 'walk-forward', hand: targetHand, duration: CONFIG.walkForwardDuration });
}

function enqueueRetreatSequence(onDone) {
    enqueueTask({ type: 'admire', duration: CONFIG.admireDuration });
    enqueueTask({ type: 'walk-back', duration: CONFIG.walkBackDuration });
    enqueueTask({
        type: 'sit-down',
        duration: CONFIG.sitDownDuration,
        onComplete: () => {
            completedWorkSessions++;
            keeper.setIdleActivity(IDLE_ACTIVITIES[completedWorkSessions % IDLE_ACTIVITIES.length]);
            syncActivityButtonLabel();
            if (typeof onDone === 'function') onDone();
        }
    });
}

function syncActivityButtonLabel() {
    if (!activityBtn) return;
    activityBtn.textContent = IDLE_LABELS[keeper.idleActivity];
}

function startIntroSequence() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();

    lastTrackedMinute = m;
    lastTrackedHour = h;

    hourHand.progress = 1;
    hourHand.generateStrokes(getHourAngle(h, m));
    minuteHand.progress = 0;
    minuteHand.generateStrokes(getMinuteAngle(m));

    taskQueue.length = 0;
    activeTask = null;

    enqueueTask({ type: 'seated-wait', duration: 1200 });
    enqueueApproachSequence(minuteHand);
    enqueueTask({
        type: 'paint',
        hand: minuteHand,
        targetAngle: getMinuteAngle(m),
        prepareDuration: CONFIG.prepareDuration,
        duration: 2400
    });
    enqueueRetreatSequence();
}

function triggerDemoPreview() {
    if (demoRunning) return;
    demoRunning = true;

    const now = new Date();
    const m = now.getMinutes();
    const currentAngle = minuteHand.angle || getMinuteAngle(m);
    const nextPreviewAngle = currentAngle + (Math.PI * 2) / 60;

    taskQueue.length = 0;
    activeTask = null;

    if (keeper.depth < 0.75) {
        enqueueApproachSequence(minuteHand);
    }
    enqueueTask({
        type: 'erase',
        hand: minuteHand,
        prepareDuration: CONFIG.prepareDuration,
        duration: 2400
    });
    enqueueTask({
        type: 'paint',
        hand: minuteHand,
        targetAngle: nextPreviewAngle,
        prepareDuration: CONFIG.prepareDuration,
        duration: 2400
    });
    enqueueRetreatSequence(() => {
        const realNow = new Date();
        lastTrackedMinute = realNow.getMinutes();
        lastTrackedHour = realNow.getHours();
        hourHand.angle = getHourAngle(lastTrackedHour, lastTrackedMinute);
        demoRunning = false;
    });
}

if (demoBtn) {
    demoBtn.addEventListener('click', triggerDemoPreview);
}

if (activityBtn) {
    activityBtn.addEventListener('click', () => {
        keeper.cycleIdleActivity();
        syncActivityButtonLabel();
    });
}

function scheduleClockUpdates(now) {
    if (demoRunning) return;

    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    const ms = now.getMilliseconds();
    const sWithMs = s + ms / 1000;

    const approachTotalMs = CONFIG.putDownDuration + CONFIG.standUpDuration + CONFIG.walkForwardDuration;
    const totalLeadMs = approachTotalMs + CONFIG.prepareDuration + CONFIG.eraseDuration;
    const eraseLeadSec = Math.min(26, totalLeadMs / 1000);
    const eraseStartSec = 60 - eraseLeadSec;

    if (sWithMs >= eraseStartSec && scheduledEraseForMinute !== m && !activeTask && taskQueue.length === 0) {
        scheduledEraseForMinute = m;
        const remainingMs = Math.max(4200, (60 - sWithMs) * 1000);
        const scaleRatio = Math.min(1, remainingMs / totalLeadMs);

        enqueueTask({ type: 'put-down', hand: minuteHand, duration: CONFIG.putDownDuration * scaleRatio });
        enqueueTask({ type: 'stand-up', hand: minuteHand, duration: CONFIG.standUpDuration * scaleRatio });
        enqueueTask({ type: 'walk-forward', hand: minuteHand, duration: CONFIG.walkForwardDuration * scaleRatio });
        enqueueTask({
            type: 'erase',
            hand: minuteHand,
            prepareDuration: CONFIG.prepareDuration * scaleRatio,
            duration: Math.max(1200, CONFIG.eraseDuration * scaleRatio)
        });

        if (m === 59 && scheduledEraseForHour !== h) {
            scheduledEraseForHour = h;
            enqueueTask({
                type: 'erase',
                hand: hourHand,
                prepareDuration: 500,
                duration: Math.min(2400, CONFIG.eraseDuration * 0.65)
            });
        }
    }

    if (m !== lastTrackedMinute) {
        if (keeper.depth < 0.7 && !activeTask && taskQueue.length === 0) {
            enqueueApproachSequence(minuteHand);
        }

        if (minuteHand.progress > 0.05 && scheduledEraseForMinute !== lastTrackedMinute) {
            enqueueTask({
                type: 'erase',
                hand: minuteHand,
                prepareDuration: CONFIG.prepareDuration,
                duration: Math.min(2600, CONFIG.eraseDuration)
            });
        }

        enqueueTask({
            type: 'paint',
            hand: minuteHand,
            targetAngle: getMinuteAngle(m),
            prepareDuration: CONFIG.prepareDuration,
            duration: CONFIG.paintDuration
        });

        if (h !== lastTrackedHour || m % 15 === 0) {
            if (hourHand.progress > 0.05 && scheduledEraseForHour !== lastTrackedHour) {
                enqueueTask({
                    type: 'erase',
                    hand: hourHand,
                    prepareDuration: 550,
                    duration: Math.min(2400, CONFIG.eraseDuration * 0.68)
                });
            }
            enqueueTask({
                type: 'paint',
                hand: hourHand,
                targetAngle: getHourAngle(h, m),
                prepareDuration: 550,
                duration: Math.min(2600, CONFIG.paintDuration * 0.72)
            });
            lastTrackedHour = h;
        }

        enqueueRetreatSequence();
        lastTrackedMinute = m;
    }
}

function updateTasks(dt) {
    if (!activeTask && taskQueue.length > 0) {
        activeTask = taskQueue.shift();
        activeTask.elapsed = 0;
        activeTask.phase = (activeTask.type === 'erase' || activeTask.type === 'paint') ? 'prepare' : 'run';

        if (activeTask.type === 'paint') {
            activeTask.hand.progress = 0;
            activeTask.hand.generateStrokes(activeTask.targetAngle);
        }
    }

    if (!activeTask) {
        keeper.directive.mode = 'seated';
        keeper.directive.phaseProgress = 0;
        return;
    }

    activeTask.elapsed += dt * 1000;
    const hand = activeTask.hand;

    if (activeTask.type === 'seated-wait') {
        const p = clamp(activeTask.elapsed / activeTask.duration, 0, 1);
        keeper.directive.mode = 'seated';
        keeper.directive.phaseProgress = p;
        if (p >= 1) finishActiveTask();
    } else if (
        activeTask.type === 'put-down' ||
        activeTask.type === 'stand-up' ||
        activeTask.type === 'walk-forward'
    ) {
        const p = clamp(activeTask.elapsed / activeTask.duration, 0, 1);
        const pt = hand ? hand.getPointAtProgress(hand.progress > 0.1 ? hand.progress : 0.55) : { x: centerX, y: centerY };
        keeper.directive.mode = activeTask.type;
        keeper.directive.phaseProgress = p;
        keeper.directive.targetX = pt.x;
        keeper.directive.targetY = pt.y;
        if (p >= 1) finishActiveTask();
    } else if (
        activeTask.type === 'admire' ||
        activeTask.type === 'walk-back' ||
        activeTask.type === 'sit-down'
    ) {
        const p = clamp(activeTask.elapsed / activeTask.duration, 0, 1);
        keeper.directive.mode = activeTask.type === 'admire' ? 'admiring' : activeTask.type;
        keeper.directive.phaseProgress = p;
        if (p >= 1) finishActiveTask();
    } else if (activeTask.type === 'erase' || activeTask.type === 'paint') {
        if (activeTask.phase === 'prepare') {
            const p = clamp(activeTask.elapsed / activeTask.prepareDuration, 0, 1);
            const startProg = activeTask.type === 'erase' ? hand.progress : 0;
            const pt = hand.getPointAtProgress(startProg);

            keeper.directive.mode = activeTask.type === 'erase' ? 'approach-erase' : 'approach-paint';
            keeper.directive.phaseProgress = p;
            keeper.directive.targetX = pt.x;
            keeper.directive.targetY = pt.y;
            keeper.directive.handAngle = hand.angle;
            keeper.directive.paintColor = hand.color;

            if (p >= 1) {
                activeTask.phase = 'work';
                activeTask.elapsed = 0;
            }
        } else {
            const rawT = clamp(activeTask.elapsed / activeTask.duration, 0, 1);
            const easedT = activeTask.type === 'erase' ? easeInOutSine(rawT) : easeInOutCubic(rawT);

            if (activeTask.type === 'erase') {
                hand.progress = 1 - easedT;
                const pt = hand.getPointAtProgress(hand.progress);
                keeper.directive.mode = 'erasing';
                keeper.directive.phaseProgress = rawT;
                keeper.directive.targetX = pt.x;
                keeper.directive.targetY = pt.y;
                keeper.directive.handAngle = hand.angle;
            } else {
                hand.progress = easedT;
                const pt = hand.getPointAtProgress(hand.progress);
                keeper.directive.mode = 'painting';
                keeper.directive.phaseProgress = rawT;
                keeper.directive.targetX = pt.x;
                keeper.directive.targetY = pt.y;
                keeper.directive.handAngle = hand.angle;
                keeper.directive.paintColor = hand.color;
            }

            if (rawT >= 1) {
                hand.progress = activeTask.type === 'erase' ? 0 : 1;
                finishActiveTask();
            }
        }
    }
}

function finishActiveTask() {
    const cb = activeTask && activeTask.onComplete;
    activeTask = null;
    if (typeof cb === 'function') cb();
}

// --- Somber 24/7 Confinement Frosted Glass & Eternal Desk Lamp Lighting ---
function drawCellFrostedBackdrop(ctx) {
    const layout = keeper.getCellLayout();
    const s = layout.s;

    const baseGrad = ctx.createRadialGradient(
        centerX + radius * 0.08,
        centerY + radius * 0.12,
        radius * 0.12,
        centerX,
        centerY,
        radius * 1.05
    );
    baseGrad.addColorStop(0, '#b5b8b2');
    baseGrad.addColorStop(0.55, '#959b99');
    baseGrad.addColorStop(0.86, '#767d7e');
    baseGrad.addColorStop(1, '#585f62');

    ctx.fillStyle = baseGrad;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    const bulbPulse = 1 + Math.sin(keeper.time * 2.3) * 0.015;
    const lx = layout.lampHeadX;
    const ly = layout.lampHeadY + 18 * s;

    const lampCore = ctx.createRadialGradient(lx, ly, 4 * s, lx, ly, radius * 0.42);
    lampCore.addColorStop(0, `rgba(255, 222, 162, ${(0.62 * bulbPulse).toFixed(3)})`);
    lampCore.addColorStop(0.45, `rgba(248, 202, 134, ${(0.28 * bulbPulse).toFixed(3)})`);
    lampCore.addColorStop(1, 'rgba(248, 202, 134, 0)');
    ctx.fillStyle = lampCore;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    const deskSpill = ctx.createRadialGradient(lx - 35 * s, layout.deskY - 12 * s, 10 * s, lx - 30 * s, layout.deskY, radius * 0.92);
    deskSpill.addColorStop(0, 'rgba(250, 208, 146, 0.30)');
    deskSpill.addColorStop(0.55, 'rgba(235, 194, 138, 0.10)');
    deskSpill.addColorStop(1, 'rgba(235, 194, 138, 0)');
    ctx.fillStyle = deskSpill;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
}

function drawFrostedGlassVeil(ctx) {
    ctx.save();

    ctx.fillStyle = 'rgba(188, 194, 192, 0.14)';
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    if (glassGrainPattern) {
        ctx.fillStyle = glassGrainPattern;
        ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
    }

    const vignette = ctx.createRadialGradient(centerX, centerY, radius * 0.54, centerX, centerY, radius);
    vignette.addColorStop(0, 'rgba(10, 12, 14, 0)');
    vignette.addColorStop(0.78, 'rgba(10, 12, 15, 0.14)');
    vignette.addColorStop(1, 'rgba(8, 10, 13, 0.48)');
    ctx.fillStyle = vignette;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    const spec = ctx.createLinearGradient(
        centerX - radius * 0.80,
        centerY - radius * 0.85,
        centerX + radius * 0.20,
        centerY + radius * 0.15
    );
    spec.addColorStop(0, 'rgba(230, 236, 238, 0.14)');
    spec.addColorStop(0.32, 'rgba(230, 236, 238, 0.03)');
    spec.addColorStop(1, 'rgba(230, 236, 238, 0)');
    ctx.fillStyle = spec;
    ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);

    ctx.restore();
}

function drawDialMarkings(ctx) {
    const s = radius / 272;
    ctx.save();
    ctx.translate(centerX, centerY);

    for (let i = 0; i < 60; i++) {
        const isMajor = i % 5 === 0;
        const a = i * ((Math.PI * 2) / 60);
        const outerR = radius - 12 * s;
        const innerR = outerR - (isMajor ? 13 : 5.5) * s;

        ctx.strokeStyle = isMajor ? 'rgba(16, 18, 22, 0.62)' : 'rgba(16, 18, 22, 0.25)';
        ctx.lineWidth = (isMajor ? 2.0 : 1.0) * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(Math.sin(a) * innerR, -Math.cos(a) * innerR);
        ctx.lineTo(Math.sin(a) * outerR, -Math.cos(a) * outerR);
        ctx.stroke();
    }

    const fontSize = Math.round(19 * s);
    ctx.fillStyle = 'rgba(16, 18, 22, 0.56)';
    ctx.font = `400 ${fontSize}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const numR = radius - 40 * s;
    for (let i = 1; i <= 12; i++) {
        const a = i * ((Math.PI * 2) / 12);
        ctx.fillText(i.toString(), Math.sin(a) * numR, -Math.cos(a) * numR);
    }

    ctx.restore();
}

function drawSecondHand(ctx, sAngle) {
    const s = radius / 272;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(sAngle);

    ctx.strokeStyle = CONFIG.handColors.second;
    ctx.lineWidth = Math.max(1.2, 1.6 * s);
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(0, 22 * s);
    ctx.lineTo(0, -radius + 24 * s);
    ctx.stroke();

    ctx.fillStyle = CONFIG.handColors.second;
    ctx.beginPath();
    ctx.arc(0, 18 * s, 2.6 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function resize() {
    const rect = wrapper.getBoundingClientRect();
    width = rect.width || 620;
    height = rect.height || 620;
    centerX = width / 2;
    centerY = height / 2;
    radius = Math.min(width, height) * 0.44;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (!glassGrainPattern) {
        glassGrainPattern = createGlassGrainPattern();
    }

    if (hourHand.strokes.length > 0) hourHand.generateStrokes(hourHand.angle, hourHand.seed);
    if (minuteHand.strokes.length > 0) minuteHand.generateStrokes(minuteHand.angle, minuteHand.seed);
}

window.addEventListener('resize', resize);

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !demoRunning) {
        const now = new Date();
        const h = now.getHours();
        const m = now.getMinutes();
        taskQueue.length = 0;
        activeTask = null;
        lastTrackedMinute = m;
        lastTrackedHour = h;
        scheduledEraseForMinute = -1;
        scheduledEraseForHour = -1;
        hourHand.progress = 1;
        hourHand.generateStrokes(getHourAngle(h, m));
        minuteHand.progress = 1;
        minuteHand.generateStrokes(getMinuteAngle(m));
    }
});

// --- Main Animation Loop ---
let lastFrameTime = performance.now();

function animate(nowMs) {
    const dt = Math.min((nowMs - lastFrameTime) / 1000, 0.05);
    lastFrameTime = nowMs;

    const now = new Date();
    const sAngle = (now.getSeconds() + now.getMilliseconds() / 1000) * ((Math.PI * 2) / 60);

    scheduleClockUpdates(now);
    updateTasks(dt);
    keeper.update(dt, traces);
    traces.update(dt);

    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.clip();

    drawCellFrostedBackdrop(ctx);
    keeper.drawPermanentCellRoom(ctx);
    keeper.draw(ctx);
    drawFrostedGlassVeil(ctx);
    drawDialMarkings(ctx);
    traces.draw(ctx);
    hourHand.draw(ctx);
    minuteHand.draw(ctx);
    drawSecondHand(ctx, sAngle);

    ctx.restore();

    requestAnimationFrame(animate);
}

resize();
syncActivityButtonLabel();
startIntroSequence();
requestAnimationFrame(animate);
