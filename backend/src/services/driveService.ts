import { execa } from 'execa';

import type { DriveInfo, DrivePartition } from '../models/drive.js';

type LsblkEntry = {
  name: string;
  path?: string;
  type?: string;
  size?: number | string;
  serial?: string;
  model?: string;
  vendor?: string;
  rota?: number | string;
  tran?: string;
  rev?: string;
  wwn?: string;
  uuid?: string;
  mountpoints?: Array<string | null> | string | null;
  pkname?: string;
  state?: string;
  children?: LsblkEntry[];
};

type LsblkOutput = {
  blockdevices?: LsblkEntry[];
};

const FULL_COLUMNS = [
  'NAME',
  'PATH',
  'TYPE',
  'SIZE',
  'SERIAL',
  'MODEL',
  'VENDOR',
  'ROTA',
  'TRAN',
  'REV',
  'WWN',
  'UUID',
  'MOUNTPOINTS',
  'PKNAME',
  'STATE',
];

// Fallback for distros that do not support every column above.
const FALLBACK_COLUMNS = [
  'NAME',
  'PATH',
  'TYPE',
  'SIZE',
  'MODEL',
  'SERIAL',
  'VENDOR',
  'TRAN',
  'ROTA',
  'MOUNTPOINTS',
  'UUID',
];

const normalizeMounts = (input: LsblkEntry['mountpoints']): string[] => {
  if (Array.isArray(input)) {
    return input.filter((m): m is string => Boolean(m && m.length)).map(String);
  }
  if (typeof input === 'string') {
    return input.length ? [input] : [];
  }
  return [];
};

const parseSize = (size?: number | string): number | undefined => {
  if (typeof size === 'number') return size;
  if (typeof size === 'string' && size.trim()) {
    const parsed = Number(size);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const parseRotational = (rota?: number | string): boolean | null => {
  if (rota === undefined || rota === null) return null;
  const num = typeof rota === 'string' ? Number(rota) : rota;
  if (num === 1) return true;
  if (num === 0) return false;
  return null;
};

const mapPartition = (entry: LsblkEntry): DrivePartition => ({
  name: entry.name,
  ...(entry.path ? { path: entry.path } : {}),
  ...(() => {
    const size = parseSize(entry.size);
    return size !== undefined ? { sizeBytes: size } : {};
  })(),
  ...(entry.uuid !== undefined ? { uuid: entry.uuid ?? null } : {}),
  ...(entry.mountpoints !== undefined ? { mountpoints: normalizeMounts(entry.mountpoints) } : {}),
});

const mapDrive = (entry: LsblkEntry): DriveInfo => ({
  name: entry.name,
  ...(entry.path ? { path: entry.path } : {}),
  ...(() => {
    const size = parseSize(entry.size);
    return size !== undefined ? { sizeBytes: size } : {};
  })(),
  ...(entry.serial !== undefined ? { serial: entry.serial ?? null } : {}),
  ...(entry.model !== undefined ? { model: entry.model ?? null } : {}),
  ...(entry.vendor !== undefined ? { vendor: entry.vendor ?? null } : {}),
  ...(entry.tran !== undefined ? { transport: entry.tran ?? null } : {}),
  ...(entry.rota !== undefined ? { rotational: parseRotational(entry.rota) } : {}),
  ...(entry.rev !== undefined ? { firmware: entry.rev ?? null } : {}),
  ...(entry.wwn !== undefined ? { wwn: entry.wwn ?? null } : {}),
  ...(entry.state !== undefined ? { state: entry.state ?? null } : {}),
  ...(entry.mountpoints !== undefined ? { mountpoints: normalizeMounts(entry.mountpoints) } : {}),
  partitions: (entry.children ?? []).map(mapPartition),
});

export const listDrives = async (): Promise<DriveInfo[]> => {
  const tryLsblk = async (columns: string[]) => {
    const { stdout } = await execa('lsblk', ['-J', '-b', '-o', columns.join(',')], {
      env: { LC_ALL: 'C' },
    });
    return JSON.parse(stdout) as LsblkOutput;
  };

  let parsed: LsblkOutput | null = null;

  try {
    parsed = await tryLsblk(FULL_COLUMNS);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('lsblk full column set failed, retrying with fallback set', error);
    parsed = await tryLsblk(FALLBACK_COLUMNS);
  }

  const devices = parsed.blockdevices ?? [];

  return devices.filter((d) => d.type === 'disk').map(mapDrive);
};
