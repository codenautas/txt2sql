use std::fmt::{Debug, Formatter, Result};
use std::cell::{RefCell};
use std::collections::HashMap;
use std::rc::Rc;
use crate::txt2sql::*;

pub struct VecWritter {
    vec: Rc<RefCell<Vec<String>>>
}

impl OutWritter for VecWritter {
    fn write(&mut self, paragraph: &str){
        self.vec.borrow_mut().push(String::from(paragraph));
    }
    fn close(&mut self){
    }
}

pub struct VecWritterFactory{
    pub vecs: HashMap<String, Rc<RefCell<Vec<String>>>>        
}

impl VecWritterFactory{
    pub fn init() -> Self {
        Self {
            vecs: HashMap::new()
        }
    }
}

impl OutWritterFactory for VecWritterFactory {    
    fn open(&mut self, file_name: &str) -> Box<dyn OutWritter> {
        let key = file_name.to_string();
        let vec: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        self.vecs.insert(key, Rc::clone(&vec));
        Box::new(VecWritter{
            vec: Rc::clone(&vec)
        })
    }
    fn end(&mut self){}
}

// Parece innecesario porque ya lo hice para OutWritter
impl Debug for VecWritter {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.debug_struct("VecWritter").finish()
    }
}
