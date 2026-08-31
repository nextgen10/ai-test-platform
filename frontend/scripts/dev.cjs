/**
 * Local UI with a usable Network URL.
 *
 * `next dev --hostname 0.0.0.0` is required so IPv4 LAN clients can connect
 * (Windows in particular). Next then prints Network as http://0.0.0.0:port,
 * which a browser cannot open — so this wrapper reprints real LAN addresses.
 */
const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const port = process.env.PORT || '3100';
const nextBin = require.resolve('next/dist/bin/next');
const frontendDir = path.join(__dirname, '..');

function lanIpv4() {
    const ips = [];
    try {
        for (const addrs of Object.values(os.networkInterfaces())) {
            for (const addr of addrs ?? []) {
                const family = String(addr.family);
                if ((family === 'IPv4' || family === '4') && !addr.internal) {
                    ips.push(addr.address);
                }
            }
        }
    } catch {
        /* CI / sandboxes cannot list interfaces */
    }
    return [...new Set(ips)];
}

const child = spawn(
    process.execPath,
    [nextBin, 'dev', '--turbopack', '--hostname', '0.0.0.0', '--port', String(port)],
    { stdio: 'inherit', cwd: frontendDir, env: process.env },
);

child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
});

setTimeout(() => {
    console.log('');
    console.log(`  Local    http://localhost:${port}`);
    for (const ip of lanIpv4()) {
        console.log(`  Network  http://${ip}:${port}`);
    }
    console.log('  Do not open http://0.0.0.0 — that is a bind address, not a URL.');
    console.log('');
}, 1200);
