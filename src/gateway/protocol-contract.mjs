// Explicitly supported stdio protocol versions; never advertise a version not implemented.
export const SUPPORTED_PROTOCOLS=Object.freeze(["2025-03-26"]);
export function negotiateProtocol(params){
 if(!params||typeof params!=="object"||Array.isArray(params))return {ok:false,reason:"INVALID_INITIALIZE"};
 const requested=params.protocolVersion;
 if(typeof requested!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(requested))
  return {ok:false,reason:"INVALID_PROTOCOL_VERSION"};
 if(!params.clientInfo||typeof params.clientInfo.name!=="string"||
    !params.capabilities||typeof params.capabilities!=="object")
  return {ok:false,reason:"INVALID_CLIENT_CAPABILITIES"};
 // MCP servers may select a supported version; the client decides whether to proceed.
 return {ok:true,version:SUPPORTED_PROTOCOLS.includes(requested)?requested:SUPPORTED_PROTOCOLS[0],
  negotiated:SUPPORTED_PROTOCOLS.includes(requested)};
}
