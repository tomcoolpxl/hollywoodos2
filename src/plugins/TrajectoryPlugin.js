const STAGE_EVENTS = [
    { tNorm: 0.14, label: 'MAX-Q [34.2 kPa]' },
    { tNorm: 0.32, label: 'MECO // STG-1 SEP' },
    { tNorm: 0.48, label: 'FAIRING JETTISON' },
    { tNorm: 0.76, label: 'SECO-1 // LEO INSERT' }
];

export class TrajectoryPlugin {
    constructor() {
        this.context = null;
        this.adapter = null;
        this.rng = null;
        this.width = 0;
        this.height = 0;
        this.theme = null;

        this.flightProgress = 0.62;
        this.readoutTimer = 0;
        this.eventLabels = [];
        this.telemetryLabel = null;
        this.cornerLabels = {};
    }

    init(context) {
        this.context = context;
        this.rng = context.rng;
        this.width = context.width;
        this.height = context.height;
        this.theme = context.theme;

        this.adapter = context.createFreeformAdapter();
        this.flightProgress = 0.45 + this.rng() * 0.35;
        this.drawStaticGrid();
    }

    evalArc(u, plotX, plotY, plotW, plotH) {
        const x = plotX + u * plotW;
        // Powered ascent + gravity turn leveling into orbital insertion altitude
        const climb = 1 - Math.pow(1 - u, 2.35);
        const ripple = Math.sin(u * Math.PI * 2) * 0.025;
        const normAlt = Math.min(0.95, Math.max(0.0, climb + ripple));
        const y = plotY + plotH - normAlt * (plotH - 18);
        return { x, y, normAlt };
    }

    drawStaticGrid() {
        const bg = this.adapter.bgGraphics;
        bg.clear();

        const plotX = 42;
        const plotY = 44;
        const plotW = Math.max(180, this.width - 58);
        const plotH = Math.max(90, Math.floor(this.height * 0.50));
        this.plotRect = { x: plotX, y: plotY, w: plotW, h: plotH };

        // Outer frame for trajectory profile
        bg.rect(plotX, plotY, plotW, plotH).stroke({
            width: 1,
            color: this.theme.secondary,
            alpha: 0.55
        });

        // Horizontal altitude grid lines (0, 100km Karman, 200km, 300km, 400km LEO)
        const hSteps = 4;
        for (let i = 1; i < hSteps; i++) {
            const gy = plotY + (plotH / hSteps) * i;
            bg.moveTo(plotX, gy);
            bg.lineTo(plotX + plotW, gy);
        }
        // Vertical downrange grid lines
        const vSteps = 8;
        for (let i = 1; i < vSteps; i++) {
            const gx = plotX + (plotW / vSteps) * i;
            bg.moveTo(gx, plotY);
            bg.lineTo(gx, plotY + plotH);
        }
        bg.stroke({ width: 1, color: this.theme.dim, alpha: 0.38 });

        // Nominal orbital corridor band near top of plot
        const corrY = plotY + 18;
        bg.rect(plotX + 2, corrY - 5, plotW - 4, 10).fill({
            color: this.theme.dim,
            alpha: 0.28
        });

        // Earth curvature arc along bottom of plot
        const steps = 32;
        for (let i = 0; i <= steps; i++) {
            const u = i / steps;
            const cx = plotX + u * plotW;
            const cy = plotY + plotH - Math.sin(u * Math.PI) * 8;
            if (i === 0) bg.moveTo(cx, cy);
            else bg.lineTo(cx, cy);
        }
        bg.stroke({ width: 1, color: this.theme.secondary, alpha: 0.45 });

        // Altitude scale labels
        const altLabels = ['400K', '300K', '200K', '100K', '0KM'];
        for (let i = 0; i < altLabels.length; i++) {
            const ly = plotY + (plotH / (altLabels.length - 1)) * i - 5;
            this.adapter.createLabel(altLabels[i], {
                x: 6,
                y: ly,
                fontSize: 9,
                fill: this.theme.secondary,
                alpha: 0.78
            });
        }

        // Top headers
        this.cornerLabels.topLeft = this.adapter.createLabel(
            'FLIGHT DYNAMICS // ORBITAL ASCENT & INSERTION PROFILE\nVEHICLE: TITAN-V HEAVY // AZIMUTH: 097.8° SSO CORRIDOR',
            { x: 8, y: 6, fontSize: 10, fill: this.theme.secondary, alpha: 0.88 }
        );
        this.cornerLabels.topRight = this.adapter.createLabel(
            'MET: T+00:05:18.4\nGUIDANCE: PEG-CLOSED-LOOP',
            { x: Math.max(10, this.width - 175), y: 6, fontSize: 10, fill: this.theme.secondary, alpha: 0.88 }
        );

        // Stage callout labels
        this.eventLabels = STAGE_EVENTS.map((ev) => {
            const pt = this.evalArc(ev.tNorm, plotX, plotY, plotW, plotH);
            return this.adapter.createLabel(ev.label, {
                x: Math.min(plotX + plotW - 115, Math.max(plotX + 6, pt.x - 18)),
                y: Math.max(plotY + 4, pt.y - 16),
                fontSize: 9,
                fill: this.theme.primary,
                alpha: 0.85
            });
        });

        // Lower Flight Computer Tabular Readout (Dense Text Block)
        const tableY = plotY + plotH + 10;
        this.telemetryLabel = this.adapter.createLabel('', {
            x: 10,
            y: tableY,
            fontSize: 11,
            lineHeight: 14,
            fill: this.theme.primary,
            alpha: 0.92
        });

        this.updateTelemetryText(false);
    }

    updateTelemetryText(alertActive) {
        if (!this.telemetryLabel) return;
        const p = this.flightProgress;
        const metSec = Math.floor(p * 520);
        const mm = Math.floor(metSec / 60)
            .toString()
            .padStart(2, '0');
        const ss = (metSec % 60).toString().padStart(2, '0');
        const altKm = (p * 412.4).toFixed(1).padStart(6, ' ');
        const downKm = (Math.pow(p, 1.35) * 2480).toFixed(1).padStart(7, ' ');
        const velKms = (0.4 + p * 7.28).toFixed(2).padStart(5, ' ');
        const mach = (1.2 + p * 22.4).toFixed(1).padStart(5, ' ');
        const qKpa = (Math.sin(Math.min(1, p * 2.5) * Math.PI) * 34.2).toFixed(1).padStart(5, ' ');
        const pitch = (90 - p * 88.5).toFixed(1).padStart(5, ' ');
        const propPct = Math.max(4.2, 100 - p * 91.5).toFixed(1).padStart(5, ' ');
        const gLoad = (1.4 + p * 2.8).toFixed(2);

        if (this.cornerLabels.topRight) {
            this.cornerLabels.topRight.text =
                `MET: T+00:${mm}:${ss}.4\n` +
                (alertActive ? 'GUIDANCE: ABORT-TO-ORBIT' : 'GUIDANCE: PEG-CLOSED-LOOP');
        }

        const statusLine = alertActive
            ? 'STATUS  : !! RANGE SAFETY DEVIATION // TVC GIMBAL OVERRIDE ACTIVE !!'
            : 'STATUS  : NOMINAL POWERED FLIGHT // TELEMETRY LOCK: S-BAND 2282.5 MHz';

        this.telemetryLabel.text = [
            '+------------------------+------------------------+------------------------+',
            `| ALTITUDE : ${altKm} km   | VELOCITY :  ${velKms} km/s | PITCH ANG :  ${pitch} deg |`,
            `| DOWNRNGE : ${downKm} km  | MACH NUM :  ${mach} M    | DYN PRESS :  ${qKpa} kPa |`,
            `| APOGEE   :  414.2 km   | PERIGEE  :  408.9 km   | PROP REM  :  ${propPct} %   |`,
            `| INCLINAT :  097.8 deg  | ACCEL    :   ${gLoad} G    | STAGE     :  02-BURN   |`,
            '+------------------------+------------------------+------------------------+',
            statusLine
        ].join('\n');
    }

    update(dt, state) {
        const speed = state?.alertActive ? 1.8 : 1.0;
        this.flightProgress += dt * 0.045 * speed;
        if (this.flightProgress > 0.98) {
            this.flightProgress = 0.08;
        }

        this.readoutTimer += dt;
        if (this.readoutTimer >= 0.2) {
            this.readoutTimer = 0;
            this.updateTelemetryText(Boolean(state?.alertActive));
        }

        this.render(Boolean(state?.alertActive));
    }

    render() {
        const g = this.adapter.graphics;
        g.clear();

        const { x: plotX, y: plotY, w: plotW, h: plotH } = this.plotRect;

        // 1. Nominal Predicted Trajectory Curve (Full width, dim)
        const totalSteps = 56;
        for (let i = 0; i <= totalSteps; i++) {
            const u = i / totalSteps;
            const pt = this.evalArc(u, plotX, plotY, plotW, plotH);
            if (i === 0) g.moveTo(pt.x, pt.y);
            else g.lineTo(pt.x, pt.y);
        }
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.4 });

        // 2. Active Flown Trajectory Segment (0 -> flightProgress, bright primary)
        const activeSteps = Math.max(4, Math.floor(this.flightProgress * totalSteps));
        let vehPt = this.evalArc(0, plotX, plotY, plotW, plotH);
        for (let i = 0; i <= activeSteps; i++) {
            const u = (i / activeSteps) * this.flightProgress;
            const pt = this.evalArc(u, plotX, plotY, plotW, plotH);
            if (i === 0) g.moveTo(pt.x, pt.y);
            else g.lineTo(pt.x, pt.y);
            vehPt = pt;
        }
        g.stroke({ width: 2, color: this.theme.primary, alpha: 0.95 });

        // 3. Stage Event Markers along curve
        for (let i = 0; i < STAGE_EVENTS.length; i++) {
            const ev = STAGE_EVENTS[i];
            const pt = this.evalArc(ev.tNorm, plotX, plotY, plotW, plotH);
            const passed = this.flightProgress >= ev.tNorm;
            g.rect(pt.x - 3, pt.y - 3, 6, 6).stroke({
                width: 1,
                color: passed ? this.theme.primary : this.theme.secondary,
                alpha: passed ? 0.95 : 0.45
            });
            if (this.eventLabels[i]) {
                this.eventLabels[i].alpha = passed ? 0.95 : 0.45;
            }
        }

        // 4. Vehicle Reticle, Ground Track Drop Line, and Velocity Vector
        g.moveTo(vehPt.x, vehPt.y);
        g.lineTo(vehPt.x, plotY + plotH);
        g.stroke({ width: 1, color: this.theme.secondary, alpha: 0.45 });

        g.circle(vehPt.x, vehPt.y, 4.5).stroke({
            width: 1.5,
            color: this.theme.primary,
            alpha: 1.0
        });
        g.rect(vehPt.x - 1.5, vehPt.y - 1.5, 3, 3).fill(this.theme.primary);

        // Velocity tangent vector ahead of vehicle
        const nextU = Math.min(1.0, this.flightProgress + 0.06);
        const nextPt = this.evalArc(nextU, plotX, plotY, plotW, plotH);
        g.moveTo(vehPt.x, vehPt.y);
        g.lineTo(nextPt.x, nextPt.y);
        g.stroke({ width: 1.5, color: this.theme.primary, alpha: 0.85 });
    }

    destroy() {
        this.eventLabels = [];
        this.telemetryLabel = null;
        this.cornerLabels = {};
        this.adapter = null;
    }
}
