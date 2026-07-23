import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ConfigProvider from './ConfigProvider';
import Stats from './components/Stats';
import { ToastContainer } from 'react-toastify';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<ConfigProvider>
			<App />
			<Stats />
			<ToastContainer />
		</ConfigProvider>
	</React.StrictMode>
);
