# Trading Cards Skill for OpenClaw

Public mirror of the OpenClaw `trading-cards` skill. This repo bundles the
runtime scripts, reference material, and data files used by the skill so it can
be installed, inspected, and updated as a self-contained package.

## Capabilities

This skill supports the full lifecycle of a virtual trading-card simulation:

- Generate procedural card sets with configurable categories, themes, and size
- Generate AI-assisted sets through OpenRouter
- Model sports, celebrity, movie, TV, collection, novelty, and custom sets
- Produce modular image prompts for front, back, or dual-sided card art
- Open retail, blaster, hobby, and jumbo packs and boxes
- Track collection state, wallet balance, portfolio value, duplicates, and hits
- Simulate the secondary market, grading economy, and card-condition effects
- Run the Flopps parody layer for corporate announcements and market events
- Summarize Flopps status by day, today, or wildcard event
- Build launch copy, bulletin text, and set metadata for new releases
- Export prompt payloads and set data for downstream automation

The underlying skill is intentionally simulation-heavy. It is designed to create
repeatable, stateful hobby workflows rather than one-off creative prompts.

## Repository Layout

- `SKILL.md` - OpenClaw skill definition and operating instructions
- `scripts/` - runtime commands used by the skill
- `references/` - design and behavior references for the simulation
- `data/` - seed data and state snapshots used by the simulation
- `CHANGELOG.md` - release history for public changes
- `LICENSE.md` - MIT license

## OpenClaw Install

Install without prompts from a known skill slug:

```bash
openclaw skills install trading-cards
openclaw skills list
```

Install from a local checkout:

```bash
cd /path/to/Trading-Cards-Skill-for-OpenClaw
openclaw skills install .
openclaw skills list
```

OpenClaw loads workspace skills on the next session. If you want the skill
available immediately, start a new OpenClaw session or restart the gateway.

## Public Status

This repository is a public mirror for the skill content. It is not an official
OpenClaw project and does not imply endorsement by OpenClaw maintainers.

## License

MIT. See [LICENSE.md](LICENSE.md).
