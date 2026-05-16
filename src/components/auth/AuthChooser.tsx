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
    gradient: 'from-[#73BA27]/15 via-[#8FC94F]/8 to-transparent',
    iconBg: 'bg-[#F0F9E6]',
    iconColor: 'text-[#73BA27]',
    accent: 'border-[#D4EDBC]/60',
    hoverRing: 'hover:ring-[#C2E29A]/50',
  },
  {
    id: 'doctor' as const,
    Icon: Stethoscope,
    label: "I'm a Doctor",
    description: 'Manage patients & provide care remotely',
    gradient: 'from-[#5FA01F]/15 via-[#73BA27]/8 to-transparent',
    iconBg: 'bg-[#F0F9E6]',
    iconColor: 'text-[#5FA01F]',
    accent: 'border-[#C2E29A]/60',
    hoverRing: 'hover:ring-[#8FC94F]/50',
  },
  {
    id: 'hospital' as const,
    Icon: Phone,
    label: 'I Visited a Hospital',
    description: 'Login with your phone number',
    gradient: 'from-[#8FC94F]/15 via-[#C2E29A]/8 to-transparent',
    iconBg: 'bg-[#F0F9E6]',
    iconColor: 'text-[#8FC94F]',
    accent: 'border-[#D4EDBC]/60',
    hoverRing: 'hover:ring-[#C2E29A]/50',
  },
  {
    id: 'enterprise' as const,
    Icon: Building2,
    label: 'Enterprise Login',
    description: 'Hospital & Organization Access',
    gradient: 'from-[#4D8619]/12 via-[#5FA01F]/6 to-transparent',
    iconBg: 'bg-[#F0F9E6]',
    iconColor: 'text-[#4D8619]',
    accent: 'border-[#C2E29A]/60',
    hoverRing: 'hover:ring-[#8FC94F]/40',
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {roles.map((r, i) => (
        <motion.button
          key={r.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.07 }}
          onClick={() => handleClick(r.id)}
          className={`glass-panel skeuomorph-card group relative flex w-full flex-col items-start gap-4 overflow-hidden rounded-[1.8rem] p-6 text-left ring-1 ring-transparent transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${r.hoverRing} ${r.accent}`}
        >
          {/* gradient wash */}
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${r.gradient}`}
          />
          <div className="relative flex w-full items-center justify-between">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${r.iconBg}`}
            >
              <r.Icon className={`h-6 w-6 ${r.iconColor}`} />
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
          </div>
          <div className="relative">
            <div className="text-base font-semibold text-slate-900">{r.label}</div>
            <div className="mt-1 text-xs leading-relaxed text-slate-500">{r.description}</div>
          </div>
        </motion.button>
      ))}
    </div>
  );
};

export default AuthChooser;
