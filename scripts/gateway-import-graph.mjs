// Discover ESM import edges from syntax, not strings or comments.
// Unknown dynamic dependencies must fail closed before gateway staging.
import {parse} from "acorn";

export function collectGatewayImports(source) {
 const ast=parse(source,{ecmaVersion:"latest",sourceType:"module"});
 const imports=[];
 function visit(node) {
  if(!node||typeof node!=="object")return;
  if(Array.isArray(node)){for(const child of node)visit(child);return;}
  if(["ImportDeclaration","ExportNamedDeclaration","ExportAllDeclaration"]
      .includes(node.type)&&node.source){
   if(typeof node.source.value!=="string")throw Error("ESM_IMPORT_SOURCE_INVALID");
   imports.push(node.source.value);
  }
  if(node.type==="ImportExpression"){
   if(node.source?.type!=="Literal"||
      typeof node.source.value!=="string"||node.options)
    throw Error("DYNAMIC_IMPORT_UNRESOLVED");
   imports.push(node.source.value);
  }
  for(const child of Object.values(node))visit(child);
 }
 visit(ast);
 return imports;
}
