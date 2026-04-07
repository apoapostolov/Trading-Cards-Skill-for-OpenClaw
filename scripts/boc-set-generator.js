#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const DATA_DIR = path.join(__dirname, '..', 'data');

const CARDS = [
  // ── LEGENDARY (7) ──────────────────────────────────────────
  { n: "The Prompt Spammer", sub: "Legend", tier: "Legendary", s: { power:97,speed:45,technique:88,endurance:99,charisma:92 }, bp:4.85, d: "Sent 847 prompts in one session. The context window wept." },
  { n: "Apex Config Tweaker", sub: "Legend", tier: "Legendary", s: { power:95,speed:60,technique:98,endurance:88,charisma:85 }, bp:4.72, d: "Changed 43 config values in a single weekend. Nothing worked afterward." },
  { n: "The Cron Lord", sub: "Legend", tier: "Legendary", s: { power:92,speed:35,technique:96,endurance:95,charisma:78 }, bp:5.00, d: "So many cron jobs running that the machine begged for mercy at 3 AM." },
  { n: "King of the 3AM Sessions", sub: "Legend", tier: "Legendary", s: { power:88,speed:55,technique:90,endurance:97,charisma:96 }, bp:4.50, d: "Every meaningful conversation happens between midnight and 4 AM." },
  { n: "The Subagent Whisperer", sub: "Legend", tier: "Legendary", s: { power:94,speed:80,technique:97,endurance:90,charisma:82 }, bp:4.90, d: "Spawned 12 parallel agents and somehow steered all of them to completion." },
  { n: "The Memory Hoarder", sub: "Legend", tier: "Legendary", s: { power:86,speed:40,technique:93,endurance:96,charisma:88 }, bp:4.35, d: "Has 47 daily memory files and can quote conversations from 8 months ago." },
  { n: "The Slash Command Surfer", sub: "Legend", tier: "Legendary", s: { power:91,speed:92,technique:85,endurance:80,charisma:90 }, bp:4.60, d: "Types /status, /reasoning, /model, /clear every 30 seconds like it's a slot machine." },

  // ── SUPERSTAR (14) ─────────────────────────────────────────
  { n: "\"Just One More Thing\"", sub: "Base", tier: "Superstar", s: { power:88,speed:70,technique:82,endurance:85,charisma:93 }, bp:2.85, d: "Said 'just one more thing' 23 times. It was never just one more thing." },
  { n: "The Token Anxiety Guy", sub: "Base", tier: "Superstar", s: { power:80,speed:65,technique:78,endurance:82,charisma:95 }, bp:2.40, d: "Checks token usage after every single message. Still has no idea what a token is." },
  { n: "Agent Multi-Installer", sub: "Base", tier: "Superstar", s: { power:90,speed:75,technique:88,endurance:78,charisma:70 }, bp:2.95, d: "Runs OpenClaw on four machines simultaneously. Three of them are VMs inside WSL." },
  { n: "The Context Window Maximizer", sub: "Base", tier: "Superstar", s: { power:85,speed:50,technique:92,endurance:95,charisma:75 }, bp:2.60, d: "Uploads entire codebases and asks 'can you review this?' with 200K tokens." },
  { n: "The Heartbeat Ignorer", sub: "Flashback", tier: "Superstar", s: { power:78,speed:88,technique:80,endurance:72,charisma:85 }, bp:2.75, d: "HEARTBEAT_OK every single time. For six months straight." },
  { n: "The Experimental Model Swapper", sub: "Base", tier: "Superstar", s: { power:82,speed:85,technique:90,endurance:70,charisma:80 }, bp:2.90, d: "Switches between 14 models daily looking for 'the vibe.' Still using the cheapest one." },
  { n: "The GitHub Copilot Dropout", sub: "Flashback", tier: "Superstar", s: { power:84,speed:78,technique:86,endurance:80,charisma:88 }, bp:2.50, d: "Left Copilot for OpenClaw. Hasn't looked back. Won't shut up about it either." },
  { n: "Browser Automation Maniac", sub: "Base", tier: "Superstar", s: { power:92,speed:82,technique:91,endurance:76,charisma:72 }, bp:2.80, d: "Made the AI book a restaurant, buy shoes, and file taxes. All through browser control." },
  { n: "The Skill Creator", sub: "AllStar", tier: "Superstar", s: { power:87,speed:68,technique:95,endurance:84,charisma:82 }, bp:2.95, d: "Writes skills for OpenClaw. Then writes skills to manage the skills. Meta inception." },
  { n: "\"Have You Tried Restarting?\"", sub: "Legend", tier: "Superstar", s: { power:75,speed:90,technique:72,endurance:65,charisma:98 }, bp:2.35, d: "Every problem's solution is a gateway restart. Shockingly, it works 80% of the time." },
  { n: "The MCP Server Collector", sub: "Base", tier: "Superstar", s: { power:88,speed:60,technique:93,endurance:82,charisma:76 }, bp:2.70, d: "Has 15 MCP servers installed. Uses two of them regularly." },
  { n: "The Discord Bot Wrangler", sub: "AllStar", tier: "Superstar", s: { power:83,speed:80,technique:87,endurance:78,charisma:84 }, bp:2.55, d: "Set up Discord integration and now the AI replies to every message. Chaos ensued." },
  { n: "Captain Compaction", sub: "Base", tier: "Superstar", s: { power:80,speed:72,technique:85,endurance:90,charisma:78 }, bp:2.45, d: "Triggers context compaction so often the AI forgets what year it is." },
  { n: "The Telegram Pinger", sub: "Base", tier: "Superstar", s: { power:76,speed:92,technique:74,endurance:68,charisma:91 }, bp:2.65, d: "Sends 'hey' from Telegram at random intervals. The AI responds every single time." },

  // ── STAR (22) ──────────────────────────────────────────────
  { n: "\"It Worked Yesterday\"", sub: "Base", tier: "Star", s: { power:72,speed:65,technique:70,endurance:75,charisma:80 }, bp:1.20, d: "The four most dangerous words in AI-assisted development." },
  { n: "The Permission Denier", sub: "Base", tier: "Star", s: { power:68,speed:55,technique:78,endurance:80,charisma:72 }, bp:1.35, d: "Denied exec permissions so many times the AI just gives up and suggests manual steps." },
  { n: "The Memory File Hoarder", sub: "Base", tier: "Star", s: { power:70,speed:50,technique:75,endurance:85,charisma:65 }, bp:1.10, d: "Writes everything to daily memory. The memory folder is 2GB and counting." },
  { n: "The \"Fix This\" DM Guy", sub: "Rookie", tier: "Star", s: { power:75,speed:82,technique:68,endurance:70,charisma:88 }, bp:1.45, d: "Sends screenshots of errors with zero context. Expects a full diagnosis." },
  { n: "The Parallel Pack Breaker", sub: "Base", tier: "Star", s: { power:78,speed:70,technique:80,endurance:72,charisma:76 }, bp:1.30, d: "Built an entire trading card system just to rip virtual packs at 3 AM." },
  { n: "The TOSHL Expense Logger", sub: "AllStar", tier: "Star", s: { power:65,speed:60,technique:82,endurance:78,charisma:70 }, bp:1.15, d: "Every purchase logged, categorized, and analyzed. Still broke." },
  { n: "The Browserless Devotee", sub: "Base", tier: "Star", s: { power:74,speed:68,technique:79,endurance:76,charisma:73 }, bp:1.25, d: "Runs browserless on port 3001 for everything. Hasn't opened a real browser in weeks." },
  { n: "\"What Model Are You?\"", sub: "Rookie", tier: "Star", s: { power:60,speed:75,technique:65,endurance:70,charisma:90 }, bp:1.00, d: "Asks the AI what model it is at least once per session." },
  { n: "The Docker Compose Overlord", sub: "Base", tier: "Star", s: { power:82,speed:55,technique:85,endurance:80,charisma:68 }, bp:1.40, d: "Runs 12 Docker containers for a personal assistant. Only three are actually needed." },
  { n: "The \"Show Status\" Addict", sub: "Base", tier: "Star", s: { power:62,speed:80,technique:60,endurance:65,charisma:82 }, bp:0.95, d: "Runs /status 15 times a day. Watches the token counter like it's a stock ticker." },
  { n: "The WSL Path Sufferer", sub: "Base", tier: "Star", s: { power:70,speed:58,technique:76,endurance:82,charisma:74 }, bp:1.15, d: "Every path is /home/user/.../.../.../file.js. Has given up on Windows Explorer." },
  { n: "The README Writer", sub: "AllStar", tier: "Star", s: { power:68,speed:72,technique:80,endurance:74,charisma:78 }, bp:1.30, d: "Makes the AI write beautiful READMEs for every project. None of the projects are finished." },
  { n: "The Node.js Purist", sub: "Base", tier: "Star", s: { power:76,speed:65,technique:83,endurance:75,charisma:70 }, bp:1.20, d: "\"We don't need Python. Node can do everything.\" It cannot do everything." },
  { n: "The Firecrawl Fanboy", sub: "Base", tier: "Star", s: { power:72,speed:62,technique:78,endurance:77,charisma:71 }, bp:1.05, d: "Uses Firecrawl for everything. Scraped 47 websites about houseplants last Tuesday." },
  { n: "The SearXNG Privacy Nerd", sub: "Base", tier: "Star", s: { power:66,speed:70,technique:74,endurance:78,charisma:75 }, bp:1.10, d: "Won't use Google. Runs a private metasearch engine just to search for memes." },
  { n: "\"Can You Make It Cheaper?\"", sub: "Base", tier: "Star", s: { power:64,speed:68,technique:72,endurance:80,charisma:85 }, bp:0.90, d: "Switches models based on cost per million tokens. Spends more time optimizing than coding." },
  { n: "The Launch Day Upgrader", sub: "Rookie", tier: "Star", s: { power:73,speed:88,technique:70,endurance:65,charisma:77 }, bp:1.35, d: "Updates OpenClaw within 30 seconds of a new release. Has broken things 11 times." },
  { n: "The Node Pairer", sub: "Base", tier: "Star", s: { power:80,speed:60,technique:82,endurance:78,charisma:66 }, bp:1.25, d: "Paired a phone, a tablet, and a smart fridge to OpenClaw. The fridge sends useful weather alerts." },
  { n: "The NPM Global Dump Guy", sub: "Base", tier: "Star", s: { power:71,speed:56,technique:77,endurance:74,charisma:68 }, bp:1.00, d: "Installs every CLI tool known to humanity. Has used three of them, ever." },
  { n: "\"Write Me a cron Job\"", sub: "AllStar", tier: "Star", s: { power:67,speed:74,technique:76,endurance:72,charisma:80 }, bp:1.15, d: "Every problem can be solved with a cron job. Every. Single. Problem." },
  { n: "The Brain Dump Chatter", sub: "Base", tier: "Star", s: { power:60,speed:78,technique:65,endurance:70,charisma:88 }, bp:0.95, d: "Uses the AI as a therapist. Sends 3000-word stream-of-consciousness messages at 2 AM." },
  { n: "The Brew Update Warrior", sub: "Base", tier: "Star", s: { power:74,speed:62,technique:79,endurance:76,charisma:71 }, bp:1.20, d: "Runs brew upgrade weekly. Has never read the changelog." },

  // ── UNCOMMON (27) ──────────────────────────────────────────
  { n: "The Silent Lurker", sub: "Base", tier: "Uncommon", s: { power:55,speed:60,technique:62,endurance:65,charisma:50 }, bp:0.65, d: "Watches every conversation but never participates. The AI knows they're there." },
  { n: "\"Test Message Ignore\"", sub: "Rookie", tier: "Uncommon", s: { power:52,speed:68,technique:55,endurance:58,charisma:60 }, bp:0.55, d: "Sends test messages constantly. They are never ignored." },
  { n: "The Emoji Spammer", sub: "Base", tier: "Uncommon", s: { power:50,speed:70,technique:58,endurance:60,charisma:75 }, bp:0.50, d: "Communicates exclusively in emoji. The AI has learned to decode them." },
  { n: "The Multi-Channel Poster", sub: "Base", tier: "Uncommon", s: { power:60,speed:65,technique:68,endurance:62,charisma:58 }, bp:0.60, d: "Active on Telegram, Discord, AND webchat simultaneously. Getting the same answer three times." },
  { n: "\"Delete That\"", sub: "Base", tier: "Uncommon", s: { power:58,speed:72,technique:60,endurance:55,charisma:65 }, bp:0.45, d: "Sends 'delete that' but the AI already replied to three channels." },
  { n: "The Screenshot Sender", sub: "Rookie", tier: "Uncommon", s: { power:56,speed:64,technique:62,endurance:60,charisma:62 }, bp:0.55, d: "Takes screenshots of terminal errors instead of copy-pasting the text." },
  { n: "The YAML Indent Victim", sub: "Base", tier: "Uncommon", s: { power:54,speed:58,technique:66,endurance:64,charisma:55 }, bp:0.70, d: "Broke their entire config with one wrong space in a YAML file." },
  { n: "The \"What Else Can You Do?\" Guy", sub: "Base", tier: "Uncommon", s: { power:58,speed:62,technique:60,endurance:60,charisma:68 }, bp:0.50, d: "Never has a specific task. Just wants to know the AI's capabilities. Again." },
  { n: "The .env Scatterer", sub: "Rookie", tier: "Uncommon", s: { power:55,speed:56,technique:64,endurance:62,charisma:52 }, bp:0.60, d: "Has API keys in five different .env files. None of them are in the right place." },
  { n: "The Timeout King", sub: "Base", tier: "Uncommon", s: { power:52,speed:50,technique:58,endurance:70,charisma:55 }, bp:0.65, d: "Every exec command times out. Increasing the timeout didn't help." },
  { n: "The \"Oops Wrong Chat\"", sub: "Base", tier: "Uncommon", s: { power:50,speed:75,technique:55,endurance:52,charisma:70 }, bp:0.45, d: "Sent their grocery list to the AI instead of their wife. The AI categorized it by aisle." },
  { n: "The Git Force Pusher", sub: "Flashback", tier: "Uncommon", s: { power:62,speed:58,technique:65,endurance:60,charisma:48 }, bp:0.70, d: "git push --force is their only commit strategy. History is a suggestion." },
  { n: "The Log Reader Hater", sub: "Base", tier: "Uncommon", s: { power:56,speed:60,technique:62,endurance:64,charisma:52 }, bp:0.55, d: "\"I'm not reading 500 lines of logs.\" Makes the AI read them instead." },
  { n: "The VS Code AI Tab Opener", sub: "Base", tier: "Uncommon", s: { power:60,speed:66,technique:64,endurance:58,charisma:58 }, bp:0.60, d: "Has 47 VS Code tabs open. Six of them are ChatGPT, three are Claude." },
  { n: "The Daily Reminder Setter", sub: "Base", tier: "Uncommon", s: { power:54,speed:62,technique:60,endurance:66,charisma:60 }, bp:0.50, d: "Sets reminders for everything. Including reminders to check reminders." },
  { n: "The Terminal Font Nerd", sub: "Base", tier: "Uncommon", s: { power:50,speed:55,technique:58,endurance:60,charisma:65 }, bp:0.40, d: "Spent 3 hours picking a monospace font. Uses it to stare at errors." },
  { n: "\"Can You Hear Me?\"", sub: "Rookie", tier: "Uncommon", s: { power:48,speed:72,technique:52,endurance:55,charisma:68 }, bp:0.45, d: "Tests every new channel with 'hello? can you hear me?' every single time." },
  { n: "The Alias Creator", sub: "Base", tier: "Uncommon", s: { power:58,speed:64,technique:66,endurance:60,charisma:56 }, bp:0.55, d: "Created 50 shell aliases to save typing. Forgot what any of them do." },
  { n: "The Multiple Desktop Guy", sub: "Base", tier: "Uncommon", s: { power:52,speed:60,technique:58,endurance:62,charisma:58 }, bp:0.50, d: "Has 8 virtual desktops. Desktop 7 is where things go to die." },
  { n: "The Weather Checker Addict", sub: "Base", tier: "Uncommon", s: { power:45,speed:62,technique:54,endurance:58,charisma:64 }, bp:0.40, d: "Asks the AI for weather updates 8 times a day. Lives in an apartment with no windows." },
  { n: "The \"One Last Feature\"", sub: "Base", tier: "Uncommon", s: { power:62,speed:58,technique:65,endurance:60,charisma:62 }, bp:0.65, d: "Promised 'one last feature' 47 features ago." },
  { n: "The Process Killer", sub: "Rookie", tier: "Uncommon", s: { power:56,speed:70,technique:58,endurance:55,charisma:54 }, bp:0.60, d: "Kills processes they don't recognize. That was the database. It's dead now." },
  { n: "The JSON Validator", sub: "Base", tier: "Uncommon", s: { power:55,speed:56,technique:68,endurance:64,charisma:50 }, bp:0.55, d: "Validates every JSON file 3 times before using it. One was still wrong." },
  { n: "The \"Reply Faster\" Guy", sub: "Base", tier: "Uncommon", s: { power:50,speed:74,technique:56,endurance:52,charisma:60 }, bp:0.45, d: "Complains about response times while running on the cheapest available model." },
  { n: "The Brew Cleanup Forgettor", sub: "Base", tier: "Uncommon", s: { power:54,speed:55,technique:60,endurance:65,charisma:52 }, bp:0.55, d: "Homebrew cache is 14GB. Has never run brew cleanup. Ever." },
  { n: "The Package.json Phantom", sub: "Base", tier: "Uncommon", s: { power:58,speed:60,technique:64,endurance:60,charisma:54 }, bp:0.60, d: "Installs packages but never adds them to package.json. Works until it doesn't." },
  { n: "The Help Menu Hero", sub: "Rookie", tier: "Uncommon", s: { power:48,speed:58,technique:55,endurance:62,charisma:60 }, bp:0.40, d: "Reads every --help output in full. Still doesn't understand the tool." },

  // ── COMMON (80) ────────────────────────────────────────────
  { n: "The Casual User", sub: "Base", tier: "Common", s: { power:45,speed:50,technique:48,endurance:52,charisma:55 }, bp:0.15, d: "Uses the AI twice a week for simple things. Lives a balanced, healthy life." },
  { n: "\"Hey Chat\"", sub: "Base", tier: "Common", s: { power:42,speed:55,technique:45,endurance:48,charisma:60 }, bp:0.20, d: "Starts every message with 'hey chat' like the AI is their roommate." },
  { n: "The List Maker", sub: "Base", tier: "Common", s: { power:48,speed:52,technique:50,endurance:55,charisma:52 }, bp:0.18, d: "Asks the AI to make lists of things. Organizes the lists into more lists." },
  { n: "The Copy-Paste Coder", sub: "Base", tier: "Common", s: { power:50,speed:58,technique:52,endurance:50,charisma:48 }, bp:0.25, d: "Copies every code snippet the AI generates. Understands exactly zero of them." },
  { n: "\"That's Not What I Meant\"", sub: "Base", tier: "Common", s: { power:44,speed:60,technique:46,endurance:50,charisma:62 }, bp:0.22, d: "The AI's most frequent feedback. Communication is a two-way street, buddy." },
  { n: "The Tab Closer", sub: "Base", tier: "Common", s: { power:40,speed:65,technique:44,endurance:48,charisma:55 }, bp:0.15, d: "Closes browser tabs instead of bookmarking them. Will need that page again in 10 minutes." },
  { n: "The Password Reset Looper", sub: "Rookie", tier: "Common", s: { power:42,speed:48,technique:46,endurance:55,charisma:45 }, bp:0.20, d: "Resets their password, forgets it, resets again. The cycle never ends." },
  { n: "The Git Commit Procrastinator", sub: "Base", tier: "Common", s: { power:46,speed:50,technique:50,endurance:52,charisma:48 }, bp:0.18, d: "One giant commit with the message 'fixes'. 847 files changed." },
  { n: "The Sound Effect Messenger", sub: "Base", tier: "Common", s: { power:40,speed:58,technique:44,endurance:46,charisma:65 }, bp:0.15, d: "Types 'sudo make me a sandwich' and expects the AI to play along." },
  { n: "The Docs Skimmer", sub: "Base", tier: "Common", s: { power:48,speed:52,technique:55,endurance:50,charisma:45 }, bp:0.22, d: "\"I read the docs.\" They did not read the docs." },
  { n: "The Auto-Accepter", sub: "Rookie", tier: "Common", s: { power:44,speed:56,technique:48,endurance:50,charisma:52 }, bp:0.18, d: "Clicks 'allow' on every permission prompt. Has never read a single one." },
  { n: "The Notification Dismissor", sub: "Base", tier: "Common", s: { power:42,speed:60,technique:46,endurance:48,charisma:50 }, bp:0.12, d: "Dismisses every notification without reading. Missed three important alerts today." },
  { n: "The \"Works On My Machine\" Dev", sub: "Base", tier: "Common", s: { power:52,speed:48,technique:54,endurance:55,charisma:44 }, bp:0.25, d: "It works on their machine. It works nowhere else. They don't understand why." },
  { n: "The Password Saver", sub: "Base", tier: "Common", s: { power:40,speed:45,technique:50,endurance:58,charisma:48 }, bp:0.15, d: "Saves passwords in a file called 'passwords.txt' on their desktop." },
  { n: "The Incognito Tab Believer", sub: "Base", tier: "Common", s: { power:38,speed:55,technique:42,endurance:45,charisma:58 }, bp:0.10, d: "Thinks incognito mode makes them invisible. It does not." },
  { n: "The Stack Overflow Loyalist", sub: "Flashback", tier: "Common", s: { power:50,speed:52,technique:54,endurance:52,charisma:48 }, bp:0.20, d: "Still copies from Stack Overflow even though the AI is right there." },
  { n: "The WiFi Switcher", sub: "Base", tier: "Common", s: { power:40,speed:62,technique:44,endurance:46,charisma:50 }, bp:0.15, d: "Switches between WiFi and cellular back and forth. Signal strength remains unchanged." },
  { n: "The Desktop Icon Sorter", sub: "Base", tier: "Common", s: { power:38,speed:48,technique:42,endurance:50,charisma:52 }, bp:0.12, d: "Organizes desktop icons by color. Has 200 shortcuts to the same application." },
  { n: "The Snippet Saver", sub: "Base", tier: "Common", s: { power:46,speed:50,technique:52,endurance:54,charisma:46 }, bp:0.18, d: "Saves code snippets in random files. Will never find them again." },
  { n: "\"I'll Fix It Later\"", sub: "Base", tier: "Common", s: { power:44,speed:48,technique:46,endurance:58,charisma:50 }, bp:0.15, d: "The TODO list grows longer. The fixes never come. Legacy debt accumulates." },
  { n: "The Multiple Terminal Guy", sub: "Base", tier: "Common", s: { power:48,speed:54,technique:50,endurance:52,charisma:46 }, bp:0.20, d: "Opens 12 terminal windows. Uses one. The other 11 show a blinking cursor." },
  { n: "The Manual Page Reader", sub: "Base", tier: "Common", s: { power:45,speed:46,technique:52,endurance:56,charisma:44 }, bp:0.18, d: "Actually reads man pages cover to cover. Respected but slow." },
  { n: "The Update Postponer", sub: "Base", tier: "Common", s: { power:42,speed:50,technique:48,endurance:60,charisma:46 }, bp:0.15, d: "\"Update available? I'll do it tomorrow.\" Seven months later, still on v0.3." },
  { n: "The Taskbar Hider", sub: "Base", tier: "Common", s: { power:38,speed:52,technique:42,endurance:48,charisma:55 }, bp:0.10, d: "Auto-hides the taskbar. Spends 3 seconds every time waiting for it to appear." },
  { n: "The Clipboard Clearer", sub: "Rookie", tier: "Common", s: { power:40,speed:58,technique:44,endurance:46,charisma:48 }, bp:0.15, d: "Clears clipboard after every paste. Paranoid or disciplined? Nobody knows." },
  { n: "The Folder Creator", sub: "Base", tier: "Common", s: { power:44,speed:50,technique:48,endurance:54,charisma:46 }, bp:0.18, d: "Creates folders for organization. Puts everything in one folder called 'stuff'." },
  { n: "The Theme Switcher", sub: "Base", tier: "Common", s: { power:40,speed:56,technique:44,endurance:46,charisma:58 }, bp:0.15, d: "Changes VS Code theme weekly. Dark, light, dracula, monokai, solarized. Repeats." },
  { n: "The \"Did You Google It?\" Guy", sub: "Base", tier: "Common", s: { power:46,speed:54,technique:50,endurance:52,charisma:52 }, bp:0.20, d: "Asks the AI questions they could've Googled in 5 seconds." },
  { n: "The Backup Neglector", sub: "Base", tier: "Common", s: { power:42,speed:48,technique:46,endurance:55,charisma:44 }, bp:0.18, d: "Has never backed up anything. Lives on the edge. The edge is a cliff." },
  { n: "The Night Mode Enthusiast", sub: "Base", tier: "Common", s: { power:40,speed:50,technique:46,endurance:52,charisma:52 }, bp:0.12, d: "Everything must be dark mode. Squints painfully at the occasional white website." },
  { n: "The Keyboard Shortcut Forgettor", sub: "Base", tier: "Common", s: { power:44,speed:48,technique:50,endurance:54,charisma:46 }, bp:0.15, d: "Learns a new keyboard shortcut. Forgets it by the next day. Repeat forever." },
  { n: "The Extension Hoarder", sub: "Base", tier: "Common", s: { power:46,speed:50,technique:52,endurance:52,charisma:44 }, bp:0.18, d: "28 browser extensions. Browser takes 47 seconds to start. Uses three of them." },
  { n: "The \"Quick Question\" Askor", sub: "Base", tier: "Common", s: { power:42,speed:58,technique:46,endurance:48,charisma:56 }, bp:0.15, d: "Every question is 'quick.' No question has ever been quick." },
  { n: "The Space-Bar Presser", sub: "Rookie", tier: "Common", s: { power:38,speed:62,technique:42,endurance:44,charisma:50 }, bp:0.10, d: "Presses spacebar to scroll. Page jumps 3 screens. Scrolls back up. Repeats." },
  { n: "The Git Branch Phantom", sub: "Base", tier: "Common", s: { power:48,speed:50,technique:52,endurance:52,charisma:44 }, bp:0.22, d: "Creates feature branches. Never merges them. 47 orphan branches and counting." },
  { n: "The README Ignorer", sub: "Base", tier: "Common", s: { power:42,speed:52,technique:46,endurance:50,charisma:48 }, bp:0.15, d: "Never reads READMEs. Opens issues asking questions answered in line 3." },
  { n: "The One Password Guy", sub: "Base", tier: "Common", s: { power:40,speed:48,technique:46,endurance:55,charisma:46 }, bp:0.18, d: "Uses the same password for everything. It's 'password123'. Obviously." },
  { n: "The Ctrl+Z Addict", sub: "Base", tier: "Common", s: { power:44,speed:60,technique:48,endurance:46,charisma:48 }, bp:0.15, d: "Undoes so many times they've accidentally deleted the entire project twice." },
  { n: "The \"Send It\" Messager", sub: "Base", tier: "Common", s: { power:46,speed:65,technique:44,endurance:42,charisma:58 }, bp:0.12, d: "Sends messages without proofreading. Typos are a lifestyle." },
  { n: "The uptime checker", sub: "Base", tier: "Common", s: { power:42,speed:52,technique:48,endurance:56,charisma:44 }, bp:0.18, d: "Checks if the AI is online every 20 minutes. It's always online. It never sleeps." },
  { n: "The error log ignorer", sub: "Rookie", tier: "Common", s: { power:40,speed:50,technique:44,endurance:52,charisma:46 }, bp:0.15, d: "Errors scroll past in the terminal. They scroll right past without a glance." },
  { n: "The ctrl c commander", sub: "Base", tier: "Common", s: { power:45,speed:62,technique:48,endurance:44,charisma:50 }, bp:0.18, d: "Ctrl+C is their favorite key. Kills processes they don't even recognize." },
  { n: "The .gitignore forgetter", sub: "Base", tier: "Common", s: { power:46,speed:48,technique:52,endurance:50,charisma:42 }, bp:0.20, d: "Committed node_modules to git. Three times. On three different projects." },
  { n: "The localhost believer", sub: "Base", tier: "Common", s: { power:42,speed:50,technique:48,endurance:54,charisma:48 }, bp:0.15, d: "\"It works on localhost!\" Famous last words before the production disaster." },
  { n: "The duplicate file maker", sub: "Rookie", tier: "Common", s: { power:40,speed:48,technique:44,endurance:52,charisma:46 }, bp:0.12, d: "Copies files instead of versioning them. Has final_final_v3_REAL.js." },
  { n: "The terminal maximizer", sub: "Base", tier: "Common", s: { power:38,speed:52,technique:44,endurance:50,charisma:48 }, bp:0.15, d: "Maximizes the terminal window to full screen. For a single ls command." },
  { n: "The error message closer", sub: "Base", tier: "Common", s: { power:44,speed:56,technique:46,endurance:48,charisma:50 }, bp:0.18, d: "Closes error popups without reading them. The error persists. They are confused." },
  { n: "The typing watcher", sub: "Base", tier: "Common", s: { power:40,speed:54,technique:44,endurance:48,charisma:52 }, bp:0.12, d: "Watches the AI type in real-time. Gets impatient after 2 seconds." },
  { n: "The print statement debugger", sub: "Flashback", tier: "Common", s: { power:50,speed:50,technique:48,endurance:52,charisma:44 }, bp:0.20, d: "console.log('here'), console.log('here2'), console.log('PLEASE WORK')." },
  { n: "The \"It's a Feature\" Defender", sub: "Base", tier: "Common", s: { power:46,speed:52,technique:50,endurance:54,charisma:48 }, bp:0.18, d: "Every bug is defended as an intentional feature. Users disagree." },
  { n: "The DM Hunter", sub: "Base", tier: "Common", s: { power:42,speed:60,technique:46,endurance:46,charisma:55 }, bp:0.15, d: "Slides into the AI's DMs from every available channel. Just to say hi." },
  { n: "The curl commands guy", sub: "Base", tier: "Common", s: { power:48,speed:50,technique:54,endurance:52,charisma:42 }, bp:0.20, d: "Tests APIs with curl commands that are 400 characters long. Works perfectly every time." },
  { n: "The seed data lover", sub: "Rookie", tier: "Common", s: { power:44,speed:48,technique:50,endurance:54,charisma:46 }, bp:0.15, d: "Adds seed data to databases. The seed data is funnier than the real data." },
  { n: "The dependency updater", sub: "Base", tier: "Common", s: { power:46,speed:52,technique:52,endurance:52,charisma:44 }, bp:0.18, d: "Runs npm audit fix. Everything breaks. Reverts. Tries again next month." },
  { n: "The hot reload abuser", sub: "Base", tier: "Common", s: { power:44,speed:58,technique:48,endurance:48,charisma:48 }, bp:0.15, d: "Saves a file every 3 seconds to watch it hot reload. The reload is instant. They still watch." },
  { n: "The \"I Know JSON\" Guy", sub: "Base", tier: "Common", s: { power:48,speed:52,technique:50,endurance:50,charisma:46 }, bp:0.22, d: "Claims to know JSON. Has a trailing comma in every object." },
  { n: "The ping pong player", sub: "Base", tier: "Common", s: { power:42,speed:56,technique:46,endurance:48,charisma:52 }, bp:0.15, d: "Pings the AI, AI replies, they ping again. Ping pong for 30 minutes." },
  { n: "The default settings guy", sub: "Base", tier: "Common", s: { power:40,speed:48,technique:44,endurance:52,charisma:50 }, bp:0.12, d: "Has never changed a single default setting. Everything is factory. They are content." },
  { n: "The auto save disabler", sub: "Base", tier: "Common", s: { power:42,speed:50,technique:46,endurance:50,charisma:48 }, bp:0.15, d: "Disabled auto-save. Lost 3 hours of work. Re-enabled auto-save." },
  { n: "The api doc reader", sub: "Base", tier: "Common", s: { power:46,speed:48,technique:56,endurance:52,charisma:44 }, bp:0.20, d: "Reads API docs for fun. Doesn't use the API. Just reads." },
  { n: "The env variable misser", sub: "Rookie", tier: "Common", s: { power:42,speed:50,technique:46,endurance:52,charisma:48 }, bp:0.15, d: "Forgets to source .env. Spends 20 minutes debugging a missing API key." },
  { n: "The reinstaller", sub: "Base", tier: "Common", s: { power:44,speed:52,technique:48,endurance:54,charisma:44 }, bp:0.18, d: "Uninstalls and reinstalls packages instead of figuring out what went wrong." },
  { n: "The silent error ignorer", sub: "Base", tier: "Common", s: { power:40,speed:50,technique:44,endurance:55,charisma:42 }, bp:0.15, d: "The program works, so the warnings don't matter. They will matter." },
  { n: "The emoji reactor", sub: "Base", tier: "Common", s: { power:38,speed:58,technique:42,endurance:44,charisma:60 }, bp:0.10, d: "Reacts to every AI message with an emoji. Has a reaction for every occasion." },
  { n: "The cleanup procrastinator", sub: "Base", tier: "Common", s: { power:44,speed:48,technique:50,endurance:56,charisma:42 }, bp:0.15, d: "'I'll clean up the code later.' The code is now 10,000 lines of spaghetti." },
  { n: "The split terminal lover", sub: "Base", tier: "Common", s: { power:46,speed:54,technique:52,endurance:50,charisma:46 }, bp:0.18, d: "Splits the terminal into 6 panes. Uses one. The other 5 show blank shells." },
  { n: "The overcommenter", sub: "Base", tier: "Common", s: { power:42,speed:46,technique:50,endurance:52,charisma:48 }, bp:0.15, d: "Comments every single line of code. // increment i by 1. i++;" },
  { n: "The domain buyer", sub: "Base", tier: "Common", s: { power:44,speed:50,technique:48,endurance:52,charisma:50 }, bp:0.20, d: "Buys 15 domains for projects that will never exist. The renewal emails haunt them." },
  { n: "The log output scroller", sub: "Base", tier: "Common", s: { power:42,speed:55,technique:44,endurance:50,charisma:48 }, bp:0.14, d: "Scrolls through 500 lines of build output looking for the one error. Misses it every time." },
  { n: "The \"Add it to the backlog\" Guy", sub: "Rookie", tier: "Common", s: { power:44,speed:48,technique:46,endurance:58,charisma:46 }, bp:0.16, d: "Everything goes to the backlog. The backlog has 847 items. Nothing has ever come out." },
  { n: "The meeting scheduler", sub: "Base", tier: "Common", s: { power:40,speed:52,technique:44,endurance:54,charisma:50 }, bp:0.15, d: "Schedules meetings to discuss meetings. The AI joins all of them. It doesn't speak." },
  { n: "The tab completer", sub: "Base", tier: "Common", s: { power:46,speed:56,technique:50,endurance:48,charisma:46 }, bp:0.18, d: "Presses tab 6 times for autocomplete. Types the full path anyway. Tab weeps." },
  { n: "The \"It Was Working\"claimer", sub: "Base", tier: "Common", s: { power:42,speed:50,technique:46,endurance:52,charisma:48 }, bp:0.15, d: "\"I didn't change anything, it was working!\" They definitely changed something." },
  { n: "The responsive design denier", sub: "Base", tier: "Common", s: { power:44,speed:48,technique:52,endurance:50,charisma:44 }, bp:0.17, d: "'Works on my monitor.' Everyone else sees a broken layout on mobile." },
  { n: "The lorem ipsum lover", sub: "Rookie", tier: "Common", s: { power:40,speed:50,technique:44,endurance:52,charisma:48 }, bp:0.12, d: "Uses lorem ipsum in production. Has been live for 2 years. Nobody noticed." },
  { n: "The port 3000 guy", sub: "Base", tier: "Common", s: { power:46,speed:52,technique:50,endurance:50,charisma:46 }, bp:0.18, d: "Runs everything on port 3000. Has 4 apps on port 3000. None of them work." },
  { n: "The diff checker", sub: "Base", tier: "Common", s: { power:48,speed:50,technique:54,endurance:52,charisma:44 }, bp:0.20, d: "Reviews every git diff line by line. Approves everything anyway." },
  { n: "The production deployer", sub: "Base", tier: "Common", s: { power:50,speed:58,technique:48,endurance:46,charisma:46 }, bp:0.22, d: "Deploys on Friday at 5 PM. With no tests. While eating a sandwich." },
  { n: "The webhook believer", sub: "Base", tier: "Common", s: { power:44,speed:52,technique:52,endurance:50,charisma:46 }, bp:0.16, d: "Thinks webhooks will solve everything. Has 12 webhooks that fire into the void." },
  { n: "The sudo everything guy", sub: "Rookie", tier: "Common", s: { power:46,speed:50,technique:48,endurance:52,charisma:44 }, bp:0.18, d: "Prefixes every command with sudo. Including sudo sudo ls. Has no idea why." },
];

// Build set
const year = new Date().getFullYear();
const code = "BOC"; // Bored OpenClaw
const setName = "Bored OpenClaw Users";
const category = "Pop Culture Parody";

const cards = CARDS.map((c, i) => ({
  num: String(i + 1).padStart(3, '0'),
  name: c.n,
  subset: c.sub,
  starTier: c.tier,
  desc: c.d,
  stats: c.s,
  basePrice: c.bp,
}));

const set = {
  code,
  name: setName,
  year,
  category,
  cards,
  seed: null,
  aiGenerated: true,
  createdBy: "Claw",
  created: new Date().toISOString(),
};

const key = `${code}-${year}`;
const setPath = path.join(DATA_DIR, 'sets', key);
const colPath = path.join(DATA_DIR, 'collections', key);
const cfgPath = path.join(DATA_DIR, 'config.json');

// Archive any existing set
let cfg = { wallet: 1000, activeSet: null, archivedSets: [] };
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}

if (cfg.activeSet) {
  try {
    const oldCol = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'collections', cfg.activeSet), 'utf8'));
    if (oldCol.cards && oldCol.cards.length > 0) {
      cfg.archivedSets = cfg.archivedSets || [];
      cfg.archivedSets.push({
        setKey: cfg.activeSet,
        totalCards: oldCol.cards.length,
        stats: { ...oldCol.stats },
        archivedAt: new Date().toISOString(),
      });
    }
  } catch {}
}

// Save
fs.mkdirSync(path.dirname(setPath), { recursive: true });
fs.mkdirSync(path.dirname(colPath), { recursive: true });
fs.writeFileSync(setPath, JSON.stringify(set, null, 2));
cfg.activeSet = key;
cfg.wallet = cfg.wallet || 1000;
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

fs.writeFileSync(colPath, JSON.stringify({
  setKey: key,
  cards: [],
  pulls: {},
  stats: { total: 0, value: 0, spent: 0, boxes: 0, packs: 0, hits: 0, oneOfOnes: 0 },
  bestPull: null,
  parallelCounts: {},
  wallet: cfg.wallet,
}, null, 2));

// Print
const tiers = {}, subs = {};
for (const c of cards) {
  tiers[c.starTier] = (tiers[c.starTier] || 0) + 1;
  subs[c.subset] = (subs[c.subset] || 0) + 1;
}

console.log(`\n${'═'.repeat(55)}`);
console.log(`  🎴 BORED OPENCLAW USERS — SPECIAL EDITION`);
console.log(`${'═'.repeat(55)}`);
console.log(`  Set: ${setName} (${code})`);
console.log(`  Category: ${category}`);
console.log(`  Year: ${year}`);
console.log(`  Cards: ${cards.length}`);
console.log(`  Wallet: $${cfg.wallet.toFixed(2)}`);
console.log(`\n  Star Tiers:`);
for (const t of ['Common', 'Uncommon', 'Star', 'Superstar', 'Legendary']) {
  console.log(`    ${t.padEnd(12)} ${tiers[t] || 0}`);
}
console.log(`\n  Subsets:`);
for (const s of ['Base', 'Rookie', 'AllStar', 'Flashback', 'Legend']) {
  const label = s === 'AllStar' ? 'AllStars' : s + 's';
  console.log(`    ${label.padEnd(14)} ${subs[s] || 0}`);
}
console.log(`\n  🏆 Legendary Roster:`);
for (const c of cards.filter(c => c.starTier === 'Legendary')) {
  console.log(`    ${code}-${c.num} ${c.name} [${c.subset}]`);
  console.log(`      "${c.desc}"`);
}
console.log(`\n  🌟 Superstars:`);
for (const c of cards.filter(c => c.starTier === 'Superstar').slice(0, 7)) {
  console.log(`    ${code}-${c.num} ${c.name} [${c.subset}]`);
  console.log(`      "${c.desc}"`);
}
console.log(`${'═'.repeat(55)}`);
console.log(`  Ready to rip! Try: node card-engine.js open-box hobby`);
console.log(`${'═'.repeat(55)}\n`);
