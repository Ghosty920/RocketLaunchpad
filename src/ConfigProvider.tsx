import { createContext, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Config } from './types';

type ConfigContextType = {
	config: Config;
	updateConfig: (patch: Partial<Config>) => Promise<void>;
};

export const ConfigContext = createContext<ConfigContextType | null>(null);

export default function ConfigProvider({ children }: { children: React.ReactNode }) {
	const [config, setConfig] = useState<Config>({
		LaunchPath: '',
		LaunchArgs: '-language=INT',
		CloseOnLaunch: false,
		ShowStatsPage: true,
		UseEac: true,
	});

	async function updateConfig(patch: Partial<Config>) {
		const newConfig = { ...config, ...patch };
		setConfig(newConfig);
		await invoke('update_config', { config: patch });
	}

	useEffect(() => {
		invoke<any>('get_config')
			.then(cfg => {
				console.log('Loaded config:', cfg);
				setConfig(cfg);
			})
			.catch(err => {
				console.error('Failed to load config:', err);
			});
	}, []);

	return <ConfigContext.Provider value={{ config, updateConfig }}>{children}</ConfigContext.Provider>;
}
