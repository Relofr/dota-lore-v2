export const locations = [
  {
    id: 'radiant-ancient',
    name: "The Radiant's Ancient",
    type: 'Sacred Site',
    region: 'The Battlefield',
    shortDescription:
      'The physical manifestation of the Radiant — a gleaming crystal formation pulsing with primordial energy.',
    description: `At the heart of the Radiant's territory lies the Ancient itself — a towering crystal formation of impossible geometry, pulsing with a light that seems to come from somewhere deeper than physics. It is warm to the touch and somehow aware, though it does not communicate in any language mortals understand. Those who stand near it for long periods report strange dreams and a growing certainty that something vast is paying attention. The Radiant does not need defenders; it draws them. Warriors who fight for it describe feeling a pull they cannot resist, a sense that this light must not be extinguished. Whether this is divine inspiration or something more coercive is a theological question that seldom gets answered.`,
    relatedHeroIds: [],
    relatedFactionIds: ['radiant'],
  },
  {
    id: 'dire-ancient',
    name: "The Dire's Ancient",
    type: 'Sacred Site',
    region: 'The Battlefield',
    shortDescription:
      'The physical manifestation of the Dire — a dark structure radiating entropy, drawing those who resonate with endings.',
    description: `Opposite the Radiant's crystal, at the far end of the same battlefield, sits the Dire's Ancient — a dark structure of angular stone that seems to absorb light rather than reflect it. The air around it is cooler. Things decay faster in its proximity. Animals avoid it. Those who serve it feel its pull differently than the Radiant's: not a warmth but an inevitability, the sense that all things end and that this ending is not to be feared but embraced. The Dire's Ancient is no less powerful than the Radiant's and no less alien. Their eternal standoff has created the battlefield between them — a contested space that has been fought over for longer than any civilization has existed.`,
    relatedHeroIds: [],
    relatedFactionIds: ['dire'],
  },
  {
    id: 'nightsilver-woods',
    name: 'The Nightsilver Woods',
    type: 'Enchanted Forest',
    region: 'Western Lands',
    shortDescription:
      "An ancient forest bathed in permanent moonlight — sacred to the Moon Goddess Selemene and home to her followers.",
    description: `The Nightsilver Woods are a vast, ancient forest where the moon never fully sets. Even at noon, the canopy filters sunlight into something silver and cool, and at night the woods glow with reflected moonlight from leaves that seem designed to catch and hold it. The forest is Selemene's earthly domain — her presence can be felt as a constant pressure, a divine awareness suffusing every shadow and silver-lit clearing. Mirana has called these woods home since she renounced her throne. The Dark Moon Order maintains its base here, training in the perpetual near-night of the canopy. Travelers who enter without permission sometimes fail to find their way back out.`,
    relatedHeroIds: ['mirana', 'luna'],
    relatedFactionIds: ['nightsilver-followers', 'dark-moon-order'],
  },
  {
    id: 'stonehall',
    name: 'Stonehall',
    type: 'City',
    region: 'Central Lands',
    shortDescription:
      'A great fortified city, seat of noble houses and political intrigue — and hunting ground for the Order of the Broken Blade.',
    description: `Stonehall is one of the great cities of the mortal world: old, wealthy, heavily fortified, and rotten with politics. It sits at the intersection of several major trade routes and has used that position to accumulate wealth and power over centuries. Several noble houses maintain their seats here, jockeying constantly for influence. The city's upper classes have a great deal of money and a pronounced tendency to make enemies. This makes Stonehall a frequent destination for the Order of the Broken Blade — divine contracts arrive regularly from its noble districts. The city's population maintains a studied unawareness of this fact. Acknowledging it would require them to think about who among their neighbors might have placed the last order.`,
    relatedHeroIds: ['phantom-assassin'],
    relatedFactionIds: ['order-of-the-broken-blade'],
  },
  {
    id: 'the-ultimyr-academy',
    name: 'The Ultimyr Academy',
    type: 'Institution',
    region: 'Central Lands',
    shortDescription:
      "The world's greatest school of magic — where Invoker once studied before outliving every teacher who dared instruct him.",
    description: `The Ultimyr Academy is the foremost institution of magical learning in the world. It has stood for centuries, training generations of mages in every discipline from elemental manipulation to spatial theory to theoretical cosmology. Its library is legendary and its faculty, at any given time, represents some of the most accomplished practitioners alive. Invoker (Carl) studied here at some point in his long history. He surpassed the faculty within years and left unsatisfied, searching for knowledge the Academy couldn't provide. His presence there is still discussed in hushed tones. The faculty prefers not to dwell on the implications of a student who simply outgrew everything they had to offer.`,
    relatedHeroIds: ['invoker'],
    relatedFactionIds: [],
  },
  {
    id: 'the-narrow-maze',
    name: 'The Narrow Maze',
    type: 'Spirit Realm',
    region: 'The Afterlife',
    shortDescription:
      'The labyrinthine realm of the dead — where souls wander after death, and Shadow Fiend hunts.',
    description: `The Narrow Maze is the name given to the afterlife — or at least to one of its aspects. It is a vast labyrinthine space that exists adjacent to the mortal world, populated by the souls of the dead who have not yet found their final destination, whatever that destination may be. It is not a pleasant place. The Maze is disorienting by design; souls wander through it, sometimes for ages, before finding the exit that leads to whatever comes next. Shadow Fiend (Nevermore) hunts within it, consuming souls before they can pass on. The Dead God of the Order of the Broken Blade is said to hold court somewhere in its deepest sections, though those who have looked for him there have not returned to report on his location.`,
    relatedHeroIds: ['shadow-fiend'],
    relatedFactionIds: ['order-of-the-broken-blade'],
  },
  {
    id: 'foulfell',
    name: 'Foulfell',
    type: 'Prison Realm',
    region: 'Hell-Planes',
    shortDescription:
      "A unique demonic prison where condemned demons are trapped with only their own reflection — Terrorblade's eons-long jail.",
    description: `Foulfell is the most unusual of the hell-planes: a prison realm designed not with iron bars or stone walls but with mirrors. Demons condemned to Foulfell are trapped in sealed chambers with nothing but their own reflections for eternity — the theory being that the most effective torture for a being of pure ego and ambition is to be denied everything except themselves. Terrorblade was imprisoned here after acquiring too much power too quickly and threatening the demonic hierarchy. He spent eons staring at himself. Rather than breaking him, the experience gave him time to thoroughly understand himself — and eventually, to merge with his reflection entirely, doubling his power. He escaped. The demons who imprisoned him did not expect this.`,
    relatedHeroIds: ['terrorblade'],
    relatedFactionIds: ['hellborn'],
  },
  {
    id: 'dragon-hold',
    name: 'Dragon Hold',
    type: 'Mountainous Territory',
    region: 'Eastern Mountains',
    shortDescription:
      "The mountainous homeland of the dragon-slaying Sunbreaker Order — where Davion made his fateful bargain with Slyrak.",
    description: `Dragon Hold is a range of jagged mountains that has been home to the Sunbreaker Order for generations. The mountains are riddled with caves and passes where dragons lair, and the Order maintains outposts throughout to monitor and respond to threats. It is a hard posting — cold, remote, and dangerous — but the knights who serve here are among the most capable fighters in the world, seasoned by repeated encounters with creatures of enormous power. It was somewhere in these mountains that Davion tracked the ancient dragon Slyrak to his final resting place. The cave where the merger happened has become a kind of unofficial shrine, though the surviving knights are divided on whether what happened there should be celebrated or mourned.`,
    relatedHeroIds: ['dragon-knight'],
    relatedFactionIds: ['sunbreaker-order'],
  },
  {
    id: 'the-icewrack',
    name: 'The Icewrack',
    type: 'Frozen Wasteland',
    region: 'Far North',
    shortDescription:
      "A realm of permanent winter in the far north — where Crystal Maiden was exiled to study, and came to feel at home.",
    description: `The Icewrack is a vast frozen expanse in the far north where winter is not a season but a permanent condition. Ice sheets extend to the horizon in every direction, and the sky during the brief periods of daylight is a pale grey that seems to absorb light rather than transmit it. The few beings who live here have adapted completely to the cold. Rylai (Crystal Maiden) was sent here by her family when her uncontrollable frost magic made her a liability elsewhere. She was, in theory, being exiled to a hardship posting. In practice, she found it was the only place where the air was cool enough that she wasn't constantly freezing everything around her. She considers it home. Her family considers this deeply ironic.`,
    relatedHeroIds: ['crystal-maiden'],
    relatedFactionIds: [],
  },
  {
    id: 'skywrath-citadel',
    name: 'The Skywrath Citadels',
    type: 'Floating City',
    region: 'Upper Atmosphere',
    shortDescription:
      'The great floating fortresses of the Skywrath civilization, drifting above the clouds where only the winged can reach.',
    description: `The Skywrath built their civilization in the sky — literally. Their citadels are enormous structures of stone and metal that float in the upper atmosphere through means that are part architectural, part magical, and part still unexplained. The citadels drift slowly on air currents and can be steered, to a degree, by their inhabitants. They are entirely inaccessible to anyone without wings, which is, from the Skywrath perspective, exactly the point. Skywrath society is organized within these citadels in a rigid hierarchy that treats altitude as status — the higher your quarters, the greater your standing. The High Skywrath rules from the very top. Shendelzare was stripped of her wings and cast down from these heights. The metaphor was not subtle.`,
    relatedHeroIds: ['vengeful-spirit', 'skywrath-mage'],
    relatedFactionIds: ['the-skywrath'],
  },
  {
    id: 'quoidge',
    name: 'Quoidge',
    type: 'Ruined City',
    region: 'Central Lands',
    shortDescription:
      "A once-great center of magical learning, now ruins — destroyed by a catastrophe that scholars still debate.",
    description: `Quoidge was once counted among the great city-states, famous throughout the world as a center of magical scholarship and philosophical inquiry. It is now a ruin. The catastrophe that destroyed it is a matter of historical debate: some scholars say it was a magical accident, some say it was divine judgment, some say something came through from outside the world and Quoidge was simply in the way. What remains are broken towers, cracked streets, and an abundance of magical residue that makes the ruins useful to researchers and dangerous to the careless. The Keeper of Light is said to have visited Quoidge at its height, though Ezalor's recollections of when things happened are not always reliable.`,
    relatedHeroIds: ['keeper-of-light'],
    relatedFactionIds: [],
  },
  {
    id: 'revtel',
    name: 'Revtel',
    type: 'City-State',
    region: 'Central Crossroads',
    shortDescription:
      'An independent merchant city at the crossroads of the world — wealthy, pragmatic, and loyal to whoever is paying.',
    description: `Revtel sits at the intersection of the world's major trade routes and has parlayed that geographic advantage into enormous wealth and steadfast political independence. The city maintains no permanent military alliances and pledges fealty to no king, god, or Ancient — it is loyal, in the final accounting, to commerce. Revtel is perhaps the most cosmopolitan city in the world; beings of every race and origin pass through it regularly, and the city's inhabitants have developed a practiced indifference to the unusual that serves them well. Transactions here are conducted with scrupulous honesty, because Revtel's reputation for fair dealing is the foundation of its prosperity, and the merchants who run the city are not about to sacrifice long-term income for short-term gain.`,
    relatedHeroIds: [],
    relatedFactionIds: [],
  },
]

export function getLocationById(id) {
  return locations.find((l) => l.id === id) || null
}

export function getLocationsByType(type) {
  return locations.filter((l) => l.type === type)
}

export function getLocationsByRegion(region) {
  return locations.filter((l) => l.region === region)
}
