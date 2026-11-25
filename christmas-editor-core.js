(function(root){
  'use strict';
  class History {
    constructor(limit=50){this.limit=Math.max(1,Math.floor(limit));this.undoStack=[];this.redoStack=[];}
    record(before,after){if(typeof before!=='string'||typeof after!=='string'||before===after)return false;this.undoStack.push(before);if(this.undoStack.length>this.limit)this.undoStack.shift();this.redoStack=[];return true;}
    undo(current){if(!this.undoStack.length)return null;this.redoStack.push(current);return this.undoStack.pop();}
    redo(current){if(!this.redoStack.length)return null;this.undoStack.push(current);if(this.undoStack.length>this.limit)this.undoStack.shift();return this.redoStack.pop();}
    get canUndo(){return this.undoStack.length>0;}
    get canRedo(){return this.redoStack.length>0;}
  }
  function clampTreePoint(x,y){
    const vertical=Math.max(196,Math.min(528,Number(y)||0));
    const half=Math.max(49,Math.min(205,47+(vertical-182)*.46));
    return {x:Math.max(300-half,Math.min(300+half,Number(x)||0)),y:vertical};
  }
  async function withTimeout(promise,ms=15000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('export_timeout')),ms);})]);}finally{clearTimeout(timer);}}
  const api=Object.freeze({History,clampTreePoint,withTimeout});
  root.ChristmasEditorCore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
