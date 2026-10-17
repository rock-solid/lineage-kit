import { Card } from '@/components/ui/Card';

/** Features as a row of cards. */
export const FeatureList = ({ items }: { items: { title: string; text: string }[] }) => (
  <section style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, 1fr)' }}>
    {items.map((item) => (
      <Card key={item.title} title={item.title}>
        <p>{item.text}</p>
      </Card>
    ))}
  </section>
);
