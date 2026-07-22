// anonymous stats

import { useContext, useEffect, useRef } from 'react';
import { ConfigContext } from '../ConfigProvider';
import { Config } from '../types';

type ConfigNoPath = Omit<Config, 'LaunchPath'>;

export default function Stats() {
	const statsWebsiteId = import.meta.env.VITE_STATS_WEBSITE_ID as string | undefined;
	if (!statsWebsiteId || statsWebsiteId.trim().length === 0) {
		return null;
	}

	const { config } = useContext(ConfigContext)!;
	const configRef = useRef(config);

	const umamiId = () => {
		const current = localStorage.getItem('umami-id');
		if (current) return current;
		const newId = crypto.randomUUID();
		localStorage.setItem('umami-id', newId);
		return newId;
	};

	useEffect(() => {
		configRef.current = config;
	}, [config]);

	useEffect(() => {
		(async () => {
			const statsScript = document.createElement('script');
			statsScript.defer = true;
			statsScript.src = 'https://stats.ghosty.im/script.js';
			statsScript.setAttribute('data-website-id', statsWebsiteId);
			statsScript.setAttribute('data-performance', 'true');
			document.head.appendChild(statsScript);

			let lastSettings: Partial<ConfigNoPath> = {};

			const { VITE_APP_VERSION, VITE_GIT_SHA, VITE_BUILD_MODE } = import.meta.env;

			const refresh = () => {
				if (window.umami) {
					const { LaunchPath, ...settings } = configRef.current;
					const changed = (Object.keys(settings) as (keyof ConfigNoPath)[]).some(
						key => settings[key] !== lastSettings?.[key]
					);
					console.log(changed);
					console.log(settings, lastSettings);

					if (changed) {
						window.umami.identify(umamiId(), {
							...settings,
							...(VITE_APP_VERSION ? { App_Version: VITE_APP_VERSION } : {}),
							...(VITE_GIT_SHA ? { App_GitHash: VITE_GIT_SHA } : {}),
							...(VITE_BUILD_MODE ? { App_BuildType: VITE_BUILD_MODE } : {}),
						});
						lastSettings = { ...settings };
					}

					setTimeout(refresh, 10000);
				} else {
					setTimeout(refresh, 1000);
				}
			};
			setTimeout(refresh, 1000);
		})();
	}, [statsWebsiteId]);

	useEffect(() => {
		if (window.umami) {
			console.log('Identifying stats with ID:', umamiId());
			window.umami.identify(umamiId());
		}
	}, [window.umami]);

	return null;
}
