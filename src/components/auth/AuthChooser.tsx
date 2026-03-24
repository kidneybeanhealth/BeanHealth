import React from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  ChevronRight,
  Phone,
  Stethoscope,
  User,
} from 'lucide-react';

interface AuthChooserProps {
  onNext: (role: 'patient' | 'doctor') => void;
  onEnterpriseLogin?: () => void;
  onHospitalPatientLogin?: () => void;
}

const roles = [
  {
    id: 'patient' as const,
    Icon: User,
    label: "I'm a Patient",
    description: 'Track health, medications & connect with doctors',
    gradient: 'from-emerald-500/15 via-teal-400/8 to-transparent',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    accent: 'border-emerald-200/60',
    hoverRing: 'hover:ring-emerald-300/50',
  },
  {
    id: 'doctor' as const,
    Icon: Stethoscope,
    label: "I'm a Doctor",
    description: 'Manage patients & provide care remotely',
    gradient: 'from-blue-500/15 via-cyan-400/8 to-transparent',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    accent: 'border-blue-200/60',
    hoverRing: 'hover:ring-blue-300/50',
  },
  {
    id: 'hospital' as const,
    Icon: Phone,
    label: 'I Visited a Hospital',
    description: 'Login with your phone number',
    gradient: 'from-amber-500/15 via-orange-400/8 to-transparent',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    accent: 'border-amber-200/60',
    hoverRing: 'hover:ring-amber-300/50',
  },
  {
    id: 'enterprise' as const,
    Icon: Building2,
    label: 'Enterprise Login',
    description: 'Hospital & Organization Access',
    gradient: 'from-[#3d5c35]/12 via-[#4a6741]/6 to-transparent',
    iconBg: 'bg-[#eef3ec]',
    iconColor: 'text-[#3d5c35]',
    accent: 'border-[#b5cbaf]/60',
    hoverRing: 'hover:ring-[#7aab6e]/40',
  },
];

const AuthChooser: React.FC<AuthChooserProps> = ({
  onNext,
  onEnterpriseLogin,
  onHospitalPatientLogin,
}) => {
  const handleClick = (id: typeof roles[number]['id']) => {
    if (id === 'patient' || id === 'doctor') {
      onNext(id);
    } else if (id === 'hospital') {
      onHospitalPatientLogin?.();
    } else if (id === 'enterprise') {
      onEnterpriseLogin?.();
    }
  };

  return (
    <div className="space-y-3">
      {roles.map((r, i) => (
        <motion.button
          key={r.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.07 }}
          onClick={() => handleClick(r.id)}
          className={`glass-panel skeuomorph-card relative w-full overflow-hidden rounded-[1.8rem] p-5 text-left ring-1 ring-transparent transition-all duration-300 hover:-translate-y-0.5 ${r.hoverRing} ${r.accent}`}
        >
          {/* gradient wash */}
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${r.gradient}`}
          />
          <div className="relative flex items-center gap-4">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${r.iconBg}`}
            >
              <r.Icon className={`h-5 w-5 ${r.iconColor}`} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">{r.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{r.description}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          </div>
        </motion.button>
      ))}
    </div>
  );
};

export default AuthChooser;
