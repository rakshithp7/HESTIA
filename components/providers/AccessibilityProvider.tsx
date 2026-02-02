'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

type AccessibilityContextType = {
  highContrast: boolean;
  setHighContrast: (value: boolean) => void;
  dyslexicFont: boolean;
  setDyslexicFont: (value: boolean) => void;
  textScale: number;
  setTextScale: (value: number) => void;
};

const AccessibilityContext = createContext<
  AccessibilityContextType | undefined
>(undefined);

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState(false);
  const [dyslexicFont, setDyslexicFont] = useState(false);
  const [textScale, setTextScale] = useState(1); // 1 = 100%

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const storedHighContrast = localStorage.getItem(
      'accessibility-highContrast'
    );
    const storedDyslexicFont = localStorage.getItem(
      'accessibility-dyslexicFont'
    );
    const storedTextScale = localStorage.getItem('accessibility-textScale');

    if (storedHighContrast !== null) {
      setHighContrast(storedHighContrast === 'true');
    }
    if (storedDyslexicFont !== null) {
      setDyslexicFont(storedDyslexicFont === 'true');
    }
    if (storedTextScale !== null) {
      setTextScale(parseFloat(storedTextScale));
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('accessibility-highContrast', highContrast.toString());
    localStorage.setItem('accessibility-dyslexicFont', dyslexicFont.toString());
    localStorage.setItem('accessibility-textScale', textScale.toString());
  }, [highContrast, dyslexicFont, textScale, mounted]);

  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Apply dyslexic font globally if enabled
    if (dyslexicFont) {
      document.body.classList.add('font-dyslexic');
    } else {
      document.body.classList.remove('font-dyslexic');
    }

    // Apply text scale immediately to html tag
    // This overrides the rem-based scaling in tailwind if set, or just scales base font size
    root.style.fontSize = `${textScale * 100}%`;
    root.style.setProperty('--text-scale', textScale.toString());
  }, [highContrast, dyslexicFont, textScale, mounted]);

  return (
    <AccessibilityContext.Provider
      value={{
        highContrast,
        setHighContrast,
        dyslexicFont,
        setDyslexicFont,
        textScale,
        setTextScale,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error(
      'useAccessibility must be used within an AccessibilityProvider'
    );
  }
  return context;
}
