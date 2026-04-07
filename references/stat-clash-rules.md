# STAT CLASH — Tactical Card Battle Rules

A head-to-head combat game played with Topps-style trading cards. Fast rounds, meaningful choices, raw stats don't always win.

> Designed for the ⚔ format: **Power · Speed · Technique · Endurance**
> Works with any stat count — add Charisma as a 5th dimension if your cards have it.

---

## Quick Reference

| Phase | What happens |
|-------|-------------|
| **Deploy** | Both players pick a card, place face-down |
| **Declare** | Both players secretly pick a combat stat |
| **Reveal** | Cards and stat choices revealed simultaneously |
| **Resolve** | Interaction table + stat values determine the winner |
| **Score** | Winner earns points, loser takes damage |
| **Draw** | Both draw back up to hand size |

---

## Setup

- **Players:** 2
- **Deck:** Each player uses their own collection (or a shared deck, shuffled and split)
- **Hand size:** 5 cards
- **Draw pile:** Remaining cards, face-down
- **Score to win:** First player to **150 points** wins the match

Shuffle, deal 5 to each player. Remaining cards form the draw pile.

---

## The Four Phases

### 1. DEPLOY

Both players select **one card** from their hand and place it **face-down** on the table. You're committing to a card before you know what the opponent chose.

> 🧠 *Tactical layer: You're sizing up the matchup. Got a card with stacked speed? Great if you think the opponent will pick Technique. But if they go Power, you're gambling.*

### 2. DECLARE

While cards are face-down, each player **secretly chooses one stat** to fight with.

On your hand card or a token, write or indicate which stat you're using:
- ⚔ **Power** — raw force
- 💨 **Speed** — agility and reaction
- 🎯 **Technique** — skill and precision
- 🛡 **Endurance** — resilience and tankiness

You **do not** see the opponent's card or stat choice when making this decision.

### 3. REVEAL

Both players flip their cards and reveal their chosen stats simultaneously.

### 4. RESOLVE

**Step 1: Check the interaction.**

Not all stats are equal against each other. The interaction triangle determines who gets a **combat bonus** before raw numbers are compared:

```
        Power
       ╱    ╲
   beats    loses to
   ╱            ╲
Speed          Technique
  ╲    ╱       ╱    ╲
   loses    beats
        Endurance
```

| Attacker vs Defender | Bonus | Why |
|---------------------|-------|-----|
| **Power** vs **Endurance** | Power **+8** | Brute force breaks through tank |
| **Endurance** vs **Speed** | Endurance **+8** | You can't exhaust what you can't catch |
| **Speed** vs **Technique** | Speed **+8** | Raw reaction beats rehearsed moves |
| **Technique** vs **Power** | Technique **+8** | Precision targets weaknesses |
| **Same stat vs same stat** | No bonus | Pure stat comparison |
| **Other matchups** (Power vs Speed, etc.) | No bonus | Raw stat values only |

> The interaction is **symmetric** — the winner of the triangle matchup gets the bonus, regardless of who "attacked." If Power faces Technique, Technique gets +8.

**Step 2: Apply the bonus and compare.**

```
Final score = Base stat value + Interaction bonus (if any)
```

- **Higher final score wins the round.**
- **Tie:** Both players score 0, but each **draws 1 extra card** (the clash was so even it disrupted both players).

---

## Scoring

| Outcome | Scoring |
|---------|---------|
| **Win the round** | Earn points equal to your **final score** (base + bonus) |
| **Lose the round** | Lose points equal to the opponent's **final score** |
| **Tie** | No points exchanged, both draw +1 card |

**Minimum score is 0** — you can't go negative from a single round. Score can reach 0 but not below.

### Star Tier Bonuses

Card rarity adds automatic bonuses to the winner's score:

| Tier | Bonus if you win | Bonus if you lose (damage reduction) |
|------|------------------|--------------------------------------|
| Common | +0 | -0 |
| Uncommon | +3 | -2 from damage |
| Star | +6 | -4 from damage |
| Superstar | +10 | -6 from damage |
| Legendary | +15 | -10 from damage |

> A Legendary card losing still mitigates serious damage. A Legendary card *winning* with a good stat matchup is devastating.

---

## Parallel Modifiers

Parallel rarity (the foil/variant type) adds flat modifiers:

| Parallel | Modifier |
|----------|----------|
| Base | +0 |
| Chrome 💎 | +2 to all stats in resolution |
| Purple Shimmer 💜 | +3 |
| Blue Crackle 🔷 | +4 |
| Tie-Dye 🌈 | +5 |
| Gold ✨ | +7 |
| Black Ice ❄️ | +10 |
| Superfractor 🔥 | +15 |

These are applied **before** the interaction bonus. So a Black Ice card with Speed 65 vs a Base card with Technique 70:
- Speed becomes 65 + 10 = 75
- Technique stays 70
- Speed vs Technique → Speed gets +8 = **83**
- Technique stays 70
- Speed wins handily

> Parallels reward collecting and using your chase cards strategically. They can flip a losing matchup.

---

## Special Abilities

Each Star tier unlocks a one-time-per-round ability you may use **after the Reveal phase** (you've seen the opponent's card and stat):

### Uncommon — INSPECT 📋
After reveal, you may **change your declared stat** to any other stat on your card. One use per round, if you have an Uncommon card in play.

> *"Oh, you went Power? Let me switch to Technique."*

### Star — OVERLOAD ⚡
After reveal, you may **add your lowest stat** as a bonus to your declared stat. One use per round.

> If your stats are P:70, S:85, T:40, E:60 and you declared Speed (85), you add Technique (40) → Speed resolves at 125.

### Superstar — COUNTER 🔄
If you are **losing** after interaction bonuses are applied, you may **swap your card** with any card from your hand (not the draw pile). The opponent's declared stat remains — you get to pick a new stat with the swapped card. One use per match (not per round — save it).

### Legendary — DOMINATE 👑
After reveal, choose **two stats** instead of one. Resolve the matchup for each stat independently. If you win **either** stat matchup, you win the round using that stat's score. If you win **both**, your score is the **sum** of both wins. One use per match.

---

## Deck Building (Optional Advanced Rules)

For constructed play, build a 20-card deck from your collection:

- **Max 2 copies** of the same card number (different parallels OK)
- **Max 1 Legendary** per deck
- **Max 2 Superstar** per deck
- Deck must have at least 3 different Star tiers represented

This forces tradeoffs between raw power and special ability access.

---

## Game Flow Summary

```
Round 1, Round 2, Round 3 ... until someone hits 150

Each round:
  ┌─ DEPLOY ──── Pick a card, face down
  ├─ DECLARE ─── Pick a stat secretly
  ├─ REVEAL ──── Flip cards + stats
  ├─ ABILITY ─── Use tier ability (optional, after reveal)
  ├─ RESOLVE ─── Interaction bonus → compare → winner
  └─ SCORE ───── Update scores, draw to 5
```

---

## Example Round

**Player A** plays `BOC-039 The Node Pairer` (⭐ Star)
- Stats: ⚔80 💨60 🎯82 🛡78
- Declares: **Technique (82)**

**Player B** plays `BOC-067 The "Reply Faster" Guy` (🔶 Uncommon)
- Stats: ⚔50 💨74 🎯56 🛡52
- Declares: **Speed (74)**

**Resolve:**
- Speed vs Technique → **Speed gets +8** (speed beats technique)
- Player B: 74 + 8 = **82**
- Player A: 82 + 0 = **82**
- **TIE** — both draw +1 card, no points exchanged

> 🧠 *With hindsight: Player A should have declared Speed (60) or Power (80). Technique was the wrong call against Speed. Player B read it perfectly — the Speed matchup gave them +8 which clawed back from a 16-point deficit.*

---

## Two-Player Variant: BLITZ

Same rules, but:
- Hand size: **3 cards**
- Score to win: **50 points**
- No special abilities
- No parallel modifiers

For quick games when you just want raw stat gambling. A full match takes about 5 minutes.

---

## Solo Variant: THE GAUNTLET

Draw 5 cards. Face 5 "opponent" rounds where the enemy card and stat are randomly determined. Try to reach 80 points without losing more than 3 rounds.

If you lose a round, the opponent's card stays on the table — your next round's deploy must beat it in at least one stat or you take double damage.

---

## Tips

1. **Don't always pick your highest stat.** If the opponent expects Power, going Technique catches them off guard.
2. **Parallels are swing cards.** Save your high-parallel cards for when you need to flip a bad matchup.
3. **Star tier abilities win games.** A Superstar's Counter ability can salvage a losing round. A Legendary's Dominate can end a match.
4. **Track what stats your opponent favors.** After a few rounds you'll see a pattern. Exploit it.
5. **Endurance is underrated.** It doesn't have flashy interactions, but high Endurance + no bonus still beats low stats with bonuses.
6. **Card advantage matters.** Drawing extra cards from ties means more options. Don't be afraid of ties — they build your hand.
