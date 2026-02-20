import React from 'react';
import { ShieldCheck, Crosshair, Network, BarChart, Server, Link } from 'lucide-react';

export const Differentiators = () => {
    const items = [
        { title: 'Clinically Validated', desc: 'Rules built around KDIGO guidelines and reviewed by practicing nephrologists.', i: ShieldCheck },
        { title: 'CKD Specific', desc: 'Not a generic data lake. Engineered explicitly for renal deterioration matrices.', i: Crosshair },
        { title: 'Explainable Rules', desc: 'No black-box AI. Every flag maps traceably to a proven clinical rule.', i: Network },
        { title: 'True Provenance', desc: 'Every data point references the exact page, block, and time from source documents.', i: Link },
        { title: 'Auditable Workflow', desc: 'A medico-legal ledger tracking exactly when a flag was generated, seen, and resolved.', i: BarChart },
        { title: 'Infrastructure Scale', desc: 'Enterprise deployment model built for massive EMR document throughput.', i: Server },
    ];

    return (
        <section className="py-32 px-6 bg-charcoal text-cream relative">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-center font-sans text-3xl md:text-4xl font-semibold mb-16 tracking-tight text-white">
                    What Makes Bean<span className="text-clay font-drama italic">Health</span> Unique
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map((it, idx) => (
                        <div key={idx} className="bg-white/5 border border-white/10 p-8 rounded-[2rem] hover:bg-white/10 transition-colors duration-300">
                            <div className="w-12 h-12 rounded-full border border-clay/30 bg-clay/5 flex items-center justify-center mb-6 text-clay">
                                <it.i size={20} />
                            </div>
                            <h3 className="font-sans font-bold text-xl text-white mb-3">{it.title}</h3>
                            <p className="text-sm text-cream/60 leading-relaxed font-sans">{it.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
