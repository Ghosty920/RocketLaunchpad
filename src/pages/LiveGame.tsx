import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import StatsPage from './StatsPage';
import { getRankImage, getStats } from '../lib/accountStats';
import { lerpHsl } from '../lib/colors';

export type PartialPlayer = {
	Name: string;
	/** Epic|68412e6ddabe48fd8be9804e06c2056f|0 */
	PrimaryId: `${string}|${string}|${number}`;
};

type Payload = {
	MatchGuid: string;
	Players: (PartialPlayer & {
		Shortcut: number;
		TeamNum: number;
		Score: number;
		Goals: number;
		Shots: number;
		Assists: number;
		Saves: number;
		Touches: number;
		CarTouches: number;
		Demos: number;
		bHasCar?: boolean;
		Speed?: number;
		Boost?: number;
		bBoosting?: boolean;
		bOnGround?: boolean;
		bOnWall?: boolean;
		bPowersliding?: boolean;
		bDemolished?: boolean;
		/** Present if bDemolished is true */
		Attacker?: {
			Name: string;
			Shortcut: number;
			TeamNum: number;
		};
		bSupersonic?: boolean;
	})[];
	Game: {
		Teams: {
			Name: string;
			TeamNum: number;
			Score: number;
			/** RRGGBB */
			ColorPrimary: string;
			/** RRGGBB */
			ColorSecondary: string;
		}[];
		TimeSeconds: number;
		bOvertime: boolean;
		/** If in replay */
		Frame?: number;
		/** If in replay */
		Elapsed?: number;
		Ball: {
			Speed: number;
			TeamNum: number;
		};
		bReplay: boolean;
		bHasWinner: boolean;
		/** The team name */
		Winner: string;
		/** The developer format, e.g. Underwater_GRS_P */
		Arena: string;
		bHasTarget: boolean;
		Target?: {
			Name: string;
			Shortcut: number;
			TeamNum: number;
		};
	};
};

function getWinningTeam(payload: Payload): Payload['Game']['Teams'][number] {
	const teams = payload.Game.Teams.filter(t => t.Name === payload.Game.Winner);

	if (teams.length <= 1) {
		return teams[0] ?? payload.Game.Teams[0];
	}

	// In case 2 teams have the same name, we need to check the stats to determine the winner

	const teamStats = teams.map(team => {
		const players = payload.Players.filter(p => p.TeamNum === team.TeamNum);
		return {
			team,
			goals: team.Score,
			shots: players.reduce((sum, p) => sum + p.Shots, 0),
			score: players.reduce((sum, p) => sum + p.Score, 0),
		};
	});

	teamStats.sort((a, b) => {
		// Most goals
		if (a.goals !== b.goals) {
			return b.goals - a.goals;
		}
		// Most shots
		if (a.shots !== b.shots) {
			return b.shots - a.shots;
		}
		// Most combined player points
		if (a.score !== b.score) {
			return b.score - a.score;
		}
		// If all else fail, just return the first team
		return 0;
	});

	return teamStats[0].team;
}

const iconsOrder = [
	...Array.from({ length: 20 }, (_, i) => `s4-${i}`), // legacy icons, from unranked to old gc
	's15rank19', // gc1
	's15rank20', // gc2
	's15rank21', // gc3
	's15rank22', // ssl
].map(icon => `ranks/${icon}.png`);

function getHighestRank(stats: any): string {
	const playlists = stats?.segments?.filter((s: any) => s.type === 'playlist');
	let highest = 's4-0';
	for (const playlist of playlists) {
		const rankIcon = playlist?.stats?.rating?.metadata?.iconUrl;
		if (!rankIcon) continue;
		const rankImage = getRankImage(rankIcon);
		if (iconsOrder.indexOf(rankImage) > iconsOrder.indexOf(highest)) {
			highest = rankImage;
		}
	}
	return highest;
}

function PlayerLineStats({
	stats,
	player,
	background,
}: {
	stats: any;
	player: Payload['Players'][number];
	background?: string;
}) {
	if (!stats)
		return (
			<>
				<div></div>
				<div></div>
				<div></div>
			</>
		);

	const overviewSegment = stats?.segments?.find((s: any) => s.type === 'overview');
	const wins = overviewSegment?.stats?.wins?.value ?? 0;
	const mvps = overviewSegment?.stats?.mVPs?.value ?? 0;
	const winMvpRatio = wins > 0 ? mvps / wins : 0;

	const winsColor =
		winMvpRatio >= 0.9
			? 'text-red-400'
			: winMvpRatio >= 0.8
				? 'text-orange-400'
				: winMvpRatio >= 0.7
					? 'text-amber-400'
					: winMvpRatio >= 0.6
						? 'text-yellow-200'
						: winMvpRatio >= 0.5
							? 'text-yellow-100'
							: 'text-white';

	const goalsColor =
		player.Shots === 0 ? '#bbbbbb' : lerpHsl('#ff2222', '#22ff22', player.Goals / Math.max(1, player.Shots));

	return (
		<>
			<div className='h-12 text-lg font-medium leading-12 text-neutral-400 text-center' style={{ background }}>
				Score: {player.Score}
			</div>
			<div className='h-12 text-lg font-medium leading-12 text-center' style={{ background }}>
				<span style={{ color: goalsColor }}>{player.Goals}</span>/
				<span className='text-gray-400'>{player.Shots}</span> Goal{player.Goals > 1 ? 's' : ''}
			</div>
			<div className='h-12 leading-12 text-center flex flex-col justify-center' style={{ background }}>
				<div className={`${winsColor} text-base font-medium`}>{wins} wins</div>
				<div className={`text-yellow-500/50 text-sm`}>{mvps} MVPs</div>
			</div>
		</>
	);
}

function PlayerLine({
	team,
	player,
	switchPage,
}: {
	team: Payload['Game']['Teams'][number];
	player: Payload['Players'][number];
	switchPage: (page: React.ReactElement) => void;
}) {
	const [stats, setStats] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);

	const [cancelled, setCancelled] = useState(false);

	function fetchStats() {
		if (cancelled) return;
		setError(null);
		getStats(player)
			.then(data => {
				if (cancelled) return;
				setStats(data);
			})
			.catch((err: Error) => {
				if (cancelled) return;
				console.error(err);
				setError(err.toString());
			});
	}

	useEffect(() => {
		setCancelled(false);
		fetchStats();
		return () => {
			setCancelled(true);
		};
	}, [player.PrimaryId]);

	const background = `linear-gradient(180deg, color-mix(in srgb, #${team.ColorPrimary}50 90%, white 10%) 0%, color-mix(in srgb, #${team.ColorPrimary}50 95%, black 5%) 30%)`;

	return (
		<div className='contents'>
			<div className='h-12 flex flex-col items-center justify-center' style={{ background }}>
				{!stats && !error && <LoadingSpinner size={12 * 4} />}
				{stats && <img src={getHighestRank(stats)} className='w-10 h-10' />}
				{error && (
					<button
						className='w-10 h-10 bg-[linear-gradient(115deg,#74252c,#e45858,#e98b8b)] hover:bg-[linear-gradient(115deg,#a04b52,#f08989,#f1bbbb)]'
						style={{
							mask: `url("/icons/error.svg") center/contain no-repeat`,
							WebkitMask: `url("/icons/error.svg") center/contain no-repeat`,
						}}
						onClick={fetchStats}
					/>
				)}
			</div>
			<div
				className='text-xl h-12 leading-12 hover:underline hover:cursor-pointer'
				style={{ background }}
				onClick={() => switchPage(<StatsPage account={player} />)}
			>
				{player.Name}
			</div>

			<PlayerLineStats stats={stats} player={player} background={background} />

			{error && (
				<>
					<span
						className='text-red-500 h-12 leading-12 font-medium text-lg'
						style={{ gridColumn: '2 / -1', background }}
					>
						Error: {error}
					</span>
				</>
			)}
		</div>
	);
}

export default function LiveGame({ switchPage }: { switchPage: (page: React.ReactElement) => void }) {
	const [matchGuid, setMatchGuid] = useState<string | null>(null);
	const [teams, setTeams] = useState<Payload['Game']['Teams'] | null>(null);
	const [players, setPlayers] = useState<Payload['Players'] | null>(null);
	const [winner, setWinner] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const unlisten = listen<Payload>('stats-update', event => {
			const { Game, Players, MatchGuid } = event.payload;
			const matchChanged = MatchGuid !== matchGuid;

			if (!Game.bHasWinner) {
				setWinner(null);
				setPlayers(Players);
			}

			if (matchChanged) {
				setError(null);
				setWinner(null);
				setMatchGuid(MatchGuid);
				setTeams(Game.Teams);
			}

			if ((!winner || matchChanged) && Game.bHasWinner) {
				const winningTeam = getWinningTeam(event.payload);
				setWinner(winningTeam.TeamNum);
				alert(winningTeam.Name);
			}
			//
		})
			.then(unlisten => {
				setError(null);
				return unlisten;
			})
			.catch(err => {
				setError(`Failed to use Stats API: ${err}`);
				return Promise.reject(err);
			});
		return () => {
			unlisten.then(fn => fn());
		};
	}, []);

	return (
		<div className='m-6'>
			{teams?.map(team => (
				<div key={team.TeamNum} className='flex flex-col mb-6'>
					<div className='flex flex-row gap-4 mb-1'>
						<div
							className='font-nunito font-thin text-3xl leading-normal'
							style={{
								textShadow: `
									0 0 1px #${team.ColorPrimary},
									0 0 2px #${team.ColorPrimary},
									0 0 5px #${team.ColorPrimary},
									0 0 5px #${team.ColorPrimary},
									0 0 10px #${team.ColorPrimary},
									0 0 10px #${team.ColorPrimary}
								`,
							}}
						>
							{team.Score}
						</div>
						<div
							className='team-name relative font-bourgeois font-thin text-4xl'
							style={
								{
									'--team-color': `#${team.ColorPrimary}50`,
									textShadow: `
									0 0 2px #${team.ColorPrimary},
									0 0 5px #${team.ColorPrimary},
									0 0 10px #${team.ColorPrimary},
									0 0 10px #${team.ColorPrimary},
									-5px 0 10px #${team.ColorPrimary},
									5px 0 10px #${team.ColorPrimary}
								`,
								} as any
							}
						>
							{team.Name.toUpperCase()}
						</div>
					</div>
					{/* */}
					<div
						className='ml-4 gap-y-1.5 grid items-center'
						style={{ gridTemplateColumns: 'auto auto auto auto auto' }}
					>
						{players
							?.filter(p => p.TeamNum === team.TeamNum)
							.sort((a, b) => b.Score - a.Score)
							.map(player => (
								<PlayerLine
									key={player.PrimaryId}
									team={team}
									player={player}
									switchPage={switchPage}
								/>
							))}
					</div>
				</div>
			))}
			{error && <div className='text-red-500 font-bold text-lg'>Error: {error}</div>}
		</div>
	);
}
