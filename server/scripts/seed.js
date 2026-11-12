import '../config/env.js';
import mongoose from 'mongoose';
import cloudinary from '../config/cloudinary.js';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Post from '../models/Post.js';
import Reel from '../models/Reel.js';
import Follow from '../models/Follow.js';
import FollowRequest from '../models/FollowRequest.js';
import Like from '../models/Like.js';
import Comment from '../models/Comment.js';
import ReelLike from '../models/ReelLike.js';
import ReelComment from '../models/ReelComment.js';
import Story from '../models/Story.js';
import Conversation, { buildConversationPairKey } from '../models/Conversation.js';
import Message from '../models/Message.js';

const DEMO_PASSWORD = 'DemoUser@2026';

// Safeguard: Refuse to run in production unless explicitly permitted
const currentEnv = process.env.NODE_ENV || 'development';
if (currentEnv === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
  console.error(
    '[Seed] SAFETY GUARD: Demo seeding is blocked in production. Set NODE_ENV=development or ALLOW_DEMO_SEED=true to proceed.'
  );
  process.exit(1);
}

// 16 Realistic Fictional Demo Users (12 Public, 4 Private)
const DEMO_USERS = [
  {
    username: 'maya.lin',
    fullName: 'Maya Lin',
    email: 'maya.lin@instav2-demo.local',
    bio: 'Architectural designer & light chaser 🏛️\nExploring concrete, timber, and quiet spaces.',
    website: 'https://mayalin.studio',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80'
  },
  {
    username: 'alex.rivera',
    fullName: 'Alex Rivera',
    email: 'alex.rivera@instav2-demo.local',
    bio: 'Travel & landscape photographer 🌍\nCurrently chasing alpine sunrises.',
    website: 'https://alexrivera.photo',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80'
  },
  {
    username: 'liam.oconnor',
    fullName: "Liam O'Connor",
    email: 'liam.oconnor@instav2-demo.local',
    bio: 'Specialty coffee roaster & espresso nerd ☕\nDublin -> Melbourne.',
    website: '',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80'
  },
  {
    username: 'sophia.patel',
    fullName: 'Sophia Patel',
    email: 'sophia.patel@instav2-demo.local',
    bio: 'Systems engineer | Minimalist setups & mechanical keyboards 💻⌨️',
    website: 'https://sophiapatel.dev',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80'
  },
  {
    username: 'noah.kim',
    fullName: 'Noah Kim',
    email: 'noah.kim@instav2-demo.local',
    bio: 'Street & night photography in Seoul and Tokyo 🌃🎞️',
    website: '',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80'
  },
  {
    username: 'chloe.dubois',
    fullName: 'Chloe Dubois',
    email: 'chloe.dubois@instav2-demo.local',
    bio: 'Editorial stylist & vintage fashion archive 🧥✨\nPrivate journal.',
    website: '',
    isPrivate: true,
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&q=80'
  },
  {
    username: 'mateo.silva',
    fullName: 'Mateo Silva',
    email: 'mateo.silva@instav2-demo.local',
    bio: 'Ultra trail runner & strength coach 🏃‍♂️⛰️\nTraining at altitude.',
    website: '',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80'
  },
  {
    username: 'aria.nakamura',
    fullName: 'Aria Nakamura',
    email: 'aria.nakamura@instav2-demo.local',
    bio: 'Botanical illustrator & forest wanderer 🌿🎨',
    website: '',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80'
  },
  {
    username: 'omar.hassan',
    fullName: 'Omar Hassan',
    email: 'omar.hassan@instav2-demo.local',
    bio: 'Home chef, sourdough baker & spice collector 🍲🔥',
    website: 'https://omarscookbook.com',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80'
  },
  {
    username: 'elena.rostova',
    fullName: 'Elena Rostova',
    email: 'elena.rostova@instav2-demo.local',
    bio: 'Interior architecture & Scandinavian minimalism 🪑\nFriends & clients only.',
    website: '',
    isPrivate: true,
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80'
  },
  {
    username: 'lucas.berg',
    fullName: 'Lucas Berg',
    email: 'lucas.berg@instav2-demo.local',
    bio: 'Nordic wilderness & mountain cabin life 🏔️🔥',
    website: '',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&q=80'
  },
  {
    username: 'zara.mensah',
    fullName: 'Zara Mensah',
    email: 'zara.mensah@instav2-demo.local',
    bio: '35mm film portraits & visual storytelling 📸',
    website: '',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80'
  },
  {
    username: 'ethan.brooks',
    fullName: 'Ethan Brooks',
    email: 'ethan.brooks@instav2-demo.local',
    bio: 'Embedded hardware tinkerer & synth builder 🎛️⚡',
    website: '',
    isPrivate: true,
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80'
  },
  {
    username: 'nina.kowalski',
    fullName: 'Nina Kowalski',
    email: 'nina.kowalski@instav2-demo.local',
    bio: 'Wheel-thrown ceramics & slow weekend mornings 🏺☀️',
    website: '',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&q=80'
  },
  {
    username: 'devon.cole',
    fullName: 'Devon Cole',
    email: 'devon.cole@instav2-demo.local',
    bio: 'Fixed-gear cycling & architectural bridges 🚲🌉',
    website: '',
    isPrivate: false,
    avatarUrl: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80'
  },
  {
    username: 'priya.verma',
    fullName: 'Priya Verma',
    email: 'priya.verma@instav2-demo.local',
    bio: 'Mindful movement, yoga & plant-based living 🧘‍♀️🌱',
    website: '',
    isPrivate: true,
    avatarUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80'
  }
];

// 48 Diverse Demo Posts across 10 Categories
const DEMO_POSTS = [
  // Travel (5)
  { key: 'travel_yosemite', owner: 'alex.rivera', aspect: 'landscape', location: 'Yosemite Valley, CA', caption: 'First light hitting the granite valley walls. Worth waking up at 4:30 AM every single time. 🌄 #travel #yosemite', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1080&q=80' },
  { key: 'travel_highway', owner: 'alex.rivera', aspect: 'square', location: 'Big Sur, California', caption: 'Open roads and zero itinerary for the next three days. 🚐✨ #roadtrip #wanderlust', url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1080&q=80' },
  { key: 'travel_lake', owner: 'lucas.berg', aspect: 'landscape', location: 'Lago di Braies, Italy', caption: 'Glass-still water before the morning boats set out. 🚣‍♂️🏔️ #dolomites #travelphotography', url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1080&q=80' },
  { key: 'travel_kyoto', owner: 'noah.kim', aspect: 'portrait', location: 'Kyoto, Japan', caption: 'Lanterns glowing softly along the wooden alleys of Higashiyama. 🏮✨ #kyoto #japan', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1080&q=80' },
  { key: 'travel_coast', owner: 'alex.rivera', aspect: 'landscape', location: 'Amalfi Coast, Italy', caption: 'Salt in the air and endless turquoise horizons. 🌊☀️ #coastline #summer', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&q=80' },

  // Nature (5)
  { key: 'nature_redwoods', owner: 'aria.nakamura', aspect: 'portrait', location: 'Muir Woods, CA', caption: 'Sunbeams cutting through ancient redwood mist. 🌲🌿 #forest #naturelovers', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1080&q=80' },
  { key: 'nature_mist_ridge', owner: 'lucas.berg', aspect: 'landscape', location: 'Banff National Park', caption: 'Above the cloud inversion after a steep two-hour climb. ☁️⛰️ #mountains', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1080&q=80' },
  { key: 'nature_canopy', owner: 'aria.nakamura', aspect: 'square', location: 'Olympic Peninsula', caption: 'Emerald canopy after an early morning rain shower. 🍃💧 #wilderness', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1080&q=80' },
  { key: 'nature_peaks', owner: 'lucas.berg', aspect: 'landscape', location: 'Swiss Alps', caption: 'Jagged ridges catching the final pink alpenglow of the day. 🏔️ #alps', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&q=80' },
  { key: 'nature_highlands', owner: 'alex.rivera', aspect: 'landscape', location: 'Scottish Highlands', caption: 'Rolling emerald valleys as far as the lens can reach. 🌿🐑 #highlands', url: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1080&q=80' },

  // Architecture (5)
  { key: 'arch_glass_tower', owner: 'maya.lin', aspect: 'portrait', location: 'Chicago, IL', caption: 'Looking straight up into steel and sky geometry. 🏙️📐 #architecture #minimal', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1080&q=80' },
  { key: 'arch_interior_sun', owner: 'elena.rostova', aspect: 'square', location: 'Copenhagen, Denmark', caption: 'Warm oak textures and afternoon shadows across the living studio. 🪑☀️ #interiordesign', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1080&q=80' },
  { key: 'arch_modern_villa', owner: 'maya.lin', aspect: 'landscape', location: 'Palm Springs, CA', caption: 'Clean horizontal lines meeting desert light. 🏡✨ #modernarchitecture', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1080&q=80' },
  { key: 'arch_courtyard', owner: 'elena.rostova', aspect: 'landscape', location: 'Lisbon, Portugal', caption: 'Indoor-outdoor flow designed around natural cross-breezes. 🏛️🌿 #design', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1080&q=80' },
  { key: 'arch_brutalist', owner: 'maya.lin', aspect: 'portrait', location: 'Zurich, Switzerland', caption: 'Shadow play on raw architectural concrete. 🧱🖤 #brutalism', url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1080&q=80' },

  // Food (5)
  { key: 'food_feast', owner: 'omar.hassan', aspect: 'square', location: 'Brooklyn, NY', caption: 'Sunday table spread: roasted heirloom veggies, charred flatbread, and herb oil. 🍽️🔥 #homecooking', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1080&q=80' },
  { key: 'food_pour_over', owner: 'liam.oconnor', aspect: 'portrait', location: 'Melbourne, Australia', caption: 'Dialing in a washed Ethiopian single-origin at 93°C. Floral notes for days. ☕✨ #specialtycoffee', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1080&q=80' },
  { key: 'food_bistro', owner: 'omar.hassan', aspect: 'landscape', location: 'Lyon, France', caption: 'Late evening bistro glow and handmade pasta fresh off the board. 🍝🍷 #foodie', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1080&q=80' },
  { key: 'food_artisan_pizza', owner: 'omar.hassan', aspect: 'square', location: 'Naples, Italy', caption: '72-hour fermented sourdough crust blistered to perfection in 90 seconds. 🍕🔥 #sourdough', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1080&q=80' },
  { key: 'food_bowl', owner: 'priya.verma', aspect: 'portrait', location: 'Austin, TX', caption: 'Post-practice harvest bowl packed with greens, toasted seeds, and tahini dressing. 🥗🌱 #plantbased', url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=1080&q=80' },

  // Lifestyle (5)
  { key: 'life_golden_friends', owner: 'nina.kowalski', aspect: 'landscape', location: 'Warsaw, Poland', caption: 'Golden hour conversations that turn into lifelong memories. ✨🧡 #slowliving', url: 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=1080&q=80' },
  { key: 'life_studio_collab', owner: 'maya.lin', aspect: 'landscape', location: 'San Francisco, CA', caption: 'Brainstorming our next exhibition layout with the studio crew. 📝☕ #creatives', url: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1080&q=80' },
  { key: 'life_morning_latte', owner: 'liam.oconnor', aspect: 'square', location: 'Dublin, Ireland', caption: 'Velvety microfoam and quiet morning rituals before the roastery opens. ☕🌤️ #coffeetime', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1080&q=80' },
  { key: 'life_starry_camp', owner: 'lucas.berg', aspect: 'portrait', location: 'Lofoten, Norway', caption: 'Sleeping under a million stars in the Arctic circle. 🌌⛺ #camping', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1080&q=80' },
  { key: 'life_journal', owner: 'nina.kowalski', aspect: 'square', location: 'Krakow, Poland', caption: 'Sketchbooks, espresso, and unhurried Sunday mornings. 📓☕ #weekendvibes', url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=1080&q=80' },

  // Street Photography (5)
  { key: 'street_tokyo_neon', owner: 'noah.kim', aspect: 'portrait', location: 'Shinjuku, Tokyo', caption: 'Rain-slicked neon reflections after midnight in Shinjuku. 🌧️🏮 #streetphotography', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1080&q=80' },
  { key: 'street_skyline', owner: 'devon.cole', aspect: 'landscape', location: 'Manhattan, NY', caption: 'City grid waking up in golden haze. 🌇🚲 #nyc #urban', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1080&q=80' },
  { key: 'street_night_lights', owner: 'noah.kim', aspect: 'landscape', location: 'Seoul, South Korea', caption: 'Late-night crosswalk symmetry and blurred headlights. 📸🌃 #nightphotography', url: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1080&q=80' },
  { key: 'street_avenue', owner: 'devon.cole', aspect: 'square', location: 'Toronto, Canada', caption: 'Morning commute along the avenue on two wheels. 🚲🏙️ #citylife', url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1080&q=80' },
  { key: 'street_downtown', owner: 'noah.kim', aspect: 'portrait', location: 'Hong Kong', caption: 'Vertical neon corridors between towering apartment blocks. 🏙️🎞️ #hongkong', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1080&q=80' },

  // Technology (5)
  { key: 'tech_late_code', owner: 'sophia.patel', aspect: 'landscape', location: 'Seattle, WA', caption: 'Shipping clean distributed systems with zero distractions. 💻⚡ #softwareengineering', url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1080&q=80' },
  { key: 'tech_workspace', owner: 'sophia.patel', aspect: 'landscape', location: 'Seattle, WA', caption: 'Updated desk setup — less clutter, better focus. 🖥️🌿 #desksetup', url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1080&q=80' },
  { key: 'tech_retro_synth', owner: 'ethan.brooks', aspect: 'square', location: 'Berlin, Germany', caption: 'Weekend hardware build: custom analog filter module wired and tested. 🎛️🔧 #synth', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&q=80' },
  { key: 'tech_matrix', owner: 'sophia.patel', aspect: 'square', location: 'Remote', caption: 'Deep in performance profiling and query optimization tonight. 📊⚙️ #coding', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&q=80' },
  { key: 'tech_keyboard', owner: 'ethan.brooks', aspect: 'landscape', location: 'Berlin, Germany', caption: 'Lubed tactile switches + PBT keycaps = typing bliss. ⌨️✨ #mechanicalkeyboards', url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1080&q=80' },

  // Fashion (5)
  { key: 'fashion_rack', owner: 'chloe.dubois', aspect: 'square', location: 'Le Marais, Paris', caption: 'Curating neutral linen silhouettes for the autumn capsule. 🧥🤍 #parisianstyle', url: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1080&q=80' },
  { key: 'fashion_wardrobe', owner: 'chloe.dubois', aspect: 'landscape', location: 'Paris, France', caption: 'Timeless tailoring over fleeting trends. ✂️🖤 #fashioneditorial', url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1080&q=80' },
  { key: 'fashion_street_coat', owner: 'zara.mensah', aspect: 'portrait', location: 'London, UK', caption: 'Autumn textures and bold color blocking in Shoreditch. 🧣📸 #streetstyle', url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1080&q=80' },
  { key: 'fashion_editorial', owner: 'chloe.dubois', aspect: 'portrait', location: 'Milan, Italy', caption: 'Behind the scenes on today’s monochrome lookbook shoot. 🎞️🖤 #editorial', url: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=1080&q=80' },
  { key: 'fashion_atelier', owner: 'chloe.dubois', aspect: 'landscape', location: 'Paris, France', caption: 'Textures, wool coats, and natural studio light. 🪡✨ #atelier', url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=1080&q=80' },

  // Fitness (4)
  { key: 'fitness_gym_barbell', owner: 'mateo.silva', aspect: 'landscape', location: 'Boulder, CO', caption: 'Heavy compound mornings before hitting the mountain trails. 🏋️‍♂️🔥 #strength', url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1080&q=80' },
  { key: 'fitness_training', owner: 'mateo.silva', aspect: 'square', location: 'Boulder, CO', caption: 'Consistency beats intensity every single week. Keep showing up. 💪 #training', url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&q=80' },
  { key: 'fitness_outdoor', owner: 'mateo.silva', aspect: 'landscape', location: 'Flagstaff, AZ', caption: 'Mobility drills and core work out in the sun. ☀️🏃‍♂️ #athletic', url: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1080&q=80' },
  { key: 'fitness_yoga', owner: 'priya.verma', aspect: 'portrait', location: 'Rishikesh, India', caption: 'Sunrise breathwork and steady balance to start the week grounded. 🧘‍♀️🌅 #yoga', url: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1080&q=80' },

  // Photography (4)
  { key: 'photo_vintage_cam', owner: 'zara.mensah', aspect: 'square', location: 'Accra, Ghana', caption: 'Loaded up a fresh roll of Portra 400 for weekend street portraits. 📷🎞️ #analog', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1080&q=80' },
  { key: 'photo_lens_kit', owner: 'zara.mensah', aspect: 'landscape', location: 'London, UK', caption: 'Packing light for a three-day documentary assignment: one body, two primes. 🎒📸 #gear', url: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1080&q=80' },
  { key: 'photo_golden_shooter', owner: 'zara.mensah', aspect: 'portrait', location: 'Cape Town, SA', caption: 'Chasing backlit silhouettes just before dusk. 🌅📷 #photography', url: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1080&q=80' },
  { key: 'photo_desert_road', owner: 'devon.cole', aspect: 'square', location: 'Mojave Desert', caption: 'Minimalist horizon lines and endless desert silence. 🌵📷 #minimalism', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1080&q=80' }
];

// 14 Verified Public MP4 Videos uploaded to Cloudinary insta-v2/demo/reels/ in 9:16 vertical format (capped at 12s, 720px wide)
const DEMO_REELS = [
  { key: 'reel_ocean_turtle', owner: 'alex.rivera', caption: 'Gliding silently above the coral reef 🐢🌊 #ocean #wildlife', audioTrack: 'alex.rivera • Deep Blue Ambient', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/sea_turtle.mp4' },
  { key: 'reel_forest_trail', owner: 'mateo.silva', caption: 'Singletrack flow through the pine woods 🚵‍♂️🌲 #trail #mtb', audioTrack: 'mateo.silva • Trail Cadence', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/forest_bike.mp4' },
  { key: 'reel_golden_dog', owner: 'nina.kowalski', caption: 'Weekend park adventures with my best friend 🐕☀️ #dogsofinsta', audioTrack: 'Sunny Mornings • Acoustic Mix', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/dog.mp4' },
  { key: 'reel_ski_jump', owner: 'lucas.berg', caption: 'Catching air over fresh Nordic powder ⛷️❄️ #winter #skiing', audioTrack: 'lucas.berg • Alpine Rush', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/ski_jump.mp4' },
  { key: 'reel_snow_horses', owner: 'aria.nakamura', caption: 'Wild horses running through fresh winter snowfall 🐎❄️ #nature', audioTrack: 'Nordic Winds • Piano Solo', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/snow_horses.mp4' },
  { key: 'reel_dance_studio', owner: 'zara.mensah', caption: 'Rehearsal energy & rhythm in motion 💃✨ #choreography', audioTrack: 'Studio Session • Beat 04', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/samples/dance-2.mp4' },
  { key: 'reel_finish_line', owner: 'mateo.silva', caption: 'That final sprint when every kilometer pays off 🏁🏃‍♂️ #marathon', audioTrack: 'mateo.silva • Runner High', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/finish_line.mp4' },
  { key: 'reel_coastal_ship', owner: 'alex.rivera', caption: 'Crossing calm morning waters at dawn 🚢🌅 #seascape', audioTrack: 'Harbor Mist • Original Audio', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/ship.mp4' },
  { key: 'reel_playful_kittens', owner: 'nina.kowalski', caption: 'Morning studio chaos courtesy of these two 🐱💛 #kittens', audioTrack: 'Lofi Purrs • Chill Mix', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/kitten_fighting.mp4' },
  { key: 'reel_elephants', owner: 'aria.nakamura', caption: 'Gentle giants crossing the savanna at sunset 🐘🌾 #wildlife', audioTrack: 'Earth Echoes • Field Audio', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/elephants.mp4' },
  { key: 'reel_city_walk', owner: 'noah.kim', caption: 'Golden hour strolls through downtown avenues 🚶‍♂️🌇 #streetlife', audioTrack: 'noah.kim • City Tape', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/docs/walking_talking.mp4' },
  { key: 'reel_summer_shades', owner: 'chloe.dubois', caption: 'Golden afternoon sunlight & classic eyewear 🕶️✨ #fashion', audioTrack: 'chloe.dubois • Paris Noon', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/docs/sunglasses.mp4' },
  { key: 'reel_mountain_drive', owner: 'devon.cole', caption: 'Winding canyon roads and crisp mountain air 🚗⛰️ #roadtrip', audioTrack: 'Horizon Drive • Synthwave', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/race_road_car.mp4' },
  { key: 'reel_creative_vlog', owner: 'sophia.patel', caption: 'Snapshots from a week building & exploring ✨🎥 #lifestyle', audioTrack: 'sophia.patel • Daily Cut', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_12/samples/cld-sample-video.mp4' }
];

const SAMPLE_COMMENTS = [
  'Incredible shot! Love the composition 🔥',
  'The lighting here is unreal ✨',
  'Adding this straight to my bucket list!',
  'So clean and peaceful 🙌',
  'This turned out amazing!',
  'Absolutely love the colors on this one 😍',
  'Wait, where exactly was this taken?',
  'Pure perfection 👏',
  'Such great vibes in this frame!',
  'Goals right here 💯'
];

// 34 Active Demo Stories (26 Vertical Images + 8 Vertical 9:16 Videos) across 14 users (2 users intentionally have 0)
const DEMO_STORIES = [
  // maya.lin (4 stories)
  { key: 'story_maya_studio', owner: 'maya.lin', mediaType: 'image', caption: 'Morning shadows inside the timber pavilion ✨', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_maya_concrete', owner: 'maya.lin', mediaType: 'image', caption: 'Site check: clean brutalist geometry 🧱', url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_maya_villa', owner: 'maya.lin', mediaType: 'image', caption: 'Golden desert reflections before dusk 🏡', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_maya_walk', owner: 'maya.lin', mediaType: 'video', caption: 'Walking through the exhibition hall 🎥', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_8/docs/walking_talking.mp4' },

  // alex.rivera (4 stories)
  { key: 'story_alex_yosemite', owner: 'alex.rivera', mediaType: 'image', caption: '4:45 AM valley mist rising 🌄', url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_alex_coast', owner: 'alex.rivera', mediaType: 'image', caption: 'Amalfi cliffs at noon 🌊☀️', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_alex_turtle', owner: 'alex.rivera', mediaType: 'video', caption: 'Reef dive clip from this morning 🐢🌊', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_8/sea_turtle.mp4' },
  { key: 'story_alex_road', owner: 'alex.rivera', mediaType: 'image', caption: 'Pulling over on Highway 1 🚐', url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=720&h=1280&fit=crop&q=80' },

  // noah.kim (3 stories)
  { key: 'story_noah_kyoto', owner: 'noah.kim', mediaType: 'image', caption: 'Evening lanterns glowing in Higashiyama 🏮', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_noah_shinjuku', owner: 'noah.kim', mediaType: 'image', caption: 'Neon rain in Shinjuku tonight 🌧️', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_noah_drive', owner: 'noah.kim', mediaType: 'video', caption: 'Late night city transit loop 🌃', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_8/race_road_car.mp4' },

  // omar.hassan (3 stories)
  { key: 'story_omar_spread', owner: 'omar.hassan', mediaType: 'image', caption: 'Testing new herb flatbread recipe 🔥', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_omar_pizza', owner: 'omar.hassan', mediaType: 'image', caption: '90-second sourdough bake out of the oven 🍕', url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_omar_bistro', owner: 'omar.hassan', mediaType: 'image', caption: 'Fresh pasta prep at dusk 🍝', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=720&h=1280&fit=crop&q=80' },

  // sophia.patel (3 stories)
  { key: 'story_sophia_code', owner: 'sophia.patel', mediaType: 'image', caption: 'Shipping cluster optimizations tonight 💻', url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_sophia_desk', owner: 'sophia.patel', mediaType: 'image', caption: 'Zero clutter desk reset 🌿🖥️', url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_sophia_vlog', owner: 'sophia.patel', mediaType: 'video', caption: 'Weekend coffee & build reel ✨', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_8/samples/cld-sample-video.mp4' },

  // chloe.dubois (Private, 2 stories)
  { key: 'story_chloe_rack', owner: 'chloe.dubois', mediaType: 'image', caption: 'Pulling autumn linen silhouettes 🧥🤍', url: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_chloe_shades', owner: 'chloe.dubois', mediaType: 'video', caption: 'Parisian afternoon light check 🕶️✨', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_8/docs/sunglasses.mp4' },

  // mateo.silva (2 stories)
  { key: 'story_mateo_barbell', owner: 'mateo.silva', mediaType: 'image', caption: '6 AM heavy squats done 💪', url: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_mateo_trail', owner: 'mateo.silva', mediaType: 'video', caption: 'Pine ridge singletrack descent 🚵‍♂️🌲', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_8/forest_bike.mp4' },

  // zara.mensah (2 stories)
  { key: 'story_zara_cam', owner: 'zara.mensah', mediaType: 'image', caption: 'Fresh Portra 400 roll ready 📷', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_zara_dance', owner: 'zara.mensah', mediaType: 'video', caption: 'Backstage choreography rehearsal 💃', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_8/samples/dance-2.mp4' },

  // liam.oconnor (2 stories - pre-marked viewed for demo viewer variety)
  { key: 'story_liam_pour', owner: 'liam.oconnor', mediaType: 'image', caption: 'Washed Ethiopian pour-over dial-in ☕', url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_liam_latte', owner: 'liam.oconnor', mediaType: 'image', caption: 'Morning flat white art 🌤️', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=720&h=1280&fit=crop&q=80' },

  // aria.nakamura (2 stories)
  { key: 'story_aria_forest', owner: 'aria.nakamura', mediaType: 'image', caption: 'Redwood mist after sunrise 🌲🌿', url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_aria_horses', owner: 'aria.nakamura', mediaType: 'video', caption: 'Wild horses across winter snow 🐎❄️', url: 'https://res.cloudinary.com/demo/video/upload/ar_9:16,c_fill,w_720,q_auto,eo_8/snow_horses.mp4' },

  // lucas.berg (2 stories - pre-marked viewed for demo viewer variety)
  { key: 'story_lucas_lake', owner: 'lucas.berg', mediaType: 'image', caption: 'Mirror-calm alpine water at dawn 🏔️', url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_lucas_camp', owner: 'lucas.berg', mediaType: 'image', caption: 'Starlit Arctic camp tonight 🌌⛺', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=720&h=1280&fit=crop&q=80' },

  // elena.rostova (Private - kept unfollowed for private story testing, 2 stories)
  { key: 'story_elena_courtyard', owner: 'elena.rostova', mediaType: 'image', caption: 'Private client courtyard review 🏛️', url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_elena_living', owner: 'elena.rostova', mediaType: 'image', caption: 'Scandinavian oak moodboard 🪑', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=720&h=1280&fit=crop&q=80' },

  // nina.kowalski (2 stories)
  { key: 'story_nina_journal', owner: 'nina.kowalski', mediaType: 'image', caption: 'Morning sketchbook & espresso 📓', url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=720&h=1280&fit=crop&q=80' },
  { key: 'story_nina_friends', owner: 'nina.kowalski', mediaType: 'image', caption: 'Golden hour park stroll ✨', url: 'https://images.unsplash.com/photo-1511988617509-a57c8a288659?w=720&h=1280&fit=crop&q=80' },

  // devon.cole (1 story - pre-marked viewed)
  { key: 'story_devon_nyc', owner: 'devon.cole', mediaType: 'image', caption: 'Golden skyline ride before traffic 🚲🌇', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=720&h=1280&fit=crop&q=80' }
];

// Idempotent Cloudinary uploader: checks if asset already exists before uploading
async function ensureCloudinaryAsset(sourceUrl, { folder, key, resourceType = 'image', isReel = false }) {
  const fullPublicId = `${folder}/${key}`;

  try {
    const existing = await cloudinary.api.resource(fullPublicId, {
      resource_type: resourceType
    });
    if (existing && existing.secure_url) {
      return {
        secureUrl: existing.secure_url,
        publicId: existing.public_id,
        duration: existing.duration || 0,
        reused: true
      };
    }
  } catch (err) {
    // 404 means not yet uploaded -> proceed to upload
    if (err?.error?.http_code !== 404 && err?.http_code !== 404) {
      console.warn(`[Cloudinary] Warning checking ${fullPublicId}:`, err.message || err);
    }
  }

  // Verify source URL is accessible before uploading
  const checkRes = await fetch(sourceUrl, {
    method: 'GET',
    headers: { Range: 'bytes=0-128' }
  });
  if (!checkRes.ok) {
    throw new Error(`Source asset unreachable (${checkRes.status}): ${sourceUrl}`);
  }

  const uploadOptions = {
    folder,
    public_id: key,
    resource_type: resourceType,
    overwrite: false,
    unique_filename: false
  };

  if (!isReel && folder.includes('avatars')) {
    uploadOptions.transformation = [
      { width: 400, height: 400, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' }
    ];
  }

  const uploaded = await cloudinary.uploader.upload(sourceUrl, uploadOptions);
  if (!uploaded || !uploaded.secure_url) {
    throw new Error(`Cloudinary upload failed for ${fullPublicId}`);
  }

  return {
    secureUrl: uploaded.secure_url,
    publicId: uploaded.public_id,
    duration: uploaded.duration || 0,
    reused: false
  };
}

async function seedDatabase() {
  console.log('=== INSTA-V2 DEMO SEEDING STARTED ===');
  console.log(`Environment: ${currentEnv}`);

  await connectDB();

  const stats = {
    usersCreated: 0,
    usersExisting: 0,
    postsCreated: 0,
    postsExisting: 0,
    reelsCreated: 0,
    reelsExisting: 0,
    assetsUploaded: 0,
    assetsReused: 0,
    followsCreated: 0,
    followRequestsCreated: 0,
    likesCreated: 0,
    commentsCreated: 0,
    storiesCreated: 0,
    storiesExisting: 0,
    storiesRenewed: 0,
    conversationsCreated: 0,
    messagesCreated: 0
  };

  // 1. Seed Demo Users & Upload Avatars to Cloudinary
  console.log('\n1. Seeding 16 demo users & Cloudinary avatars...');
  const userMap = new Map();

  for (let i = 0; i < DEMO_USERS.length; i++) {
    const u = DEMO_USERS[i];
    let userDoc = await User.findOne({ username: u.username });

    if (userDoc) {
      stats.usersExisting++;
      userMap.set(u.username, userDoc);
      continue;
    }

    const avatarAsset = await ensureCloudinaryAsset(u.avatarUrl, {
      folder: 'insta-v2/demo/avatars',
      key: `avatar_${u.username.replace(/\./g, '_')}`,
      resourceType: 'image'
    });
    if (avatarAsset.reused) stats.assetsReused++;
    else stats.assetsUploaded++;

    userDoc = await User.create({
      fullName: u.fullName,
      username: u.username,
      email: u.email,
      password: DEMO_PASSWORD, // Hashed automatically by User pre-save hook
      avatar: avatarAsset.secureUrl,
      bio: u.bio,
      website: u.website,
      isPrivate: u.isPrivate
    });

    stats.usersCreated++;
    userMap.set(u.username, userDoc);
    console.log(`  + Created user @${u.username} (${u.isPrivate ? 'Private' : 'Public'})`);
  }

  const allDemoUsers = Array.from(userMap.values());

  // 2. Seed 48 Demo Posts & Upload Post Images to Cloudinary
  console.log('\n2. Seeding 48 demo posts & uploading images to Cloudinary...');
  const seededPosts = [];

  for (let i = 0; i < DEMO_POSTS.length; i++) {
    const p = DEMO_POSTS[i];
    const owner = userMap.get(p.owner);
    if (!owner) continue;

    const fullPublicId = `insta-v2/demo/posts/${p.key}`;
    let postDoc = await Post.findOne({ publicId: fullPublicId });

    if (postDoc) {
      stats.postsExisting++;
      seededPosts.push(postDoc);
      continue;
    }

    const asset = await ensureCloudinaryAsset(p.url, {
      folder: 'insta-v2/demo/posts',
      key: p.key,
      resourceType: 'image'
    });
    if (asset.reused) stats.assetsReused++;
    else stats.assetsUploaded++;

    // Stagger timestamps over past 14 days
    const hoursAgo = (i + 1) * 6.5;
    const createdAt = new Date(Date.now() - hoursAgo * 3600 * 1000);

    postDoc = await Post.create({
      user: owner._id,
      mediaUrl: asset.secureUrl,
      publicId: asset.publicId,
      mediaType: 'image',
      caption: p.caption,
      location: p.location,
      mediaAspect: p.aspect,
      createdAt,
      updatedAt: createdAt
    });

    stats.postsCreated++;
    seededPosts.push(postDoc);
    if ((i + 1) % 12 === 0) {
      console.log(`  ...processed ${i + 1}/${DEMO_POSTS.length} posts`);
    }
  }

  // 3. Seed 14 Demo Reels & Upload Vertical MP4 Videos to Cloudinary
  console.log('\n3. Seeding 14 demo Reels & uploading videos to Cloudinary...');
  const seededReels = [];

  for (let i = 0; i < DEMO_REELS.length; i++) {
    const r = DEMO_REELS[i];
    const owner = userMap.get(r.owner);
    if (!owner) continue;

    const fullPublicId = `insta-v2/demo/reels/${r.key}`;
    let reelDoc = await Reel.findOne({ publicId: fullPublicId });

    if (reelDoc) {
      stats.reelsExisting++;
      seededReels.push(reelDoc);
      continue;
    }

    const asset = await ensureCloudinaryAsset(r.url, {
      folder: 'insta-v2/demo/reels',
      key: r.key,
      resourceType: 'video',
      isReel: true
    });
    if (asset.reused) stats.assetsReused++;
    else stats.assetsUploaded++;

    const thumbnailUrl = cloudinary.url(asset.publicId, {
      resource_type: 'video',
      format: 'jpg',
      secure: true,
      transformation: [{ start_offset: '0', width: 720, crop: 'limit', quality: 'auto' }]
    });

    const createdAt = new Date(Date.now() - (i + 1) * 9 * 3600 * 1000);

    reelDoc = await Reel.create({
      user: owner._id,
      videoUrl: asset.secureUrl,
      publicId: asset.publicId,
      thumbnailUrl,
      caption: r.caption,
      audioTrack: r.audioTrack,
      duration: Math.round((asset.duration || 10) * 10) / 10,
      aspectRatio: '9:16',
      createdAt,
      updatedAt: createdAt
    });

    stats.reelsCreated++;
    seededReels.push(reelDoc);
    console.log(`  + Created reel ${r.key} for @${owner.username}`);
  }

  // 4. Seed Social Relationships (Follows & Pending Follow Requests)
  console.log('\n4. Seeding realistic follow relationships & private follow requests...');
  const popularUsernames = ['maya.lin', 'alex.rivera', 'omar.hassan', 'sophia.patel', 'noah.kim'];

  for (let i = 0; i < allDemoUsers.length; i++) {
    const follower = allDemoUsers[i];

    for (let j = 0; j < allDemoUsers.length; j++) {
      if (i === j) continue; // Never self-follow
      const target = allDemoUsers[j];

      const isPopular = popularUsernames.includes(target.username);
      // Popular accounts get ~75% follower coverage; others ~30%
      const shouldConnect = isPopular
        ? (i + j) % 4 !== 0
        : (i * 3 + j) % 7 === 0;

      if (!shouldConnect) continue;

      if (!target.isPrivate) {
        const res = await Follow.updateOne(
          { follower: follower._id, following: target._id },
          { $setOnInsert: { follower: follower._id, following: target._id, createdAt: new Date() } },
          { upsert: true }
        );
        if (res.upsertedCount > 0) stats.followsCreated++;
      } else {
        // Private accounts: mix of approved followers and pending requests
        const alreadyFollowing = await Follow.exists({
          follower: follower._id,
          following: target._id
        });
        if (alreadyFollowing) continue;

        if ((i + j) % 2 === 0) {
          const res = await Follow.updateOne(
            { follower: follower._id, following: target._id },
            { $setOnInsert: { follower: follower._id, following: target._id, createdAt: new Date() } },
            { upsert: true }
          );
          if (res.upsertedCount > 0) stats.followsCreated++;
        } else {
          const reqRes = await FollowRequest.updateOne(
            { requester: follower._id, recipient: target._id },
            { $setOnInsert: { requester: follower._id, recipient: target._id, status: 'pending' } },
            { upsert: true }
          );
          if (reqRes.upsertedCount > 0) stats.followRequestsCreated++;
        }
      }
    }
  }

  // 5. Seed Likes & Comments on Posts (respecting privacy & keeping accurate counts)
  console.log('\n5. Seeding realistic post likes & comments...');
  for (let idx = 0; idx < seededPosts.length; idx++) {
    const post = seededPosts[idx];
    const owner = allDemoUsers.find((u) => u._id.equals(post.user));
    if (!owner) continue;

    // Pick eligible likers/commenters (anyone if public, approved followers if private)
    let eligibleUsers = allDemoUsers.filter((u) => !u._id.equals(owner._id));
    if (owner.isPrivate) {
      const approvedFollowers = await Follow.find({ following: owner._id }).select('follower');
      const followerSet = new Set(approvedFollowers.map((f) => f.follower.toString()));
      eligibleUsers = eligibleUsers.filter((u) => followerSet.has(u._id.toString()));
    }

    // Add 3-8 likes per post deterministically
    const desiredLikes = Math.min(eligibleUsers.length, 3 + (idx % 6));
    for (let k = 0; k < desiredLikes; k++) {
      const liker = eligibleUsers[(idx + k * 2) % eligibleUsers.length];
      const likeRes = await Like.updateOne(
        { user: liker._id, post: post._id },
        { $setOnInsert: { user: liker._id, post: post._id, createdAt: new Date() } },
        { upsert: true }
      );
      if (likeRes.upsertedCount > 0) stats.likesCreated++;
    }

    // Add 1-3 comments per post idempotently
    const desiredComments = Math.min(eligibleUsers.length, 1 + (idx % 3));
    for (let c = 0; c < desiredComments; c++) {
      const commenter = eligibleUsers[(idx + c * 3) % eligibleUsers.length];
      const text = SAMPLE_COMMENTS[(idx + c) % SAMPLE_COMMENTS.length];
      const exists = await Comment.exists({ user: commenter._id, post: post._id, text });
      if (!exists) {
        await Comment.create({ user: commenter._id, post: post._id, text });
        stats.commentsCreated++;
      }
    }

    // Sync exact counts from MongoDB
    const [likesCount, commentsCount] = await Promise.all([
      Like.countDocuments({ post: post._id }),
      Comment.countDocuments({ post: post._id })
    ]);
    await Post.updateOne({ _id: post._id }, { $set: { likesCount, commentsCount } });
  }

  // 6. Seed Likes & Comments on Reels
  console.log('\n6. Seeding realistic Reel likes & comments...');
  for (let idx = 0; idx < seededReels.length; idx++) {
    const reel = seededReels[idx];
    const owner = allDemoUsers.find((u) => u._id.equals(reel.user));
    if (!owner) continue;

    let eligibleUsers = allDemoUsers.filter((u) => !u._id.equals(owner._id));
    if (owner.isPrivate) {
      const approvedFollowers = await Follow.find({ following: owner._id }).select('follower');
      const followerSet = new Set(approvedFollowers.map((f) => f.follower.toString()));
      eligibleUsers = eligibleUsers.filter((u) => followerSet.has(u._id.toString()));
    }

    const desiredLikes = Math.min(eligibleUsers.length, 4 + (idx % 5));
    for (let k = 0; k < desiredLikes; k++) {
      const liker = eligibleUsers[(idx + k) % eligibleUsers.length];
      const likeRes = await ReelLike.updateOne(
        { user: liker._id, reel: reel._id },
        { $setOnInsert: { user: liker._id, reel: reel._id, createdAt: new Date() } },
        { upsert: true }
      );
      if (likeRes.upsertedCount > 0) stats.likesCreated++;
    }

    const desiredComments = Math.min(eligibleUsers.length, 1 + (idx % 2));
    for (let c = 0; c < desiredComments; c++) {
      const commenter = eligibleUsers[(idx + c * 2) % eligibleUsers.length];
      const text = SAMPLE_COMMENTS[(idx + c + 4) % SAMPLE_COMMENTS.length];
      const exists = await ReelComment.exists({ user: commenter._id, reel: reel._id, text });
      if (!exists) {
        await ReelComment.create({ user: commenter._id, reel: reel._id, text });
        stats.commentsCreated++;
      }
    }

    const [likesCount, commentsCount] = await Promise.all([
      ReelLike.countDocuments({ reel: reel._id }),
      ReelComment.countDocuments({ reel: reel._id })
    ]);
    await Reel.updateOne({ _id: reel._id }, { $set: { likesCount, commentsCount } });
  }

  // 7. Ensure rich follow edges for @maya.lin & optional existing real account (_vivek_sharma_)
  // so both demo and personal accounts see active public + approved-private stories (while keeping elena.rostova & ethan.brooks unfollowed)
  const primaryFollowTargets = [
    'alex.rivera',
    'noah.kim',
    'omar.hassan',
    'sophia.patel',
    'chloe.dubois', // approved private account
    'mateo.silva',
    'zara.mensah',
    'liam.oconnor',
    'aria.nakamura',
    'lucas.berg',
    'nina.kowalski',
    'devon.cole'
  ];

  const mayaUser = userMap.get('maya.lin');
  const realViewerUser = await User.findOne({ username: '_vivek_sharma_' });
  const viewerAccountsToConnect = [mayaUser, realViewerUser].filter(Boolean);

  for (const viewer of viewerAccountsToConnect) {
    for (const targetUsername of primaryFollowTargets) {
      const target = userMap.get(targetUsername);
      if (!target || viewer._id.equals(target._id)) continue;

      const fRes = await Follow.updateOne(
        { follower: viewer._id, following: target._id },
        { $setOnInsert: { follower: viewer._id, following: target._id, createdAt: new Date() } },
        { upsert: true }
      );
      if (fRes.upsertedCount > 0) stats.followsCreated++;
    }
  }

  // 8. Seed 34 Active Demo Stories (Images + Videos uploaded to Cloudinary) with Viewed/Unviewed Distribution
  console.log('\n7. Seeding 34 active demo stories & uploading assets to Cloudinary...');
  const now = new Date();
  const seenOwnersForDemo = new Set(['liam.oconnor', 'lucas.berg', 'devon.cole']);

  for (let i = 0; i < DEMO_STORIES.length; i++) {
    const s = DEMO_STORIES[i];
    const owner = userMap.get(s.owner);
    if (!owner) continue;

    const fullPublicId = `insta-v2/demo/stories/${s.key}`;
    let storyDoc = await Story.findOne({ publicId: fullPublicId });

    const createdAt = new Date(Date.now() - ((i % 10) + 1) * 45 * 60 * 1000);
    const expiresAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000);

    if (storyDoc) {
      if (storyDoc.expiresAt <= now) {
        await Story.updateOne(
          { _id: storyDoc._id },
          { $set: { createdAt, expiresAt } }
        );
        stats.storiesRenewed++;
      } else {
        stats.storiesExisting++;
      }
      continue;
    }

    const asset = await ensureCloudinaryAsset(s.url, {
      folder: 'insta-v2/demo/stories',
      key: s.key,
      resourceType: s.mediaType
    });
    if (asset.reused) stats.assetsReused++;
    else stats.assetsUploaded++;

    // Build realistic viewers list (including seen vs unseen distinction for maya.lin and _vivek_sharma_)
    const viewers = [];
    const viewerIdsAdded = new Set();

    const addViewerIfEligible = (vUser, minutesAgo) => {
      if (!vUser || vUser._id.equals(owner._id)) return;
      const vid = vUser._id.toString();
      if (viewerIdsAdded.has(vid)) return;
      viewerIdsAdded.add(vid);
      viewers.push({
        user: vUser._id,
        viewedAt: new Date(Date.now() - minutesAgo * 60 * 1000)
      });
    };

    // Add 2-4 background viewers on each story
    for (let vIdx = 0; vIdx < 3; vIdx++) {
      const candidate = allDemoUsers[(i * 3 + vIdx + 1) % allDemoUsers.length];
      if (!candidate || candidate.username === 'maya.lin') continue;
      if (owner.isPrivate) {
        const isFollower = await Follow.exists({ follower: candidate._id, following: owner._id });
        if (!isFollower) continue;
      }
      addViewerIfEligible(candidate, 5 + vIdx * 7);
    }

    // Explicitly mark liam.oconnor, lucas.berg, and devon.cole stories as already viewed by maya.lin & _vivek_sharma_
    if (seenOwnersForDemo.has(owner.username)) {
      addViewerIfEligible(mayaUser, 12);
      addViewerIfEligible(realViewerUser, 10);
    }

    storyDoc = await Story.create({
      user: owner._id,
      mediaUrl: asset.secureUrl,
      publicId: asset.publicId,
      mediaType: s.mediaType,
      caption: s.caption,
      viewers,
      createdAt,
      expiresAt
    });

    stats.storiesCreated++;
    if ((i + 1) % 10 === 0 || i === DEMO_STORIES.length - 1) {
      console.log(`  ...processed ${i + 1}/${DEMO_STORIES.length} stories`);
    }
  }

  // 9. Seed Realistic Text-Only Conversations & Messages (Read/Unread, Long/Short, Pagination Ready)
  console.log('\n8. Seeding realistic direct message conversations & messages...');

  const longMayaAlexThread = [
    { from: 'alex.rivera', minutesAgo: 4320, read: true, text: 'Hey Maya! Saw your recent architectural study of the concrete pavilion — the afternoon shadows along the stairwell are incredible.' },
    { from: 'maya.lin', minutesAgo: 4290, read: true, text: 'Thanks so much Alex! That morning was freezing, we waited almost two hours for the sun angle to hit that inner wall.' },
    { from: 'alex.rivera', minutesAgo: 4260, read: true, text: 'Patience always pays off with architectural light. Which focal length did you shoot those vertical frames on?' },
    { from: 'maya.lin', minutesAgo: 4200, read: true, text: '24mm tilt-shift for the main facade, then 50mm f/1.4 for the timber detail shots.' },
    { from: 'alex.rivera', minutesAgo: 2940, read: true, text: 'Nice combo! I am packing light for Yosemite next week — just bringing my 35mm prime and a compact tripod.' },
    { from: 'maya.lin', minutesAgo: 2910, read: true, text: '35mm in Yosemite Valley is undefeated. Make sure you hit Tunnel View before 5 AM if you want clean mist!' },
    { from: 'alex.rivera', minutesAgo: 2880, read: true, text: 'Alarm is already set for 4:15 AM 😅' },
    { from: 'maya.lin', minutesAgo: 2860, read: true, text: 'Pack extra wool gloves too — the wind off El Capitan gets sharp early.' },
    { from: 'alex.rivera', minutesAgo: 2100, read: true, text: 'Did you finish the exhibition layout boards for San Francisco?' },
    { from: 'maya.lin', minutesAgo: 2050, read: true, text: 'Almost! We printed the scale elevation panels yesterday and hung mockups in the studio.' },
    { from: 'alex.rivera', minutesAgo: 2000, read: true, text: 'Exciting! Send dates once opening night is finalized so I can fly down.' },
    { from: 'maya.lin', minutesAgo: 1960, read: true, text: 'Definitely will — aiming for the first Friday of next month.' },
    { from: 'alex.rivera', minutesAgo: 1520, read: true, text: 'By the way, how did you treat the cedar louvers on the courtyard prototype? They looked super matte in your story.' },
    { from: 'maya.lin', minutesAgo: 1490, read: true, text: 'Two light coats of raw tung oil with UV matte sealer — keeps the natural grain without yellowing.' },
    { from: 'alex.rivera', minutesAgo: 1450, read: true, text: 'Taking notes for my friend building a cabin up in Banff.' },
    { from: 'maya.lin', minutesAgo: 1410, read: true, text: 'Happy to share the spec sheet anytime!' },
    { from: 'alex.rivera', minutesAgo: 1200, read: true, text: 'Just got back from coastal trail scouting near Big Sur.' },
    { from: 'maya.lin', minutesAgo: 1180, read: true, text: 'How was the fog clearance along Bixby Bridge?' },
    { from: 'alex.rivera', minutesAgo: 1150, read: true, text: 'Cleared right at golden hour — got three clean panoramas before sunset.' },
    { from: 'maya.lin', minutesAgo: 1100, read: true, text: 'Can’t wait to see them on your feed!' },
    { from: 'alex.rivera', minutesAgo: 900, read: true, text: 'Quick question on print framing: museum glass or matte acrylic for 24x36 gallery prints?' },
    { from: 'maya.lin', minutesAgo: 860, read: true, text: 'Anti-reflective museum glass every time if the wall gets indirect daylight — zero glare.' },
    { from: 'alex.rivera', minutesAgo: 830, read: true, text: 'Sold. Going with Optium museum glass.' },
    { from: 'maya.lin', minutesAgo: 780, read: true, text: 'Solid call. Let me know which printer you use too.' },
    { from: 'alex.rivera', minutesAgo: 420, read: true, text: 'Grabbing coffee with Liam tomorrow morning if you want to join before studio hours!' },
    { from: 'maya.lin', minutesAgo: 390, read: true, text: 'Yes please! 8:30 AM works great for me.' },
    { from: 'alex.rivera', minutesAgo: 360, read: true, text: 'Perfect, let us meet at the roastery downtown.' },
    { from: 'maya.lin', minutesAgo: 300, read: true, text: 'See you both there ☕' },
    { from: 'alex.rivera', minutesAgo: 95, read: true, text: 'Hey, I uploaded the Big Sur preview clip to Reels just now.' },
    { from: 'maya.lin', minutesAgo: 60, read: true, text: 'Watching it right now — the color grade looks crisp!' },
    { from: 'alex.rivera', minutesAgo: 18, read: false, text: 'Appreciate you! Also, are you bringing the portfolio book tomorrow?' },
    { from: 'alex.rivera', minutesAgo: 14, read: false, text: 'Wanted to compare paper stocks before we lock the gallery print run.' }
  ];

  const demoThreads = [
    { userA: 'maya.lin', userB: 'alex.rivera', messages: longMayaAlexThread },
    {
      userA: 'maya.lin',
      userB: 'sophia.patel',
      messages: [
        { from: 'sophia.patel', minutesAgo: 1680, read: true, text: 'Hey Maya, loved the clean desk lamp in your studio story!' },
        { from: 'maya.lin', minutesAgo: 1640, read: true, text: 'Thanks Sophia! Your mechanical keyboard build looked unreal too ⌨️' },
        { from: 'sophia.patel', minutesAgo: 45, read: false, text: 'Wait till you hear the tactile switches in person — grab lunch this week?' }
      ]
    },
    {
      userA: 'maya.lin',
      userB: 'chloe.dubois',
      messages: [
        { from: 'maya.lin', minutesAgo: 2400, read: true, text: 'Chloe, those linen silhouettes from your Milan shoot were timeless.' },
        { from: 'chloe.dubois', minutesAgo: 2350, read: true, text: 'Merci Maya 🤍 We should collaborate on an architectural lookbook soon!' },
        { from: 'maya.lin', minutesAgo: 2300, read: true, text: 'Count me in! Let’s plan a concrete courtyard location.' }
      ]
    },
    {
      userA: 'maya.lin',
      userB: 'noah.kim',
      messages: [
        { from: 'noah.kim', minutesAgo: 720, read: true, text: 'Rain reflections in Shinjuku were wild tonight.' },
        { from: 'maya.lin', minutesAgo: 700, read: true, text: 'Your night street frames always look like cinema stills!' },
        { from: 'noah.kim', minutesAgo: 8, read: false, text: 'Just sent you the Kyoto lantern spot coordinates for your trip!' }
      ]
    },
    {
      userA: 'alex.rivera',
      userB: 'liam.oconnor',
      messages: [
        { from: 'liam.oconnor', minutesAgo: 320, read: true, text: 'Dialed in a fresh washed Ethiopian roast for tomorrow morning ☕' },
        { from: 'alex.rivera', minutesAgo: 280, read: true, text: 'Saving my caffeine budget specifically for that pour-over.' }
      ]
    },
    {
      userA: 'omar.hassan',
      userB: 'zara.mensah',
      messages: [
        { from: 'omar.hassan', minutesAgo: 540, read: true, text: 'Bringing fresh sourdough loaves to the studio shoot!' },
        { from: 'zara.mensah', minutesAgo: 510, read: false, text: 'You are literally everyone’s favorite person right now 🙌' }
      ]
    }
  ];

  // Also seed realistic DM threads for existing real user (_vivek_sharma_) if present
  if (realViewerUser) {
    demoThreads.push(
      {
        userA: realViewerUser.username,
        userB: 'maya.lin',
        messages: [
          { from: 'maya.lin', minutesAgo: 1500, read: true, text: 'Hey! Welcome to Insta-V2 — feel free to test out real-time messaging here.' },
          { from: 'maya.lin', minutesAgo: 25, read: false, text: 'Just checking in — let me know how the feed and stories look on your end!' }
        ]
      },
      {
        userA: realViewerUser.username,
        userB: 'alex.rivera',
        messages: [
          { from: 'alex.rivera', minutesAgo: 90, read: false, text: 'Just posted fresh Yosemite & Big Sur shots — let me know which frame you like best 🌄' }
        ]
      }
    );
  }

  for (const thread of demoThreads) {
    const uA = thread.userA === realViewerUser?.username ? realViewerUser : userMap.get(thread.userA);
    const uB = thread.userB === realViewerUser?.username ? realViewerUser : userMap.get(thread.userB);
    if (!uA || !uB || uA._id.equals(uB._id)) continue;

    const pairKey = buildConversationPairKey(uA._id, uB._id);
    const participants = [uA._id, uB._id].sort((a, b) => a.toString().localeCompare(b.toString()));

    let convDoc = await Conversation.findOne({ pairKey });
    if (!convDoc) {
      convDoc = await Conversation.create({
        participants,
        pairKey,
        lastMessage: null,
        lastMessageAt: new Date()
      });
      stats.conversationsCreated++;
    }

    const existingMsgCount = await Message.countDocuments({ conversation: convDoc._id });
    if (existingMsgCount === 0 && thread.messages.length > 0) {
      let latestMsg = null;
      for (const m of thread.messages) {
        const senderDoc = m.from === uA.username ? uA : uB;
        const recipientDoc = senderDoc._id.equals(uA._id) ? uB : uA;
        const createdAt = new Date(Date.now() - m.minutesAgo * 60 * 1000);
        const readBy = m.read ? [senderDoc._id, recipientDoc._id] : [senderDoc._id];

        latestMsg = await Message.create({
          conversation: convDoc._id,
          sender: senderDoc._id,
          text: m.text,
          readBy,
          createdAt,
          updatedAt: createdAt
        });
        stats.messagesCreated++;
      }

      if (latestMsg) {
        await Conversation.updateOne(
          { _id: convDoc._id },
          {
            $set: {
              lastMessage: latestMsg._id,
              lastMessageAt: latestMsg.createdAt
            }
          }
        );
      }
    }
  }

  console.log('\n=== SEEDING COMPLETED SUCCESSFULLY ===');
  console.table(stats);
  console.log(`Demo Account Password: ${DEMO_PASSWORD}`);

  await mongoose.disconnect();
}

seedDatabase().catch(async (err) => {
  console.error('\n❌ Seed error:', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
