#!/usr/bin/env node
'use strict';
/**
 * Trading Card Set Categories — generation logic, templates, and display helpers
 * 
 * Supports: character (default), sports, celebrity, movie, tv, collection, novelty
 */

// ─── SET SIZE RANGES (research-based) ──────────────────────────
const SIZE_RANGES = {
  character:  { min: 100, max: 300, suggest: 150 },
  sports:     { min: 100, max: 500, suggest: 300 },
  celebrity:  { min: 50,  max: 200, suggest: 100 },
  movie:      { min: 72,  max: 330, suggest: 180 },
  tv:         { min: 40,  max: 120, suggest: 50  },
  collection: { min: 50,  max: 200, suggest: 120 },
  novelty:    { min: 40,  max: 150, suggest: 80  },
};

// ─── CATEGORY DEFINITIONS ──────────────────────────────────────

const SET_CATEGORIES = ['character','sports','celebrity','movie','tv','collection','novelty'];

const CATEGORY_LABELS = {
  character: 'Character/Fictional',
  sports: 'Sports',
  celebrity: 'Celebrity',
  movie: 'Movie',
  tv: 'TV Show',
  collection: 'Collection',
  novelty: 'Novelty',
};

// Subsets per category
const CATEGORY_SUBSETS = {
  character: [{name:'Base',w:50,m:1},{name:'Rookie',w:20,m:1.3},{name:'Legend',w:8,m:1.5},{name:'AllStar',w:12,m:1.2},{name:'Flashback',w:10,m:1.1}],
  sports: [{name:'Base',w:35,m:1},{name:'Rookies',w:20,m:1.3},{name:'All-Stars',w:12,m:1.5},{name:'Legends',w:8,m:1.8},{name:'Draft Picks',w:15,m:1.2},{name:'Hall of Fame',w:10,m:2}],
  celebrity: [{name:'A-List',w:20,m:1.5},{name:'Rising Star',w:25,m:1.1},{name:'Icon',w:15,m:1.8},{name:'Legend',w:10,m:2},{name:'Behind the Scenes',w:30,m:1}],
  movie: [{name:'Opening Act',w:15,m:1},{name:'Rising Action',w:25,m:1.1},{name:'Climax',w:12,m:1.5},{name:'Falling Action',w:18,m:1},{name:'Finale',w:10,m:1.3},{name:'Character Spotlight',w:10,m:1.4},{name:'Key Moment',w:10,m:1.6}],
  tv: [{name:'Opening Act',w:15,m:1},{name:'Rising Action',w:25,m:1.1},{name:'Climax',w:12,m:1.5},{name:'Falling Action',w:18,m:1},{name:'Finale',w:10,m:1.3},{name:'Character Spotlight',w:10,m:1.4},{name:'Key Moment',w:10,m:1.6}],
  collection: [{name:'Common Find',w:45,m:1},{name:'Rare Specimen',w:25,m:1.5},{name:'Legendary Discovery',w:15,m:2.5},{name:'One-of-a-Kind',w:5,m:4},{name:'Field Notes',w:10,m:1.1}],
  novelty: [{name:'Deep Fried',w:15,m:1.3},{name:'Wholesome',w:20,m:1},{name:'Brain Rot',w:15,m:1.2},{name:'Classic Meme',w:20,m:1.1},{name:'Theory',w:15,m:1.4},{name:'Legend',w:15,m:1.5}],
};

const CATEGORY_EMOJIS = {
  character:'🃏', sports:'⚽', celebrity:'🌟', movie:'🎬', tv:'📺', collection:'🔬', novelty:'🤪',
};

// ─── SPORTS DATA ────────────────────────────────────────────────

const SPORTS = {
  basketball: {
    label:'Basketball', teams:['Thunder Hawks','Metro Wolves','Coastal Kings','Iron Pioneers','Sky Rockets','Bay Strikers','Summit Eagles','River Foxes'],
    positions:['Point Guard','Shooting Guard','Small Forward','Power Forward','Center'],
    stats:['GP','PTS','REB','AST','STL','BLK','3PM','FG%'],
    statRanges:{GP:[40,82],PTS:[3,35],REB:[1,14],AST:[0,11],STL:[0,3],BLK:[0,3],'3PM':[0,5],'FG%':[30,65]},
  },
  football: {
    label:'Football', teams:['Storm Titans','Iron Wolves','Golden Bears','Silver Hawks','Red Fury','Blue Demons','Steel Sharks','Crimson Lions'],
    positions:['QB','RB','WR','TE','OL','DL','LB','CB','S','K'],
    stats:['GP','PASS YDS','RUSH YDS','REC YDS','TD','INT','TACKLES','SACKS'],
    statRanges:{GP:[8,17],'PASS YDS':[0,5200],'RUSH YDS':[0,2000],'REC YDS':[0,1800],TD:[0,50],INT:[0,25],TACKLES:[0,170],SACKS:[0,22]},
  },
  soccer: {
    label:'Soccer', teams:['FC Dynamo','United Rangers','Real Olympian','Bayern Athletic','Inter Phoenix','Atletico Stars','Chelsea Rovers','Juventus City'],
    positions:['GK','CB','LB','RB','CDM','CM','CAM','LW','RW','ST'],
    stats:['GP','Goals','Assists','Clean Sheets','Yellow Cards','Minutes'],
    statRanges:{GP:[15,50],Goals:[0,38],Assists:[0,20],'Clean Sheets':[0,20],'Yellow Cards':[0,14],Minutes:[200,4500]},
  },
  baseball: {
    label:'Baseball', teams:['Thunder Bombers','Iron Hammers','Golden Bats','Silver Sluggers','Red Streaks','Blue Crew','Steel Nails','Crimson Sox'],
    positions:['C','1B','2B','3B','SS','LF','CF','RF','SP','RP','DH'],
    stats:['GP','AVG','HR','RBI','SB','ERA','SO','OPS'],
    statRanges:{GP:[50,162],AVG:[180,370],HR:[0,62],RBI:[0,150],SB:[0,70],ERA:[100,500],SO:[0,320],OPS:[550,1200]},
  },
  hockey: {
    label:'Hockey', teams:['Ice Wolves','Frost Bears','Storm Riders','Thunder Blades','Golden Pucks','Silver Skates','Steel Rink','Crimson Ice'],
    positions:['G','LD','RD','C','LW','RW'],
    stats:['GP','Goals','Assists','Points','PIM','PlusMinus','Saves','SV%'],
    statRanges:{GP:[30,82],Goals:[0,55],Assists:[0,90],Points:[0,145],PIM:[0,180],PlusMinus:[-40,65],Saves:[0,2500],'SV%':[880,950]},
  },
  mma: {
    label:'MMA', teams:['Team Apex','Team Titan','Team Fury','Team Alpha'],
    positions:['Striker','Grappler','Wrestler','Muay Thai','BJJ Specialist','All-Rounder'],
    stats:['Wins','Losses','KO/TKO','Submissions','Decision','Win Streak','Reach'],
    statRanges:{Wins:[0,30],Losses:[0,15],'KO/TKO':[0,20],Submissions:[0,12],Decision:[0,15],'Win Streak':[0,16],Reach:[60,84]},
  },
  f1: {
    label:'Formula 1', teams:['Scuderia Rossa','Silver Arrow Racing','Papaya Motorsport','Racing Bulls','Alpine F1','McLaren Legacy','Haas Precision','Williams Heritage'],
    positions:['Driver #1','Driver #2','Test Driver','Reserve Driver'],
    stats:['Races','Wins','Podiums','Poles','Fastest Laps','Points','DNFs','Championship Pos'],
    statRanges:{Races:[5,350],Wins:[0,103],Podiums:[0,200],Poles:[0,107],'Fastest Laps':[0,100],Points:[0,620],DNFs:[0,40],'Championship Pos':[1,22]},
  },
  tennis: {
    label:'Tennis', teams:['Independent'],
    positions:['Singles','Doubles','Mixed Doubles'],
    stats:['Titles','Grand Slams','Win Rate','Aces','Ranking','Prize Money (M)'],
    statRanges:{Titles:[0,92],'Grand Slams':[0,24],'Win Rate':[45,92],Aces:[0,1800],Ranking:[1,500],'Prize Money (M)':[0,130]},
  },
  golf: {
    label:'Golf', teams:['Independent'],
    positions:['Pro'],
    stats:['Wins','Majors','Top 10s','Cuts Made','Scoring Avg','Driving Distance','Putts Per Round'],
    statRanges:{Wins:[0,82],Majors:[0,18],'Top 10s':[0,350],'Cuts Made':[0,500],'Scoring Avg':[68,73],'Driving Distance':[270,325],'Putts Per Round':[27,31]},
  },
};

const SPORT_NAMES_MALE = ['Marcus','Tyson','Darius','Jett','Kai','Rico','Dante','Axel','Blaze','Raven','Jax','Storm','Viper','Ace','Titan','Rex','Zane','Duke','Diesel','Flash','Bolt','Slash','Rush','Tank','Havoc','Savage','Knox','Beast','Fury','Steel'];
const SPORT_NAMES_FEMALE = ['Zara','Nova','Luna','Raven','Aria','Sasha','Mika','Jade','Rhea','Nyx','Iris','Kira','Remy','Sage','Ember','Onyx','Vega','Lyra','Freya','Suki','Nola','Tessa','Maren','Cleo','Juno','Atlas','Echo','Sol','Vex','Aura'];

// ─── CELEBRITY DATA ────────────────────────────────────────────

const CELEB_PROFESSIONS = [
  'Actor','Actress','Musician','Director','Producer','Influencer','Artist','Comedian',
  'Fashion Designer','Chef','Author','DJ','Dancer','Model','Singer-Songwriter',
  'Talk Show Host','Athlete-Turned-Actor','Streamer','Podcaster','Playwright',
  'Architect','Photographer','Choreographer','Game Designer','Entrepreneur',
];

const CELEB_ERAS = ['1960s','1970s','1980s','1990s','2000s','2010s','2020s'];

const CELEB_NOTABLE_WORKS = {
  'Actor': ['{title}','{title} and the Last Stand','Into the {adj}','The {adj} {noun}','Beyond {noun}','Midnight in {place}'],
  'Actress': ['{title}','Echoes of {noun}','The {adj} Promise','Lady {noun}','Golden Hour','{title}: Redemption'],
  'Musician': ['{album} (album)','{album} (album)','{title} Tour','{single} (single)','Live at {venue}','{album} (double album)'],
  'Director': ['{title}','{title} Part II','The {adj} Mirror','Episode: "{episode}"','{title} (documentary)','{title} (short)'],
  'Influencer': ['{platform} Creator of the Year','{brand} partnership','{title} series','{million}M followers milestone','{title} podcast','{title} clothing line'],
};

const CELEB_NAME_TEMPLATES = [
  // Glamorous/believable names
  'Jaxson {l}','Sienna {l}','Phoenix {l}','Chloe {l}','Damien {l}','Aria {l}','Milo {l}','Lena {l}',
  'Rocco {l}','Vivian {l}','Theo {l}','Isla {l}','Felix {l}','Nora {l}','Leo {l}','Mila {l}',
  'Cassian {l}','Luna {l}','Ezra {l}','Sloane {l}','Kai {l}','Harper {l}','Remy {l}','Stella {l}',
  'Xander {l}','Celeste {l}','Nico {l}','Jade {l}','Atlas {l}','Lyra {l}','Orion {l}','Freya {l}',
];

const CELEB_LAST_NAMES = ['Moreau','Fontaine','Blackwell','Sterling','Ashford','Voss','Montague','Delacroix','Sinclair','Worthington','Kingsley','Blackwood','Ashmore','Calloway','Whitmore','Pemberton','Hayworth','Vale','Sterling','Lancaster'];

// ─── COLLECTION THEMES ──────────────────────────────────────────

const COLLECTION_THEMES = [
  {id:'wildlife',label:'Wildlife Photography',subjects:['African Elephant','Snow Leopard','Blue Whale','Red Panda','Harpy Eagle','Komodo Dragon','Narwhal','Axolotl','Pangolin','Mandrill','Fossa','Okapi','Quetzal','Saola','Markhor','Dhole','Binturong','Kakapo','Tarsier','Mantis Shrimp'],classification:'Animal Kingdom',origin:'Worldwide'},
  {id:'space',label:'Deep Space Objects',subjects:['Andromeda Galaxy','Orion Nebula','Pillars of Creation','Crab Nebula','Sombrero Galaxy','Eagle Nebula','Ring Nebula','Black Hole Cygnus X-1','Neutron Star J0740','Betelgeuse','Triangulum Galaxy','Whirlpool Galaxy','Horsehead Nebula','Carina Nebula','Cat Eye Nebula','Veil Nebula','Ant Nebula','Helix Nebula','Butterfly Nebula','Tarantula Nebula'],classification:'Astronomical Object',origin:'Observable Universe'},
  {id:'gemstones',label:'Rare Gemstones',subjects:['Pink Star Diamond','Blue Hope Sapphire','Emerald of Mogul','Black Opal Aurora','Alexandrite Imperial','Paraiba Tourmaline','Tanzanite Crystal','Padparadscha Sapphire','Red Beryl','Benitoite','Grandidierite','Jadeite Imperial','Musgravite','Painite','Taaffeite','Serendibite','Alexandrite Chrysoberyl','Tsavorite Garnet','Demantoid Garnet','Black Tahitian Pearl'],classification:'Mineral / Gemstone',origin:'Worldwide'},
  {id:'dinosaurs',label:'Prehistoric Giants',subjects:['Tyrannosaurus Rex','Triceratops','Velociraptor','Brachiosaurus','Stegosaurus','Spinosaurus','Ankylosaurus','Pteranodon','Parasaurolophus','Dilophosaurus','Allosaurus','Archaeopteryx','Mosasaurus','Pachycephalosaurus','Compsognathus','Giganotosaurus','Dimetrodon','Ichthyosaurus','Mamenchisaurus','Deinonychus'],classification:'Dinosauria / Prehistoric',origin:'Mesozoic Era'},
  {id:'art',label:'Art Masterpieces',subjects:['Starry Night','The Mona Lisa','The Scream','Girl with a Pearl Earring','The Persistence of Memory','The Great Wave','A Sunday Afternoon','The Birth of Venus','Water Lilies','The Night Watch','Guernica','American Gothic','The Kiss','Nighthawks','Wanderer Above the Sea of Fog','The Arnolfini Portrait','Las Meninas','Liberty Leading the People','Olympia','The Dance'],classification:'Fine Art / Painting',origin:'Worldwide Museums'},
  {id:'artifacts',label:'Historical Artifacts',subjects:['Rosetta Stone','Terracotta Warrior','Dead Sea Scrolls','Antikythera Mechanism','Tutankhamuns Mask','Viking Longship Figurehead','Aztec Sun Stone','Code of Hammurabi','Sutton Hoo Helmet','Portland Vase','Crown of the Holy Roman Empire','Egyptian Book of the Dead','Greek Spartan Shield','Roman Dodecahedron','Incan Quipu','Samurai Armor Kabuto','Persian Rhyton','Chinese Jade Burial Suit','Mayan Jade Mask','Celtic Torc'],classification:'Historical Artifact',origin:'Ancient Civilizations'},
  {id:'ocean',label:'Deep Ocean Wonders',subjects:['Giant Squid','Anglerfish','Mariana Snailfish','Dumbo Octopus','Vampire Squid','Gulper Eel','Barreleye Fish','Leafy Seadragon','Mantis Shrimp','Giant Isopod','Yeti Crab','Ghost Octopus','Tube Worm Colony','Black Dragonfish','Fangtooth Fish','Hatchetfish','Siphonophore','Glass Sponge','Sea Pig','Firefly Squid'],classification:'Marine Life',origin:'Deep Ocean'},
  {id:'plants',label:'Botanical Wonders',subjects:['Corpse Flower','Venus Flytrap','Giant Water Lily','Welwitschia','Rafflesia','Dragon Blood Tree','Baobab','Sensitive Plant','Pitcher Plant','Sundew','Sequoia','Bristlecone Pine','Ghost Plant','Lithops','Fly Orchid','Cobra Lily','Bird of Paradise','Cannonball Tree','Monkey Puzzle','Jade Vine'],classification:'Plantae',origin:'Worldwide'},
];

// ─── NOVELTY DATA ───────────────────────────────────────────────

const NOVELTY_CATEGORIES = [
  {id:'meme',label:'Meme',desc:'Internet memes and viral content'},
  {id:'philosophy',label:'Philosophy',desc:'Philosophical concepts and thought experiments'},
  {id:'urban_legend',label:'Urban Legend',desc:'Creepy stories and unverified claims'},
  {id:'conspiracy',label:'Conspiracy Theory',desc:'Conspiracy theories and hidden narratives'},
  {id:'absurd',label:'Absurd Concept',desc:'Bizarre, surreal, or paradoxical ideas'},
  {id:'internet_culture',label:'Internet Culture',desc:'Online phenomena and digital subcultures'},
];

const NOVELTY_CONCEPTS = [
  // memes
  {name:'Distracted Boyfriend Alternative',category:'meme',desc:'A man torn between two paths, one labelled "responsibility" and the other "napping"'},
  {name:'This Is Fine',category:'meme',desc:'Everything is on fire and this dog is absolutely okay with it'},
  {name:'Woman Yelling at Cat',category:'meme',desc:'Two incompatible universes colliding at a dinner table'},
  {name:'Mocking SpongeBob',category:'meme',desc:'iN wHiCh eVeRyThInG iS mOcKeD iN eQuAl MeAsUrE'},
  {name:'Drake Hotline Bling',category:'meme',desc:'A hierarchy of preferences rendered in two simple panels'},
  {name:'Expanding Brain',category:'meme',desc:'Increasingly enlightened takes on the same mundane topic'},
  {name:'One Does Not Simply',category:'meme',desc:'The understatement of impossibility, Boromir-approved'},
  // philosophy
  {name:'Ship of Theseus',category:'philosophy',desc:'If you replace every part of something, is it still the same thing?'},
  {name:'Schrödingers Card',category:'philosophy',desc:'This card is simultaneously in your collection and not until you check'},
  {name:'The Chinese Room',category:'philosophy',desc:'Understanding vs. simulating understanding — can you tell the difference?'},
  {name:'Brain in a Vat',category:'philosophy',desc:'What if this whole set is just a simulation within a simulation?'},
  {name:'Pascals Wager',category:'philosophy',desc:'Better safe than sorry when the stakes are infinite'},
  {name:'The Bystander Effect',category:'philosophy',desc:'Everyone watching, nobody helping — a crowd of inaction'},
  // urban legends
  {name:'The Vanishing Hitchhiker',category:'urban_legend',desc:'A mysterious passenger who disappears before reaching their destination'},
  {name:'The Creepy Babysitter Call',category:'urban_legend',desc:'The calls are coming from inside the house'},
  {name:'The Hook on the Car Door',category:'urban_legend',desc:'A warning about checking your surroundings that everyone ignores'},
  {name:'The Singing Corpse',category:'urban_legend',desc:'They say if you hear the melody, you have seven days...'},
  {name:'The Midnight Game',category:'urban_legend',desc:'A ritual that should never be played alone after dark'},
  // conspiracy
  {name:'The Lizard People',category:'conspiracy',desc:"They walk among us, disguised as accountants and weather presenters"},
  {name:'Flat Trading Cards',category:'conspiracy',desc:'Cards are actually 2D and the hobby is a government psyop'},
  {name:'The Five Gum Banks',category:'conspiracy',desc:'A shadowy cartel controlling the secondary market from the shadows'},
  {name:'Area 51 Card Vault',category:'conspiracy',desc:'The government is hiding the ultimate 1/1 collection in the desert'},
  {name:'Moon Pulling Was Faked',category:'conspiracy',desc:'All those unboxing videos? Shot on a soundstage in Nevada'},
  // absurd
  {name:'Toast Buttered Side Down',category:'absurd',desc:'The universe conspires against your breakfast, every single morning'},
  {name:'Infinite Parallel You',category:'absurd',desc:'In another universe, you bought the blaster and pulled the 1/1'},
  {name:'The Grandmother Paradox',category:'absurd',desc:'Time travel creates a collectibles market that cant exist'},
  {name:'Sentient Pack Wrapper',category:'absurd',desc:'The wrapper knows what cards are inside and judges you for pulling'},
  {name:'Card Gravity',category:'absurd',desc:'The more you want a specific card, the heavier the universe makes it to pull'},
  // internet culture
  {name:'NPC Dialogue Tree',category:'internet_culture',desc:'Every conversation feels like selecting option A or B'},
  {name:'Doomscrolling Achievement',category:'internet_culture',desc:'You scrolled for 6 hours straight. +0 EXP. -SAN 15.'},
  {name:'Autofill Prediction',category:'internet_culture',desc:'Your phone knows what you want to say before you do'},
  {name:'The Algorithm',category:'internet_culture',desc:'A mysterious force deciding what you see, buy, and think'},
  {name:'Viral Overnight',category:'internet_culture',desc:'Fifteen minutes of fame compressed into fifteen seconds of content'},
];

// ─── MOVIE/TV GENERATION DATA ──────────────────────────────────

const MOVIE_GENRES = ['Sci-Fi','Fantasy','Thriller','Horror','Drama','Action','Mystery','Comedy','Noir','Western','Post-Apocalyptic','Cyberpunk','Steampunk','Dark Fantasy','Space Opera','Psychological Thriller','Historical Epic','Superhero','Mockumentary','Coming of Age'];

const MOVIE_NAME_PARTS = {
  adjectives: ['Last','Eternal','Silent','Broken','Forgotten','Hidden','Crimson','Dark','Iron','Final','Phantom','Infinite','Shattered','Lost','Burning','Frozen','Hollow','Twisted','Golden','Savage'],
  nouns: ['Horizon','Frontier','Protocol','Kingdom','Empire','Signal','Threshold','Legacy','Convergence','Genesis','Ascension','Resonance','Exodus','Eclipse','Paradox','Dominion','Catalyst','Witness','Omen','Reckoning'],
  connectors: ['of','Beyond','Under','Before','After','Within','Against','Through','Between','Into'],
};

// ─── HELPERS ────────────────────────────────────────────────────

function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function ri(rng,a,b){const r=rng||Math.random;return Math.floor(r()*(b-a+1))+a;}
function pick(rng,arr){return arr[Math.floor((rng||Math.random)()*arr.length)];}
function pwK(arr,k,rng){const t=arr.reduce((s,x)=>s+x[k],0);let r=(rng||Math.random)()*t;for(const x of arr){r-=x[k];if(r<=0)return x}return arr[arr.length-1];}
function normalizeSeed(seed,fallback=Date.now()){
  const n=Number(seed);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

const TIERS=[
  {name:"Common",w:55,st:[40,75],pr:[0.10,0.30]},
  {name:"Uncommon",w:18,st:[50,80],pr:[0.30,0.75]},
  {name:"Star",w:14,st:[60,90],pr:[0.75,1.50]},
  {name:"Superstar",w:9,st:[70,95],pr:[1.50,3.00]},
  {name:"Legendary",w:4,st:[80,98],pr:[3.00,5.00]},
];

// ─── CARD GENERATION PER CATEGORY ───────────────────────────────

function resolveSubsets(setCategory) {
  return CATEGORY_SUBSETS[setCategory] || CATEGORY_SUBSETS.character;
}

function genCard_Character(num, cat, theme, rng) {
  const baseSeed = normalizeSeed(rng);
  const cr = mulberry32(baseSeed + num*13 + cat.f.length*7 + cat.l.length*3);
  const tier = pwK(TIERS,'w',cr);
  const sub = pwK(resolveSubsets('character'),'w',cr);
  const name = cat.f[ri(cr,0,cat.f.length-1)] + ' ' + cat.l[ri(cr,0,cat.l.length-1)];
  const ds = [`${name} dominates the ${theme} circuit`,`A legend of ${theme}, ${name} never backs down`,
    `${name}'s legacy in ${theme} is unmatched`,`The ${theme} chronicles feature ${name}`,
    `${name} rose through ${theme} with unmatched skill`];
  const stats = {};
  for (const k of ['power','speed','technique','endurance','charisma']) stats[k] = ri(cr,tier.st[0],tier.st[1]);
  return {num:String(num).padStart(3,'0'),name,subset:sub.name,starTier:tier.name,stats,desc:ds[ri(cr,0,4)],
    basePrice:tier.pr[0]+cr()*(tier.pr[1]-tier.pr[0])};
}

function genCard_Sports(num, rng, sportKey) {
  const baseSeed = normalizeSeed(rng);
  const cr = mulberry32(baseSeed + num*31 + 7);
  const tier = pwK(TIERS,'w',cr);
  const sub = pwK(resolveSubsets('sports'),'w',cr);
  const sport = SPORTS[sportKey] || SPORTS.basketball;
  const isFemale = cr() < 0.35;
  const namePool = isFemale ? SPORT_NAMES_FEMALE : SPORT_NAMES_MALE;
  const firstName = pick(cr, namePool);
  const lastName = pick(cr, ['Johnson','Williams','Chen','Rodriguez','Nakamura','Okafor','Kowalski','Petrov','Davies','Singh','Moreau','Park','Ali','Costa','Bergström','Foster','Reyes','Thompson','Novak','Santos']);
  const name = firstName + ' ' + lastName;
  const team = pick(cr, sport.teams);
  const position = pick(cr, sport.positions);
  const jersey = ri(cr, 1, 99);
  // Generate season stats
  const seasonStats = {};
  for (const stat of sport.stats) {
    const [lo,hi] = sport.statRanges[stat] || [0,100];
    seasonStats[stat] = ri(cr, lo, hi);
  }
  // Overall power rating from stats
  const avgStat = Object.values(seasonStats).reduce((s,v)=>s+v,0) / Object.values(seasonStats).length;
  const stats = {
    power: ri(cr, tier.st[0], tier.st[1]),
    speed: ri(cr, tier.st[0], tier.st[1]),
    technique: ri(cr, tier.st[0], tier.st[1]),
    endurance: ri(cr, tier.st[0], tier.st[1]),
    charisma: ri(cr, tier.st[0], tier.st[1]),
  };
  const desc = `${name} (${team}, #${jersey}) — ${position}. ${seasonStats[sport.stats[0]]} ${sport.stats[0]} this season.`;
  return {
    num: String(num).padStart(3,'0'), name, subset: sub.name, starTier: tier.name,
    stats, desc,
    basePrice: tier.pr[0] + cr() * (tier.pr[1] - tier.pr[0]),
    // Category-specific fields
    team, position, sport: sportKey, jerseyNumber: jersey, seasonStats,
  };
}

function genCard_Celebrity(num, rng) {
  const baseSeed = normalizeSeed(rng);
  const cr = mulberry32(baseSeed + num*17 + 11);
  const tier = pwK(TIERS,'w',cr);
  const sub = pwK(resolveSubsets('celebrity'),'w',cr);
  const nameTemplate = pick(cr, CELEB_NAME_TEMPLATES);
  const lastName = pick(cr, CELEB_LAST_NAMES);
  let name = nameTemplate.replace('{l}', lastName);
  const profession = pick(cr, CELEB_PROFESSIONS);
  const era = pick(cr, CELEB_ERAS);
  // Generate notable works
  const templates = CELEB_NOTABLE_WORKS[profession] || CELEB_NOTABLE_WORKS['Actor'];
  const notableWorks = templates.slice(0, 2).map(t => t
    .replace('{title}', pick(cr, ['Velvet Dawn','Crimson Tide','Echo Falls','Neon Dreams','Midnight Run','Last Light','Iron Skies','Broken Compass','Wild Heart','Silent Witness','Double Exposure','The Catalyst','Hollow Ground','Night Shift','Open Road']))
    .replace('{adj}', pick(cr, ['Crimson','Silent','Golden','Dark','Iron','Final','Last','Hidden','Lost','Burning']))
    .replace('{noun}', pick(cr, ['Horizon','Kingdom','Frontier','Promise','Mirror','Legacy','Threshold','Signal','Storm','Gate']))
    .replace('{album}', pick(cr, ['Midnight Rain','Electric Soul','Golden Hour','Neon Nights','Acoustic Dreams']))
    .replace('{single}', pick(cr, ['Starlight','Falling','Echoes','Gravity','Shadows']))
    .replace('{venue}', pick(cr, ['Madison Square Garden','Red Rocks','The Hollywood Bowl','Royal Albert Hall','Wembley']))
    .replace('{platform}', pick(cr, ['Twitch','YouTube','TikTok','Instagram']))
    .replace('{brand}', pick(cr, ['Nike','Adidas','Gucci','Supreme','Balenciaga']))
    .replace('{episode}', pick(cr, ['The Reveal','Zero Hour','Point of No Return','Aftermath','The Long Game']))
    .replace('{million}', String(ri(cr, 2, 50)))
  );
  const fameScore = tier.name === 'Legendary' ? ri(cr,90,99) :
    tier.name === 'Superstar' ? ri(cr,75,92) :
    tier.name === 'Star' ? ri(cr,55,78) :
    tier.name === 'Uncommon' ? ri(cr,30,58) : ri(cr,5,35);
  const stats = { fameScore };
  const desc = `${name} — ${profession}, ${era}. Notable: ${notableWorks.join(', ')}. Fame Score: ${fameScore}/100.`;
  return {
    num: String(num).padStart(3,'0'), name, subset: sub.name, starTier: tier.name,
    stats: {...stats, power:fameScore, speed:ri(cr,30,80), technique:ri(cr,30,80), endurance:ri(cr,30,80), charisma:fameScore},
    desc, basePrice: tier.pr[0] + cr() * (tier.pr[1] - tier.pr[0]),
    profession, era, notableWorks, fameScore,
  };
}

function genCard_Collection(num, rng, themeId) {
  const baseSeed = normalizeSeed(rng);
  const cr = mulberry32(baseSeed + num*23 + 13);
  const theme = COLLECTION_THEMES.find(t => t.id === themeId) || COLLECTION_THEMES[0];
  const tier = pwK(TIERS,'w',cr);
  const sub = pwK(resolveSubsets('collection'),'w',cr);
  const subject = theme.subjects[num - 1] || theme.subjects[(num - 1) % theme.subjects.length];
  // Variations for uniqueness
  const variations = ['Juvenile','Alpha','Rare','Ancient','Giant','Pygmy','Albino','Golden','Shadow','Crystal'];
  const suffix = cr() < 0.15 ? ' (' + pick(cr, variations) + ')' : '';
  const displayName = subject + suffix;
  const descTemplates = [
    `A ${sub.name.toLowerCase()} specimen of ${subject}, captured in its natural habitat.`,
    `${subject}${suffix} — classified under ${theme.classification}. Origin: ${theme.origin}.`,
    `Rare documentation of ${subject}${suffix}, one of the most sought-after specimens in the ${theme.label} collection.`,
    `Field observation of ${subject}${suffix} — ${theme.classification}, ${theme.origin}.`,
    `The ${sub.name.toLowerCase()} ${subject}${suffix}, a remarkable example of ${theme.classification}.`,
  ];
  const desc = pick(cr, descTemplates);
  const rarity = tier.name === 'Legendary' ? 'Legendary Discovery' :
    tier.name === 'Superstar' ? 'One-of-a-Kind' :
    tier.name === 'Star' ? 'Rare Specimen' :
    tier.name === 'Uncommon' ? 'Rare Specimen' : 'Common Find';
  const stats = {
    power: ri(cr, tier.st[0], tier.st[1]),
    speed: ri(cr, tier.st[0], tier.st[1]),
    technique: ri(cr, tier.st[0], tier.st[1]),
    endurance: ri(cr, tier.st[0], tier.st[1]),
    charisma: ri(cr, tier.st[0], tier.st[1]),
  };
  return {
    num: String(num).padStart(3,'0'), name: displayName, subset: sub.name, starTier: tier.name,
    stats, desc, basePrice: tier.pr[0] + cr() * (tier.pr[1] - tier.pr[0]),
    classification: theme.classification, origin: theme.origin, rarity, theme: theme.label,
  };
}

function genCard_Novelty(num, rng) {
  const baseSeed = normalizeSeed(rng);
  const cr = mulberry32(baseSeed + num*29 + 17);
  const tier = pwK(TIERS,'w',cr);
  const sub = pwK(resolveSubsets('novelty'),'w',cr);
  // Pick or generate a concept
  let concept;
  if (num <= NOVELTY_CONCEPTS.length) {
    concept = {...NOVELTY_CONCEPTS[num - 1]};
  } else {
    // Generate synthetic concepts for extra cards
    const cat = pick(cr, NOVELTY_CATEGORIES);
    concept = {
      name: pick(cr, ['The Great','The Last','The Final','The Ultimate','The Original','The Forgotten','The Hidden','The Infinite','The Absurd','The Eternal']) + ' ' +
        pick(cr, ['Debate','Conspiracy','Meme','Paradox','Theory','Legend','Hoax','Glitch','Loophole','Incident']),
      category: cat.id,
      desc: `A ${cat.label.toLowerCase()} concept that defies explanation and demands your attention.`,
    };
  }
  const viralityScore = tier.name === 'Legendary' ? ri(cr,90,99) :
    tier.name === 'Superstar' ? ri(cr,75,92) :
    tier.name === 'Star' ? ri(cr,55,78) :
    tier.name === 'Uncommon' ? ri(cr,30,58) : ri(cr,5,35);
  const stats = {
    power: ri(cr, tier.st[0], tier.st[1]),
    speed: ri(cr, tier.st[0], tier.st[1]),
    technique: ri(cr, tier.st[0], tier.st[1]),
    endurance: ri(cr, tier.st[0], tier.st[1]),
    charisma: viralityScore,
  };
  const catLabel = NOVELTY_CATEGORIES.find(c => c.id === concept.category)?.label || concept.category;
  const desc = `${concept.name} — ${catLabel}. ${concept.desc} Virality Score: ${viralityScore}/100.`;
  return {
    num: String(num).padStart(3,'0'), name: concept.name, subset: sub.name, starTier: tier.name,
    stats, desc, basePrice: tier.pr[0] + cr() * (tier.pr[1] - tier.pr[0]),
    noveltyCategory: catLabel, viralityScore,
  };
}

// Movie/TV: generate all at once since cards are sequential scenes
function generateMovieCards(totalCards, rng) {
  const baseSeed = normalizeSeed(rng);
  const cr = mulberry32(baseSeed);
  const genre = pick(cr, MOVIE_GENRES);
  const title = pick(cr, MOVIE_NAME_PARTS.adjectives) + ' ' + pick(cr, MOVIE_NAME_PARTS.nouns);
  // Generate characters
  const charPool = [];
  const charFirsts = ['Alex','Mara','Kai','Zara','Draven','Lena','Theo','Nova','Jax','Iris','Orion','Freya','Cassian','Sloane','Remy'];
  const charLasts = ['Voss','Sterling','Blackwell','Moreau','Sinclair','Kingsley','Ashford','Fontaine','Montague','Worthington','Pemberton','Hayworth','Vale','Lancaster','Calloway'];
  const charCount = ri(cr, 4, 8);
  for (let i = 0; i < charCount; i++) {
    charPool.push(pick(cr, charFirsts) + ' ' + pick(cr, charLasts));
  }
  // Generate plot synopsis
  const synopsis = `${title} — A ${genre.toLowerCase()} epic. When a discovery threatens to unravel the fabric of reality, ${charPool[0]} must journey ${pick(cr,['across the wasteland','through time','into the unknown','beyond the void','across dimensions'])} to ${pick(cr,['save everything they love','uncover the truth','prevent catastrophe','find redemption','face their greatest fear'])}.`;
  
  const cards = [];
  const chapters = ['Opening Act','Rising Action','Rising Action','Rising Action','Rising Action','Rising Action','Climax','Climax','Falling Action','Falling Action','Finale'];
  const sceneTitles = [
    'The Beginning','A Quiet Morning','Signs of Trouble','The Discovery','Crossroads',
    'Into the Unknown','The Alliance','Betrayal','The Chase','Hidden Truths',
    'The Reckoning','Point of No Return','Climactic Confrontation','The Sacrifice','Aftermath',
    'Reflections','New Dawn','The Departure','Echoes','End Credits',
  ];
  for (let i = 1; i <= totalCards; i++) {
    const cardRng = mulberry32(baseSeed + i * 37 + 5);
    const tier = pwK(TIERS,'w',cardRng);
    const chapterIdx = Math.min(Math.floor((i / totalCards) * chapters.length), chapters.length - 1);
    const chapter = chapters[chapterIdx];
    const sub = pwK(resolveSubsets('movie'),'w',cardRng);
    // Override subset based on chapter for movie coherence
    const movieSub = {name:chapter, w:1, m:1};
    const sceneTitle = (sceneTitles[(i-1) % sceneTitles.length]) + ' ' + (i > sceneTitles.length ? `(${i})` : '');
    const chars = [];
    const charCount2 = ri(cardRng, 1, 3);
    const shuffled = [...charPool].sort(() => cardRng() - 0.5);
    for (let c = 0; c < Math.min(charCount2, shuffled.length); c++) chars.push(shuffled[c]);
    const sceneDescs = [
      `${chars[0]} stands at the edge of everything they know.`,
      `A tense moment as ${chars.join(' and ')} face the unknown.`,
      `The world shifts. ${chars[0]} realizes nothing will be the same.`,
      `A quiet scene — ${chars[0]} reflects on what has been lost.`,
      `${chars[0]} takes a decisive step forward.`,
      `The stakes are raised. ${chars.join(' and ')} must act now.`,
      `A moment of levity before the storm. ${chars[0]} almost smiles.`,
      `Everything converges. ${chars.join(', ')} face their destiny.`,
      `The aftermath. Silence fills the space where ${chars[0]} once stood.`,
      `A new beginning emerges from the ashes of the old.`,
    ];
    const sceneDescription = pick(cardRng, sceneDescs);
    const desc = `${sceneTitle} — ${chapter}. ${sceneDescription}`;
    const stats = {
      power: ri(cardRng, tier.st[0], tier.st[1]),
      speed: ri(cardRng, tier.st[0], tier.st[1]),
      technique: ri(cardRng, tier.st[0], tier.st[1]),
      endurance: ri(cardRng, tier.st[0], tier.st[1]),
      charisma: ri(cardRng, tier.st[0], tier.st[1]),
    };
    cards.push({
      num: String(i).padStart(3,'0'), name: sceneTitle, subset: chapter, starTier: tier.name,
      stats, desc, basePrice: tier.pr[0] + cardRng() * (tier.pr[1] - tier.pr[0]),
      sceneTitle, sceneDescription, characters: chars, chapter,
      propertyName: title, propertyGenre: genre, propertySynopsis: synopsis,
    });
  }
  return {cards, title, genre, synopsis};
}

// TV is same structure but smaller card count
function generateTVCards(cardsPerSeason, seasons, rng) {
  const baseSeed = normalizeSeed(rng);
  const cr = mulberry32(baseSeed + 1);
  const genre = pick(cr, MOVIE_GENRES);
  const title = pick(cr, MOVIE_NAME_PARTS.nouns) + ' ' + pick(cr, ['Chronicles','Diaries','Tales','Files','Legends','Saga','Stories','Mysteries']);
  
  const charPool = [];
  const charFirsts = ['Alex','Mara','Kai','Zara','Draven','Lena','Theo','Nova','Jax','Iris'];
  const charLasts = ['Voss','Sterling','Blackwell','Moreau','Sinclair','Kingsley','Ashford','Fontaine','Montague','Worthington'];
  for (let i = 0; i < 10; i++) {
    charPool.push(pick(cr, charFirsts) + ' ' + pick(cr, charLasts));
  }
  
  const synopsis = `${title} — A ${genre.toLowerCase()} series spanning ${seasons} season${seasons>1?'s':''}.`;
  const allCards = [];
  
  for (let s = 1; s <= seasons; s++) {
    const seasonCards = generateMovieCards(cardsPerSeason, baseSeed + s * 1000);
    for (const c of seasonCards.cards) {
      c.num = String(allCards.length + 1).padStart(3, '0');
      c.season = s;
      c.propertyType = 'tv';
    }
    allCards.push(...seasonCards.cards);
  }
  
  return {cards: allCards, title, genre, synopsis, seasons, cardsPerSeason};
}

// ─── GENERATE SET BY CATEGORY ───────────────────────────────────

function generateSetByCategory(category, options = {}) {
  const seed = normalizeSeed(options.seed);
  const rng = mulberry32(seed);
  
  switch (category) {
    case 'sports': {
      const sportKey = options.sport || pick(rng, Object.keys(SPORTS));
      const cards = [];
      const cardCount = options.cards || 150;
      for (let i = 1; i <= cardCount; i++) {
        cards.push(genCard_Sports(i, seed, sportKey));
      }
      const sport = SPORTS[sportKey];
      return {
        setCategory: 'sports',
        setName: `${sport.label} ${new Date().getFullYear()}`,
        cards,
        sport: sportKey,
      };
    }
    case 'celebrity': {
      const cards = [];
      const cardCount = options.cards || 100;
      for (let i = 1; i <= cardCount; i++) {
        cards.push(genCard_Celebrity(i, seed));
      }
      return {
        setCategory: 'celebrity',
        setName: `Celebrity Legends Collection`,
        cards,
      };
    }
    case 'movie': {
      const cardCount = options.cards || 150;
      const result = generateMovieCards(cardCount, seed);
      return {
        setCategory: 'movie',
        setName: result.title,
        cards: result.cards,
        propertySynopsis: result.synopsis,
        propertyGenre: result.genre,
      };
    }
    case 'tv': {
      const cardsPerSeason = options.cardsPerSeason || 50;
      const seasons = options.seasons || 1;
      const result = generateTVCards(cardsPerSeason, seasons, seed);
      return {
        setCategory: 'tv',
        setName: result.title,
        cards: result.cards,
        propertySynopsis: result.synopsis,
        propertyGenre: result.genre,
        seasons: result.seasons,
        cardsPerSeason: result.cardsPerSeason,
      };
    }
    case 'collection': {
      const theme = options.theme || pick(rng, COLLECTION_THEMES);
      const themeId = typeof theme === 'string' ? theme : theme.id;
      const themeObj = COLLECTION_THEMES.find(t => t.id === themeId) || COLLECTION_THEMES[0];
      const cardCount = Math.min(options.cards || themeObj.subjects.length, themeObj.subjects.length + 10);
      const cards = [];
      for (let i = 1; i <= cardCount; i++) {
        cards.push(genCard_Collection(i, seed, themeId));
      }
      return {
        setCategory: 'collection',
        setName: `${themeObj.label} Collection`,
        cards,
        collectionTheme: themeId,
      };
    }
    case 'novelty': {
      const cardCount = options.cards || 100;
      const cards = [];
      for (let i = 1; i <= cardCount; i++) {
        cards.push(genCard_Novelty(i, seed));
      }
      return {
        setCategory: 'novelty',
        setName: `Meme & Culture Collection`,
        cards,
      };
    }
    default:
      return null;
  }
}

// ─── DISPLAY HELPERS ────────────────────────────────────────────

function fmtCardCategoryLine(card, setCategory) {
  const cat = setCategory || card.setCategory || 'character';
  switch (cat) {
    case 'sports':
      if (!card.team && !card.seasonStats) return '';
      const sportStats = card.seasonStats ? Object.entries(card.seasonStats).slice(0,5).map(([k,v]) => `${k}:${v}`).join(' ') : '';
      return `⚽ ${card.team} #${card.jerseyNumber || '?'} ${card.position || ''} │ ${sportStats}`;
    case 'celebrity':
      if (!card.profession) return '';
      return `🌟 ${card.profession} │ ${card.era || ''} │ Fame: ${card.fameScore || '?'}/100`;
    case 'movie':
    case 'tv':
      if (!card.sceneTitle) return '';
      const ch = card.chapter || '';
      const chars = (card.characters || []).join(', ');
      const seasonTag = card.season ? ` S${card.season}` : '';
      return `🎬 Ch:${ch}${seasonTag} │ ${chars ? chars + ' │ ' : ''}${(card.sceneDescription || '').slice(0, 60)}`;
    case 'collection':
      if (!card.classification) return '';
      return `🔬 ${card.classification} │ ${card.origin || ''} │ ${card.rarity || ''}`;
    case 'novelty':
      if (!card.noveltyCategory) return '';
      return `🤪 ${card.noveltyCategory} │ Virality: ${card.viralityScore || '?'}/100`;
    default:
      return '';
  }
}

// ─── AI PROMPT BUILDERS ─────────────────────────────────────────

function buildCategoryPrompt(category, options = {}) {
  const totalCards = options.cards || 150;
  
  switch (category) {
    case 'sports': {
      const sportKey = options.sport || 'basketball';
      const sport = SPORTS[sportKey];
      return `You are a sports card set designer. Generate a ${sport.label} card set with ${totalCards} unique player cards.

Each card object must have:
- "num": 3-digit string "001" through "${String(totalCards).padStart(3,'0')}"
- "name": Unique realistic player name (mix of backgrounds)
- "subset": One of: "Base", "Rookies", "All-Stars", "Legends", "Draft Picks", "Hall of Fame"
- "starTier": One of: "Common", "Uncommon", "Star", "Superstar", "Legendary"
- "desc": One sentence about the player and their season
- "stats": {"power","speed","technique","endurance","charisma"} ints (Common:40-75, Unc:50-80, Star:60-90, SS:70-95, Leg:80-98)
- "basePrice": float (Common:0.10-0.30, Unc:0.30-0.75, Star:0.75-1.50, SS:1.50-3.00, Leg:3.00-5.00)
- "team": One of these ${sport.label} teams: ${sport.teams.join(', ')}
- "position": One of these positions: ${sport.positions.join(', ')}
- "jerseyNumber": integer 1-99
- "seasonStats": object with these stats and realistic ranges: ${sport.stats.map(s => `"${s}": [${sport.statRanges[s][0]},${sport.statRanges[s][1]}]`).join(', ')}

Distribution: ~35% Base, ~20% Rookies, ~12% All-Stars, ~8% Legends, ~15% Draft Picks, ~10% Hall of Fame
Tier distribution: ~55% Common, ~18% Uncommon, ~14% Star, ~9% Superstar, ~4% Legendary

Return ONLY a JSON array of ${totalCards} card objects. No markdown.`;
    }
    case 'celebrity':
      return `You are a celebrity trading card designer. Generate ${totalCards} unique fictional celebrity cards.

Each card:
- "num": 3-digit string
- "name": Believable celebrity name (glamorous but fictional)
- "subset": "A-List", "Rising Star", "Icon", "Legend", or "Behind the Scenes"
- "starTier": "Common", "Uncommon", "Star", "Superstar", "Legendary"
- "desc": One sentence about this celebrity
- "stats": {"power","speed","technique","endurance","charisma"} ints, plus "fameScore": int 0-99
- "basePrice": float (same tier ranges as sports)
- "profession": one of: Actor, Actress, Musician, Director, Producer, Influencer, Artist, Comedian, Fashion Designer, Chef, Author, DJ, Dancer, Model, Singer-Songwriter, Talk Show Host, Streamer, Podcaster, Entrepreneur
- "era": one of: "1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"
- "notableWorks": array of 2-3 fictional works (movie titles, album names, brand partnerships, etc.)

Tier should correlate with fameScore: Legendary=90-99, Superstar=75-92, Star=55-78, Uncommon=30-58, Common=5-35

Return ONLY a JSON array. No markdown.`;
    case 'movie':
      return `You are a movie scene card designer. First, invent a fictional movie, then generate ${totalCards} scene cards that tell the story chronologically.

CRITICAL: Start your response with a JSON object (NOT array) containing the movie info and cards array:
{"movieTitle":"Your Movie Title","genre":"Genre","synopsis":"2-3 sentence synopsis","cards":[ ... ]}

The cards array must have EXACTLY ${totalCards} cards:
- "num": 3-digit string "001" through "${String(totalCards).padStart(3,'0')}" (chronological order)
- "name": Scene title (e.g. "The Discovery", "Crossroads", "Climactic Confrontation")
- "subset": One of: "Opening Act" (cards 1-${Math.floor(totalCards*0.15)}), "Rising Action" (cards ${Math.floor(totalCards*0.15)+1}-${Math.floor(totalCards*0.65)}), "Climax" (cards ${Math.floor(totalCards*0.65)+1}-${Math.floor(totalCards*0.80)}), "Falling Action" (cards ${Math.floor(totalCards*0.80)+1}-${Math.floor(totalCards*0.92)}), "Finale" (cards ${Math.floor(totalCards*0.92)+1}-${totalCards})
- "starTier": Climax=Legendary, key plot=Superstar/Star, atmosphere/atmosphere=Uncommon/Common
- "desc": Scene description with character names
- "stats": {"power","speed","technique","endurance","charisma"} ints
- "basePrice": float
- "sceneTitle": Same as name
- "sceneDescription": 1-2 sentence description of what happens in the scene
- "characters": array of 1-3 character names present in the scene
- "chapter": Same as subset
- "propertyName": The movie title

Create 4-8 named characters who appear across multiple cards. The cards should tell a complete story arc.

Return ONLY the JSON object with movieTitle, genre, synopsis, and cards array. No markdown.`;
    case 'tv':
      return `You are a TV show scene card designer. Invent a fictional TV show, then generate ${totalCards} scene cards.

CRITICAL: Start with a JSON object: {"showTitle":"Title","genre":"Genre","synopsis":"Synopsis","seasons":${options.seasons || 1},"cardsPerSeason":${options.cardsPerSeason || 50},"cards":[ ... ]}

Each card:
- "num": 3-digit string (chronological)
- "name": Scene title
- "subset": "Opening Act", "Rising Action", "Climax", "Falling Action", "Finale", "Character Spotlight", or "Key Moment"
- "starTier": Based on narrative importance
- "desc": Scene description
- "stats": {"power","speed","technique","endurance","charisma"} ints
- "basePrice": float
- "sceneTitle": Same as name
- "sceneDescription": Description
- "characters": array of character names
- "chapter": Same as subset
- "propertyName": Show title
- "season": Season number (1-based)
- "episode": Episode number within season

Return ONLY the JSON object. No markdown.`;
    case 'collection':
      return `You are a collection/nature trading card designer. Generate ${totalCards} specimen cards.

Each card:
- "num": 3-digit string
- "name": Subject/specimen name (real or realistic species/objects)
- "subset": "Common Find", "Rare Specimen", "Legendary Discovery", "One-of-a-Kind", or "Field Notes"
- "starTier": One-of-a-Kind=Legendary, Legendary Discovery=Superstar, Rare Specimen=Star/Uncommon, Common Find/Field Notes=Common
- "desc": Detailed description of the subject
- "stats": {"power","speed","technique","endurance","charisma"} ints
- "basePrice": float
- "classification": Scientific or categorical classification
- "origin": Geographic origin or era
- "rarity": "Common Find", "Rare Specimen", "Legendary Discovery", or "One-of-a-Kind"
- "theme": The collection theme name

Make subjects interesting and varied. Include real species names where possible.

Return ONLY a JSON array. No markdown.`;
    case 'novelty':
      return `You are a novelty/meme trading card designer. Generate ${totalCards} concept cards.

Each card:
- "num": 3-digit string
- "name": Concept name (witty, catchy)
- "subset": "Deep Fried", "Wholesome", "Brain Rot", "Classic Meme", "Theory", or "Legend"
- "starTier": Based on how iconic the concept is
- "desc": Description of the concept — be funny, absurd, or thought-provoking
- "stats": {"power","speed","technique","endurance","charisma":viralityScore} ints
- "basePrice": float
- "noveltyCategory": "Meme", "Philosophy", "Urban Legend", "Conspiracy Theory", "Absurd Concept", or "Internet Culture"
- "viralityScore": 0-99 (how viral/mainstream the concept is)

Mix real internet culture references with fictional absurd concepts. Be creative and funny.

Return ONLY a JSON array. No markdown.`;
    default:
      return null;
  }
}

// ─── PARSE CATEGORY-SPECIFIC CARDS FROM AI ──────────────────────

function parseCategoryCards(raw, category) {
  // For movie/TV, the response is an object with cards array
  let parsed;
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*\n?/,'').replace(/\n?```\s*$/,'');
  
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try extracting
    const match = cleaned.match(/\{[\s\S]*"cards"\s*:\s*\[/);
    if (match) {
      const start = cleaned.indexOf(match[0]);
      // Find the closing of the whole object
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < cleaned.length; i++) {
        const ch = cleaned[i];
        if (esc) { esc = false; continue; }
        if (ch === '\\') { esc = true; continue; }
        if (ch === '"') { inStr = !inStr; continue; }
        if (inStr) continue;
        if (ch === '{' || ch === '[') depth++;
        if (ch === '}' || ch === ']') { depth--; if (depth === 0) { parsed = JSON.parse(cleaned.substring(start, i + 1)); break; } }
      }
    }
    if (!parsed) throw new Error('Cannot parse AI response');
  }
  
  if ((category === 'movie' || category === 'tv') && !Array.isArray(parsed) && parsed.cards) {
    // Movie/TV: extract metadata and cards
    const meta = {
      propertySynopsis: parsed.synopsis || parsed.movieSynopsis || parsed.showSynopsis || '',
      propertyGenre: parsed.genre || 'Drama',
      propertyName: parsed.movieTitle || parsed.showTitle || parsed.title || 'Untitled',
      seasons: parsed.seasons || 1,
      cardsPerSeason: parsed.cardsPerSeason || null,
    };
    return { cards: parsed.cards, meta };
  }
  
  if (Array.isArray(parsed)) return { cards: parsed, meta: {} };
  if (parsed.cards && Array.isArray(parsed.cards)) return { cards: parsed.cards, meta: {} };
  
  throw new Error('Unexpected AI response format');
}

// ─── EXPORTS ────────────────────────────────────────────────────

module.exports = {
  SET_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_SUBSETS,
  CATEGORY_EMOJIS,
  SPORTS,
  COLLECTION_THEMES,
  NOVELTY_CATEGORIES,
  MOVIE_GENRES,
  SIZE_RANGES,
  
  resolveSubsets,
  generateSetByCategory,
  genCard_Sports,
  genCard_Celebrity,
  genCard_Collection,
  genCard_Novelty,
  generateMovieCards,
  generateTVCards,
  
  fmtCardCategoryLine,
  buildCategoryPrompt,
  parseCategoryCards,
  
  // Re-export helpers for card-engine
  mulberry32,
  ri,
  pick,
  pwK,
  TIERS,
};
