import { Account } from '../types';
import { useEffect, useState } from 'react';
import LoadingDots from '../components/LoadingDots';
import { getAccountAsPartialPlayer, getRankImage, getStats, playlistIds } from '../lib/accountStats';
import { PartialPlayer } from './LiveGame';
import { RefreshCw } from 'lucide-react';

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
				src={getRankImage(data?.stats?.tier?.metadata?.iconUrl)}
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
			<div className='flex flex-col justify-center'>
				<div className='font-medium'>{data?.stats?.rating?.displayValue} MMR</div>
				{percentile === undefined || isNaN(percentile) ? null : (
					<div className={`font-light ${percentile >= 95 ? 'text-yellow-400' : 'text-stone-400'}`}>
						{rank ? `#${rank.toLocaleString('en-US')} • ` : null}
						{percentile <= 50
							? `Bottom ${percentile.toFixed(1)}%`
							: `Top ${(100 - percentile).toFixed(1)}%`}
					</div>
				)}
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

export default function StatsPage({ account }: { account: Account | PartialPlayer }) {
	if ('Username' in account) return <StatsPage account={getAccountAsPartialPlayer(account)} />;

	const accountId = account.PrimaryId.split('|')[1];

	const [stats, setStats] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);
	const [retryTick, setRetryTick] = useState(0);

	const refreshStats = (cancelled: () => boolean, force: boolean = false) => {
		const requestAccountId = accountId;
		getStats(account, force)
			.then(data => {
				if (cancelled()) return;
				if (accountId !== requestAccountId) return;
				setStats(data);
				setError(null);
			})
			.catch((err: Error) => {
				if (cancelled()) return;
				if (accountId !== requestAccountId) return;
				console.error(err);
				setError(err.toString());
			});
	};

	useEffect(() => {
		setStats(null);
		setError(null);

		let cancelled = false;
		refreshStats(() => cancelled, retryTick > 0);

		return () => {
			cancelled = true;
		};
	}, [accountId, account.Name, retryTick]);

	const onRetryNow = () => {
		setRetryTick(prev => prev + 1);
	};

	return (
		<div>
			<h1 className='text-4xl font-bold mb-6'>
				Stats for {account.Name}
				<span className='m-2 p-2' onClick={onRetryNow} title='Refresh stats'>
					<RefreshCw
						strokeWidth={2.5}
						size={26}
						className='inline-block duration-300 hover:rotate-45 cursor-pointer'
					/>
				</span>
			</h1>
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
