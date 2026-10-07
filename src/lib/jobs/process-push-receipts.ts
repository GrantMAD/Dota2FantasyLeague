import { createClient } from '@supabase/supabase-js';
import { processExpoPushReceipts } from '@/lib/push-notifications';

export interface ProcessPushReceiptsResult {
  success: boolean;
  receiptsProcessed: number;
  invalidTokensRemoved: number;
  errors: string[];
  duration: number;
}

export async function processPushReceipts(): Promise<ProcessPushReceiptsResult> {
  const startTime = Date.now();
  const result: ProcessPushReceiptsResult = {
    success: true,
    receiptsProcessed: 0,
    invalidTokensRemoved: 0,
    errors: [],
    duration: 0,
  };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    );
    const receipts = await processExpoPushReceipts(supabase);
    result.receiptsProcessed = receipts.receiptsProcessed;
    result.invalidTokensRemoved = receipts.invalidTokensRemoved;
    result.errors.push(...receipts.errors);
    result.success = receipts.errors.length === 0;
  } catch (error: unknown) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : String(error));
  }

  result.duration = Date.now() - startTime;
  return result;
}
