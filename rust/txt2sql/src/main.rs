use std::path::Path;
use std::fs::File;
use std::io::{prelude::*, Write, BufReader};
use std::fmt::{Debug, Formatter, Result};

trait OutWritter {
    fn write(&mut self, paragraph: &str) -> ();
    fn close(&mut self) -> (); // no more writes/closes allowed
}

trait OutWritterFactory<T: OutWritter> {
    fn open(&mut self, file_name: &str) -> T;
    fn end(&mut self) -> (); // no more writes/closes allowed in any opened file
}

struct FileWritter {
    file: File
    // bufw: BufWriter
}

impl OutWritter for FileWritter {
    fn write(&mut self, paragraph: &str){
        write!(self.file, "{}", paragraph);
    }
    fn close(&mut self){
    }
}

struct FileWritterFactory<'a>{
    extension: &'a str
}

impl<'a> OutWritterFactory<FileWritter> for FileWritterFactory<'a> {
    fn open(&mut self, file_name: &str) -> FileWritter {
        /*
        if(!Path.extname(file_name)){
            file_name += this.extension;
        }
         */
        let f = File::create(file_name).expect("Unable to create file");
        FileWritter{
            file: f
            // bufw: BufWriter::new(f)
        }
    }
    fn end(&mut self){}
}

enum Txt2SqlPart { Body, Head }

struct Txt2SqlOpenedMembers<'a, T: OutWritter> {
    columns: Vec<&'a str>,
    owf: &'a mut dyn OutWritterFactory<T>,
    inserts: T,
    create_table: T,
    part: Txt2SqlPart
}

impl<T: OutWritter> Debug for Txt2SqlOpenedMembers<'_, T> {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.debug_struct("Txt2SqlOpenedMembers").finish()
    }
}

impl Debug for dyn OutWritter {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.debug_struct("OutWritter").finish()
    }
}

// Parece innecesario porque ya lo hice para OutWritter
impl Debug for FileWritter {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        f.debug_struct("FileWritter").finish()
    }
}

#[derive(Debug)]
enum Txt2SqlStatus<'a, T: OutWritter> { New, Started(Txt2SqlOpenedMembers<'a, T>), Done }

struct Txt2Sql<'a, T: OutWritter>{
    status: Txt2SqlStatus<'a, T>,
}

// + Debug parece innesesario porque ya definí cómo implementar Debug en un OutWritter. 

impl<'a, T: OutWritter + Debug> Txt2Sql<'a, T> {
    fn init() -> Self{
        Self{
            status: Txt2SqlStatus::New
        }
    }
    fn process_start(&mut self, owf: &'a mut dyn OutWritterFactory<T>){
        match self.status {
            Txt2SqlStatus::New => {
                self.status = Txt2SqlStatus::Started(Txt2SqlOpenedMembers{
                    columns: Vec::new(),
                    create_table: owf.open("create_table"),
                    inserts: owf.open("inserts"),
                    owf: owf,
                    part: Txt2SqlPart::Head                  
                });
            }
            _ => panic!("wrong state at process_line: {:#?}", self.status)
        }
    }
    fn process_line(&mut self, line: &str){
        match &mut self.status {
            Txt2SqlStatus::Started(this) => {
                match this.part {
                    Txt2SqlPart::Head => {
                        this.create_table.write(line);
                        this.create_table.close();
                        this.part = Txt2SqlPart::Body;
                    }
                    Txt2SqlPart::Body => {
                        this.inserts.write(line);
                    }
                }
            }
            _ => panic!("wrong state at process_line: {:#?}", self.status)
        }
    }
    fn process_end(&mut self){
        match &mut self.status {
            Txt2SqlStatus::Started(this) => {
                this.inserts.close();
                this.owf.end();
                self.status = Txt2SqlStatus::Done;
            }
            _ => panic!("wrong state at process_line: {:#?}", self.status)
        }
    }
}

// from https://stackoverflow.com/questions/30801031/read-a-file-and-get-an-array-of-strings
fn lines_from_file(file_name: impl AsRef<Path>) -> Vec<String> {
    let file = File::open(file_name).expect("no such file");
    let buf = BufReader::new(file);
    buf.lines()
        .map(|l| l.expect("Could not parse line"))
        .collect()
}

fn process_small_file(file_name: &str){
    let mut fwf = FileWritterFactory{ extension: ".sql" };
    let lines = lines_from_file(file_name);
    let mut t2s = Txt2Sql::init();
    t2s.process_start(&mut fwf);
    for line in lines {
        t2s.process_line(&line);
    }
    t2s.process_end();
}

fn main() {
    println!("Hello, world!");
    process_small_file("../../sandbox/example.tab");
}

/*

use std::collections::HashMap;

struct VecWritter<'a> {
    vec: &'a Vec<String>
}

impl<'a> OutWritter for VecWritter<'a> {
    fn write(&mut self, paragraph: &str){
        self.vec.push(paragraph.to_string());
    }
    fn close(&mut self){
    }
}

struct VecWritterFactory<'a>{
    dic: HashMap<String, &'a Vec<String>>
}

impl<'a> VecWritterFactory<'a>{
    fn init() -> Self {
        Self {
            dic: HashMap::new()
        }
    }
}

impl<'a> OutWritterFactory<VecWritter<'a>> for VecWritterFactory<'_> {
    fn open(&mut self, file_name: &str) -> VecWritter<'a> {
        let mut v = Vec::new();
        self.dic.insert(file_name.to_string(), &v);
        VecWritter{
            vec: &v
        }
    }
    fn end(&mut self){}
}

mod tests {
    use super::*;

    #[test]
    fn it_works() {
        // let mut vwf = VecWritterFactory::init();
        // let mut vwf = VecWritterFactory{ dic: HashMap::new() };
        let mut vwf = FileWritterFactory{ extension: ".sql" };

        let txt2sql = Txt2Sql::init(&vwf);
        txt2sql.process_start();
        txt2sql.process_line("first|line");
        txt2sql.process_line("second|line");
        txt2sql.process_line("third|line");
        txt2sql.process_end();
        assert_eq!(txt2sql.columns, vec!["first line", "----------", "second line", "third line"]);
    }
}

*/