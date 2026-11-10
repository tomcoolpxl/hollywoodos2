const PROTO_TEMPLATES = [
    {
        proto: 'TLSv1.3',
        src: '10.207.4.19:443',
        dst: '192.168.99.4:51920',
        len: 1420,
        info: 'Application Data [CHACHA20-POLY1305] SEQ=0x8841A',
        l4: 'Transmission Control Protocol, Src Port: 443, Dst Port: 51920, Flags: [PSH, ACK]',
        l7: 'TLSv1.3 Record Layer: Encrypted Application Data // Ephemeris Frame #412'
    },
    {
        proto: 'SSHv2',
        src: '172.16.88.2:22',
        dst: '10.207.0.1:49112',
        len: 384,
        info: 'Server: Encrypted packet (len=340) [curve25519-sha256]',
        l4: 'Transmission Control Protocol, Src Port: 22, Dst Port: 49112, Flags: [ACK]',
        l7: 'SSH Protocol v2: Key Exchange Reply + Ed25519 Host Signature Verified'
    },
    {
        proto: 'BGPv4',
        src: '198.51.100.1:179',
        dst: '10.207.1.254:179',
        len: 128,
        info: 'UPDATE Message [AS_PATH: 64512 4192 13335] PREFIX 10.248.0.0/16',
        l4: 'Transmission Control Protocol, Src Port: 179, Dst Port: 179, Flags: [PSH, ACK]',
        l7: 'Border Gateway Protocol: NLRI Prefix Injection // NextHop: 198.51.100.1'
    },
    {
        proto: 'ICMPv6',
        src: 'fe80::21a:79ff:fe41:900',
        dst: 'ff02::1:ff00:1',
        len: 86,
        info: 'Neighbor Solicitation for 2606:4700::1111 [TACTICAL MESH]',
        l4: 'Internet Control Message Protocol v6 // Type: 135, Code: 0, Checksum: 0x4A91',
        l7: 'ND Option: Source Link-Layer Address 00:1A:79:41:09:00 [SAT-GATEWAY]'
    },
    {
        proto: 'IDS-ALERT',
        src: '185.220.101.7:60911',
        dst: '10.207.4.19:8443',
        len: 1480,
        info: '[SYN, PSH, URG] MALFORMED RPC OVERFLOW VECTOR // DROP',
        l4: 'Transmission Control Protocol, Src Port: 60911, Dst Port: 8443, Flags: [SYN, PSH, URG]',
        l7: 'ALERT [SID:2049110]: Zero-Day Heap Grooming Signature Detected in C2 Header',
        isAlert: true
    }
];

export class PacketPlugin {
    constructor() {
        this.context = null;
        this.adapter = null;
        this.rng = null;
        this.packets = [];
        this.pktCounter = 4190;
        this.timer = 0;
        this.activePkt = null;
        this.hexRows = [];
        this.lines = [];
    }

    init(context) {
        this.context = context;
        this.rng = context.rng;
        this.adapter = context.createGridAdapter({
            fontSize: context.options.fontSize || 12,
            lineHeight: context.options.lineHeight || 15
        });

        this.packets = [];
        this.pktCounter = 4190;
        for (let i = 0; i < 6; i++) {
            this.pushNextPacket();
        }
        this.renderDissector();
    }

    pushNextPacket() {
        this.pktCounter++;
        const tpl = this.rng.pick(PROTO_TEMPLATES);
        const ts = (14.201 + this.pktCounter * 0.037).toFixed(3).padStart(8, ' ');
        const pkt = {
            no: this.pktCounter,
            ts,
            ...tpl
        };
        this.packets.push(pkt);
        if (this.packets.length > 8) {
            this.packets.shift();
        }
        this.activePkt = pkt;
        this.hexRows = this.generateHexDump(4);
    }

    generateHexDump(rowCount) {
        const rows = [];
        const asciiPool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-/+*:;[]{}';
        for (let r = 0; r < rowCount; r++) {
            const addr = (r * 16).toString(16).toUpperCase().padStart(4, '0');
            const hexBytes = [];
            let ascii = '';
            for (let b = 0; b < 16; b++) {
                const val = this.rng.int(0, 255);
                hexBytes.push(val.toString(16).toUpperCase().padStart(2, '0'));
                ascii += val >= 32 && val <= 126 ? asciiPool[val % asciiPool.length] : '.';
            }
            const leftHex = hexBytes.slice(0, 8).join(' ');
            const rightHex = hexBytes.slice(8, 16).join(' ');
            rows.push(`0x${addr}  ${leftHex}  ${rightHex}   |${ascii}|`);
        }
        return rows;
    }

    update(dt, state) {
        this.timer += dt;
        const step = state?.alertActive ? 0.18 : 0.38;
        if (this.timer >= step) {
            this.timer = 0;
            this.pushNextPacket();
            this.renderDissector(state);
        }
    }

    renderDissector(state) {
        const cols = Math.max(54, this.adapter.cols - 1);
        const rows = Math.max(15, this.adapter.rows);
        const sep = '-'.repeat(cols);

        const out = [];
        // Tier 1: Live Packet Summary Table
        const hdr = ' NO.    TIME     SOURCE               DESTINATION          PROTO     LEN INFO'
            .padEnd(cols, ' ')
            .slice(0, cols);
        out.push(`{peak}${hdr}{/}`);
        out.push(sep);

        const maxSummaryRows = Math.max(4, rows - 13);
        const visiblePkts = this.packets.slice(-maxSummaryRows);
        for (let i = 0; i < visiblePkts.length; i++) {
            const p = visiblePkts[i];
            const isSelected = i === visiblePkts.length - 1;
            const marker = isSelected ? '>' : ' ';
            const raw =
                `${marker}${p.no.toString().padEnd(6, ' ')} ${p.ts} ` +
                `${p.src.padEnd(20, ' ').slice(0, 20)} ${p.dst.padEnd(20, ' ').slice(0, 20)} ` +
                `${p.proto.padEnd(9, ' ').slice(0, 9)} ${p.len.toString().padStart(4, ' ')} ${p.info}`;
            const clipped = raw.padEnd(cols, ' ').slice(0, cols);

            if (p.isAlert || (state?.alertActive && isSelected)) {
                out.push(`{error}${clipped}{/}`);
            } else if (isSelected) {
                out.push(`{peak}${clipped}{/}`);
            } else {
                out.push(clipped);
            }
        }

        // Tier 2: Protocol Tree Decode
        out.push(sep);
        const act = this.activePkt || PROTO_TEMPLATES[0];
        const frameHdr = `v FRAME ${act.no}: ${act.len} BYTES ON WIRE (${act.len * 8} BITS) // IFACE: eth0 [PROMISC]`.slice(
            0,
            cols
        );
        out.push(`{peak}${frameHdr}{/}`);
        out.push(
            `  +-- Ethernet II, Src: 00:1a:79:41:09:00, Dst: 00:0c:29:9f:3b:12 [ETHERTYPE: 0x0800]`.slice(
                0,
                cols
            )
        );
        out.push(
            `  +-- Internet Protocol v4, Src: ${act.src.split(':')[0]}, Dst: ${act.dst.split(':')[0]}, TTL: 58, DF`.slice(
                0,
                cols
            )
        );
        out.push(`  +-- ${act.l4}`.slice(0, cols));
        const l7Line = `  +-- ${act.l7}`.slice(0, cols);
        out.push(act.isAlert ? `{error}${l7Line}{/}` : `{peak}${l7Line}{/}`);

        // Tier 3: Hex + ASCII Frame Payload Inspector
        out.push(sep);
        for (const hRow of this.hexRows) {
            out.push(hRow.slice(0, cols));
        }

        this.lines = out.slice(0, rows);
        this.adapter.setLines(this.lines);
    }

    destroy() {
        this.packets = [];
        this.hexRows = [];
        this.lines = [];
        this.adapter = null;
    }
}
