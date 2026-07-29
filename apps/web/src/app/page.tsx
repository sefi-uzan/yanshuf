import { HeroSection } from '@/components/hero-section';
import { FeatureSections } from '@/components/feature-sections';
import { OpenSourceSection, CtaSection } from '@/components/open-source-section';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <FeatureSections />
      <OpenSourceSection />
      <CtaSection />
    </>
  );
}
