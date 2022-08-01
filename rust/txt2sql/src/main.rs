
type ChunkReader = fn(Option<&str>) -> ();

struct ChunkReaders{
    inserts: ChunkReader,
    create_table: ChunkReader
}

struct Txt2Sql<'a>{
    first_line: bool,
    ended: bool,
    columns: Vec<&'a str>,
    reader: ChunkReaders
}

impl<'a> Txt2Sql<'a> {
    fn show_me(&self) -> [bool; 2] {
        [self.first_line, self.ended]
    }
    fn init(reader: ChunkReaders) -> Self{
        Self{ first_line: true, ended: false, columns: Vec::new(), reader }
    }
    fn process_line(&mut self, line_or_end: Option<&'a str>){
        match line_or_end {
            Some(line) => { 
                if self.first_line {
                    self.first_line = false;
                    (self.reader.create_table)(Some(line));
                    (self.reader.create_table)(None);
                }else if ! self.ended {
                    (self.reader.inserts)(Some(line));
                }
            }
            None => {
                (self.reader.inserts)(None);
                self.ended = true;
            }
        }
    }
}

fn main() {
    println!("Hello, world!");
}

fn reader(chunk: Option<&str>){
    match chunk {
        Some(content) => { println!("content {}", content); }
        None => { println!("EOT"); }
    }
}

mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let mut txt2sql = Txt2Sql::init(ChunkReaders{inserts:reader, create_table:reader});
        assert_eq!(txt2sql.show_me(), [true, false]);
        txt2sql.process_line(Some("first|line"));
        txt2sql.process_line(Some("second|line"));
        txt2sql.process_line(Some("third|line"));
        assert_eq!(txt2sql.columns, vec!["first line", "----------", "second line", "third line"]);
    }
}