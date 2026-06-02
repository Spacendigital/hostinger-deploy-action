import * as core from '@actions/core';
import * as github from '@actions/github';

export interface DeploymentInfo {
  deploymentId: number;
  environment: string;
}

function getToken(): string {
  return core.getInput('token') || process.env.GITHUB_TOKEN || '';
}

function getOctokit(): ReturnType<typeof github.getOctokit> | null {
  const token = getToken();
  if (!token) {
    core.warning('No GitHub token available. Skipping deployment status.');
    return null;
  }
  return github.getOctokit(token);
}

export async function createDeployment(
  environment: string,
  ref: string
): Promise<DeploymentInfo | null> {
  const octokit = getOctokit();
  if (!octokit) return null;
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
  liveUrl?: string,
  logUrl?: string
): Promise<void> {
  const octokit = getOctokit();
  if (!octokit) return;
  const { owner, repo } = github.context.repo;

  core.startGroup(`🏷️ Setting deployment status to ${state}`);

  try {
    const params: any = {
      owner,
      repo,
      deployment_id: deploymentId,
      state,
      description:
        state === 'success'
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
