import test from "node:test";
import assert from "node:assert/strict";
import {browserShortcut} from "./browser-shortcuts.mjs";

const base={tabs:["tab-01","tab-02"],activeTab:"tab-02"};
test("tab navigation shortcuts preserve protected main",()=>{
 assert.deepEqual(browserShortcut({...base,key:"t",ctrlKey:true}),{type:"NEW_TAB"});
 assert.deepEqual(browserShortcut({...base,key:"w",ctrlKey:true}),{type:"CLOSE_TAB",tabId:"tab-02"});
 assert.equal(browserShortcut({...base,activeTab:"main",key:"w",ctrlKey:true}),null);
 assert.deepEqual(browserShortcut({...base,key:"1",ctrlKey:true}),{type:"SELECT_TAB",tabId:"main"});
 assert.deepEqual(browserShortcut({...base,key:"3",ctrlKey:true}),{type:"SELECT_TAB",tabId:"tab-02"});
 assert.equal(browserShortcut({...base,key:"4",ctrlKey:true}),null);
 assert.deepEqual(browserShortcut({...base,key:"Home",altKey:true}),{type:"MAIN_TAB"});
});
test("ordinary editing and unsupported combinations are not captured",()=>{
 assert.equal(browserShortcut({...base,key:"t",ctrlKey:true,editable:true}),null);
 assert.equal(browserShortcut({...base,key:"t",ctrlKey:true,shiftKey:true}),null);
 assert.equal(browserShortcut({...base,key:"w"}),null);
 assert.equal(browserShortcut({...base,key:"ArrowLeft"}),null);
 assert.deepEqual(browserShortcut({...base,key:"ArrowLeft",altKey:true}),{type:"BACK"});
 assert.deepEqual(browserShortcut({...base,key:"l",ctrlKey:true}),{type:"ADDRESS"});
 assert.deepEqual(browserShortcut({...base,key:"f",ctrlKey:true}),{type:"FIND"});
});
