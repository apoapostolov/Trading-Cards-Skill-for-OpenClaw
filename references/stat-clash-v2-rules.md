# STAT CLASH v2 — Tactical Card Battle Rules

A deeper head-to-head card game for Topps-style trading cards.

## Design goals

- More replayability than a pure stat duel
- Meaningful decisions every turn
- Comeback potential without rubber-banding too hard
- Multiple viable deck styles: rush, control, tempo, combo, grind
- Familiar enough to feel fast, but tactical enough to stay interesting

---

## Core idea

Each card still has stats, but the match is no longer decided by a single hidden stat reveal.

Instead, players manage:

- **Hand pressure**: when to spend good cards vs hold them
- **Momentum**: a shared tempo resource that changes turn order and power
- **Status effects**: tags that persist across rounds
- **Action cards**: disruption, defense, draw, swap, lock, and wild effects
- **Lane choice**: each round happens on one of three lanes, which matters for bonuses and counters

Think of it as a mix of stat combat, hand management, and tactical denial.

---

## What you need

- 2 players
- 1 deck each, 30 cards recommended
- 5-card opening hand
- 3 lanes on the table:
  - **Power Lane**
  - **Speed Lane**
  - **Technique Lane**
- A momentum tracker from **-3 to +3**
- A round tracker

---

## Card types

### 1. Character cards
These are the main fighters.

Each character has:
- Power
- Speed
- Technique
- Endurance

Character cards do **not** get optional special traits. Their identity comes from stats, lane fit, and the parallel printed on the card.

### 2. Action cards
These create the replayability.

In this version, action effects are tied to **parallel rarity** instead of being separate card traits.

- Common and low parallels are mostly stat cards
- Rare parallels unlock action effects
- Serialized parallels get stronger action effects
- Ultra-low numbers and 1/1s get the strongest effects

Examples:
- **Skip** — cancel the opponent’s next action
- **Reverse** — swap lane order / initiative order for the round
- **Draw 2** — opponent draws 2 cards
- **Wild** — choose any lane and gain a small bonus
- **Shield** — block the next negative effect
- **Swap** — trade a card from hand with one from your discard
- **Lock** — opponent cannot change lane next round
- **Boost** — temporarily raise one stat
- **Break** — remove a shield or status

### Parallel action effects

Parallel rarity determines whether the card has a usable action effect and how strong it is.

| Parallel tier | Action access | Typical action strength |
|---|---|---|
| Base | None | Pure stat card |
| Chrome | None | Cosmetic only |
| Purple Shimmer | Minor | Small utility effect |
| Blue Crackle | Minor | Low-impact tempo or draw |
| Tie-Dye | Standard | Solid tactical effect |
| Pink Neon | Standard | Better tempo or disruption |
| Gold /2026 | Strong | Reliable strong action |
| Green Lava /499 | Strong | Strong tactical swing |
| Cyan Ice /299 | Strong | Strong tactical swing |
| Magenta Pulse /199 | Strong | High-impact action |
| Orange Blaze /99 | Very strong | Major tempo swing |
| Teal Surge /75 | Very strong | Major disruption or combo setup |
| Red Magma /50 | Elite | Match-warping effect |
| Black Shattered /25 | Elite | Match-warping effect with better timing |
| White Rainbow /10 | Premium | Huge swing, usually once per match |
| 1/1 Superfractor | Legendary | Game-defining action |
| 1/1 Black Infinite | Legendary | Game-defining action with denial or recursion |
| 1/1 Printing Plate | Legendary | Unique build-around action |

General rule: the scarcer the parallel, the more flexible, efficient, or disruptive the action.

Examples of scaling:
- A **Gold** parallel might let you **draw 1 and gain +1 momentum**.
- A **/50** parallel might let you **draw 2, lock a lane, or copy a small effect**.
- A **/10** or **1/1** parallel might let you **skip, reverse, or outright rewrite a lane state**.

### 3. Reaction cards
Played only in response.

Examples:
- **Counter** — negate a targeting action
- **Dodge** — avoid lane penalties
- **Burst** — win initiative if you were slower
- **Recycle** — return a used action to hand

---

## Setup

1. Shuffle decks.
2. Draw 5 cards each.
3. Put the round tracker on 1.
4. Set momentum to 0.
5. Reveal the starting lane order:
   - Power
   - Speed
   - Technique

---

## Winning

You win by either:

- scoring **10 victory points**, or
- reducing the opponent to **0 endurance tokens**, if using the endurance variant

Recommended default: **10 victory points**.

---

## Round structure

Every round has 5 steps.

### 1. Initiative

Both players secretly choose one card from hand to commit.

Higher **Speed** usually wins initiative, but:
- momentum shifts can override it
- certain action cards can reverse turn order
- some rare parallel effects can grant initiative bonuses in specific lanes

### 2. Lane selection

Each player chooses one of the 3 lanes.

Lane matters because each lane rewards different play styles:
- **Power Lane**: raw stat boosts, damage spikes, break effects
- **Speed Lane**: initiative control, dodge, extra draw, tempo gains
- **Technique Lane**: counters, combo chains, card manipulation

If both players pick the same lane, the clash is more direct and more volatile.
If they pick different lanes, a split resolution happens:
- each player resolves their own lane effect
- the higher initiative player may steal tempo or force a discard

### 3. Commit action

Each player may play:
- 1 character card
- 1 action card
- 1 reaction card, if triggered

### 4. Resolve combat

Combat is resolved in this order:

1. Apply lane bonus
2. Apply momentum bonus
3. Apply status effects
4. Apply action card effects
5. Compare final combat score

### 5. Cleanup

- Discard used cards
- Draw back to 5
- Adjust momentum
- Advance round tracker

---

## Lane bonuses

Each lane gives a built-in bonus to make placement meaningful.

| Lane | Bonus |
|---|---|
| Power | +4 to Power, +1 to Endurance |
| Speed | +4 to Speed, +1 initiative |
| Technique | +4 to Technique, +1 to action effects |

If you play a matching stat in the matching lane, you get the full bonus.
If you play a mismatched stat, you get only half.

This means cards can be flexed, but not perfectly.

---

## Momentum

Momentum is the heart of the tactical layer.

- Winning a round by **3 or less** gives **+1 momentum**
- Winning by **4 to 7** gives **+2 momentum**
- Winning by **8+** gives **+3 momentum**
- Losing a round reduces momentum by **1**

Momentum range: **-3 to +3**

Effects:
- **+3**: draw 1 extra card at end of turn
- **+2**: +2 to initiative
- **+1**: +1 to all stat comparisons
- **0**: no modifier
- **-1**: -1 to initiative
- **-2**: opponent may peek at one card in your hand
- **-3**: you must discard 1 card before drawing

This creates comeback pressure and makes close wins matter.

---

## Status effects

Status effects remain on the board until cleared.

### Common statuses

- **Stunned**: cannot play an action card next round
- **Shielded**: first damage or discard effect is ignored
- **Marked**: opponent gets +2 against this card
- **Overclocked**: +3 to one chosen stat, then discard 1 extra card after use
- **Exhausted**: -2 to all stats next round
- **Locked**: cannot change lane next round

Statuses create memory and planning across turns, which is where replayability really starts to wake up.

---

## Action card timing

Action cards are what make the game feel like a game and not just a spreadsheet argument.

### During your turn
You may play one action card before combat.

### During opponent’s turn
You may play a reaction card if it matches the trigger.

### Timing priority
1. Reactions
2. Defensive actions
3. Offensive actions
4. Passive effects

This timing structure keeps bluffing relevant.


> There are no separate character traits in v2. If a card has a special effect, it comes from the parallel treatment printed on that card.

### Parallel action identity

Parallel effects can still be themed to feel like traits, but they are mechanically sourced from rarity.

Examples:
- **Speed-forward parallels**: initiative boosts, lane swaps, dodge effects
- **Power-forward parallels**: damage spikes, lane break effects, guard break
- **Technique-forward parallels**: copy, negate, recycle, and reorder effects
- **Endurance-forward parallels**: shields, sustain, redraw, and discard resistance

---

## Deck archetypes

The game should support multiple builds.

### Rush
- Low-cost cards
- Fast lane dominance
- High tempo
- Weak to control

### Control
- Locks, skips, shields, disruption
- Slower but punishes greedy play
- Wins by denying options

### Combo
- Chains actions and reaction windows
- Needs setup but can explode
- Best when your deck has self-draw and recursion

### Grind
- Uses endurance and resource denial
- Wins by draining the opponent’s hand
- Good in long matches

### Wildcard
- Flexible lane switching and stat adaptation
- Hardest to predict

---

## UNO-like replayability hooks

These are the parts that keep games from feeling solved:

- **Lane rotation** each round changes the value of the same cards
- **Momentum swings** create comeback and snowball pressure
- **Action chaining** means hand order matters
- **Reaction windows** reward prediction
- **Discard pressure** makes low-resource states dangerous
- **Stackable effects** let players build around synergies
- **Hidden hand information** adds bluffing

If you want the game to stay fresh, this is the minimum viable chaos.

---

## Easy mode, advanced mode

### Easy mode
- 2 lanes only
- no reaction cards
- no statuses
- win at 7 points

### Advanced mode
- all 3 lanes
- statuses
- full reaction timing
- drafting between rounds
- win at 10 points

---

## Why this is better than the current ruleset

The current ruleset is mostly:
- choose a card
- choose a stat
- compare numbers
- apply rarity bonuses

That is fun for a little while, but it doesn’t produce many distinct game states.

This v2 adds:
- persistent board state
- action denial
- initiative control
- lane-based planning
- resource tension
- stronger comeback lines
- more archetype variety
- rarity-scaled action identity via parallels instead of fixed traits

That is where replayability lives.

---

## Recommended next step

If this becomes the real ruleset, the best implementation order is:

1. Add lane mechanics
2. Add momentum
3. Add action cards
4. Add reaction windows
5. Add statuses
6. Add deck archetypes
7. Tune balance after playtests

