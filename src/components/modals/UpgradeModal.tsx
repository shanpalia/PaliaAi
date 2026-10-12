import React from 'react';
import { X, Sparkles, Check, ShieldCheck, ExternalLink } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const monthlyLink = 'https://rzp.io/rzp/q5Ri26Kb';
const yearlyLink = 'https://rzp.io/rzp/A086v2Tj';

const plans = [
  {
    id: 'monthly',
    name: 'Palia Pro Monthly',
    price: '₹49',
    period: '/ month',
    link: monthlyLink,
    features: [
      'Higher AI chat usage (subject to service limits)',
      'Access to premium models when enabled',
      'More capacity for coding and document help',
      'Image generation remains free for everyone',
    ],
  },
  {
    id: 'yearly',
    name: 'Palia Pro Yearly',
    price: '₹399',
    period: '/ year',
    link: yearlyLink,
    features: [
      'All Palia Pro benefits',
      'Lower cost than paying monthly for a year',
      'Image generation remains free for everyone',
      'One payment for 12 months',
    ],
    featured: true,
  },
];

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 backdrop-blur-sm p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Sparkles className="h-5 w-5" /></div>
            <div>
              <h2 id="upgrade-title" className="text-lg font-bold text-slate-900">Upgrade to Palia Pro</h2>
              <p className="text-xs text-slate-500">Support Palia AI and help fund its development</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close upgrade window" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 sm:p-7">
          <div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-950">
            <p className="font-semibold">Simple, affordable plans</p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">Pro is designed for people who need more AI chat and productivity capacity. Image generation remains free for everyone.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((plan) => (
              <section key={plan.id} className={`relative flex flex-col rounded-2xl border p-5 ${plan.featured ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
                {plan.featured && <span className="absolute -top-3 right-4 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">Best value</span>}
                <h3 className="text-sm font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1"><span className="text-3xl font-extrabold tracking-tight text-slate-950">{plan.price}</span><span className="text-xs text-slate-500">{plan.period}</span></div>
                <ul className="my-5 flex-1 space-y-2.5">
                  {plan.features.map((feature) => <li key={feature} className="flex items-start gap-2 text-xs text-slate-600"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{feature}</span></li>)}
                </ul>
                {plan.link ? (
                  <a href={plan.link} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700">
                    Continue to Razorpay <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <button type="button" disabled className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-400 cursor-not-allowed">Yearly payment link not configured</button>
                )}
              </section>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-[11px] leading-relaxed text-slate-500">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <p>Razorpay checkout opens separately. Premium access must only be activated after trusted server-side payment verification; this link alone does not activate an account's Pro plan. Confirm the Razorpay link is set to exactly ₹49 before sharing it.</p>
          </div>
          {!yearlyLink && <p className="mt-3 text-xs text-amber-700">Monthly and yearly Razorpay links are connected. Pro access still requires trusted server-side payment verification.</p>}
        </div>
      </div>
    </div>
  );
};
