// Narrow JSON-schema subset used by the Gateway capability catalog.
// Fail closed on unsupported schema keywords; never silently accept unknown shapes.
export function validateInput(schema, value, depth=0) {
  if (!schema || depth>8 || typeof schema!=="object") return false;
  if (schema.type==="object") {
    if (!value || typeof value!=="object" || Array.isArray(value)) return false;
    const props=schema.properties??{};
    if (schema.additionalProperties===false && Object.keys(value).some(k=>!Object.hasOwn(props,k))) return false;
    if ((schema.required??[]).some(k=>!Object.hasOwn(value,k))) return false;
    return Object.entries(value).every(([key,item])=>!Object.hasOwn(props,key)||validateInput(props[key],item,depth+1));
  }
  if (schema.type==="string") return typeof value==="string" &&
    (schema.minLength===undefined || value.length>=schema.minLength) &&
    (schema.maxLength===undefined || value.length<=schema.maxLength);
  if (schema.type==="integer") return Number.isSafeInteger(value) &&
    (schema.minimum===undefined || value>=schema.minimum) &&
    (schema.maximum===undefined || value<=schema.maximum);
  if (schema.type==="boolean") return typeof value==="boolean";
  return false;
}
