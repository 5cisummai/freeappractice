# Legal/compliance audit — 2026-07-13

> This is a product-risk review, not legal advice. Obtain IP/privacy counsel before launch or any rebrand decision.

## Executive priority

**Do not treat a trademark footer as a cure.** The largest immediate issue is the public brand and domain: **Free AP Practice** and `freeappractice.org` use the College Board's `AP®` mark as part of a service and a domain. College Board's published third-party guidelines expressly prohibit that use. Pause paid acquisition and new brand promotion, select a non-AP brand/domain, then obtain counsel on migration/redirects and whether to seek written permission. The same guidelines require mark symbols and a visible per-page attribution wherever a College Board mark appears; a Terms-only disclaimer does not satisfy their stated rule.

## Findings and practical actions

### P0 — Trademark in the product/service and domain name

**Evidence.** The public name is `Free AP Practice` (`src/lib/auth/server.ts:40`; `README.md:1`) and the site is deployed/promoted as `freeappractice.org` (for example, `src/routes/privacy/+page.svelte:14` and `static/openapi.json:15`). `AP` is used throughout public labels and metadata, including structured data (`src/routes/+page.svelte:146-147`). No College Board attribution/non-endorsement statement exists in the repository search.

**Why this is high risk.** College Board states that `AP®` and `Advanced Placement®` are its marks; it says third parties must not use a College Board trademark in a company, product, service, domain, website address, or meta tag, and must not imply affiliation. It also says a trademark disclaimer belongs at the bottom of the home page and every internal page using the mark, not only in Terms/legal notice. See [College Board trademark guidelines](https://privacy.collegeboard.org/copyright-trademark/guidelines).

**Action.** Rename the product and move to a domain that contains no College Board mark. Use a descriptive sentence rather than a branded compound when a reference is necessary, e.g. `Independent practice questions for Advanced Placement® courses`; keep the app's own name visually dominant. If continuing any AP-mark use, ask College Board for written permission first and use its prescribed visible attribution: `AP® is a trademark registered by the College Board, which is not affiliated with, and does not endorse, this website.` Do **not** use College Board logos. Do not bid on AP/College Board marks in search or social advertising; College Board's guidelines say it does not permit this.

### P0 — College Board copyrighted material in AI workflow and public copy

**Evidence.** The catalogue records that its unit descriptions are sourced from College Board pages (`src/lib/data/unit-descriptionsrevised.json:3`). Generated public practice-page data repeatedly states `College Board topic statements ...` (`src/lib/data/practice-pages.json`, e.g. lines 48, 85, 122). The generation prompt instructs the model to have `deep knowledge of College Board standards` and create questions that `closely mirror real AP exam questions` (`src/lib/questions/generation.server.ts:271-277`).

**Why this is high risk.** College Board says it does not grant permission to use its copyrighted content, including practice-test questions, with generative AI or to train an AI system/application using its content. Its permission instructions separately require a request to use AP test materials and say test-prep use is commercial if intended for commercial advantage/private monetary compensation. See [College Board guidelines](https://privacy.collegeboard.org/copyright-trademark/guidelines) and [permission instructions](https://privacy.collegeboard.org/copyright-trademark/request-instructions).

**Action.** Immediately create a content-provenance inventory: every course description, unit/topic list, question, image, excerpt, and prompt source. Remove/replace verbatim or closely adapted College Board material unless written permission is documented. Change AI instructions to require wholly original questions and prohibit copying, paraphrasing closely, or recreating identifiable official questions, stimuli, rubrics, scoring guidance, or CED text. Avoid claims such as `authentic`, `real`, or `closely mirror`; say `independent, original practice questions` instead. Counsel should assess whether the remaining short references to course names/topics are nominative/fair use under College Board's much stricter published policy.

### P1 — Privacy policy does not disclose a public-GitHub disclosure risk

**Evidence.** Privacy Policy §7 says bug reports are sent as GitHub Issues (`src/routes/privacy/+page.svelte:180-181`), but the form collects an optional email plus free text and question prompt/correct-answer metadata (`src/lib/components/bug-report-dialog.svelte:89-108`). The server places all of it into an issue (`src/routes/api/bug-report/+server.ts:33-59,118-133`). The dialog does not warn that the report may be public or tell students not to include personal/sensitive information (`src/lib/components/bug-report-dialog.svelte:182-188`).

**Risk/action.** If the target repository is public, this can publish a student's email, free-text personal data, and generated-question contents permanently to GitHub. Make intake private (database, private repository, or support inbox) **or** add a conspicuous pre-submit warning, remove email/default question-content forwarding, and link the exact destination/privacy practice. Update §§2 and 7 to state what is sent to GitHub, whether issues are public, and retention/deletion limits. Do not claim deletion from third-party systems you cannot actually complete.

### P1 — Youth audience: policy alone is not an operational COPPA control

**Evidence.** The product targets students and collects account email/name, practice history, tutor prompts, cookies/local storage, and analytics (`src/routes/privacy/+page.svelte:53-90,120-158`). The policy says it is not directed to children under 13 (`src/routes/privacy/+page.svelte:211-216`), but signup has no age screen or parent/guardian flow; it only presents a clickwrap to Terms/Privacy (`src/lib/components/signup-form.svelte:177-182`).

**Risk/action.** A general-audience service does not have to age-screen solely because students might use it, but COPPA applies if it is child-directed or the operator has actual knowledge it collects personal information from under-13 users. If the intended minimum age is 13, put an enforceable 13+ statement/age gate before account creation and define a prompt deletion/escalation process when an under-13 account is reported. If you intentionally serve under-13 users, stop and design the full parental-notice/verifiable-consent/access/deletion program before collecting data or loading third-party analytics. See [FTC COPPA guidance](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-not-just-kids-sites) and the [FTC six-step plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business).

### P1 — Data-retention and deletion promises exceed the verified deletion path

**Evidence.** The policy/terms promise primary-database account deletion with only limited residual backups/logs/third parties (`src/routes/privacy/+page.svelte:200-206`; `src/routes/terms/+page.svelte:126-132`). The implemented hook deletes `UserProfile` and referrals after Better Auth deletes its user (`src/lib/auth/server.ts:64-74`). The audit found no corresponding cleanup for generated question content or prior GitHub issues, nor a stated retention schedule.

**Action.** Either implement a documented deletion map (auth records, Mongo profile/history, S3 objects, referral data, provider records and backups) or narrow the promise to what occurs today. Publish concrete retention periods or objective criteria for logs/backups/support reports; assign a request owner and response procedure. Verify Better Auth's deletion semantics and all Mongo/S3 associations with a test account before promising `all associated data` in Settings (`src/routes/(app)/app/settings/+page.svelte:256-259`).

### P1 — Analytics/session-replay disclosure needs a configuration check before launch

**Evidence.** Vercel Analytics/Speed Insights load for every browser (`src/hooks.client.ts:5-8`; `src/lib/client/vercel-analytics.ts:6-11`). PostHog initializes on page load in `cookieless_mode: 'on_reject'` and enables exception capture (`src/lib/client/posthog-analytics.ts:15-29`); detailed capture requires consent. The policy says PostHog session replay occurs on opt-in (`src/routes/privacy/+page.svelte:136-158`).

**Risk/action.** Verify the actual PostHog project settings: session replay enabled/disabled, text-input masking, URL/query-string capture, IP/geolocation settings, retention, and whether any error payload can contain user content. Verify the Vercel project configuration and destinations. Reflect the actual result in the policy and in the consent banner; do not call the service `privacy-first` without a completed configuration record. Keep anonymous operational events free of user content—the code intends that (`src/lib/server/posthog.ts:34-48`)—and test it.

### P2 — Terms need clearer contract mechanics and product-specific limitations

**Evidence.** The clickwrap appears below the signup card rather than as an affirmative checkbox (`src/lib/components/signup-form.svelte:177-182`). The Terms include general disclaimers but no clear monetary liability cap, California/venue choice, severability, assignment, or a defined effective version (`src/routes/terms/+page.svelte:116-150`). AI content is correctly described as fallible (`src/routes/terms/+page.svelte:83-90`), but no intellectual-property complaint/channel or explicit no-affiliation statement appears.

**Action.** For a free consumer service, use a required unchecked acceptance control that records policy/terms version and timestamp; make Google signup subject to the same assent. Have counsel provide governing-law/venue, liability-cap, indemnity, severability, and change-notice language tailored to the operator's location. Add an IP/takedown contact and a plain independent-service statement. These improve enforceability but do **not** solve the AP product/domain issue.

## Cross-check items before relaunch

1. Use a non-College-Board brand and domain; obtain counsel's decision on redirects/legacy name use.
2. Remove College Board copyrighted source material from the AI context and public pages unless permission is on file; retain provenance evidence for every educational asset.
3. Make bug reports private or warn clearly and minimize fields before submission.
4. Decide and implement the under-13 posture (13+ gate vs. COPPA program), then align signup, policy, providers, and support playbook.
5. Audit live PostHog/Vercel/OpenAI/GitHub/MongoDB/S3/Resend configurations, data locations, access, and retention; revise the policy only to verified facts.
6. Test one real account deletion and document exactly which records remain and for how long.

## Sources reviewed

- [College Board — Guidelines for Using College Board Trademarks](https://privacy.collegeboard.org/copyright-trademark/guidelines) (primary owner guidance; accessed 2026-07-13).
- [College Board — Copyright and Trademark Permission Request Instructions](https://privacy.collegeboard.org/copyright-trademark/request-instructions) (primary owner guidance; accessed 2026-07-13).
- [FTC — COPPA: Not Just for Kids' Sites](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-not-just-kids-sites) (primary regulator guidance; accessed 2026-07-13).
- [FTC — COPPA six-step compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business) (primary regulator guidance; accessed 2026-07-13).
