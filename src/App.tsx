/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthProvider, useAuth } from './store/AuthContext';
import { SettingsProvider } from './store/SettingsContext';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';

function AppContent() {
  const { user } = useAuth();
  
  if (!user) {
    return <Login />;
  }
  
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <AppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}
