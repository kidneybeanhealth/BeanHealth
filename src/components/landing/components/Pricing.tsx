import React, { useState } from 'react';
import { Check } from 'lucide-react';

export const Pricing = () => {
    const [isAnnual, setIsAnnual] = useState(true);

    return (
        <section id="pricing" className="pt-16 pb-32 px-6 bg-cream text-charcoal">
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-16">
                    <h2 className="font-sans text-4xl md:text-5xl font-semibold mb-6 text-moss tracking-tight">Clinic Subscription Plans</h2>
                    <p className="text-lg text-charcoal/60 mb-8 max-w-xl mx-auto">
                        Flexible plans for nephrology and dialysis centers
                    </p>

                    <div className="inline-grid grid-cols-2 bg-white/50 border border-moss/10 rounded-full p-1.5 relative backdrop-blur-md">
                        <button
                            className={`relative z-10 px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center active:scale-95 ${!isAnnual ? 'text-white' : 'text-moss/60 hover:text-moss'}`}
                            onClick={() => setIsAnnual(false)}
                        >
                            Billed Monthly
                        </button>
                        <button
                            className={`relative z-10 px-8 py-3 rounded-full text-sm font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center active:scale-95 ${isAnnual ? 'text-white' : 'text-moss/60 hover:text-moss'}`}
                            onClick={() => setIsAnnual(true)}
                        >
                            <span>Billed Annually</span>
                            <span className={`text-[10px] ml-2 transition-colors duration-300 ${isAnnual ? 'text-white/60' : 'text-clay opacity-80'}`}>(Save 20%)</span>
                        </button>
                        <div
                            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-moss rounded-full transition-transform duration-500 ease-in-out shadow-lg ${isAnnual ? 'translate-x-full' : 'translate-x-0'}`}
                            style={{ left: '6px' }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end mb-12">
                    {/* Plan 1 */}
                    <div className="bg-white/40 border border-moss/10 p-10 rounded-[2.5rem] hover:bg-white/60 transition-all hover:-translate-y-2 duration-300 flex flex-col h-[500px]">
                        <h3 className="font-sans text-2xl font-bold text-moss mb-2">Prescription + Hospital Workflow</h3>
                        <p className="font-mono text-sm tracking-widest uppercase text-moss/50 mb-8">Base Tier</p>
                        <div className="text-3xl font-light mb-8 font-sans">
                            {isAnnual ? '₹1,20,000' : '₹12,000'} <span className="text-lg text-charcoal/40 font-mono tracking-widest uppercase">/ {isAnnual ? 'year' : 'month'}</span>
                        </div>
                        <ul className="space-y-4 mb-auto text-sm text-charcoal/70">
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> Digital Prescriptions</li>
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> Pharmacy Queue</li>
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> Medication Dropdown</li>
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> Branded Printouts</li>
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> Support</li>
                        </ul>
                        <button className="w-full py-4 mt-8 rounded-full border border-moss/20 font-bold uppercase tracking-widest text-xs hover:bg-moss/5 transition-all active:scale-95 duration-300 text-moss">Get Started</button>
                    </div>

                    {/* Plan 2: Most Popular */}
                    <div className="bg-moss text-cream border border-moss p-10 rounded-[3rem] hover:shadow-2xl transition-all duration-500 flex flex-col h-[550px] relative transform hover:-translate-y-2 md:hover:-translate-y-6 md:-translate-y-4 shadow-xl">
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-clay text-white px-4 py-1 rounded-full font-mono text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg">Most Popular</div>
                        <h3 className="font-sans text-2xl font-bold mb-2 text-white">Hospital Workflow + CKD Snapshot</h3>
                        <p className="font-mono text-sm tracking-widest uppercase text-cream/50 mb-8">Advanced Tier</p>
                        <div className="text-3xl font-light mb-8 font-sans text-white">
                            {isAnnual ? '₹1,70,000' : '₹17,000'} <span className="text-lg text-white/40 font-mono tracking-widest uppercase">/ {isAnnual ? 'year' : 'month'}</span>
                        </div>
                        <ul className="space-y-4 mb-auto text-sm text-cream/80">
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> All above features</li>
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> CKD Dashboard</li>
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> Lab Trends</li>
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> Patient App</li>
                            <li className="flex items-start gap-3"><Check size={16} className="text-clay shrink-0 mt-0.5" /> Follow-up Alerts</li>
                        </ul>
                        <button className="w-full py-4 mt-8 rounded-full bg-clay text-white font-bold uppercase tracking-widest text-xs hover:bg-clay/90 transition-all active:scale-95 duration-300 shadow-xl border border-clay">Get Started</button>
                    </div>

                    {/* Plan 3 */}
                    <div className="bg-white/40 border border-moss/10 p-10 rounded-[2.5rem] hover:bg-white/60 transition-all hover:-translate-y-2 duration-300 flex flex-col h-[500px]">
                        <h3 className="font-sans text-2xl font-bold text-moss mb-2">CKD Snapshot (Integration Mode)</h3>
                        <p className="font-mono text-sm tracking-widest uppercase text-moss/50 mb-8">Add-on</p>
                        <div className="text-3xl font-light mb-8 font-sans text-moss">
                            Custom <span className="text-lg text-charcoal/40 font-mono tracking-widest uppercase">Quote</span>
                        </div>
                        <p className="text-sm text-charcoal/70 mb-auto leading-relaxed">
                            For those with existing EMR. Seamless integration of our CKD Snapshot engine into your current workflow.
                        </p>
                        <button className="w-full py-4 mt-8 rounded-full border border-moss/20 font-bold uppercase tracking-widest text-xs hover:bg-moss/5 transition-all active:scale-95 duration-300 text-moss">Contact Sales</button>
                    </div>
                </div>

                <div className="text-center font-sans text-xs italic text-charcoal/50">
                    No setup fees &nbsp;|&nbsp; Free 7-day pilot &nbsp;|&nbsp; Snapshot enabled after doctor approval
                </div>
            </div>
        </section>
    );
};
