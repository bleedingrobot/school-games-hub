import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock('../lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...(a as [])) } }));

import { fillStory, storyProblems, type Story } from '../../shared/kit/stories';
import { StoryBook } from './StoryBook';
import { StoryShelf } from './StoryShelf';
import { resetStoriesForTest, useStories, useStoryOnce } from './useStories';

const story: Story = {
  id: 'test-opening',
  title: 'The Test',
  pages: [
    { title: 'One', text: 'Hello {name}.', standIn: { emoji: '🌙', sky: ['#000', '#123'] } },
    { title: 'Two', text: 'Off you go.', standIn: { emoji: '🚀', sky: ['#000', '#123'] }, art: { wide: '/a.webp', small: '/a-800.webp' } },
  ],
};

beforeEach(() => {
  rpc.mockClear();
  resetStoriesForTest();
});

describe('stories', () => {
  it('checks a game\'s stories and fills blanks', () => {
    expect(storyProblems([story])).toEqual([]);
    const long = { ...story, id: 'Bad', pages: [{ ...story.pages[0], text: 'word '.repeat(50) }] };
    expect(storyProblems([long, story, story]).length).toBe(3);
    expect(fillStory('Hi {name} {other}', { name: 'Ana' })).toBe('Hi Ana {other}');
  });

  it('turns pages, shows the painting when there is one, and marks the story seen when it ends', () => {
    const closed = vi.fn();
    render(<StoryBook story={story} blanks={{ name: 'Ana' }} onClose={closed} endLabel="Let's go!" />);
    expect(screen.getByText('Hello Ana.')).toBeTruthy();
    expect(screen.getByText('🌙')).toBeTruthy();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Off you go.')).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('src')).toBe('/a.webp');
    fireEvent.click(screen.getByText("Let's go!"));
    expect(closed).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith('mark_story_seen', { story: 'test-opening' });
  });

  it('can be skipped from the first page, by button or Escape', () => {
    const closed = vi.fn();
    const { unmount } = render(<StoryBook story={story} onClose={closed} />);
    fireEvent.click(screen.getByText(/Skip/));
    expect(closed).toHaveBeenCalledOnce();
    unmount();
    resetStoriesForTest();
    render(<StoryBook story={story} onClose={closed} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(closed).toHaveBeenCalledTimes(2);
  });

  it('shows a story by itself once, and not to a pupil who has seen it', async () => {
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
  });

  it('the shelf opens unlocked stories and hides the rest behind a hint', async () => {
    render(<StoryShelf stories={[{ story, open: true }, { story: { ...story, id: 'test-later', title: 'Later' }, open: false, hint: 'Reach level 3' }]} />);
    await act(async () => {});
    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Reach level 3')).toBeTruthy();
    expect(screen.queryByText('Later')).toBeNull();
    fireEvent.click(screen.getByLabelText('Watch The Test'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('useStories says when the list is ready', async () => {
    function Probe() {
      const { ready, shouldShow } = useStories();
      return <span>{ready ? (shouldShow('x-y') ? 'show' : 'hide') : 'wait'}</span>;
    }
    render(<Probe />);
    await act(async () => {});
    expect(screen.getByText('show')).toBeTruthy();
  });
});
