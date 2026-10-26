import { useState } from 'react';
import homePhoto from '../assets/eco-home-concept.jpg';
import wastePhoto from '../assets/eco-waste-concept.jpg';
import marketplacePhoto from '../assets/eco-marketplace-concept.jpg';
import gamingPhoto from '../assets/eco-gaming-concept.jpg';
import opportunitiesPhoto from '../assets/eco-opportunities-concept.jpg';
import './concept-photo.css';

const photos = {
  home: { src: homePhoto, height: 478, alt: 'Neighbours with a shopping basket, tools and a plant.' },
  waste: { src: wastePhoto, height: 640, alt: 'A recycling collector and a resident sorting clean materials.' },
  marketplace: { src: marketplacePhoto, height: 640, alt: 'An artisan and a shopper looking at a woven basket.' },
  gaming: { src: gamingPhoto, height: 640, alt: 'Friends playing a video game with controllers.' },
  opportunities: { src: opportunitiesPhoto, height: 640, alt: 'Two colleagues reviewing a notebook at a shared workspace.' },
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
