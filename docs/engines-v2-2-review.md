# AIDNode 2.2 candidate: safety and evidence hardening

Status: **staged for review, not deployed**. Existing Cloudflare production version is 2.1.0.

The review includes five targeted improvements:

- Repair rejects unknown transport error codes so invalid input does not appear actionable.
- Verify adds `independent_check_succeeded` requiring 2xx, no redirects, response digest, and matching expected digest when provided. Raw `digest_matches` remains available for diagnosis.
- Witness refuses empty validations and rejects matching content on non-2xx public responses.
- Monitor accepts optional `max_duration_ms` and reports whether observed latency met the budget.
- Recovery blocks apparently completed side-effectful steps when outcomes are unverified, and blocks downstream dependent steps.

The changes are deliberately backward compatible where possible, but **Witness empty assertions and Recovery side-effect states now fail closed**. Test integrations before deploying and update published tool schemas. The full integrated Worker is still maintained in Cloudflare and must be updated without replacing its D1 binding or existing secrets. **Do not publish this branch as a Registry release until the Worker is updated and smoke tested.**

Local build: 43 tests passed. GitHub CI exercises 10 focused regression scenarios. These are deterministic safety fixes, not a foundation model upgrade or proof of independent task completion. Billing stays disabled and no credentials are added to GitHub.
