export const SWOOP_THEMES=[
  {
    id:'swoop',
    name:'Swoop',
    tagline:'Neon signature',
    description:'Deep black, hot magenta and electric cyan inspired by the Swoop TV logo. Premium glass controls and restrained neon highlights.',
    bg:'#030306',surface:'#0b0b12',surface2:'#12121d',surface3:'#1a1a29',accent:'#ff2bbd',accent2:'#18e6f2',text:'#ffffff',muted:'#b7b4c6',
    swatch:'linear-gradient(135deg,#030306 0 44%,#ff2bbd 44% 68%,#18e6f2 68%)'
  },
  {
    id:'chill',
    name:'Chill',
    tagline:'Cinematic black & red',
    description:'A restrained Netflix-style cinema look with deep black surfaces, crisp white type and a red streaming accent.',
    bg:'#050505',surface:'#101010',surface2:'#171717',surface3:'#202020',accent:'#e50914',accent2:'#ff4b55',text:'#ffffff',muted:'#b3b3b3',
    swatch:'linear-gradient(135deg,#050505 0 58%,#e50914 58% 80%,#ffffff 80%)'
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
  }
];

export function themeById(id='swoop'){
  const aliases={vice:'swoop'};
  const key=aliases[id]||id;
  return SWOOP_THEMES.find(theme=>theme.id===key)||SWOOP_THEMES[0];
}
