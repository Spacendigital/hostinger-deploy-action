import * as path from 'path';
import * as fs from 'fs';
import * as core from '@actions/core';
import Client from 'ssh2-sftp-client';
import fg from 'fast-glob';
import type { ActionInputs, DeployResult } from './types';

async function ensureRemoteDir(sftp: Client, dir: string): Promise<void> {
  const parts = dir.split('/').filter(Boolean);
  let current = '';
  for (const part of parts) {
    current += '/' + part;
    try {
      await sftp.stat(current);
    } catch {
      core.debug(`Creating remote directory: ${current}`);
      await sftp.mkdir(current, true);
    }
  }
}

async function cleanRemoteDir(sftp: Client, dir: string): Promise<void> {
  core.info(`🧹 Cleaning remote directory: ${dir}`);
  const items = await sftp.list(dir);
  for (const item of items) {
    const fullPath = `${dir}/${item.name}`;
    if (item.type === 'd') {
      await sftp.rmdir(fullPath, true);
    } else {
      await sftp.delete(fullPath);
    }
  }
}

function getFileList(localDir: string): string[] {
  const normalizedDir = localDir.replace(/\/$/, '');
  return fg.sync(`${normalizedDir}/**/*`, {
    dot: true,
    onlyFiles: true,
  });
}

export async function deploy(inputs: ActionInputs): Promise<DeployResult> {
  const startTime = Date.now();
  const sftp = new Client();

  try {
    core.startGroup('🔌 Connecting via SFTP');

    const connectConfig: any = {
      host: inputs.host as string,
      port: 22,
      username: inputs.username as string,
      readyTimeout: 20000,
    };

    if (inputs.privateKey) {
      connectConfig.privateKey = inputs.privateKey;
    } else if (inputs.password) {
      connectConfig.password = inputs.password;
    } else {
      throw new Error(
        'Either password or private-key input must be provided'
      );
    }

    if (inputs.host === 'localhost') {
      connectConfig.algorithms = {
        serverHostKey: [
          'ssh-rsa',
          'ssh-dss',
          'ecdsa-sha2-nistp256',
          'ssh-ed25519',
        ],
      };
    }

    await sftp.connect(connectConfig);
    core.info('✅ Connected successfully');
    core.endGroup();

    core.startGroup('📁 Preparing remote directory');
    const targetDir = inputs.targetDir as string;
    await ensureRemoteDir(sftp, targetDir);
    if (inputs.clean) {
      await cleanRemoteDir(sftp, targetDir);
    }
    core.endGroup();

    core.startGroup('📤 Uploading files');
    const files = getFileList(inputs.sourceDir);
    core.info(`Found ${files.length} files to upload`);

    let uploaded = 0;
    const batchSize = 10;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (file) => {
          const relativePath = path.relative(inputs.sourceDir, file);
          const remotePath = path.join(targetDir, relativePath).replace(/\\/g, '/');
          const remoteDir = path.dirname(remotePath);

          await ensureRemoteDir(sftp, remoteDir);
          await sftp.put(file, remotePath);
          uploaded++;
        })
      );

      const percent = Math.round((uploaded / files.length) * 100);
      core.info(`Progress: ${uploaded}/${files.length} (${percent}%)`);
    }

    core.info(`✅ Upload complete: ${uploaded} files`);
    core.endGroup();

    await sftp.end();

    const durationMs = Date.now() - startTime;
    return { success: true, fileCount: uploaded, durationMs };
  } catch (error) {
    try {
      await sftp.end();
    } catch {}
    const durationMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, fileCount: 0, durationMs, error: message };
  }
}
