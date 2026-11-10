// Host-side HMAC challenge state. Never exposed to renderer or logs.
// This is NOT a transport: a protected secret delivery channel and PID-bound
// Windows named pipe are required before accepting any authorization requests.
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::time::{Duration, Instant};

type HmacSha256 = Hmac<Sha256>;
const TTL: Duration = Duration::from_secs(10);
const LABEL: &[u8] = b"lazyprompting-ipc-v1";

pub(crate) struct HostChallenge {
    secret: [u8;32],
    nonce: [u8;32],
    child_pid: u32,
    session: [u8;16],
    expires: Instant,
    used: bool,
    authenticated: bool,
}
impl HostChallenge {
    // Only call after the host has securely launched and identified the child.
    pub(crate) fn new(secret: [u8;32],child_pid:u32,session:[u8;16])->Result<Self,&'static str>{
        if child_pid==0 {return Err("IPC_INVALID_CHILD_PID");}
        let mut nonce=[0u8;32];
        getrandom::getrandom(&mut nonce).map_err(|_|"IPC_ENTROPY_UNAVAILABLE")?;
        Ok(Self{secret,nonce,child_pid,session,expires:Instant::now()+TTL,used:false,authenticated:false})
    }
    pub(crate) fn nonce(&self)->[u8;32]{self.nonce}
    fn expected(&self, direction:&[u8])->[u8;32]{
        let mut mac=HmacSha256::new_from_slice(&self.secret).expect("HMAC accepts 32-byte key");
        mac.update(LABEL);
        mac.update(&[0]);
        mac.update(direction);
        mac.update(&[0]);
        mac.update(&self.child_pid.to_be_bytes());
        mac.update(&self.session);
        mac.update(&self.nonce);
        mac.finalize().into_bytes().into()
    }
    // Fail closed on every attempt, including mismatched or expired proofs.
    pub(crate) fn verify_child(&mut self,connected_pid:u32,proof:&[u8])->bool{
        if self.used {return false;}
        self.used=true;
        if connected_pid!=self.child_pid || Instant::now()>=self.expires || proof.len()!=32 {
            return false;
        }
        // HMAC verify_slice uses constant-time comparison.
        let mut mac=HmacSha256::new_from_slice(&self.secret).expect("HMAC accepts 32-byte key");
        mac.update(LABEL);
        mac.update(&[0]);
        mac.update(b"child-to-host");
        mac.update(&[0]);
        mac.update(&self.child_pid.to_be_bytes());
        mac.update(&self.session);
        mac.update(&self.nonce);
        let ok=mac.verify_slice(proof).is_ok();
        self.authenticated=ok;
        ok
    }
    pub(crate) fn host_proof(&self)->Option<[u8;32]>{
        if !self.authenticated || Instant::now()>=self.expires {return None;}
        Some(self.expected(b"host-to-child"))
    }
}
impl Drop for HostChallenge {
    fn drop(&mut self) {
        self.secret.fill(0);
        self.nonce.fill(0);
        self.session.fill(0);
    }
}
