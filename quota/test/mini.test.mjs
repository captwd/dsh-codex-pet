import test from 'node:test';
import assert from 'node:assert/strict';
import { MINI_PET_ID, miniAnimationDefinition, miniAtlasPosition, miniDimensions, clampMiniPosition, initialMiniPosition, miniTaskTrack, miniFrameAt, mainSessionId, miniStatus } from '../src/mini-core.mjs';
import { isIdle } from '../src/core.mjs';
const definition={cell:{width:192,height:208}};
test('small DS preserves aspect ratio, accepts the extended size and bounds invalid sizes',()=>{
  assert.deepEqual(miniDimensions(definition,208),{width:192,height:208});
  assert.equal(miniDimensions(definition,896).height,896);
  assert.equal(miniDimensions(definition,99999).height,896);
  assert.equal(miniDimensions(definition,-5).height,80);
});
test('drag bounds reserve space for the attached batteries and bottom toolbar',()=>{
  assert.deepEqual(clampMiniPosition({x:-30,y:900},{width:256,height:160},{width:1000,height:700}),{x:8,y:500});
  assert.deepEqual(clampMiniPosition({x:2000,y:900},{width:256,height:160},{width:1000,height:700}),{x:736,y:500});
});
test('first placement avoids the main pet and its badge',()=>{
  const box=initialMiniPosition({left:700,right:950,top:400,bottom:600},{width:256,height:160},{width:1200,height:900});
  assert.ok(box.x+256<700);assert.equal(box.y,440);
});
test('DSH task phases win over a main character idle fallback and use the mini atlas',()=>{
  const mapping={thinking:'running',tool:'running',waiting:'waiting',review:'review'};
  for(const [phase,track] of Object.entries(mapping))assert.equal(miniTaskTrack({phase,animation:'idle'}),track);
  assert.equal(miniTaskTrack({phase:'done',animation:'jumping'}),'jumping');
  assert.equal(miniTaskTrack({phase:'failed',animation:'failed'}),'failed');
  assert.equal(miniTaskTrack({phase:'idle',animation:'unknown'}),'idle');
  assert.equal(miniStatus({phase:'tool'}),'正在使用工具…');
});
test('current DSH conversation follows main-view ownership rather than recent/active order',()=>{
  assert.equal(mainSessionId({background:{id:'background',retainedBy:{background:1}},selected:{id:'selected',retainedBy:{mainView:1}}}),'selected');
  assert.equal(mainSessionId({background:{id:'background'}}),undefined);
});
test('sprite timing loops at the correct frame and ends one-shot actions once',()=>{
  const track={frames:[0,1,2],durations:[100,200,300],loop:true};
  assert.deepEqual(miniFrameAt(track,650),{frame:0,remaining:50,ended:false});
  assert.deepEqual(miniFrameAt({...track,loop:false},600),{frame:2,remaining:0,ended:true});
  assert.equal(miniFrameAt({frames:[99],loop:true},0).ended,true);
});
test('companion uses Codex active timing without changing the main pet registry or frame order',()=>{
  const source={id:MINI_PET_ID,tracks:{waving:{frames:[0,1,2,3],durations:[450,450,450,450],loop:true},jumping:{frames:[0,1,2,3,4],durations:[400,400,400,450,450],loop:false,fallback:'idle'}}};
  const fast=miniAnimationDefinition(source);
  assert.deepEqual(fast.tracks.waving.durations,[140,140,140,280]);
  assert.deepEqual(fast.tracks.jumping.frames,source.tracks.jumping.frames);
  assert.deepEqual(source.tracks.waving.durations,[450,450,450,450]);
  assert.equal(miniFrameAt(fast.tracks.waving,145).frame,1);
  assert.equal(miniFrameAt(fast.tracks.jumping,839).ended,false);
  assert.equal(miniFrameAt(fast.tracks.jumping,840).ended,true);
  assert.equal(fast.tracks.jumping.fallback,'idle');
  const main={...source,id:'whale-girl-refined'};assert.equal(miniAnimationDefinition(main),main);
  const hover={...fast.tracks.jumping,loop:true};assert.equal(miniFrameAt(hover,840*8+145).frame,1);
  assert.equal(miniFrameAt(hover,840*8+145).ended,false);assert.equal(fast.tracks.jumping.loop,false);
});
test('normalised atlas positions remain on the same complete frame at every rendered size',()=>{
  const atlas={columns:8,atlasRows:11};
  for(const width of [73.846,148,192,384,827.076])for(const [row,col] of [[0,0],[3,3],[4,4],[7,5],[10,7]]){
    const height=width*208/192;
    const [x,y]=miniAtlasPosition(atlas,row,col).split(' ').map(parseFloat);
    assert.ok(Math.abs(-(8*width-width)*x/100+col*width)<1e-8);
    assert.ok(Math.abs(-(11*height-height)*y/100+row*height)<1e-8);
  }
});
test('mounted and settled DSH conversations permit hover without masking ongoing work',()=>{
  for(const phase of ['idle','done','failed']){
    const settled={phase,animation:'idle',sessionActive:true,sessions:[]};
    assert.equal(isIdle(settled),true);assert.equal(miniTaskTrack(settled),'idle');
  }
  assert.equal(isIdle({phase:'done',animation:'jumping',sessionActive:true}),false);
  assert.equal(isIdle({phase:'idle',sessionActive:true,sessions:[{phase:'thinking'}]}),false);
});
