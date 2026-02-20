import React, { useEffect, Suspense, lazy } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';

// Lazy load below-the-fold components to improve initial load performance
const ProblemArtifacts = lazy(() => import('./components/ProblemArtifacts').then(m => ({ default: m.ProblemArtifacts })));
const ComparisonTable = lazy(() => import('./components/ComparisonTable').then(m => ({ default: m.ComparisonTable })));
const ComponentsArtifacts = lazy(() => import('./components/ComponentsArtifacts').then(m => ({ default: m.ComponentsArtifacts })));
const HowItWorks = lazy(() => import('./components/HowItWorks').then(m => ({ default: m.HowItWorks })));
const FeaturesDashboard = lazy(() => import('./components/FeaturesDashboard').then(m => ({ default: m.FeaturesDashboard })));
const Pricing = lazy(() => import('./components/Pricing').then(m => ({ default: m.Pricing })));
const Team = lazy(() => import('./components/Team').then(m => ({ default: m.Team })));
const Value = lazy(() => import('./components/Value').then(m => ({ default: m.Value })));
const Differentiators = lazy(() => import('./components/Differentiators').then(m => ({ default: m.Differentiators })));
const Deployment = lazy(() => import('./components/Deployment').then(m => ({ default: m.Deployment })));
const DemoForm = lazy(() => import('./components/DemoForm').then(m => ({ default: m.DemoForm })));
const Footer = lazy(() => import('./components/Footer').then(m => ({ default: m.Footer })));

gsap.registerPlugin(ScrollTrigger);

const LoadingFallback = () => (
  <div className="w-full h-32 flex items-center justify-center">
    <div className="w-6 h-6 rounded-full border-2 border-clay border-t-transparent animate-spin opacity-50"></div>
  </div>
);

const LandingPage = () => {
  useEffect(() => {
  }, []);

  return (
    <div className="min-h-screen bg-cream font-sans text-charcoal">
      <Navbar />
      <main>
        <Hero />
        <Suspense fallback={<LoadingFallback />}>
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
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
};

export default LandingPage;
