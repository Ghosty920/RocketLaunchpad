import { invoke } from '@tauri-apps/api/core';
import { Account } from '../types';
import { useEffect, useState } from 'react';
import LoadingDots from '../components/LoadingDots';

type CachedStats = {
	data?: any;
	expires?: number;
	error?: { message: string; expires: number };
};

function getCacheKey(account: Account): string {
	return `stats_${account.AccountId}`;
}

function readStatsCache(account: Account): CachedStats | null {
	const storedItem = localStorage.getItem(getCacheKey(account));
	if (!storedItem) return null;
	try {
		return JSON.parse(storedItem) as CachedStats;
	} catch {
		return null;
	}
}

function writeStatsCache(account: Account, update: Partial<CachedStats>): CachedStats {
	const existing = readStatsCache(account) ?? {};
	const next = { ...existing, ...update };
	localStorage.setItem(getCacheKey(account), JSON.stringify(next));
	return next;
}

function clearCacheError(account: Account): void {
	const existing = readStatsCache(account);
	if (!existing?.error) return;
	const { error, ...rest } = existing;
	localStorage.setItem(getCacheKey(account), JSON.stringify(rest));
}

function getCachedStats(account: Account): any | null {
	return readStatsCache(account)?.data ?? null;
}

function getCachedErrorMessage(account: Account): string | null {
	const cached = readStatsCache(account);
	if (!cached?.error) return null;
	return Date.now() <= cached.error.expires ? cached.error.message : null;
}

async function getStats(account: Account): Promise<any> {
	const cached = readStatsCache(account);
	const now = Date.now();
	if (cached?.error && now <= cached.error.expires) {
		throw new Error(cached.error.message || 'Cached error');
	}
	if (cached?.data && cached.expires && now <= cached.expires) return cached.data;

	try {
		const result = await invoke<any>('get_stats', { username: account.Username });
		const data = JSON.parse(result).data;

		writeStatsCache(account, {
			data,
			expires: new Date(data.expiryDate).getTime(),
		});
		clearCacheError(account);
		return data;
	} catch (err) {
		const message = err instanceof Error ? err.toString() : String(err);
		writeStatsCache(account, {
			error: {
				message,
				expires: Date.now() + 10 * 1000,
			},
		});
		throw err;
	}
}

function getImage(url: string): string {
	return 'ranks/' + url.split('/').slice(-1)[0];
}

const playlistIds = {
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

function PlaylistCard({ data, index }: { data: any; index: number }) {
	const ranked = data?.attributes?.playlistId !== 0;
	const rank = data?.stats?.rating?.rank;
	const percentile = data?.stats?.rating?.percentile;
	return (
		<div
			className={`grid grid-cols-subgrid col-span-5 gap-x-5 py-3 ${index % 2 === 0 ? 'bg-white/5' : 'bg-fuchsia-950/5'}`}
		>
			{/* Icon */}
			<img
				className='w-12 h-12 ml-3'
				src={getImage(data?.stats?.tier?.metadata?.iconUrl)}
				alt={data?.stats?.tier?.metadata?.name}
				aria-label={data?.stats?.tier?.metadata?.name}
			/>
			{/* Name and rank */}
			<div className='flex flex-col justify-center'>
				<div className='font-medium'>{data?.metadata?.name}</div>
				{ranked && (
					<div className='text-neutral-400'>
						{data?.stats?.tier?.metadata?.name} {data?.stats?.division?.metadata?.name}
					</div>
				)}
			</div>
			{/* Rating and percentile */}
			<div className='flex flex-col'>
				<div className='font-medium'>{data?.stats?.rating?.displayValue} MMR</div>
				<div className={`font-light ${percentile >= 95 ? 'text-yellow-400' : 'text-stone-400'}`}>
					{rank ? `#${rank.toLocaleString('en-US')} • ` : null}
					{percentile <= 50 ? `Bottom ${percentile.toFixed(1)}%` : `Top ${(100 - percentile).toFixed(1)}%`}
				</div>
			</div>
			{/* Peak rating */}
			<div className='flex flex-col justify-center font-semibold text-center'>
				{ranked && data?.stats?.peakRating?.displayValue ? data?.stats?.peakRating?.displayValue : null}
			</div>
			{/* Matches and win streak */}
			<div className='flex flex-col'>
				{ranked ? (
					<>
						<div>Matches: {data?.stats?.matchesPlayed?.displayValue}</div>
						{data?.stats?.winStreak?.metadata?.type === 'win' && (
							<div className='text-orange-500'>Win Strk. {data?.stats?.winStreak?.value} 🔥</div>
						)}
						{data?.stats?.winStreak?.metadata?.type === 'loss' && (
							<div className='text-indigo-500'>
								Lose Strk. {Math.abs(data?.stats?.winStreak?.value)} ❄️
							</div>
						)}
					</>
				) : null}
			</div>
		</div>
	);
}

function StatsInfo({ data }: { data: any }) {
	const season = data.metadata.currentSeason;
	const playlistKeys = Object.keys(playlistIds);
	const playlists = data.segments
		.filter((s: any) => s.type === 'playlist')
		.filter((s: any) => s.attributes.season === season)
		.filter((s: any) => playlistKeys.includes(String(s.attributes.playlistId)))
		.sort(
			(a: any, b: any) =>
				playlistKeys.indexOf(String(a.attributes.playlistId)) -
				playlistKeys.indexOf(String(b.attributes.playlistId))
		);
	if (playlists.length === 0) return <div>No ranked data found for current season.</div>;
	return (
		<div className='grid grid-cols-[3rem_auto_auto_auto_auto] items-center gap-x-10 w-fit'>
			<div className={`grid grid-cols-subgrid col-span-5 gap-x-4 font-mono pb-2`}>
				<div />
				<div className='font-mono pb-2'>Playlist / Rank</div>
				<div className='font-mono pb-2'>Rating</div>
				<div className='font-mono pb-2'>Peak Rating</div>
				<div className='font-mono pb-2'>Matches</div>
			</div>
			{playlists.map((p: any, index: number) => (
				<PlaylistCard key={index} data={p} index={index} />
			))}
		</div>
	);
}

export default function StatsPage({ account }: { account: Account }) {
	const [stats, setStats] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);
	const [retryTick, setRetryTick] = useState(0);

	useEffect(() => {
		let cancelled = false;
		const requestAccountId = account.AccountId;
		const requestUsername = account.Username;

		setStats(getCachedStats(account));
		setError(getCachedErrorMessage(account));

		getStats(account)
			.then(data => {
				if (cancelled) return;
				if (account.AccountId !== requestAccountId || account.Username !== requestUsername) return;
				setStats(data);
				setError(null);
			})
			.catch((err: Error) => {
				if (cancelled) return;
				if (account.AccountId !== requestAccountId || account.Username !== requestUsername) return;
				console.error(err);
				setError(err.toString());
			});

		return () => {
			cancelled = true;
		};
	}, [account.AccountId, account.Username, retryTick]);

	const onRetryNow = () => {
		clearCacheError(account);
		setRetryTick(prev => prev + 1);
	};

	return (
		<div>
			<h1 className='text-4xl font-bold mb-6'>Stats for {account.Username}</h1>
			{error && (
				<div className='flex items-center gap-4'>
					<div className='text-red-300'>Error: {error}</div>
					<button
						className='px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition'
						onClick={onRetryNow}
						type='button'
					>
						Retry now
					</button>
				</div>
			)}
			{!stats && !error && <LoadingDots number={9} />}
			{stats && <StatsInfo data={stats} />}
		</div>
	);
}
