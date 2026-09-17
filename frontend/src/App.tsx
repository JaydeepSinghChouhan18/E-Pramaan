import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { RoleProvider } from './contexts/RoleContext';
import { AuthProvider } from './contexts/AuthContext';
import { AppRouter } from './router';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <RoleProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </RoleProvider>
    </AuthProvider>
  );
};

export default App;
