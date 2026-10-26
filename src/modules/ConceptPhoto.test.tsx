import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ConceptPhoto from './ConceptPhoto';
afterEach(cleanup);

describe('concept photography', () => {
  it.each([
    {image:'marketplace' as const,alt:'An artisan and a shopper looking at a woven basket.'},
    {image:'gaming' as const,alt:'Friends playing a video game with controllers.'},
    {image:'opportunities' as const,alt:'Two colleagues reviewing a notebook at a shared workspace.'},
  ])('renders the $image photo without a badge and omits it in Extreme saver', ({image,alt}) => {
    const view=render(<ConceptPhoto image={image} saver="saver"/>);
    const photo=screen.getByRole('img',{name:alt});
    expect(photo.getAttribute('loading')).toBe('lazy');
    expect(photo.getAttribute('width')).toBe('640');
    expect(photo.getAttribute('height')).toBe('640');
    expect(view.container.textContent).toBe('');
    expect(view.container.querySelector('.concept-photo-label')).toBeNull();
    view.rerender(<ConceptPhoto image={image} saver="extreme"/>);
    expect(view.container.innerHTML).toBe('');
  });
  it('shows the photos without a generated-image badge or that wording in descriptions', () => {
    const {container}=render(<><ConceptPhoto image="home" saver="saver"/><ConceptPhoto image="waste" saver="saver"/></>);
    expect(container.querySelector('.concept-photo-label')).toBeNull();
    expect(container.textContent).toBe('');
    expect(screen.getAllByRole('img').every(photo=>!photo.getAttribute('alt')?.includes('AI-generated'))).toBe(true);
  });
  it.each(['standard', 'saver'] as const)('describes and lazily loads the Home image in %s mode', saver => {
    render(<ConceptPhoto image="home" saver={saver}/>);
    const photo=screen.getByRole('img', {name:/Neighbours with a shopping basket/});
    expect(photo.getAttribute('loading')).toBe('lazy');
    expect(photo.getAttribute('decoding')).toBe('async');
    expect(photo.getAttribute('width')).toBe('640');
    expect(photo.getAttribute('height')).toBe('478');
    expect(screen.queryByText('AI-generated image')).toBeNull();
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
    expect(screen.getByRole('img',{name:/A recycling collector and a resident/}).getAttribute('height')).toBe('640');
  });
});
