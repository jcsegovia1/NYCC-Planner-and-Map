window.NYCC_MAPS = {
  overview:   { name: 'Show overview', image: 'assets/maps/overview.webp' },
  level1:     { name: 'Level 1', image: 'assets/maps/level1.webp' },
  level2:     { name: 'Level 2', image: 'assets/maps/level2.webp' },
  level3:     { name: 'Level 3', image: 'assets/maps/level3.webp' },
  level4:     { name: 'Level 4', image: 'assets/maps/level4.webp' },
  level5:     { name: 'Level 5', image: 'assets/maps/level5.webp' },
  showfloor:  { name: 'Level 3 show floor', image: 'assets/maps/showfloor.webp' },
  artistalley:{ name: 'Artist Alley & Writers Block', image: 'assets/maps/artistalley.webp' }
};

// x/y are approximate marker positions on the official 2026 NYCC map images.
// The routing graph is intentionally conservative: Level 4 River Pavilion and
// Level 4 North Javits are NOT linked directly.
window.NYCC_LOCATIONS = {
  l1_hall_center: { name: 'Level 1 central hall', short: 'L1 Central', floor: 'Level 1', map: 'level1', x: 42, y: 66, hidden: true },
  l1_main_stage: { name: 'Main Stage', floor: 'Level 1', map: 'level1', x: 31.5, y: 52.5, category: 'Stage' },
  l1_queue_hall: { name: 'Queue Hall', floor: 'Level 1', map: 'level1', x: 48, y: 56, category: 'Queue' },
  l1_artist_alley: { name: 'Artist Alley', floor: 'Level 1 • Hall B', map: 'artistalley', x: 51, y: 46, category: 'Area' },
  l1_writers_block: { name: 'Writers Block', floor: 'Level 1 • Hall B', map: 'artistalley', x: 62, y: 82, category: 'Area' },
  l1_autographing: { name: 'Autographing', floor: 'Level 1', map: 'level1', x: 58, y: 46, category: 'Autographs' },
  l1_photo_ops: { name: 'Photo Ops', floor: 'Level 1', map: 'level1', x: 36, y: 46, category: 'Photo Ops' },
  l1_cosplay: { name: 'Cosplay Central', floor: 'Level 1', map: 'level1', x: 23, y: 64, category: 'Area' },
  l1_vip: { name: 'VIP Lounge', floor: 'Level 1', map: 'level1', x: 16, y: 66, category: 'Lounge' },
  l1_family: { name: 'Family HQ & Workshops', floor: 'Level 1', map: 'level1', x: 45, y: 84, category: 'Area' },
  l1_north_core: { name: 'Level 1 north-side access', short: 'L1 North Access', floor: 'Level 1', map: 'level1', x: 72, y: 58, hidden: true },
  l1_south_core: { name: 'Level 1 south-side access', short: 'L1 South Access', floor: 'Level 1', map: 'level1', x: 34, y: 69, hidden: true },

  l2_south_concourse: { name: 'South Concourse', floor: 'Level 2', map: 'level2', x: 35, y: 72, category: 'Concourse' },
  l2_food_trucks: { name: 'Food Trucks', floor: 'Level 2', map: 'level2', x: 51, y: 70, category: 'Food' },
  l2_north_concourse: { name: 'North Concourse', floor: 'Level 2', map: 'level2', x: 70, y: 54, category: 'Concourse' },
  l2_north_elevator: { name: 'North Javits elevator bank', floor: 'Level 2', map: 'level2', x: 62, y: 51, category: 'Elevator' },

  l3_crystal_palace: { name: 'Crystal Palace / Will Call', floor: 'Level 3', map: 'level3', x: 50, y: 65, category: 'Landmark' },
  l3_show_floor: { name: 'Show Floor', floor: 'Level 3', map: 'level3', x: 50, y: 43, category: 'Show Floor' },
  l3_comic_district: { name: 'Comic District', floor: 'Level 3', map: 'level3', x: 72, y: 29, category: 'Area' },
  l3_hall_d_elevators: { name: 'Hall D elevators for River Pavilion', floor: 'Level 3', map: 'level3', x: 58, y: 49, category: 'Elevator' },
  l3_north_access: { name: 'North-side Level 3 access', short: 'L3 North Access', floor: 'Level 3', map: 'level3', x: 72, y: 49, hidden: true },

  l4_river_entry: { name: 'River Pavilion entrance', floor: 'Level 4 • River Pavilion', map: 'level4', x: 43, y: 55, category: 'Entrance' },
  l4_pro_stage1: { name: 'Pro Stage 1', floor: 'Level 4 • River Pavilion', map: 'level4', x: 25, y: 42, category: 'Stage' },
  l4_networking: { name: 'Networking', floor: 'Level 4 • River Pavilion', map: 'level4', x: 31, y: 41, category: 'Area' },
  l4_press_lounge: { name: 'Press / Pro Lounge', floor: 'Level 4 • River Pavilion', map: 'level4', x: 29, y: 36, category: 'Lounge' },
  l4_pro_stage2: { name: 'Pro Stage 2', floor: 'Level 4 • River Pavilion', map: 'level4', x: 36, y: 47, category: 'Stage' },

  l4_north_core: { name: 'North Javits Level 4 access', floor: 'Level 4 • North Javits', map: 'level4', x: 82, y: 39, category: 'Elevator' },
  l4_room409: { name: 'Room 409', floor: 'Level 4 • North Javits', map: 'level4', x: 65, y: 19, category: 'Panel room' },
  l4_room408: { name: 'Room 408', floor: 'Level 4 • North Javits', map: 'level4', x: 68, y: 23, category: 'Panel room' },
  l4_room4061: { name: 'Room 406.1', floor: 'Level 4 • North Javits', map: 'level4', x: 70.5, y: 28, category: 'Panel room' },
  l4_room4062: { name: 'Room 406.2', floor: 'Level 4 • North Javits', map: 'level4', x: 72.5, y: 27, category: 'Panel room' },
  l4_room4063: { name: 'Room 406.3', floor: 'Level 4 • North Javits', map: 'level4', x: 74.5, y: 26, category: 'Panel room' },
  l4_room405: { name: 'Room 405', floor: 'Level 4 • North Javits', map: 'level4', x: 79, y: 30, category: 'Panel room' },

  l5_core: { name: 'Level 5 access', floor: 'Level 5', map: 'level5', x: 80, y: 28, hidden: true },
  l5_empire_queue: { name: 'Empire Stage Queue', floor: 'Level 5', map: 'level5', x: 77, y: 23, category: 'Queue' },
  l5_empire_stage: { name: 'Empire Stage', floor: 'Level 5', map: 'level5', x: 68, y: 15.5, category: 'Stage' }
};

window.NYCC_EDGES = [
  ['l1_hall_center','l1_main_stage',2],
  ['l1_hall_center','l1_queue_hall',1],
  ['l1_hall_center','l1_artist_alley',3],
  ['l1_hall_center','l1_writers_block',3],
  ['l1_hall_center','l1_autographing',3],
  ['l1_hall_center','l1_photo_ops',3],
  ['l1_hall_center','l1_cosplay',3],
  ['l1_hall_center','l1_vip',4],
  ['l1_hall_center','l1_family',4],
  ['l1_hall_center','l1_south_core',1],
  ['l1_hall_center','l1_north_core',2],

  ['l1_south_core','l2_south_concourse',2,'Use the nearby stairs/elevator between Level 1 and Level 2.'],
  ['l1_north_core','l2_north_concourse',2,'Use the north-side stairs/elevator between Level 1 and Level 2.'],
  ['l2_south_concourse','l2_food_trucks',2],
  ['l2_south_concourse','l2_north_concourse',4,'Continue along Level 2 toward the North Concourse.'],
  ['l2_north_concourse','l2_north_elevator',1],
  ['l2_south_concourse','l3_crystal_palace',2,'Use the access between Level 2 and Level 3 near Crystal Palace / registration.'],
  ['l2_north_concourse','l3_north_access',2,'Use the north-side access between Level 2 and Level 3.'],

  ['l3_crystal_palace','l3_show_floor',2,'Enter the Level 3 show-floor area.'],
  ['l3_show_floor','l3_comic_district',4],
  ['l3_show_floor','l3_hall_d_elevators',2],
  ['l3_show_floor','l3_north_access',3],

  ['l3_hall_d_elevators','l4_river_entry',2,'Use the Hall D elevators between Level 3 and the River Pavilion.'],
  ['l4_river_entry','l4_pro_stage1',2],
  ['l4_river_entry','l4_networking',1],
  ['l4_river_entry','l4_press_lounge',1],
  ['l4_river_entry','l4_pro_stage2',2],

  ['l2_north_elevator','l4_north_core',3,'Use the Level 2 elevator bank in Javits North between Level 2 and the Level 4 panel rooms.'],
  ['l4_north_core','l4_room409',2],
  ['l4_north_core','l4_room408',2],
  ['l4_north_core','l4_room4061',2],
  ['l4_north_core','l4_room4062',2],
  ['l4_north_core','l4_room4063',2],
  ['l4_north_core','l4_room405',1],

  ['l4_north_core','l5_core',2,'Use the vertical access between Level 4 and Level 5.'],
  ['l5_core','l5_empire_queue',1],
  ['l5_empire_queue','l5_empire_stage',1]
];
