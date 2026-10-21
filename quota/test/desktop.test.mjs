import test from 'node:test';
import assert from 'node:assert/strict';
import {isDesktopHostUrl,isAtlasData,insideRegions,shouldIgnoreMouse,validRegions,DESKTOP_ACTIONS} from '../desktop/policy.mjs';
test('desktop IPC accepts only the installed loopback main page presentation',()=>{
  assert.equal(isDesktopHostUrl('http://127.0.0.1:43120/?dsh-desktop-mode=compatibility'),true);
  for(const url of ['https://example.com/?dsh-desktop-mode=compatibility','http://127.0.0.1:43120/','http://127.0.0.1:43120/api/pet/state?dsh-desktop-mode=compatibility','file:///test.html','http://127.0.0.1.evil.test/?dsh-desktop-mode=extended'])assert.equal(isDesktopHostUrl(url),false);
});
test('native mouse-down keeps input captured before the next renderer layout arrives',()=>{
  const bounds={x:0,y:0},regions=[{x:100,y:100,width:80,height:160}],point={x:400,y:350};
  assert.equal(shouldIgnoreMouse(point,bounds,regions),true);
  assert.equal(shouldIgnoreMouse(point,bounds,regions,{pressed:true,dragging:false}),false);
  assert.equal(shouldIgnoreMouse(point,bounds,regions,{pressed:false,dragging:true}),false);
  assert.equal(shouldIgnoreMouse(point,bounds,regions,{pressed:false,dragging:false}),true);
  assert.equal(shouldIgnoreMouse({x:130,y:140},bounds,regions,{pressed:false,dragging:false}),false);
});
test('desktop asset bridge allows bounded raster data and rejects active document schemes',()=>{
  assert.equal(isAtlasData('data:image/webp;base64,UklGRg=='),true);
  for(const value of ['data:image/svg+xml;base64,PHN2Zz4=','https://example.com/x.webp','file:///private','data:text/html;base64,AAAA',null])assert.equal(isAtlasData(value),false);
});
test('transparent desktop regions pass input through, including displays with negative coordinates',()=>{
  const bounds={x:-1920,y:20},regions=validRegions([{x:100,y:100,width:80,height:160},{x:190,y:130,width:96,height:90},null,{x:NaN,y:0,width:2,height:2}]);
  assert.equal(regions.length,2);assert.equal(insideRegions({x:-1790,y:170},bounds,regions),true);
  assert.equal(insideRegions({x:-1710,y:170},bounds,regions),true);
  assert.equal(insideRegions({x:-1800,y:450},bounds,regions),false);
  assert.equal(DESKTOP_ACTIONS.has('execute'),false);assert.equal(DESKTOP_ACTIONS.has('voice'),true);
});
