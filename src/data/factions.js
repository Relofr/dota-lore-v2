export const factions = [
  {
    id: 'radiant',
    name: 'The Radiant',
    type: 'Ancient',
    alignment: 'light',
    shortDescription:
      'The Ancient of creation — a primordial force of light and generation locked in eternal war with the Dire.',
    description: `The Radiant is one of the two Ancients, primordial entities whose conflict has defined the world since before mortal memory. It is a force of light, growth, and creation — not benevolent in any human sense, but oriented toward generation and expansion. The Radiant does not think or speak as mortals do; it exerts a pull, a gravitational influence on those attuned to its nature. Warriors, scholars, and creatures of many kinds have found themselves drawn to its side, fighting in wars they did not choose for reasons they cannot fully articulate. The Radiant's physical manifestation is a gleaming crystal formation at the heart of the battlefield, pulsing with ancient energy. It has fought the Dire since before the current age, and will continue to fight it long after the current age ends.`,
    memberIds: [],
    relatedFactionIds: ['dire'],
    locationId: 'radiant-ancient',
  },
  {
    id: 'dire',
    name: 'The Dire',
    type: 'Ancient',
    alignment: 'dark',
    shortDescription:
      'The Ancient of destruction — the primordial force of entropy and unmaking, twin opponent to the Radiant since before time.',
    description: `The Dire is the counterpart Ancient to the Radiant, embodying entropy, destruction, and unmaking. Like the Radiant, it is not evil in a conscious sense — it is a force, as fundamental and amoral as gravity. It exerts its pull on beings drawn to darkness, chaos, and endings. The Dire's influence feels like inevitability: all things must end, all structures must fall, all light must be consumed. Warriors who serve the Dire are not necessarily cruel; many are simply people who resonate with the principle of entropy and have stopped fighting it. The Dire's Ancient sits at the opposite end of the battlefield from the Radiant's, a dark mirror to its light. Their conflict is the oldest war in the world, and neither side has ever achieved permanent victory.`,
    memberIds: [],
    relatedFactionIds: ['radiant'],
    locationId: 'dire-ancient',
  },
  {
    id: 'the-fundamentals',
    name: 'The Fundamentals',
    type: 'Cosmic Entities',
    alignment: 'neutral',
    shortDescription:
      'Primordial beings embodying the basic forces of existence — older than the Ancients, servants of no master.',
    description: `The Fundamentals are entities that embody the primal forces upon which existence is built: light, chaos, gravity, entropy, and the connective force that holds all things together. They existed before the Ancients and will exist after them. They are not allied with either side in the Ancient war, following their own inscrutable agendas across scales of time and space that dwarf mortal comprehension. Keeper of Light (Ezalor) embodies knowledge and illumination. Chaos Knight (Zharvakko) embodies randomness and disorder. Enigma embodies gravity and dark energy. Io is the binding force, the connective thread between all things. These beings occasionally descend to participate in mortal conflicts, though their reasons for doing so are seldom fully understood.`,
    memberIds: ['keeper_of_the_light', 'chaos_knight', 'enigma', 'io'],
    relatedFactionIds: ['radiant', 'dire'],
    locationId: null,
  },
  {
    id: 'sunbreaker-order',
    name: 'The Sunbreaker Order',
    type: 'Knightly Order',
    alignment: 'neutral',
    shortDescription:
      'A brotherhood of knights sworn to hunt and slay dragons — and the organization that shaped Dragon Knight.',
    description: `The Sunbreaker Order is a chivalric brotherhood with a singular purpose: the hunting and slaying of dragons. Dragons are ancient, powerful, and destructive, and the Order has dedicated generations of knights to the task of keeping their numbers in check. Initiates spend years learning to track, identify, and fight the great serpents. Full knights are among the most formidable warriors in the world, hardened by encounters with creatures that most people never survive meeting. Davion of Dragon Hold was one of their best — until his merger with the dragon Slyrak complicated his relationship with the Order's founding mandate. The other knights are still working out how they feel about having a half-dragon brother.`,
    memberIds: ['dragon_knight'],
    relatedFactionIds: [],
    locationId: 'dragon-hold',
  },
  {
    id: 'order-of-the-broken-blade',
    name: 'Order of the Broken Blade',
    type: 'Religious Assassin Cult',
    alignment: 'neutral',
    shortDescription:
      'A secretive cult devoted to a Dead God, whose agents deliver death as a divine mercy.',
    description: `The Order of the Broken Blade is a religious organization devoted to a god who died — or perhaps who never existed in a form that mortals could verify. Their doctrine holds that death is not punishment but mercy: a compassionate release from the suffering of existence. The Order accepts contracts to kill, framing each assassination as a divine gift to the recipient. Members surrender their identities entirely upon joining. They take new names, cover their faces, and cease to have any existence outside their sacred work. The Order's agents are among the most skilled killers in the world, trained from childhood to strike with perfect precision from perfect concealment. Phantom Assassin (Mortred) represents the pinnacle of what the Order produces.`,
    memberIds: ['phantom_assassin'],
    relatedFactionIds: [],
    locationId: 'stonehall',
  },
  {
    id: 'dark-moon-order',
    name: 'The Dark Moon Order',
    type: 'Religious Military Order',
    alignment: 'light',
    shortDescription:
      "The militant arm of the Moon Goddess Selemene, led by Luna and rival to Mirana's devotion.",
    description: `The Dark Moon Order is the martial force that enforces the will of the Moon Goddess Selemene across the mortal world. Founded generations ago, the Order recruits warriors of exceptional ability and dedicates them entirely to Selemene's service. Members are trained in mounted combat, night tactics, and the channeling of lunar energy through their weapons. Luna rose from street orphan to the Order's commander through sheer ferocity and devotion. The Order and Mirana — Selemene's other great champion — maintain an uneasy relationship. In theory they serve the same goddess. In practice they disagree constantly about what that goddess wants. Selemene watches from above and says nothing helpful.`,
    memberIds: ['luna'],
    relatedFactionIds: ['nightsilver-followers'],
    locationId: 'nightsilver-woods',
  },
  {
    id: 'nightsilver-followers',
    name: "Selemene's Followers",
    type: 'Religious Following',
    alignment: 'light',
    shortDescription:
      'Devotees of the Moon Goddess Selemene, centered in the Nightsilver Woods and led in spirit by Mirana.',
    description: `The followers of Selemene revere the Moon Goddess as a divine being of celestial power, beauty, and mystery. Their spiritual home is the Nightsilver Woods, an ancient forest bathed in permanent moonlight that serves as Selemene's earthly domain. Mirana, a princess who renounced her throne, is their most famous and devoted champion. Selemene's followers are not an organized military force in the way the Dark Moon Order is — they are a loose spiritual community united by faith. Their goddess is powerful but also mercurial; her favor is valuable and she grants it unpredictably. Both Mirana and Luna believe themselves her truest servant. Both might be right. Both might be wrong.`,
    memberIds: ['mirana', 'marci'],
    relatedFactionIds: ['dark-moon-order'],
    locationId: 'nightsilver-woods',
  },
  {
    id: 'the-skywrath',
    name: 'The Skywrath',
    type: 'Winged Civilization',
    alignment: 'neutral',
    shortDescription:
      'A proud civilization of winged nobles who dwell in floating citadels above the clouds, obsessed with bloodline and power.',
    description: `The Skywrath are a race of winged beings who built their civilization in the sky, constructing great floating citadels that drift through the upper atmosphere. They are proud beyond all reason, obsessed with bloodlines and lineage, and governed by a rigid hierarchy in which one's wings are both literal and symbolic of one's worth. To lose your wings among the Skywrath is to lose everything. Their magic is electrical, channeled through their wings and expressed as devastating arcs of lightning. Skywrath society is deeply political and viciously competitive; conspiracy and betrayal are as common as courtesy. The conflict between Shendelzare (Vengeful Spirit) and her sibling Dragonus (Skywrath Mage) is simply a particularly dramatic example of how the Skywrath conduct their family business.`,
    memberIds: ['vengefulspirit', 'skywrath_mage', 'winter_wyvern'],
    relatedFactionIds: [],
    locationId: 'skywrath-citadel',
  },
  {
    id: 'the-oglodi',
    name: 'The Oglodi',
    type: 'Warrior Race',
    alignment: 'neutral',
    shortDescription:
      'A fierce warrior race from the eastern steppes, organized entirely around martial hierarchy and the principle of personal strength.',
    description: `The Oglodi are a race of powerful warriors from the eastern steppes, identifiable by their reddish skin, enormous physical stature, and absolute cultural commitment to martial excellence. Their social hierarchy is determined entirely by combat prowess; rank is taken by force and held by force. Political philosophy, economic theory, and artistic sensibility are viewed by the Oglodi as interesting hobbies for people who have given up on real achievement. Mogul Khan (Axe) is their most famous — and most aggressively self-promoting — figure, though his method of achieving his generalship (killing everyone above him in the chain of command) is considered somewhat extreme even by Oglodi standards. Most Oglodi are impressed anyway.`,
    memberIds: ['axe', 'batrider', 'disruptor'],
    relatedFactionIds: [],
    locationId: null,
  },
  {
    id: 'the-keen-folk',
    name: 'The Keen Folk',
    type: 'Technical Civilization',
    alignment: 'neutral',
    shortDescription:
      'A diminutive race of brilliant engineers who solve with clockwork and steam what others solve with magic.',
    description: `The Keen Folk are a race of small-statured beings renowned across the world for their extraordinary technical ingenuity. Where other civilizations developed magic, the Keen built machines. Their cities run on steam and clockwork, their weapons fire bullets rather than spells, and their solutions to any problem begin with "what can we build?" rather than "what can we conjure?" The Keen have produced some of the world's most formidable inventors — and some of its most capable fighters, since a clockwork rifle at range is every bit as dangerous as a fireball. Tinker, Sniper, and Bounty Hunter are among the Keen Folk who have made their mark on the broader world, each in very different ways.`,
    memberIds: ['bounty_hunter', 'rattletrap', 'gyrocopter', 'sniper', 'techies', 'shredder', 'tinker'],
    relatedFactionIds: [],
    locationId: null,
  },
  {
    id: 'the-naga',
    name: 'The Naga',
    type: 'Ancient Civilization',
    alignment: 'neutral',
    shortDescription:
      "An ancient serpentine civilization dwelling beneath the world's seas, with powerful magic tied to water and sound.",
    description: `The Naga built their civilization beneath the oceans of the world, in a vast empire of coral towers and deep-sea palaces that most surface-dwellers have never seen and never will. They are ancient — far older than most mortal civilizations — and their accumulated knowledge of the sea, of sound, and of ancient history is vast. Naga society is organized around a matriarchal imperial structure, with an empress at its center whose word is absolute law. They are not isolationist by nature, but they engage with the surface world on their own terms and their own schedule. Slithice (Naga Siren) serves as the empire's current emissary to the surface, though she has been on extended assignment for longer than the empress originally intended.`,
    memberIds: ['naga_siren'],
    relatedFactionIds: [],
    locationId: null,
  },
  {
    id: 'hellborn',
    name: 'The Hellborn',
    type: 'Demonic Assembly',
    alignment: 'dark',
    shortDescription:
      'Lords and creatures of the hell-planes, under the dominion of Lucifer — the demon who fell from the heavens.',
    description: `The Hellborn are the denizens of the hell-planes — a sprawling network of infernal dimensions populated by demons of every variety. They are not an organized army so much as a collection of powerful entities who operate under a loose hierarchy maintained through constant displays of strength. Lucifer, who fell from the heavens and conquered the hell-planes by force, rules as Doom over the greatest of the infernal kingdoms. Below him are lesser lords, demons, and creatures of darkness in endless feuding arrangements. The Hellborn occasionally descend to the mortal plane when summoned, when the barriers between worlds weaken, or simply because a powerful demon decided to go for a walk and see what there was to kill.`,
    memberIds: ['doom_bringer'],
    relatedFactionIds: [],
    locationId: 'foulfell',
  },
  {
    id: 'flayed-twins',
    name: 'The Flayed Twins',
    type: 'Divine Cult',
    alignment: 'dark',
    shortDescription:
      'A pair of blood gods whose doctrine demands regular sacrifice — and whose hound, Strygwyr, enforces this demand across the world.',
    description: `The Flayed Twins are twin deities of blood and sacrifice, worshipped by those who believe that life requires the regular shedding of blood to continue. Their theology is straightforward: blood is the currency of divine favor, and it must flow. The cult that serves them is spread across the world, largely underground, conducting sacrificial rites that respectable society prefers not to acknowledge. The Twins themselves communicate through visions and compulsion, granting their most devoted servants supernatural abilities in exchange for total dedication. Strygwyr (Bloodseeker) is their finest instrument — a ritual hunter sent into the world to shed blood in their name, empowered by the blood of others, incapable of resting until his divine mandate is fulfilled.`,
    memberIds: ['bloodseeker'],
    relatedFactionIds: [],
    locationId: null,
  },
  {
    id: 'olympian-pantheon',
    name: 'The Olympian Pantheon',
    type: 'Divine Assembly',
    alignment: 'neutral',
    shortDescription:
      "Zeus's divine court — a gathering of gods now leaderless since their king descended to the mortal world.",
    description: `The Olympian Pantheon is the assembly of gods over which Zeus once presided as king. They are divine beings of great power, each embodying a domain of existence and wielding influence over it. Zeus claimed the throne by overthrowing his father, as his father had done before him, as the gods tend to do. When Zeus disguised himself as a mortal and descended to the battlefield, the Pantheon found itself without its king — and without any clear mechanism for selecting a new one, since the method typically involves overthrowing the old one and Zeus is no longer around to be overthrown. The other gods continue their divine work. Some are waiting for Zeus to come back. Others are quietly exploring their options.`,
    memberIds: ['zuus', 'mars'],
    relatedFactionIds: [],
    locationId: null,
  },
]

export function getFactionById(id) {
  return factions.find((f) => f.id === id) || null
}

export function getFactionsByAlignment(alignment) {
  return factions.filter((f) => f.alignment === alignment)
}
