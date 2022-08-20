use std::collections::HashMap;
use std::fs::{read_to_string};
use std::path::{PathBuf};

extern crate txt2sql;
use txt2sql::txt2sql::*;
use txt2sql::vecwritter::*;

use serde::{Deserialize};

#[derive(Deserialize, Debug, Default)]
struct FixtureOutputs{
    create_table: String,
    inserts: String
}

#[derive(Deserialize, Debug, Default)]
struct Fixture{
    options: Txt2SqlOptions,
    input: String,
    outputs: FixtureOutputs
}

/* 
#[derive(Deserialize, Debug, Default)]
struct FixtureMap {
    options: HashMap<String,String>,
    input: String,
    outputs: HashMap<String,String>
}
*/

#[test]
fn test_simple_fixture() {
    let fixture_path = "../../fixtures";
    let file_name = "simple-data.yaml";
    let path_name:PathBuf = [fixture_path, file_name].iter().collect();
    let content = read_to_string(path_name).unwrap();
    /*
    let fixture_map: FixtureMap = serde_yaml::from_str(&content).unwrap();
    println!("---------------");
    println!("{:?}", fixture_map);
    let fixture: Fixture = Fixture::default();
    */
    let fixture: Fixture = serde_yaml::from_str(&content).unwrap();
    let mut vwf = VecWritterFactory::init();
    // let mut options = Txt2Sql::default_options();
    let mut txt2sql = Txt2Sql::init(&mut vwf, fixture.options);
    txt2sql.process_start();
    for line in fixture.input.lines() {
        txt2sql.process_line(line);
    }
    txt2sql.process_end();
    assert_eq!(fixture.outputs.create_table, vwf.vecs.get("create_table").expect("create_table").borrow().to_vec().join(""));
    assert_eq!(fixture.outputs.inserts, vwf.vecs.get("inserts").expect("inserts").borrow().to_vec().join("") );
}