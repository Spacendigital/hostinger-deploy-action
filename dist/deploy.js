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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deploy = deploy;
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const ssh2_sftp_client_1 = __importDefault(require("ssh2-sftp-client"));
const fast_glob_1 = __importDefault(require("fast-glob"));
async function ensureRemoteDir(sftp, dir) {
    const parts = dir.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
        current += '/' + part;
        try {
            await sftp.stat(current);
        }
        catch {
            core.debug(`Creating remote directory: ${current}`);
            await sftp.mkdir(current, true);
        }
    }
}
async function cleanRemoteDir(sftp, dir) {
    core.info(`🧹 Cleaning remote directory: ${dir}`);
    const items = await sftp.list(dir);
    for (const item of items) {
        const fullPath = `${dir}/${item.name}`;
        if (item.type === 'd') {
            await sftp.rmdir(fullPath, true);
        }
        else {
            await sftp.delete(fullPath);
        }
    }
}
function getFileList(localDir) {
    const normalizedDir = localDir.replace(/\/$/, '');
    return fast_glob_1.default.sync(`${normalizedDir}/**/*`, {
        dot: true,
        onlyFiles: true,
    });
}
async function deploy(inputs) {
    const startTime = Date.now();
    const sftp = new ssh2_sftp_client_1.default();
    try {
        core.startGroup('🔌 Connecting via SFTP');
        const connectConfig = {
            host: inputs.host,
            port: 22,
            username: inputs.username,
            readyTimeout: 20000,
        };
        if (inputs.privateKey) {
            connectConfig.privateKey = inputs.privateKey;
        }
        else if (inputs.password) {
            connectConfig.password = inputs.password;
        }
        else {
            throw new Error('Either password or private-key input must be provided');
        }
        if (inputs.host === 'localhost') {
            connectConfig.algorithms = {
                serverHostKey: [
                    'ssh-rsa',
                    'ssh-dss',
                    'ecdsa-sha2-nistp256',
                    'ssh-ed25519',
                ],
            };
        }
        await sftp.connect(connectConfig);
        core.info('✅ Connected successfully');
        core.endGroup();
        core.startGroup('📁 Preparing remote directory');
        await ensureRemoteDir(sftp, inputs.targetDir);
        if (inputs.clean) {
            await cleanRemoteDir(sftp, inputs.targetDir);
        }
        core.endGroup();
        core.startGroup('📤 Uploading files');
        const files = getFileList(inputs.sourceDir);
        core.info(`Found ${files.length} files to upload`);
        let uploaded = 0;
        const batchSize = 10;
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            await Promise.all(batch.map(async (file) => {
                const relativePath = path.relative(inputs.sourceDir, file);
                const remotePath = path.join(inputs.targetDir, relativePath).replace(/\\/g, '/');
                const remoteDir = path.dirname(remotePath);
                await ensureRemoteDir(sftp, remoteDir);
                await sftp.put(file, remotePath);
                uploaded++;
            }));
            const percent = Math.round((uploaded / files.length) * 100);
            core.info(`Progress: ${uploaded}/${files.length} (${percent}%)`);
        }
        core.info(`✅ Upload complete: ${uploaded} files`);
        core.endGroup();
        await sftp.end();
        const durationMs = Date.now() - startTime;
        return { success: true, fileCount: uploaded, durationMs };
    }
    catch (error) {
        try {
            await sftp.end();
        }
        catch { }
        const durationMs = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, fileCount: 0, durationMs, error: message };
    }
}
