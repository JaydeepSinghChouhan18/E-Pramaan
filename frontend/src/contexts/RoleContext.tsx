import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, SupportedLanguage } from '@e-pramaan/shared';
import { getTranslation } from '../i18n/translations';
import { useAuth } from './AuthContext';

interface RoleContextType {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRole>(user?.role || UserRole.BIDDER);
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem('e_pramaan_lang');
    return (saved as SupportedLanguage) || SupportedLanguage.EN;
  });

  // Automatically synchronize activeRole with the authenticated user's actual role
  useEffect(() => {
    if (user?.role) {
      setActiveRole(user.role);
    }
  }, [user?.role]);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('e_pramaan_lang', lang);
  };

  const t = (key: string): string => {
    return getTranslation(key, language);
  };

  return (
    <RoleContext.Provider value={{ activeRole, setActiveRole, language, setLanguage, t }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRoleContext = () => {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRoleContext must be used within a RoleProvider');
  }
  return context;
};
