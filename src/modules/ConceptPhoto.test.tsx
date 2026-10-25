import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ConceptPhoto from './ConceptPhoto';
afterEach(cleanup);

describe('generated concept photography', () => {
  it.each(['standard', 'saver'] as const)('labels and lazily loads the Home image in %s mode', saver => {
    render(<ConceptPhoto image="home" saver={saver}/>);
    const photo=screen.getByRole('img', {name:/AI-generated image of Ghanaian neighbours/});
    expect(photo.getAttribute('loading')).toBe('lazy');
    expect(photo.getAttribute('decoding')).toBe('async');
    expect(photo.getAttribute('width')).toBe('640');
    expect(photo.getAttribute('height')).toBe('478');
    expect(screen.getByText('AI-generated image')).toBeTruthy();
  });
  it('does not create an image or download target in Extreme saver mode', () => {
    const {container}=render(<ConceptPhoto image="waste" saver="extreme"/>);
    expect(container.innerHTML).toBe('');
  });
  it('hides failed art without replacing service controls or retrying it', () => {
    const view=render(<><button>Request a collection</button><ConceptPhoto image="waste" saver="saver"/></>);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByRole('button',{name:'Request a collection'})).toBeTruthy();
    view.rerender(<><button>Request a collection</button><ConceptPhoto image="waste" saver="standard"/></>);
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('can render a different source after one source fails', () => {
    const view=render(<ConceptPhoto image="home" saver="saver"/>);
    fireEvent.error(screen.getByRole('img'));
    view.rerender(<ConceptPhoto image="waste" saver="saver"/>);
    expect(screen.getByRole('img',{name:/AI-generated image of a recycling collector/}).getAttribute('height')).toBe('640');
  });
});
