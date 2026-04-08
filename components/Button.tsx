import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'cta';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false,
  className = '',
  ...props 
}) => {
  const baseStyles = "relative inline-flex items-center justify-center px-8 py-4 text-xl font-bold uppercase tracking-wider border-4 border-black transition-transform active:translate-y-1 active:translate-x-1";
  
  const variants = {
    primary: "bg-[#0091DA] hover:bg-[#007AB8] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
    secondary: "bg-white hover:bg-gray-100 text-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
    danger: "bg-[#470A68] hover:bg-[#3A0855] text-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
    cta: "bg-[#76D2FF] hover:bg-[#62CAFA] text-[#00338D] shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]",
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
