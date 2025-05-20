import { ThemeToggle } from '@/components/theme-toggle';
import React from 'react';

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      <ThemeToggle />
      {children}
    </div>
  );
};

export default layout;
