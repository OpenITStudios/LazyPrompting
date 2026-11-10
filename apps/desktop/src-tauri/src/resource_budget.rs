// Conservative admission accounting, not OS memory/CPU measurement.
pub struct ResourceBudget {
    max_running: usize,
    reserved: usize,
}
impl ResourceBudget {
    pub fn new(max_running: usize) -> Result<Self, &'static str> {
        if !(1..=10).contains(&max_running) { return Err("INVALID_RESOURCE_LIMIT"); }
        Ok(Self { max_running, reserved: 0 })
    }
    pub fn reserve(&mut self) -> Result<(), &'static str> {
        if self.reserved >= self.max_running { return Err("BROWSER_CAPACITY_REACHED"); }
        self.reserved += 1;
        Ok(())
    }
    pub fn release(&mut self) -> Result<(), &'static str> {
        if self.reserved == 0 { return Err("RESOURCE_RESERVATION_NOT_FOUND"); }
        self.reserved -= 1;
        Ok(())
    }
    pub fn snapshot(&self) -> (usize, usize) { (self.reserved, self.max_running) }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn capacity_is_bounded() {
        let mut b=ResourceBudget::new(2).unwrap();
        b.reserve().unwrap(); b.reserve().unwrap();
        assert!(b.reserve().is_err());
        b.release().unwrap();
        assert_eq!(b.snapshot(),(1,2));
    }
}
