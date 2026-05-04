import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ConfigProvider from './ConfigProvider';
import Stats from './components/Stats';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<ConfigProvider>
			<App />
			<Stats />
		</ConfigProvider>
	</React.StrictMode>
);
