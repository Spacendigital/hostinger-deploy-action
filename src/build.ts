import * as exec from '@actions/exec';
import * as core from '@actions/core';

export async function runInstall(command: string): Promise<void> {
  core.startGroup('📦 Installing dependencies');
  try {
    const exitCode = await exec.exec(command, [], {
      ignoreReturnCode: false,
    });
    core.info(`Install completed with exit code ${exitCode}`);
  } catch (error) {
    core.setFailed(`Install failed: ${error}`);
    throw error;
  } finally {
    core.endGroup();
  }
}

export async function runBuild(command: string): Promise<void> {
  core.startGroup('🏗️ Building project');
  try {
    const exitCode = await exec.exec(command, [], {
      ignoreReturnCode: false,
    });
    core.info(`Build completed with exit code ${exitCode}`);
  } catch (error) {
    core.setFailed(`Build failed: ${error}`);
    throw error;
  } finally {
    core.endGroup();
  }
}
