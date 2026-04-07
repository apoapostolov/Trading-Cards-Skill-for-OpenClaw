# Flopps Layer — Corporate Parody, Launch Cycle, and World Sim

Flopps is the in-world trading-card company used when the skill shifts from simple pack-opening into corporate parody and world simulation.

For business mechanics and the executive cast, also read `references/flopps-business-research.md`.

The point of the layer is not realism for its own sake. It is to make the card world feel like a living market machine:
- a company that speaks to collectors through polished fake communications
- a release cadence that never lets the audience rest
- a secondary market that reacts to hype, scarcity, and social pressure
- a consumer base that is always one teaser away from panic buying
- command outputs that can surface the latest Flopps bulletin, so the player hears the news even when they were asking for something else

Keep the voice satirical, corporate, and self-serious. The company should sound enthusiastic about scarcity while pretending that nothing unusual is happening.

## When to Use This Layer

Use Flopps when the user asks for:
- a fake corporate blog post
- a release note, patch note, or development note written in brand voice
- a set announcement, teaser article, or launch-day summary
- a day-specific or today-specific Flopps summary (`flopps-day <day|today>`, `flopps-today`, or `flopps-status`)
- a cynical but polished parody article about the next or current set
- a company simulation where Flopps manages print runs, demand, and collector obsession
- a world-building pass for a trading-card company exploiting its own serf-like consumer base

## Voice Rules

- Write like a corporate blog that is trying to sound transparent while still steering behavior.
- Keep the comedy dry and the marketing language just a little too eager.
- Avoid real-company naming unless the user explicitly wants a comparison.
- Treat hype, scarcity, and collector behavior as the central narrative engine.
- Make each article feel like it was written by a brand team that knows exactly how addicted the audience is and is smiling politely about it.

## Architecture

Flopps is not primarily a writing gimmick. It is a simulation pipeline.

The order of operations should be:

1. **Simulation state** — generate the underlying company reality:
   - release calendar
   - current phase
   - hype / scarcity / extraction pressure
   - stock price
   - executive focus
   - latest bulletin
   - trend-desk decisions
   - retailer / labor / collector stress
2. **Structured metadata** — package that state into a compact promptable object:
   - current release facts
   - market pressures
   - recent corporate actions
   - relevant product summary
   - next-drop context
3. **AI writing layer** — feed the structured metadata to OpenRouter/Kimi so it can translate the state into:
   - press releases
   - fake blog posts
   - dev notes
   - investor updates
   - wildcard announcements
4. **Command output layer** — surface the result back through:
   - Flopps commands
   - market overlays
   - flag outputs
   - normal gameplay commands that hear about the news cycle indirectly

The simulation state is the source of truth. The article is an interpretation of the state, not the thing that invents the state.

## Flopps Executive Cast

Use the same cast consistently so the company feels like a real institution.

### Public Leadership

- **CEO: Adrian Vale** — immaculate suit, perfect media smile, always speaks in "community" language while steering every sentence toward demand.
- **CFO: Lillian Mercer** — calm, surgical, allergic to waste, treats scarcity like a line item and collector enthusiasm like a forecast.
- **President of Product: Grant Bell** — the face of new set cadence, allergic to pauses, speaks in launch windows and roadmap logic.
- **Chief Marketing Officer: Elena Cross** — turns hype into an operational discipline, can make a shortage sound like a benefit.
- **VP of Allocation: Marcus Reed** — manages who gets product, when, and how much, and never uses the word rationing.
- **Head of Community: Noelle Park** — public-facing, charming, and always one sentence away from a teaser.
- **Chief People Officer: Dana Sloane** — announces layoffs as "organizational focus" and sounds sorry in the same polished tone used for launch trailers.
- **Head of Government Affairs: Reed Harlan** — handles lobbying, trade-group optics, and "collector choice" language with a hand on the wallet and a smile for the camera.
- **Investor Relations: Mira North** — explains the stock chart as if it were weather, then quietly attributes every move to demand discipline.

### Private Operating Doctrine

- The executives never admit the company depends on compulsive buying.
- They describe scarcity as "curation," price spikes as "market validation," and sell-outs as "healthy demand."
- They frame every release as collector service while quietly optimizing for churn, FOMO, and sealed-product velocity.
- They frame layoffs as operational efficiency, price hikes as premium alignment, and reduced odds as an elevated collector experience.
- In any article, let at least one executive leak a small truth through overly polished language.

## Output Modes

### 1. Corporate Blog Post

Use this for public-facing Flopps content.

Include:
- a headline that sounds official but slightly inflated
- a short opening summary
- 3-6 feature bullets
- a section on what the update means for collectors
- a teaser for the next product or set
- a closing line that sounds friendly and manipulative at the same time

### 2. Release Notes / Development Notes

Use this when the user wants "what changed" content.

Include:
- version or set identifier
- changes to product structure, parallels, inserts, or chase behavior
- a note about availability, timing, or market pressure
- a short internal-style explanation that still reads like marketing

### 3. Set Launch Article

Use this when the user asks for a full set build or launch announcement.

Include:
- the management brief translated into a product concept
- the set identity and why it exists
- the chase ladder and why collectors will care
- the expected secondary-market narrative
- a breadcrumb for the next set so the launch never feels finished

### 4. World Simulation Brief

Use this when the user wants the company itself simulated.

Track:
- print runs and release cadence
- collector obsession and social pressure
- warehouse, distributor, and store behavior
- reseller and scalper response
- blog sentiment and public messaging
- market heat versus consumer fatigue
- the executive cast and which department is driving the current push
- the fake FLPS stock price and how it reacts to proxy companies, hype, and scandal
- corporate stress surfaces: collector stress, retailer stress, labor stress, allocation tightness, and release-phase pressure

The sim should feel like the company is always balancing supply against desire while publicly pretending to be surprised by the demand.

## Default Build Sequence

When asked for a Flopps set, follow this sequence:

1. Read the management brief and identify the emotional hook.
2. Define the set identity in one sentence.
3. Establish the chase structure: parallels, inserts, hit cards, and weird novelty cards.
4. Write the fake Flopps blog post or release note.
5. Add a short "what this means for collectors" section.
6. Add a breadcrumb for the next set or next corporate update.
7. If the request is broad, extend the result into the company sim layer.

## Multi-Pass Build Roadmap

### Pass 1: Brand Foundations

- Lock the Flopps name, tone, and public voice.
- Define the corporate blog format and the standard article skeleton.
- Make the difference between "company copy" and "collector copy" explicit.
- Establish the default model preference for this layer when AI copy is required.

### Pass 2: Product Identity

- Convert the management brief into set pillars.
- Define what makes the set feel distinct from prior releases.
- Build the chase map, rarity spectrum, and novelty angle.
- Make sure the set can be explained in one sentence and expanded into a launch article.

### Pass 3: Market Behavior

- Add the pressure loop between release cadence, consumer obsession, and secondary-market movement.
- Explain how scarcity, hype, and perceived prestige drive prices.
- Model the "everyone wants one more box" effect as a narrative force.
- Make the company messaging respond to the market rather than ignoring it.
- Tie each business decision to a named executive so the fiction feels staffed instead of abstract.

### Pass 4: Simulation Surface

- Introduce internal operational language for factories, warehouses, allocations, and restocks.
- Add consumer-facing lines that sound reassuring while actually amplifying demand.
- Let the company publish fake dev notes, patch notes, and community updates.
- Make each article capable of standing alone or linking into a bigger story arc.
- Add public-company pressure: investor calls, valuation defenses, layoffs, margin language, and share-price anxiety.
- Let market and flag commands echo the latest Flopps bulletin so the secondary-market view feels like it lives inside the same news cycle.
- Keep a large event library so exceptional announcements can range from sober investor-language cruelty to deadpan corporate absurdity without breaking realism.

### Pass 5: Persistent World

- Keep a launch history so the company has memory.
- Let old announcements influence future set copy.
- Track recurring in-world characters, departments, or product lines.
- Lock the Flopps layer as a master simulation first: it should generate state, pressures, events, and metadata; AI writing should sit on top of that simulation to translate state into press releases, blog posts, dev notes, and investor-safe messaging.
- Keep a stock-price history so Flopps can narrate itself as a public company.

## Practical Prompt Pattern

When you need Flopps output, use a prompt structure like this:

- `Role`: Flopps corporate blog editor
- `Brief`: current set concept or management directive
- `Format`: announcement / release notes / dev notes / market update / full launch article
- `Tone`: polished, self-serious, mildly comedic, marketing-cynical
- `Extra`: call out hype, scarcity, and collector obsession

That pattern keeps the writing consistent even when the content changes from launch article to fake internal notes.
