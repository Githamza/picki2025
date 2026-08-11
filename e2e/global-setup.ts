import { execFileSync } from 'node:child_process';

/**
 * Reset order data before each e2e invocation.
 *
 * Why: order_number is `YYMMDD-<3-digit random>` with a DB unique
 * constraint (orders_order_number_key), so orders accumulated across suite
 * runs on the same day collide and flake the journey specs. (The same
 * defect can hit real customers on a busy day — flagged in tasks/plan.md
 * findings; the app-side fix is behind the order-submission Ask-first
 * boundary.)
 *
 * Local stack only — hardcoded 127.0.0.1 guards against ever touching a
 * remote database.
 */
export default function globalSetup(): void {
  try {
    execFileSync(
      'psql',
      [
        '-h', '127.0.0.1',
        '-p', '54322',
        '-U', 'postgres',
        '-d', 'postgres',
        '-c', 'truncate table public.order_items, public.orders cascade;',
      ],
      { env: { ...process.env, PGPASSWORD: 'postgres' }, stdio: 'pipe' }
    );
  } catch (error) {
    // Non-fatal: the suite still runs; collisions just become possible again.
    console.warn(
      '[global-setup] could not truncate orders on local Supabase:',
      (error as Error).message
    );
  }
}
