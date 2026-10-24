// テーマ別の背景イラスト（固定レイヤー）
function bdRng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const BD_LEAF={
  oval:<g><path d="M0,-20 C12,-12 12,12 0,20 C-12,12 -12,-12 0,-20Z"/><path d="M0,-18 L0,24 M0,-6 L6,-10 M0,2 L-6,-3 M0,9 L6,5" stroke="rgba(60,30,10,.35)" strokeWidth="1.4" fill="none"/></g>,
  maple:<g><path d="M0,-22 L5,-10 L16,-15 L11,-3 L21,2 L9,6 L12,16 L2,10 L0,20 L-2,10 L-12,16 L-9,6 L-21,2 L-11,-3 L-16,-15 L-5,-10Z"/><path d="M0,-16 L0,26 M0,4 L12,-8 M0,4 L-12,-8" stroke="rgba(60,30,10,.3)" strokeWidth="1.3" fill="none"/></g>,
  ginkgo:<g><path d="M0,8 C-14,4 -21,-10 -17,-19 C-8,-14 8,-14 17,-19 C21,-10 14,4 0,8Z"/><path d="M0,8 L0,24" stroke="rgba(60,30,10,.4)" strokeWidth="1.6"/><path d="M0,6 L-8,-14 M0,6 L0,-15 M0,6 L8,-14" stroke="rgba(60,30,10,.18)" strokeWidth="1"/></g>,
  acorn:<g><path d="M-11,-2 C-11,14 -4,22 0,24 C4,22 11,14 11,-2Z" fill="#c98a3a"/><path d="M-13,-2 C-13,-12 13,-12 13,-2 C6,1 -6,1 -13,-2Z" fill="#7a5226"/><path d="M-9,-6 L9,-6 M-11,-3 L11,-3" stroke="rgba(40,20,5,.3)" strokeWidth="1"/><rect x="-1.5" y="-16" width="3" height="7" rx="1.5" fill="#5a3a18"/><ellipse cx="-4" cy="8" rx="2" ry="5" fill="rgba(255,240,200,.35)"/></g>,
  curl:<g><path d="M0,-20 C12,-12 12,12 0,20 C-5,10 -6,-10 0,-20Z"/><path d="M0,-20 C-11,-12 -11,12 0,20 C-5,10 -6,-10 0,-20Z"/><path d="M0,-20 C-11,-12 -11,12 0,20 C-5,10 -6,-10 0,-20Z" fill="rgba(40,20,5,.24)"/><path d="M0,20 L1,27" stroke="rgba(60,30,10,.45)" strokeWidth="1.6"/></g>,
  nut:<g><path d="M-10,-6 C-10,12 -4,20 0,22 C4,20 10,12 10,-6 C6,-10 -6,-10 -10,-6Z" fill="#b8793a"/><ellipse cx="-3" cy="4" rx="2" ry="5" fill="rgba(255,240,200,.35)"/><circle cx="0" cy="-7" r="2" fill="#6a4420"/></g>,
  cap:<g><path d="M-13,2 C-13,-10 13,-10 13,2 C6,5 -6,5 -13,2Z" fill="#7a5226"/><path d="M-9,-3 L9,-3" stroke="rgba(40,20,5,.3)" strokeWidth="1"/><rect x="-1.5" y="-13" width="3" height="6" rx="1.5" fill="#5a3a18"/></g>,
  twig:<g fill="none" stroke="#6a4824" strokeLinecap="round"><path d="M-24,4 Q-6,-2 8,2 T24,-4" strokeWidth="3"/><path d="M-2,0 L6,-10" strokeWidth="2"/><path d="M12,1 L16,8" strokeWidth="1.6"/></g>,
};
const BD_LEAF_COLORS=['#d9822b','#c0562a','#e8b04a','#b8742a','#9aa548','#d4a03a','#a8462a'];

const BD_LAYER={far:{o:[.22,.36],f:'blur(.6px) saturate(.7)'},mid:{o:[.5,.85],f:'none'},near:{o:[.38,.55],f:'blur(2.6px)'}};
function bdLeafColor(r){
  if(r()<.13) return `hsl(${68+r()*28} ${28+r()*22}% ${36+r()*14}%)`;
  if(r()<.12) return `hsl(${44+r()*8} ${62+r()*20}% ${55+r()*10}%)`;
  return `hsl(${12+r()*30} ${42+r()*32}% ${34+r()*24}%)`;
}
function PopBackdrop(){
  const items=React.useMemo(()=>{
    const r=bdRng(20261024),g=()=>(r()+r()+r()-1.5)/1.5,out=[];
    const kind=()=>{const x=r();return x<.25?'oval':x<.46?'maple':x<.59?'ginkgo':x<.7?'curl':x<.8?'acorn':x<.86?'nut':x<.93?'cap':'twig';};
    const push=(x,y,s,layer)=>{
      const k=kind(),small=k==='acorn'||k==='nut'||k==='cap',L=BD_LAYER[layer];
      out.push({k,x,y,layer,s:small?s*.68:s,rot:r()*360,sx:.74+r()*.44,sk:g()*10,c:bdLeafColor(r),
        o:L.o[0]+r()*(L.o[1]-L.o[0]),f:L.f,
        hole:r()<.24&&(k==='oval'||k==='maple'||k==='curl')?[g()*6,g()*9,1.3+r()*2.4]:null,
        sway:layer!=='near'&&r()<.24,sw:3+r()*13,dur:5+r()*10,d:-r()*14});
    };
    for(let i=0;i<18;i++) push(r()*100,r()*100,10+r()*13,'far');
    for(let i=0;i<10;i++){
      const e=r();let cx,cy;
      if(e<.34){cx=r()*100;cy=88+r()*14;} else if(e<.58){cx=-3+r()*13;cy=r()*100;} else if(e<.82){cx=90+r()*13;cy=r()*100;} else {cx=18+r()*64;cy=8+r()*70;}
      const n=e>=.82?1+Math.floor(r()*3):3+Math.floor(r()*9),sp=3+r()*8;
      for(let j=0;j<n;j++) push(cx+g()*sp,cy+g()*sp*1.4,22+r()*32,'mid');
    }
    for(let i=0;i<5;i++){const lf=r()<.5;push(lf?-6+r()*9:93+r()*9,r()*104,80+r()*80,'near');}
    return out;
  },[]);
  const falling=React.useMemo(()=>{
    const r=bdRng(77),out=[],eases=['linear','cubic-bezier(.4,.1,.6,.9)','cubic-bezier(.25,.05,.7,1)'];
    for(let i=0;i<11;i++){
      const near=i<2,dx=()=>(r()-.5)*170;let x1=dx(),x2=x1+dx(),x3=x2+dx(),x4=x3+dx();
      out.push({k:['oval','maple','ginkgo','curl'][Math.floor(r()*4)],x:r()*100,s:near?48+r()*24:16+r()*24,blur:near?'blur(2px)':'none',c:bdLeafColor(r),
        dur:near?11+r()*6:14+r()*22,d:-r()*40,ease:eases[Math.floor(r()*3)],x1,x2,x3,x4,rt:(r()<.5?-1:1)*(160+r()*560),flip:1.3+r()*2.8,fd:-r()*3,sx:.8+r()*.35});
    }
    return out;
  },[]);
  return (
    <div className="bd-layer">
      <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100" style={{position:'absolute',inset:0}}>
        <ellipse cx="12" cy="104" rx="30" ry="12" fill="#c9a26a" opacity=".28"/>
        <ellipse cx="62" cy="106" rx="44" ry="12" fill="#b88a50" opacity=".22"/>
        <ellipse cx="96" cy="102" rx="22" ry="10" fill="#c9a26a" opacity=".26"/>
      </svg>
      {items.map((it,i)=>(
        <svg key={i} viewBox="-28 -28 56 56" className={it.sway?'bd-sway':''} style={{position:'absolute',left:`${it.x}%`,top:`${it.y}%`,width:it.s,height:it.s,marginLeft:-it.s/2,marginTop:-it.s/2,opacity:it.o,filter:it.f,transform:`rotate(${it.rot}deg)`,animationDelay:`${it.d}s`,animationDuration:`${it.dur}s`,['--r']:`${it.rot}deg`,['--sw']:`${it.sw}deg`}}>
          <g fill={it.c} transform={`scale(${it.sx},1) skewX(${it.sk})`}>{BD_LEAF[it.k]}</g>
          {it.hole && <circle cx={it.hole[0]} cy={it.hole[1]} r={it.hole[2]} fill="#f3e6cb"/>}
        </svg>
      ))}
      {falling.map((it,i)=>(
        <div key={'f'+i} className="bd-fall" style={{left:`${it.x}%`,filter:it.blur,animationDuration:`${it.dur}s`,animationDelay:`${it.d}s`,animationTimingFunction:it.ease,['--x1']:`${it.x1}px`,['--x2']:`${it.x2}px`,['--x3']:`${it.x3}px`,['--x4']:`${it.x4}px`,['--rt']:`${it.rt}deg`}}>
          <div className="bd-flip" style={{animationDuration:`${it.flip}s`,animationDelay:`${it.fd}s`}}>
            <svg viewBox="-28 -28 56 56" style={{width:it.s,height:it.s,display:'block'}}><g fill={it.c} transform={`scale(${it.sx},1)`}>{BD_LEAF[it.k]}</g></svg>
          </div>
        </div>
      ))}
    </div>
  );
}

function EhonBackdrop(){
  return (
    <div className="bd-layer">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{position:'absolute',inset:0}}>
        <defs>
          <filter id="bdWob"><feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="9"/></filter>
          <filter id="bdSoft"><feGaussianBlur stdDeviation="6"/></filter>
          <linearGradient id="bdSpine" x1="0" x2="1"><stop offset="0" stopColor="#c9a878" stopOpacity="0"/><stop offset=".5" stopColor="#a8875a" stopOpacity=".45"/><stop offset="1" stopColor="#c9a878" stopOpacity="0"/></linearGradient>
        </defs>
        <g opacity=".62" filter="url(#bdWob)">
          <path d="M120,170 C320,120 620,110 800,170 L800,930 C620,880 320,880 120,930Z" fill="#e8d6b4" transform="translate(-14,16)"/>
          <path d="M1480,170 C1280,120 980,110 800,170 L800,930 C980,880 1280,880 1480,930Z" fill="#e8d6b4" transform="translate(14,16)"/>
          <path d="M120,160 C320,110 620,100 800,160 L800,920 C620,870 320,870 120,920Z" fill="#fffaf0" stroke="#a8875a" strokeWidth="3"/>
          <path d="M1480,160 C1280,110 980,100 800,160 L800,920 C980,870 1280,870 1480,920Z" fill="#fffaf0" stroke="#a8875a" strokeWidth="3"/>
          <rect x="740" y="120" width="120" height="820" fill="url(#bdSpine)"/>
          {/* 左ページ：丘と木と太陽 */}
          <g filter="url(#bdSoft)" opacity=".75">
            <circle cx="620" cy="300" r="70" fill="#f4c76a"/>
            <ellipse cx="330" cy="760" rx="300" ry="120" fill="#a9c97a"/>
            <ellipse cx="620" cy="790" rx="260" ry="110" fill="#8fb862"/>
            <ellipse cx="300" cy="470" rx="110" ry="120" fill="#6f9c48"/>
            <rect x="290" y="520" width="22" height="170" fill="#8a6038"/>
            <ellipse cx="520" cy="640" rx="60" ry="64" fill="#7fae56"/>
            <rect x="514" y="680" width="12" height="70" fill="#8a6038"/>
          </g>
          <g fill="none" stroke="#7a5a3a" strokeWidth="3" strokeLinecap="round" opacity=".55">
            <path d="M200,330 q30,-20 60,0 q30,20 60,0"/><path d="M360,270 q20,-14 40,0 q20,14 40,0"/>
          </g>
          {/* 右ページ：おうちと文字 */}
          <g filter="url(#bdSoft)" opacity=".7">
            <ellipse cx="1200" cy="560" rx="240" ry="70" fill="#a9c97a"/>
            <rect x="1110" y="420" width="170" height="130" fill="#e7a56a"/>
            <path d="M1090,425 L1195,330 L1300,425Z" fill="#b5532f"/>
            <rect x="1175" y="470" width="40" height="80" fill="#7a4a28"/>
            <circle cx="1400" cy="300" r="34" fill="#9cc6e0"/>
          </g>
          <g stroke="#b9a283" strokeWidth="10" strokeLinecap="round" opacity=".5">
            <line x1="940" y1="680" x2="1380" y2="680"/><line x1="940" y1="730" x2="1340" y2="730"/><line x1="940" y1="780" x2="1300" y2="780"/><line x1="940" y1="830" x2="1220" y2="830"/>
          </g>
        </g>
      </svg>
    </div>
  );
}

function KraftBackdrop(){
  const leaves=React.useMemo(()=>{
    const r=bdRng(13),out=[],greens=['#3f6b22','#557f2c','#2f5418','#6c9a38','#4a7a26','#86ad4a'];
    for(let i=0;i<130;i++){
      const a=r()*Math.PI*2, d=560+r()*420;
      out.push({x:720+Math.cos(a)*d*1.35,y:420+Math.sin(a)*d,rx:70+r()*120,ry:60+r()*100,c:greens[Math.floor(r()*greens.length)],o:.55+r()*.4});
    }
    return out;
  },[]);
  const trunks=[[-80,1000,140,520,560,0.06],[1520,1000,1300,520,880,-0.04],[-120,300,120,260,540,0.02],[1560,260,1320,240,900,-0.02],[380,1000,180,620,640,0.03],[1100,1000,140,640,820,-0.03]];
  return (
    <div className="bd-layer">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{position:'absolute',inset:0}}>
        <defs>
          <radialGradient id="bdSky" cx="50%" cy="46%" r="52%">
            <stop offset="0" stopColor="#ffffff"/><stop offset=".28" stopColor="#dff0fa"/><stop offset=".62" stopColor="#9fcbe8"/><stop offset="1" stopColor="#7fb2d8"/>
          </radialGradient>
          <radialGradient id="bdSun" cx="50%" cy="46%" r="22%"><stop offset="0" stopColor="#fffbe6" stopOpacity=".95"/><stop offset="1" stopColor="#fffbe6" stopOpacity="0"/></radialGradient>
          <filter id="bdWc"><feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="9"/><feDisplacementMap in="SourceGraphic" scale="40"/></filter>
          <filter id="bdBlur"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>
        <rect width="1440" height="900" fill="url(#bdSky)"/>
        <g fill="#ffffff" opacity=".8" filter="url(#bdBlur)">
          <ellipse cx="560" cy="330" rx="90" ry="26"/><ellipse cx="610" cy="316" rx="60" ry="24"/>
          <ellipse cx="900" cy="500" rx="110" ry="28"/><ellipse cx="960" cy="486" rx="64" ry="24"/>
        </g>
        <g filter="url(#bdWc)">
          {trunks.map(([x1,y1,w,x2,y2],i)=>{
            const tx=(x2+720)/2*0+x2, ty=y2*0+ (i<2?380:i<4?360:400);
            return <path key={i} d={`M${x1-w/2},${y1} Q${(x1+tx)/2},${(y1+ty)/2+40} ${tx-6},${ty} L${tx+6},${ty} Q${(x1+tx)/2+30},${(y1+ty)/2+60} ${x1+w/2},${y1}Z`} fill={i%2?'#4a3018':'#5a3a1e'} opacity=".92"/>;
          })}
          {leaves.map((l,i)=><ellipse key={i} cx={l.x} cy={l.y} rx={l.rx} ry={l.ry} fill={l.c} opacity={l.o}/>)}
        </g>
        <rect width="1440" height="900" fill="url(#bdSun)"/>
        <g fill="#fff8d0" opacity=".35" filter="url(#bdBlur)">
          <circle cx="430" cy="250" r="14"/><circle cx="1020" cy="300" r="10"/><circle cx="760" cy="180" r="8"/><circle cx="1110" cy="640" r="12"/><circle cx="360" cy="620" r="9"/>
        </g>
      </svg>
    </div>
  );
}

function ThemeBackdrop({theme,image}){
  if(image) return <div className="bd-layer" style={{backgroundImage:`url("${image}")`,backgroundSize:'cover',backgroundPosition:'center',opacity:.9}}></div>;
  if(theme==='pop') return <PopBackdrop/>;
  if(theme==='ehon') return <EhonBackdrop/>;
  if(theme==='kraft') return <KraftBackdrop/>;
  return null;
}

Object.assign(window,{ThemeBackdrop});
