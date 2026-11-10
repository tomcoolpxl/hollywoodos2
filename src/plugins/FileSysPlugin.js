const LEFT_FILES = [
    { name: '..', size: '<DIR>', perm: 'drwxr-xr-x', status: 'OK' },
    { name: 'KH12_EPHEMERIS.DAT', size: '14,820,416', perm: '-rwsr-x---', status: 'LOCKED' },
    { name: 'SOSUS_ARRAY_04.RAW', size: '89,412,096', perm: '-rw-r-----', status: 'OK' },
    { name: 'RSA4096_MASTER.KEY', size: '     4,096', perm: '-r--------', status: 'CRYPT' },
    { name: 'TOKAMAK_PLASMA.LOG', size: ' 2,104,880', perm: '-rw-r--r--', status: 'OK' },
    { name: 'CRISPR_LOCUS17.SEQ', size: ' 6,553,600', perm: '-rw-r-----', status: 'OK' },
    { name: 'DEFCON_AUTH_VEC.BIN', size: '   524,288', perm: '-rwsr-sr-x', status: 'CRYPT' },
    { name: 'BGP_HIJACK_MAP.CFG', size: '    98,304', perm: '-rw-r--r--', status: 'OK' },
    { name: 'SAT_TELEMETRY.PCAP', size: '41,943,040', perm: '-rw-r-----', status: 'OK' },
    { name: 'ZION_KERNEL_V4.ELF', size: '12,582,912', perm: '-rwxr-xr-x', status: 'OK' },
    { name: 'SHADOW_HASHES.DB', size: ' 1,048,576', perm: '-r--------', status: 'LOCKED' },
    { name: 'GHOST_OP_MACRO.SH', size: '    16,384', perm: '-rwxr-x---', status: 'OK' }
];

const RIGHT_FILES = [
    { name: '..', size: '<DIR>', state: 'MOUNTED' },
    { name: 'EXFIL_CHUNK_00.ENC', size: '16,777,216', state: 'VERIFIED' },
    { name: 'EXFIL_CHUNK_01.ENC', size: '16,777,216', state: 'VERIFIED' },
    { name: 'EXFIL_CHUNK_02.ENC', size: '16,777,216', state: 'VERIFIED' },
    { name: 'KEY_SCHEDULE_09.HEX', size: '   262,144', state: 'SYNCED' },
    { name: 'TUNNEL_SOCK_74.PID', size: '     1,024', state: 'ACTIVE' },
    { name: 'PAYLOAD_STAGING.TAR', size: '67,108,864', state: 'STREAMING' }
];

export class FileSysPlugin {
    constructor() {
        this.context = null;
        this.adapter = null;
        this.rng = null;
        this.timer = 0;
        this.selectedIdx = 1;
        this.copyProgress = 0.24;
        this.scanCol = 0;
        this.sectorMap = [];
        this.iops = 14820;
        this.throughput = 1.84;
        this.lines = [];
    }

    init(context) {
        this.context = context;
        this.rng = context.rng;
        this.adapter = context.createGridAdapter({
            fontSize: context.options.fontSize || 13,
            lineHeight: context.options.lineHeight || 16
        });
        this.adapter.enableCursor('block', context.theme?.primary ?? 0x00FF00);

        this.selectedIdx = 1;
        this.copyProgress = 0.32;
        this.sectorMap = [];
        for (let i = 0; i < 64; i++) {
            const r = this.rng();
            this.sectorMap.push(r < 0.55 ? '#' : r < 0.78 ? ':' : r < 0.9 ? '.' : '@');
        }

        this.renderGrid();
    }

    update(dt, state) {
        this.timer += dt;
        const speed = state?.alertActive ? 2.2 : 1.0;
        this.copyProgress += dt * 0.18 * speed;

        if (this.copyProgress >= 1.0) {
            this.copyProgress = 0.0;
            this.selectedIdx = 1 + ((this.selectedIdx) % (LEFT_FILES.length - 1));
        }

        if (this.timer >= 0.14) {
            this.timer = 0;
            this.scanCol = (this.scanCol + 1) % 48;
            // Mutate 2 sector blocks deterministically
            const idxA = this.rng.int(0, this.sectorMap.length - 1);
            const idxB = this.rng.int(0, this.sectorMap.length - 1);
            this.sectorMap[idxA] = this.rng.pick(['#', '#', ':', '@', '.']);
            this.sectorMap[idxB] = '#';
            this.iops = 12400 + this.rng.int(0, 6500);
            this.throughput = (1.2 + this.rng() * 1.4).toFixed(2);
            this.renderGrid(state);
        }
    }

    renderGrid(state) {
        const cols = Math.max(48, this.adapter.cols - 1);
        const rows = Math.max(14, this.adapter.rows);
        const leftW = Math.floor((cols - 3) * 0.54);
        const rightW = cols - 3 - leftW;

        const out = [];
        const borderH = '+' + '-'.repeat(leftW) + '+' + '-'.repeat(rightW) + '+';

        // Row 1: Top Commander Title Bar
        const hdrLeft = ' [/mnt/vault04/classified] ';
        const hdrRight = ' [/dev/uplink_exfil_0] ';
        out.push(
            '+' +
                hdrLeft.padEnd(leftW, '-').slice(0, leftW) +
                '+' +
                hdrRight.padEnd(rightW, '-').slice(0, rightW) +
                '+'
        );

        // Row 2: Column Headers
        const colHdrL = ' NAME               SIZE       PERM'.padEnd(leftW, ' ').slice(0, leftW);
        const colHdrR = ' STAGING_TARGET     STATE'.padEnd(rightW, ' ').slice(0, rightW);
        out.push(`|{peak}${colHdrL}{/}|${colHdrR}|`);
        out.push(borderH);

        // File table rows
        const listRows = Math.max(5, rows - 10);
        for (let r = 0; r < listRows; r++) {
            const lf = LEFT_FILES[r];
            const rf = RIGHT_FILES[r];

            let leftCell = ' '.repeat(leftW);
            if (lf) {
                const marker = r === this.selectedIdx ? '>' : ' ';
                const rawRow = `${marker}${lf.name.padEnd(18, ' ').slice(0, 18)} ${lf.size.padStart(10, ' ')} ${lf.perm}`;
                leftCell = rawRow.padEnd(leftW, ' ').slice(0, leftW);
                if (r === this.selectedIdx) {
                    leftCell = `{peak}${leftCell}{/}`;
                } else if (lf.status === 'LOCKED' || lf.status === 'CRYPT') {
                    leftCell = `{error}${leftCell}{/}`;
                }
            }

            let rightCell = ' '.repeat(rightW);
            if (rf) {
                const rawR = ` ${rf.name.padEnd(18, ' ').slice(0, 18)} ${rf.state}`;
                rightCell = rawR.padEnd(rightW, ' ').slice(0, rightW);
                if (rf.state === 'STREAMING') {
                    rightCell = `{peak}${rightCell}{/}`;
                }
            }

            out.push(`|${leftCell}|${rightCell}|`);
        }

        out.push(borderH);

        // Sector Allocation Map Strip (2 lines)
        const innerW = cols - 2;
        const mapW = Math.max(16, innerW - 22);
        const mapSlice1 = this.sectorMap.slice(0, mapW).join('').padEnd(mapW, '#').slice(0, mapW);
        const mapSlice2 = this.sectorMap
            .slice(16, 16 + mapW)
            .join('')
            .padEnd(mapW, ':')
            .slice(0, mapW);

        const secLine1 = ` INODE SECTOR MAP : [${mapSlice1}]`.padEnd(innerW, ' ').slice(0, innerW);
        const secLine2 = ` LEGEND [#]=ALLOC [:]=SYNC [@]=BAD_BLK  IOPS: ${this.iops}  BW: ${this.throughput} GB/s`
            .padEnd(innerW, ' ')
            .slice(0, innerW);
        out.push(`|${secLine1}|`);
        out.push(`|${secLine2}|`);
        out.push('+' + '-'.repeat(innerW) + '+');

        // Active Transfer / Exfiltration Progress Footer
        const activeFile = LEFT_FILES[this.selectedIdx] || LEFT_FILES[1];
        const pct = Math.min(99, Math.floor(this.copyProgress * 100));
        const barLen = Math.max(10, innerW - 42);
        const filled = Math.round((pct / 100) * barLen);
        const bar = '#'.repeat(filled) + '.'.repeat(Math.max(0, barLen - filled));
        const xferRaw = ` XFER: ${activeFile.name.padEnd(18, ' ')} [${bar}] ${pct.toString().padStart(2, '0')}%`;
        const xferCell = xferRaw.padEnd(innerW, ' ').slice(0, innerW);
        out.push(`|{peak}${xferCell}{/}|`);

        const fKeyBar = state?.alertActive
            ? ' {error}!! EMERGENCY WIPE ARMED !!{/} CMD# shred -fz -n 3 /mnt/vault04 '
            : ` CMD:/mnt/vault04# rsync --cipher=chacha20 ${activeFile.name} /dev/uplink_0`;
        out.push('+' + '-'.repeat(innerW) + '+');
        out.push(`${fKeyBar.slice(0, cols - 3)}{inverse} {/}`);

        this.lines = out.slice(0, rows);
        this.adapter.setLines(this.lines);
        // Hardware block cursor scans across the INODE SECTOR MAP row
        const sectorRow = Math.min(this.lines.length - 1, listRows + 4);
        const sectorCol = Math.min(cols - 3, 21 + (this.scanCol % mapW));
        this.adapter.setCursorGrid(sectorCol, sectorRow);
    }

    destroy() {
        this.lines = [];
        this.adapter = null;
    }
}
