import { invoke } from '@tauri-apps/api/core';
import { Account } from '../types';
import { PartialPlayer } from '../pages/LiveGame';

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

	const platform = getPlatformFromPrimaryId(account.PrimaryId);
	const username = platform === 'steam' ? accountId : account.Name;
	const result = await invoke<any>('get_stats', {
		username,
		platform,
	});
	const data = JSON.parse(result).data;
	return data;
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
