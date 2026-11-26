// ---------------------------------------------------------------------------
// Deterministic catalog generator for "The Library".
//
//   node scripts/generate-catalog.mjs
//
// Produces src/data/catalog.json : exactly 3,000 lowercase titles (1..8 letters)
// with insertion IDs 0..2999. The output only depends on SEED, so it is the same
// on every machine and every run. (This is a BUILD-TIME tool: the app itself
// just reads the JSON file and never regenerates anything.)
// ---------------------------------------------------------------------------
import { mkdirSync, writeFileSync } from 'node:fs'

const SEED = 20240611
const TOTAL = 3000
const DUPLICATE_ENTRIES = 240

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
const words = (s) => s.split(/\s+/).filter(Boolean)

function valid(w) {
  if (w.length < 1 || w.length > 8) return false
  for (let i = 0; i < w.length; i++) {
    const c = w.charCodeAt(i)
    if (c < 97 || c > 122) return false
  }
  return true
}

const BLOCK = ['shit', 'fuck', 'cunt', 'cock', 'dick', 'piss', 'slut', 'twat', 'whor', 'rape', 'nigg', 'fag', 'tits', 'cum', 'dyke', 'homo', 'sex', 'porn', 'anus', 'nazi', 'kkk', 'pedo', 'fart', 'butt', 'boob', 'penis', 'vagin']
const clean = (w) => {
  for (const b of BLOCK) if (w.indexOf(b) !== -1) return false
  return true
}

// ---------------------------------------------------------------------------
// 1. Planted families: guarantee interesting prefix / suffix scenarios
// ---------------------------------------------------------------------------
const PLANTED = words(`
  cat cats catnap catfish catdog catalog cattle catgut catwalk catcall catkin catbird category catbell catfog catlog catbog catspaw catnip catlike catboat catsup catmint
  dog log fog bog hog jog cog blog frog smog snog clog slog hotdog bulldog watchdog hedgehog prolog epilog dialog analog monolog underdog sundog sheepdog
  star starfish starch stark start starve starling stardust starlit starry starter starship stargaze
  sun sunday sunbeam sunburn sundial sundown sunfish sunlit sunrise sunset sunroom sunspot sunlight sunshine sunbird
  moon moonlit moonbeam moonrise moonwalk moonshot moonbow
  book bookend bookworm bookmark booklet bookcase bookshop bookish bookman
  bright might night right sight tight fight flight light slight knight delight midnight twilight daylight eyesight gaslight tonight upright outright
  ring king wing sing bring spring string swing sting thing morning evening reading writing singing painting
  look cook hook nook brook crook textbook notebook outlook
  ark bark dark lark mark park shark spark stark skylark landmark
  paper pager pacer panther parser pastor paddler patter
  stone slate shade snake spare spice stage state store stove style slope smile scale shape share shore shine
  clock crack creek check chalk chick chunk cloak climb
  echo echo echo river river river
  a i o x z q ok oh ox up us go be do me we he it on at an as by if in is my no or so to hi ah aw ax ex ma pa yo ye ay
`)

// ---------------------------------------------------------------------------
// 2. Curated titles
// ---------------------------------------------------------------------------
const CURATED = words(`
  river ocean forest meadow valley canyon desert island harbor breeze storm cloud thunder rainbow sunrise sunset autumn winter spring summer garden flower petal willow cedar maple birch aspen orchid lotus clover thistle bramble fern moss ivy reed lily rose daisy tulip violet poppy jasmine lavender ember flame spark ash cinder blaze
  lantern candle mirror window door key lock chain bridge tower castle temple palace cabin cottage barn mill forge anvil hammer sword shield arrow bow dagger crown throne scepter jewel pearl amber ruby opal jade onyx topaz coral ivory silver copper bronze iron steel gold
  dragon phoenix griffin unicorn wolf fox bear hawk eagle raven crow owl swan heron falcon sparrow robin finch wren lark tiger lion panther cougar lynx otter badger beaver rabbit hare deer stag moose bison horse pony mule camel llama whale shark dolphin seal turtle frog toad newt snake viper cobra lizard gecko spider beetle moth bee wasp ant cricket
  wonder mystery secret legend myth fable story tale poem verse song hymn ballad riddle puzzle dream memory echo shadow whisper silence journey voyage quest odyssey escape return arrival exile honor glory valor courage wisdom truth justice mercy faith hope fear anger grief joy peace chaos order fate destiny fortune luck
  hamlet macbeth othello dracula rebecca matilda ivanhoe walden dune emma lolita beloved carrie heidi oliver ulysses persuade kim candide nana
  atlas almanac archive index folio tome scroll codex ledger journal diary primer manual guide digest annals records
  paper ink quill pen page cover spine binder leaflet pamphlet booklet novel essay memoir sonnet saga epic ode haiku
  crimson scarlet azure indigo violet amber ochre sepia ebony ivory pale bright dark golden silent hidden lost forgotten distant ancient eternal endless broken hollow frozen burning sacred wicked gentle fierce humble noble rare
  london paris rome venice athens cairo delhi tokyo berlin vienna prague lisbon dublin oslo bern lima quito
  atom comet planet galaxy nebula orbit quasar pulsar meteor eclipse cosmos lunar solar stellar gravity photon proton neutron quark prism lens optics
  bread honey butter cheese apple pear plum cherry lemon olive grape peach mango berry salt pepper sugar spice cocoa coffee tea wine cider
  clock watch compass map chart globe train ship boat sail anchor wheel engine robot rocket signal circuit pixel cipher code logic proof theory axiom
  alpha beta gamma delta sigma omega zenith nadir vertex vector matrix tensor kernel buffer socket thread stack queue heap graph tree trie node leaf root branch
  market street avenue alley lane road path trail gate wall roof floor stair hall room attic cellar tunnel cave grotto cavern ravine cliff ridge summit peak crest dune oasis lagoon bay cove reef shoal tide wave surf
  knight bishop rook pawn queen king jester bard monk nun sage seer witch wizard mage druid ranger rogue thief pirate sailor captain admiral general soldier guard scout
  velvet silk linen cotton wool denim satin lace leather suede feather fur scale shell horn tusk claw fang talon wing
  morning noon dusk dawn midnight twilight daybreak nightfall evening
  hush murmur rumble clatter jingle chime toll bell gong drum flute harp lute lyre organ piano violin cello oboe tuba horn
  magic spell charm curse omen rune sigil glyph relic totem amulet talisman potion elixir tonic brew
  ghost spirit spectre phantom wraith specter golem giant dwarf elf imp troll ogre goblin fairy pixie sprite nymph satyr
  autumnal vernal winter frosty snowy rainy windy sunny cloudy misty foggy stormy
  anchor bastion citadel fortress keep moat rampart bailey turret spire dome arch pillar column vault crypt chapel abbey priory cloister
  carpenter? weaver tailor baker brewer miller potter smith mason cooper tanner fisher hunter farmer herder shepherd
`).filter((w) => valid(w))

// ---------------------------------------------------------------------------
// 3. Real-ish compounds + generated compounds
// ---------------------------------------------------------------------------
const COMPOUNDS = words(`
  skyline firefly icecap snowfall windmill seashell sandbox rockslide stonewall woodland treetop oakwood pinecone rosebud goldfish ironclad saltwater dustbin
  mistwood foghorn dewdrop frostbit cloudy stormcow tidepool wavelet surfboard reefshark hilltop dalesman glenfall moorland fenland lakeside pondweed brookside creekbed
  bookworm pagelike wordplay lineage notebook songbird talespin runestone spellbind charmer ghostly witchery elfland kingdom queenly lordship ladybug monkfish bardic
  redwood bluebell greenery blackbird whitecap graylag pinkish goldrush brownish nightfall daybreak dawnlit duskfall noonday darkling lightning shadowy glowworm gleaming
  sparkle flashing blazing embers ashfall coalmine catfish dogfish fishbowl birdbath beehive anthill foxglove wolfsbane bearskin lionheart hawkeye crowfoot owlet duckling
  goosebump swanlike henhouse cowbell pigpen ramrod bullfrog stagecoach deerskin harebell molehill ratrace batwing toadflax frogspawn earthworm bugbear flytrap mothball
  cartwheel shipwreck boatman sailboat mainmast oarlock keelhaul homeland household roomful hallway doorknob gateway wallflower rooftop floorboard yardstick farmland
  fieldmice barnyard millstone portrait bridgeway roadside pathway trailer wayside streetcar handbook footnote headline eyelash earring nosebleed heartbeat bonfire
  bloodline skinflint hairpin backbone topsoil bottomed sidewalk moonstone starlight sunflower rainfall snowdrop windfall seaside sandcastle rockface stonework
  wildfire campfire firewood icebound snowman rainwater windsock seaweed sandman rockfall stoneman woodcut leafmold treeline oakleaf pinewood roseleaf
  bedtime bedroom bathtub bedpost blueprint boxcar broadway buttercup campsite cardboard cornfield cupboard daydream doorbell downtown dragonfly driftwood
  eggshell evergreen eyebrow fairway farewell fireside flagpole flashbulb footprint gatepost grassland gunpowder hailstone hairbrush handmade headband heartland
  homemade honeybee horseman housefly inkwell jellyfish keyboard kingfish landfall lifeline lighthouse lookout mailbox mainland marketing masterpiece
  moonlight nightcap nutshell oatmeal outcast outdoors overcoat paintbox pancake passport peacock pineapple playground pocketknife quicksand rainbow raincoat
  riverbed rowboat sailor scarecrow seafood shipmate shoelace shortcut skylark snowflake songbook spacecraft springtime steamboat storybook sunburst sweetheart
  tablecloth tailwind teacup thunderclap tidewater timeline toolbox topsail turnpike underdog upstream vineyard wardrobe watchtower waterfall weekend whirlpool
  wildcat windpipe wishbone workshop wristwatch
`).filter((w) => valid(w))

const SHORT = words(`
  sun moon star sky fire ice snow rain wind sea sand rock stone wood leaf tree oak pine rose gold iron salt dust mist fog dew frost cloud storm tide wave surf reef cove bay hill dale glen moor fen bog lake pond brook creek spring well book page word line note song tale rune spell charm ghost witch elf imp orc king queen lord lady monk nun bard fool jack jill red blue green black white gray pink brown night day dawn dusk noon dark light shade glow gleam shine spark flash blaze ember ash coal cat dog fish bird bee ant fox wolf bear lion hawk crow owl duck goose swan hen cow pig ram bull stag deer hare mole rat bat toad frog worm bug fly moth car cart ship boat sail mast oar keel home house room hall door gate wall roof floor yard farm field barn mill port road path trail way hand foot head eye ear nose heart bone blood skin hair back top side tip tap pop pot pan pin pen peg bag bed box cup cap hat jar jug key lid mug net nut rag rug sac tin tub van
`)

// ---------------------------------------------------------------------------
// 4. Pseudo-word generator (syllable based, deterministic)
// ---------------------------------------------------------------------------
const ONSETS = ['b', 'br', 'c', 'ch', 'cl', 'cr', 'd', 'dr', 'f', 'fl', 'fr', 'g', 'gl', 'gr', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'pl', 'pr', 'r', 's', 'sh', 'sl', 'sn', 'sp', 'st', 'sw', 't', 'th', 'tr', 'v', 'w', 'z', '', '', 'qu']
const VOWELS = ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'i', 'o', 'ai', 'ea', 'io', 'oo', 'ou', 'ie', 'oa']
const CODAS = ['', '', '', 'n', 'r', 'l', 's', 't', 'm', 'nd', 'rk', 'st', 'x', 'th', 'ng', 'ck', 'rn', 'lt', 'ss', 'g', 'k', 'p', 'd']
function pseudo() {
  const syllables = 1 + Math.floor(rand() * 3)
  let w = ''
  for (let i = 0; i < syllables; i++) w += pick(ONSETS) + pick(VOWELS) + (i === syllables - 1 ? pick(CODAS) : rand() < 0.3 ? pick(CODAS) : '')
  return w
}

// ---------------------------------------------------------------------------
// 5. Assemble
// ---------------------------------------------------------------------------
const seen = new Set()
const base = []
function add(w) {
  if (!valid(w) || seen.has(w)) return false
  seen.add(w)
  base.push(w)
  return true
}
for (const w of PLANTED) add(w)
for (const w of CURATED) add(w)
for (const w of COMPOUNDS) add(w)

// generated compounds
let guard = 0
let generatedCompounds = 0
while (generatedCompounds < 420 && guard++ < 20000) {
  const a = pick(SHORT)
  const b = pick(SHORT)
  const w = a + b
  if (a !== b && valid(w) && clean(w) && add(w)) generatedCompounds++
}

const uniqueTarget = TOTAL - DUPLICATE_ENTRIES
guard = 0
while (base.length < uniqueTarget && guard++ < 200000) {
  const w = pseudo()
  if (w.length >= 2 && clean(w)) add(w)
}
if (base.length !== uniqueTarget) throw new Error('could not reach unique target: ' + base.length)

// deliberate duplicates (same title, different IDs)
const dups = []
for (const w of words('echo echo river river river star star moon moon book book book cat cat dog dog a a a i i light light stone night night sunrise')) {
  if (seen.has(w)) dups.push(w)
}
while (dups.length < DUPLICATE_ENTRIES) dups.push(pick(base))

const all = base.concat(dups)
if (all.length !== TOTAL) throw new Error('bad total ' + all.length)

// deterministic Fisher-Yates shuffle
for (let i = all.length - 1; i > 0; i--) {
  const j = Math.floor(rand() * (i + 1))
  const tmp = all[i]
  all[i] = all[j]
  all[j] = tmp
}

// ---------------------------------------------------------------------------
// 6. Curate the flagship scenario: prefix "cat" + suffix "og" -> several matches,
//    and "catdog" owns the LARGEST id (the answer of the largest-id rule).
// ---------------------------------------------------------------------------
function fits(w, p, s) {
  if (w.length < p.length || w.length < s.length) return false
  for (let i = 0; i < p.length; i++) if (w[i] !== p[i]) return false
  for (let i = 0; i < s.length; i++) if (w[w.length - s.length + i] !== s[i]) return false
  return true
}
let maxIdx = -1
for (let i = 0; i < all.length; i++) if (fits(all[i], 'cat', 'og')) maxIdx = i
const cd = all.indexOf('catdog')
if (cd !== maxIdx) {
  const t = all[cd]
  all[cd] = all[maxIdx]
  all[maxIdx] = t
}

// ---------------------------------------------------------------------------
// 7. Validate + write
// ---------------------------------------------------------------------------
for (let i = 0; i < all.length; i++) if (!valid(all[i])) throw new Error('invalid title at ' + i + ': ' + all[i])
const books = all.map((title, id) => ({ id, title }))
const lines = books.map((b) => '    ' + JSON.stringify(b))
const json = `{\n  "name": "The Library catalog",\n  "seed": ${SEED},\n  "count": ${books.length},\n  "books": [\n${lines.join(',\n')}\n  ]\n}\n`
mkdirSync('src/data', { recursive: true })
writeFileSync('src/data/catalog.json', json)

// report
const counts = new Map()
for (const w of all) counts.set(w, (counts.get(w) || 0) + 1)
let dupTitles = 0
let dupEntries = 0
for (const [, c] of counts) if (c > 1) { dupTitles++; dupEntries += c }
let minLen = 99
let maxLen = 0
for (const w of all) { if (w.length < minLen) minLen = w.length; if (w.length > maxLen) maxLen = w.length }
console.log(`books: ${books.length}  unique titles: ${counts.size}  duplicated titles: ${dupTitles} (${dupEntries} entries)  len ${minLen}..${maxLen}`)
function report(p, s) {
  let n = 0
  let best = -1
  for (let i = 0; i < all.length; i++) if (fits(all[i], p, s)) { n++; best = i }
  console.log(`  ${p || '*'} + ${s || '*'} -> matches ${n}, largest id ${best}${best >= 0 ? ' (' + all[best] + ')' : ''}`)
}
for (const [p, s] of [['cat', 'og'], ['star', 'ight'], ['sun', 'ight'], ['book', 'ark'], ['moon', 'it'], ['s', 'e'], ['b', 'k'], ['ec', 'ho'], ['th', 'ing'], ['pa', 'er'], ['st', 'ing'], ['zq', 'x'], ['dog', 'cat'], ['cat', 'zz'], ['wo', 'od'], ['fi', 'sh'], ['sh', 'ow'], ['ri', 'er'], ['sp', 'ng'], ['dr', 'on']]) report(p, s)
