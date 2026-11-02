import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCapsule } from '../src/services/skillCapsule.ts';
const skill = { id:'clean',name:'Dọn dẹp',trigger:'/clean',actionPrompt:'Kiểm tra thư mục trước',category:'macro',enabled:true };
const capsule = skills => JSON.stringify({format:'orbis.skill-capsule',version:1,skills});
test('imported skills are disabled and strip unrelated fields',()=>{
  const [imported]=parseCapsule(capsule([{...skill,command:'never execute me'}]));
  assert.equal(imported.enabled,false);assert.equal(imported.name,'Dọn dẹp');assert.equal('command' in imported,false);
});
test('rejects malformed, incompatible, duplicate and oversized imports',()=>{
  for(const text of ['{}', 'null', '[1]', capsule([{...skill,actionPrompt:1}]),capsule([skill,skill]),capsule([{...skill,category:'shell'}]),'x'.repeat(1_000_001)]) assert.throws(()=>parseCapsule(text));
});
