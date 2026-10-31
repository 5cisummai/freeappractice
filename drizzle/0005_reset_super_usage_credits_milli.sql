-- Production already ran the millicredit reset as part of the 0002 SQL that CI
-- recorded before that file was restored to DDL-only. Re-running
-- `UPDATE ... SET credits_milli = 0` here would wipe credits accumulated since
-- then. Fresh databases default credits_milli to 0, so this is a ledger no-op.
SELECT 1;
