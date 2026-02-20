import React, { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';

export const DemoForm = () => {
    const [formData, setFormData] = useState({ name: '', email: '', message: '' });

    return (
        <section id="demo-section" className="py-32 px-6 bg-charcoal text-cream relative">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16">
                <div className="flex-1 md:w-1/2">
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-clay font-bold mb-6">Schedule Demo</p>
                    <h2 className="font-sans text-4xl md:text-5xl lg:text-6xl font-semibold mb-8 text-white tracking-tight">
                        Stop scanning records. <br />
                        <span className="font-drama italic font-light text-clay">Start deciding.</span>
                    </h2>
                    <p className="text-lg text-cream/70 leading-relaxed max-w-lg font-sans mb-12">
                        Schedule a 15-minute clinical demo to see exactly how BeanHealth compresses fragmented CKD data into actionable insights for your practice.
                    </p>

                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-3xl max-w-sm mb-8 md:mb-0">
                        <Lock size={20} className="text-moss/50 shrink-0" />
                        <p className="font-sans text-xs text-cream/50 leading-relaxed">
                            Your information is securely encrypted and never shared. We only use this to schedule a direct demo with our clinical team.
                        </p>
                    </div>
                </div>

                <div className="flex-1 md:w-1/2 bg-white/5 border border-white/10 p-10 md:p-14 rounded-[3rem]">
                    <form className="flex flex-col gap-6 font-sans">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="name" className="text-xs font-mono uppercase tracking-widest text-cream/60">Full Name *</label>
                            <input
                                id="name"
                                type="text"
                                required
                                className="bg-transparent border-b border-white/20 px-0 py-3 text-white focus:outline-none focus:border-clay transition-colors font-sans placeholder:text-white/20"
                                placeholder="Dr. Jane Doe"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2 mt-4">
                            <label htmlFor="email" className="text-xs font-mono uppercase tracking-widest text-cream/60">Professional Email *</label>
                            <input
                                id="email"
                                type="email"
                                required
                                className="bg-transparent border-b border-white/20 px-0 py-3 text-white focus:outline-none focus:border-clay transition-colors font-sans placeholder:text-white/20"
                                placeholder="jane.doe@hospital.org"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>

                        <div className="flex flex-col gap-2 mt-4 mb-4">
                            <label htmlFor="message" className="text-xs font-mono uppercase tracking-widest text-cream/60">What are you looking for? *</label>
                            <textarea
                                id="message"
                                required
                                rows={3}
                                className="bg-transparent border-b border-white/20 px-0 py-3 text-white focus:outline-none focus:border-clay transition-colors font-sans resize-none placeholder:text-white/20"
                                placeholder="Currently experiencing issues tracking eGFR decline between visits..."
                                value={formData.message}
                                onChange={e => setFormData({ ...formData, message: e.target.value })}
                            />
                        </div>

                        <button
                            type="submit"
                            className="mt-6 flex items-center justify-between w-full bg-clay text-white px-8 py-5 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-clay/90 transition-all active:scale-95 duration-300 shadow-xl"
                        >
                            <span>Request Clinical Demo</span>
                            <ArrowRight size={16} />
                        </button>
                    </form>
                </div>

            </div>
        </section>
    );
};
