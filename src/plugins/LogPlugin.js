import { Text, TextStyle } from 'pixi.js';

const LOG_MESSAGES = [
    "INITIALIZING KERNEL SUBROUTINE...",
    "BYPASSING SECURITY NODE 42...",
    "DECRYPTING 256-BIT STREAM...",
    "ACCESS GRANTED: LEVEL 5 CLEARANCE",
    "UPLOADING VIRUS.EXE [||||||....]",
    "SCANNING PORTS 8080-9000...",
    "TRACE COMPLETE. IP: 192.168.0.1",
    "ESTABLISHING SECURE HANDSHAKE...",
    "PACKET LOSS DETECTED. RETRYING...",
    "ROOT ACCESS: CONFIRMED",
    "COMPILING SOURCE CODE...",
    "EXECUTING BUFFER OVERFLOW...",
    "FIREWALL BREACH SUCCESSFUL",
    "DOWNLOADING DATABASE 'USERS_TABLE'...",
    "ENCRYPTING PAYLOAD...",
    "CLEANING LOG FILES...",
    "TERMINATING CONNECTION...",
    "SYSTEM REBOOT REQUIRED",
    "MOUNTING VIRTUAL DRIVE Z:...",
    "ALLOCATING MEMORY BLOCK 0x4F2A...",
];

export class LogPlugin {
    constructor() {
        this.container = null;
        this.width = 0;
        this.height = 0;
        this.lines = [];
        this.textObject = null;
        this.lineHeight = 16; // Slightly larger for readability
        this.maxLines = 0;
        this.timer = 0;
        this.speed = 0.1; // Default append speed (seconds per line)
    }

    init(context) {
        this.container = context.container;
        this.width = context.width;
        this.height = context.height;
        
        // Calculate how many lines fit
        this.maxLines = Math.floor(this.height / this.lineHeight);
        
        const style = new TextStyle({
            fontFamily: 'monospace',
            fontSize: 14,
            fill: '#00FF00',
            wordWrap: true,
            wordWrapWidth: this.width,
            lineHeight: this.lineHeight
        });

        // Single text object for the whole log (efficient for simple scrolling)
        this.textObject = new Text({ text: '', style });
        this.container.addChild(this.textObject);
        
        // Start with a few lines
        this.appendLog("SYSTEM READY.");
    }

    appendLog(message) {
        // Add timestamp
        const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
        const line = `[${timestamp}] ${message}`;
        
        this.lines.push(line);
        
        // Keep only visible lines + buffer
        if (this.lines.length > this.maxLines) {
            this.lines.shift();
        }
        
        this.render();
    }

    update(dt) {
        this.timer += dt;
        if (this.timer > this.speed) {
            this.timer = 0;
            // Randomly vary speed for realism
            this.speed = 0.05 + Math.random() * 0.2;
            
            const randomMsg = LOG_MESSAGES[Math.floor(Math.random() * LOG_MESSAGES.length)];
            this.appendLog(randomMsg);
        }
    }

    render() {
        this.textObject.text = this.lines.join('\n');
        
        // Align to bottom
        // If we have fewer lines than max, sit at top. 
        // If full, it naturally fills. 
        // Actually, terminals usually fill from top, then scroll.
        // My array shift logic handles the scrolling content.
        // So simple join is enough.
    }

    destroy() {
        this.container.removeChildren();
    }
}
