import { FeatureList } from '@/components/FeatureList';
import { Hero } from '@/components/Hero';

// No story on purpose: it shows as "no story" in the Lineage graph
export const Home = () => (
  <main>
    <Hero heading="Welcome" lead="An example site for the Lineage addon." />
    <FeatureList
      items={[
        { title: 'Trace', text: 'Hover a node to see its lineage.' },
        { title: 'Focus', text: 'Click to focus, with upstream and downstream levels.' },
        { title: 'Impact', text: 'See what a change affects.' },
      ]}
    />
  </main>
);
