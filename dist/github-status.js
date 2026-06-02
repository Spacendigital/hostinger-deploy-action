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
exports.createDeployment = createDeployment;
exports.createDeploymentStatus = createDeploymentStatus;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
function getOctokit() {
    const token = process.env.GITHUB_TOKEN ?? '';
    return github.getOctokit(token);
}
async function createDeployment(environment, ref) {
    const octokit = getOctokit();
    const { owner, repo } = github.context.repo;
    core.startGroup('📋 Creating GitHub Deployment');
    try {
        const response = await octokit.rest.repos.createDeployment({
            owner,
            repo,
            ref,
            environment,
            auto_merge: false,
            required_contexts: [],
        });
        if (response.status !== 201) {
            core.warning(`Deployment creation returned status ${response.status}`);
            return null;
        }
        const data = response.data;
        const deploymentId = data.id;
        core.info(`Created deployment #${deploymentId} for ${environment}`);
        core.endGroup();
        return { deploymentId, environment };
    }
    catch (error) {
        core.warning(`Failed to create deployment: ${error instanceof Error ? error.message : String(error)}`);
        core.endGroup();
        return null;
    }
}
async function createDeploymentStatus(deploymentId, state, liveUrl, logUrl) {
    const octokit = getOctokit();
    const { owner, repo } = github.context.repo;
    core.startGroup(`🏷️ Setting deployment status to ${state}`);
    try {
        const params = {
            owner,
            repo,
            deployment_id: deploymentId,
            state,
            description: state === 'success'
                ? 'Deployment successful ✅'
                : state === 'failure'
                    ? 'Deployment failed ❌'
                    : 'Deployment in progress...',
        };
        if (liveUrl) {
            params.environment_url = liveUrl;
        }
        if (logUrl) {
            params.log_url = logUrl;
        }
        await octokit.rest.repos.createDeploymentStatus(params);
        core.info(`Status set to ${state}`);
    }
    catch (error) {
        core.warning(`Failed to set deployment status: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        core.endGroup();
    }
}
