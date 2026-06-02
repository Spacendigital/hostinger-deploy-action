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
const build_1 = require("./build");
const deploy_1 = require("./deploy");
const github_status_1 = require("./github-status");
function getInputs() {
    return {
        host: core.getInput('host'),
        username: core.getInput('username'),
        password: core.getInput('password'),
        privateKey: core.getInput('private-key'),
        targetDir: core.getInput('target-dir'),
        buildCommand: core.getInput('build-command') || 'npm run build',
        deployMode: (core.getInput('deploy-mode') || 'auto'),
        installCommand: core.getInput('install-command') || 'npm ci',
        clean: core.getInput('clean')?.toLowerCase() === 'true',
        environment: core.getInput('environment') || 'production',
        liveUrl: core.getInput('live-url'),
        sourceDir: core.getInput('source-dir') || 'out',
    };
}
async function run() {
    const inputs = getInputs();
    const ref = github.context.ref;
    const sha = github.context.sha;
    core.info(`🚀 Starting Hostinger Deploy Action`);
    core.info(`  Environment: ${inputs.environment}`);
    core.info(`  Live URL: ${inputs.liveUrl}`);
    core.info(`  Deploy mode: ${inputs.deployMode}`);
    if (inputs.deployMode !== 'auto') {
        core.info(`  Target dir: ${inputs.targetDir}`);
    }
    let deploymentId = null;
    try {
        const deployment = await (0, github_status_1.createDeployment)(inputs.environment, ref);
        deploymentId = deployment?.deploymentId ?? null;
        if (deploymentId) {
            await (0, github_status_1.createDeploymentStatus)(deploymentId, 'in_progress', inputs.liveUrl);
        }
        if (inputs.deployMode === 'auto') {
            core.info('ℹ️ Auto mode: Skipping install+build — Hostinger handles this on their server.');
            core.info('✅ Build assumed successful. Hostinger will deploy the latest commit.');
            core.setOutput('deploy-status', 'success');
            core.setOutput('deploy-method', 'auto-git');
            if (deploymentId) {
                await (0, github_status_1.createDeploymentStatus)(deploymentId, 'success', inputs.liveUrl, `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`);
            }
            return;
        }
        await (0, build_1.runInstall)(inputs.installCommand);
        await (0, build_1.runBuild)(inputs.buildCommand);
        const result = await (0, deploy_1.deploy)(inputs);
        if (result.success) {
            core.info(`✅ Deployed ${result.fileCount} files in ${result.durationMs}ms`);
            core.setOutput('deploy-status', 'success');
            core.setOutput('file-count', String(result.fileCount));
            core.setOutput('duration-ms', String(result.durationMs));
            if (deploymentId) {
                await (0, github_status_1.createDeploymentStatus)(deploymentId, 'success', inputs.liveUrl, `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`);
            }
        }
        else {
            core.setFailed(`Deploy failed: ${result.error ?? 'Unknown error'}`);
            core.setOutput('deploy-status', 'failure');
            if (deploymentId) {
                await (0, github_status_1.createDeploymentStatus)(deploymentId, 'failure', inputs.liveUrl);
            }
        }
    }
    catch (error) {
        core.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
        if (deploymentId) {
            await (0, github_status_1.createDeploymentStatus)(deploymentId, 'failure', inputs.liveUrl);
        }
    }
}
