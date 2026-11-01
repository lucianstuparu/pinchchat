/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { TodoPanel, type TodoPanelProps } from '../Todo';
import type { NowItem } from '../api';

void React;
const item = (over: Partial<NowItem>): NowItem => ({
  id: 'tsk-1', n: 1, title: 'x', kind: 'task', store: 'tasks', scope: 'private', status: 'todo', priority: 'P3', weight: 1, section: 'later', ...over,
});
const task = item({ id: 'tsk-2026-11-01-000001', n: 12, title: 'Call **SFR**', due_date: '2026-11-02', section: 'week' });
const edf = item({ id: 'tsk-2026-11-01-000002', n: 31, title: '**EDF** takes 142 €', kind: 'watch', status: 'watching', due_date: '2026-11-03', amount: 142, currency: 'EUR' });
const parcel = item({ id: 'tsk-2026-11-01-000003', n: 32, title: 'Parcel from **Fnac**', kind: 'watch', status: 'watching', due_date: '2026-11-20' });
const old = item({ id: 'tsk-2026-11-01-000004', n: 30, title: '**Free** takes 30 €', kind: 'watch', status: 'passed', due_date: '2026-10-28' });

const props = (over: Partial<TodoPanelProps> = {}): TodoPanelProps => ({
  mode: 'light', tab: 'todo', onTab: () => undefined, items: [task], loops: [], today: '2026-11-01',
  watch: { upcoming: [edf, parcel], passed: [old] },
  loaded: true, expired: false, refreshing: false, onRefresh: () => undefined,
  onDone: () => undefined, onStar: () => undefined, onOpen: () => undefined, onContinue: () => undefined,
  onAdd: () => undefined, transcribe: async () => '', reply: null, onDismissReply: () => undefined, ...over,
});

describe('watch-outs in To do', () => {
  it('shows them in Passing by, without a tick box, and never counts them', () => {
    render(<TodoPanel {...props()} />);
    const section = screen.getByRole('region', { name: 'Passing by' });
    expect(within(section).getByText('31')).toBeDefined();
    expect(within(section).queryByRole('button', { name: /^Done/ })).toBeNull();
    expect(within(section).getByText('€142')).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Done:/ })).toHaveLength(1);   // only the task
    expect(screen.getByRole('tab', { name: /To do/ }).textContent).toContain('1');
    expect(within(section).queryByText(/Free/)).toBeNull();   // passed: folded
    fireEvent.click(within(section).getByRole('button', { name: /Passed · 1/ }));
    expect(within(section).getByText(/Free/)).toBeDefined();
  });

  it('Watching shows only them; a search finds them', () => {
    render(<TodoPanel {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Watching' }));
    expect(screen.queryByText('SFR')).toBeNull();
    expect(screen.getByText('Fnac')).toBeDefined();
    expect(screen.getByText('Free')).toBeDefined();   // passed ones unfolded
    fireEvent.click(screen.getByRole('button', { name: 'Watching' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'fnac' } });
    expect(screen.getByText('Fnac')).toBeDefined();
    expect(screen.queryByText('EDF')).toBeNull();
  });
});
