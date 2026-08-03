# Contributing

ForgeFlow welcomes focused changes that improve asset safety, pipeline reliability, preview
quality, or operational clarity.

1. Create a branch from `main`.
2. Copy `.env.example` to `.env` and start dependencies.
3. Add tests for state transitions, parsers, and API behavior.
4. Run `npm run check` before opening a pull request.
5. Document schema, security, or processor-contract changes.

Database changes are forward-only migrations. Processor output must remain reproducible for a
given source hash and processor version.
