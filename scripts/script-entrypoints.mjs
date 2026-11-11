// Validate the entire source-controlled npm script command, including all
// `node --test` targets and each explicitly chained Node command.
// Intentionally narrow: changing the command grammar requires a source review.
const FILE=/^(?:src|scripts|tests|\.agents)\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.mjs$/;
export function scriptEntrypoints(command){
  if(typeof command!=='string'||!command.trim()||command.length>4096)
    throw Error('SCRIPT_ENTRYPOINT_INVALID');
  const entries=[];
  for(const segment of command.split(/\s*&&\s*/)){
    const parts=segment.trim().split(/\s+/);
    if(parts.shift()!=='node')throw Error('SCRIPT_ENTRYPOINT_INVALID');
    const isTest=parts[0]==='--test';
    if(isTest)parts.shift();
    if(!parts.length||parts.length>16||(!isTest&&parts.length!==1))
      throw Error('SCRIPT_ENTRYPOINT_INVALID');
    for(const path of parts){
      if(!FILE.test(path)||path.split('/').includes('..')||entries.includes(path))
        throw Error('SCRIPT_ENTRYPOINT_INVALID');
      entries.push(path);
    }
  }
  return entries;
}
