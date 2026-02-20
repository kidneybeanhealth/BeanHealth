import React from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { LogoIcon } from '../../icons/LogoIcon';

export const Footer = () => {
    return (
        <footer className="bg-charcoal text-cream rounded-t-[4rem] px-6 pt-24 pb-12 mt-[-4rem] relative z-20 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-20 border-b border-white/10 pb-20">
                    <div className="col-span-1 md:col-span-4">
                        <div className="flex items-center gap-2.5 mb-8">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-white shadow-lg">
                                <LogoIcon className="w-7 h-7" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <h2 className="text-xl font-bold leading-none tracking-tight">
                                    <span className="text-white">Bean</span>
                                    <span className="text-secondary-500">Health</span>
                                </h2>
                            </div>
                        </div>
                        <p className="text-sm font-sans text-cream/70 max-w-sm leading-relaxed mb-8">
                            Transforming chronic kidney care through intelligent patient monitoring and clinical workflow automation.
                        </p>

                        <div className="flex flex-col gap-4 text-sm text-cream/70 font-sans">
                            <div className="flex items-center gap-3">
                                <Mail size={16} className="text-clay shrink-0" />
                                <span>harish@beanhealth.in</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Phone size={16} className="text-clay shrink-0" />
                                <span>+91 73586 57802</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin size={16} className="text-clay shrink-0" />
                                <span>Coimbatore, India</span>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-1 md:col-span-3 md:col-start-6">
                        <h4 className="font-sans text-xs font-semibold text-white/40 tracking-widest uppercase mb-6">Product</h4>
                        <ul className="space-y-4 text-sm font-sans text-[#7A9E66]">
                            <li><a href="#" className="hover:text-white transition-colors">Patient App</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Nephrologist Dashboard</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Coordinator System</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                        </ul>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <h4 className="font-sans text-xs font-semibold text-white/40 tracking-widest uppercase mb-6">Company</h4>
                        <ul className="space-y-4 text-sm font-sans text-[#7A9E66]">
                            <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                        </ul>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                        <h4 className="font-sans text-xs font-semibold text-white/40 tracking-widest uppercase mb-6">Legal</h4>
                        <ul className="space-y-4 text-sm font-sans text-[#7A9E66]">
                            <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">HIPAA Compliance</a></li>
                            <li><a href="#" className="hover:text-white transition-colors">Data Security</a></li>
                        </ul>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-xs font-sans text-white/30">&copy; 2026 BeanHealth Private Limited. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};
