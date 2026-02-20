import React from 'react';
import { PackageOpen, Activity, Lock, Users } from 'lucide-react';

export const Deployment = () => {
    return (
        <section className="py-32 px-6 bg-cream text-charcoal">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="font-sans text-3xl md:text-4xl font-semibold mb-6 tracking-tight text-moss">
                        Flexible Deployment Model
                    </h2>
                    <p className="font-sans text-sm italic text-charcoal/60 mt-6 max-w-2xl mx-auto">
                        BeanHealth is sold to hospitals and nephrology practices as clinical workflow infrastructure, not a consumer health app.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                        { t: 'Hospital Subscription', d: 'Enterprise licensing agreements covering entire nephrology departments and remote clinics.', i: Lock },
                        { t: 'Per-Patient Activation', d: 'Tiered performance models based on active monitored chronic kidney disease volume.', i: Users },
                        { t: 'Enterprise Licensing', d: 'HL7/FHIR ready integration pipes for direct parsing of unstructured narrative fields.', i: PackageOpen },
                        { t: 'Device Kits Add-on (Phase 2)', d: 'Add-on module for BLE physiological monitoring devices prescribed to high-risk groups.', i: Activity },
                    ].map((c, i) => (
                        <div key={i} className="bg-white/40 p-8 rounded-[2rem] border border-moss/5 hover:border-moss/20 transition-colors shadow-sm">
                            <div className="w-10 h-10 rounded-full border border-moss/20 bg-moss/5 flex items-center justify-center mb-4 text-moss">
                                <c.i size={16} />
                            </div>
                            <h4 className="font-sans font-bold text-moss mb-2">{c.t}</h4>
                            <p className="text-xs text-charcoal/60 leading-relaxed font-sans">{c.d}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
