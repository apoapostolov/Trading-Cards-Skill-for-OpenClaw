#!/usr/bin/env node
'use strict';

/**
 * Trading Cards - Commander-based CLI Entry Point
 * 
 * This module provides a modern command-line interface using Commander.js
 * while delegating to the existing command implementations in card-engine.js
 */

const { Command } = require('commander');
const path = require('path');
const { execFileSync } = require('child_process');

const program = new Command();

program
  .name('card-engine')
  .description('Trading Cards - Pack opening, collection management, and market simulation')
  .version('2.0.0');

// Helper to delegate to legacy card-engine.js
function runLegacy(args) {
  const scriptPath = path.join(__dirname, 'card-engine.js');
  try {
    execFileSync(process.execPath, [scriptPath, ...args], {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (err) {
    process.exit(err.status || 1);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CORE COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

program
  .command('generate-set')
  .alias('gen-set')
  .description('Generate a new card set procedurally')
  .option('-c, --category <type>', 'Category (character, sports, movie)', 'character')
  .option('-s, --sport <sport>', 'Sport type (for sports category)')
  .option('-n, --cards <number>', 'Number of cards', '50')
  .option('-t, --theme <theme>', 'Theme for the set')
  .option('--seed <seed>', 'Random seed for reproducibility')
  .action((options) => {
    const args = ['generate-set'];
    if (options.category) args.push('--category', options.category);
    if (options.sport) args.push('--sport', options.sport);
    if (options.cards) args.push('--cards', options.cards);
    if (options.theme) args.push('--theme', options.theme);
    if (options.seed) args.push('--seed', options.seed);
    runLegacy(args);
  });

program
  .command('generate-set-ai')
  .alias('gen-ai')
  .description('Generate a new card set using AI (requires OPENROUTER_API_KEY)')
  .option('-c, --category <type>', 'Category', 'character')
  .option('-s, --sport <sport>', 'Sport type')
  .option('-m, --model <model>', 'AI model to use')
  .option('-t, --theme <theme>', 'Theme')
  .option('-n, --cards <number>', 'Number of cards', '50')
  .option('--set-code <code>', 'Custom set code')
  .action((options) => {
    const args = ['generate-set-ai'];
    if (options.category) args.push('--category', options.category);
    if (options.sport) args.push('--sport', options.sport);
    if (options.model) args.push('--model', options.model);
    if (options.theme) args.push('--theme', options.theme);
    if (options.cards) args.push('--cards', options.cards);
    if (options.setCode) args.push('--set-code', options.setCode);
    runLegacy(args);
  });

program
  .command('open-pack <type>')
  .description('Open a card pack')
  .option('--real', 'Commit to collection (spend wallet, save cards)')
  .action((type, options) => {
    const args = ['open-pack', type];
    if (options.real) args.push('--real');
    runLegacy(args);
  });

program
  .command('open-box <type>')
  .description('Open a full box of packs')
  .option('--real', 'Commit to collection')
  .action((type, options) => {
    const args = ['open-box', type];
    if (options.real) args.push('--real');
    runLegacy(args);
  });

// ═════════════════════════════════════════════════════════════════════════════
// COLLECTION COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

program
  .command('portfolio')
  .description('Show collection portfolio overview')
  .action(() => runLegacy(['portfolio']));

program
  .command('compare')
  .description('Compare wallets and collections across all players')
  .action(() => runLegacy(['compare']));

program
  .command('collection [set]')
  .description('View collection for a set')
  .action((set) => {
    const args = ['collection'];
    if (set) args.push(set);
    runLegacy(args);
  });

program
  .command('wallet')
  .description('Show wallet balance')
  .action(() => runLegacy(['wallet']));

program
  .command('add-money [amount]')
  .description('Add money to wallet')
  .action((amount) => {
    const args = ['add-money'];
    if (amount) args.push(amount);
    runLegacy(args);
  });

program
  .command('duplicates')
  .alias('dups')
  .description('Show duplicate cards summary')
  .action(() => runLegacy(['duplicates']));

program
  .command('top-cards')
  .description('Show most valuable cards')
  .option('--grade', 'Sort by grade')
  .action((options) => {
    const args = ['top-cards'];
    if (options.grade) args.push('--grade');
    runLegacy(args);
  });

program
  .command('wishlist <action> [cardNum]')
  .description('Manage wishlist (add, remove, list)')
  .action((action, cardNum) => {
    const args = ['wishlist', action];
    if (cardNum) args.push(cardNum);
    runLegacy(args);
  });

// ═════════════════════════════════════════════════════════════════════════════
// MARKET COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

program
  .command('market [cardNum]')
  .description('View market dashboard or specific card')
  .action((cardNum) => {
    const args = ['market'];
    if (cardNum) args.push(cardNum);
    runLegacy(args);
  });

program
  .command('flag [filter]')
  .description('Market flag view (owned, movers, gainers, losers, or card number)')
  .action((filter) => {
    const args = ['flag'];
    if (filter) args.push(filter);
    runLegacy(args);
  });

program
  .command('revalue')
  .description('Recalculate collection values from market prices')
  .action(() => runLegacy(['revalue']));

// ═════════════════════════════════════════════════════════════════════════════
// FLOPPS COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

program
  .command('flopps-status')
  .description('Show Flopps company status and stock price')
  .action(() => runLegacy(['flopps-status']));

program
  .command('flopps-today')
  .description('Show Flopps actions for today')
  .action(() => runLegacy(['flopps-today']));

program
  .command('flopps-day <day>')
  .description('Show Flopps actions for a specific day')
  .action((day) => runLegacy(['flopps-day', day]));

program
  .command('flopps-wildcard')
  .description('Generate a surprise Flopps event')
  .action(() => runLegacy(['flopps-wildcard']));

// ═════════════════════════════════════════════════════════════════════════════
// STORE COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

program
  .command('store <action> [args...]')
  .description('Store commands: list, visit <id>, buy <id> <product>, stock <id>, pressure <id>, restock <id>, trade <id> <card> <product>, reputation')
  .action((action, args) => {
    runLegacy(['store', action, ...(args || [])]);
  });

// ═════════════════════════════════════════════════════════════════════════════
// GRADING COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

program
  .command('grade-card <cardNum>')
  .description('Submit card for grading')
  .action((cardNum) => runLegacy(['grade-card', cardNum]));

program
  .command('grade <subcommand> [args...]')
  .description('Grading commands: submit, status, history, pop, cost, crack, stats')
  .action((subcommand, args) => {
    runLegacy(['grade', subcommand, ...(args || [])]);
  });

// ══════════════════════════════════════════════════════════════════════════════
// UTILITY COMMANDS
// ═════════════════════════════════════════════════════════════════════════════

program
  .command('checklist [set]')
  .description('View set checklist')
  .action((set) => {
    const args = ['checklist'];
    if (set) args.push(set);
    runLegacy(args);
  });

program
  .command('set-info')
  .description('Show active set information')
  .action(() => runLegacy(['set-info']));

program
  .command('list-sets')
  .description('List all available sets')
  .action(() => runLegacy(['list-sets']));

program
  .command('sell [cardNum]')
  .description('Sell a card: <card-num>, dups, pack-dups [--best] [--pack]')
  .option('--best', 'Sell best copy instead of cheapest')
  .action((cardNum, options) => {
    const args = ['sell'];
    if (cardNum) args.push(cardNum);
    if (options.best) args.push('--best');
    runLegacy(args);
  });

program
  .command('history')
  .description('View transaction history')
  .option('--all', 'Show all history')
  .option('--count <n>', 'Show last N entries')
  .action((options) => {
    const args = ['history'];
    if (options.all) args.push('--all');
    if (options.count) args.push('--count', options.count);
    runLegacy(args);
  });

program
  .command('undo [n]')
  .description('Undo last N operations')
  .action((n) => {
    const args = ['undo'];
    if (n) args.push(n);
    runLegacy(args);
  });

program
  .command('pack-stats')
  .description('Show pack opening statistics')
  .action(() => runLegacy(['pack-stats']));

program
  .command('new-season')
  .description('Archive current set and start new season')
  .option('--confirm', 'Confirm the operation')
  .action((options) => {
    const args = ['new-season'];
    if (options.confirm) args.push('--confirm');
    runLegacy(args);
  });

program
  .command('reset-collection')
  .description('Reset collection for active set')
  .option('--confirm', 'Confirm the operation')
  .action((options) => {
    const args = ['reset-collection'];
    if (options.confirm) args.push('--confirm');
    runLegacy(args);
  });

// Parse and execute
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
