import { Button } from '@/components/ui/Button';

/** The top of a page: heading, lead and a call to action. */
export const Hero = ({ heading, lead }: { heading: string; lead: string }) => (
  <header>
    <h1>{heading}</h1>
    <p>{lead}</p>
    <Button>Get in touch</Button>
  </header>
);
