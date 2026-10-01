import { createClient } from '@supabase/supabase-js';

interface JobResult {
  success: boolean;
  gameweeksActivated: number;
  gameweeksClosed: number;
  seasonsRolledOver: number;
  errors: string[];
  duration: number;
}

interface TransitionResult {
  success: boolean;
  gameweeks_activated?: number;
  gameweeks_closed?: number;
  seasons_rolled_over?: number;
}

class TransitionGameweeks {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
  }

  public async execute(): Promise<JobResult> {
    const startTime = Date.now();
    const result: JobResult = {
      success: true,
      gameweeksActivated: 0,
      gameweeksClosed: 0,
      seasonsRolledOver: 0,
      errors: [],
      duration: 0,
    };

    try {
      const { data, error } = await this.supabase.rpc('process_gameweek_transitions_and_rollover');

      if (error) {
        throw error;
      }

      const transitionResult = data as TransitionResult | null;
      if (transitionResult?.success) {
        result.gameweeksActivated = transitionResult.gameweeks_activated || 0;
        result.gameweeksClosed = transitionResult.gameweeks_closed || 0;
        result.seasonsRolledOver = transitionResult.seasons_rolled_over || 0;
      } else {
        result.success = false;
        result.errors.push('RPC returned failure or unexpected format.');
      }
    } catch (error: unknown) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : String(error));
      console.error('[Transition Gameweeks Job] Failed:', error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

export async function transitionGameweeks(): Promise<JobResult> {
  const job = new TransitionGameweeks();
  return await job.execute();
}
