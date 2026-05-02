import { useContext, useEffect, useRef, useState } from 'react';
import { ConfigContext } from '../ConfigProvider';
import { invoke } from '@tauri-apps/api/core';
import { exists } from '@tauri-apps/plugin-fs';
import YesNoSwitch from '../components/YesNoSwitch';

function ConfigBox({ children }: { children: React.ReactNode }) {
	return <div className='bg-[#101010] border border-white/10 rounded-xl p-4'>{children}</div>;
}

export function existsGamePath(path: string): Promise<boolean> {
	return exists(path + '\\RocketLeague.exe');
}

function GameLaunch() {
	const { config, updateConfig } = useContext(ConfigContext)!;
	const [errorPath, setErrorPath] = useState<string | null>(null);
	const [pathExists, setPathExists] = useState<boolean>(true);
	const launchArgsRef = useRef<HTMLInputElement>(null);
	const launchArgsBtnRef = useRef<HTMLButtonElement>(null);
	const [launchArgsColorTimeout, setLaunchArgsColorTimeout] = useState<NodeJS.Timeout>();
	const [errorArgs, setErrorArgs] = useState<string | null>(null);
	const [useEacError, setUseEacError] = useState<string | null>(null);

	useEffect(() => {
		if (!config.LaunchPath || config.LaunchPath.trim() === '') {
			setPathExists(false);
			return;
		}

		const errorTitle = 'Invalid game path. Please select the folder containing RocketLeague.exe.';
		existsGamePath(config.LaunchPath).then(exists => {
			if (exists) {
				setPathExists(true);
				if (errorPath === errorTitle) setErrorPath(null);
			} else {
				setPathExists(false);
				setErrorPath(errorTitle);
			}
		});
	}, [config.LaunchPath]);

	const handleChooseFolder = async () => {
		setErrorPath(null);
		try {
			const path = await invoke<string | null>('pick_rocket_league');
			if (typeof path === 'string') {
				await updateConfig({ LaunchPath: path });
			}
		} catch (err) {
			console.error('Error picking folder:', err);
			setErrorPath(err ? String(err) : 'An unknown error occurred while picking the folder.');
		}
	};

	const saveLaunchArgs = () => {
		const timeout = () => {
			clearTimeout(launchArgsColorTimeout);
			setLaunchArgsColorTimeout(
				setTimeout(() => {
					launchArgsBtnRef.current?.classList.remove(...colorsSuccess, ...colorsError);
				}, 1000)
			);
		};

		setErrorArgs(null);
		const colorsSuccess = ['border-green-400!', 'hover:border-green-600!'];
		const colorsError = ['border-red-400!', 'hover:border-red-600!'];
		updateConfig({ LaunchArgs: launchArgsRef.current?.value || '' })
			.then(() => {
				launchArgsBtnRef.current?.classList.add(...colorsSuccess);
				launchArgsBtnRef.current?.classList.remove(...colorsError);
				timeout();
			})
			.catch(err => {
				console.error('Error saving launch arguments:', err);
				setErrorArgs(err ? String(err) : 'An unknown error occurred while saving launch arguments.');
				launchArgsBtnRef.current?.classList.add(...colorsError);
				launchArgsBtnRef.current?.classList.remove(...colorsSuccess);
				timeout();
			});
	};

	const saveUseEac = (useEac: boolean) => {
		setUseEacError(null);
		updateConfig({ UseEac: useEac }).catch(err => {
			console.error('Error saving EAC setting:', err);
			setUseEacError(err ? String(err) : 'An unknown error occurred while saving the setting.');
		});
	};

	return (
		<ConfigBox>
			<label className='text-2xl text-white'>Game Path:</label>
			<div className='mt-3 flex gap-3'>
				<input
					value={config.LaunchPath}
					readOnly
					className='flex-1 bg-[#0b0b0b] border border-white/10 text-base px-3 py-2 rounded-md text-white/80'
					placeholder='Not selected'
					spellCheck={false}
				/>
				<button
					onClick={handleChooseFolder}
					className={`px-4 py-2 rounded-md text-base font-medium transition-all duration-400 border-2 border-blue-400/0 hover:border-blue-600/70 ${!pathExists ? 'bg-red-300/40 hover:bg-red-400/60' : 'bg-white/10 hover:bg-white/30'}`}
				>
					Browse
				</button>
			</div>
			<p className='text-red-300 mb-6'>{errorPath}</p>
			<label className='text-2xl text-white'>Launch Arguments:</label>
			<div className='mt-3 flex gap-3'>
				<input
					defaultValue={config.LaunchArgs}
					ref={launchArgsRef}
					className='flex-1 bg-[#0b0b0b] border border-white/10 text-base px-3 py-2 rounded-md text-white/80'
					placeholder='Enter launch arguments...'
					spellCheck={false}
				/>
				<button
					ref={launchArgsBtnRef}
					onClick={saveLaunchArgs}
					className='px-4 py-2 rounded-md text-base font-medium transition-all duration-400 border-2 border-blue-400/0 hover:border-blue-600/70 bg-white/10 hover:bg-white/30'
				>
					Save
				</button>
			</div>
			<p className='text-red-300 mb-6'>{errorArgs}</p>
			<div className='mt-2 flex items-center gap-3'>
				<label className='text-2xl text-white'>Use Easy Anti-Cheat:</label>
				<YesNoSwitch state={config.UseEac} setState={saveUseEac} size={9} />
			</div>
			<p className='text-red-300'>{useEacError}</p>
		</ConfigBox>
	);
}

function AppOptions() {
	const { config, updateConfig } = useContext(ConfigContext)!;
	const [showStatsError, setShowStatsError] = useState<string | null>(null);
	const [closeOnLaunchError, setCloseOnLaunchError] = useState<string | null>(null);

	const saveShowStats = (value: boolean) => {
		setShowStatsError(null);
		updateConfig({ ShowStatsPage: value }).catch(err => {
			console.error('Error saving stats page setting:', err);
			setShowStatsError(err ? String(err) : 'An unknown error occurred while saving the setting.');
		});
	};

	const saveCloseOnLaunch = (value: boolean) => {
		setCloseOnLaunchError(null);
		updateConfig({ CloseOnLaunch: value }).catch(err => {
			console.error('Error saving close on launch setting:', err);
			setCloseOnLaunchError(err ? String(err) : 'An unknown error occurred while saving the setting.');
		});
	};

	return (
		<ConfigBox>
			<div className='mt-2 flex items-center gap-3'>
				<label className='text-2xl text-white'>Show Stats Page:</label>
				<YesNoSwitch state={config.ShowStatsPage} setState={saveShowStats} size={9} />
			</div>
			<p className='text-red-300 mb-6'>{showStatsError}</p>
			<div className='mt-2 flex items-center gap-3'>
				<label className='text-2xl text-white'>Close on Launch:</label>
				<YesNoSwitch state={config.CloseOnLaunch} setState={saveCloseOnLaunch} size={9} />
			</div>
			<p className='text-red-300'>{closeOnLaunchError}</p>
		</ConfigBox>
	);
}

export default function Config() {
	return (
		<div className='h-full grid grid-rows-[auto_1fr_auto] gap-5'>
			<div className='flex items-center justify-between'>
				<h1 className='text-4xl font-medium'>Configuration</h1>
			</div>

			<div className='gap-4 overflow-auto pr-2'>
				<GameLaunch />
				<br className='h-8' />
				<AppOptions />
			</div>
		</div>
	);
}
