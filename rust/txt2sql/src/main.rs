mod txt2sql;

use crate::txt2sql::*;

fn main() {
    println!("Hello, world!");
    process_small_file("../../sandbox/example.tab", "target/tmp");
}
