const SHELL_SCRIPTS = [
    {
        prompt: 'root@zion-core:/opt/blackbox# ',
        cmd: 'nmap -sS -O -p 22,443,8443,9001 10.207.4.19 --T4',
        output: [
            'Starting Nmap 7.94SVN ( https://nmap.org ) at UTC',
            'SYN Stealth Scan Timing: About 99.80% done; ETC: 00:00',
            'PORT      STATE    SERVICE       VERSION',
            '22/tcp    open     ssh           OpenSSH 9.6p1 (protocol 2.0)',
            '443/tcp   open     ssl/https     HAProxy 2.9-fips [TLSv1.3 CHACHA20]',
            '{peak}8443/tcp  open     blackbox-rpc  MIL-STD-2045 Tactical C2 Daemon{/}',
            '{error}9001/tcp  filtered tor-orport    [RST RATE-LIMITED BY FIREWALL]{/}',
            'Device type: specialized|military-router',
            'OS details: Linux 6.8.0-hardened-grsec (x86_64) // SMP PREEMPT_RT',
            ''
        ]
    },
    {
        prompt: 'root@zion-core:/opt/blackbox# ',
        cmd: 'gdb -batch -ex "info registers" -ex "x/4i $rip" -p 4192',
        output: [
            '[Thread debugging using libthread_db enabled]',
            '0x00007f9c401a8e42 in sys_crypto_handshake () from /lib/libvault.so.4',
            'rax   0x0000000000000000    rbx   0x00007ffc88a10400',
            'rcx   0x00007f9c401a8e42    rdx   0x0000000000000100',
            '{peak}rip   0x00007f9c401a8e42    eflags 0x00000246 [ PF ZF IF ]{/}',
            '=> 0x7f9c401a8e42 <+18>:  cmp    QWORD PTR [rdi+0x28], 0x0',
            '   0x7f9c401a8e47 <+23>:  jne    0x7f9c401a8e90 <auth_fail_trap>',
            '{error}[!] PATCHING JNE -> NOP (0x90 0x90) AT 0x7f9c401a8e47... DONE{/}',
            '{peak}[+] AUTHENTICATION GUARD BYPASSED // RING-0 TOKEN ACQUIRED{/}',
            ''
        ]
    },
    {
        prompt: 'root@zion-core:/opt/blackbox# ',
        cmd: 'ip route show table tactical_uplink && wg show wg0',
        output: [
            'default via 172.31.0.1 dev wg0 proto static metric 10',
            '10.207.0.0/16 via 192.168.250.4 dev tun_sat0 src 10.207.0.1',
            'interface: wg0 (QUANTUM-RESISTANT TUNNEL)',
            '  public key: 9xK8vL2pQ7mN4rT1wZ6cB3yF5hJ0dG8sA4eW2uI1oP9=',
            '  endpoint: [2606:4700:4700::1111]:51820',
            '  {peak}latest handshake: 1 second ago // transfer: 14.82 GiB rx, 4.19 GiB tx{/}',
            ''
        ]
    },
    {
        prompt: 'root@zion-core:/opt/blackbox# ',
        cmd: 'sqlmap -u "https://10.207.4.19:8443/rpc/v2/key" --batch --dump',
        output: [
            '[INFO] testing connection to the target URL',
            '[INFO] heuristic (basic) test shows parameter "node_id" might be injectable',
            '{peak}[INFO] target URL appears to be UNION injectable with 8 columns{/}',
            'Database: stratcom_vault // Table: active_transponders',
            '+---------+------------------+----------------+--------------------+',
            '| NODE_ID | CALLSIGN         | ORBIT_SLOT     | MASTER_CIPHER_KEY  |',
            '+---------+------------------+----------------+--------------------+',
            '| 0x041A  | KH-12_KEYHOLE    | SSO-412KM-97.8 | {peak}8F92-E41C-00B4-77D1{/}|',
            '| 0x041B  | LACROSSE_SAR_5   | LEO-684KM-57.0 | {peak}3A10-C99E-55D2-18F0{/}|',
            '| 0x041C  | ORION_SIGINT_9   | GEO-35786KM    | {error}[KEY ROTATING...]{/}  |',
            '+---------+------------------+----------------+--------------------+',
            ''
        ]
    }
];

export class ShellPlugin {
    constructor() {
        this.context = null;
        this.adapter = null;
        this.rng = null;
        this.historyLines = [];
        this.maxLines = 24;
        this.scriptIdx = 0;
        this.phase = 'typing'; // 'typing' | 'output' | 'pause'
        this.charIdx = 0;
        this.outIdx = 0;
        this.timer = 0;
        this.lines = [];
    }

    init(context) {
        this.context = context;
        this.rng = context.rng;
        this.adapter = context.createGridAdapter({
            fontSize: context.options.fontSize || 13,
            lineHeight: context.options.lineHeight || 16
        });
        this.adapter.enableCursor(context.cursor);
        this.maxLines = Math.max(10, this.adapter.rows);

        this.historyLines = [
            'HOLLYWOOD_OS SECURE KERNEL SHELL // TTY: pts/0 (ASH-5.2)',
            'LAST LOGIN: UTC FROM 10.207.0.1 [KEY: ED25519-CERT-OK]',
            '------------------------------------------------------------------------'
        ];
        this.scriptIdx = this.rng.int(0, SHELL_SCRIPTS.length - 1);
        this.phase = 'typing';
        this.charIdx = 0;
        this.outIdx = 0;
        this.timer = 0;

        // Pre-seed one completed command so window starts with rich text immediately
        const initialScript = SHELL_SCRIPTS[this.scriptIdx];
        this.historyLines.push(`${initialScript.prompt}{peak}${initialScript.cmd}{/}`);
        for (const line of initialScript.output) {
            this.historyLines.push(line);
        }
        this.scriptIdx = (this.scriptIdx + 1) % SHELL_SCRIPTS.length;
        this.renderShell();
    }

    update(dt, state) {
        this.timer += dt;
        const speed = state?.alertActive ? 2.0 : 1.0;
        const current = SHELL_SCRIPTS[this.scriptIdx];

        if (this.phase === 'typing') {
            const typeStep = 0.032 / speed;
            if (this.timer >= typeStep) {
                this.timer = 0;
                this.charIdx += this.rng.int(1, 2);
                if (this.charIdx >= current.cmd.length) {
                    this.charIdx = current.cmd.length;
                    this.historyLines.push(`${current.prompt}{peak}${current.cmd}{/}`);
                    this.trimHistory(1);
                    this.phase = 'output';
                    this.outIdx = 0;
                }
                this.renderShell();
            }
        } else if (this.phase === 'output') {
            const outStep = 0.085 / speed;
            if (this.timer >= outStep) {
                this.timer = 0;
                if (this.outIdx < current.output.length) {
                    this.historyLines.push(current.output[this.outIdx]);
                    this.outIdx++;
                    this.trimHistory(1);
                } else {
                    this.phase = 'pause';
                }
                this.renderShell();
            }
        } else if (this.phase === 'pause') {
            if (this.timer >= 0.9 / speed) {
                this.timer = 0;
                this.scriptIdx = (this.scriptIdx + 1) % SHELL_SCRIPTS.length;
                this.charIdx = 0;
                this.phase = 'typing';
                this.renderShell();
            }
        }
    }

    trimHistory(reserveRows = 1) {
        while (this.historyLines.length > this.maxLines - reserveRows) {
            this.historyLines.shift();
        }
    }

    renderShell() {
        const current = SHELL_SCRIPTS[this.scriptIdx];
        const visible = [...this.historyLines];

        let cursorCol = 0;
        let cursorRow = Math.max(0, visible.length - 1);

        if (this.phase === 'typing' || this.phase === 'pause') {
            const typed = this.phase === 'typing' ? current.cmd.slice(0, this.charIdx) : '';
            const activeLine = `${current.prompt}{peak}${typed}{/}`;
            if (visible.length >= this.maxLines) {
                visible.shift();
            }
            visible.push(activeLine);
            cursorRow = visible.length - 1;
            cursorCol = current.prompt.length + typed.length;
        }

        this.lines = visible;
        this.adapter.setLines(this.lines);
        this.adapter.setCursorGrid(cursorCol, cursorRow);
    }

    destroy() {
        this.historyLines = [];
        this.lines = [];
        this.adapter = null;
    }
}
