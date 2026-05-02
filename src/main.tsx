import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ConfigProvider from './ConfigProvider';

const statsWebsiteId = import.meta.env.VITE_STATS_WEBSITE_ID as string | undefined;

if (statsWebsiteId && statsWebsiteId.trim().length > 0) {
	const statsScript = document.createElement('script');
	statsScript.defer = true;
	statsScript.src = 'https://stats.ghosty.im/script.js';
	statsScript.setAttribute('data-website-id', statsWebsiteId);
	document.head.appendChild(statsScript);
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<ConfigProvider>
			<App />
		</ConfigProvider>
	</React.StrictMode>
);
