export interface ActionInputs {
  host: string;
  username: string;
  password?: string;
  privateKey?: string;
  port: number;
  domain?: string;
  targetDir?: string;
  buildCommand: string;
  deployMode: 'ssh' | 'sftp' | 'ftp';
  installCommand: string;
  clean: boolean;
  environment: string;
  liveUrl?: string;
  sourceDir: string;
}

export interface DeployResult {
  success: boolean;
  fileCount: number;
  durationMs: number;
  error?: string;
  hostname?: string;
}
