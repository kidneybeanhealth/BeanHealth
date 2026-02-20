import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Mail, Linkedin } from 'lucide-react';

export const Team = () => {
    const tRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            gsap.from('.team-animate', {
                y: 40, opacity: 0, stagger: 0.15, duration: 1, ease: 'power3.out',
                scrollTrigger: { trigger: tRef.current, start: 'top 80%' }
            });
        }, tRef);
        return () => ctx.revert();
    }, []);

    return (
        <section ref={tRef} id="founder" className="py-32 px-6 bg-charcoal text-cream">
            <div className="max-w-6xl mx-auto">
                <h2 className="font-sans text-4xl md:text-5xl font-semibold mb-16 tracking-tight text-white text-center">
                    The Founding Team
                </h2>

                {/* Founding Profile */}
                <div className="team-animate mb-12">
                    <div className="team-card bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3.5rem] flex flex-col md:flex-row gap-8 md:gap-12 items-center md:items-stretch group hover:bg-white/10 transition-all hover:-translate-y-2 duration-500">
                        <div className="w-56 h-56 md:w-64 md:h-64 shrink-0 rounded-full overflow-hidden border border-white/10 bg-cream">
                            <img src="/Harish.png" alt="Harish S" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 flex flex-col pt-2">
                            <div className="mb-6 text-center md:text-left">
                                <h3 className="text-3xl font-sans font-bold text-white mb-2">Harish S</h3>
                                <p className="font-mono text-xs uppercase tracking-widest text-[#d87c54]">Founder & CEO</p>
                            </div>

                            <p className="text-cream/70 leading-relaxed mb-6 font-sans text-base text-center md:text-left">
                                Dedicated to bridging the gap between rigorous biological logic and elegant software, Harish oversees the product vision and algorithmic integrations of BeanHealth.
                            </p>

                            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-8">
                                {['Biosensor & Device Integration', 'Data Analytics Pipelines', 'Clinical Decision Layers', 'Scalable Infrastructure'].map((t, i) => (
                                    <span key={i} className="text-[10px] font-mono border border-white/10 bg-white/5 px-3 py-1.5 rounded-full text-white/50">{t}</span>
                                ))}
                            </div>

                            <div className="mt-auto flex flex-wrap items-center justify-center md:justify-start gap-4">
                                <a href="mailto:harish@beanhealth.in" className="inline-flex items-center gap-2 bg-[#059669] border border-[#059669]/50 px-6 py-2.5 rounded-full text-white hover:bg-[#047857] hover:text-white transition-all active:scale-95 duration-300 font-mono text-[10px] uppercase tracking-widest font-semibold shadow-lg shadow-emerald-500/10">
                                    <Mail size={14} /> Mail
                                </a>
                                <a href="https://www.linkedin.com/in/harish-s-espresso/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-[#2563EB] border border-blue-500/50 px-6 py-2.5 rounded-full text-white hover:bg-[#1D4ED8] hover:text-white transition-all active:scale-95 duration-300 font-mono text-[10px] uppercase tracking-widest font-semibold shadow-lg shadow-blue-500/20">
                                    <Linkedin size={14} /> Connect
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Development Team */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="team-animate">
                        <div className="team-card h-full bg-white/5 border border-white/10 p-8 rounded-[3rem] hover:bg-white/10 transition-all hover:-translate-y-2 duration-500 flex flex-col md:flex-row gap-6 items-center md:items-stretch group">
                            <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-full border border-white/10 bg-cream flex items-center justify-center overflow-hidden">
                                <img src="/Jnani.png" alt="Bonthu Jnani Venkata Ratna Kumar" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col flex-1 pt-2">
                                <div className="mb-4 text-center md:text-left">
                                    <h4 className="text-xl font-sans font-bold text-white mb-1 leading-tight">Bonthu Jnani Venkata<br />Ratna Kumar</h4>
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#8AC43C]">Full Stack Developer</p>
                                </div>

                                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                                    <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-2.5 py-1 rounded text-white/50">React</span>
                                    <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-2.5 py-1 rounded text-white/50">Node.js</span>
                                    <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-2.5 py-1 rounded text-white/50">MongoDB</span>
                                </div>

                                <a href="https://www.linkedin.com/in/bonthu-jnani-venkata-ratna-kumar-314874165/" target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-2 bg-[#2563EB] border border-blue-500/50 px-5 py-2 rounded-full text-white hover:bg-[#1D4ED8] hover:text-white transition-all active:scale-95 duration-300 font-mono text-[10px] uppercase tracking-widest font-semibold w-fit mx-auto md:mx-0 shadow-lg shadow-blue-500/20">
                                    <Linkedin size={14} /> Connect
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="team-animate">
                        <div className="team-card h-full bg-white/5 border border-white/10 p-8 rounded-[3rem] hover:bg-white/10 transition-all hover:-translate-y-2 duration-500 flex flex-col md:flex-row gap-6 items-center md:items-stretch group">
                            <div className="w-32 h-32 md:w-40 md:h-40 shrink-0 rounded-full border border-white/10 bg-cream flex items-center justify-center overflow-hidden">
                                <img src="/Saran.png" alt="Saran Kathiravan" className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col flex-1 pt-2">
                                <div className="mb-4 text-center md:text-left">
                                    <h4 className="text-xl font-sans font-bold text-white mb-1 leading-tight">Saran Kathiravan</h4>
                                    <p className="font-mono text-[10px] uppercase tracking-widest text-[#8AC43C]">Mobile & IoT Developer</p>
                                </div>

                                <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                                    <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-2.5 py-1 rounded text-white/50">Flutter</span>
                                    <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-2.5 py-1 rounded text-white/50">IoT</span>
                                    <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-2.5 py-1 rounded text-white/50">BLE</span>
                                </div>

                                <a href="https://www.linkedin.com/in/saran-kathiravan17/" target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-2 bg-[#2563EB] border border-blue-500/50 px-5 py-2 rounded-full text-white hover:bg-[#1D4ED8] hover:text-white transition-all active:scale-95 duration-300 font-mono text-[10px] uppercase tracking-widest font-semibold w-fit mx-auto md:mx-0 shadow-lg shadow-blue-500/20">
                                    <Linkedin size={14} /> Connect
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
