import { invoke } from '@tauri-apps/api/core';
import { Account } from '../types';
import { useEffect, useState } from 'react';
import LoadingDots from '../components/LoadingDots';

async function getStats(account: Account): Promise<any> {
	const storedItem = localStorage.getItem('stats_' + account.AccountId);
	if (storedItem) {
		const parsed = JSON.parse(storedItem);
		const now = Date.now();
		if (now <= parsed.expires) return parsed.data;
		localStorage.removeItem('stats_' + account.AccountId);
	}

	const result = await invoke<any>('get_stats', { username: account.Username });
	const data = JSON.parse(result).data;

	localStorage.setItem(
		'stats_' + account.AccountId,
		JSON.stringify({
			data,
			expires: new Date(data.expiryDate).getTime(),
		})
	);
	return data;
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
					#{data?.stats?.rating?.rank?.toLocaleString('en-US')} •{' '}
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

	useEffect(() => {
		getStats(account)
			.then(setStats)
			.catch((err: Error) => {
				console.error(err);
				setError(err.toString());
			});
	}, [account]);

	return (
		<div>
			<h1 className='text-4xl font-bold mb-6'>Stats for {account.Username}</h1>
			{error && <div className='text-red-300'>Error: {error}</div>}
			{!stats && !error && <LoadingDots number={9} />}
			{stats && <StatsInfo data={stats} />}
		</div>
	);
}
