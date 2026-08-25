export const SWOOP_THEMES=[
  {
    id:'chill',
    name:'Chill',
    tagline:'Cinema after dark',
    description:'Black, red and cinematic. Big artwork, bold rails and a relaxed premium streaming feel.',
    bg:'#050505',surface:'#111216',surface2:'#181a20',surface3:'#22242b',accent:'#e50914',accent2:'#ff4d61',text:'#ffffff',muted:'#a9adb8',
    swatch:'linear-gradient(135deg,#050505 0 48%,#e50914 48% 72%,#ff5968 72%)'
  },
  {
    id:'prime-time',
    name:'Prime Time',
    tagline:'Clean blue streaming',
    description:'Cool blue, deep navy and spacious cards with a sleek modern streaming-service presentation.',
    bg:'#07131f',surface:'#0c1c2c',surface2:'#10283d',surface3:'#15344e',accent:'#00a8e1',accent2:'#45c7ff',text:'#f7fbff',muted:'#a9bdd0',
    swatch:'linear-gradient(135deg,#06131f 0 45%,#00a8e1 45% 72%,#56d4ff 72%)'
  },
  {
    id:'rewind',
    name:'Rewind',
    tagline:'Your video store is open',
    description:'Deep rental-store blue, bright yellow and bold shelf-like rows with a nostalgic video-shop personality.',
    bg:'#061c68',surface:'#0a2a88',surface2:'#10399c',surface3:'#1747b2',accent:'#ffd51f',accent2:'#ffffff',text:'#ffffff',muted:'#d7e1ff',
    swatch:'linear-gradient(135deg,#061c68 0 55%,#ffd51f 55% 78%,#ffffff 78%)'
  },
  {
    id:'vice',
    name:'Vice',
    tagline:'After dark on Swoop TV',
    description:'Neon cyan, hot pink and deep purple with sunset gradients and a high-energy Miami-night feel.',
    bg:'#130927',surface:'#21103d',surface2:'#2d1452',surface3:'#3a1965',accent:'#ff4fc3',accent2:'#2de2e6',text:'#fff8ff',muted:'#c7b4d9',
    swatch:'linear-gradient(135deg,#130927 0 35%,#7c38ff 35% 55%,#ff4fc3 55% 75%,#2de2e6 75%)'
  }
];

export function themeById(id='chill'){
  return SWOOP_THEMES.find(theme=>theme.id===id)||SWOOP_THEMES[0];
}
