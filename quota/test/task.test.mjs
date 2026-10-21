import test from 'node:test';
import assert from 'node:assert/strict';
import {taskPresentation,visibleTaskCards} from '../src/task-core.mjs';
test('task cards join the correct DSH conversation title with its own progress',()=>{
  const snapshot={phase:'waiting',sessions:[{sessionId:'a',phase:'waiting',bubble:'需要你确认工具操作'},{sessionId:'b',phase:'tool',bubble:'正在运行检查'}]};
  const result=taskPresentation(snapshot,{a:{title:'修复拖动'},b:{displayTitle:'整理项目'}},'b',new Map(),1000);
  assert.deepEqual(result.tasks.map(t=>[t.id,t.title,t.detail]),[['a','修复拖动','需要你确认工具操作'],['b','整理项目','正在运行检查']]);
  assert.equal(result.tasks[0].phase,'waiting');assert.equal(snapshot.tasks,undefined);
});
test('task cards stay quiet when idle, cap concurrent notifications, and do not invent edit counts',()=>{
  assert.deepEqual(taskPresentation({phase:'idle',sessions:[]},{},null,new Map(),1000).tasks,[]);
  const tasks=taskPresentation({phase:'tool',sessions:Array.from({length:8},(_,i)=>({sessionId:String(i),phase:'tool'}))},{},null,new Map(),1000).tasks;
  assert.equal(tasks.length,3);assert.equal(tasks[0].detail,'正在使用工具…');assert.ok(!tasks[0].detail.includes('文件'));
});
test('finished task cards expire without refreshing their lifetime on every poll',()=>{
  const history=new Map(),snapshot={phase:'done',sessions:[{sessionId:'a',phase:'done'}]};
  assert.equal(taskPresentation(snapshot,{},'a',history,1000).tasks[0].at,1000);
  assert.equal(taskPresentation(snapshot,{},'a',history,5000).tasks[0].at,1000);
  assert.equal(taskPresentation(snapshot,{},'a',history,12000).tasks.length,0);
  assert.equal(visibleTaskCards({tasks:[{id:'a',title:'完成',phase:'done',at:1000}]},12000).length,0);
});
test('task text is plain, bounded and preserves the click target identity',()=>{
  const tasks=visibleTaskCards({tasks:[{id:'exact-session',title:'<b>标题</b>\n  '+ 'x'.repeat(300),detail:'执行\u0000检查',phase:'tool',at:1}]},2);
  assert.equal(tasks[0].id,'exact-session');assert.ok(tasks[0].title.startsWith('<b>标题</b> '));assert.ok(tasks[0].title.length<=180);assert.equal(tasks[0].detail,'执行 检查');
});
