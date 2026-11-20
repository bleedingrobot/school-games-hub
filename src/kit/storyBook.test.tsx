import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) } }));

import { fillStory, storyProblems, type Story } from '../../shared/kit/stories';
import { StoryBook } from './StoryBook';
import { StoryShelf } from './StoryShelf';
import { resetStoriesForTest, useStoryOnce } from './useStories';

const story: Story = {
  id: 'test-opening',
  title: 'The Test',
  pages: [
    { title: 'One', text: 'Hello {name}.', standIn: { emoji: '🌙', sky: ['#000', '#123'] } },
    { title: 'Two', text: 'Off you go.', standIn: { emoji: '🚀', sky: ['#000', '#123'] }, art: { wide: '/a.webp', small: '/a-800.webp' } },
  ],
};

// One test for the whole of it, to stay in the kit's test budget (docs/TESTING.md).
describe('stories', () => {
  it('checks words, turns pages, can be skipped, shows by itself once, and the shelf hides locked stories', async () => {
    // The checks and blanks.
    expect(storyProblems([story])).toEqual([]);
    const long = { ...story, id: 'Bad', pages: [{ ...story.pages[0], text: 'word '.repeat(50) }] };
    expect(storyProblems([long, story, story]).length).toBe(3);
    expect(fillStory('Hi {name} {other}', { name: 'Ana' })).toBe('Hi Ana {other}');

    // Pages: a stand-in, then the painting; the end marks it seen.
    resetStoriesForTest();
    const closed = vi.fn();
    render(<StoryBook story={story} blanks={{ name: 'Ana' }} onClose={closed} endLabel="Let's go!" />);
    expect(screen.getByText('Hello Ana.')).toBeTruthy();
    expect(screen.getByText('🌙')).toBeTruthy();
    fireEvent.click(screen.getByText('Next'));
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/a.webp');
    fireEvent.click(screen.getByText("Let's go!"));
    expect(closed).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('mark_story_seen', { story: 'test-opening' });
    cleanup();

    // Skip from the first page, by button or by Escape.
    render(<StoryBook story={story} onClose={closed} />);
    fireEvent.click(screen.getByText(/Skip/));
    cleanup();
    render(<StoryBook story={story} onClose={closed} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(closed).toHaveBeenCalledTimes(3);
    cleanup();

    // Once by itself, and never to a pupil who has seen it.
    function Probe({ id }: { id: string }) {
      const { open, close } = useStoryOnce(id);
      return open ? <button onClick={close}>open</button> : <span>shut</span>;
    }
    resetStoriesForTest(['seen-one']);
    render(<><Probe id="seen-one" /><Probe id="new-one" /></>);
    await act(async () => {});
    expect(screen.getAllByText('shut').length).toBe(1);
    fireEvent.click(screen.getByText('open'));
    expect(screen.getAllByText('shut').length).toBe(2);
    cleanup();

    // The shelf: unlocked ones open, locked ones show only a hint.
    resetStoriesForTest([]);
    render(<StoryShelf stories={[{ story, open: true }, { story: { ...story, id: 'test-later', title: 'Later' }, open: false, hint: 'Reach level 3' }]} />);
    await act(async () => {});
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Reach level 3')).toBeTruthy();
    expect(screen.queryByText('Later')).toBeNull();
    fireEvent.click(screen.getByLabelText('Watch The Test'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
