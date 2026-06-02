import * as core from '@actions/core';
import * as github from '@actions/github';

export interface DeploymentInfo {
  deploymentId: number;
  environment: string;
}

function getOctokit(): ReturnType<typeof github.getOctokit> {
  const token = process.env.GITHUB_TOKEN ?? '';
  return github.getOctokit(token);
}

export async function createDeployment(
  environment: string,
  ref: string
): Promise<DeploymentInfo | null> {
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

    const data = response.data as any;
    const deploymentId = data.id;

    core.info(`Created deployment #${deploymentId} for ${environment}`);
    core.endGroup();
    return { deploymentId, environment };
  } catch (error) {
    core.warning(
      `Failed to create deployment: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    core.endGroup();
    return null;
  }
}

export async function createDeploymentStatus(
  deploymentId: number,
  state: 'success' | 'failure' | 'pending' | 'in_progress',
  liveUrl: string,
  logUrl?: string
): Promise<void> {
  const octokit = getOctokit();
  const { owner, repo } = github.context.repo;

  core.startGroup(`🏷️ Setting deployment status to ${state}`);

  try {
    await octokit.rest.repos.createDeploymentStatus({
      owner,
      repo,
      deployment_id: deploymentId,
      state,
      environment_url: liveUrl,
      log_url: logUrl,
      description:
        state === 'success'
          ? 'Deployment successful ✅'
          : state === 'failure'
          ? 'Deployment failed ❌'
          : 'Deployment in progress...',
    });
    core.info(`Status set to ${state}`);
  } catch (error) {
    core.warning(
      `Failed to set deployment status: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    core.endGroup();
  }
}
