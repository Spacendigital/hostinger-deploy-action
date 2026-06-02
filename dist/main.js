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
exports.run = run;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const deploy_1 = require("./deploy");
const ssh_deploy_1 = require("./ssh-deploy");
const github_status_1 = require("./github-status");
function getInputs() {
    return {
        host: core.getInput('host', { required: true }),
        username: core.getInput('username', { required: true }),
        password: core.getInput('password'),
        privateKey: core.getInput('private-key'),
        port: parseInt(core.getInput('port') || '22', 10),
        domain: core.getInput('domain'),
        targetDir: core.getInput('target-dir'),
        buildCommand: core.getInput('build-command'),
        deployMode: (core.getInput('deploy-mode') || 'ssh'),
        installCommand: core.getInput('install-command'),
        clean: core.getInput('clean')?.toLowerCase() === 'true',
        environment: core.getInput('environment') || 'production',
        liveUrl: core.getInput('live-url'),
        sourceDir: core.getInput('source-dir') || 'out',
    };
}
async function run() {
    const inputs = getInputs();
    const ref = github.context.ref;
    core.info('🚀 Hostinger Deploy Action');
    core.info(`  Mode: ${inputs.deployMode}`);
    core.info(`  Server: ${inputs.host}:${inputs.port}`);
    let deploymentId = null;
    try {
        const deployment = await (0, github_status_1.createDeployment)(inputs.environment, ref);
        deploymentId = deployment?.deploymentId ?? null;
        if (deploymentId) {
            await (0, github_status_1.createDeploymentStatus)(deploymentId, 'in_progress', inputs.liveUrl);
        }
        let result;
        if (inputs.deployMode === 'ssh') {
            result = await (0, ssh_deploy_1.sshDeploy)(inputs);
        }
        else {
            result = await (0, deploy_1.deploy)(inputs);
        }
        const liveUrl = result.hostname || inputs.liveUrl;
        const logUrl = `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`;
        if (result.success) {
            core.info(`✅ Deploy succeeded in ${(result.durationMs / 1000).toFixed(1)}s`);
            core.setOutput('deploy-status', 'success');
            if (deploymentId) {
                await (0, github_status_1.createDeploymentStatus)(deploymentId, 'success', liveUrl, logUrl);
            }
        }
        else {
            const msg = result.error || 'Unknown error';
            core.error(`❌ Deploy failed: ${msg}`);
            core.setFailed(msg);
            core.setOutput('deploy-status', 'failure');
            if (deploymentId) {
                await (0, github_status_1.createDeploymentStatus)(deploymentId, 'failure', liveUrl);
            }
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        core.setFailed(msg);
        if (deploymentId) {
            await (0, github_status_1.createDeploymentStatus)(deploymentId, 'failure', inputs.liveUrl);
        }
    }
}
