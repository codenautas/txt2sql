use std::cell::{RefCell};
use std::io::Write;
// use std::collections::HashMap;
use std::rc::Rc;
use std::fs::File;

#[deny(unused_must_use)]

fn refcell(){
    println!("Starting");
    let a = Rc::new(RefCell::new(vec![3, 4, 5]));
    let b = Rc::clone(&a);
    let c = Rc::clone(&a);
    {
        a.borrow_mut().push(6);
    }
    {
        b.borrow_mut().push(7);
    }
    {
        c.borrow_mut().push(8);
    }
    println!("Ref cell results {:?} {:?} {:?}", a, b, c);
}

fn writefile(){
    let mut f = File::create("local-output.txt").expect("can't open file");
    write!(f, "{}", "ejemplo");
}

fn main() {
    println!("Hello World!");
    refcell();
    writefile();
}

