
#[derive(Debug)]
struct Txt2Sql<'a>{
    first_line: bool,
    ended: bool,
    columns: Vec<&'a str>,
}

impl<'a> Txt2Sql<'a> {
    fn show_me(&self) -> [bool; 2] {
        [self.first_line, self.ended]
    }
    fn init() -> Self{
        Self{ first_line: true, ended: false, columns: Vec::new() }
    }
    fn process_line(&mut self, line_or_end: Option<&'a str>){
        match line_or_end {
            Some(line) => { 
                if self.first_line {
                    self.first_line = false;
                    self.columns.push(line);
                    self.columns.push("----------");
                }else if ! self.ended {
                    self.columns.push(line);
                }
            }
            None => {
                self.ended = true;
            }
        }
    }
}

fn main() {
    println!("Hello, world!");
}

mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let mut txt2sql = Txt2Sql::init();
        assert_eq!(txt2sql.show_me(), [true, false]);
        txt2sql.process_line(Some("first line"));
        txt2sql.process_line(Some("second line"));
        txt2sql.process_line(Some("third line"));
        assert_eq!(txt2sql.columns, vec!["first line", "----------", "second line", "third line"]);
    }
}