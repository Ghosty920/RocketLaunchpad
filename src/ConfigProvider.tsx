import { createContext, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from './types';
import { exists } from '@tauri-apps/plugin-fs';

type ConfigContextType = {
	config: Config;
	updateConfig: (patch: Partial<Config>) => Promise<void>;
	firstLoaded?: boolean;
};

export function existsGamePath(path: string): Promise<boolean> {
	return exists(path + '\\RocketLeague.exe');
}

export const ConfigContext = createContext<ConfigContextType | null>(null);

export default function ConfigProvider({ children }: { children: React.ReactNode }) {
	const [config, setConfig] = useState<Config>({
		LaunchPath: '',
		LaunchArgs: '-language=INT',
		CloseOnLaunch: false,
		ShowStatsPage: true,
		UseEac: true,
		UpdateChecker: true,
	});

	const [firstLoaded, setFirstLoaded] = useState<boolean>(false);

	async function updateConfig(patch: Partial<Config>) {
		const newConfig = { ...config, ...patch };
		setConfig(newConfig);
		await invoke('update_config', { config: patch });
	}

	async function checkForGamePath() {
		let path = 'C:\\Program Files\\Epic Games\\rocketleague\\Binaries\\Win64';
		if (await existsGamePath(path)) return updateConfig({ LaunchPath: path });
		path = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\rocketleague\\Binaries\\Win64';
		if (await existsGamePath(path)) return updateConfig({ LaunchPath: path });
	}

	useEffect(() => {
		invoke<Config>('get_config')
			.then(cfg => {
				console.log('Loaded config:', cfg);
				setConfig(cfg);
				setFirstLoaded(true);
				if (cfg.LaunchPath.length <= 1) checkForGamePath();
			})
			.catch(err => {
				console.error('Failed to load config:', err);
			});
	}, []);

	return <ConfigContext.Provider value={{ config, updateConfig, firstLoaded }}>{children}</ConfigContext.Provider>;
}
