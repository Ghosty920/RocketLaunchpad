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
				const umami = (window as any).umami;

				if (umami) {
					const { LaunchPath, ...settings } = configRef.current;
					const changed = (Object.keys(settings) as (keyof ConfigNoPath)[]).some(
						key => settings[key] !== lastSettings?.[key]
					);
					console.log(changed);
					console.log(settings, lastSettings);

					if (changed) {
						umami.identify({
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

	return null;
}
