export const PROFILE_AVATARS=[
  {id:'lion',label:'Lion',image:'./assets/avatar-lion.jpeg'},
  {id:'elephant',label:'Elephant',image:'./assets/avatar-elephant.jpeg'},
  {id:'giraffe',label:'Giraffe',image:'./assets/avatar-giraffe.jpeg'},
  {id:'zebra',label:'Zebra',image:'./assets/avatar-zebra.jpeg'},
  {id:'rhino',label:'Rhino',image:'./assets/avatar-rhino.jpeg'},
  {id:'turtle',label:'Turtle',image:'./assets/avatar-turtle.jpeg'},
  {id:'monkey',label:'Monkey',image:'./assets/avatar-monkey.jpeg'},
  {id:'meerkat',label:'Meerkat',image:'./assets/avatar-meerkat.jpeg'},
  {id:'parrot',label:'Parrot',image:'./assets/avatar-parrot.jpeg'},
  {id:'tiger',label:'Tiger',image:'./assets/avatar-tiger.jpeg'}
];

export function avatarById(id='lion'){const legacy={cyan:'lion',violet:'zebra',sunset:'tiger',ocean:'elephant',lime:'giraffe',rose:'meerkat',gold:'lion',kids:'monkey'};const key=legacy[id]||id;return PROFILE_AVATARS.find(x=>x.id===key)||PROFILE_AVATARS[0]}

export function makeProfile({id='',name='Profile',avatar='lion',kids=false,pinHash='',pinSalt='',myList=[],continueWatching=[],watchHistory=[],recentLive=[],liveFavourites=[],profileSettings={}}={}){
  return {
    id:id||`profile-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    name:String(name||'Profile').trim().slice(0,24)||'Profile',
    avatar:avatarById(avatar).id,
    kids:Boolean(kids),
    pinHash:String(pinHash||''),
    pinSalt:String(pinSalt||''),
    myList:Array.isArray(myList)?myList:[],
    continueWatching:Array.isArray(continueWatching)?continueWatching:[],
    watchHistory:Array.isArray(watchHistory)?watchHistory:[],
    recentLive:Array.isArray(recentLive)?recentLive:[],
    liveFavourites:Array.isArray(liveFavourites)?liveFavourites:[],
    profileSettings:profileSettings&&typeof profileSettings==='object'?{...profileSettings}:{},
    createdAt:Date.now()
  };
}

export function normalizeProfile(profile={},defaults={}){
  const p=makeProfile({...defaults,...profile,id:profile.id||defaults.id});
  p.createdAt=Number(profile.createdAt||p.createdAt);
  return p;
}

function certificationToken(item={}){
  const certification=String(item.certification||item.ratingCode||item.contentRating||'').toUpperCase().replace(/\s+/g,'');
  return certification;
}

export function profileAllowsMedia(profile,item,metadata={}){
  if(!profile?.kids)return true;
  const text=`${item?.name||''} ${item?.group||''} ${item?.genre||''} ${metadata?.genres||''}`.toLowerCase();
  if(/\b(adult|xxx|18\+|porn|erotic|playboy|explicit)\b/.test(text))return false;
  const cert=certificationToken({...item,...metadata});
  if(!cert)return true;
  const blocked=['M','MA15+','MA15','R18+','R18','X18+','X18','R','NC-17','NC17','TV-14','TV14','TV-MA','TVMA','18','15'];
  return !blocked.includes(cert);
}

export function profileGenreAffinity(history=[],resolveItem=()=>null,resolveGenres=()=>[]){
  const scores=new Map();
  history.slice(0,30).forEach((entry,index)=>{
    const item=resolveItem(entry?.id)||entry?.item||entry;
    const weight=Math.max(.3,1.8-index*.045);
    for(const genre of resolveGenres(item)||[]){const key=String(genre||'').toLowerCase().trim();if(key)scores.set(key,(scores.get(key)||0)+weight)}
  });
  return scores;
}

export function smartRankRows(defs=[],affinity=new Map()){
  const fixed=new Map([['continue',140],['top20-movies',130],['top20-shows',129],['recommended',110],['recently-watched',104],['recent-live',92],['mylist',88],['trending-movies',76],['trending-shows',75]]);
  return defs.map((def,index)=>{
    let score=fixed.get(def.id)??Math.max(0,55-index*.1);
    const label=`${def.label||''} ${def.id||''}`.toLowerCase();
    for(const [genre,value] of affinity){if(label.includes(genre))score+=value*7}
    return {def,index,score};
  }).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.def);
}
