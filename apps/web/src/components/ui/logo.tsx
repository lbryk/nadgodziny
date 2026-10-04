import { motion } from 'motion/react';

export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#logo-g)" />
      <circle cx="32" cy="33" r="17" fill="none" stroke="#fff" strokeWidth="4" />
      <motion.path
        d="M32 22v11l7 4"
        fill="none"
        stroke="#fff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, delay: 0.3, ease: 'easeOut' }}
      />
      <path d="M48 12v10M43 17h10" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
