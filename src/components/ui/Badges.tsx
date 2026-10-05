import type { ValidationStatus, AiStatus } from '@/types';
import { Clock, CheckCircle2, Edit3, Loader2, AlertCircle } from 'lucide-react';

const validationConfig: Record<ValidationStatus, { label: string; classes: string; icon: typeof Clock }> = {
  a_relire: {
    label: 'À relire',
    classes: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: Clock,
  },
  valide: {
    label: 'Validé',
    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  modifie: {
    label: 'Modifié',
    classes: 'bg-brand-50 text-brand-700 border-brand-200',
    icon: Edit3,
  },
};

const aiStatusConfig: Record<AiStatus, { label: string; classes: string; icon: typeof Loader2 }> = {
  pending: {
    label: 'En cours…',
    classes: 'bg-slate-100 text-slate-600',
    icon: Loader2,
  },
  analyzed: {
    label: 'Analysé',
    classes: 'bg-brand-50 text-brand-700',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Échec',
    classes: 'bg-red-50 text-red-600',
    icon: AlertCircle,
  },
};

export function ValidationBadge({ status }: { status: ValidationStatus }) {
  const config = validationConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.classes}`}
    >
      <Icon className={`w-3.5 h-3.5 ${status === 'a_relire' ? '' : ''}`} />
      {config.label}
    </span>
  );
}

export function AiStatusBadge({ status }: { status: AiStatus }) {
  const config = aiStatusConfig[status];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.classes}`}
    >
      <Icon className={`w-3.5 h-3.5 ${status === 'pending' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}
