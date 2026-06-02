import * as exec from '@actions/exec';
import * as core from '@actions/core';
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

async function detectTargetDir(inputs: ActionInputs): Promise<string> {
  core.startGroup('🔍 Auto-detecting project directory');
  let result = '';
  const cmd =
    `ls -d /home/${inputs.username}/domains/*/public_nodejs 2>/dev/null | head -1`;
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
  throw new Error(
    `Could not find project directory. Expected /home/${inputs.username}/domains/*/public_nodejs`
  );
}

function extractUrlFromPath(dir: string): string | null {
  const match = dir.match(/\/domains\/([^/]+)\//);
  if (match) {
    return `https://${match[1]}`;
  }
  return null;
}

export async function sshDeploy(inputs: ActionInputs): Promise<DeployResult> {
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
  } catch (error) {
    return {
      success: false,
      fileCount: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
