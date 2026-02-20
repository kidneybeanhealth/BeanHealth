import React from 'react';
import { Users, Hospital } from 'lucide-react';

export const Value = () => {
    return (
        <section className="py-32 px-6 bg-cream text-charcoal">
            <div className="max-w-6xl mx-auto">
                <h2 className="text-center font-sans text-3xl md:text-4xl font-semibold mb-16 tracking-tight text-moss">
                    Value for Everyone
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white/40 border border-moss/10 p-10 rounded-[2.5rem] flex flex-col items-center text-center hover:bg-white/60 transition-all hover:-translate-y-2 duration-300 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-clay/10 text-clay flex items-center justify-center mb-6">
                            <Hospital size={32} />
                        </div>
                        <h3 className="text-2xl font-bold font-sans text-moss mb-4">Hospitals & Nephrologists</h3>
                        <ul className="text-sm text-charcoal/70 space-y-3">
                            <li>• Reduce clinical data reconstruction time.</li>
                            <li>• Prevent emergency admissions via early flags.</li>
                            <li>• Increase patient retention / follow-up revenue.</li>
                            <li>• Legal defensibility via full audit trails.</li>
                        </ul>
                    </div>

                    <div className="bg-white/40 border border-moss/10 p-10 rounded-[2.5rem] flex flex-col items-center text-center hover:bg-white/60 transition-all hover:-translate-y-2 duration-300 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-moss/10 text-moss flex items-center justify-center mb-6">
                            <Users size={32} />
                        </div>
                        <h3 className="text-2xl font-bold font-sans text-moss mb-4">Patients</h3>
                        <ul className="text-sm text-charcoal/70 space-y-3">
                            <li>• Peace of mind knowing data is constantly tracked.</li>
                            <li>• Timely interventions prevent serious events.</li>
                            <li>• Clear understanding of renal trajectory.</li>
                            <li>• Seamless continuous care rather than episodic.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
};
