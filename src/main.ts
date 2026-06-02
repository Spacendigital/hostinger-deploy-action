import * as core from '@actions/core';
import * as github from '@actions/github';
import { runInstall, runBuild } from './build';
import { deploy } from './deploy';
import { createDeployment, createDeploymentStatus } from './github-status';
import type { ActionInputs } from './types';

function getInputs(): ActionInputs {
  return {
    host: core.getInput('host'),
    username: core.getInput('username'),
    password: core.getInput('password'),
    privateKey: core.getInput('private-key'),
    targetDir: core.getInput('target-dir'),
    buildCommand: core.getInput('build-command') || 'npm run build',
    deployMode: (core.getInput('deploy-mode') || 'auto') as 'auto' | 'sftp' | 'ftp',
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
  const sha = github.context.sha;

  core.info(`🚀 Starting Hostinger Deploy Action`);
  core.info(`  Environment: ${inputs.environment}`);
  core.info(`  Live URL: ${inputs.liveUrl}`);
  core.info(`  Deploy mode: ${inputs.deployMode}`);
  if (inputs.deployMode !== 'auto') {
    core.info(`  Target dir: ${inputs.targetDir}`);
  }

  let deploymentId: number | null = null;

  try {
    const deployment = await createDeployment(inputs.environment, ref);
    deploymentId = deployment?.deploymentId ?? null;

    if (deploymentId) {
      await createDeploymentStatus(
        deploymentId,
        'in_progress',
        inputs.liveUrl
      );
    }

    await runInstall(inputs.installCommand);
    await runBuild(inputs.buildCommand);

    if (inputs.deployMode === 'auto') {
      core.info('ℹ️ Auto mode: Hostinger pulls from Git automatically. Skipping file upload.');
      core.info('✅ Build passed. Hostinger will deploy the latest commit.');
      core.setOutput('deploy-status', 'success');
      core.setOutput('deploy-method', 'auto-git');

      if (deploymentId) {
        await createDeploymentStatus(
          deploymentId,
          'success',
          inputs.liveUrl,
          `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
        );
      }
      return;
    }

    const result = await deploy(inputs);

    if (result.success) {
      core.info(
        `✅ Deployed ${result.fileCount} files in ${result.durationMs}ms`
      );
      core.setOutput('deploy-status', 'success');
      core.setOutput('file-count', String(result.fileCount));
      core.setOutput('duration-ms', String(result.durationMs));

      if (deploymentId) {
        await createDeploymentStatus(
          deploymentId,
          'success',
          inputs.liveUrl,
          `${github.context.serverUrl}/${github.context.repo.owner}/${github.context.repo.repo}/actions/runs/${github.context.runId}`
        );
      }
    } else {
      core.setFailed(
        `Deploy failed: ${result.error ?? 'Unknown error'}`
      );
      core.setOutput('deploy-status', 'failure');

      if (deploymentId) {
        await createDeploymentStatus(
          deploymentId,
          'failure',
          inputs.liveUrl
        );
      }
    }
  } catch (error) {
    core.setFailed(
      `Action failed: ${error instanceof Error ? error.message : String(error)}`
    );

    if (deploymentId) {
      await createDeploymentStatus(deploymentId, 'failure', inputs.liveUrl);
    }
  }
}
