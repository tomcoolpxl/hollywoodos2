const BASE_PROCS = [
    { pid: 1, user: 'root', pri: 'RT', virt: '168M', res: '14M', stat: 'S', baseCpu: 0.4, cmd: '/sbin/init --seccomp=strict' },
    { pid: 412, user: 'root', pri: '-20', virt: '4.2G', res: '1.8G', stat: 'R', baseCpu: 34.2, cmd: 'kh12_sar_synthesizer --threads=16' },
    { pid: 889, user: 'sigint', pri: '20', virt: '2.1G', res: '940M', stat: 'R', baseCpu: 22.8, cmd: 'sosus_beamformer -i eth2 -b 64' },
    { pid: 1024, user: 'crypto', pri: 'RT', virt: '8.0G', res: '6.4G', stat: 'R', baseCpu: 48.6, cmd: 'gf256_key_cracker --avx512 --vault=4' },
    { pid: 1337, user: 'root', pri: '10', virt: '640M', res: '210M', stat: 'S', baseCpu: 6.1, cmd: 'bgp_route_injector --asn=4192' },
    { pid: 1984, user: 'daemon', pri: '20', virt: '512M', res: '88M', stat: 'S', baseCpu: 3.4, cmd: 'wargames_telemetry_mux --port=8443' },
    { pid: 2049, user: 'bio', pri: '20', virt: '1.9G', res: '720M', stat: 'R', baseCpu: 14.5, cmd: 'crispr_align_lattice --chr=17q21' },
    { pid: 2410, user: 'root', pri: '-5', virt: '310M', res: '64M', stat: 'S', baseCpu: 2.9, cmd: 'wireguard-kworker/u16:4 [wg0]' },
    { pid: 2891, user: 'secops', pri: '20', virt: '920M', res: '340M', stat: 'R', baseCpu: 11.2, cmd: 'suricata-ids --af-packet=eth0' },
    { pid: 3104, user: 'root', pri: '20', virt: '144M', res: '22M', stat: 'S', baseCpu: 1.1, cmd: 'ntpd -g -u ntp:ntp [STRATUM-1 GPS]' },
    { pid: 3512, user: 'audit', pri: '20', virt: '410M', res: '95M', stat: 'S', baseCpu: 4.7, cmd: 'ring0_syscall_verifier --live' },
    { pid: 4096, user: 'root', pri: 'RT', virt: '12.4G', res: '9.1G', stat: 'R', baseCpu: 19.3, cmd: 'tokamak_mhd_solver --grid=256x256' },
    { pid: 4418, user: 'operator', pri: '20', virt: '228M', res: '44M', stat: 'S', baseCpu: 1.8, cmd: 'ash -c "tail -f /var/log/intercept"' },
    { pid: 4902, user: 'root', pri: '20', virt: '88M', res: '12M', stat: 'D', baseCpu: 8.4, cmd: '[nvme0n1-flush-vault-crypt]' }
];

export class ProcTablePlugin {
    constructor() {
        this.context = null;
        this.adapter = null;
        this.rng = null;
        this.timer = 0;
        this.uptimeSec = 419284;
        this.procs = [];
        this.cpuBars = [68, 74, 52, 81];
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
        this.cmdStep = 14;

        this.procs = BASE_PROCS.map((p) => ({
            ...p,
            cpu: p.baseCpu,
            timeTicks: this.rng.int(120, 9800)
        }));

        this.stepSimulation(false);
        this.renderTable(false);
    }

    stepSimulation(alertActive) {
        this.uptimeSec += 1;
        for (let i = 0; i < this.cpuBars.length; i++) {
            const delta = this.rng.int(-8, 9) + (alertActive ? 6 : 0);
            this.cpuBars[i] = Math.min(99, Math.max(18, this.cpuBars[i] + delta));
        }

        for (const p of this.procs) {
            const jitter = (this.rng() - 0.48) * 6.5;
            const boost = alertActive && p.stat === 'R' ? 12.0 : 0;
            p.cpu = Math.min(99.9, Math.max(0.1, p.baseCpu + jitter + boost));
            if (p.stat === 'R') {
                p.timeTicks += this.rng.int(1, 5);
            }
        }

        // Sort descending by current CPU%
        this.procs.sort((a, b) => b.cpu - a.cpu);
    }

    update(dt, state) {
        this.timer += dt;
        if (this.timer >= 0.35) {
            this.timer = 0;
            this.stepSimulation(Boolean(state?.alertActive));
            this.renderTable(Boolean(state?.alertActive));
        }
    }

    makeMeter(label, pct, width = 18) {
        const barW = Math.max(6, width);
        const filled = Math.round((pct / 100) * barW);
        const bar = '|'.repeat(filled) + '.'.repeat(Math.max(0, barW - filled));
        const pctStr = `${pct.toString().padStart(2, ' ')}%`;
        return `${label}[${bar} ${pctStr}]`;
    }

    formatTime(ticks) {
        const mins = Math.floor(ticks / 60)
            .toString()
            .padStart(2, '0');
        const secs = (ticks % 60).toString().padStart(2, '0');
        const hun = ((ticks * 17) % 100).toString().padStart(2, '0');
        return `${mins}:${secs}.${hun}`;
    }

    renderTable(alertActive) {
        const cols = Math.max(52, this.adapter.cols - 1);
        const rows = Math.max(12, this.adapter.rows);
        const meterW = Math.max(8, Math.floor((cols - 28) / 2));

        const out = [];
        // Top CPU / MEM meters (htop style)
        const c0 = this.makeMeter('CPU0', this.cpuBars[0], meterW);
        const c1 = this.makeMeter('CPU1', this.cpuBars[1], meterW);
        const c2 = this.makeMeter('CPU2', this.cpuBars[2], meterW);
        const c3 = this.makeMeter('CPU3', this.cpuBars[3], meterW);
        const memPct = alertActive ? 94 : 78;
        const swpPct = alertActive ? 42 : 12;
        const mBar = this.makeMeter('MEM ', memPct, meterW);
        const sBar = this.makeMeter('SWP ', swpPct, meterW);

        out.push(`${c0}  ${c1}`.slice(0, cols));
        out.push(`${c2}  ${c3}`.slice(0, cols));
        out.push(`${mBar}  ${sBar}`.slice(0, cols));

        const hrs = Math.floor(this.uptimeSec / 3600);
        const mins = Math.floor((this.uptimeSec % 3600) / 60)
            .toString()
            .padStart(2, '0');
        const secs = (this.uptimeSec % 60).toString().padStart(2, '0');
        const sysSummary =
            `TASKS: 384 (1428 THR), 6 RUNNING  |  LOAD AVG: 3.42 2.98 2.61  |  UPTIME: ${hrs}:${mins}:${secs}`;
        out.push(sysSummary.slice(0, cols));

        // Table Header
        const hdr = '  PID USER     PRI  VIRT   RES S  CPU%   TIME+   COMMAND'.padEnd(cols, ' ').slice(0, cols);
        out.push(`{peak}${hdr}{/}`);

        // Process Rows
        const availRows = Math.max(4, rows - out.length - 1);
        for (let i = 0; i < availRows && i < this.procs.length; i++) {
            const p = this.procs[i];
            const pidStr = p.pid.toString().padStart(5, ' ');
            const usrStr = p.user.padEnd(8, ' ').slice(0, 8);
            const priStr = p.pri.padStart(3, ' ');
            const vrtStr = p.virt.padStart(5, ' ');
            const resStr = p.res.padStart(5, ' ');
            const cpuStr = p.cpu.toFixed(1).padStart(5, ' ');
            const timStr = this.formatTime(p.timeTicks);
            const prefix = `${pidStr} ${usrStr} ${priStr} ${vrtStr} ${resStr} ${p.stat} ${cpuStr} ${timStr} `;
            const cmdMax = Math.max(8, cols - prefix.length);
            const line = (prefix + p.cmd.slice(0, cmdMax)).padEnd(cols, ' ').slice(0, cols);

            if (i === 0 || p.cpu > 45.0) {
                out.push(`{peak}${line}{/}`);
            } else if (p.stat === 'D' || (alertActive && i === 1)) {
                out.push(`{error}${line}{/}`);
            } else {
                out.push(line);
            }
        }

        const topPid = this.procs[0]?.pid || 1024;
        const fullCmd = alertActive
            ? `GHOST_OP > chrt -f -p 99 ${topPid} && taskset -pc 0-15 ${topPid} [RT-LOCK]`
            : `GHOST_OP > renice -n -20 -p ${topPid} --io-class=REALTIME --trace-syscalls`;
        this.cmdStep = ((this.cmdStep || 12) + 3) % (fullCmd.length + 6);
        const typedLen = Math.min(fullCmd.length, Math.max(11, this.cmdStep));
        const footer = fullCmd.slice(0, Math.min(cols - 2, typedLen));
        out.push(`{peak}${footer}{/}`);

        this.lines = out.slice(0, rows);
        this.adapter.setLines(this.lines);
        this.adapter.setCursorGrid(footer.length, this.lines.length - 1);
    }

    destroy() {
        this.procs = [];
        this.lines = [];
        this.adapter = null;
    }
}
