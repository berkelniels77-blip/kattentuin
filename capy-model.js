const vertex = `
attribute vec3 sphere;
uniform vec3 center, scale;
uniform vec2 framing;
uniform float yaw, lift;
varying vec3 normal, position;
vec3 turn(vec3 p) {
  float s=sin(yaw), c=cos(yaw);
  return vec3(p.x*c+p.z*s,p.y,p.z*c-p.x*s);
}
void main() {
  vec3 p=turn(sphere*scale+center);
  p.y+=lift;
  normal=turn(normalize(sphere/scale));
  position=p;
  float perspective=1.0-p.z*.055;
  gl_Position=vec4(p.x*framing.x,(p.y-.24)*framing.y,-p.z*.17,perspective);
}`;
const fragment = `
precision mediump float;
uniform vec3 color;
varying vec3 normal, position;
void main() {
  vec3 n=normalize(normal);
  vec3 key=normalize(vec3(-.48,.86,.78));
  float light=max(0.0,dot(n,key));
  float rim=pow(1.0-max(0.0,n.z),3.0)*.14;
  float highlight=pow(max(0.0,dot(n,normalize(key+vec3(0.,0.,1.)))),26.0);
  vec3 shade=color*(.49+.53*light+.10*max(0.,n.x))+
    vec3(.13,.10,.08)*rim+vec3(.23,.17,.12)*highlight;
  shade*=.94+min(.10,max(0.,position.y)*.08);
  gl_FragColor=vec4(shade,1.);
}`;

function sphereMesh() {
  const data=[];
  const vertexAt=(r,c)=>{
    const polar=r*Math.PI/26, azimuth=c*2*Math.PI/36;
    return [Math.sin(polar)*Math.cos(azimuth),Math.cos(polar),Math.sin(polar)*Math.sin(azimuth)];
  };
  for(let row=0;row<26;row++) {
    for(let col=0;col<36;col++) {
      const a=vertexAt(row,col), b=vertexAt(row+1,col);
      const c=vertexAt(row,col+1), d=vertexAt(row+1,col+1);
      data.push(...a,...b,...c,...b,...d,...c);
    }
  }
  return new Float32Array(data);
}
const rgb = hex => [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);

export function createCapyModel(canvas) {
  const gl=canvas.getContext('webgl',{alpha:true, antialias:true, powerPreference:'low-power'});
  if(!gl) return null;
  const program=gl.createProgram();
  for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) return null;
    gl.attachShader(program,shader);
  }
  gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const points=sphereMesh();
  const buffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);
  const coord=gl.getAttribLocation(program,'sphere');
  gl.enableVertexAttribArray(coord);
  gl.vertexAttribPointer(coord,3,gl.FLOAT,false,0,0);
  const uniforms=Object.fromEntries(['center','scale','color','framing','yaw','lift'].map(name=>[name,gl.getUniformLocation(program,name)]));
  gl.enable(gl.DEPTH_TEST);
  let frame=0, look, reduced=matchMedia('(prefers-reduced-motion: reduce)');
  function ball(center, scale, color) {
    gl.uniform3fv(uniforms.center,center);
    gl.uniform3fv(uniforms.scale,scale);
    gl.uniform3fv(uniforms.color,rgb(color));
    gl.drawArrays(gl.TRIANGLES,0,points.length/3);
  }
  function draw(time) {
    frame=0;
    if(!look || !canvas.isConnected || !canvas.closest('dialog')?.open || !canvas.clientWidth) return;
    const resolution=Math.min(devicePixelRatio,1.8);
    const width=Math.round(canvas.clientWidth*resolution), height=Math.round(canvas.clientHeight*resolution);
    if(canvas.width!==width || canvas.height!==height) {
      canvas.width=width;
      canvas.height=height;
    }
    const aspect=width/height;
    const fit=Math.min(1,aspect/1.28);
    gl.viewport(0,0,width,height);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(uniforms.framing, .79*fit/aspect,.79*fit);
    const t=reduced.matches ? 0 : time/1000;
    gl.uniform1f(uniforms.yaw,-.30+Math.sin(t*1.35)*.09);
    gl.uniform1f(uniforms.lift,Math.sin(t*2.5)*.026);
    const {fur, pattern, sleeping, happy, low}=look;
    const blink=sleeping || happy || t%4.5>4.34;
    const paw=pattern==='socks' ? '#eed1aa' : '#935733';
    for(const x of [-.61,.4]) for(const z of [-.37,.42]) ball([x,-.54,z],[.25,.29,.23],paw);
    ball([-.29,-.04,0],[.94,.70,.63],fur);
    ball([.48,.26,.07],[.62,.66,.55],fur);
    for(const z of [-.29,.39]) {
      ball([.27,.84,z],[.165,.23,.125],fur);
      ball([.29,.85,z+.058],[.103,.155,.075],'#ae6e62');
    }
    if(pattern==='spots') {
      ball([-.60,.10,.495],[.35,.34,.15],'#e9b989');
      ball([.38,.52,.475],[.23,.20,.10],'#e9b989');
    }
    ball([.94,.18,.18],[.45,.37,.43],'#a36b49');
    ball([1.04,.095,.35],[.27,.20,.27],'#bf8760');
    ball([1.21,.27,.37],[.16,.11,.17],'#59373a');
    ball([1.26,.29,.445],[.051,.025,.037],'#a47769');
    ball([.68,.48,.542],[.087,blink?.022:.112,.045],'#30232b');
    ball([.72,.27,.560],[.135,.064,.038],'#d98d85');
    if(!blink) ball([.655,.517,.578],[.026,.025,.017],'#fff4df');
    if(low && !sleeping) ball([.65,.60,.526],[.13,.026,.04],'#80513c');
    if(!reduced.matches) frame=requestAnimationFrame(draw);
  }
  return {
    setLook(next) { look=next; if(!frame) frame=requestAnimationFrame(draw); },
    stop() { cancelAnimationFrame(frame); frame=0; }
  };
}
