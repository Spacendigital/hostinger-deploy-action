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

export async function sshDeploy(inputs: ActionInputs): Promise<DeployResult> {
  const startTime = Date.now();
  let detectedUrl = '';

  try {
    if (inputs.password) {
      await ensureSshpass();
    }

    core.startGroup('🔍 Detecting live URL');
    try {
      let hostname = '';
      await runRemote(inputs, 'hostname', {
        silent: true,
        stdout: (data) => { hostname += data.toString(); },
      });
      hostname = hostname.trim().toLowerCase();
      if (hostname && hostname.includes('.')) {
        detectedUrl = `https://${hostname}`;
        core.info(`Auto-detected: ${detectedUrl}`);
      } else {
        core.info('Could not auto-detect URL (hostname has no domain)');
      }
    } catch {
      core.info('Could not auto-detect URL');
    }
    core.endGroup();

    const deployCmd = [
      `cd ${inputs.targetDir}`,
      'git pull',
      inputs.installCommand,
      inputs.buildCommand,
    ].join(' && ');

    core.startGroup('🚀 Deploying via SSH');
    core.info(`Server: ${inputs.host}:${inputs.port}`);
    core.info(`Target: ${inputs.targetDir}`);
    core.info('');

    let deployOutput = '';
    const exitCode = await runRemote(inputs, deployCmd, {
      stdout: (data) => {
        const str = data.toString();
        deployOutput += str;
        process.stdout.write(data);
      },
      stderr: (data) => {
        const str = data.toString();
        deployOutput += str;
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
