import * as core from '@actions/core';
import * as github from '@actions/github';
import { deploy } from './deploy';
import { sshDeploy } from './ssh-deploy';
import { createDeployment, createDeploymentStatus } from './github-status';
import type { ActionInputs } from './types';

function getInputs(): ActionInputs {
  return {
    host: core.getInput('host', { required: true }),
    username: core.getInput('username', { required: true }),
    password: core.getInput('password'),
    privateKey: core.getInput('private-key'),
    port: parseInt(core.getInput('port') || '22', 10),
    targetDir: core.getInput('target-dir', { required: true }),
    buildCommand: core.getInput('build-command') || 'npm run build',
    deployMode: (core.getInput('deploy-mode') || 'ssh') as 'ssh' | 'sftp' | 'ftp',
    installCommand: core.getInput('install-command') || 'npm ci',
    clean: core.getInput('clean')?.toLowerCase() === 'true',
    environment: core.getInput('environment') || 'production',
    liveUrl: core.getInput('live-url'),
    sourceDir: core.getInput('source-dir') || 'out',
  };
}

export async function run(): Promise<void> {
  const inputs = getInputs();
  const ref = github.context.ref;

  core.info('🚀 Hostinger Deploy Action');
  core.info(`  Mode: ${inputs.deployMode}`);
  core.info(`  Server: ${inputs.host}:${inputs.port}`);
  core.info(`  Target: ${inputs.targetDir}`);

  let deploymentId: number | null = null;

  try {
    const deployment = await createDeployment(inputs.environment, ref);
    deploymentId = deployment?.deploymentId ?? null;

    if (deploymentId) {
      await createDeploymentStatus(deploymentId, 'in_progress', inputs.liveUrl);
    }

    let result;
    if (inputs.deployMode === 'ssh') {
      result = await sshDeploy(inputs);
    } else {
      result = await deploy(inputs);
    }

    const liveUrl = result.hostname || inputs.liveUrl;
    const logUrl = `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`;

    if (result.success) {
      core.info(`✅ Deploy succeeded in ${(result.durationMs / 1000).toFixed(1)}s`);
      core.setOutput('deploy-status', 'success');

      if (deploymentId) {
        await createDeploymentStatus(deploymentId, 'success', liveUrl, logUrl);
      }
    } else {
      const msg = result.error || 'Unknown error';
      core.error(`❌ Deploy failed: ${msg}`);
      core.setFailed(msg);
      core.setOutput('deploy-status', 'failure');

      if (deploymentId) {
        await createDeploymentStatus(deploymentId, 'failure', liveUrl);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    core.setFailed(msg);

    if (deploymentId) {
      await createDeploymentStatus(deploymentId, 'failure', inputs.liveUrl);
    }
  }
}
