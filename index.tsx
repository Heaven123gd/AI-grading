import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AppView } from './types';

const App = () => {
  const [view, setView] = useState<AppView>(AppView.LOGIN);

  const handleLoginSuccess = () => {
    setView(AppView.DASHBOARD);
  };

  const handleLogout = () => {
    setView(AppView.LOGIN);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      {view === AppView.LOGIN ? (
        <Login onLoginSuccess={handleLoginSuccess} />
      ) : (
        <Dashboard onLogout={handleLogout} />
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);