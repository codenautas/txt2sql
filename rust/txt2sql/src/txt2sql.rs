use std::fmt::{Debug, Formatter, Result};
use std::fs::File;
use std::io::{prelude::*, Write, BufReader};
use std::path::{Path, PathBuf};
use regex::Regex;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Txt2SqlOptions {
    #[serde(default)]
    field_separator: String,
    #[serde(default)]
    table_name: String
}

impl Default for Txt2SqlOptions {
    fn default() -> Self { Self { 
        field_separator: "|".to_string(), 
        table_name: "table1".to_string()
    } }
}

// fn txt2sql_default_field_separator() -> &'static str { "|"}

pub trait OutWritter {
    fn write(&mut self, paragraph: &str) -> ();
    fn close(&mut self) -> (); // no more writes/closes allowed
}

pub trait OutWritterFactory {
    fn open(&mut self, file_name: &str) -> Box<dyn OutWritter>;
    fn end(&mut self) -> (); // no more writes/closes allowed in any opened file
}

struct FileWritter {
    file: Option<File>
}

impl OutWritter for FileWritter {
    fn write(&mut self, paragraph: &str){
        match self.file {
            Some(ref mut opened_file) => { opened_file.write(paragraph.as_bytes()).expect("cannot write"); }
            None => panic!("file is no longer opened")
        }
    }
    fn close(&mut self){
        self.file = None;
    }
}

struct FileWritterFactory<'a>{
    extension: &'a str,
    base_dir: &'a str
}

impl<'a> OutWritterFactory for FileWritterFactory<'a> {
    fn open(&mut self, file_name: &str) -> Box<dyn OutWritter> {
        let mut path: PathBuf = [self.base_dir, file_name].iter().collect();
        if path.extension() == None {
            path = path.with_extension(self.extension);
        }
        let f = File::create(&path).unwrap_or_else( |_| panic!("Unable to create file '{}'", path.display()) );
        Box::new(FileWritter{
            file: Some(f)
        })
    }
    fn end(&mut self){}
}

enum Txt2SqlPart { Body, Head }

struct Txt2SqlOpenedMembers {
    columns: Vec<String>,
    inserts: Box<dyn OutWritter>,
    create_table: Box<dyn OutWritter>,
    part: Txt2SqlPart
}

impl Debug for Txt2SqlOpenedMembers {
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
enum Txt2SqlStatus { New, Started(Txt2SqlOpenedMembers), Done }

pub struct Txt2Sql<'a>{
    status: Txt2SqlStatus,
    owf: &'a mut dyn OutWritterFactory,
    options: Txt2SqlOptions
}

impl<'a> Txt2Sql<'a> {
    pub fn init(owf: &'a mut dyn OutWritterFactory, options:Txt2SqlOptions) -> Self{
        Self{
            status: Txt2SqlStatus::New,
            options,
            owf
        }
    }
    pub fn process_start(&mut self){
        match self.status {
            Txt2SqlStatus::New => {
                self.status = Txt2SqlStatus::Started(Txt2SqlOpenedMembers{
                    columns: Vec::new(),
                    create_table: self.owf.open("create_table"),
                    inserts: self.owf.open("inserts"),
                    part: Txt2SqlPart::Head                  
                });
            }
            _ => panic!("wrong status at process_start: {:#?}", self.status)
        }
    }
    pub fn process_line(&mut self, line: &str){
        match &mut self.status {
            Txt2SqlStatus::Started(this) => {
                match this.part {
                    Txt2SqlPart::Head => {
                        let re = Regex::new(r"\W").unwrap();
                        this.columns = line.split(self.options.field_separator.as_str()).map(
                            |column| re.replace_all(column, "_").to_lowercase()
                        ).collect();
                        this.create_table.write(
                            format!(
                                "create table {} (\n{}\n);\n", 
                                self.options.table_name,
                                this.columns.iter().map(
                                    |column| format!(" {} text", column)
                                ).collect::<Vec<String>>().join(",\n")
                            ).as_str()
                        );
                        this.create_table.close();
                        this.part = Txt2SqlPart::Body;
                    }
                    Txt2SqlPart::Body => {
                        let reg_exp_quote_values = Regex::new(r"'").unwrap();
                        this.inserts.write(
                            format!(
                                "insert into {} ({}) values ({});\n", 
                                self.options.table_name,
                                this.columns.join(", "),
                                line.split(self.options.field_separator.as_str()).map(
                                    |value| format!("'{}'", reg_exp_quote_values.replace_all(value, "''").into_owned())
                                ).collect::<Vec<String>>().join(", ")
                            ).as_str()
                        );
                    }
                }
            }
            _ => panic!("wrong status at process_line: {:#?}", self.status)
        }
    }
    pub fn process_end(&mut self){
        match &mut self.status {
            Txt2SqlStatus::Started(this) => {
                this.inserts.close();
                self.owf.end();
                self.status = Txt2SqlStatus::Done;
            }
            _ => panic!("wrong status at process_end: {:#?}", self.status)
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

pub fn process_small_file(file_name: &str, base_dir: &str){
    let mut fwf = FileWritterFactory{ extension: "sql", base_dir: base_dir };
    let lines = lines_from_file(file_name);
    let mut t2s = Txt2Sql::init(&mut fwf, Txt2SqlOptions::default());
    t2s.process_start();
    for line in lines {
        t2s.process_line(&line);
    }
    t2s.process_end();
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::vecwritter::*;
        
    #[test]
    fn it_works() {
        let mut vwf = VecWritterFactory::init();

        let mut txt2sql = Txt2Sql::init(&mut vwf, Txt2SqlOptions::default());
        txt2sql.process_start();
        txt2sql.process_line("column1|Column 2");
        txt2sql.process_line("data11|data12");
        txt2sql.process_line("data21|O'Donnell");
        txt2sql.process_end();
        let mut keys = vwf.vecs.keys().collect::<Vec<&String>>();
        keys.sort_unstable();
        assert_eq!(keys, ["create_table", "inserts"]);
        assert_eq!(vwf.vecs.get("create_table").expect("create_table.sql").borrow().to_vec(), [
            "create table table1 (\n column1 text,\n column_2 text\n);\n"
        ]);
        assert_eq!(vwf.vecs.get("inserts").expect("inserts.sql").borrow().to_vec(), [
            "insert into table1 (column1, column_2) values ('data11', 'data12');\n",
            "insert into table1 (column1, column_2) values ('data21', 'O''Donnell');\n"
        ]);
    }
}
