# Audit Log Retention Policy

**Table**: `audit_logs`  
**Retention Period**: 7 years (2,555 days)  
**Requirement**: 21 CFR Part 11 §11.10(c), REQ-LAUNCH-031

## Policy

Audit log records must be retained for a minimum of **7 years** from the date of creation. No audit log record may be deleted before this retention period expires.

## Implementation

- Partitioned by year (`audit_logs_YYYY` partitions)
- Partition pruning after 7 years is the only permitted deletion mechanism
- UPDATE, DELETE, TRUNCATE are blocked at the database level
- Backup retention mirrors this policy (Neon PITR + annual snapshots)

## Validation

Run `tests/integration/audit-retention.test.ts` to verify retention configuration. Live database tests require `DATABASE_URL` to be set.

## References

- 21 CFR §11.10(c): "Protection of records to enable their accurate and ready retrieval throughout the records retention period."
- FDA Guidance: "Electronic Records; Electronic Signatures" (August 2003)
