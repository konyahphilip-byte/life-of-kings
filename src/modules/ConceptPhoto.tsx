import { useState } from 'react';
import homePhoto from '../assets/eco-home-concept.jpg';
import wastePhoto from '../assets/eco-waste-concept.jpg';
import './concept-photo.css';

const photos = {
  home: { src: homePhoto, height: 478, alt: 'Neighbours with a shopping basket, tools and a plant.' },
  waste: { src: wastePhoto, height: 640, alt: 'A recycling collector and a resident sorting clean materials.' },
};
type Props = { image: keyof typeof photos; saver: 'standard' | 'saver' | 'extreme'; className?: string };

export default function ConceptPhoto({ image, saver, className = '' }: Props) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (saver === 'extreme' || failedSource === image) return null;
  const photo = photos[image];
  return <span className={`concept-photo ${className}`}>
    <img src={photo.src} alt={photo.alt} width={640} height={photo.height} loading="lazy" decoding="async" onError={() => setFailedSource(image)}/>
  </span>;
}
