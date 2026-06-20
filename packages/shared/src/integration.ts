export type IntegrationClient = 'cursor' | 'claude-code';

export type IntegrationAggregateStatus = 'not_installed' | 'installed' | 'update_available';

export type SkillInstallTarget =
  | { kind: 'personal' }
  | { kind: 'project'; repoRoot: string };

export const INTEGRATION_MIN_NODE_VERSION = '20.0.0';

export interface IntegrationManifest {
  bundleVersion: string;
  skillContentHash: string;
  generatedAt: string;
}

export interface IntegrationPrerequisites {
  node: { ok: boolean; version?: string; message?: string };
  cert: { ok: boolean; message?: string };
  allMet: boolean;
}

export interface IntegrationStepResult {
  ok: boolean;
  message: string;
  path?: string;
}

export interface IntegrationVerifyResult {
  mcpConfigured: boolean;
  skillInstalled: boolean;
  hookInstalled: boolean;
  apiReachable: boolean;
  certTrusted: boolean;
  nodeOk: boolean;
  nodeVersion?: string;
  details: string[];
}

export interface IntegrationVerifyParams {
  personalSkill: boolean;
  projectRoots: string[];
}

export interface IntegrationSkillRecord {
  id: string;
  kind: 'personal' | 'project';
  path: string;
  repoRoot?: string;
  bundleVersion: string;
  skillContentHash: string;
  installedAt: string;
}

export interface IntegrationClientRecord {
  client: IntegrationClient;
  mcpInstalled: boolean;
  hookInstalled: boolean;
  bundleVersion: string;
  skillContentHash: string;
  paths: {
    mcpConfig: string;
    hookConfig: string;
    mcpEntry: string;
    hookScript: string;
  };
  skills: IntegrationSkillRecord[];
  installedAt: string;
}

/** @deprecated migrated to IntegrationClientRecord.skills */
export interface IntegrationInstallRecord {
  id: string;
  client: IntegrationClient;
  installedAt: string;
  bundleVersion: string;
  skillContentHash: string;
  skill: { kind: 'personal' | 'project'; path: string; repoRoot?: string };
  paths: {
    mcpConfig: string;
    hookConfig: string;
    mcpEntry: string;
    hookScript: string;
  };
  verifiedAt?: string;
  verifyOk?: boolean;
}

export interface IntegrationRegistry {
  clients: IntegrationClientRecord[];
  postCertPromptDismissed?: boolean;
  /** @deprecated legacy flat list — migrated on load */
  installs?: IntegrationInstallRecord[];
}

export interface IntegrationClientComponentStatus {
  configured: boolean;
  tracked: boolean;
  path: string;
  configPath?: string;
  outdated: boolean;
}

export interface IntegrationSkillStatus {
  id: string;
  kind: 'personal' | 'project';
  path: string;
  repoRoot?: string;
  configured: boolean;
  tracked: boolean;
  outdated: boolean;
  bundleVersion: string;
}

export interface IntegrationClientStatus {
  client: IntegrationClient;
  bundleVersion: string;
  outdated: boolean;
  mcp: IntegrationClientComponentStatus;
  hook: IntegrationClientComponentStatus;
  skills: IntegrationSkillStatus[];
  hasAnyConfigured: boolean;
}

/** @deprecated use IntegrationClientStatus */
export interface IntegrationInstallStatus {
  record: IntegrationInstallRecord;
  outdated: boolean;
  verifyOk: boolean;
}

export interface IntegrationStatusResult {
  status: IntegrationAggregateStatus;
  manifest: IntegrationManifest;
  clients: IntegrationClientStatus[];
  prerequisites: IntegrationPrerequisites;
  hasAnyInstall: boolean;
}

export type IntegrationUninstallScope = 'mcp' | 'hook' | 'skill' | 'client';

export interface IntegrationUninstallPayload {
  client: IntegrationClient;
  scope: IntegrationUninstallScope;
  skillId?: string;
}

export interface IntegrationUninstallResult {
  ok: boolean;
  message: string;
}

export interface IntegrationUpdatePayload {
  recordIds?: string[];
  client?: IntegrationClient;
}

export const CLIENT_LABEL: Record<IntegrationClient, string> = {
  cursor: 'Cursor',
  'claude-code': 'Claude Code',
};
