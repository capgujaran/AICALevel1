# Validation record

Validation performed locally on 10 October 2026 using Node 22.23.3.

- Native Node test suite covers the five seeded exceptions, clean population, aggregate exact-cent tolerance, receipt acceptance, missing references, unpaid supplier mismatch, currency and amount validation, CSV roundtrip/provenance, run cancellation, dynamic specialist planning, human-review/export gates, HTML escaping, CSV formula protection, minimal AI payloads, response gates, mocked gateway origin/authentication and static-build contents.
- Local HTTP checks returned 200 for index, CSS, JavaScript modules and the SVG mark; README and gateway paths returned 404.
- Browser rendering was visually inspected at the browser's existing desktop size. The demo audit completed and displayed 5 findings, 30 invoice records, AED 48,000 invoice value and AED 8,850 distinct affected invoice value. The exception view displayed the two linked invoice records and review form.
- Browser automation became unavailable during form entry. End-to-end browser decision submission, browser file download/upload and mobile breakpoint checks remain unverified. The underlying decision/export/import functions are covered by the Node suite.
- Optional provider integration was tested with a mocked structured-output response. No live model request was made.
- GitHub Pages workflow is a manual template, not installed or deployed. The build copies only the static site; imported evidence is never automatically copied into deployment files.

Run `npm test` to repeat the suite and rebuild the static artifact as part of its deployment-boundary check. Run `npm run serve` for the browser walkthrough. Organization records were not used in validation.

Compass chatbot extension: the expanded suite covers BM25 retrieval, follow-up context, current-run authority over sample expectations, result opt-in, selected-finding retrieval, canonical source aliases, request bounds, citation/numeric checks, list-number handling, configured Compass models, hosted authentication/origins, mocked Core42 responses and provider failure without fallback. Live checks used the existing server-side Compass credential with synthetic data and tool-guide excerpts only. Both tool-guide and current-run questions returned HTTP 200 with source-cited answers using the configured `gpt-5.1` model. Earlier malformed/unverifiable responses were withheld; list numbering was subsequently separated from numeric claims. No provider credential or organization extract was printed or published. Public chat generation remains pending separate gateway hosting and connection.
