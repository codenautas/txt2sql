mod txt2sql;
mod vecwritter;

use crate::txt2sql::*;

fn main() {
    println!("txt2sql example, reading ../../sandbox/example.tab wrigint in ./target/tmp");
    process_small_file("../../sandbox/example.tab", "target/tmp");
}
