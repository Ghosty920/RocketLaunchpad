import { invoke } from '@tauri-apps/api/core';
import { Account } from '../types';
import { PartialPlayer } from '../pages/LiveGame';

export type CachedStats = {
	data?: any;
	expires?: number;
	error?: { message: string; expires: number };
};

function getCacheKey(accountId: string): string {
	return `stats_${accountId}`;
}

function readStatsCache(accountId: string): CachedStats | null {
	const storedItem = localStorage.getItem(getCacheKey(accountId));
	if (!storedItem) return null;
	try {
		return JSON.parse(storedItem) as CachedStats;
	} catch {
		return null;
	}
}

function writeStatsCache(accountId: string, update: Partial<CachedStats>): CachedStats {
	const existing = readStatsCache(accountId) ?? {};
	const next = { ...existing, ...update };
	localStorage.setItem(getCacheKey(accountId), JSON.stringify(next));
	return next;
}

export function clearCacheError(accountId: string): void {
	const existing = readStatsCache(accountId);
	if (!existing?.error) return;
	const { error, ...rest } = existing;
	localStorage.setItem(getCacheKey(accountId), JSON.stringify(rest));
}

export function getCachedStats(accountId: string): any | null {
	return readStatsCache(accountId)?.data ?? null;
}

export function getCachedErrorMessage(accountId: string): string | null {
	const cached = readStatsCache(accountId);
	if (!cached?.error) return null;
	return Date.now() <= cached.error.expires ? cached.error.message : null;
}

export function getAccountAsPartialPlayer(account: Account): PartialPlayer {
	return {
		Name: account.Username,
		PrimaryId: `Epic|${account.AccountId}|0`,
	};
}

export function getPlatformFromPrimaryId(primaryId: string): string {
	const raw = primaryId.split('|')[0].toLowerCase();
	if (raw === 'epic') return 'epic';
	if (raw === 'steam') return 'steam';
	if (raw.startsWith('ps')) return 'psn';
	if (raw.startsWith('xb')) return 'xbl';
	if (raw.startsWith('sw')) return 'switch';
	console.log('Unknown platform for primaryId:', primaryId);
	return 'epic'; // simple fallback
}

export async function getStats(account: Account | PartialPlayer): Promise<any> {
	if ('Username' in account) return getStats(getAccountAsPartialPlayer(account));
	const accountId = account.PrimaryId.split('|')[1];

	const cached = readStatsCache(accountId);
	const now = Date.now();
	if (cached?.error && now <= cached.error.expires) {
		throw new Error(cached.error.message || 'Cached error');
	}
	if (cached?.data && cached.expires && now <= cached.expires) return cached.data;

	try {
		const platform = getPlatformFromPrimaryId(account.PrimaryId);
		const username = platform === 'steam' ? accountId : account.Name;
		const result = await invoke<any>('get_stats', {
			username,
			platform,
		});
		const data = JSON.parse(result).data;

		writeStatsCache(accountId, {
			data,
			expires: new Date(data.expiryDate).getTime(),
		});
		clearCacheError(accountId);
		return data;
	} catch (err) {
		const message = err instanceof Error ? err.toString() : String(err);
		writeStatsCache(accountId, {
			error: {
				message,
				expires: Date.now() + 10 * 1000,
			},
		});
		throw err;
	}
}

export function getRankImage(url: string): string {
	return 'ranks/' + url.split('/').slice(-1)[0];
}

export const playlistIds = {
	0: 'Casual',
	10: '1v1',
	11: '2v2',
	13: '3v3',
	61: '4v4',
	27: 'Hoops',
	28: 'Rumble',
	29: 'Dropshot',
	30: 'Snowday',
	34: 'Tournament',
} satisfies Record<number, string>;
