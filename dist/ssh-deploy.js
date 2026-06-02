"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sshDeploy = sshDeploy;
const exec = __importStar(require("@actions/exec"));
const core = __importStar(require("@actions/core"));
const fs = __importStar(require("fs"));
async function ensureSshpass() {
    try {
        await exec.exec('which', ['sshpass'], { silent: true });
    }
    catch {
        core.info('Installing sshpass...');
        await exec.exec('sudo apt-get update -qq', [], { silent: true });
        await exec.exec('sudo apt-get install -y -qq sshpass', [], { silent: true });
    }
}
function sshArgs(inputs) {
    return [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'LogLevel=ERROR',
        '-p', String(inputs.port),
    ];
}
async function runRemote(inputs, command, opts) {
    const args = [...sshArgs(inputs), `${inputs.username}@${inputs.host}`, command];
    const options = {
        ignoreReturnCode: true,
        silent: opts?.silent ?? false,
        listeners: {
            stdout: opts?.stdout,
            stderr: opts?.stderr,
        },
    };
    if (inputs.password) {
        return exec.exec('sshpass', ['-e', 'ssh', ...args], {
            ...options,
            env: { ...process.env, SSHPASS: inputs.password },
        });
    }
    if (inputs.privateKey) {
        const keyFile = '/tmp/hostinger-key';
        fs.writeFileSync(keyFile, inputs.privateKey, { mode: 0o600 });
        return exec.exec('ssh', ['-i', keyFile, ...args], options);
    }
    throw new Error('Either password or private-key input must be provided');
}
async function detectTargetDir(inputs) {
    core.startGroup('🔍 Auto-detecting project directory');
    let result = '';
    const cmd = `ls -d /home/${inputs.username}/domains/*/public_nodejs 2>/dev/null | head -1`;
    await runRemote(inputs, cmd, {
        silent: true,
        stdout: (data) => { result += data.toString(); },
    });
    const dir = result.trim();
    if (dir) {
        core.info(`Detected: ${dir}`);
        core.endGroup();
        return dir;
    }
    core.warning('Could not auto-detect project directory. Provide target-dir input.');
    core.endGroup();
    throw new Error(`Could not find project directory. Expected /home/${inputs.username}/domains/*/public_nodejs`);
}
function extractUrlFromPath(dir) {
    const match = dir.match(/\/domains\/([^/]+)\//);
    if (match) {
        return `https://${match[1]}`;
    }
    return null;
}
async function sshDeploy(inputs) {
    const startTime = Date.now();
    try {
        if (inputs.password) {
            await ensureSshpass();
        }
        const targetDir = inputs.targetDir || await detectTargetDir(inputs);
        const detectedUrl = inputs.liveUrl || extractUrlFromPath(targetDir) || '';
        if (detectedUrl) {
            core.info(`Live URL: ${detectedUrl}`);
        }
        const deployCmd = [
            `cd ${targetDir}`,
            'git pull',
            inputs.installCommand,
            inputs.buildCommand,
        ].join(' && ');
        core.startGroup('🚀 Deploying via SSH');
        core.info(`${inputs.host}:${inputs.port}`);
        core.info('');
        let deployOutput = '';
        const exitCode = await runRemote(inputs, deployCmd, {
            stdout: (data) => {
                deployOutput += data.toString();
                process.stdout.write(data);
            },
            stderr: (data) => {
                deployOutput += data.toString();
                process.stderr.write(data);
            },
        });
        core.endGroup();
        const durationMs = Date.now() - startTime;
        if (exitCode === 0) {
            return { success: true, fileCount: 0, durationMs, hostname: detectedUrl || undefined };
        }
        const errorHint = deployOutput.split('\n').slice(-5).join('\n');
        return { success: false, fileCount: 0, durationMs, error: errorHint || `Exit code ${exitCode}` };
    }
    catch (error) {
        return {
            success: false,
            fileCount: 0,
            durationMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
