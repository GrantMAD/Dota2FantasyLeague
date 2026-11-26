import { selectDashboardGameweek } from './gameweek-selection';

describe('selectDashboardGameweek', () => {
  const active = { id: 7, status: 'active', deadline: '2026-11-20T00:00:00Z' };
  const upcoming = { id: 8, status: 'upcoming', deadline: '2026-11-30T00:00:00Z' };
  const closed = { id: 6, status: 'closed', deadline: '2026-11-10T00:00:00Z' };

  it('keeps the active gameweek selected after its lineup deadline', () => {
    expect(selectDashboardGameweek([active, upcoming], closed)).toBe(active);
  });

  it('uses the upcoming gameweek when there is no active gameweek', () => {
    expect(selectDashboardGameweek([upcoming], closed)).toBe(upcoming);
  });

  it('falls back to the latest closed gameweek when no current or upcoming one exists', () => {
    expect(selectDashboardGameweek([], closed)).toBe(closed);
  });
});
