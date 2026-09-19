# CodeCity

Walk inside your codebase.

CodeCity turns JavaScript and TypeScript repositories into an interactive architectural model backed by deterministic static analysis.

## Phase 1: Graph Foundation

The current implementation includes a versioned `ProjectGraph`, deterministic IDs, safe JS/TS source discovery, Oxc syntax analysis, ts-morph semantic enrichment with graceful degradation, deterministic engineering findings, and a local analyzer CLI.

```bash
pnpm analyzer analyze ./fixtures/simple-ts \
  --owner codecity \
  --repo simple-ts \
  --commit fixture \
  --output /tmp/simple-ts.project-graph.json
```

The analyzer treats repositories as untrusted data and never executes repository code or package scripts.
