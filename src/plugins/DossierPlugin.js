const DOSSIERS = [
    {
        id: 'ASSET-994-KESTREL',
        codename: 'WINTER_MUTE // VANCE, ELENA',
        clearance: 'COSMIC TOP SECRET // UMBRA',
        station: 'ZURICH / SECTOR-04 RELAY',
        coords: '47.3769 N, 008.5417 E',
        biometric: 'RETINA-LOCK [MATCH 99.94%]',
        status: 'ACTIVE // DEEP COVER',
        secret1: 'OPERATION: BLACKBRIAR SUB-CABLE TAP',
        secret2: 'HANDLER  : DIRECTORATE-7 [NODE-X9]',
        secret3: 'AUTH KEY : 0x7F44-99A1-C0DE-883B',
        notes: 'SUBJECT POSSESSES OFFLINE ROOT SIGNING KEY FOR KH-12 TRANSPONDER BUS.'
    },
    {
        id: 'ASSET-418-VALKYRIE',
        codename: 'GLASS_HARBOR // SORENSEN, K.',
        clearance: 'TS // SCI // TALENT-KEYHOLE',
        station: 'SVALBARD POLAR DOWNLINK',
        coords: '78.2298 N, 015.4078 E',
        biometric: 'VOICEPRINT+DNA [VERIFIED]',
        status: 'COMPROMISED // EXTRACTION PENDING',
        secret1: 'OPERATION: AURORA PHASE-LOCK OVERRIDE',
        secret2: 'HANDLER  : NORTHWOODS SIGINT CELL',
        secret3: 'AUTH KEY : 0x91E0-4B12-FF08-31A9',
        notes: 'DETECTED ANOMALOUS BURST TRANSMISSION ON 427.80 MHz PRIOR TO LOCKDOWN.'
    },
    {
        id: 'ASSET-702-OBSIDIAN',
        codename: 'NIGHT_WATCH // CHEN, MARCUS',
        clearance: 'TOP SECRET // ECHELON-CORE',
        station: 'PINE GAP JOINT DEFENSE FAC',
        coords: '23.7990 S, 133.7370 E',
        biometric: 'PALM VEIN GEOMETRY [OK]',
        status: 'ACTIVE // ON-CONSOLE',
        secret1: 'OPERATION: ORBITAL EPHEMERIS INJECTION',
        secret2: 'HANDLER  : PACIFIC RECON WING 02',
        secret3: 'AUTH KEY : 0x3C88-D019-7E2A-55F4',
        notes: 'AUTHORIZED FOR DIRECT MANUAL THRUSTER GIMBAL OVERRIDE ON BUS SAT-01.'
    }
];

const ASCII_PORTRAIT = [
    '  .---======---.  ',
    ' /   _      _   \\ ',
    '|   (o)    (o)   |',
    '|      /  \\      |',
    '|     | == |     |',
    ' \\     \\__/     / ',
    '  `.          .\'  ',
    '  / `--------\' \\  ',
    ' /  [::BIOM::]  \\ ',
    '| ID:994-881-A04 |'
];

export class DossierPlugin {
    constructor() {
        this.context = null;
        this.adapter = null;
        this.rng = null;
        this.dossierIdx = 0;
        this.revealChars = 0;
        this.timer = 0;
        this.recordTimer = 0;
        this.lines = [];
    }

    init(context) {
        this.context = context;
        this.rng = context.rng;
        this.adapter = context.createGridAdapter({
            fontSize: context.options.fontSize || 13,
            lineHeight: context.options.lineHeight || 16
        });

        this.dossierIdx = this.rng.int(0, DOSSIERS.length - 1);
        this.revealChars = 14;
        this.timer = 0;
        this.recordTimer = 0;
        this.renderDossier();
    }

    update(dt, state) {
        this.timer += dt;
        this.recordTimer += dt;
        const speed = state?.alertActive ? 2.2 : 1.0;

        if (this.timer >= 0.08 / speed) {
            this.timer = 0;
            this.revealChars = Math.min(48, this.revealChars + 1);
            this.renderDossier(state);
        }

        if (this.recordTimer >= 6.5 / speed) {
            this.recordTimer = 0;
            this.dossierIdx = (this.dossierIdx + 1) % DOSSIERS.length;
            this.revealChars = 4;
            this.renderDossier(state);
        }
    }

    unredact(text, count) {
        const revealed = text.slice(0, count);
        const hiddenLen = Math.max(0, text.length - count);
        const redactBlock = '#'.repeat(hiddenLen);
        return hiddenLen > 0 ? `{peak}${revealed}{/}${redactBlock}` : `{peak}${revealed}{/}`;
    }

    renderDossier(state) {
        const cols = Math.max(52, this.adapter.cols - 1);
        const rows = Math.max(14, this.adapter.rows);
        const innerW = cols - 2;
        const rec = DOSSIERS[this.dossierIdx];

        const out = [];
        const border = '+' + '-'.repeat(innerW) + '+';

        // SQL Query Header
        const queryStr = ` SQL> SELECT * FROM INTEL_DOSSIER WHERE ASSET_ID='${rec.id}'; [1 ROW]`;
        out.push(`{peak}${queryStr.slice(0, cols)}{/}`);
        out.push(border);

        const titleRow = ` CLASSIFIED INTELLIGENCE RECORD // CLEARANCE: ${rec.clearance}`
            .padEnd(innerW, ' ')
            .slice(0, innerW);
        out.push(`|{peak}${titleRow}{/}|`);
        out.push(border);

        // Split upper card: Left ASCII portrait (18 cols) | Right structured fields
        const leftW = 18;
        const rightW = Math.max(24, innerW - leftW - 1);

        const fields = [
            ` ASSET ID   : ${rec.id}`,
            ` CODENAME   : ${rec.codename}`,
            ` STATION    : ${rec.station}`,
            ` GEO COORDS : ${rec.coords}`,
            ` BIOMETRICS : ${rec.biometric}`,
            ` OP STATUS  : ${rec.status}`,
            ' ' + '-'.repeat(Math.max(10, rightW - 2)),
            ` DECRYPTING COMPARTMENTED ANNEX [LEVEL-9]:`,
            ` > ${rec.secret1.slice(0, rightW - 4)}`,
            ` > ${rec.secret2.slice(0, rightW - 4)}`
        ];

        for (let i = 0; i < ASCII_PORTRAIT.length; i++) {
            const art = (ASCII_PORTRAIT[i] || '').padEnd(leftW, ' ').slice(0, leftW);
            const rawField = (fields[i] || '').padEnd(rightW, ' ').slice(0, rightW);

            let styledField = rawField;
            if (i === 5 && (rec.status.includes('COMPROMISED') || state?.alertActive)) {
                styledField = `{error}${rawField}{/}`;
            } else if (i >= 8) {
                const body = rawField.slice(3).trimEnd();
                const padAfter = ' '.repeat(Math.max(0, rightW - 3 - body.length));
                styledField = ` > ${this.unredact(body, this.revealChars)}${padAfter}`;
            } else if (i === 1) {
                styledField = `{peak}${rawField}{/}`;
            }

            out.push(`|${art}|${styledField}|`);
        }

        out.push(border);

        // Lower Un-redacting Cryptographic & Field Notes Block
        const keyLineRaw = ` CRYPTO_VEC : ${rec.secret3}`;
        const keyPad = ' '.repeat(Math.max(0, innerW - keyLineRaw.length));
        out.push(`| CRYPTO_VEC : ${this.unredact(rec.secret3, this.revealChars)}${keyPad}|`);

        const noteLine = ` FIELD_NOTE : ${rec.notes}`.padEnd(innerW, ' ').slice(0, innerW);
        out.push(`|${noteLine}|`);

        const footStatus = state?.alertActive
            ? ` !! PRIORITY FLASH: ASSET ${rec.id} FLAGGED FOR IMMEDIATE RECALL !!`
            : ` [PGUP/PGDN] NEXT RECORD   [F2] UNREDACT ANNEX   [F7] EXPORT DOSSIER`;
        const footPadded = footStatus.padEnd(innerW, ' ').slice(0, innerW);
        out.push(border);
        out.push(
            state?.alertActive ? `|{error}${footPadded}{/}|` : `|${footPadded}|`
        );
        out.push(border);

        this.lines = out.slice(0, rows);
        this.adapter.setLines(this.lines);
    }

    destroy() {
        this.lines = [];
        this.adapter = null;
    }
}
