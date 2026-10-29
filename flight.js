/* Little Explorer. An original lightweight 3D mesh renderer and flight toy.
   Runs without a server, external game engine, model, or network request. */
(() => {
  'use strict';
  const find = s => document.querySelector(s);
  const viewport = find('#flight-viewport');
  const canvas = find('#flight-canvas');
  const ctx = canvas.getContext('2d');
  const root = find('.flight-root');
  const dialog = find('#flight-dialog');
  const launch = find('#launch-flight');
  const hud = find('.flight-hud');
  const instructions = find('.flight-instructions');
  const feedback = find('#flight-feedback');
  const boostButton = find('#flight-boost');
  let width=0, height=0, ratio=1, playing=false, visible=true, boosting=false;
  let time=0, last=0, px=0, py=0, tx=0, ty=0, vx=0, vy=0, score=0, spin=0;
  let gates=[], bursts=[], keys=new Set(), feedbackUntil=0, dragging=false;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const rand=(i)=>{const v=Math.sin(i*127.1+78.233)*43758.5453;return v-Math.floor(v)};
  const stars=Array.from({length:115},(_,i)=>({x:(rand(i+2)-.5)*2,y:(rand(i+213)-.5)*2,z:rand(i+411)*8+.2}));
  const colors={shell:[217,210,231],suit:[185,172,209],purple:[111,83,151],light:[237,229,248],dark:[44,35,62],visor:[39,40,65],glow:[148,232,227],sole:[84,67,111],gold:[227,199,136]};
  function resize(){const r=viewport.getBoundingClientRect();width=r.width;height=r.height;ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);draw(0)}
  new ResizeObserver(resize).observe(viewport);
  new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(viewport);
  function reset(){score=0;px=py=tx=ty=vx=vy=spin=0;bursts=[];keys.clear();boosting=false;boostButton.setAttribute('aria-pressed','false');find('#flight-score').textContent='0';gates=Array.from({length:5},(_,i)=>({x:i===0?0:(rand(i+91)-.5)*1.5,y:i===0?0:(rand(i+76)-.5)*1.2,z:.9+i*3,passed:false}));feedback.classList.remove('visible')}
  launch.onclick=()=>{reset();playing=true;document.body.classList.add('flight-live');find('#flight-dock').append(viewport);hud.hidden=false;instructions.hidden=false;dialog.showModal();document.body.style.overflow='hidden';resize();find('#flight-close').focus()};
  find('#flight-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{playing=false;boosting=false;keys.clear();dragging=false;root.append(viewport);hud.hidden=true;instructions.hidden=true;feedback.classList.remove('visible');document.body.classList.remove('flight-live');document.body.style.overflow='';px=py=tx=ty=0;resize();launch.focus()});
  find('#flight-reset').onclick=reset;
  find('#flight-companion').onclick=()=>launch.click();
  addEventListener('scroll',()=>{const b=find('#flight-companion');b.classList.toggle('visible',scrollY>innerHeight*.7);b.style.setProperty('--companion-tilt',Math.sin(scrollY*.003)*12+'deg')},{passive:true});
  function boost(value){boosting=value;boostButton.setAttribute('aria-pressed',String(value))}
  boostButton.addEventListener('pointerdown',e=>{e.preventDefault();boostButton.setPointerCapture(e.pointerId);boost(true)});
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>boostButton.addEventListener(name,()=>boost(false)));
  boostButton.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();boost(true)}});
  boostButton.addEventListener('keyup',()=>boost(false));
  addEventListener('keydown',e=>{if(!playing)return;const valid=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','Space'];if(valid.includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space')boost(true)}});
  addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Space')boost(false)});
  addEventListener('blur',()=>{keys.clear();boost(false)});
  viewport.addEventListener('pointerdown',e=>{if(e.target!==canvas)return;dragging=true;canvas.setPointerCapture(e.pointerId);steer(e)});
  viewport.addEventListener('pointermove',e=>{if(e.target!==canvas)return;if(e.pointerType==='touch'&&!dragging)return;steer(e)});
  viewport.addEventListener('pointerup',()=>dragging=false);
  viewport.addEventListener('pointercancel',()=>dragging=false);
  viewport.addEventListener('pointerleave',()=>{if(!playing){tx=ty=0}});
  function steer(e){const r=canvas.getBoundingClientRect();const x=clamp(((e.clientX-r.left)/r.width-.5)*2,-1,1),y=clamp(-((e.clientY-r.top)/r.height-.5)*2,-1,1);tx=x*(playing?1:.36);ty=y*(playing?1:.26)}
  function rotate(p,yaw,roll){let x=p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),z=-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);return [x*Math.cos(roll)-p[1]*Math.sin(roll),x*Math.sin(roll)+p[1]*Math.cos(roll),z]}
  const triangles=[];
  // Parameterized ellipsoids form the helmet, visor, torso, limbs, and jetpack.
  function sphere(center,scale,color,yaw,roll,localAngle=0,segments=10,rows=6,emissive=false){
    function vertex(a,b){let x=Math.sin(b)*Math.cos(a)*scale[0],y=Math.cos(b)*scale[1],z=Math.sin(b)*Math.sin(a)*scale[2];const xx=x*Math.cos(localAngle)-y*Math.sin(localAngle),yy=x*Math.sin(localAngle)+y*Math.cos(localAngle);return rotate([xx+center[0],yy+center[1],z+center[2]],yaw,roll)}
    for(let j=0;j<rows;j++)for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,an=(i+1)/segments*Math.PI*2,b=j/rows*Math.PI,bn=(j+1)/rows*Math.PI;const points=[vertex(a,b),vertex(an,b),vertex(an,bn),vertex(a,bn)];for(const ids of [[0,1,2],[0,2,3]]){const p=ids.map(k=>points[k]);const v=p[0],u=p[1],q=p[2];let nx=(u[1]-v[1])*(q[2]-v[2])-(u[2]-v[2])*(q[1]-v[1]),ny=(u[2]-v[2])*(q[0]-v[0])-(u[0]-v[0])*(q[2]-v[2]),nz=(u[0]-v[0])*(q[1]-v[1])-(u[1]-v[1])*(q[0]-v[0]);const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;if(nz<-.1)continue;let light=.3+.7*Math.max(0,nx*-.5+ny*.65+nz*.6);if(emissive)light=.85+light*.15;const spec=emissive?0:Math.pow(Math.max(0,nx*-.3+ny*.55+nz*.8),18)*.3;triangles.push({p,z:(p[0][2]+p[1][2]+p[2][2])/3,color:`rgb(${color.map(c=>Math.min(255,Math.round(c*light+spec*170))).join(',')})`})}}
  }
  function drawPilot(cx,cy,unit,t){
    triangles.length=0;const roll=clamp(-vx*.7,-.32,.32)+Math.sin(t*.9)*.055;const yaw=Math.sin(t*.45)*.16+clamp(vx*1.5,-.45,.45)+spin;const lean=Math.sin(t*2)*.07;
    sphere([0,.05,-.4],[.44,.54,.22],colors.purple,yaw,roll);
    sphere([-.36,-.1,-.37],[.16,.49,.18],colors.sole,yaw,roll);
    sphere([.36,-.1,-.37],[.16,.49,.18],colors.sole,yaw,roll);
    sphere([0,0,0],[.48,.57,.33],colors.suit,yaw,roll);
    sphere([0,.13,.29],[.29,.26,.07],colors.light,yaw,roll);
    sphere([0,.17,.36],[.105,.095,.025],colors.purple,yaw,roll,0,8,6);
    sphere([-.24,-.63,0],[.19,.35,.21],colors.shell,yaw,roll,-.16+lean);
    sphere([.24,-.63,0],[.19,.35,.21],colors.shell,yaw,roll,.16-lean);
    sphere([-.28,-.92,.09],[.23,.16,.28],colors.sole,yaw,roll,-.12);
    sphere([.28,-.92,.09],[.23,.16,.28],colors.sole,yaw,roll,.12);
    sphere([-.58,.02,0],[.16,.39,.19],colors.shell,yaw,roll,-.7-lean);
    sphere([.58,.02,0],[.16,.39,.19],colors.shell,yaw,roll,.7+lean);
    sphere([-.77,-.22,.07],[.19,.18,.2],colors.purple,yaw,roll);
    sphere([.77,-.22,.07],[.19,.18,.2],colors.purple,yaw,roll);
    sphere([0,.65,0],[.38,.13,.32],colors.sole,yaw,roll);
    sphere([0,1.05,0],[.65,.62,.56],colors.shell,yaw,roll,0,16,10);
    sphere([-.64,1.03,-.02],[.12,.22,.2],colors.purple,yaw,roll);
    sphere([.64,1.03,-.02],[.12,.22,.2],colors.purple,yaw,roll);
    sphere([0,1.03,.44],[.55,.35,.17],colors.visor,yaw,roll,0,14,8);
    const blink=Math.sin(t*.33)> .99?.02:.075;
    sphere([-.2,1.08,.597],[.065,blink,.021],colors.glow,yaw,roll,0,8,5,true);
    sphere([.2,1.08,.597],[.065,blink,.021],colors.glow,yaw,roll,0,8,5,true);
    sphere([-.04,1.23,.579],[.18,.018,.012],[119,132,159],yaw,roll,-.3,8,4,true);
    sphere([.42,1.66,-.05],[.025,.19,.025],colors.sole,yaw,roll,.3,6,5);
    sphere([.47,1.82,-.05],[.075,.075,.075],colors.gold,yaw,roll,0,8,5,true);
    // Jet flames have depth and a soft glow, rather than a flat sprite.
    const flame=playing?(boosting?.75:.4):.27+Math.sin(t*12)*.055;
    for(const side of [-1,1]){sphere([side*.36,-.66-flame*.3,-.37],[.11,flame,.12],[189,139,245],yaw,roll,0,8,6,true);sphere([side*.36,-.58-flame*.1,-.3],[.06,flame*.5,.07],[237,214,255],yaw,roll,0,8,6,true)}
    triangles.sort((a,b)=>a.z-b.z);for(const tri of triangles){ctx.beginPath();tri.p.forEach((v,i)=>{const z=5/(5-v[2]*.35),x=cx+v[0]*unit*z,y=cy-v[1]*unit*z;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fillStyle=tri.color;ctx.fill();ctx.lineWidth=.5;ctx.strokeStyle=tri.color;ctx.stroke()}
    // The smile is attached to the same 3D coordinate system as the visor.
    if(Math.cos(yaw)>.4){const pts=[[-.12,.93,.606],[0,.88,.62],[.12,.93,.606]].map(p=>rotate(p,yaw,roll));ctx.beginPath();ctx.moveTo(cx+pts[0][0]*unit,cy-pts[0][1]*unit);ctx.quadraticCurveTo(cx+pts[1][0]*unit,cy-pts[1][1]*unit,cx+pts[2][0]*unit,cy-pts[2][1]*unit);ctx.strokeStyle='#8edbd5';ctx.lineWidth=Math.max(1,unit*.017);ctx.stroke()}
  }
  function drawIsland(x,y,r,angle){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.beginPath();ctx.moveTo(-r,-r*.1);ctx.lineTo(-r*.5,-r*.35);ctx.lineTo(r*.6,-r*.3);ctx.lineTo(r,r*.04);ctx.lineTo(.15*r,.34*r);ctx.closePath();ctx.fillStyle=playing?'#65527d':'#b9accd';ctx.fill();ctx.beginPath();ctx.moveTo(-r,-r*.1);ctx.lineTo(.15*r,.34*r);ctx.lineTo(0,r*1.1);ctx.lineTo(-.65*r,.6*r);ctx.closePath();ctx.fillStyle=playing?'#30233f':'#9786b3';ctx.fill();ctx.beginPath();ctx.moveTo(r,r*.04);ctx.lineTo(.15*r,.34*r);ctx.lineTo(0,r*1.1);ctx.lineTo(.7*r,.6*r);ctx.closePath();ctx.fillStyle=playing?'#473357':'#aa98c0';ctx.fill();ctx.restore()}
  function announce(text){feedback.textContent=text;feedback.classList.add('visible');feedbackUntil=time+1.5}
  function draw(dt){if(!width||!height)return;ctx.clearRect(0,0,width,height);const active=playing||(!reduced&&!motionPaused);if(active)time+=dt;const t=time;
    if(playing){const grad=ctx.createRadialGradient(width*.5,height*.45,0,width*.5,height*.5,Math.max(width,height)*.75);grad.addColorStop(0,boosting?'#35234c':'#231a38');grad.addColorStop(1,'#0a0b16');ctx.fillStyle=grad;ctx.fillRect(0,0,width,height)}
    const cx=width*.5,cy=height*(playing?.5:.46),speed=boosting?3:1;
    // Stars and dust use perspective for a game-like depth field.
    for(let i=0;i<stars.length;i++){const s=stars[i];if(active)s.z-=dt*(playing?speed*.9:.12);if(s.z<.1)s.z=8;const perspective=1/(s.z*.45+.3);const x=cx+s.x*width*.55*perspective-px*12,y=cy+s.y*height*.6*perspective+py*8;if(x<0||x>width||y<0||y>height)continue;ctx.globalAlpha=clamp(1-s.z/10,.15,.85);ctx.fillStyle=playing?'#d3bee9':'#a392b8';ctx.beginPath();ctx.arc(x,y,Math.max(.5,1.3*perspective),0,Math.PI*2);ctx.fill();if(boosting&&playing){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(x-cx)*.04,y+(y-cy)*.04);ctx.strokeStyle='#b99be1';ctx.lineWidth=1;ctx.stroke()}}ctx.globalAlpha=1;
    // Atmospheric orbit lines, floating islands, and a quiet planet.
    if(!playing){const glow=ctx.createRadialGradient(cx,cy,10,cx,cy,width*.42);glow.addColorStop(0,'#d0c2e730');glow.addColorStop(1,'#d0c2e700');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(cx,cy+height*.06);ctx.rotate(-.24+Math.sin(t*.2)*.1);ctx.strokeStyle='#ab96c233';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,width*.34,height*.2,0,0,Math.PI*2);ctx.stroke();ctx.restore();drawIsland(width*.22-px*8,height*.64+Math.sin(t)*7,width*.075,-.12);drawIsland(width*.82-px*15,height*.36+Math.cos(t*.8)*9,width*.055,.17);drawIsland(width*.72+px*5,height*.76+Math.sin(t*.7)*5,width*.033,-.15);ctx.fillStyle='#ac99bc22';ctx.beginPath();ctx.ellipse(cx,height*.8,width*.15,9,0,0,Math.PI*2);ctx.fill()}
    if(playing){for(let i=0;i<gates.length;i++){const gate=gates[i];gate.z-=dt*speed;const scale=1/(1+Math.max(gate.z,0)*.4);const gx=cx+gate.x*width*.3*scale,gy=cy-gate.y*height*.3*scale,rad=Math.min(width,height)*.19*scale;ctx.save();ctx.globalAlpha=clamp(1-gate.z/19,0,1);ctx.strokeStyle=i%2?'#c5d49e':'#bca0e6';ctx.lineWidth=2+scale*3;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=15*scale;ctx.beginPath();ctx.ellipse(gx,gy,rad,rad,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.lineWidth=.7;ctx.strokeStyle='#eee0ff44';ctx.beginPath();ctx.arc(gx,gy,rad*1.1,t*.4,Math.PI*1.5+t*.4);ctx.stroke();ctx.restore();if(gate.z<0&&!gate.passed){gate.passed=true;const distance=Math.hypot((px-gate.x)*width*.3,(py-gate.y)*height*.3);if(distance<rad*.85){score++;find('#flight-score').textContent=String(score);spin+=Math.PI*2;announce(score%5===0?'NICE. KEEP EXPLORING!':'+1 PORTAL / NICE FLIGHT');for(let k=0;k<20;k++)bursts.push({x:gx,y:gy,vx:Math.cos(k/20*Math.PI*2)*90,vy:Math.sin(k/20*Math.PI*2)*90,life:1})}}if(gate.z<-.7){gate.z=14;gate.x=(rand(score+i+t)-.5)*1.5;gate.y=(rand(score+i+t+80)-.5)*1.2;gate.passed=false}}}
    if(playing){const dx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),dy=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);if(dx||dy){tx=clamp(tx+dx*dt*1.35,-1,1);ty=clamp(ty+dy*dt*1.35,-1,1)}}
    if(active){vx+=(tx-px)*dt*12;vy+=(ty-py)*dt*12;vx*=Math.pow(.02,dt);vy*=Math.pow(.02,dt);px=clamp(px+vx*dt*5,-1.1,1.1);py=clamp(py+vy*dt*5,-1.1,1.1);spin*=Math.pow(.03,dt)}
    const unit=Math.min(width*(playing?.085:.135),height*(playing?.14:.22));const avatarX=cx+px*width*.3,avatarY=cy-py*height*.3+(active?Math.sin(t*1.6)*6:0);
    // Exhaust is rendered behind the mesh in both the hero and the playable view.
    for(let k=0;k<(boosting?25:12);k++){const p=(t*1.2+k*.073)%1,alpha=(1-p)*.35;ctx.fillStyle=`rgba(170,126,220,${alpha})`;ctx.beginPath();ctx.arc(avatarX+Math.sin(k*19)*unit*.25,avatarY+unit*(.6+p*(boosting?2.4:1.5)),unit*(.07+p*.09),0,Math.PI*2);ctx.fill()}
    drawPilot(avatarX,avatarY,unit,t);
    for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;ctx.globalAlpha=Math.max(0,b.life);ctx.fillStyle='#e1c3ff';ctx.fillRect(b.x,b.y,3,3);if(b.life<=0)bursts.splice(i,1)}ctx.globalAlpha=1;
    if(feedbackUntil<time)feedback.classList.remove('visible');
  }
  function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.1);if(now-last<32)return;last=now;if(!document.hidden&&(playing||visible))draw(dt)}
  reset();resize();requestAnimationFrame(tick);
})();
