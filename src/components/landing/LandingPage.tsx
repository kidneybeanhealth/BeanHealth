import React, { useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ProblemArtifacts } from './components/ProblemArtifacts';
import { ComparisonTable } from './components/ComparisonTable';
import { ComponentsArtifacts } from './components/ComponentsArtifacts';
import { HowItWorks } from './components/HowItWorks';
import { FeaturesDashboard } from './components/FeaturesDashboard';
import { Pricing } from './components/Pricing';
import { Team } from './components/Team';
import { Value } from './components/Value';
import { Differentiators } from './components/Differentiators';
import { Deployment } from './components/Deployment';
import { DemoForm } from './components/DemoForm';
import { Footer } from './components/Footer';

gsap.registerPlugin(ScrollTrigger);

const LandingPage = () => {
  useEffect(() => {
  }, []);

  return (
    <div className="min-h-screen bg-cream font-sans text-charcoal">
      <Navbar />
      <main>
        <Hero />
        <ProblemArtifacts />
        <ComparisonTable />
        <ComponentsArtifacts />
        <HowItWorks />
        <FeaturesDashboard />
        <Pricing />
        <Team />
        <Value />
        <Differentiators />
        <Deployment />
        <DemoForm />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
