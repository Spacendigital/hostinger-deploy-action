import * as exec from '@actions/exec';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import type { ActionInputs, DeployResult } from './types';

async function ensureSshpass(): Promise<void> {
  try {
    await exec.exec('which', ['sshpass'], { silent: true });
  } catch {
    core.info('Installing sshpass...');
    await exec.exec('sudo apt-get update -qq', [], { silent: true });
    await exec.exec('sudo apt-get install -y -qq sshpass', [], { silent: true });
  }
}

function sshArgs(inputs: ActionInputs): string[] {
  return [
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'LogLevel=ERROR',
    '-p', String(inputs.port),
  ];
}

async function runRemote(
  inputs: ActionInputs,
  command: string,
  opts?: { silent?: boolean; stdout?: (data: Buffer) => void; stderr?: (data: Buffer) => void }
): Promise<number> {
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

async function findMatchingDir(inputs: ActionInputs): Promise<string | null> {
  const repoFullName = `${github.context.repo.owner}/${github.context.repo.repo}`;

  core.startGroup('🔍 Scanning server for matching git repo');
  core.info(`Looking for: ${repoFullName}`);

  let dirList = '';
  const scanCmd =
    `for d in /home/${inputs.username}/domains/*/public_nodejs; do ` +
    'if [ -d "$d/.git" ]; then echo "$d"; fi; done';

  await runRemote(inputs, scanCmd, {
    silent: true,
    stdout: (data) => { dirList += data.toString(); },
  });

  const dirs = dirList.trim().split('\n').filter(Boolean);

  for (const dir of dirs) {
    let remoteUrl = '';
    await runRemote(inputs, `cd "${dir}" && git remote get-url origin 2>/dev/null`, {
      silent: true,
      stdout: (data) => { remoteUrl += data.toString(); },
    });

    if (remoteUrl.trim().replace(/\.git$/, '').includes(repoFullName)) {
      core.info(`Matched: ${dir}`);
      core.endGroup();
      return dir.trim();
    }
  }

  core.warning('No matching git repo found on the server.');
  core.endGroup();
  return null;
}

async function resolveTargetDir(inputs: ActionInputs): Promise<string> {
  if (inputs.domain) {
    return `/home/${inputs.username}/domains/${inputs.domain}/public_nodejs`;
  }
  if (inputs.targetDir) {
    return inputs.targetDir;
  }

  const matched = await findMatchingDir(inputs);
  if (matched) {
    return matched;
  }

  throw new Error(
    'Could not auto-detect the project directory. ' +
    'Set up Git auto-deploy in hPanel first, or provide `domain` or `target-dir` input.'
  );
}

function extractUrl(dir: string, inputs: ActionInputs): string | undefined {
  if (inputs.liveUrl) return inputs.liveUrl;
  const match = dir.match(/\/domains\/([^/]+)\//);
  if (match) return `https://${match[1]}`;
  return undefined;
}

export async function sshDeploy(inputs: ActionInputs): Promise<DeployResult> {
  const startTime = Date.now();

  try {
    if (inputs.password) {
      await ensureSshpass();
    }

    const targetDir = await resolveTargetDir(inputs);
    const detectedUrl = extractUrl(targetDir, inputs);

    core.info(`Target: ${targetDir}`);
    if (detectedUrl) {
      core.info(`Live URL: ${detectedUrl}`);
    }

    // Run `git fetch` — downloads new commits without touching working tree.
    // Only runs if build-command is set (user opted into local processing).
    if (inputs.buildCommand) {
      const deploySteps = [`cd ${targetDir}`, 'git fetch'];
      if (inputs.installCommand) deploySteps.push(inputs.installCommand);
      if (inputs.buildCommand) deploySteps.push(inputs.buildCommand);
      const deployCmd = deploySteps.join(' && ');

      core.startGroup('🚀 Running deploy commands');
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

    core.info('No build-command set. Hostinger auto-deploy handles the build.');
    return { success: true, fileCount: 0, durationMs: Date.now() - startTime, hostname: detectedUrl || undefined };
  } catch (error) {
    return {
      success: false,
      fileCount: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
