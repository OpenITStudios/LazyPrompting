import assert from "node:assert/strict";
import test from "node:test";
import {
  createChatGoalOAuthAuthenticator, chatGoalOAuthChallenge,
} from "../src/mcp/chat-goal/oauth-authenticator.mjs";
import {createChatGoalBridge} from "../src/mcp/chat-goal/bridge.mjs";

const issuer = "https://id.example.org";
const audience = "https://mcp.example.org";
const metadata = audience + "/.well-known/oauth-protected-resource";
const clock = 10000;
const grant = () => ({
  verified: true, tokenType: "Bearer", issuer, audience,
  expiresAt: 10200, notBefore: 9900,
  scopes: ["chat_goal:operate"], subjectId: "account-1",
  connectionId: "profile-1", chatSessionHint: "host-session-1",
});
function fixture() {
  // Context (including authInfo) cannot authenticate itself. Only the
  // separately injected token verifier can return a trusted grant.
  const trusted = new WeakMap();
  const auth = createChatGoalOAuthAuthenticator({
    verifyAccessToken: async ctx => trusted.get(ctx) ?? null,
    issuer, audience, nowSeconds: () => clock,
  });
  return {trusted, auth};
}

test("trusted OAuth verification yields a minimal, stable principal", async () => {
  const {trusted, auth} = fixture();
  const ctx = {};
  trusted.set(ctx, grant());
  assert.deepEqual(await auth(ctx), {
    subjectId: "account-1", connectionId: "profile-1",
    chatSessionHint: "host-session-1",
  });
  assert.equal(Object.hasOwn(await auth(ctx), "token"), false);
});

test("forged context and unverified decoded token are never admitted", async () => {
  const {auth} = fixture();
  assert.equal(await auth({authInfo:grant(), approved:true}), null);
  assert.equal(await auth({verified:true, token:"fake"}), null);
});

test("wrong issuer/audience/scope/time/type/identity are rejected", async () => {
  const {trusted, auth} = fixture();
  const invalid = [
    {verified:false},{verified:"true"},{tokenType:"Basic"},
    {issuer:"https://other.example.org"},{audience:"https://other.example.org"},
    {audience:[audience]},{expiresAt:clock},{expiresAt:clock-1},
    {expiresAt:"never"},{notBefore:clock+1},{notBefore:"later"},
    {scopes:[]},{scopes:["chat_goal:read"]},{scopes:"chat_goal:operate"},
    {subjectId:""},{subjectId:"another account"},{connectionId:""},
    {chatSessionHint:"a ChatGPT URL"},
    {subjectId:["account-1"]},{connectionId:["profile-1"]},
    {chatSessionHint:["host-session-1"]},
    {subjectId:"account-1\n"},{connectionId:"profile-1\r"},
    {chatSessionHint:"host-session-1\n"},
  ];
  for (const change of invalid) {
    const ctx = {};
    trusted.set(ctx,{...grant(),...change});
    assert.equal(await auth(ctx), null, JSON.stringify(change));
  }
});

test("verifier error and invalid clock never grant effects", async () => {
  const failed = createChatGoalOAuthAuthenticator({
    verifyAccessToken: async () => {throw Error("Bearer PRIVATE_SECRET");},
    issuer, audience, nowSeconds: () => clock,
  });
  assert.equal(await failed({}), null);
  const badClock = createChatGoalOAuthAuthenticator({
    verifyAccessToken: async () => grant(), issuer, audience,
    nowSeconds: () => NaN,
  });
  assert.equal(await badClock({}), null);
  assert.throws(() => createChatGoalOAuthAuthenticator({issuer,audience}),/OAUTH_RESOURCE_REQUIRED/);
  assert.throws(() => createChatGoalOAuthAuthenticator({
    verifyAccessToken: async () => grant(), issuer:"http://localhost", audience,
  }),/OAUTH_RESOURCE_REQUIRED/);
});

test("metadata challenge is trusted HTTPS and contains no tokens", () => {
  const header = chatGoalOAuthChallenge(metadata)["mcp/www_authenticate"][0];
  assert.match(header,/Bearer resource_metadata="https:\/\/mcp\.example\.org\/\.well-known\/oauth-protected-resource"/);
  assert.match(header,/error="invalid_token"/);
  assert.equal(header.includes("PRIVATE_SECRET"), false);
  for (const invalid of [
    "http://localhost/.well-known/oauth-protected-resource",
    "https://mcp.example.org/other",
    "https://evil.example.org/.well-known/oauth-protected-resource?redirect=yes",
  ]) assert.throws(() => chatGoalOAuthChallenge(invalid),/RESOURCE_METADATA_REQUIRED/);
});

test("bridge challenges on auth failure and never calls native", async () => {
  const {trusted,auth} = fixture();
  let calls=0;
  const bridge=createChatGoalBridge({
    authenticate:auth,
    // Synthetic callback only: NOT a real native Rust approval.
    authorize:async ({principal})=>({
      schemaVersion:1,source:"NATIVE_APPROVED_CHAT_GOAL",
      subjectId:principal.subjectId,connectionId:principal.connectionId,
      workspaceId:"workspace-01",goalDigest:"a".repeat(64),
      conversationDigest:"b".repeat(64),principalTag:"c".repeat(64),
      epoch:1,operatorApproved:true,stopped:false,chatBound:false,
    }),
    invoke:async()=>{calls++;return {state:"BOUND"};},
    resourceMetadataUrl:metadata,
  });
  const input={code:"a".repeat(48)};
  const refused=await bridge.call("goal.bind",input,{});
  assert.equal(refused.structuredContent.code,"AUTHENTICATION_REQUIRED");
  assert.match(refused._meta["mcp/www_authenticate"][0],/resource_metadata/);
  assert.equal(calls,0);
  const malformed=await bridge.call("goal.bind",{code:"not-hex"},{});
  assert.equal(malformed.structuredContent.code,"INVALID_INPUT");
  assert.equal(malformed._meta,undefined);
  const ctx={};
  trusted.set(ctx,grant());
  const valid=await bridge.call("goal.bind",input,ctx);
  assert.equal(valid.structuredContent.status,"BOUND");
  assert.equal(valid._meta,undefined);
  assert.equal(calls,1);
});
