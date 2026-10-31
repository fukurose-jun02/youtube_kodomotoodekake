// UIパーツ：オートコンプリート検索／カルーセル／ボトムシート／スクロールロック
const { useState: uxS, useEffect: uxE, useRef: uxR, useMemo: uxM } = React;

function useScrollLock(active){
  uxE(()=>{
    if(!active) return;
    const o=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{document.body.style.overflow=o;};
  },[active]);
}

function SearchAuto({ value, onChange, videos, onSubmit }){
  const [text,setText]=uxS(value);
  const [open,setOpen]=uxS(false);
  const [hi,setHi]=uxS(-1);
  const composing=uxR(false);
  // スマホ幅では、プレースホルダーを短い案内文にする
  const [narrow,setNarrow]=uxS(()=>window.matchMedia('(max-width:640px)').matches);
  uxE(()=>{const mq=window.matchMedia('(max-width:640px)');const f=e=>setNarrow(e.matches);mq.addEventListener('change',f);return ()=>mq.removeEventListener('change',f);},[]);
  uxE(()=>{ if(!composing.current) setText(value); },[value]);
  const q=text.trim().toLowerCase();
  const sugg=uxM(()=>{
    if(!q) return [];
    const seen=new Set(),out=[];
    for(const v of videos){
      // 題名に一致しなければ、スポット名・住所に一致したものを候補にする
      const label=[v.title,v.spot,v.place].find(t=>t&&t.toLowerCase().includes(q));
      if(label&&!seen.has(label)){seen.add(label);out.push({...v,label});}
      if(out.length>=6) break;
    }
    return out;
  },[q,videos]);
  const commit=t=>{setText(t);onChange(t);setOpen(false);setHi(-1);};
  const onKey=e=>{
    if(e.nativeEvent.isComposing||e.keyCode===229) return;
    if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setHi(h=>Math.min(h+1,sugg.length-1));}
    else if(e.key==='ArrowUp'){e.preventDefault();setHi(h=>Math.max(h-1,-1));}
    else if(e.key==='Enter'){ if(open&&hi>=0&&sugg[hi]){e.preventDefault();commit(sugg[hi].label);} else { setOpen(false); if(onSubmit&&text.trim()) onSubmit(); } }
    else if(e.key==='Escape'){setOpen(false);setHi(-1);}
  };
  const mark=t=>{
    const i=t.toLowerCase().indexOf(q);
    if(i<0) return t;
    return <>{t.slice(0,i)}<mark className="sa-mark">{t.slice(i,i+q.length)}</mark>{t.slice(i+q.length)}</>;
  };
  const showList=open&&q.length>0;
  return (
    <div className="sa-wrap">
      <div className="inview visible" data-ui="search" style={{
        background:'white', borderRadius:'14px', padding:'8px 16px',
        display:'flex', alignItems:'center', gap:'10px',
        boxShadow:'0 2px 12px rgba(60,40,10,0.1)'
      }}>
        <img className="sa-icon" src="icons/ui-search.png" alt="" width="24" height="24" style={{flexShrink:0}}/>
        <input type="text" value={text} placeholder={narrow?'場所・施設・キーワードで探す':'動画を検索…（例：プール、万博）'}
          role="combobox" aria-expanded={showList} aria-controls="sa-list" aria-autocomplete="list"
          aria-activedescendant={hi>=0?`sa-opt-${hi}`:undefined}
          onChange={e=>{setText(e.target.value);setOpen(true);setHi(-1);if(!composing.current&&!e.nativeEvent.isComposing) onChange(e.target.value);}}
          onCompositionStart={()=>{composing.current=true;}}
          onCompositionEnd={e=>{composing.current=false;onChange(e.target.value);}}
          onKeyDown={onKey}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),120)}
          style={{border:'none', outline:'none', width:'100%', fontFamily:"'Zen Maru Gothic',sans-serif", fontSize:'14px', color:'#3d2e1e', background:'transparent'}}/>
        <button className="sa-go" onClick={()=>{commit(text);if(onSubmit) onSubmit();}}>検索する</button>
        {text && (
          <button aria-label="検索をクリア" onClick={()=>commit('')} style={{background:'none', border:'none', cursor:'pointer', color:'#a09080', fontSize:'18px', lineHeight:1, minWidth:'28px', minHeight:'28px'}}>×</button>
        )}
      </div>
      {showList && (
        <ul id="sa-list" role="listbox" className="sa-list">
          {sugg.length===0 && <li className="sa-empty">候補が見つからないよ</li>}
          {sugg.map((v,i)=>(
            <li key={v.id} id={`sa-opt-${i}`} role="option" aria-selected={i===hi}
              className={`sa-opt${i===hi?' is-hi':''}`}
              onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setHi(i)} onClick={()=>commit(v.label)}>
              <img src={`https://img.youtube.com/vi/${v.id}/default.jpg`} alt="" className="sa-thumb"/>
              <span className="sa-title">{mark(v.label)}</span>
              <span className="sa-meta">{v.cat}・{v.year}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Carousel({ title, videos, onPlay, Card, primary, onMore }){
  const ref=uxR(null);
  const [idx,setIdx]=uxS(0);
  const [edge,setEdge]=uxS({start:true,end:false});
  const step=()=>{const el=ref.current;if(!el||!el.children[0])return 260;return el.children[0].offsetWidth+16;};
  const onScroll=()=>{
    const el=ref.current;if(!el)return;
    setIdx(Math.min(videos.length-1,Math.round(el.scrollLeft/step())));
    setEdge({start:el.scrollLeft<4,end:el.scrollLeft+el.clientWidth>=el.scrollWidth-4});
  };
  uxE(()=>{onScroll();},[videos.length]);
  const go=n=>{const el=ref.current;if(el) el.scrollTo({left:Math.max(0,n)*step(),behavior:'smooth'});};
  return (
    <section className="cr" aria-roledescription="carousel" aria-label={title}>
      <div className="cr-head">
        <h2 className="cr-title" data-ui="sec-title">{title}</h2>
        {onMore && <button className="cr-more" onClick={onMore}>もっと見る ›</button>}
        <div className="cr-btns">
          <button className="cr-btn" aria-label="前へ" disabled={edge.start} onClick={()=>go(idx-1)}>‹</button>
          <button className="cr-btn" aria-label="次へ" disabled={edge.end} onClick={()=>go(idx+1)}>›</button>
        </div>
      </div>
      <div className="cr-track" ref={ref} onScroll={onScroll}>
        {videos.map((v,i)=>(
          <div className="cr-slide" key={v.id} aria-label={`${i+1} / ${videos.length}`}>
            <Card video={v} onPlay={onPlay} primary={primary} delayIdx={0}/>
          </div>
        ))}
      </div>
      <div className="cr-dots">
        {videos.map((v,i)=>(
          <button key={v.id} className={`cr-dot${i===idx?' on':''}`} aria-label={`${i+1}番目へ`} aria-current={i===idx} onClick={()=>go(i)}></button>
        ))}
      </div>
    </section>
  );
}

function FilterSheet({ open, onClose, years, cats, activeCat, activeYear, onCat, onYear, count }){
  const [full,setFull]=uxS(false);
  const [dy,setDy]=uxS(0);
  const drag=uxR(null);
  useScrollLock(open);
  uxE(()=>{
    if(!open){setFull(false);setDy(0);return;}
    const fn=e=>{if(e.key==='Escape') onClose();};
    document.addEventListener('keydown',fn);
    return ()=>document.removeEventListener('keydown',fn);
  },[open]);
  if(!open) return null;
  const down=e=>{drag.current={y:e.clientY,moved:false};e.currentTarget.setPointerCapture(e.pointerId);};
  const move=e=>{if(!drag.current)return;const d=e.clientY-drag.current.y;if(Math.abs(d)>4)drag.current.moved=true;setDy(d);};
  const up=()=>{
    if(!drag.current)return;
    const moved=drag.current.moved;drag.current=null;
    if(!moved){setFull(f=>!f);setDy(0);return;}
    if(dy<-40) setFull(true);
    else if(dy>80){ if(full) setFull(false); else onClose(); }
    setDy(0);
  };
  // 親パネル（z-index・backdrop-filter）の重なり順に閉じ込められないよう、テーマ属性を持つ .app-root 直下に出す
  const host=document.querySelector('.app-root')||document.body;
  return ReactDOM.createPortal(
    <div className="bs-root">
      <div className="bs-backdrop" onClick={onClose}></div>
      <div className="bs-sheet" data-ui="sheet" role="dialog" aria-modal="true" aria-label="しぼりこみ"
        style={{height:full?'88vh':'52vh',transform:`translateY(${Math.max(dy,-60)}px)`,transition:drag.current?'none':'height .28s ease, transform .28s ease'}}>
        <div className="bs-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          role="button" aria-label={full?'シートをちいさくする':'シートをひろげる'} tabIndex={0}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setFull(f=>!f);}}}>
          <span></span>
        </div>
        <div className="bs-head">
          <h2 data-ui="sec-title">しぼりこみ</h2>
          <button className="bs-close" aria-label="閉じる" onClick={onClose}>✕</button>
        </div>
        <div className="bs-body">
          <label className="bs-label" htmlFor="bs-year">年</label>
          <select id="bs-year" className="bs-select" value={activeYear} onChange={e=>onYear(e.target.value)}>
            {years.map(y=><option key={y} value={y}>{y==='すべて'?'すべての年':`${y}年`}</option>)}
          </select>
          <div className="bs-label">カテゴリ</div>
          <div className="bs-chips">
            {cats.map(c=>(
              <button key={c} data-ui="chip" data-active={c===activeCat?'1':'0'} className="bs-chip" onClick={()=>onCat(c)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="bs-foot">
          <button className="bs-reset" onClick={()=>{onCat('すべて');onYear('すべて');}}>リセット</button>
          <button className="bs-go" onClick={onClose}>{count}本を見る</button>
        </div>
      </div>
    </div>,
    host
  );
}

function CountLabel({ count, cat, year, search }){
  const [shown,setShown]=uxS(count);
  const from=uxR(count);
  uxE(()=>{
    const a=from.current,b=count,t0=performance.now();let raf;
    const tick=t=>{const p=Math.min(1,(t-t0)/520);const v=Math.round(a+(b-a)*(1-Math.pow(1-p,3)));setShown(v);if(p<1)raf=requestAnimationFrame(tick);else from.current=b;};
    raf=requestAnimationFrame(tick);
    return ()=>{cancelAnimationFrame(raf);from.current=b;};
  },[count]);
  const parts=[];
  if(year&&year!=='すべて') parts.push(`${year}年`);
  if(cat&&cat!=='すべて') parts.push(cat);
  const q=(search||'').trim();
  const label=parts.join('の')+(q?`${parts.length?'で':''}「${q}」`:'');
  return (
    <div data-ui="count" className="cnt" aria-live="polite">
      <svg className="cnt-acorn" viewBox="-14 -18 28 42" aria-hidden="true"><path d="M-11,-2 C-11,14 -4,22 0,24 C4,22 11,14 11,-2Z" fill="#c98a3a"/><path d="M-13,-2 C-13,-12 13,-12 13,-2 C6,1 -6,1 -13,-2Z" fill="#7a5226"/><rect x="-1.5" y="-16" width="3" height="7" rx="1.5" fill="#5a3a18"/><ellipse cx="-4" cy="8" rx="2" ry="5" fill="rgba(255,240,200,.45)"/></svg>
      {label ? <span className="cnt-txt">{label}の おもいでを</span> : <span className="cnt-txt">もりのなかで おもいでを</span>}
      <b className="cnt-num" key={count}>{shown}</b>
      <span className="cnt-txt">{count===0?'こ…みつからないよ':'こ みつけたよ！'}</span>
    </div>
  );
}

Object.assign(window,{useScrollLock,SearchAuto,Carousel,FilterSheet,CountLabel});
